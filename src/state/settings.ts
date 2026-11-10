import { useSyncExternalStore } from 'react';
import type { BestRecord, GameStats, Settings } from '@/game/types';

const SETTINGS_KEY = 'neonstorm.settings.v1';
const BEST_KEY = 'neonstorm.best.v1';

export const DEFAULT_SETTINGS: Settings = {
  musicVol: 0.55,
  sfxVol: 0.8,
  muted: false,
  shake: true,
  difficulty: 'normal',
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings: Settings = loadSettings();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

export function getSettings(): Settings {
  return settings;
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, () => settings);
}

/* ---------------- High score ---------------- */

export function getBest(): BestRecord {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return { score: 0, wave: 0 };
    const parsed = JSON.parse(raw) as BestRecord;
    return { score: parsed.score || 0, wave: parsed.wave || 0 };
  } catch {
    return { score: 0, wave: 0 };
  }
}

/** Returns true if this run set a new record. */
export function commitBest(stats: GameStats): boolean {
  const prev = getBest();
  const isRecord = stats.score > prev.score;
  if (isRecord) {
    try {
      localStorage.setItem(
        BEST_KEY,
        JSON.stringify({ score: stats.score, wave: Math.max(stats.wave, prev.wave) })
      );
    } catch {
      /* ignore */
    }
  } else if (stats.wave > prev.wave) {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify({ score: prev.score, wave: stats.wave }));
    } catch {
      /* ignore */
    }
  }
  return isRecord;
}

export function resetBest() {
  try {
    localStorage.removeItem(BEST_KEY);
  } catch {
    /* ignore */
  }
}
