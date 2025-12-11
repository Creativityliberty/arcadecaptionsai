
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
    
    // 1. Wait for fonts to be ready (CRITICAL for canvas text)
    try {
        await document.fonts.ready;
    } catch (e) {
        console.warn("Fonts might not be fully loaded", e);
    }

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
        alert("Your browser does not support video recording export.");
        return;
    }

    setIsRendering(true);
    setRenderProgress(0);
    
    // Cleanup variables
    let offlineVideo: HTMLVideoElement | null = null;
    let audioCtx: AudioContext | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;

    try {
      // 2. Setup offline video element attached to DOM (hidden)
      // This is required for Chrome/Edge to process audio/video correctly
      offlineVideo = document.createElement('video');
      offlineVideo.style.position = 'fixed';
      offlineVideo.style.top = '0';
      offlineVideo.style.left = '0';
      offlineVideo.style.width = '1px';
      offlineVideo.style.height = '1px';
      offlineVideo.style.opacity = '0.01'; // Not 0 to ensure browser renders it
      offlineVideo.style.pointerEvents = 'none';
      offlineVideo.style.zIndex = '-1';
      document.body.appendChild(offlineVideo);

      offlineVideo.crossOrigin = "anonymous";
      offlineVideo.src = URL.createObjectURL(appState.recordedBlob);
      offlineVideo.muted = false; // Important: Unmuted to capture audio track
      offlineVideo.volume = 1.0;
      offlineVideo.playsInline = true;
      
      await new Promise((resolve, reject) => {
        if (!offlineVideo) return reject("No video");
        offlineVideo.onloadeddata = () => resolve(true);
        offlineVideo.onerror = reject;
      });

      // 3. Setup Canvas
      const canvas = document.createElement('canvas');
      const width = offlineVideo.videoWidth || 1280;
      const height = offlineVideo.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      if (!ctx) throw new Error("Could not get canvas context");

      // 4. Setup Audio Mixing
      // We use AudioContext to mix the video audio into the stream
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createMediaElementSource(offlineVideo);
      source.connect(dest);
      // Connect to speakers momentarily to ensure flow, but gain 0 to avoid echo if needed
      // source.connect(audioCtx.destination); 

      // 5. Create the Stream
      // '0' means we manually drive frames via requestFrame, reducing dropped frames
      const canvasStream = canvas.captureStream(0); 
      const audioTrack = dest.stream.getAudioTracks()[0];
      
      const combinedTracks = [...canvasStream.getVideoTracks()];
      if (audioTrack) combinedTracks.push(audioTrack);
      
      stream = new MediaStream(combinedTracks);

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps for high quality
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
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `arcade_fighter_${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Cleanup
        setIsRendering(false);
        setRenderProgress(0);
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
        if (offlineVideo && document.body.contains(offlineVideo)) {
          document.body.removeChild(offlineVideo);
        }
        if (stream) stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();

      // 6. Start Playback & Resume Audio
      if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
      }
      offlineVideo.currentTime = 0;
      await offlineVideo.play();

      // 7. Render Loop
      const drawFrame = () => {
        if (!offlineVideo || !ctx || !mediaRecorder) return;

        if (offlineVideo.ended || offlineVideo.paused) {
          if (mediaRecorder.state !== 'inactive') {
             mediaRecorder.stop();
          }
          return;
        }

        // --- A. Draw Background (Clear) ---
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // --- B. Draw Video Base ---
        ctx.filter = getCanvasFilter(activeFilter);
        
        const currentTime = offlineVideo.currentTime;
        const activeSub = appState.subtitles.find(s => currentTime >= s.start && currentTime <= s.end);
        
        // VFX: Camera Shake
        let dx = 0;
        let dy = 0;
        if (activeSub?.emotion === 'anger') {
            const intensity = 30; 
            dx = (Math.random() - 0.5) * intensity;
            dy = (Math.random() - 0.5) * intensity;
        }

        ctx.drawImage(offlineVideo, dx, dy, width, height);
        ctx.filter = 'none';

        // --- C. Draw VFX & Text ---
        if (activeSub) {
            drawCanvasVFX(ctx, width, height, activeSub.emotion, currentTime);
            drawCanvasSubtitle(ctx, width, height, activeSub, styleConfig, fontSize, currentTime);
        }

        // Manually trigger a frame capture for the recorder
        // (This works with captureStream(0))
        const videoTrack = canvasStream.getVideoTracks()[0];
        if (videoTrack && (videoTrack as any).requestFrame) {
            (videoTrack as any).requestFrame();
        }

        setRenderProgress(Math.floor((currentTime / offlineVideo.duration) * 100));
        
        // Loop using Video Frame Callback for sync, or fallback to rAF
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
      
      // Cleanup on error
      if (audioCtx) audioCtx.close();
      if (offlineVideo && document.body.contains(offlineVideo)) {
          document.body.removeChild(offlineVideo);
      }
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
        const centerY = h * 0.75; 
        const flicker = Math.sin(time * 30) * 0.5 + 1.5;
        
        const beamHeight = 250 * flicker;
        const grad = ctx.createLinearGradient(0, centerY, w, centerY);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
        grad.addColorStop(0.2, 'rgba(50, 150, 255, 0.6)');
        grad.addColorStop(0.5, 'rgba(200, 255, 255, 0.9)');
        grad.addColorStop(0.8, 'rgba(50, 150, 255, 0.6)');
        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.fillRect(0, centerY - beamHeight/2, w, beamHeight);

        const coreHeight = 60 * flicker;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(0, centerY - coreHeight/2, w, coreHeight);

        // Lightning
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const x = Math.random() * w;
            const y = centerY + (Math.random() - 0.5) * beamHeight;
            const len = 50 + Math.random() * 150;
            ctx.moveTo(x, y);
            ctx.lineTo(x + len, y + (Math.random() - 0.5) * 60);
        }
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
     }

     // RAGE VIGNETTE (Anger)
     if (emotion === 'anger') {
        const pulse = Math.sin(time * 20);
        const grad = ctx.createRadialGradient(w/2, h/2, h*0.4, w/2, h/2, h);
        grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
        grad.addColorStop(1, `rgba(220, 38, 38, ${0.4 + pulse * 0.2})`);
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
     }

     // SPARKLES (Joy)
     if (emotion === 'joy') {
         const count = 25;
         for (let i = 0; i < count; i++) {
             const x = ((time * 150 + i * 150) % w);
             const y = ((time * 250 + i * 100) % h);
             const size = 8 + (i % 3) * 5;
             
             ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#ffffff';
             ctx.globalAlpha = 0.8;
             ctx.beginPath();
             ctx.arc(x, y, size, 0, Math.PI * 2);
             ctx.fill();
             ctx.globalAlpha = 1.0;
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
    let baseSize = fSize === 'small' ? 40 : fSize === 'medium' ? 65 : 90;
    const fontSizePx = baseSize * (w < h ? w/700 : w/1200); 

    let fontFamily = 'sans-serif';
    if (style.fontClass.includes('font-arcade')) fontFamily = '"Press Start 2P", cursive';
    if (style.fontClass.includes('font-title')) fontFamily = '"Russo One", sans-serif';

    ctx.font = `900 ${fontSizePx}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Animations
    let offsetX = 0;
    let offsetY = 0;
    let scale = 1;
    let rotation = 0;

    if (sub.emotion === 'anger') {
        offsetX = (Math.random() - 0.5) * 20;
        offsetY = (Math.random() - 0.5) * 20;
        rotation = (Math.random() - 0.5) * 0.15;
    }
    if (sub.emotion === 'joy') {
        offsetY = Math.sin(time * 10) * 30;
        rotation = Math.sin(time * 5) * 0.08;
    }
    if (sub.emotion === 'hype') {
        scale = 1 + Math.abs(Math.sin(time * 12)) * 0.2;
    }

    ctx.save();
    
    // Opacity Animation (Fade In / Fade Out)
    const fadeIn = 0.08; 
    const fadeOut = 0.15;
    const delay = 0.05; // slight delay after audio start
    
    const elapsed = time - sub.start;
    const remaining = sub.end - time;
    let alpha = 1.0;

    // Fade In logic
    if (elapsed < delay) {
        alpha = 0;
    } else if (elapsed < delay + fadeIn) {
        alpha = (elapsed - delay) / fadeIn;
    }

    // Fade Out logic
    if (remaining < fadeOut) {
        alpha = Math.min(alpha, remaining / fadeOut);
    }
    
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    ctx.translate(w / 2 + offsetX, h * 0.8 + offsetY); 
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    const text = sub.text.toUpperCase();
    const color = getEmotionHexColor(sub.emotion, style);

    // Stroke
    ctx.lineWidth = 15 * (w/1080);
    ctx.strokeStyle = '#000000';
    ctx.strokeText(text, 0, 0);

    // Glow
    if (sub.emotion === 'hype' || style.id === 'chun_lightning') {
        ctx.shadowColor = color;
        ctx.shadowBlur = 40;
    }

    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);

    ctx.restore();
  };

  const getEmotionHexColor = (emotion: string, style: any) => {
    if (emotion === 'anger') return '#ef4444';
    if (emotion === 'joy') return '#facc15';
    if (emotion === 'hype') return '#e879f9';
    if (style.id === 'ryu_classic') return '#60a5fa';
    if (style.id === 'ken_fire') return '#fb923c';
    if (style.id === 'akuma_rage') return '#dc2626';
    if (style.id === 'chun_lightning') return '#22d3ee';
    return '#ffffff';
  };

  // --- DOM RENDER HELPERS (PREVIEW) ---
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

            {/* SUBTITLE OVERLAY (DOM PREVIEW) */}
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
                    <p className="text-[10px] text-red-500 font-mono mt-4">
                        Do not close this tab.
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
