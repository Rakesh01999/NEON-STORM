import { Gauge, Music, Trash2, Volume2, VolumeX, Waves } from 'lucide-react';
import { useState } from 'react';
import { DIFFICULTY_META, type Difficulty } from '@/game/types';
import { resetBest, updateSettings, useSettings } from '@/state/settings';
import { sound } from '@/game/audio';

interface SettingsPanelProps {
  embedded?: boolean;
}

export function SettingsPanel({ embedded = false }: SettingsPanelProps) {
  const settings = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);

  const set = (patch: Parameters<typeof updateSettings>[0]) => {
    updateSettings(patch);
    sound.applySettings({ ...settings, ...patch });
  };

  return (
    <div className={embedded ? '' : 'neon-scroll max-h-[62vh] overflow-y-auto pr-1'}>
      {/* master mute */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {settings.muted ? (
            <VolumeX size={17} className="text-rose-300" />
          ) : (
            <Volume2 size={17} className="text-sky-300" />
          )}
          <div>
            <div className="font-display text-[11px] font-semibold tracking-[0.2em] text-slate-200">
              MASTER AUDIO
            </div>
            <div className="text-[11px] text-slate-500">Silence everything instantly</div>
          </div>
        </div>
        <button
          className="neon-toggle"
          data-on={String(!settings.muted)}
          aria-label="Toggle master audio"
          onClick={() => {
            set({ muted: !settings.muted });
            sound.ui('click');
          }}
        />
      </div>

      {/* music */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music size={16} className="text-violet-300" />
            <span className="font-display text-[11px] font-semibold tracking-[0.2em] text-slate-200">
              MUSIC
            </span>
          </div>
          <span className="font-display text-[11px] tabular-nums text-violet-300">
            {Math.round(settings.musicVol * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.musicVol * 100)}
          onChange={(e) => set({ musicVol: Number(e.target.value) / 100 })}
          className="neon-range"
          aria-label="Music volume"
        />
      </div>

      {/* sfx */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Waves size={16} className="text-cyan-300" />
            <span className="font-display text-[11px] font-semibold tracking-[0.2em] text-slate-200">
              EFFECTS
            </span>
          </div>
          <span className="font-display text-[11px] tabular-nums text-cyan-300">
            {Math.round(settings.sfxVol * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.sfxVol * 100)}
          onChange={(e) => set({ sfxVol: Number(e.target.value) / 100 })}
          onPointerUp={() => sound.ui('click')}
          className="neon-range"
          aria-label="Effects volume"
        />
      </div>

      {/* shake */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gauge size={16} className="text-emerald-300" />
          <div>
            <div className="font-display text-[11px] font-semibold tracking-[0.2em] text-slate-200">
              SCREEN SHAKE
            </div>
            <div className="text-[11px] text-slate-500">Impact shake and recoil feedback</div>
          </div>
        </div>
        <button
          className="neon-toggle"
          data-on={String(settings.shake)}
          aria-label="Toggle screen shake"
          onClick={() => {
            set({ shake: !settings.shake });
            sound.ui('click');
          }}
        />
      </div>

      {/* difficulty */}
      <div className="mb-2">
        <div className="font-display mb-2 text-[11px] font-semibold tracking-[0.2em] text-slate-200">
          DIFFICULTY
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(DIFFICULTY_META) as Difficulty[]).map((d) => {
            const active = settings.difficulty === d;
            return (
              <button
                key={d}
                onClick={() => {
                  set({ difficulty: d });
                  sound.ui('click');
                }}
                className={`btn-neon rounded-sm px-2 py-2 text-[10px] font-bold ${
                  active ? 'btn-primary' : ''
                }`}
              >
                {DIFFICULTY_META[d].label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          {DIFFICULTY_META[settings.difficulty].desc}
        </p>
      </div>

      {/* reset */}
      {!embedded && (
        <div className="mt-6 border-t border-slate-700/40 pt-4">
          <button
            onClick={() => {
              if (confirmReset) {
                resetBest();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
                window.setTimeout(() => setConfirmReset(false), 2600);
              }
              sound.ui('click');
            }}
            className="btn-neon btn-danger flex w-full items-center justify-center gap-2 rounded-sm px-3 py-2 text-[10px] font-bold"
          >
            <Trash2 size={13} />
            {confirmReset ? 'CONFIRM WIPE?' : 'RESET HIGH SCORE'}
          </button>
        </div>
      )}
    </div>
  );
}
