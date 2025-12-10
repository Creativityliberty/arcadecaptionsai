import React, { useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ModeSelectScreen } from './components/ModeSelectScreen';
import { StyleSelectScreen } from './components/StyleSelectScreen';
import { BattleArenaScreen } from './components/BattleArenaScreen';
import { ResultScreen } from './components/ResultScreen';
import { AppState, ProcessingResult } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentScreen: 'WELCOME',
    selectedMode: null,
    selectedStyleId: null,
    recordedBlob: null,
    subtitles: []
  });

  const goTo = (screen: AppState['currentScreen']) => {
    setState(prev => ({ ...prev, currentScreen: screen }));
  };

  const handleModeSelect = (mode: 'ARCADE' | 'CREATOR') => {
    setState(prev => ({ ...prev, selectedMode: mode, currentScreen: 'STYLE_SELECT' }));
  };

  const handleStyleSelect = (styleId: string) => {
    setState(prev => ({ ...prev, selectedStyleId: styleId, currentScreen: 'ARENA' }));
  };

  const handleProcessingComplete = (result: ProcessingResult) => {
    setState(prev => ({
      ...prev,
      recordedBlob: result.videoBlob,
      subtitles: result.subtitles,
      currentScreen: 'RESULT'
    }));
  };

  const handleRetry = () => {
    setState(prev => ({ 
      ...prev, 
      recordedBlob: null, 
      subtitles: [], 
      currentScreen: 'ARENA' 
    }));
  };

  const handleHome = () => {
     setState({
        currentScreen: 'WELCOME',
        selectedMode: null,
        selectedStyleId: null,
        recordedBlob: null,
        subtitles: []
     });
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-white">
      {state.currentScreen === 'WELCOME' && (
        <WelcomeScreen onStart={() => goTo('MODE_SELECT')} />
      )}
      
      {state.currentScreen === 'MODE_SELECT' && (
        <ModeSelectScreen 
          onSelect={handleModeSelect} 
          onBack={() => goTo('WELCOME')} 
        />
      )}
      
      {state.currentScreen === 'STYLE_SELECT' && (
        <StyleSelectScreen 
          onSelect={handleStyleSelect} 
          onBack={() => goTo('MODE_SELECT')} 
        />
      )}
      
      {state.currentScreen === 'ARENA' && state.selectedStyleId && (
        <BattleArenaScreen 
          selectedStyleId={state.selectedStyleId}
          onProcessingComplete={handleProcessingComplete}
          onBack={() => goTo('STYLE_SELECT')}
        />
      )}

      {state.currentScreen === 'RESULT' && (
        <ResultScreen 
          appState={state} 
          onRetry={handleRetry}
          onHome={handleHome}
        />
      )}
    </div>
  );
};

export default App;