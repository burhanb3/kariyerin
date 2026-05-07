import { BASE_GAME_HEIGHT, DEFAULT_GAME_WIDTH, type ViewportMetrics } from './viewport.ts';

export const GAME_HEIGHT = BASE_GAME_HEIGHT;
export const GAME_WIDTH = DEFAULT_GAME_WIDTH;

export const GameEvents = {
  score: 'octodash:score',
  message: 'octodash:message',
  gameOver: 'octodash:game-over',
  runStart: 'octodash:run-start',
  pauseChange: 'octodash:pause-change',
  viewportChange: 'octodash:viewport-change',
  muteChange: 'octodash:mute-change',
  sfx: 'octodash:sfx'
} as const;

export type ViewportChangePayload = ViewportMetrics;

export type ScorePayload = {
  score: number;
  pearls: number;
  combo: number;
  shieldMs: number;
  elapsedMs: number;
};

export type GameOverPayload = {
  score: number;
  pearls: number;
  elapsedMs: number;
};

export type MessagePayload = {
  text: string;
  tone?: 'pearl' | 'shield' | 'danger' | 'system';
};

export type SoundEffectName = 'click' | 'swim' | 'pearl' | 'shield' | 'hit';
