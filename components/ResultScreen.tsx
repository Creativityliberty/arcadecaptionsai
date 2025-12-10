import React, { useRef, useState, useEffect } from 'react';
import { Play, RotateCcw, Download, Home, Wand2, Type, Loader2 } from 'lucide-react';
import { SubtitleSegment, AppState, VideoFilter, FontSize } from '../types';
import { FIGHTER_STYLES, VIDEO_FILTERS, FONT_SIZE_CLASSES } from '../constants';

interface Props {
  appState: AppState;
  onRetry: () => void;
  onHome: () => void;
}

export const ResultScreen: React.FC<Props> = ({ appState, onRetry, onHome }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleSegment | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  // Customization State
  const [activeFilter, setActiveFilter] = useState<VideoFilter>('none');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [activeTab, setActiveTab] = useState<'filters' | 'text'>('filters');

  // Export State
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  const styleConfig = FIGHTER_STYLES.find(s => s.id === appState.selectedStyleId) || FIGHTER_STYLES[0];

  useEffect(() => {
    if (appState.recordedBlob) {
      const url = URL.createObjectURL(appState.recordedBlob);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [appState.recordedBlob]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      const active = appState.subtitles.find(s => time >= s.start && time <= s.end);
      setCurrentSubtitle(active || null);
      if (videoRef.current.ended) setIsPlaying(false);
    }
  };

  // --- RENDERING ENGINE (Export Logic) ---
  const handleExport = async () => {
    if (!appState.recordedBlob) return;
    
    setIsRendering(true);
    setRenderProgress(0);

    try {
      // 1. Setup offline video element
      const offlineVideo = document.createElement('video');
      offlineVideo.src = URL.createObjectURL(appState.recordedBlob);
      offlineVideo.muted = true;
      offlineVideo.playsInline = true;
      
      await new Promise((resolve) => {
        offlineVideo.onloadedmetadata = resolve;
      });

      // 2. Setup Canvas
      const canvas = document.createElement('canvas');
      const width = offlineVideo.videoWidth;
      const height = offlineVideo.videoHeight;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      // 3. Setup Recorder
      const stream = canvas.captureStream(30); // 30 FPS
      
      // Combine canvas video stream with original audio track
      const audioCtx = new AudioContext();
      const audioSource = audioCtx.createMediaElementSource(offlineVideo);
      const dest = audioCtx.createMediaStreamDestination();
      audioSource.connect(dest);
      
      const tracks = [...stream.getVideoTracks(), ...dest.stream.getAudioTracks()];
      const combinedStream = new MediaStream(tracks);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9'
      });
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `arcade-captions-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsRendering(false);
        setRenderProgress(0);
        
        // Cleanup
        audioCtx.close();
      };

      mediaRecorder.start();

      // 4. Render Loop
      offlineVideo.currentTime = 0;
      await offlineVideo.play();

      const drawFrame = () => {
        if (offlineVideo.ended || offlineVideo.paused) {
          mediaRecorder.stop();
          return;
        }

        // Draw Video
        ctx.filter = getCanvasFilter(activeFilter);
        ctx.drawImage(offlineVideo, 0, 0, width, height);
        ctx.filter = 'none';

        const currentTime = offlineVideo.currentTime;
        const activeSub = appState.subtitles.find(s => currentTime >= s.start && currentTime <= s.end);

        // Draw Effects (Kamehameha, etc.) behind text
        if (activeSub) {
            drawCanvasEffects(ctx, width, height, activeSub.emotion, currentTime);
            drawCanvasSubtitle(ctx, width, height, activeSub, styleConfig, fontSize, currentTime);
        }

        setRenderProgress(Math.floor((currentTime / offlineVideo.duration) * 100));
        
        // Use requestVideoFrameCallback if available for better sync, else requestAnimationFrame
        if ('requestVideoFrameCallback' in offlineVideo) {
          (offlineVideo as any).requestVideoFrameCallback(drawFrame);
        } else {
          requestAnimationFrame(drawFrame);
        }
      };

      drawFrame();

    } catch (err) {
      console.error("Export failed", err);
      setIsRendering(false);
      alert("Export failed. Please try again.");
    }
  };

  // --- CANVAS DRAWING HELPERS ---
  const getCanvasFilter = (filter: VideoFilter) => {
    switch (filter) {
      case 'grayscale': return 'grayscale(100%)';
      case 'sepia': return 'sepia(100%)';
      case 'contrast': return 'contrast(125%) saturate(150%)';
      case 'invert': return 'invert(100%)';
      default: return 'none';
    }
  };

  const drawCanvasEffects = (
    ctx: CanvasRenderingContext2D, 
    w: number, 
    h: number, 
    emotion: string, 
    time: number
  ) => {
     // HYPE: Kamehameha Beam
     if (emotion === 'hype') {
        const beamWidth = w * 0.8;
        const x = w / 2 - beamWidth / 2;
        const flicker = Math.sin(time * 20) * 0.2 + 0.8; // Flicker effect
        
        const grad = ctx.createLinearGradient(x, 0, x + beamWidth, 0);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
        grad.addColorStop(0.2, 'rgba(0, 255, 255, 0.4)');
        grad.addColorStop(0.5, `rgba(200, 255, 255, ${0.8 * flicker})`);
        grad.addColorStop(0.8, 'rgba(0, 255, 255, 0.4)');
        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
     }

     // ANGER: Red Vignette
     if (emotion === 'anger') {
        const grad = ctx.createRadialGradient(w/2, h/2, h*0.3, w/2, h/2, h*0.8);
        grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(255, 0, 0, 0.4)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
     }
  };

  const drawCanvasSubtitle = (
    ctx: CanvasRenderingContext2D, 
    w: number, 
    h: number, 
    sub: SubtitleSegment, 
    style: any,
    fSize: FontSize,
    time: number
  ) => {
    // 1. Configure Font
    let fontSizePx = fSize === 'small' ? 40 : fSize === 'medium' ? 60 : 90;
    // Scale font based on video resolution (assuming 1080p roughly)
    const scaleFactor = h / 1080; 
    fontSizePx = fontSizePx * scaleFactor;

    // Font Family Logic (Approximate matches to CSS classes)
    let fontFamily = 'sans-serif';
    if (style.fontClass.includes('font-arcade')) fontFamily = '"Press Start 2P", cursive';
    if (style.fontClass.includes('font-title')) fontFamily = '"Russo One", sans-serif';

    ctx.font = `900 ${fontSizePx}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 2. Animation Logic (Simple Simulation)
    let offsetX = 0;
    let offsetY = 0;
    let scale = 1;

    if (sub.emotion === 'anger') {
        // Shake
        offsetX = (Math.random() - 0.5) * 20 * scaleFactor;
        offsetY = (Math.random() - 0.5) * 20 * scaleFactor;
    }
    if (sub.emotion === 'joy') {
        // Bounce
        offsetY = Math.sin(time * 10) * 15 * scaleFactor;
    }
    if (sub.emotion === 'hype') {
        // Pulse
        scale = 1 + Math.sin(time * 15) * 0.1;
    }

    // 3. Draw Text
    ctx.save();
    ctx.translate(w / 2 + offsetX, h * 0.75 + offsetY); // Position near bottom
    ctx.scale(scale, scale);

    const text = sub.text;
    const color = getEmotionHexColor(sub.emotion, style);

    // Stroke/Shadow
    ctx.lineWidth = 8 * scaleFactor;
    ctx.strokeStyle = 'black';
    ctx.strokeText(text, 0, 0);

    // Glow for Hype/Anger
    if (sub.emotion === 'hype' || sub.emotion === 'anger') {
        ctx.shadowColor = sub.emotion === 'anger' ? 'red' : 'cyan';
        ctx.shadowBlur = 20 * scaleFactor;
    }

    // Fill
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);

    ctx.restore();
  };

  const getEmotionHexColor = (emotion: string, style: any) => {
    // Canvas needs Hex/RGB, can't use Tailwind classes easily. 
    // Simplified mapping:
    if (emotion === 'anger') return '#ef4444'; // Red-500
    if (emotion === 'joy') return '#facc15'; // Yellow-400
    if (emotion === 'hype') return '#c084fc'; // Purple-400
    if (style.id === 'ryu_classic') return '#60a5fa';
    if (style.id === 'ken_fire') return '#fb923c';
    if (style.id === 'akuma_rage') return '#dc2626';
    if (style.id === 'chun_lightning') return '#22d3ee';
    return '#ffffff';
  };

  // --- DOM RENDER HELPERS (Preview) ---
  const currentFilterClass = VIDEO_FILTERS.find(f => f.id === activeFilter)?.class || '';

  const getAnimationClass = (emotion: string) => {
    switch (emotion) {
      case 'anger': return 'animate-[shake_0.4s_cubic-bezier(.36,.07,.19,.97)_both] origin-center';
      case 'joy': return 'animate-[bounce_0.6s_infinite]';
      case 'hype': return 'animate-[pulse_0.2s_ease-in-out_infinite] scale-105';
      case 'sad': return 'opacity-80 blur-[0.5px] transition-opacity duration-1000';
      default: return 'animate-[fadeIn_0.2s_ease-out]';
    }
  };

  const getEmotionColorClass = (emotion: string) => {
     if (emotion === 'anger') return 'text-red-500 drop-shadow-[0_0_8px_rgba(255,0,0,1)]';
     if (emotion === 'joy') return 'text-yellow-400 drop-shadow-[0_0_8px_rgba(255,255,0,0.8)]';
     if (emotion === 'hype') return 'text-purple-400 drop-shadow-[0_0_10px_rgba(192,38,211,1)] border-b-4 border-purple-600';
     return styleConfig.color;
  };

  // --- VFX OVERLAYS (DOM) ---
  const renderVFX = () => {
    if (!currentSubtitle) return null;
    
    // Kamehameha Effect for HYPE
    if (currentSubtitle.emotion === 'hype') {
        return (
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center overflow-hidden">
                <div className="w-[150%] h-[200px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent blur-xl animate-pulse rotate-[-10deg]"></div>
                <div className="absolute inset-0 bg-cyan-500/10 mix-blend-overlay"></div>
            </div>
        );
    }

    // Red Vignette for ANGER
    if (currentSubtitle.emotion === 'anger') {
        return (
            <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(255,0,0,0.4)_100%)] animate-pulse"></div>
        );
    }

    // Particles for JOY (Simplified CSS particles)
    if (currentSubtitle.emotion === 'joy') {
        return (
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-yellow-400 rounded-full blur-sm animate-bounce"></div>
                <div className="absolute top-1/2 right-1/4 w-6 h-6 bg-yellow-200 rounded-full blur-sm animate-ping"></div>
                <div className="absolute bottom-1/3 left-1/2 w-3 h-3 bg-white rounded-full blur-sm animate-pulse"></div>
            </div>
        );
    }
    
    return null;
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 relative">
      {/* Victory Header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 pointer-events-none flex justify-center">
         <h1 className="text-4xl font-arcade text-yellow-400 drop-shadow-[0_4px_0_rgba(180,83,9,1)] animate-bounce">
            VICTORY!
         </h1>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        <div className="relative w-full h-full max-w-md md:max-w-2xl flex items-center justify-center overflow-hidden bg-gray-900 border-x border-slate-800">
            {videoUrl && (
            <video
                ref={videoRef}
                src={videoUrl}
                className={`h-full w-full object-cover transition-all duration-300 ${currentFilterClass}`}
                onTimeUpdate={handleTimeUpdate}
                onClick={togglePlay}
                playsInline
                loop
            />
            )}

            {/* Special Effects Layer (DOM Preview) */}
            {renderVFX()}

            {/* Play Overlay */}
            {!isPlaying && !isRendering && (
            <button 
                onClick={togglePlay}
                className="absolute z-40 bg-black/50 p-6 rounded-full border-2 border-white/20 hover:scale-110 transition-transform"
            >
                <Play className="w-12 h-12 text-white fill-current" />
            </button>
            )}

            {/* SUBTITLE OVERLAY */}
            {currentSubtitle && !isRendering && (
                <div className="absolute inset-x-4 bottom-16 md:bottom-24 flex items-end justify-center pointer-events-none z-30">
                    <div 
                        key={`${currentSubtitle.start}-${currentSubtitle.text}`}
                        className={`
                            bg-black/60 backdrop-blur-md rounded-xl p-4 md:p-6
                            text-center leading-tight
                            max-w-full
                            break-words whitespace-pre-wrap
                            ${styleConfig.fontClass} 
                            ${getEmotionColorClass(currentSubtitle.emotion)}
                            ${FONT_SIZE_CLASSES[fontSize]}
                            transition-all duration-75
                            ${getAnimationClass(currentSubtitle.emotion)}
                        `}
                        style={{
                            textShadow: '3px 3px 0px rgba(0,0,0,1)'
                        }}
                    >
                        {currentSubtitle.text}
                    </div>
                </div>
            )}

            {/* Render Progress Overlay */}
            {isRendering && (
                <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" />
                    <div className="font-arcade text-white text-xl">RENDERING VIDEO...</div>
                    <div className="w-64 h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-600">
                        <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
                            style={{ width: `${renderProgress}%` }}
                        ></div>
                    </div>
                    <div className="text-slate-400 font-mono text-sm">{renderProgress}%</div>
                    <p className="text-xs text-slate-500 max-w-xs text-center mt-2">
                        Applying effects, filters, and subtitles. Please wait...
                    </p>
                </div>
            )}
        </div>
      </div>

      {/* Editor & Action Bar */}
      <div className="bg-slate-900 border-t border-slate-700 flex flex-col z-30 shadow-2xl">
        
        {/* Editor Controls */}
        <div className="flex flex-col">
            <div className="flex border-b border-slate-800">
                <button 
                    onClick={() => setActiveTab('filters')}
                    className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs uppercase font-bold tracking-wider transition-colors ${activeTab === 'filters' ? 'bg-slate-800 text-white border-b-2 border-cyan-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Wand2 className="w-4 h-4" /> Filters
                </button>
                <button 
                    onClick={() => setActiveTab('text')}
                    className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs uppercase font-bold tracking-wider transition-colors ${activeTab === 'text' ? 'bg-slate-800 text-white border-b-2 border-cyan-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Type className="w-4 h-4" /> Text Size
                </button>
            </div>

            <div className="p-4 h-20 flex items-center justify-center gap-4 bg-slate-950">
                {activeTab === 'filters' && (
                    <div className="flex gap-2 overflow-x-auto w-full justify-center">
                        {VIDEO_FILTERS.map(filter => (
                            <button
                                key={filter.id}
                                onClick={() => setActiveFilter(filter.id as VideoFilter)}
                                className={`px-3 py-1.5 rounded border text-xs uppercase font-mono transition-all ${activeFilter === filter.id ? 'bg-cyan-900 border-cyan-400 text-cyan-400' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
                            >
                                {filter.name}
                            </button>
                        ))}
                    </div>
                )}
                
                {activeTab === 'text' && (
                    <div className="flex gap-4">
                        {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                            <button
                                key={size}
                                onClick={() => setFontSize(size)}
                                className={`w-10 h-10 rounded border flex items-center justify-center transition-all ${fontSize === size ? 'bg-cyan-900 border-cyan-400 text-cyan-400' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
                            >
                                <span className={size === 'small' ? 'text-xs' : size === 'medium' ? 'text-sm' : 'text-lg'}>A</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Main Actions */}
        <div className="flex justify-between items-center p-4 bg-slate-900 border-t border-slate-800">
            <button onClick={onRetry} disabled={isRendering} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors w-16 disabled:opacity-50">
                <RotateCcw className="w-5 h-5" />
                <span className="text-[9px] uppercase">Retry</span>
            </button>
            
            <button 
                onClick={handleExport}
                disabled={isRendering}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-8 py-3 rounded-full shadow-lg shadow-cyan-900/50 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
            >
                 <Download className="w-5 h-5" />
                 <span className="font-arcade text-xs">
                     {isRendering ? 'RENDERING...' : 'EXPORT MP4'}
                 </span>
            </button>

            <button onClick={onHome} disabled={isRendering} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors w-16 disabled:opacity-50">
                <Home className="w-5 h-5" />
                <span className="text-[9px] uppercase">Quit</span>
            </button>
        </div>
      </div>
    </div>
  );
};