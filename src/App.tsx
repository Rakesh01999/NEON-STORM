import { useEffect, useState } from 'react';
import { AmbientCanvas, HowToPlayScreen, MainMenu, SettingsScreen } from '@/components/Screens';
import { GameCanvas } from '@/components/GameCanvas';
import { sound } from '@/game/audio';
import { useSettings } from '@/state/settings';

type Screen = 'menu' | 'howto' | 'settings' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [runId, setRunId] = useState(0);
  const settings = useSettings();

  useEffect(() => {
    sound.applySettings(settings);
  }, [settings]);

  const play = () => {
    sound.ensure();
    sound.startMusic();
    setRunId((n) => n + 1);
    setScreen('game');
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-void-900 font-body text-slate-200">
      {screen !== 'game' && (
        <>
          <AmbientCanvas />
          {/* atmospheric color pools */}
          <div
            className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full opacity-25 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.5), transparent 65%)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-48 -right-40 h-[36rem] w-[36rem] rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.55), transparent 65%)' }}
          />
          <div className="scanlines pointer-events-none absolute inset-0" />
          <div className="vignette pointer-events-none absolute inset-0" />
        </>
      )}

      {screen === 'menu' && (
        <MainMenu
          onPlay={play}
          onHowTo={() => {
            sound.ensure();
            sound.ui('click');
            setScreen('howto');
          }}
          onSettings={() => {
            sound.ensure();
            sound.ui('click');
            setScreen('settings');
          }}
        />
      )}
      {screen === 'howto' && <HowToPlayScreen onBack={() => setScreen('menu')} />}
      {screen === 'settings' && <SettingsScreen onBack={() => setScreen('menu')} />}
      {screen === 'game' && <GameCanvas runId={runId} onQuit={() => setScreen('menu')} />}
    </div>
  );
}
