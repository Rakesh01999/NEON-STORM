export type EnemyKind = 'wanderer' | 'chaser' | 'weaver' | 'splitter' | 'mini' | 'orb';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Settings {
  musicVol: number; // 0..1
  sfxVol: number; // 0..1
  muted: boolean;
  shake: boolean;
  difficulty: Difficulty;
}

export interface HudState {
  score: number;
  wave: number;
  lives: number;
  bombs: number;
  multiplier: number;
  gems: number;
  gemsNeeded: number;
  playing: boolean;
}

export interface GameStats {
  score: number;
  wave: number;
  kills: number;
  timeSec: number;
  maxMult: number;
  gemsCollected: number;
  shots: number;
  hits: number;
}

export interface BestRecord {
  score: number;
  wave: number;
}

export interface EnemySpec {
  score: number;
  color: string;
  glow: string;
  radius: number;
  name: string;
  desc: string;
}

export const ENEMY_SPECS: Record<EnemyKind, EnemySpec> = {
  wanderer: {
    score: 25,
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.9)',
    radius: 15,
    name: 'DRIFTER',
    desc: 'Slow, oblivious, everywhere. Easy points.',
  },
  chaser: {
    score: 50,
    color: '#fb7185',
    glow: 'rgba(251,113,133,0.9)',
    radius: 15,
    name: 'SEEKER',
    desc: 'Locks on and hunts you down relentlessly.',
  },
  weaver: {
    score: 80,
    color: '#a3e635',
    glow: 'rgba(163,230,53,0.9)',
    radius: 14,
    name: 'WEAVER',
    desc: 'Fast serpentine approach. Hard to hit.',
  },
  splitter: {
    score: 120,
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.9)',
    radius: 19,
    name: 'MITOSIS',
    desc: 'Splits into three darting fragments on death.',
  },
  mini: {
    score: 30,
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.9)',
    radius: 10,
    name: 'FRAGMENT',
    desc: 'Small, quick and angry.',
  },
  orb: {
    score: 60,
    color: '#c084fc',
    glow: 'rgba(192,132,252,0.9)',
    radius: 12,
    name: 'DART',
    desc: 'Holds position, then accelerates straight at you.',
  },
};

export const DIFFICULTY_META: Record<Difficulty, { label: string; spawn: number; speed: number; desc: string }> = {
  easy: { label: 'CADET', spawn: 0.72, speed: 0.88, desc: 'Slower swarms. Learn the arena.' },
  normal: { label: 'VETERAN', spawn: 1, speed: 1, desc: 'The intended NEON STORM experience.' },
  hard: { label: 'NIGHTMARE', spawn: 1.42, speed: 1.14, desc: 'Dense, fast, unforgiving. Good luck.' },
};
