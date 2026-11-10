import { Bomb, Pause } from 'lucide-react';
import type { HudState } from '@/game/types';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'warn';
}

const TONE_CLASS: Record<Toast['tone'], string> = {
  info: 'text-sky-200 border-sky-400/40 bg-sky-950/60',
  good: 'text-emerald-200 border-emerald-400/40 bg-emerald-950/60',
  warn: 'text-rose-200 border-rose-400/50 bg-rose-950/60',
};

function ShipIcon({ faded }: { faded?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      className={faded ? 'opacity-15' : 'drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]'}
    >
      <path
        d="M12 2 L19 20 L12 15.5 L5 20 Z"
        fill={faded ? '#334155' : 'rgba(56,189,248,0.35)'}
        stroke={faded ? '#475569' : '#7dd3fc'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface HUDProps {
  hud: HudState;
  toasts: Toast[];
  showTouchBomb: boolean;
  onPause: () => void;
  onBomb: () => void;
}

export function HUD({ hud, toasts, showTouchBomb, onPause, onBomb }: HUDProps) {
  const gemPct = Math.min(1, hud.gems / hud.gemsNeeded);
  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none" data-ui>
      {/* score block */}
      <div className="absolute left-4 top-3 sm:left-6 sm:top-5">
        <div className="font-display text-[9px] tracking-[0.35em] text-sky-400/70">SCORE</div>
        <div
          className="font-display text-2xl font-bold tabular-nums text-sky-100 sm:text-3xl"
          style={{ textShadow: '0 0 18px rgba(56,189,248,0.55)' }}
        >
          {hud.score.toLocaleString()}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`font-display text-sm font-bold ${
              hud.multiplier > 1 ? 'text-emerald-300' : 'text-slate-500'
            }`}
            style={hud.multiplier > 1 ? { textShadow: '0 0 12px rgba(52,211,153,0.7)' } : undefined}
          >
            ×{hud.multiplier}
          </span>
          <div className="h-1 w-20 overflow-hidden rounded-full bg-slate-800/80 sm:w-24">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-150"
              style={{ width: `${gemPct * 100}%`, boxShadow: '0 0 8px rgba(52,211,153,0.8)' }}
            />
          </div>
        </div>
      </div>

      {/* wave + toasts */}
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center sm:top-5">
        <div className="font-display text-[9px] tracking-[0.4em] text-violet-300/70">WAVE</div>
        <div
          className="font-display text-xl font-bold tabular-nums text-violet-100 sm:text-2xl"
          style={{ textShadow: '0 0 16px rgba(167,139,250,0.6)' }}
        >
          {hud.wave || '—'}
        </div>
        <div className="mt-2 flex flex-col items-center gap-1.5">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast-anim whitespace-nowrap rounded border px-3 py-1 font-display text-[10px] font-semibold tracking-[0.28em] backdrop-blur-sm ${TONE_CLASS[t.tone]}`}
            >
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {/* pause */}
      <button
        onClick={onPause}
        aria-label="Pause game"
        className="btn-neon pointer-events-auto absolute right-4 top-3 flex h-10 w-10 items-center justify-center rounded-md sm:right-6 sm:top-5"
      >
        <Pause size={16} />
      </button>

      {/* lives */}
      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
        <div className="font-display mb-1 text-[9px] tracking-[0.35em] text-sky-400/70">SHIPS</div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: Math.max(hud.lives, 3) }).map((_, i) => (
            <ShipIcon key={i} faded={i >= hud.lives} />
          ))}
        </div>
      </div>

      {/* bombs */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
        <div className="font-display mb-1 text-right text-[9px] tracking-[0.35em] text-orange-300/70">
          BOMBS
        </div>
        <div className="flex items-center justify-end gap-1.5">
          {Array.from({ length: Math.max(hud.bombs, 3) }).map((_, i) => (
            <Bomb
              key={i}
              size={16}
              className={
                i < hud.bombs
                  ? 'text-orange-300 drop-shadow-[0_0_6px_rgba(251,146,60,0.9)]'
                  : 'text-slate-600 opacity-25'
              }
            />
          ))}
        </div>
      </div>

      {/* touch bomb trigger */}
      {showTouchBomb && (
        <button
          onClick={onBomb}
          aria-label="Detonate bomb"
          className="pointer-events-auto absolute right-5 top-[42%] flex h-16 w-16 items-center justify-center rounded-full border border-orange-300/60 bg-orange-950/50 text-orange-200 shadow-[0_0_24px_rgba(251,146,60,0.35)] backdrop-blur-sm active:scale-95"
        >
          <Bomb size={22} />
          <span className="font-display absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-400 px-1 text-[10px] font-bold text-slate-950">
            {hud.bombs}
          </span>
        </button>
      )}
    </div>
  );
}
