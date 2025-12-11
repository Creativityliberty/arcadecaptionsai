import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Mic, Square, Upload, Zap } from 'lucide-react';
import { ProcessingResult, Emotion } from '../types';
import { generateSubtitlesFromAudio } from '../services/geminiService';
import { FIGHTER_STYLES } from '../constants';

interface Props {
  selectedStyleId: string;
  onProcessingComplete: (result: ProcessingResult) => void;
  onBack: () => void;
}

export const BattleArenaScreen: React.FC<Props> = ({ selectedStyleId, onProcessingComplete, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [timer, setTimer] = useState(0);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Audio Visualization & Emotion Simulation
  const [audioVolume, setAudioVolume] = useState(0);
  const [simulatedEmotion, setSimulatedEmotion] = useState<Emotion>('neutral');
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const styleConfig = FIGHTER_STYLES.find(s => s.id === selectedStyleId) || FIGHTER_STYLES[0];

  // Setup Camera & Audio Analysis
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Setup Audio Context for visualization
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        const source = audioContext.createMediaStreamSource(mediaStream);
        sourceRef.current = source;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVolume = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Normalize roughly 0-1
          const normalized = Math.min(1, average / 80); 
          setAudioVolume(normalized);

          // Simulate Emotion based on Volume
          if (normalized > 0.6) setSimulatedEmotion('anger');
          else if (normalized > 0.3) setSimulatedEmotion('joy');
          else setSimulatedEmotion('neutral');
          
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        };

        updateVolume();

      } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Camera/Mic access required. Please allow permissions.");
      }
    };
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = () => {
    if (!stream) return;
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    const localChunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) localChunks.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(localChunks, { type: 'video/webm' });
      setChunks(localChunks); // Save for re-renders if needed
      await processVideo(blob);
    };

    recorder.start();
    setIsRecording(true);
    setTimer(0);
    timerRef.current = window.setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const processVideo = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const subtitles = await generateSubtitlesFromAudio(blob);
      onProcessingComplete({
        videoBlob: blob,
        subtitles,
        selectedStyleId
      });
    } catch (err) {
        console.error("Processing failed", err);
        setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processVideo(file);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-black">
        <div className="w-64 h-8 border-4 border-slate-700 p-1 mb-4 relative overflow-hidden">
           <div className="h-full bg-green-500 animate-[width_2s_ease-in-out_infinite]" style={{width: '100%'}}></div>
        </div>
        <h2 className="text-2xl font-arcade text-green-500 animate-pulse text-center">
          ANALYZING SPEECH...
        </h2>
        <p className="text-slate-500 font-mono mt-2 uppercase text-xs">Gemini AI is studying your moves</p>
      </div>
    );
  }

  // Visual Helper Functions
  const getPreviewText = () => {
    if (audioVolume < 0.1) return "READY?";
    if (simulatedEmotion === 'anger') return "LOUD!!";
    if (simulatedEmotion === 'joy') return "HYPE!";
    return "SPEAK";
  };

  const getPreviewAnimationClass = () => {
    if (audioVolume < 0.1) return 'animate-pulse opacity-50';
    if (simulatedEmotion === 'anger') return 'animate-[shake_0.1s_infinite] text-red-500 scale-110 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]';
    if (simulatedEmotion === 'joy') return 'animate-bounce text-yellow-400 scale-105';
    return 'text-white';
  };

  const getBorderState = () => {
    if (isRecording) {
        return 'border-red-600 shadow-[inset_0_0_30px_#f00] animate-pulse';
    }
    
    // Dynamic reaction to volume/emotion
    if (simulatedEmotion === 'anger') {
        return 'border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.8)]';
    }
    if (simulatedEmotion === 'joy') {
        return 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]';
    }
    
    // Default style color with slight glow
    return `${styleConfig.borderColor} shadow-[0_0_15px_rgba(0,0,0,0.3)]`;
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 relative">
      <div className="absolute top-4 left-4 z-20">
         <button onClick={onBack} className="text-white hover:text-red-500 transition-colors bg-black/50 p-2 rounded-full">
            <ArrowLeft className="w-6 h-6" />
         </button>
      </div>

      {/* Header HUD */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
        <div className="bg-black/70 border-2 border-white/20 px-6 py-2 rounded transform skew-x-[-10deg]">
           <span className="font-arcade text-white text-xl drop-shadow-[0_0_5px_#fff]">
             {isRecording ? "RECORDING" : "ROUND 1"}
           </span>
        </div>
      </div>
      
      {/* Timer */}
      {isRecording && (
        <div className="absolute top-20 left-0 right-0 flex justify-center z-10 pointer-events-none">
             <span className="font-mono text-red-500 text-3xl font-bold">{formatTime(timer)}</span>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className={`
                h-full w-full object-cover max-w-md md:max-w-2xl border-x-4 
                transition-all duration-100 ease-out
                ${getBorderState()}
            `} 
            style={{
                // Subtle scale kick on volume
                transform: `scale(${1 + Math.max(0, audioVolume * 0.05)})`
            }}
        />
        
        {/* Style Preview Overlay (Dynamic Visualizer) */}
        {!isRecording && stream && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div 
                    className={`
                        transition-all duration-100 ease-out
                        ${styleConfig.fontClass}
                        text-center
                        ${getPreviewAnimationClass()}
                    `}
                    style={{
                        fontSize: `${4 + (audioVolume * 4)}rem`,
                    }}
                >
                    <div>{getPreviewText()}</div>
                    <div className="text-sm font-sans tracking-widest mt-2 text-white opacity-70">MIC CHECK</div>
                </div>
            </div>
        )}

        {/* Recording Overlay */}
        {isRecording && (
            <div className="absolute inset-x-0 bottom-1/3 flex justify-center pointer-events-none">
                 <div className={`
                    ${styleConfig.fontClass} 
                    text-4xl text-white drop-shadow-[0_2px_0_#000]
                    transition-all duration-75
                    ${getPreviewAnimationClass()}
                 `}>
                    {simulatedEmotion === 'anger' ? "*SHAKE*" : simulatedEmotion === 'joy' ? "*BOUNCE*" : "..."}
                 </div>
            </div>
        )}
        
        {/* Power Level Bar (Real Viz) */}
        <div className="absolute right-4 top-1/4 bottom-1/4 w-4 bg-slate-800 border border-slate-600 rounded-full overflow-hidden flex flex-col justify-end z-20">
            <div 
                className={`w-full transition-all duration-75 ${simulatedEmotion === 'anger' ? 'bg-red-600' : simulatedEmotion === 'joy' ? 'bg-yellow-400' : 'bg-blue-500'}`}
                style={{ height: `${Math.min(100, audioVolume * 100 * 1.5)}%` }}
            ></div>
        </div>
      </div>

      {/* Controls */}
      <div className="h-32 bg-slate-950 border-t-2 border-white/10 flex items-center justify-center gap-8 relative z-20">
        
        {/* File Upload Hidden Input */}
        <input 
          type="file" 
          id="video-upload" 
          accept="video/*" 
          className="hidden" 
          onChange={handleFileUpload}
        />
        <label htmlFor="video-upload" className="cursor-pointer text-slate-500 hover:text-white flex flex-col items-center gap-1 group">
          <div className="p-3 border border-slate-700 rounded-full group-hover:border-white transition-colors">
             <Upload className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-mono uppercase">Import</span>
        </label>

        {/* Record Button */}
        <button 
          onClick={isRecording ? stopRecording : startRecording}
          className={`
            w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-200 transform hover:scale-105
            ${isRecording 
              ? 'bg-red-900 border-red-500 shadow-[0_0_20px_#f00]' 
              : 'bg-slate-800 border-slate-600 hover:border-white hover:bg-slate-700'}
          `}
        >
          {isRecording ? (
            <Square className="w-8 h-8 text-white fill-current" />
          ) : (
            <Mic className={`w-8 h-8 ${audioVolume > 0.1 ? 'text-white' : 'text-slate-400'}`} />
          )}
        </button>
        
        <div className="w-10"></div> {/* Spacer to balance */}
      </div>
    </div>
  );
};