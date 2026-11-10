import { Home, Pause, Play, RotateCcw, Settings2, Skull, Timer, Trophy, Waves, Zap, Gem, Crosshair } from 'lucide-react';
import type { GameStats } from '@/game/types';
import { getBest } from '@/state/settings';
import { SettingsPanel } from './SettingsPanel';

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ============================== PAUSE ============================== */

interface PauseOverlayProps {
  score: number;
  wave: number;
  showSettings: boolean;
  onToggleSettings: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseOverlay(props: PauseOverlayProps) {
  return (
    <div className="overlay-enter absolute inset-0 z-30 flex items-center justify-center bg-void-950/72 p-4 backdrop-blur-sm">
      <div className="panel pop-enter w-full max-w-sm rounded-lg p-6 sm:p-7">
        <div className="pointer-events-none absolute -left-px -top-px h-6 w-6 border-l-2 border-t-2 border-sky-300/80" />
        <div className="pointer-events-none absolute -bottom-px -right-px h-6 w-6 border-b-2 border-r-2 border-violet-400/80" />

        <div className="mb-1 flex items-center gap-2 text-sky-300">
          <Pause size={15} />
          <span className="font-display text-[10px] tracking-[0.4em] text-sky-400/80">STANDBY</span>
        </div>
        <h2 className="neon-title mb-4 text-3xl">PAUSED</h2>

        <div className="mb-5 flex gap-2">
          <div className="flex-1 rounded-sm border border-sky-400/20 bg-void-800/70 px-3 py-2">
            <div className="font-display text-[9px] tracking-[0.3em] text-sky-400/70">SCORE</div>
            <div className="font-display text-lg font-bold tabular-nums text-sky-100">
              {props.score.toLocaleString()}
            </div>
          </div>
          <div className="flex-1 rounded-sm border border-violet-400/20 bg-void-800/70 px-3 py-2">
            <div className="font-display text-[9px] tracking-[0.3em] text-violet-300/70">WAVE</div>
            <div className="font-display text-lg font-bold tabular-nums text-violet-100">
              {props.wave || '—'}
            </div>
          </div>
        </div>

        {props.showSettings ? (
          <div className="mb-5 border-t border-slate-700/40 pt-4">
            <SettingsPanel embedded />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <button
            onClick={props.onResume}
            className="btn-neon btn-primary flex items-center justify-center gap-2.5 rounded-sm px-4 py-3 text-[11px] font-bold"
          >
            <Play size={14} /> RESUME
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={props.onRestart}
              className="btn-neon flex items-center justify-center gap-2 rounded-sm px-3 py-2.5 text-[10px] font-bold"
            >
              <RotateCcw size={13} /> RESTART
            </button>
            <button
              onClick={props.onToggleSettings}
              className="btn-neon flex items-center justify-center gap-2 rounded-sm px-3 py-2.5 text-[10px] font-bold"
            >
              <Settings2 size={13} /> {props.showSettings ? 'CLOSE' : 'SETTINGS'}
            </button>
          </div>
          <button
            onClick={props.onQuit}
            className="btn-neon btn-danger flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-[10px] font-bold"
          >
            <Home size={13} /> ABANDON RUN
          </button>
        </div>

        <div className="font-display mt-4 text-center text-[9px] tracking-[0.3em] text-slate-600">
          ESC / P — RESUME
        </div>
      </div>
    </div>
  );
}

/* ============================== GAME OVER ============================== */

interface GameOverOverlayProps {
  stats: GameStats;
  isRecord: boolean;
  onRetry: () => void;
  onMenu: () => void;
}

export function GameOverOverlay({ stats, isRecord, onRetry, onMenu }: GameOverOverlayProps) {
  const accuracy = stats.shots > 0 ? Math.round((stats.hits / stats.shots) * 100) : 0;
  const best = Math.max(getBest().score, stats.score);

  const cells = [
    { icon: Waves, label: 'WAVE REACHED', value: String(stats.wave), color: 'text-violet-300' },
    { icon: Skull, label: 'KILLS', value: stats.kills.toLocaleString(), color: 'text-rose-300' },
    { icon: Timer, label: 'SURVIVED', value: fmtTime(stats.timeSec), color: 'text-sky-300' },
    { icon: Zap, label: 'MAX MULTIPLIER', value: `×${stats.maxMult}`, color: 'text-emerald-300' },
    { icon: Gem, label: 'GEOMS', value: stats.gemsCollected.toLocaleString(), color: 'text-emerald-300' },
    { icon: Crosshair, label: 'ACCURACY', value: `${accuracy}%`, color: 'text-amber-300' },
  ];

  return (
    <div className="overlay-enter absolute inset-0 z-30 flex items-center justify-center bg-void-950/78 p-4 backdrop-blur-md">
      <div className="panel pop-enter w-full max-w-md rounded-lg p-6 text-center sm:p-8">
        <div className="pointer-events-none absolute -left-px -top-px h-6 w-6 border-l-2 border-t-2 border-rose-400/80" />
        <div className="pointer-events-none absolute -bottom-px -right-px h-6 w-6 border-b-2 border-r-2 border-rose-400/80" />

        <div className="font-display mb-1 text-[10px] tracking-[0.5em] text-rose-400/80">
          SIGNAL LOST
        </div>
        <h2
          className="font-display mb-3 text-4xl font-black text-rose-100 sm:text-5xl"
          style={{ textShadow: '0 0 30px rgba(251,113,133,0.55)' }}
        >
          GAME OVER
        </h2>

        {isRecord && (
          <div className="record-shimmer font-display mb-3 inline-flex items-center gap-2 text-sm font-bold tracking-[0.3em]">
            <Trophy size={15} className="text-amber-300" /> NEW RECORD
          </div>
        )}

        <div className="font-display mb-1 text-[9px] tracking-[0.4em] text-slate-500">
          FINAL SCORE
        </div>
        <div
          className="font-display mb-5 text-4xl font-black tabular-nums text-sky-100 sm:text-5xl"
          style={{ textShadow: '0 0 26px rgba(56,189,248,0.6)' }}
        >
          {stats.score.toLocaleString()}
        </div>

        <div className="mb-6 grid grid-cols-3 gap-1.5">
          {cells.map((c) => (
            <div
              key={c.label}
              className="rounded-sm border border-slate-700/40 bg-void-800/70 px-2 py-2.5"
            >
              <c.icon size={14} className={`mx-auto mb-1 ${c.color}`} />
              <div className="font-display text-sm font-bold tabular-nums text-slate-100">
                {c.value}
              </div>
              <div className="font-display mt-0.5 text-[8px] tracking-[0.14em] text-slate-500">
                {c.label}
              </div>
            </div>
          ))}
        </div>

        <div className="font-display mb-5 text-[10px] tracking-[0.25em] text-slate-500">
          BEST&nbsp;&nbsp;<span className="text-amber-300/90">{best.toLocaleString()}</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onRetry}
            className="btn-neon btn-primary flex flex-1 items-center justify-center gap-2.5 rounded-sm px-4 py-3 text-[11px] font-bold"
          >
            <RotateCcw size={14} /> RETRY
          </button>
          <button
            onClick={onMenu}
            className="btn-neon flex flex-1 items-center justify-center gap-2 rounded-sm px-4 py-3 text-[11px] font-bold"
          >
            <Home size={14} /> MAIN MENU
          </button>
        </div>

        <div className="font-display mt-4 text-[9px] tracking-[0.3em] text-slate-600">
          ENTER — INSTANT RETRY
        </div>
      </div>
    </div>
  );
}
