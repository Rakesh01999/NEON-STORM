import type { Settings } from './types';

interface BeepOpts {
  type: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  vol: number;
  when?: number;
  lp?: number;
  hp?: number;
  dest?: AudioNode;
}

interface NoiseOpts {
  dur: number;
  vol: number;
  f0: number;
  f1?: number;
  type: BiquadFilterType;
  q?: number;
  when?: number;
  dest?: AudioNode;
}

const AC: typeof AudioContext | undefined =
  typeof window !== 'undefined'
    ? window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;

/**
 * Fully synthesized audio: every sound effect and the generative
 * music loop are produced with the Web Audio API — no audio files.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private settings: Settings | null = null;

  private lastShot = 0;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private readonly bpm = 116;

  /* ---------------- lifecycle ---------------- */

  /** Must be called from a user gesture at least once. */
  ensure() {
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC({ latencyHint: 'interactive' });
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;
      comp.connect(this.ctx.destination);

      this.master = this.ctx.createGain();
      this.master.connect(comp);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);

      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);

      // dotted-eighth echo used by the arp
      this.delayNode = this.ctx.createDelay(1);
      this.delayNode.delayTime.value = (60 / this.bpm / 4) * 3;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.34;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.5;
      this.delayNode.connect(fb);
      fb.connect(this.delayNode);
      this.delayNode.connect(wet);
      wet.connect(this.musicBus);

      // shared white-noise buffer
      const len = Math.floor(this.ctx.sampleRate * 1.5);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  applySettings(s: Settings) {
    this.settings = s;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus || !this.settings) return;
    const t = this.ctx.currentTime;
    const mute = this.settings.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(mute, t, 0.04);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfxVol * 0.9, t, 0.04);
    this.musicBus.gain.setTargetAtTime(this.settings.musicVol * 0.5, t, 0.04);
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /* ---------------- synth primitives ---------------- */

  private beep(o: BeepOpts) {
    if (!this.ctx || !this.sfxBus) return;
    const t = o.when ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(Math.max(1, o.f0), t);
    if (o.f1 !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

    let node: AudioNode = osc;
    if (o.lp) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      node.connect(f);
      node = f;
    }
    if (o.hp) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = o.hp;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.dest ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  private noise(o: NoiseOpts) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuf) return;
    const t = o.when ?? this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    f.Q.value = o.q ?? 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.dest ?? this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + o.dur + 0.05);
  }

  /* ---------------- sound effects ---------------- */

  shoot() {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastShot < 42) return;
    this.lastShot = now;
    this.beep({ type: 'square', f0: 640 + Math.random() * 90, f1: 170, dur: 0.075, vol: 0.07, lp: 2800 });
  }

  explosion(power: number) {
    if (!this.ctx) return;
    const p = Math.min(1, Math.max(0.15, power));
    this.noise({ dur: 0.22 + p * 0.34, vol: 0.1 + p * 0.2, f0: 3400, f1: 160, type: 'lowpass' });
    this.beep({ type: 'sine', f0: 130 + p * 60, f1: 30, dur: 0.28 + p * 0.25, vol: 0.14 + p * 0.2 });
  }

  gemPickup(streak: number) {
    if (!this.ctx) return;
    const f = Math.min(1500, 560 + Math.min(28, streak) * 34);
    this.beep({ type: 'sine', f0: f, f1: f * 1.35, dur: 0.09, vol: 0.09 });
    this.beep({ type: 'triangle', f0: f * 1.5, dur: 0.07, vol: 0.05 });
  }

  multUp(mult: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 440 + mult * 40;
    [0, 4, 7].forEach((semi, i) => {
      this.beep({
        type: 'triangle',
        f0: base * Math.pow(2, semi / 12),
        dur: 0.14,
        vol: 0.11,
        when: t + i * 0.055,
      });
    });
  }

  playerHit() {
    if (!this.ctx) return;
    this.noise({ dur: 0.7, vol: 0.42, f0: 2600, f1: 90, type: 'lowpass' });
    this.beep({ type: 'sine', f0: 200, f1: 26, dur: 0.9, vol: 0.42 });
    this.beep({ type: 'sawtooth', f0: 90, f1: 24, dur: 0.8, vol: 0.16, lp: 500 });
  }

  bomb() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.beep({ type: 'sine', f0: 320, f1: 34, dur: 0.9, vol: 0.5, when: t });
    this.noise({ dur: 1.1, vol: 0.32, f0: 5200, f1: 120, type: 'lowpass', when: t + 0.02 });
    this.noise({ dur: 0.35, vol: 0.2, f0: 900, f1: 300, type: 'bandpass', q: 1.4, when: t });
  }

  waveStart() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.beep({ type: 'triangle', f0: 440, dur: 0.12, vol: 0.1, when: t });
    this.beep({ type: 'triangle', f0: 659.25, dur: 0.16, vol: 0.1, when: t + 0.09 });
  }

  waveClear() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      this.beep({ type: 'triangle', f0: f, dur: 0.16, vol: 0.09, when: t + i * 0.06 });
    });
  }

  extraLife() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.beep({ type: 'sine', f0: 520, f1: 1350, dur: 0.32, vol: 0.14, when: t });
    [1046.5, 1318.5, 1568].forEach((f, i) => {
      this.beep({ type: 'triangle', f0: f, dur: 0.12, vol: 0.07, when: t + 0.22 + i * 0.06 });
    });
  }

  pickup() {
    if (!this.ctx) return;
    this.beep({ type: 'square', f0: 700, f1: 1050, dur: 0.1, vol: 0.08, lp: 2400 });
  }

  respawn() {
    if (!this.ctx) return;
    this.noise({ dur: 0.3, vol: 0.08, f0: 400, f1: 5200, type: 'highpass' });
    this.beep({ type: 'sine', f0: 300, f1: 800, dur: 0.24, vol: 0.08 });
  }

  gameOver() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.beep({ type: 'sawtooth', f0: 220, f1: 52, dur: 1.3, vol: 0.16, lp: 900, when: t });
    this.beep({ type: 'sawtooth', f0: 227, f1: 55, dur: 1.3, vol: 0.12, lp: 800, when: t + 0.05 });
    this.noise({ dur: 1.4, vol: 0.12, f0: 2000, f1: 90, type: 'lowpass', when: t + 0.1 });
  }

  ui(kind: 'click' | 'hover') {
    if (!this.ctx) return;
    if (kind === 'click') {
      this.beep({ type: 'square', f0: 1150, f1: 700, dur: 0.055, vol: 0.06, lp: 3200 });
    } else {
      this.beep({ type: 'sine', f0: 820, dur: 0.035, vol: 0.028 });
    }
  }

  /* ---------------- generative music ---------------- */

  startMusic() {
    if (!AC) return;
    this.ensure();
    if (!this.ctx || this.musicTimer !== null) return;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    const tick = () => {
      if (!this.ctx) return;
      const stepDur = 60 / this.bpm / 4;
      while (this.nextNoteTime < this.ctx.currentTime + 0.16) {
        this.scheduleStep(this.step, this.nextNoteTime, stepDur);
        this.nextNoteTime += stepDur;
        this.step = (this.step + 1) % 64;
      }
    };
    tick();
    this.musicTimer = window.setInterval(tick, 30);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleStep(step: number, t: number, stepDur: number) {
    if (!this.ctx || !this.musicBus) return;
    const bar = Math.floor(step / 16); // 0..3
    const s = step % 16;
    const roots = [110.0, 87.31, 130.81, 98.0]; // A2 F2 C3 G2
    const root = roots[bar];
    const MB = this.musicBus;

    // kick — four on the floor
    if (s % 4 === 0) {
      this.beep({ type: 'sine', f0: 150, f1: 40, dur: 0.12, vol: 0.55, when: t, dest: MB });
    }
    // hats — offbeats + flickers
    if (s % 4 === 2) {
      this.noise({ dur: 0.03, vol: 0.11, f0: 8200, type: 'highpass', when: t, dest: MB });
    } else if ((step * 7 + bar) % 11 === 0) {
      this.noise({ dur: 0.02, vol: 0.05, f0: 9000, type: 'highpass', when: t, dest: MB });
    }
    // snare
    if (s === 4 || s === 12) {
      this.noise({ dur: 0.09, vol: 0.13, f0: 1900, type: 'bandpass', q: 1.1, when: t, dest: MB });
    }
    // bass on 8ths with octave movement
    if (s % 2 === 0) {
      const octPat = [1, 1, 2, 1, 1, 2, 1, 1.5];
      const mult = octPat[(s / 2) | 0];
      this.beep({
        type: 'triangle',
        f0: root * mult,
        dur: stepDur * 1.7,
        vol: 0.2,
        when: t,
        lp: 520,
        dest: MB,
      });
    }
    // arp — minor pentatonic runs through the echo
    const arpMask = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0];
    if (arpMask[s]) {
      const pent = [0, 3, 5, 7, 10, 12, 15];
      const idx = (step * 5 + bar * 3 + ((s * 7) >> 2)) % pent.length;
      const f = root * 4 * Math.pow(2, pent[idx] / 12);
      const g = this.ctx.createGain();
      g.gain.value = 1;
      if (this.delayNode) g.connect(this.delayNode);
      this.beep({ type: 'square', f0: f, dur: 0.1, vol: 0.045, when: t, lp: 2600, dest: g });
      g.connect(MB);
    }
    // pad swell at bar start
    if (s === 0) {
      [1, 1.5, 2].forEach((m, i) => {
        this.beep({
          type: 'sawtooth',
          f0: root * 2 * m * (1 + i * 0.0015),
          dur: stepDur * 14,
          vol: 0.025,
          when: t,
          lp: 780,
          dest: MB,
        });
      });
    }
  }
}

/** Shared singleton — safe because the AudioContext is created lazily. */
export const sound = new SoundEngine();
