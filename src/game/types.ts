export const GAME_HEIGHT = 540;

const DEFAULT_ASPECT = 16 / 9;
const viewportAspect = typeof window === 'undefined' ? DEFAULT_ASPECT : window.innerWidth / window.innerHeight;

export const GAME_WIDTH = Math.round(GAME_HEIGHT * viewportAspect);

export const GameEvents = {
  score: 'octodash:score',
  message: 'octodash:message',
  gameOver: 'octodash:game-over',
  runStart: 'octodash:run-start',
  pauseChange: 'octodash:pause-change',
  muteChange: 'octodash:mute-change',
  sfx: 'octodash:sfx'
} as const;

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
