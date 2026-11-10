import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeft, Bomb, ChevronRight, Crosshair, Gamepad2, Gem, Keyboard, MousePointer2,
  Play, Settings2, Sparkles, Trophy, BookOpen,
} from 'lucide-react';
import { Game } from '@/game/engine';
import { sound } from '@/game/audio';
import { ENEMY_SPECS, type EnemyKind } from '@/game/types';
import { getBest } from '@/state/settings';
import { SettingsPanel } from './SettingsPanel';

/* ============================== ambient demo background ============================== */

export function AmbientCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = new Game(cv, { sound: null, demo: true });
    g.start();
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-ui]')) return;
      const r = cv.getBoundingClientRect();
      sound.ensure();
      g.poke(e.clientX - r.left, e.clientY - r.top);
    };
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      g.destroy();
    };
  }, []);

  return <canvas ref={ref} className="menu-canvas absolute inset-0" />;
}

/* ============================== shared chrome ============================== */

function MenuButton({
  children,
  primary,
  onClick,
  style,
}: {
  children: ReactNode;
  primary?: boolean;
  onClick: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={() => {
        sound.ensure();
        sound.ui('click');
        onClick();
      }}
      onMouseEnter={() => sound.ui('hover')}
      style={style}
      className={`btn-neon pop-enter group flex w-full items-center justify-between gap-3 rounded-sm px-6 py-3.5 text-xs font-bold ${
        primary ? 'btn-primary py-4 text-sm' : ''
      }`}
    >
      <span className="flex items-center gap-3">{children}</span>
      <ChevronRight
        size={14}
        className="opacity-40 transition-transform duration-200 group-hover:translate-x-1 group-hover:opacity-90"
      />
    </button>
  );
}

function ScreenShell({ children }: { children: ReactNode }) {
  return <div className="relative z-10 flex h-full flex-col overflow-hidden">{children}</div>;
}

function BackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-4 px-5 pt-5 sm:px-8 sm:pt-7" data-ui>
      <button
        onClick={() => {
          sound.ui('click');
          onBack();
        }}
        className="btn-neon flex h-10 w-10 flex-none items-center justify-center rounded-md"
        aria-label="Back"
      >
        <ArrowLeft size={16} />
      </button>
      <h2 className="font-display text-lg font-bold tracking-[0.3em] text-sky-100 sm:text-xl">
        {title}
      </h2>
      <div className="h-px flex-1 bg-gradient-to-r from-sky-400/40 to-transparent" />
    </div>
  );
}

/* ============================== enemy glyphs ============================== */

export function EnemyGlyph({ kind, size = 40 }: { kind: EnemyKind; size?: number }) {
  const spec = ENEMY_SPECS[kind];
  const stroke = spec.color;
  const common = {
    stroke,
    strokeWidth: 2.2,
    strokeLinejoin: 'round' as const,
    fill: 'rgba(255,255,255,0.03)',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      style={{ filter: `drop-shadow(0 0 7px ${spec.glow})` }}
    >
      {kind === 'wanderer' && <polygon points="20,5 31,20 20,35 9,20" {...common} />}
      {kind === 'chaser' && <polygon points="33,20 11,31 17,20 11,9" {...common} />}
      {kind === 'weaver' && (
        <g {...common}>
          <rect x="9" y="9" width="22" height="22" />
          <rect x="16" y="16" width="8" height="8" />
        </g>
      )}
      {kind === 'splitter' && (
        <g {...common}>
          <polygon points="20,5 33,12.5 33,27.5 20,35 7,27.5 7,12.5" />
          <line x1="20" y1="20" x2="20" y2="5" />
          <line x1="20" y1="20" x2="7" y2="27.5" />
          <line x1="20" y1="20" x2="33" y2="27.5" />
        </g>
      )}
      {kind === 'mini' && <polygon points="20,7 33,33 7,33" {...common} />}
      {kind === 'orb' && (
        <g {...common}>
          <circle cx="20" cy="20" r="12" />
          <circle cx="20" cy="20" r="4" />
        </g>
      )}
    </svg>
  );
}

/* ============================== main menu ============================== */

interface MainMenuProps {
  onPlay: () => void;
  onHowTo: () => void;
  onSettings: () => void;
}

export function MainMenu({ onPlay, onHowTo, onSettings }: MainMenuProps) {
  const [best] = useState(() => getBest());

  return (
    <ScreenShell>
      <div className="flex flex-1 items-center justify-center p-4" data-ui>
        <div className="flex w-full max-w-md flex-col items-center">
          <div className="pop-enter font-display mb-3 flex items-center gap-2 text-[9px] tracking-[0.55em] text-sky-400/80 sm:text-[10px]">
            <Sparkles size={12} className="text-sky-300" />
            TWIN-STICK ARENA PROTOCOL
            <Sparkles size={12} className="text-sky-300" />
          </div>

          <h1
            className="neon-title pop-enter text-center text-[17vw] leading-[0.95] sm:text-7xl md:text-8xl"
            style={{ animationDelay: '60ms' }}
          >
            NEON
            <br />
            STORM
          </h1>

          <p
            className="neon-subtext pop-enter mb-7 mt-4 max-w-xs text-center font-body text-sm font-medium tracking-wide text-sky-200/80 sm:max-w-sm sm:text-base"
            style={{ animationDelay: '120ms' }}
          >
            Survive the geometric swarm. Chain geoms, detonate the grid, and carve your name into
            the void.
          </p>

          {best.score > 0 && (
            <div
              className="pop-enter mb-6 flex items-center gap-3 rounded-sm border border-amber-300/30 bg-amber-950/30 px-4 py-2 backdrop-blur-sm"
              style={{ animationDelay: '170ms' }}
            >
              <Trophy size={14} className="text-amber-300" />
              <div className="font-display text-[10px] tracking-[0.25em] text-amber-200/90">
                BEST&nbsp;&nbsp;
                <span className="text-sm font-bold tabular-nums">{best.score.toLocaleString()}</span>
                <span className="ml-3 text-amber-200/60">WAVE {best.wave}</span>
              </div>
            </div>
          )}

          <div className="flex w-full flex-col gap-2.5">
            <MenuButton primary onClick={onPlay} style={{ animationDelay: '220ms' }}>
              <Play size={16} /> INITIALIZE RUN
            </MenuButton>
            <MenuButton onClick={onHowTo} style={{ animationDelay: '280ms' }}>
              <BookOpen size={15} /> HOW TO PLAY
            </MenuButton>
            <MenuButton onClick={onSettings} style={{ animationDelay: '340ms' }}>
              <Settings2 size={15} /> SETTINGS
            </MenuButton>
          </div>

          <div
            className="pop-enter font-display mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[9px] tracking-[0.28em] text-slate-600"
            style={{ animationDelay: '400ms' }}
          >
            <span className="flex items-center gap-1.5">
              <Keyboard size={11} /> WASD
            </span>
            <span className="flex items-center gap-1.5">
              <MousePointer2 size={11} /> AIM
            </span>
            <span className="flex items-center gap-1.5">
              <Crosshair size={11} /> HOLD FIRE
            </span>
            <span className="flex items-center gap-1.5">
              <Gamepad2 size={11} /> TOUCH READY
            </span>
          </div>

          <div className="font-display mt-6 text-[8px] tracking-[0.4em] text-slate-700">
            v1.0 — CLICK THE VOID TO DISTURB IT
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

/* ============================== how to play ============================== */

const CONTROL_ROWS = [
  { icon: Keyboard, label: 'MOVE', desktop: 'WASD / ARROW KEYS', touch: 'LEFT STICK' },
  { icon: MousePointer2, label: 'AIM', desktop: 'MOUSE', touch: 'RIGHT STICK' },
  { icon: Crosshair, label: 'FIRE', desktop: 'HOLD LEFT CLICK', touch: 'HOLD RIGHT STICK' },
  { icon: Bomb, label: 'BOMB', desktop: 'SPACE / Q / RIGHT CLICK', touch: 'BOMB BUTTON' },
];

const BESTIARY: EnemyKind[] = ['wanderer', 'chaser', 'weaver', 'splitter', 'orb'];

export function HowToPlayScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScreenShell>
      <BackBar title="FIELD MANUAL" onBack={onBack} />
      <div className="neon-scroll flex-1 overflow-y-auto p-4 sm:p-8" data-ui>
        <div className="mx-auto grid max-w-3xl gap-4">
          {/* controls */}
          <section className="panel screen-enter rounded-lg p-5 sm:p-6">
            <h3 className="font-display mb-4 text-xs font-bold tracking-[0.35em] text-sky-300">
              CONTROLS
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONTROL_ROWS.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center gap-3 rounded-sm border border-slate-700/40 bg-void-800/60 px-3 py-2.5"
                >
                  <r.icon size={16} className="flex-none text-sky-300" />
                  <div className="min-w-0">
                    <div className="font-display text-[10px] font-bold tracking-[0.25em] text-slate-200">
                      {r.label}
                    </div>
                    <div className="truncate text-[11px] text-slate-500 sm:text-xs">
                      {r.desktop}
                      <span className="mx-1.5 text-slate-700">|</span>
                      {r.touch}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-snug text-slate-500">
              ESC or P pauses. On touch devices the sticks appear wherever your thumbs land —
              left half moves, right half aims and fires.
            </p>
          </section>

          {/* bestiary */}
          <section
            className="panel screen-enter rounded-lg p-5 sm:p-6"
            style={{ animationDelay: '80ms' }}
          >
            <h3 className="font-display mb-4 text-xs font-bold tracking-[0.35em] text-sky-300">
              KNOW YOUR ENEMY
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {BESTIARY.map((k) => {
                const spec = ENEMY_SPECS[k];
                return (
                  <div
                    key={k}
                    className="flex items-center gap-3 rounded-sm border border-slate-700/40 bg-void-800/60 px-3 py-2.5"
                  >
                    <EnemyGlyph kind={k} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-[10px] font-bold tracking-[0.25em] text-slate-100">
                          {spec.name}
                        </span>
                        <span className="font-display text-[10px] tabular-nums text-slate-500">
                          {spec.score} PTS
                        </span>
                      </div>
                      <div className="text-[11px] leading-snug text-slate-500 sm:text-xs">
                        {spec.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* systems */}
          <section
            className="panel screen-enter rounded-lg p-5 sm:p-6"
            style={{ animationDelay: '160ms' }}
          >
            <h3 className="font-display mb-4 text-xs font-bold tracking-[0.35em] text-sky-300">
              SURVIVAL PROTOCOL
            </h3>
            <ul className="grid gap-2 text-[12px] leading-snug text-slate-400 sm:text-[13px]">
              <li className="flex gap-3">
                <Gem size={15} className="mt-0.5 flex-none text-emerald-300" />
                Enemies drop <span className="text-emerald-300">geoms</span> — collect them to raise
                your score multiplier, up to ×9. Getting hit resets it to ×1.
              </li>
              <li className="flex gap-3">
                <Bomb size={15} className="mt-0.5 flex-none text-orange-300" />
                <span>
                  <span className="text-orange-300">Bombs</span> wipe the arena but sacrifice geom
                  drops. You carry up to 9 — spend them before the swarm corners you.
                </span>
              </li>
              <li className="flex gap-3">
                <Sparkles size={15} className="mt-0.5 flex-none text-violet-300" />
                Milestone scores award <span className="text-violet-300">extra ships and bombs</span>.
                Watch for the rare <span className="text-emerald-300">+</span> life pickup.
              </li>
              <li className="flex gap-3">
                <Trophy size={15} className="mt-0.5 flex-none text-amber-300" />
                Every third wave ends with a ring <span className="text-violet-300">surge</span>.
                Keep moving — standing still is a funeral.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </ScreenShell>
  );
}

/* ============================== settings ============================== */

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScreenShell>
      <BackBar title="SETTINGS" onBack={onBack} />
      <div className="flex flex-1 items-start justify-center overflow-y-auto p-4 sm:p-8" data-ui>
        <div className="panel screen-enter w-full max-w-md rounded-lg p-5 sm:p-7">
          <div className="pointer-events-none absolute -left-px -top-px h-6 w-6 border-l-2 border-t-2 border-sky-300/80" />
          <div className="pointer-events-none absolute -bottom-px -right-px h-6 w-6 border-b-2 border-r-2 border-violet-400/80" />
          <SettingsPanel />
        </div>
      </div>
    </ScreenShell>
  );
}
