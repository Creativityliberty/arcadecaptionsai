
export type ScreenState = 'WELCOME' | 'MODE_SELECT' | 'STYLE_SELECT' | 'ARENA' | 'PROCESSING' | 'RESULT';

export type Emotion = 'anger' | 'joy' | 'sad' | 'neutral' | 'hype';

export type VideoFilter = 'none' | 'grayscale' | 'sepia' | 'contrast' | 'invert';

export type FontSize = 'small' | 'medium' | 'large';

export interface StyleConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  borderColor: string;
  bgGradient: string;
  fontClass: string;
  icon: string;
}

export interface SubtitleSegment {
  start: number; // seconds
  end: number;   // seconds
  text: string;
  emotion: Emotion;
}

export interface ProcessingResult {
  videoBlob: Blob;
  subtitles: SubtitleSegment[];
  selectedStyleId: string;
}

export type AppState = {
  currentScreen: ScreenState;
  selectedMode: 'ARCADE' | 'CREATOR' | null;
  selectedStyleId: string | null;
  recordedBlob: Blob | null;
  subtitles: SubtitleSegment[];
};
