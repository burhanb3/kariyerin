import type Phaser from 'phaser';

import { GameEvents } from '../types.ts';

type OscillatorKind = OscillatorType;

const MUSIC_SRC = '/assets/audio/ink-under-waves.mp3';
const MASTER_VOLUME = 0.72;
const MUSIC_VOLUME = 0.075;
const MUSIC_FADE_MS = 500;

export class AudioManager {
  muted: boolean;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  private musicFadeFrame: number | null = null;
  private readonly eventBus: Phaser.Events.EventEmitter;

  constructor(eventBus: Phaser.Events.EventEmitter) {
    this.eventBus = eventBus;
    this.muted = window.localStorage.getItem('octodash.muted') === 'true';
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    await this.startMusic();
  }

  async startMusic(): Promise<void> {
    if (this.muted) {
      return;
    }

    this.ensureMusic();

    if (!this.music) {
      return;
    }

    const shouldFadeIn = this.music.paused;

    if (shouldFadeIn) {
      this.music.volume = 0;
      await this.music.play().catch(() => {
        // Mobile browsers can still reject autoplay outside a direct gesture.
      });
    }

    if (!this.music.paused) {
      this.fadeMusicIn(shouldFadeIn);
    }
  }

  setMuted(value: boolean): void {
    this.muted = value;
    window.localStorage.setItem('octodash.muted', String(value));

    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(value ? 0 : MASTER_VOLUME, this.context.currentTime, 0.04);
    }

    if (this.music) {
      this.music.volume = value ? 0 : Math.min(this.music.volume, MUSIC_VOLUME);
    }

    if (value) {
      this.music?.pause();
    } else {
      void this.unlock();
    }

    this.eventBus.emit(GameEvents.muteChange, { muted: this.muted });
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  playClick(): void {
    this.tone(520, 0.045, 'triangle', 0.7);
  }

  playSwim(): void {
    this.sweep(360, 660, 0.12, 'sine', 0.78);
  }

  playPearl(): void {
    this.tone(880, 0.055, 'sine', 0.82, 0);
    this.tone(1320, 0.08, 'sine', 0.62, 0.045);
  }

  playShield(): void {
    this.sweep(220, 520, 0.22, 'triangle', 0.72);
    this.tone(180, 0.18, 'sine', 0.32, 0.05);
  }

  playHit(): void {
    this.noise(0.18, 0.62);
    this.sweep(160, 70, 0.24, 'sawtooth', 0.5);
  }

  private withContext(callback: (context: AudioContext, master: GainNode) => void): void {
    if (this.muted) {
      return;
    }

    void this.unlock().then(() => {
      if (this.context && this.master) {
        callback(this.context, this.master);
      }
    });
  }

  private ensureMusic(): void {
    if (this.music) {
      this.music.volume = this.muted ? 0 : Math.min(this.music.volume, MUSIC_VOLUME);
      return;
    }

    this.music = new Audio(MUSIC_SRC);
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = 0;
  }

  private fadeMusicIn(fromSilence: boolean): void {
    if (!this.music || this.muted) {
      return;
    }

    if (!fromSilence) {
      this.music.volume = MUSIC_VOLUME;
      return;
    }

    if (this.musicFadeFrame !== null) {
      window.cancelAnimationFrame(this.musicFadeFrame);
      this.musicFadeFrame = null;
    }

    const startedAt = performance.now();
    const step = (now: number): void => {
      if (!this.music || this.muted) {
        this.musicFadeFrame = null;
        return;
      }

      const progress = Math.min((now - startedAt) / MUSIC_FADE_MS, 1);
      this.music.volume = MUSIC_VOLUME * progress;

      if (progress < 1) {
        this.musicFadeFrame = window.requestAnimationFrame(step);
      } else {
        this.music.volume = MUSIC_VOLUME;
        this.musicFadeFrame = null;
      }
    };

    this.musicFadeFrame = window.requestAnimationFrame(step);
  }

  private tone(frequency: number, duration: number, kind: OscillatorKind, gainValue: number, delay = 0): void {
    this.withContext((context, master) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;

      oscillator.type = kind;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(gainValue, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    });
  }

  private sweep(startFrequency: number, endFrequency: number, duration: number, kind: OscillatorKind, gainValue: number): void {
    this.withContext((context, master) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;

      oscillator.type = kind;
      oscillator.frequency.setValueAtTime(startFrequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(gainValue, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    });
  }

  private noise(duration: number, gainValue: number): void {
    this.withContext((context, master) => {
      const bufferSize = Math.floor(context.sampleRate * duration);
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const source = context.createBufferSource();
      const gain = context.createGain();
      const start = context.currentTime;
      source.buffer = buffer;
      gain.gain.setValueAtTime(gainValue, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      source.connect(gain);
      gain.connect(master);
      source.start(start);
    });
  }
}
