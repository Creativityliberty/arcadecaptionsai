import React from 'react';
import { Gamepad2, Settings, ArrowLeft } from 'lucide-react';

interface Props {
  onSelect: (mode: 'ARCADE' | 'CREATOR') => void;
  onBack: () => void;
}

export const ModeSelectScreen: React.FC<Props> = ({ onSelect, onBack }) => {
  return (
    <div className="flex flex-col h-full w-full bg-slate-950 p-6 relative">
       <button onClick={onBack} className="absolute top-6 left-6 text-slate-500 hover:text-white transition-colors">
        <ArrowLeft className="w-8 h-8" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
        <h2 className="text-3xl md:text-4xl font-title text-white mb-12 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          Select Mode
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {/* Arcade Mode Card */}
          <button 
            onClick={() => onSelect('ARCADE')}
            className="group relative h-80 perspective-1000 bg-slate-900 border-2 border-slate-700 hover:border-cyan-400 transition-all duration-300 rounded-lg overflow-hidden flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Gamepad2 className="w-16 h-16 text-cyan-500 mb-6 group-hover:scale-110 transition-transform duration-300" />
            <h3 className="text-2xl font-arcade text-white mb-4 group-hover:text-cyan-400">ARCADE</h3>
            <p className="text-slate-400 font-sans text-sm">
              Fast-paced. Punchy subtitles.
              <br/>Automated styling based on AI emotion.
            </p>
            <div className="mt-6 px-3 py-1 bg-cyan-900/50 border border-cyan-500/30 rounded text-cyan-300 text-xs font-mono uppercase">
              Recommended
            </div>
          </button>

          {/* Creator Mode Card */}
          <button 
             onClick={() => onSelect('CREATOR')}
             className="group relative h-80 bg-slate-900 border-2 border-slate-700 hover:border-purple-400 transition-all duration-300 rounded-lg overflow-hidden flex flex-col items-center justify-center p-8 text-center opacity-70 cursor-not-allowed grayscale"
             disabled
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Settings className="w-16 h-16 text-purple-500 mb-6 group-hover:rotate-90 transition-transform duration-500" />
            <h3 className="text-2xl font-arcade text-white mb-4 group-hover:text-purple-400">CREATOR</h3>
            <p className="text-slate-400 font-sans text-sm">
              Full control. Timeline editor.
              <br/>Custom assets. (Coming Soon)
            </p>
            <div className="mt-6 px-3 py-1 bg-slate-800 border border-slate-600 rounded text-slate-500 text-xs font-mono uppercase">
              Locked
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};