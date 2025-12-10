import React, { useRef, useState, useEffect } from 'react';
import { Play, RotateCcw, Download, Home, Wand2, Type, Loader2, Pause } from 'lucide-react';
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

  // --- EXPORT / RENDERING ENGINE ---
  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4' 
    ];
    return types.find(t => MediaRecorder.isTypeSupported(t));
  };

  const handleExport = async () => {
    if (!appState.recordedBlob) return;
    
    const mimeType = getSupportedMimeType();
    if (!mimeType) {
        alert("Your browser does not support video recording export.");
        return;
    }

    setIsRendering(true);
    setRenderProgress(0);

    try {
      // 1. Setup offline video element
      const offlineVideo = document.createElement('video');
      offlineVideo.src = URL.createObjectURL(appState.recordedBlob);
      offlineVideo.muted = true;
      offlineVideo.playsInline = true;
      offlineVideo.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        offlineVideo.onloadeddata = resolve;
        offlineVideo.onerror = reject;
      });

      // 2. Setup Canvas
      const canvas = document.createElement('canvas');
      const width = offlineVideo.videoWidth;
      const height = offlineVideo.videoHeight;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error("Could not get canvas context");

      // 3. Setup Recorder
      const stream = canvas.captureStream(30); // 30 FPS target
      
      // Mix Audio
      const audioCtx = new AudioContext();
      const audioSource = audioCtx.createMediaElementSource(offlineVideo);
      const dest = audioCtx.createMediaStreamDestination();
      audioSource.connect(dest);
      
      const tracks = [...stream.getVideoTracks(), ...dest.stream.getAudioTracks()];
      const combinedStream = new MediaStream(tracks);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000 // 5 Mbps for good quality
      });
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Determine extension
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `arcade_fighter_${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setIsRendering(false);
        setRenderProgress(0);
        audioCtx.close();
      };

      mediaRecorder.start();

      // 4. Render Loop
      offlineVideo.currentTime = 0;
      await offlineVideo.play();

      const drawFrame = () => {
        if (offlineVideo.ended || offlineVideo.paused) {
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
          return;
        }

        // --- A. Draw Video Base ---
        // Apply filter via context filter
        ctx.filter = getCanvasFilter(activeFilter);
        
        // ANGER VFX: Glitch/Shake the video frame itself
        const currentTime = offlineVideo.currentTime;
        const activeSub = appState.subtitles.find(s => currentTime >= s.start && currentTime <= s.end);
        
        let dx = 0;
        let dy = 0;
        
        if (activeSub?.emotion === 'anger') {
            dx = (Math.random() - 0.5) * 40;
            dy = (Math.random() - 0.5) * 40;
            // Occasional color split or slice could be done here but simple shake is safer for performance
        }

        ctx.drawImage(offlineVideo, dx, dy, width, height);
        ctx.filter = 'none';

        // --- B. Draw VFX Behind Text ---
        if (activeSub) {
            drawCanvasVFX(ctx, width, height, activeSub.emotion, currentTime);
            drawCanvasSubtitle(ctx, width, height, activeSub, styleConfig, fontSize, currentTime);
        }

        setRenderProgress(Math.floor((currentTime / offlineVideo.duration) * 100));
        
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
      alert("Export failed. Please try again on a desktop browser like Chrome.");
    }
  };

  // --- CANVAS HELPERS ---

  const getCanvasFilter = (filter: VideoFilter) => {
    switch (filter) {
      case 'grayscale': return 'grayscale(100%)';
      case 'sepia': return 'sepia(80%)';
      case 'contrast': return 'contrast(130%) saturate(140%)';
      case 'invert': return 'invert(100%)';
      default: return 'none';
    }
  };

  const drawCanvasVFX = (
    ctx: CanvasRenderingContext2D, 
    w: number, 
    h: number, 
    emotion: string, 
    time: number
  ) => {
     // KAMEHAMEHA (Hype)
     if (emotion === 'hype') {
        const centerY = h * 0.75; // Behind text area
        const flicker = Math.sin(time * 30) * 0.5 + 1.5; // Intense flicker
        
        // 1. Main Beam (Gradient)
        const beamHeight = 200 * flicker;
        const grad = ctx.createLinearGradient(0, centerY, w, centerY);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
        grad.addColorStop(0.2, 'rgba(50, 150, 255, 0.5)');
        grad.addColorStop(0.5, 'rgba(200, 255, 255, 0.8)');
        grad.addColorStop(0.8, 'rgba(50, 150, 255, 0.5)');
        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

        ctx.globalCompositeOperation = 'screen'; // Additive blending
        ctx.fillStyle = grad;
        ctx.fillRect(0, centerY - beamHeight/2, w, beamHeight);

        // 2. Core Beam (White hot)
        const coreHeight = 50 * flicker;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(0, centerY - coreHeight/2, w, coreHeight);

        // 3. Lightning Particles
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * w;
            const y = centerY + (Math.random() - 0.5) * beamHeight;
            const len = 50 + Math.random() * 100;
            ctx.moveTo(x, y);
            ctx.lineTo(x + len, y + (Math.random() - 0.5) * 50);
        }
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
     }

     // RAGE VIGNETTE (Anger)
     if (emotion === 'anger') {
        const pulse = Math.sin(time * 20);
        const grad = ctx.createRadialGradient(w/2, h/2, h*0.4, w/2, h/2, h);
        grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
        grad.addColorStop(1, `rgba(255, 0, 0, ${0.3 + pulse * 0.1})`);
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
     }

     // SPARKLES (Joy)
     if (emotion === 'joy') {
         // Simple confetti simulation based on time
         const count = 20;
         for (let i = 0; i < count; i++) {
             // Pseudo-random position based on time + index
             const x = ((time * 100 + i * 150) % w);
             const y = ((time * 200 + i * 100) % h);
             const size = 5 + (i % 3) * 5;
             
             ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#ffffff';
             ctx.beginPath();
             ctx.arc(x, y, size, 0, Math.PI * 2);
             ctx.fill();
         }
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
    // 1. Scale Font
    let baseSize = fSize === 'small' ? 40 : fSize === 'medium' ? 65 : 90;
    const scaleFactor = w / 1080; // normalize based on width
    const fontSizePx = baseSize * (w < h ? w/700 : w/1200); // responsive logic

    let fontFamily = 'sans-serif';
    if (style.fontClass.includes('font-arcade')) fontFamily = '"Press Start 2P", cursive';
    if (style.fontClass.includes('font-title')) fontFamily = '"Russo One", sans-serif';

    ctx.font = `900 ${fontSizePx}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 2. Animations
    let offsetX = 0;
    let offsetY = 0;
    let scale = 1;
    let rotation = 0;

    if (sub.emotion === 'anger') {
        offsetX = (Math.random() - 0.5) * 15;
        offsetY = (Math.random() - 0.5) * 15;
        rotation = (Math.random() - 0.5) * 0.1;
    }
    if (sub.emotion === 'joy') {
        offsetY = Math.sin(time * 8) * 20;
        rotation = Math.sin(time * 4) * 0.05;
    }
    if (sub.emotion === 'hype') {
        scale = 1 + Math.abs(Math.sin(time * 10)) * 0.15;
    }

    // 3. Draw
    ctx.save();
    ctx.translate(w / 2 + offsetX, h * 0.8 + offsetY); 
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    const text = sub.text.toUpperCase();
    const color = getEmotionHexColor(sub.emotion, style);

    // Dynamic Outline
    ctx.lineWidth = 12 * scaleFactor;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(text, 0, 0);

    // Neon Glow for certain styles
    if (sub.emotion === 'hype' || style.id === 'chun_lightning') {
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
    }

    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);

    ctx.restore();
  };

  const getEmotionHexColor = (emotion: string, style: any) => {
    if (emotion === 'anger') return '#ef4444'; // Red
    if (emotion === 'joy') return '#facc15'; // Yellow
    if (emotion === 'hype') return '#e879f9'; // Fuchsia
    if (style.id === 'ryu_classic') return '#60a5fa';
    if (style.id === 'ken_fire') return '#fb923c';
    if (style.id === 'akuma_rage') return '#dc2626';
    if (style.id === 'chun_lightning') return '#22d3ee';
    return '#ffffff';
  };

  // --- DOM RENDER HELPERS ---
  const currentFilterClass = VIDEO_FILTERS.find(f => f.id === activeFilter)?.class || '';

  const getAnimationClass = (emotion: string) => {
    switch (emotion) {
      case 'anger': return 'animate-[shake_0.2s_infinite] origin-center';
      case 'joy': return 'animate-[bounce_0.6s_infinite]';
      case 'hype': return 'animate-[pulse_0.15s_ease-in-out_infinite] scale-110';
      case 'sad': return 'opacity-90 blur-[0.5px]';
      default: return 'animate-[fadeIn_0.2s_ease-out]';
    }
  };

  const getEmotionColorClass = (emotion: string) => {
     if (emotion === 'anger') return 'text-red-600 drop-shadow-[0_2px_0_#fff] stroke-black';
     if (emotion === 'joy') return 'text-yellow-400 drop-shadow-[0_2px_0_#000]';
     if (emotion === 'hype') return 'text-fuchsia-400 drop-shadow-[0_0_15px_rgba(192,38,211,1)]';
     return styleConfig.color;
  };

  // --- VFX OVERLAYS (Preview) ---
  const renderVFX = () => {
    if (!currentSubtitle) return null;
    
    if (currentSubtitle.emotion === 'hype') {
        return (
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center overflow-hidden">
                {/* Kamehameha Beam */}
                <div className="absolute top-[70%] left-[-50%] right-[-50%] h-32 bg-cyan-400/30 blur-2xl animate-pulse transform -rotate-2"></div>
                <div className="absolute top-[72%] left-[-50%] right-[-50%] h-12 bg-white/60 blur-lg animate-[pulse_0.1s_infinite] transform -rotate-2"></div>
                <div className="absolute inset-0 bg-fuchsia-500/10 mix-blend-overlay"></div>
            </div>
        );
    }

    if (currentSubtitle.emotion === 'anger') {
        return (
            <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(220,38,38,0.5)_100%)] animate-[pulse_0.2s_infinite]"></div>
        );
    }

    if (currentSubtitle.emotion === 'joy') {
        return (
             <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                <div className="absolute w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.1),transparent)]"></div>
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
        <div className="relative w-full h-full max-w-md md:max-w-2xl flex items-center justify-center overflow-hidden bg-gray-900 border-x border-slate-800 shadow-2xl">
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

            {renderVFX()}

            {!isPlaying && !isRendering && (
            <button 
                onClick={togglePlay}
                className="absolute z-40 bg-black/60 p-6 rounded-full border-2 border-white/20 hover:scale-110 hover:border-cyan-400 transition-all group"
            >
                <Play className="w-12 h-12 text-white group-hover:text-cyan-400 fill-current" />
            </button>
            )}

             {isPlaying && !isRendering && (
               <button 
                  onClick={togglePlay} 
                  className="absolute inset-0 w-full h-full z-20 cursor-pointer opacity-0"
               />
             )}

            {/* SUBTITLE OVERLAY (DOM) */}
            {currentSubtitle && !isRendering && (
                <div className="absolute inset-x-4 bottom-[20%] flex items-end justify-center pointer-events-none z-30">
                    <div 
                        key={`${currentSubtitle.start}-${currentSubtitle.text}`}
                        className={`
                            bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2
                            text-center leading-none
                            break-words whitespace-pre-wrap
                            ${styleConfig.fontClass} 
                            ${getEmotionColorClass(currentSubtitle.emotion)}
                            ${FONT_SIZE_CLASSES[fontSize]}
                            transition-all duration-75
                            ${getAnimationClass(currentSubtitle.emotion)}
                        `}
                        style={{
                            textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                        }}
                    >
                        {currentSubtitle.text}
                    </div>
                </div>
            )}

            {/* Rendering Overlay */}
            {isRendering && (
                <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center space-y-6 animate-fadeIn">
                    <div className="relative">
                        <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 animate-pulse"></div>
                        <Loader2 className="w-16 h-16 text-cyan-400 animate-spin relative z-10" />
                    </div>
                    <div className="space-y-2 text-center">
                        <div className="font-arcade text-white text-2xl tracking-widest animate-pulse">RENDERING...</div>
                        <div className="text-cyan-400 font-mono text-lg">{renderProgress}%</div>
                    </div>
                    
                    <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div 
                            className="h-full bg-gradient-to-r from-cyan-600 via-blue-500 to-purple-600 transition-all duration-200"
                            style={{ width: `${renderProgress}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">
                        Burning VFX & Subtitles
                    </p>
                </div>
            )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-slate-900 border-t border-slate-700 flex flex-col z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex border-b border-slate-800">
            <button 
                onClick={() => setActiveTab('filters')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] md:text-xs uppercase font-bold tracking-widest transition-all ${activeTab === 'filters' ? 'bg-slate-800 text-white border-b-2 border-cyan-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Wand2 className="w-4 h-4" /> Filters
            </button>
            <button 
                onClick={() => setActiveTab('text')}
                className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] md:text-xs uppercase font-bold tracking-widest transition-all ${activeTab === 'text' ? 'bg-slate-800 text-white border-b-2 border-cyan-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Type className="w-4 h-4" /> Typography
            </button>
        </div>

        <div className="p-4 h-24 flex items-center justify-center bg-slate-950/50 backdrop-blur">
            {activeTab === 'filters' && (
                <div className="flex gap-3 overflow-x-auto w-full px-4 justify-start md:justify-center scrollbar-hide">
                    {VIDEO_FILTERS.map(filter => (
                        <button
                            key={filter.id}
                            onClick={() => setActiveFilter(filter.id as VideoFilter)}
                            className={`
                                flex-shrink-0 px-4 py-2 rounded-md border text-xs uppercase font-mono transition-all duration-200
                                ${activeFilter === filter.id 
                                    ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
                                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'}
                            `}
                        >
                            {filter.name}
                        </button>
                    ))}
                </div>
            )}
            
            {activeTab === 'text' && (
                <div className="flex gap-6">
                    {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                        <button
                            key={size}
                            onClick={() => setFontSize(size)}
                            className={`
                                w-12 h-12 rounded-lg border flex items-center justify-center transition-all duration-200
                                ${fontSize === size 
                                    ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400 scale-110 shadow-[0_0_15px_rgba(34,211,238,0.2)]' 
                                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}
                            `}
                        >
                            <span className={size === 'small' ? 'text-xs' : size === 'medium' ? 'text-lg' : 'text-2xl font-bold'}>A</span>
                        </button>
                    ))}
                </div>
            )}
        </div>

        <div className="flex justify-between items-center p-4 bg-slate-900 border-t border-slate-800">
            <button onClick={onRetry} disabled={isRendering} className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors w-20 group disabled:opacity-30">
                <RotateCcw className="w-5 h-5 group-hover:-rotate-90 transition-transform" />
                <span className="text-[9px] uppercase font-bold tracking-wider">Retry</span>
            </button>
            
            <button 
                onClick={handleExport}
                disabled={isRendering}
                className={`
                    relative overflow-hidden flex items-center gap-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-8 py-3 rounded-full shadow-lg shadow-cyan-900/40 transition-all 
                    ${isRendering ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-cyan-500/25 active:scale-95'}
                `}
            >
                 <div className="absolute inset-0 bg-white/20 translate-y-full skew-y-12 group-hover:translate-y-0 transition-transform"></div>
                 {isRendering ? <Loader2 className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5" />}
                 <span className="font-arcade text-xs tracking-wider">
                     {isRendering ? 'RENDERING...' : 'EXPORT MP4'}
                 </span>
            </button>

            <button onClick={onHome} disabled={isRendering} className="flex flex-col items-center gap-1 text-slate-500 hover:text-red-400 transition-colors w-20 group disabled:opacity-30">
                <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] uppercase font-bold tracking-wider">Quit</span>
            </button>
        </div>
      </div>
    </div>
  );
};