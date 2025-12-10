import React from 'react';
import { Zap } from 'lucide-react';

interface Props {
  onStart: () => void;
}

export const WelcomeScreen: React.FC<Props> = ({ onStart }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-black relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black animate-pulse"></div>
      
      <div className="z-10 text-center space-y-12">
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <Zap className="w-16 h-16 text-yellow-400 animate-bounce" />
          </div>
          <h1 className="text-4xl md:text-6xl font-arcade text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-purple-600 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
            ARCADE
            <br />
            CAPTIONS
          </h1>
          <p className="text-slate-400 font-title tracking-wider text-sm md:text-lg uppercase">
            Voice to Video Engine v1.0
          </p>
        </div>

        <button 
          onClick={onStart}
          className="group relative px-8 py-4 bg-transparent overflow-hidden"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-red-600 to-orange-600 opacity-80 skew-x-[-12deg] group-hover:opacity-100 transition-opacity duration-200 border-2 border-white/20"></div>
          <div className="absolute inset-0 w-full h-full border-2 border-white/50 skew-x-[-12deg] scale-[1.02] animate-pulse"></div>
          
          <span className="relative z-10 font-arcade text-white text-xl md:text-2xl tracking-widest animate-[pulse_1.5s_ease-in-out_infinite]">
            PRESS START
          </span>
        </button>
      </div>

      <div className="absolute bottom-8 text-xs text-slate-600 font-mono">
        INSERT COIN TO BEGIN
      </div>
    </div>
  );
};