import type { SoundEngine } from './audio';
import { InputManager } from './input';
import { DIFFICULTY_META, ENEMY_SPECS, type EnemyKind, type GameStats, type HudState } from './types';
import { getSettings } from '@/state/settings';

/* ============================== data types ============================== */

interface Enemy {
  kind: EnemyKind;
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  angle: number;
  spin: number;
  t: number;
  seed: number;
  spawnT: number; // >0 → materializing (harmless)
  mode: number; // kind-specific state
}

interface Bullet { x: number; y: number; vx: number; vy: number; life: number }

type ParticleKind = 'dot' | 'spark' | 'shard';
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  color: string; size: number; kind: ParticleKind;
  rot: number; vr: number;
}

interface Gem { x: number; y: number; vx: number; vy: number; life: number }
interface Pickup { kind: 'bomb' | 'life'; x: number; y: number; vx: number; vy: number; t: number; life: number }
interface Floater { x: number; y: number; txt: string; life: number; max: number; color: string; size: number }
interface SpawnItem { kind: EnemyKind | 'ring'; at: number; count: number }

interface EngineCallbacks {
  onHud?: (h: HudState) => void;
  onToast?: (text: string, tone: 'info' | 'good' | 'warn') => void;
  onGameOver?: (stats: GameStats) => void;
}

interface EngineOptions {
  sound: SoundEngine | null;
  demo?: boolean;
  callbacks?: EngineCallbacks;
}

type Phase = 'playing' | 'dying' | 'over';

const TAU = Math.PI * 2;
const MAX_PARTICLES = 850;
const MAX_ENEMIES = 96;
const LIFE_MILESTONES = [100_000, 300_000, 700_000, 1_500_000, 3_000_000];
const BOMB_MILESTONES = [150_000, 500_000, 1_000_000, 2_200_000];
const PICKUP_PITY = 110; // guarantee a bomb drop at least every N kills

/* ============================== sprites ============================== */

const spriteCache = new Map<string, HTMLCanvasElement>();

function tint(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return `rgb(${r},${g},${b})`;
}

type PathFn = (c: CanvasRenderingContext2D, s: number) => void;

const ENEMY_PATHS: Record<EnemyKind, PathFn> = {
  wanderer: (c, s) => {
    c.beginPath();
    c.moveTo(0, -s);
    c.lineTo(s * 0.78, 0);
    c.lineTo(0, s);
    c.lineTo(-s * 0.78, 0);
    c.closePath();
  },
  chaser: (c, s) => {
    c.beginPath();
    c.moveTo(s, 0);
    c.lineTo(-s * 0.75, s * 0.72);
    c.lineTo(-s * 0.38, 0);
    c.lineTo(-s * 0.75, -s * 0.72);
    c.closePath();
  },
  weaver: (c, s) => {
    c.beginPath();
    c.moveTo(-s * 0.78, -s * 0.78);
    c.lineTo(s * 0.78, -s * 0.78);
    c.lineTo(s * 0.78, s * 0.78);
    c.lineTo(-s * 0.78, s * 0.78);
    c.closePath();
    c.moveTo(s * 0.34, s * 0.34);
    c.lineTo(-s * 0.34, s * 0.34);
    c.lineTo(-s * 0.34, -s * 0.34);
    c.lineTo(s * 0.34, -s * 0.34);
    c.closePath();
  },
  splitter: (c, s) => {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const px = Math.cos(a) * s;
      const py = Math.sin(a) * s;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU - Math.PI / 2;
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    }
  },
  mini: (c, s) => {
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU - Math.PI / 2;
      const px = Math.cos(a) * s;
      const py = Math.sin(a) * s;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  },
  orb: (c, s) => {
    c.beginPath();
    c.arc(0, 0, s * 0.8, 0, TAU);
    c.moveTo(s * 0.3, 0);
    c.arc(0, 0, s * 0.3, 0, TAU);
  },
};

function neonSprite(key: string, color: string, path: PathFn): HTMLCanvasElement {
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const size = 160;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d')!;
  c.translate(size / 2, size / 2);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  // glow pass
  c.shadowColor = color;
  c.shadowBlur = 20;
  c.strokeStyle = color;
  c.lineWidth = 7;
  c.globalAlpha = 0.85;
  path(c, 44);
  c.stroke();
  // body fill pass
  c.shadowBlur = 0;
  c.globalAlpha = 0.14;
  c.fillStyle = color;
  path(c, 44);
  c.fill();
  // hot core pass
  c.globalAlpha = 1;
  c.strokeStyle = tint(color, 110);
  c.lineWidth = 2.4;
  c.shadowColor = color;
  c.shadowBlur = 8;
  path(c, 44);
  c.stroke();
  spriteCache.set(key, cv);
  return cv;
}

function shipSprite(): HTMLCanvasElement {
  const key = 'ship';
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const size = 160;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d')!;
  c.translate(size / 2, size / 2);
  c.lineJoin = 'round';
  const hull = (ctx: CanvasRenderingContext2D, s: number) => {
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.66, s * 0.62);
    ctx.lineTo(-s * 0.34, 0);
    ctx.lineTo(-s * 0.66, -s * 0.62);
    ctx.closePath();
  };
  c.shadowColor = '#38bdf8';
  c.shadowBlur = 20;
  c.strokeStyle = '#38bdf8';
  c.lineWidth = 7;
  c.globalAlpha = 0.9;
  hull(c, 40);
  c.stroke();
  c.shadowBlur = 0;
  c.globalAlpha = 0.2;
  c.fillStyle = '#7dd3fc';
  hull(c, 40);
  c.fill();
  c.globalAlpha = 1;
  c.strokeStyle = '#f0f9ff';
  c.lineWidth = 2.2;
  c.shadowBlur = 6;
  hull(c, 40);
  c.stroke();
  // cockpit
  c.beginPath();
  c.arc(10, 0, 5.5, 0, TAU);
  c.fillStyle = '#e0f2fe';
  c.shadowColor = '#bae6fd';
  c.shadowBlur = 10;
  c.fill();
  spriteCache.set(key, cv);
  return cv;
}

/* ============================== engine ============================== */

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;
  private sfx: SoundEngine | null;
  readonly input = new InputManager();
  readonly demo: boolean;

  private w = 1280;
  private h = 720;
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private destroyed = false;
  paused = false;

  /* world state */
  private phase: Phase = 'playing';
  private phaseT = 0;
  private timeScale = 1;
  private playT = 0;
  private t = 0;

  private px = 0; private py = 0;
  private pvx = 0; private pvy = 0;
  private aimAngle = -Math.PI / 2;
  private invuln = 0;
  private playerAlive = true;
  private fireCd = 0;
  private thrustAcc = 0;

  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private gems: Gem[] = [];
  private pickups: Pickup[] = [];
  private floaters: Floater[] = [];

  private spawnQueue: SpawnItem[] = [];
  private spawnIdx = 0;
  private waveT = 0;
  private wave = 0;
  private lullT = 1.4; // delay before wave 1
  private inLull = true;

  /* score state */
  private score = 0;
  private mult = 1;
  private gemsInLevel = 0;
  private gemsNeeded = 8;
  private lives = 3;
  private bombs = 3;
  private kills = 0;
  private shots = 0;
  private hits = 0;
  private maxMult = 1;
  private gemsCollected = 0;
  private gemStreak = 0;
  private killsSinceDrop = 0;
  private lifeMsIdx = 0;
  private bombMsIdx = 0;

  /* fx state */
  private trauma = 0;
  private flashW = 0;
  private hurtFlash = 0;
  private bombR = -1; // <0 → inactive
  private gameOverFired = false;

  /* warping grid */
  private gCols = 0;
  private gRows = 0;
  private gGap = 64;
  private gpx!: Float32Array;
  private gpy!: Float32Array;
  private gvx!: Float32Array;
  private gvy!: Float32Array;
  private gen!: Float32Array;
  private gridLive = false;
  private demoImpulseT = 2;

  private lastHudJson = '';
  private ro: ResizeObserver | null = null;
  private bgGrad: CanvasGradient | null = null;
  private hurtGrad: CanvasGradient | null = null;

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.canvas = canvas;
    this.sfx = opts.sound;
    this.demo = !!opts.demo;
    this.cb = opts.callbacks ?? {};
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.input.attach(canvas);

    if (!this.demo) {
      this.px = this.w / 2;
      this.py = this.h / 2;
      this.emitHud(true);
    } else {
      // seed ambient drifters for the menu background
      for (let i = 0; i < 8; i++) this.spawnAmbient(true);
    }
    try {
      void document.fonts?.load('700 16px Orbitron');
    } catch { /* font API optional */ }
  }

  /* ---------------- public API ---------------- */

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 1 / 20) dt = 1 / 20;
      if (dt <= 0) return;
      if (!this.paused) this.update(dt);
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.ro?.disconnect();
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) this.last = performance.now();
  }

  /** Interactive tickle for the menu background. */
  poke(x: number, y: number) {
    if (!this.demo) return;
    this.impulseGrid(x, y, 16, 240);
    this.burst(x, y, '#38bdf8', 14, 240, 2.4);
  }

  tryBomb() {
    if (this.demo || this.phase !== 'playing' || this.paused) return;
    this.input.queueBomb();
  }

  /* ---------------- resize / grid ---------------- */

  private resize() {
    const parent = this.canvas.parentElement;
    const cw = parent ? parent.clientWidth : window.innerWidth;
    const ch = parent ? parent.clientHeight : window.innerHeight;
    this.w = Math.max(320, cw);
    this.h = Math.max(320, ch);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.bgGrad = this.ctx.createRadialGradient(
      this.w / 2, this.h / 2, 10, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.72
    );
    this.bgGrad.addColorStop(0, '#0a0e24');
    this.bgGrad.addColorStop(0.55, '#060816');
    this.bgGrad.addColorStop(1, '#03040c');

    this.hurtGrad = this.ctx.createRadialGradient(
      this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3,
      this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7
    );
    this.hurtGrad.addColorStop(0, 'rgba(244,63,94,0)');
    this.hurtGrad.addColorStop(1, 'rgba(244,63,94,0.4)');

    this.buildGrid();
  }

  private buildGrid() {
    this.gGap = Math.round(Math.min(78, Math.max(52, Math.min(this.w, this.h) / 11)));
    this.gCols = Math.ceil(this.w / this.gGap) + 1;
    this.gRows = Math.ceil(this.h / this.gGap) + 1;
    const n = this.gCols * this.gRows;
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    for (let r = 0; r < this.gRows; r++) {
      for (let c = 0; c < this.gCols; c++) {
        px[r * this.gCols + c] = c * this.gGap;
        py[r * this.gCols + c] = r * this.gGap;
      }
    }
    // px/py hold CURRENT positions; rest positions derived from index
    this.gpx = px;
    this.gpy = py;
    this.gvx = new Float32Array(n);
    this.gvy = new Float32Array(n);
    this.gen = new Float32Array(n);
  }

  private impulseGrid(x: number, y: number, power: number, radius: number) {
    const r2 = radius * radius;
    for (let i = 0; i < this.gpx.length; i++) {
      const dx = this.gpx[i] - x;
      const dy = this.gpy[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 || d2 < 1) continue;
      const d = Math.sqrt(d2);
      const f = power * (1 - d / radius) * 900;
      this.gvx[i] += (dx / d) * f;
      this.gvy[i] += (dy / d) * f;
      this.gen[i] = Math.min(1, this.gen[i] + power * 0.09);
      this.gridLive = true;
    }
  }

  private updateGrid(dt: number) {
    const k = 42;
    const damp = Math.exp(-5.2 * dt);
    let any = false;
    for (let r = 0; r < this.gRows; r++) {
      for (let c = 0; c < this.gCols; c++) {
        const i = r * this.gCols + c;
        const ox = c * this.gGap;
        const oy = r * this.gGap;
        let vx = this.gvx[i];
        let vy = this.gvy[i];
        vx += (ox - this.gpx[i]) * k * dt;
        vy += (oy - this.gpy[i]) * k * dt;
        vx *= damp;
        vy *= damp;
        this.gpx[i] += vx * dt;
        this.gpy[i] += vy * dt;
        this.gvx[i] = vx;
        this.gvy[i] = vy;
        if (this.gen[i] > 0.01) {
          this.gen[i] *= Math.exp(-2.2 * dt);
          any = true;
        }
        if (Math.abs(vx) > 2 || Math.abs(vy) > 2) any = true;
      }
    }
    this.gridLive = any;
  }

  /* ---------------- spawning ---------------- */

  private startWave(n: number) {
    this.wave = n;
    const diff = DIFFICULTY_META[getSettings().difficulty];
    const count = Math.min(64, Math.round((7 + n * 3.1) * diff.spawn));
    const interval = Math.max(0.3, (1.02 - n * 0.05) / (0.65 + diff.spawn * 0.35));

    const weights: Array<[EnemyKind, number]> = [
      ['wanderer', Math.max(9 - n * 1.4, 1.6)],
      ['chaser', 2.5 + n * 0.85],
      ['weaver', n >= 3 ? (n - 2) * 1.05 : 0],
      ['splitter', n >= 4 ? (n - 3) * 0.9 : 0],
      ['orb', n >= 5 ? (n - 4) * 0.55 : 0],
    ];
    const totalW = weights.reduce((a, w) => a + w[1], 0);
    const pick = (): EnemyKind => {
      let x = Math.random() * totalW;
      for (const [k, w] of weights) {
        x -= w;
        if (x <= 0) return k;
      }
      return 'chaser';
    };

    this.spawnQueue = [];
    let at = 0.6;
    for (let i = 0; i < count; i++) {
      const burst = Math.random() < 0.22 ? 1 + Math.floor(Math.random() * 2) : 1;
      for (let b = 0; b < burst && i < count; b++, i++) {
        this.spawnQueue.push({ kind: pick(), at: at + Math.random() * 0.15, count: 1 });
      }
      i--;
      at += interval * (0.55 + Math.random() * 0.9);
    }
    // ring surge event on later waves
    if (n >= 3 && n % 3 === 0) {
      this.spawnQueue.push({ kind: 'ring', at: at * 0.55 + 1.2, count: Math.min(18, 6 + n) });
      this.spawnQueue.sort((a, b) => a.at - b.at);
    }
    this.spawnIdx = 0;
    this.waveT = 0;
    this.inLull = false;
    this.toast(`WAVE ${n}`, 'info');
    this.sfx?.waveStart();
  }

  private edgeSpawnPoint(): { x: number; y: number } {
    const m = 46;
    for (let tries = 0; tries < 12; tries++) {
      const side = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      if (side === 0) { x = m + Math.random() * (this.w - m * 2); y = m; }
      else if (side === 1) { x = m + Math.random() * (this.w - m * 2); y = this.h - m; }
      else if (side === 2) { x = m; y = m + Math.random() * (this.h - m * 2); }
      else { x = this.w - m; y = m + Math.random() * (this.h - m * 2); }
      const dp = Math.hypot(x - this.px, y - this.py);
      if (dp > Math.min(300, Math.min(this.w, this.h) * 0.38)) return { x, y };
    }
    return { x: this.w / 2, y: 60 };
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number, spawnT = 0.6) {
    if (this.enemies.length >= MAX_ENEMIES) return;
    const spec = ENEMY_SPECS[kind];
    const a = Math.random() * TAU;
    const e: Enemy = {
      kind, x, y,
      vx: Math.cos(a) * 30, vy: Math.sin(a) * 30,
      r: spec.radius, angle: a, spin: (Math.random() - 0.5) * 3,
      t: 0, seed: Math.random() * TAU,
      spawnT, mode: 0,
    };
    this.enemies.push(e);
  }

  private ringBurst(count: number) {
    const rad = Math.max(190, Math.min(330, Math.min(this.w, this.h) * 0.42));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const x = Math.min(this.w - 40, Math.max(40, this.px + Math.cos(a) * rad));
      const y = Math.min(this.h - 40, Math.max(40, this.py + Math.sin(a) * rad));
      this.spawnEnemy('orb', x, y, 0.9 + (i % 4) * 0.06);
    }
    this.toast('SURGE INBOUND', 'warn');
    this.sfx?.waveStart();
  }

  private spawnAmbient(anywhere: boolean) {
    const kinds: EnemyKind[] = ['wanderer', 'wanderer', 'weaver', 'splitter', 'chaser'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const m = 60;
    const x = anywhere ? m + Math.random() * (this.w - m * 2) : (Math.random() < 0.5 ? -30 : this.w + 30);
    const y = m + Math.random() * (this.h - m * 2);
    this.spawnEnemy(kind, x, y, anywhere ? 0.01 : 0.6);
  }

  /* ---------------- effects ---------------- */

  private addShake(amount: number) {
    if (!getSettings().shake) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private burst(x: number, y: number, color: string, count: number, speed: number, size: number) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = Math.random() * TAU;
      const v = speed * (0.25 + Math.random());
      const kind: ParticleKind = Math.random() < 0.36 ? 'spark' : Math.random() < 0.24 ? 'shard' : 'dot';
      const max = 0.45 + Math.random() * 0.6;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: max, max, color,
        size: size * (0.6 + Math.random() * 0.8),
        kind, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  private explode(x: number, y: number, color: string, radius: number) {
    const scale = radius / 15;
    this.burst(x, y, color, Math.round(14 + radius * 1.1), 130 + radius * 9, 2 + scale * 1.4);
    this.burst(x, y, '#ffffff', 4, 200, 1.6);
    this.impulseGrid(x, y, 2.4 * scale + 1.2, 150 + radius * 7);
    this.addShake(0.06 + scale * 0.05);
    this.sfx?.explosion(0.25 + scale * 0.42);
  }

  private floater(x: number, y: number, txt: string, color: string, size = 14) {
    if (this.floaters.length > 26) this.floaters.shift();
    this.floaters.push({ x, y, txt, life: 0.9, max: 0.9, color, size });
  }

  private toast(text: string, tone: 'info' | 'good' | 'warn') {
    this.cb.onToast?.(text, tone);
  }

  /* ---------------- scoring ---------------- */

  private addScore(base: number, x: number, y: number, useMult: boolean) {
    const pts = base * (useMult ? this.mult : 1);
    this.score += pts;
    this.floater(x, y - 10, `+${pts.toLocaleString()}`, '#dbeafe', 13 + Math.min(6, this.mult));
    // milestone rewards
    if (this.lifeMsIdx < LIFE_MILESTONES.length && this.score >= LIFE_MILESTONES[this.lifeMsIdx]) {
      this.lifeMsIdx++;
      this.lives = Math.min(6, this.lives + 1);
      this.toast('EXTRA LIFE', 'good');
      this.sfx?.extraLife();
    }
    if (this.bombMsIdx < BOMB_MILESTONES.length && this.score >= BOMB_MILESTONES[this.bombMsIdx]) {
      this.bombMsIdx++;
      this.bombs = Math.min(9, this.bombs + 1);
      this.toast('BOMB +1', 'good');
      this.sfx?.pickup();
    }
  }

  private killEnemy(e: Enemy, index: number, byBomb: boolean) {
    const spec = ENEMY_SPECS[e.kind];
    this.enemies[index] = this.enemies[this.enemies.length - 1];
    this.enemies.pop();
    this.kills++;
    this.explode(e.x, e.y, spec.color, e.r);
    this.addScore(spec.score, e.x, e.y, !byBomb);

    if (e.kind === 'splitter' && !byBomb) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + Math.random();
        const m: Enemy = {
          kind: 'mini',
          x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 10,
          vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
          r: ENEMY_SPECS.mini.radius, angle: a, spin: 0, t: 0,
          seed: Math.random() * TAU, spawnT: 0.18, mode: 0,
        };
        this.enemies.push(m);
      }
    }

    if (!byBomb && !this.demo) {
      const gemCount = e.kind === 'splitter' ? 3 : e.kind === 'weaver' ? 2 : 1;
      for (let i = 0; i < gemCount; i++) {
        const a = Math.random() * TAU;
        this.gems.push({
          x: e.x, y: e.y,
          vx: Math.cos(a) * 90, vy: Math.sin(a) * 90,
          life: 8 + Math.random() * 2,
        });
      }
      // pickup drops (with pity timer for bombs)
      this.killsSinceDrop++;
      const roll = Math.random();
      if (roll < 0.005 && this.lives < 6) {
        this.spawnPickup('life', e.x, e.y);
      } else if ((roll < 0.028 && this.bombs < 9) || (this.killsSinceDrop > PICKUP_PITY && this.bombs < 9)) {
        this.spawnPickup('bomb', e.x, e.y);
      }
    }
  }

  private spawnPickup(kind: 'bomb' | 'life', x: number, y: number) {
    this.killsSinceDrop = 0;
    this.pickups.push({
      kind, x, y,
      vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
      t: 0, life: 12,
    });
  }

  /* ---------------- player damage ---------------- */

  private hurtPlayer() {
    if (this.invuln > 0 || !this.playerAlive) return;
    this.playerAlive = false;
    this.lives--;
    this.phase = 'dying';
    this.phaseT = 0;
    this.mult = 1;
    this.gemsInLevel = 0;
    this.gemsNeeded = 8;
    this.gemStreak = 0;
    this.hurtFlash = 1;
    this.addShake(1);
    this.impulseGrid(this.px, this.py, 26, 420);
    this.burst(this.px, this.py, '#38bdf8', 60, 380, 3);
    this.burst(this.px, this.py, '#f0f9ff', 22, 300, 2.2);
    this.sfx?.playerHit();
  }

  private respawn() {
    this.playerAlive = true;
    this.px = this.w / 2;
    this.py = this.h / 2;
    this.pvx = 0;
    this.pvy = 0;
    this.invuln = 2.6;
    this.sfx?.respawn();
    // repulse nearby threats
    for (const e of this.enemies) {
      const dx = e.x - this.px;
      const dy = e.y - this.py;
      const d = Math.hypot(dx, dy);
      if (d < 260 && d > 1) {
        e.vx += (dx / d) * 560;
        e.vy += (dy / d) * 560;
      }
    }
    this.impulseGrid(this.px, this.py, 18, 300);
  }

  /* ---------------- update ---------------- */

  private update(dt: number) {
    this.t += dt;
    // slow-mo management
    const targetScale = this.phase === 'dying' ? 0.16 : 1;
    this.timeScale += (targetScale - this.timeScale) * Math.min(1, dt * 7);
    const wdt = dt * this.timeScale;

    // fx decay (real time)
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    this.flashW = Math.max(0, this.flashW - dt * 1.9);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.1);

    this.updateGrid(wdt);
    this.updateParticles(wdt);
    this.updateFloaters(dt);

    if (this.demo) {
      this.updateDemo(wdt, dt);
      return;
    }

    if (this.phase === 'playing') this.playT += dt;

    // phase transitions
    if (this.phase === 'dying') {
      this.phaseT += dt;
      if (this.phaseT > 1.05) {
        if (this.lives > 0) {
          this.respawn();
          this.phase = 'playing';
        } else {
          this.phase = 'over';
          this.phaseT = 0;
          this.sfx?.gameOver();
        }
      }
    } else if (this.phase === 'over') {
      this.phaseT += dt;
      if (this.phaseT > 1.15 && !this.gameOverFired) {
        this.gameOverFired = true;
        this.cb.onGameOver?.({
          score: this.score,
          wave: this.wave,
          kills: this.kills,
          timeSec: this.playT,
          maxMult: this.maxMult,
          gemsCollected: this.gemsCollected,
          shots: this.shots,
          hits: this.hits,
        });
      }
    }

    this.updateBullets(wdt);
    this.updateEnemies(wdt);
    this.updateGemsAndPickups(wdt);

    if (this.phase === 'playing') {
      this.director(dt);
      this.updatePlayer(dt);
      this.handleCollisions();
      if (this.input.consumeBomb()) this.fireBomb();
    }

    // expanding bomb shockwave
    if (this.bombR >= 0) {
      this.bombR += dt * 1650;
      const diag = Math.hypot(this.w, this.h);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (Math.hypot(e.x - this.px, e.y - this.py) < this.bombR) {
          this.killEnemy(e, i, true);
        }
      }
      if (this.bombR > diag * 0.75 + 120) this.bombR = -1;
    }

    this.emitHud();
  }

  private updateDemo(wdt: number, dt: number) {
    // keep a gentle population of ambient enemies
    if (this.enemies.length < 9 && Math.random() < dt * 0.7) this.spawnAmbient(false);
    this.updateEnemies(wdt);
    // pointer-like phantom target keeps chasers graceful
    this.demoImpulseT -= dt;
    if (this.demoImpulseT <= 0) {
      this.demoImpulseT = 2.4 + Math.random() * 3.4;
      const x = Math.random() * this.w;
      const y = Math.random() * this.h;
      this.impulseGrid(x, y, 5 + Math.random() * 8, 260 + Math.random() * 200);
      if (Math.random() < 0.5) {
        const colors = ['#22d3ee', '#a78bfa', '#fb7185', '#34d399'];
        this.burst(x, y, colors[Math.floor(Math.random() * colors.length)], 18, 160, 2);
      }
    }
  }

  private director(dt: number) {
    if (this.inLull) {
      this.lullT -= dt;
      if (this.lullT <= 0) this.startWave(this.wave + 1);
      return;
    }
    this.waveT += dt;
    while (
      this.spawnIdx < this.spawnQueue.length &&
      this.spawnQueue[this.spawnIdx].at <= this.waveT &&
      this.enemies.length < MAX_ENEMIES
    ) {
      const item = this.spawnQueue[this.spawnIdx++];
      if (item.kind === 'ring') {
        this.ringBurst(item.count);
      } else {
        const p = this.edgeSpawnPoint();
        this.spawnEnemy(item.kind, p.x, p.y);
      }
    }
    // wave clear check
    if (this.spawnIdx >= this.spawnQueue.length && this.enemies.length === 0 && this.bombR < 0) {
      const bonus = 120 * this.wave;
      this.score += bonus;
      this.toast(`WAVE ${this.wave} CLEAR  +${bonus.toLocaleString()}`, 'good');
      this.sfx?.waveClear();
      if (this.wave === 5 || this.wave === 10 || this.wave === 15 || this.wave === 20) {
        this.toast('DANGER RISING', 'warn');
      }
      this.inLull = true;
      this.lullT = 0.9;
    }
  }

  private updatePlayer(dt: number) {
    if (!this.playerAlive) return;
    const mv = this.input.getMove();
    const accel = 2500;
    this.pvx += mv.x * accel * dt;
    this.pvy += mv.y * accel * dt;
    const damp = Math.exp(-4.6 * dt);
    this.pvx *= damp;
    this.pvy *= damp;
    const sp = Math.hypot(this.pvx, this.pvy);
    const maxSp = 385;
    if (sp > maxSp) {
      this.pvx = (this.pvx / sp) * maxSp;
      this.pvy = (this.pvy / sp) * maxSp;
    }
    this.px = Math.min(this.w - 14, Math.max(14, this.px + this.pvx * dt));
    this.py = Math.min(this.h - 14, Math.max(14, this.py + this.pvy * dt));

    // aim
    const stickAim = this.input.getStickAim();
    if (stickAim) {
      this.aimAngle = Math.atan2(stickAim.y, stickAim.x);
    } else if (this.input.mouseActive) {
      this.aimAngle = Math.atan2(this.input.mouseY - this.py, this.input.mouseX - this.px);
    } else if (mv.x !== 0 || mv.y !== 0) {
      this.aimAngle = Math.atan2(mv.y, mv.x);
    }

    // thrust particles
    if (sp > 50) {
      this.thrustAcc += dt * (sp / 385) * 70;
      while (this.thrustAcc > 1) {
        this.thrustAcc -= 1;
        if (this.particles.length < MAX_PARTICLES) {
          const back = Math.atan2(this.pvy, this.pvx) + Math.PI;
          const a = back + (Math.random() - 0.5) * 0.5;
          this.particles.push({
            x: this.px + Math.cos(back) * 12,
            y: this.py + Math.sin(back) * 12,
            vx: Math.cos(a) * (60 + sp * 0.25) + (Math.random() - 0.5) * 30,
            vy: Math.sin(a) * (60 + sp * 0.25) + (Math.random() - 0.5) * 30,
            life: 0.3 + Math.random() * 0.2, max: 0.5,
            color: Math.random() < 0.6 ? '#38bdf8' : '#bae6fd',
            size: 1.6, kind: 'dot', rot: 0, vr: 0,
          });
        }
      }
    }

    // fire
    this.fireCd -= dt;
    if (this.input.firing && this.fireCd <= 0) {
      this.fireCd = 0.089;
      const a = this.aimAngle + (Math.random() - 0.5) * 0.05;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      this.bullets.push({
        x: this.px + cos * 16, y: this.py + sin * 16,
        vx: cos * 940 + this.pvx * 0.3, vy: sin * 940 + this.pvy * 0.3,
        life: 0.8,
      });
      this.shots++;
      this.pvx -= cos * 14;
      this.pvy -= sin * 14;
      this.impulseGrid(this.px - cos * 20, this.py - sin * 20, 0.35, 60);
      this.sfx?.shoot();
    }

    if (this.invuln > 0) this.invuln -= dt;
  }

  private updateBullets(dt: number) {
    const arr = this.bullets;
    let n = arr.length;
    for (let i = 0; i < n; i++) {
      const b = arr[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.w + 20 || b.y < -20 || b.y > this.h + 20) {
        arr[i] = arr[n - 1];
        n--;
        i--;
      }
    }
    arr.length = n;
  }

  private updateEnemies(dt: number) {
    const diff = DIFFICULTY_META[getSettings().difficulty];
    const spdScale = this.demo ? 0.5 : diff.speed * (1 + (this.wave - 1) * 0.028);
    // in demo mode enemies orbit a phantom target
    const tx = this.demo ? this.w / 2 + Math.cos(this.t * 0.35) * this.w * 0.28 : this.px;
    const ty = this.demo ? this.h / 2 + Math.sin(this.t * 0.5) * this.h * 0.26 : this.py;

    for (const e of this.enemies) {
      e.t += dt;
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        continue;
      }
      switch (e.kind) {
        case 'wanderer': {
          e.angle += Math.sin(e.t * 0.9 + e.seed) * 1.1 * dt;
          const sp = (26 + this.wave * 1.5) * spdScale + 14;
          e.vx = Math.cos(e.angle) * sp;
          e.vy = Math.sin(e.angle) * sp;
          break;
        }
        case 'chaser': {
          const dx = tx - e.x;
          const dy = ty - e.y;
          const d = Math.hypot(dx, dy) || 1;
          const wob = Math.sin(e.t * 3 + e.seed) * 0.4;
          const ca = Math.cos(wob);
          const sa = Math.sin(wob);
          const ddx = (dx / d) * ca - (dy / d) * sa;
          const ddy = (dx / d) * sa + (dy / d) * ca;
          const max = (88 + this.wave * 2.5) * spdScale;
          const k = 1 - Math.exp(-3.4 * dt);
          e.vx += (ddx * max - e.vx) * k;
          e.vy += (ddy * max - e.vy) * k;
          e.angle = Math.atan2(e.vy, e.vx);
          break;
        }
        case 'weaver': {
          const dx = tx - e.x;
          const dy = ty - e.y;
          const base = Math.atan2(dy, dx);
          const heading = base + Math.sin(e.t * 4.4 + e.seed) * 0.95;
          const sp = (150 + this.wave * 3) * spdScale;
          e.vx = Math.cos(heading) * sp;
          e.vy = Math.sin(heading) * sp;
          e.angle += dt * 5;
          break;
        }
        case 'splitter': {
          const dx = tx - e.x;
          const dy = ty - e.y;
          const d = Math.hypot(dx, dy) || 1;
          const max = (58 + this.wave * 1.6) * spdScale;
          const k = 1 - Math.exp(-2.6 * dt);
          e.vx += ((dx / d) * max - e.vx) * k;
          e.vy += ((dy / d) * max - e.vy) * k;
          e.angle += dt * e.spin;
          break;
        }
        case 'mini': {
          const dx = tx - e.x;
          const dy = ty - e.y;
          const d = Math.hypot(dx, dy) || 1;
          const max = 205 * spdScale;
          const k = 1 - Math.exp(-5.6 * dt);
          e.vx += ((dx / d) * max - e.vx) * k;
          e.vy += ((dy / d) * max - e.vy) * k;
          e.angle = Math.atan2(e.vy, e.vx);
          break;
        }
        case 'orb': {
          if (e.mode === 0) {
            // brief outward drift then lock on
            e.vx *= Math.exp(-2 * dt);
            e.vy *= Math.exp(-2 * dt);
            if (e.t > 0.85) e.mode = 1;
          } else {
            const dx = tx - e.x;
            const dy = ty - e.y;
            const d = Math.hypot(dx, dy) || 1;
            const acc = 290 * spdScale;
            e.vx += (dx / d) * acc * dt;
            e.vy += (dy / d) * acc * dt;
            const sp = Math.hypot(e.vx, e.vy);
            const cap = 330 * spdScale;
            if (sp > cap) {
              e.vx = (e.vx / sp) * cap;
              e.vy = (e.vy / sp) * cap;
            }
          }
          break;
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // bounds — bounce
      if (e.x < e.r) { e.x = e.r; e.vx = Math.abs(e.vx); if (e.kind === 'wanderer') e.angle = Math.PI - e.angle; }
      else if (e.x > this.w - e.r) { e.x = this.w - e.r; e.vx = -Math.abs(e.vx); if (e.kind === 'wanderer') e.angle = Math.PI - e.angle; }
      if (e.y < e.r) { e.y = e.r; e.vy = Math.abs(e.vy); if (e.kind === 'wanderer') e.angle = -e.angle; }
      else if (e.y > this.h - e.r) { e.y = this.h - e.r; e.vy = -Math.abs(e.vy); if (e.kind === 'wanderer') e.angle = -e.angle; }
    }
  }

  private updateGemsAndPickups(dt: number) {
    // gems
    {
      const arr = this.gems;
      let n = arr.length;
      for (let i = 0; i < n; i++) {
        const g = arr[i];
        g.life -= dt;
        if (g.life <= 0) {
          arr[i] = arr[n - 1]; n--; i--;
          continue;
        }
        const damp = Math.exp(-2.4 * dt);
        g.vx *= damp;
        g.vy *= damp;
        if (this.playerAlive && this.phase === 'playing') {
          const dx = this.px - g.x;
          const dy = this.py - g.y;
          const d = Math.hypot(dx, dy);
          if (d < 150 && d > 1) {
            const pull = 1650 * (1 - d / 160);
            g.vx += (dx / d) * pull * dt;
            g.vy += (dy / d) * pull * dt;
          }
        }
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        if (g.x < 8) { g.x = 8; g.vx = Math.abs(g.vx); }
        if (g.x > this.w - 8) { g.x = this.w - 8; g.vx = -Math.abs(g.vx); }
        if (g.y < 8) { g.y = 8; g.vy = Math.abs(g.vy); }
        if (g.y > this.h - 8) { g.y = this.h - 8; g.vy = -Math.abs(g.vy); }
      }
      arr.length = n;
    }
    // pickups
    {
      const arr = this.pickups;
      let n = arr.length;
      for (let i = 0; i < n; i++) {
        const p = arr[i];
        p.t += dt;
        p.life -= dt;
        if (p.life <= 0) {
          arr[i] = arr[n - 1]; n--; i--;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (this.playerAlive && this.phase === 'playing') {
          const dx = this.px - p.x;
          const dy = this.py - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 110 && d > 1) {
            p.x += (dx / d) * 260 * dt;
            p.y += (dy / d) * 260 * dt;
          }
        }
      }
      arr.length = n;
    }
  }

  private updateParticles(dt: number) {
    const arr = this.particles;
    let n = arr.length;
    for (let i = 0; i < n; i++) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) {
        arr[i] = arr[n - 1]; n--; i--;
        continue;
      }
      const damp = Math.exp(-2.6 * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    arr.length = n;
  }

  private updateFloaters(dt: number) {
    const arr = this.floaters;
    let n = arr.length;
    for (let i = 0; i < n; i++) {
      const f = arr[i];
      f.life -= dt;
      f.y -= 42 * dt;
      if (f.life <= 0) {
        arr[i] = arr[n - 1]; n--; i--;
      }
    }
    arr.length = n;
  }

  private handleCollisions() {
    // bullets → enemies
    const bs = this.bullets;
    let bn = bs.length;
    for (let i = 0; i < bn; i++) {
      const b = bs[i];
      let hit = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.spawnT > 0) continue;
        const rr = e.r + 6;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy < rr * rr) {
          hit = true;
          this.hits++;
          this.burst(b.x, b.y, ENEMY_SPECS[e.kind].color, 4, 160, 1.6);
          this.killEnemy(e, j, false);
          break;
        }
      }
      if (hit) {
        bs[i] = bs[bn - 1]; bn--; i--;
      }
    }
    bs.length = bn;

    if (!this.playerAlive || this.phase !== 'playing') return;

    // enemies → player
    if (this.invuln <= 0) {
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.spawnT > 0) continue;
        const rr = e.r + 10;
        const dx = e.x - this.px;
        const dy = e.y - this.py;
        if (dx * dx + dy * dy < rr * rr) {
          this.killEnemy(e, j, false);
          this.hurtPlayer();
          break;
        }
      }
    }

    // gems → player
    {
      const arr = this.gems;
      let n = arr.length;
      for (let i = 0; i < n; i++) {
        const g = arr[i];
        const dx = g.x - this.px;
        const dy = g.y - this.py;
        if (dx * dx + dy * dy < 30 * 30) {
          arr[i] = arr[n - 1]; n--; i--;
          this.gemStreak++;
          this.gemsCollected++;
          this.gemsInLevel++;
          this.score += 10 * this.mult;
          this.sfx?.gemPickup(this.gemStreak);
          if (this.gemsInLevel >= this.gemsNeeded) {
            this.gemsInLevel = 0;
            this.mult = Math.min(9, this.mult + 1);
            this.maxMult = Math.max(this.maxMult, this.mult);
            this.gemsNeeded = 8 + (this.mult - 1) * 4;
            this.toast(`MULTIPLIER ×${this.mult}`, 'good');
            this.sfx?.multUp(this.mult);
          }
        }
      }
      arr.length = n;
    }

    // pickups → player
    {
      const arr = this.pickups;
      let n = arr.length;
      for (let i = 0; i < n; i++) {
        const p = arr[i];
        const dx = p.x - this.px;
        const dy = p.y - this.py;
        if (dx * dx + dy * dy < 34 * 34) {
          arr[i] = arr[n - 1]; n--; i--;
          if (p.kind === 'bomb') {
            this.bombs = Math.min(9, this.bombs + 1);
            this.toast('BOMB +1', 'good');
            this.sfx?.pickup();
          } else {
            this.lives = Math.min(6, this.lives + 1);
            this.toast('EXTRA LIFE', 'good');
            this.sfx?.extraLife();
          }
          this.burst(p.x, p.y, p.kind === 'bomb' ? '#fb923c' : '#34d399', 14, 200, 2);
        }
      }
      arr.length = n;
    }
  }

  private fireBomb() {
    if (this.bombs <= 0 || this.bombR >= 0 || this.enemies.length === 0) return;
    this.bombs--;
    this.bombR = 1;
    this.flashW = 0.9;
    this.addShake(0.85);
    this.impulseGrid(this.px, this.py, 30, Math.max(this.w, this.h));
    this.sfx?.bomb();
  }

  /* ---------------- hud ---------------- */

  private emitHud(force = false) {
    if (this.demo) return;
    const hud: HudState = {
      score: this.score,
      wave: this.wave,
      lives: this.lives,
      bombs: this.bombs,
      multiplier: this.mult,
      gems: this.gemsInLevel,
      gemsNeeded: this.gemsNeeded,
      playing: this.phase === 'playing',
    };
    const json = `${hud.score}|${hud.wave}|${hud.lives}|${hud.bombs}|${hud.multiplier}|${hud.gems}|${hud.gemsNeeded}|${hud.playing}`;
    if (force || json !== this.lastHudJson) {
      this.lastHudJson = json;
      this.cb.onHud?.(hud);
    }
  }

  /* ---------------- render ---------------- */

  private render() {
    const c = this.ctx;
    const w = this.w;
    const h = this.h;

    c.fillStyle = this.bgGrad!;
    c.fillRect(0, 0, w, h);

    c.save();
    if (this.trauma > 0.001) {
      const s = this.trauma * this.trauma * 17;
      c.translate((Math.random() - 0.5) * s * 2, (Math.random() - 0.5) * s * 2);
    }

    this.renderGrid(c);
    this.renderGems(c);
    this.renderPickups(c);
    this.renderEnemies(c);
    if (!this.demo) this.renderPlayer(c);
    this.renderBullets(c);
    this.renderParticles(c);
    this.renderBombWave(c);
    if (!this.demo) this.renderFloaters(c);
    c.restore();

    // full-screen flashes (not shaken)
    if (this.hurtFlash > 0) {
      c.globalAlpha = Math.min(0.85, this.hurtFlash);
      c.fillStyle = this.hurtGrad!;
      c.fillRect(0, 0, w, h);
      c.globalAlpha = 1;
    }
    if (this.flashW > 0) {
      c.globalAlpha = Math.min(0.55, this.flashW * 0.7);
      c.fillStyle = '#e0f2fe';
      c.fillRect(0, 0, w, h);
      c.globalAlpha = 1;
    }

    if (!this.demo && this.input.usingTouch && !this.paused) this.renderSticks(c);
  }

  private renderGrid(c: CanvasRenderingContext2D) {
    const cols = this.gCols;
    const rows = this.gRows;
    const px = this.gpx;
    const py = this.gpy;
    const en = this.gen;

    c.lineWidth = 1;
    // base pass
    c.strokeStyle = 'rgba(64,96,235,0.17)';
    c.beginPath();
    for (let r = 0; r < rows; r++) {
      const base = r * cols;
      c.moveTo(px[base], py[base]);
      for (let col = 1; col < cols; col++) c.lineTo(px[base + col], py[base + col]);
    }
    for (let col = 0; col < cols; col++) {
      c.moveTo(px[col], py[col]);
      for (let r = 1; r < rows; r++) c.lineTo(px[r * cols + col], py[r * cols + col]);
    }
    c.stroke();

    // energized pass
    if (this.gridLive) {
      c.strokeStyle = 'rgba(96,165,250,0.5)';
      c.lineWidth = 1.4;
      c.beginPath();
      let any = false;
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols - 1; col++) {
          const i = r * cols + col;
          if (en[i] > 0.06 || en[i + 1] > 0.06) {
            c.moveTo(px[i], py[i]);
            c.lineTo(px[i + 1], py[i + 1]);
            any = true;
          }
        }
      }
      for (let col = 0; col < cols; col++) {
        for (let r = 0; r < rows - 1; r++) {
          const i = r * cols + col;
          const j = (r + 1) * cols + col;
          if (en[i] > 0.06 || en[j] > 0.06) {
            c.moveTo(px[i], py[i]);
            c.lineTo(px[j], py[j]);
            any = true;
          }
        }
      }
      if (any) c.stroke();
    }
  }

  private renderEnemies(c: CanvasRenderingContext2D) {
    for (const e of this.enemies) {
      const spec = ENEMY_SPECS[e.kind];
      const sprite = neonSprite(e.kind, spec.color, ENEMY_PATHS[e.kind]);
      // sprite canvas: 160px, shape radius 44 → half draw size for collision radius r
      const drawR = (e.r * 160) / 88;
      c.save();
      c.translate(e.x, e.y);
      if (e.spawnT > 0) {
        // materialization portal
        const p = 1 - Math.min(1, e.spawnT / 0.6);
        c.globalAlpha = p * 0.9;
        c.rotate(e.angle + e.t * e.spin);
        const rr = drawR * (1.5 - p * 0.5);
        c.drawImage(sprite, -rr, -rr, rr * 2, rr * 2);
        c.globalAlpha = (1 - p) * 0.8;
        c.strokeStyle = spec.color;
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(0, 0, e.r + (1 - p) * 26, 0, TAU);
        c.stroke();
      } else {
        const rot =
          e.kind === 'chaser' || e.kind === 'mini'
            ? e.angle
            : e.kind === 'wanderer'
              ? e.angle + e.t * e.spin
              : e.kind === 'weaver'
                ? e.angle
                : e.kind === 'orb'
                  ? 0
                  : e.angle;
        c.rotate(rot);
        if (e.kind === 'orb' && e.mode === 0) {
          const pulse = 1 + Math.sin(e.t * 14) * 0.12;
          c.drawImage(sprite, -drawR * pulse, -drawR * pulse, drawR * 2 * pulse, drawR * 2 * pulse);
        } else {
          c.drawImage(sprite, -drawR, -drawR, drawR * 2, drawR * 2);
        }
      }
      c.restore();
    }
  }

  private renderPlayer(c: CanvasRenderingContext2D) {
    if (!this.playerAlive) return;
    const sprite = shipSprite();
    const drawR = 46; // ship sprite is 160px, hull radius ~40
    c.save();
    c.translate(this.px, this.py);

    // engine flame
    const sp = Math.hypot(this.pvx, this.pvy);
    if (sp > 24) {
      const back = Math.atan2(this.pvy, this.pvx) + Math.PI;
      const len = 12 + (sp / 385) * 22 + Math.random() * 7;
      const fg = c.createLinearGradient(0, 0, Math.cos(back) * len, Math.sin(back) * len);
      fg.addColorStop(0, 'rgba(186,230,253,0.95)');
      fg.addColorStop(0.4, 'rgba(56,189,248,0.7)');
      fg.addColorStop(1, 'rgba(56,189,248,0)');
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = fg;
      c.beginPath();
      c.moveTo(Math.cos(back) * 6, Math.sin(back) * 6);
      c.lineTo(
        Math.cos(back + 2.6) * 7 + Math.cos(back) * 8,
        Math.sin(back + 2.6) * 7 + Math.sin(back) * 8
      );
      c.lineTo(Math.cos(back) * len, Math.sin(back) * len);
      c.lineTo(
        Math.cos(back - 2.6) * 7 + Math.cos(back) * 8,
        Math.sin(back - 2.6) * 7 + Math.sin(back) * 8
      );
      c.closePath();
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }

    c.rotate(this.aimAngle);
    if (this.invuln > 0) c.globalAlpha = 0.55 + 0.45 * Math.sin(this.t * 26);
    c.drawImage(sprite, -drawR / 2, -drawR / 2, drawR, drawR);
    c.globalAlpha = 1;
    c.restore();

    // invulnerability shield ring
    if (this.invuln > 0) {
      c.save();
      c.translate(this.px, this.py);
      c.strokeStyle = `rgba(125,211,252,${0.4 + 0.25 * Math.sin(this.t * 10)})`;
      c.lineWidth = 1.6;
      c.setLineDash([8, 10]);
      c.lineDashOffset = -this.t * 46;
      c.beginPath();
      c.arc(0, 0, 24 + Math.sin(this.t * 6) * 2, 0, TAU);
      c.stroke();
      c.restore();
    }
  }

  private renderBullets(c: CanvasRenderingContext2D) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      const a = Math.atan2(b.vy, b.vx);
      c.save();
      c.translate(b.x, b.y);
      c.rotate(a);
      const g = c.createLinearGradient(-14, 0, 5, 0);
      g.addColorStop(0, 'rgba(250,204,21,0)');
      g.addColorStop(0.55, 'rgba(253,224,71,0.85)');
      g.addColorStop(1, 'rgba(254,249,195,1)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(-3, 0, 11, 2.6, 0, 0, TAU);
      c.fill();
      c.restore();
    }
    c.restore();
  }

  private renderGems(c: CanvasRenderingContext2D) {
    if (this.gems.length === 0) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const g of this.gems) {
      const blink = g.life < 2 ? (Math.sin(g.life * 18) > 0 ? 1 : 0.25) : 1;
      const pulse = 1 + Math.sin(this.t * 7 + g.x) * 0.18;
      const s = 7 * pulse;
      c.save();
      c.translate(g.x, g.y);
      c.rotate(this.t * 2.4);
      c.globalAlpha = blink;
      c.shadowColor = '#34d399';
      c.shadowBlur = 9;
      c.fillStyle = 'rgba(52,211,153,0.85)';
      c.beginPath();
      c.moveTo(0, -s);
      c.lineTo(s * 0.62, 0);
      c.lineTo(0, s);
      c.lineTo(-s * 0.62, 0);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.restore();
  }

  private renderPickups(c: CanvasRenderingContext2D) {
    for (const p of this.pickups) {
      const blink = p.life < 2.5 ? (Math.sin(p.life * 16) > 0 ? 1 : 0.3) : 1;
      const y = p.y + Math.sin(p.t * 3) * 4;
      const color = p.kind === 'bomb' ? '#fb923c' : '#34d399';
      c.save();
      c.translate(p.x, y);
      c.globalAlpha = blink;
      c.shadowColor = color;
      c.shadowBlur = 14;
      c.strokeStyle = color;
      c.lineWidth = 2;
      const s = 13 + Math.sin(p.t * 5) * 1.5;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + p.t * 0.8;
        const vx = Math.cos(a) * s;
        const vy = Math.sin(a) * s;
        if (i === 0) c.moveTo(vx, vy);
        else c.lineTo(vx, vy);
      }
      c.closePath();
      c.stroke();
      c.globalAlpha = 1;
      c.shadowBlur = 8;
      c.fillStyle = '#f8fafc';
      c.font = '700 13px Orbitron, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.kind === 'bomb' ? 'B' : '+', 0, 1);
      c.restore();
    }
  }

  private renderParticles(c: CanvasRenderingContext2D) {
    if (this.particles.length === 0) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const a = p.life / p.max;
      c.globalAlpha = a;
      if (p.kind === 'spark') {
        c.strokeStyle = p.color;
        c.lineWidth = p.size * 0.7;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        c.stroke();
      } else if (p.kind === 'shard') {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.strokeStyle = p.color;
        c.lineWidth = 1.4;
        const s = p.size * 1.7;
        c.beginPath();
        c.moveTo(-s, s * 0.6);
        c.lineTo(s, 0);
        c.lineTo(-s * 0.4, -s * 0.7);
        c.closePath();
        c.stroke();
        c.restore();
      } else {
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size * a + 0.4, 0, TAU);
        c.fill();
      }
    }
    c.restore();
  }

  private renderBombWave(c: CanvasRenderingContext2D) {
    if (this.bombR < 0 || !this.playerAlive) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.translate(this.px, this.py);
    c.strokeStyle = 'rgba(224,242,254,0.85)';
    c.lineWidth = 3.5;
    c.beginPath();
    c.arc(0, 0, this.bombR, 0, TAU);
    c.stroke();
    c.strokeStyle = 'rgba(56,189,248,0.5)';
    c.lineWidth = 9;
    c.beginPath();
    c.arc(0, 0, Math.max(1, this.bombR - 26), 0, TAU);
    c.stroke();
    c.restore();
  }

  private renderFloaters(c: CanvasRenderingContext2D) {
    c.save();
    c.textAlign = 'center';
    for (const f of this.floaters) {
      const a = f.life / f.max;
      c.globalAlpha = Math.min(1, a * 1.6);
      c.font = `700 ${f.size}px Orbitron, sans-serif`;
      c.fillStyle = f.color;
      c.shadowColor = f.color;
      c.shadowBlur = 8;
      c.fillText(f.txt, f.x, f.y);
    }
    c.restore();
  }

  private renderSticks(c: CanvasRenderingContext2D) {
    const draw = (st: { active: boolean; ox: number; oy: number; dx: number; dy: number }, color: string) => {
      if (!st.active) return;
      c.save();
      c.globalAlpha = 0.5;
      c.strokeStyle = color;
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(st.ox, st.oy, 52, 0, TAU);
      c.stroke();
      c.globalAlpha = 0.9;
      c.fillStyle = color;
      c.beginPath();
      c.arc(st.ox + st.dx, st.oy + st.dy, 20, 0, TAU);
      c.fill();
      c.restore();
    };
    draw(this.input.moveStick, 'rgba(125,211,252,1)');
    draw(this.input.aimStick, 'rgba(249,168,212,1)');
  }
}
