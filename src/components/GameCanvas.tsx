import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from '@/game/engine';
import { sound } from '@/game/audio';
import type { GameStats, HudState } from '@/game/types';
import { commitBest } from '@/state/settings';
import { HUD, type Toast } from './HUD';
import { GameOverOverlay, PauseOverlay } from './Overlays';

const INITIAL_HUD: HudState = {
  score: 0,
  wave: 0,
  lives: 3,
  bombs: 3,
  multiplier: 1,
  gems: 0,
  gemsNeeded: 8,
  playing: true,
};

interface GameCanvasProps {
  runId: number;
  onQuit: () => void;
}

export function GameCanvas({ runId, onQuit }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const pausedRef = useRef(false);
  const overRef = useRef(false);
  const toastId = useRef(0);
  const toastTimers = useRef<number[]>([]);

  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const [pauseSettings, setPauseSettings] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [isRecord, setIsRecord] = useState(false);
  const [touchUI, setTouchUI] = useState(false);
  const [localRun, setLocalRun] = useState(0);

  /* pause toggling (safe outside React via input callback) */
  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g || overRef.current) return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    setPauseSettings(false);
    g.setPaused(next);
    if (next) sound.ui('click');
  }, []);

  const resume = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    pausedRef.current = false;
    setPaused(false);
    setPauseSettings(false);
    g.setPaused(false);
    sound.ui('click');
  }, []);

  const retry = useCallback(() => {
    sound.ui('click');
    setStats(null);
    setIsRecord(false);
    pausedRef.current = false;
    overRef.current = false;
    setPaused(false);
    setPauseSettings(false);
    setToasts([]);
    setLocalRun((n) => n + 1);
  }, []);

  const quit = useCallback(() => {
    sound.ui('click');
    onQuit();
  }, [onQuit]);

  /* engine lifecycle */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    sound.ensure();
    const game = new Game(canvas, {
      sound,
      callbacks: {
        onHud: setHud,
        onToast: (text, tone) => {
          const id = ++toastId.current;
          setToasts((t) => [...t.slice(-2), { id, text, tone }]);
          const timer = window.setTimeout(() => {
            setToasts((t) => t.filter((x) => x.id !== id));
          }, 2400);
          toastTimers.current.push(timer);
        },
        onGameOver: (s) => {
          overRef.current = true;
          setStats(s);
          setIsRecord(commitBest(s));
        },
      },
    });
    game.input.onPause = togglePause;
    gameRef.current = game;
    game.start();
    return () => {
      toastTimers.current.forEach(clearTimeout);
      toastTimers.current = [];
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, localRun]);

  /* touch UI detection */
  useEffect(() => {
    if (window.matchMedia?.('(pointer: coarse)').matches) setTouchUI(true);
    const onTouch = () => setTouchUI(true);
    window.addEventListener('touchstart', onTouch, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  /* auto-pause when tab hidden */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && !pausedRef.current && !overRef.current) {
        togglePause();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [togglePause]);

  /* Enter / R retries from the game-over screen */
  useEffect(() => {
    if (!stats) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'KeyR') retry();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stats, retry]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-void-900" data-ui>
      <canvas ref={canvasRef} className={`game-canvas absolute inset-0 ${touchUI ? 'no-cursor' : ''}`} />
      <div className="scanlines pointer-events-none absolute inset-0 z-10" />
      <div className="vignette pointer-events-none absolute inset-0 z-10" />
      <HUD
        hud={hud}
        toasts={toasts}
        showTouchBomb={touchUI && !stats}
        onPause={togglePause}
        onBomb={() => gameRef.current?.tryBomb()}
      />
      {paused && !stats && (
        <PauseOverlay
          score={hud.score}
          wave={hud.wave}
          showSettings={pauseSettings}
          onToggleSettings={() => setPauseSettings((s) => !s)}
          onResume={resume}
          onRestart={retry}
          onQuit={quit}
        />
      )}
      {stats && (
        <GameOverOverlay stats={stats} isRecord={isRecord} onRetry={retry} onMenu={quit} />
      )}
    </div>
  );
}
