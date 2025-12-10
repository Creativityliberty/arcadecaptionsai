import React from 'react';
import { ArrowLeft, Flame, Zap, Shield, Skull } from 'lucide-react';
import { FIGHTER_STYLES } from '../constants';
import { StyleConfig } from '../types';

interface Props {
  onSelect: (styleId: string) => void;
  onBack: () => void;
}

const IconMap: Record<string, React.FC<any>> = {
  Flame, Zap, Shield, Skull
};

export const StyleSelectScreen: React.FC<Props> = ({ onSelect, onBack }) => {
  const [hoveredStyle, setHoveredStyle] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 pointer-events-none"></div>

      <div className="p-6 z-10 flex flex-col h-full max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-8 h-8" />
          </button>
          <h2 className="text-2xl md:text-3xl font-arcade text-white uppercase text-center drop-shadow-md">
            Choose Your Fighter
          </h2>
          <div className="w-8"></div> {/* Spacer */}
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 content-center">
          {FIGHTER_STYLES.map((style) => {
            const Icon = IconMap[style.icon] || Shield;
            const isHovered = hoveredStyle === style.id;
            
            return (
              <button
                key={style.id}
                onClick={() => onSelect(style.id)}
                onMouseEnter={() => setHoveredStyle(style.id)}
                onMouseLeave={() => setHoveredStyle(null)}
                className={`
                  relative h-96 border-4 transition-all duration-200 flex flex-col 
                  ${isHovered ? `${style.borderColor} scale-105 z-20 shadow-[0_0_30px_rgba(0,0,0,0.5)]` : 'border-slate-800 scale-100 grayscale-[0.5]'}
                  bg-slate-900 overflow-hidden group
                `}
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-b ${style.bgGradient} opacity-60`}></div>
                
                {/* Character "Portrait" Placeholder - Icon */}
                <div className="flex-1 flex items-center justify-center relative">
                    <Icon 
                        className={`w-32 h-32 transition-transform duration-300 ${isHovered ? 'scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]' : ''} ${style.color}`} 
                    />
                    {/* Animated Text Preview */}
                    {isHovered && (
                        <div className="absolute bottom-4 left-0 right-0 text-center animate-bounce">
                            <span className={`text-xl ${style.fontClass} ${style.color}`}>
                                READY!
                            </span>
                        </div>
                    )}
                </div>

                {/* Info Panel */}
                <div className="relative p-4 bg-black/60 backdrop-blur-sm border-t-2 border-white/10">
                  <h3 className={`text-lg ${style.fontClass} text-white mb-1 uppercase truncate`}>
                    {style.name}
                  </h3>
                  <p className="text-xs text-slate-300 font-sans leading-tight">
                    {style.description}
                  </p>
                </div>
                
                {/* Selection Flash */}
                <div className="absolute inset-0 bg-white opacity-0 group-active:opacity-30 transition-opacity duration-75 pointer-events-none"></div>
              </button>
            );
          })}
        </div>
        
        <div className="mt-8 text-center text-slate-500 font-mono text-xs uppercase animate-pulse">
           Select a style to synchronize with your emotions
        </div>
      </div>
    </div>
  );
};