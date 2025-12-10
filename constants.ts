
import { StyleConfig } from './types';
import { Flame, Zap, Shield, Skull } from 'lucide-react';

export const FIGHTER_STYLES: StyleConfig[] = [
  {
    id: 'ryu_classic',
    name: 'RYU CLASSIC',
    description: 'Balanced. Clean. Honorable.',
    color: 'text-blue-400',
    borderColor: 'border-blue-500',
    bgGradient: 'from-blue-900 to-slate-900',
    fontClass: 'font-title',
    icon: 'Shield'
  },
  {
    id: 'ken_fire',
    name: 'KEN INFERNO',
    description: 'Fast. Fiery. Hype.',
    color: 'text-orange-400',
    borderColor: 'border-orange-500',
    bgGradient: 'from-orange-900 to-red-900',
    fontClass: 'font-arcade',
    icon: 'Flame'
  },
  {
    id: 'akuma_rage',
    name: 'AKUMA RAGE',
    description: 'Dark. Shaking. Intense.',
    color: 'text-red-600',
    borderColor: 'border-red-700',
    bgGradient: 'from-red-950 to-black',
    fontClass: 'font-title uppercase tracking-widest',
    icon: 'Skull'
  },
  {
    id: 'chun_lightning',
    name: 'CHUN SPARK',
    description: 'Electric. Rapid. Neon.',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-400',
    bgGradient: 'from-cyan-900 to-blue-900',
    fontClass: 'font-mono',
    icon: 'Zap'
  }
];

export const VIDEO_FILTERS = [
  { id: 'none', name: 'Normal', class: '' },
  { id: 'grayscale', name: 'B&W', class: 'grayscale' },
  { id: 'sepia', name: 'Retro', class: 'sepia' },
  { id: 'contrast', name: 'Drama', class: 'contrast-125 saturate-150' },
  { id: 'invert', name: 'X-Ray', class: 'invert' },
];

export const FONT_SIZE_CLASSES = {
  small: 'text-lg md:text-xl',
  medium: 'text-2xl md:text-4xl',
  large: 'text-4xl md:text-6xl',
};

export const MOCK_SUBTITLES = [
  { start: 0.5, end: 1.5, text: "Ready...", emotion: "neutral" },
  { start: 1.5, end: 2.5, text: "FIGHT!", emotion: "hype" },
  { start: 2.5, end: 4.0, text: "I'm generating this with AI.", emotion: "joy" },
  { start: 4.0, end: 6.0, text: "This is the ultimate combo!", emotion: "anger" }
];
