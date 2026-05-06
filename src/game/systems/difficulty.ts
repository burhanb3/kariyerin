export type Difficulty = {
  elapsedMs: number;
  worldSpeed: number;
  spawnIntervalMs: number;
  gapSize: number;
  patternLevel: 1 | 2 | 3 | 4;
  pearlChance: number;
  inkChance: number;
  currentChance: number;
};

const START_SPEED = 220;
const MAX_SPEED = 375;
const START_SPAWN_MS = 1550;
const MIN_SPAWN_MS = 900;
const START_GAP = 214;
const MIN_GAP = 168;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number): number {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

function patternLevelFor(seconds: number): 1 | 2 | 3 | 4 {
  if (seconds >= 84) {
    return 4;
  }

  if (seconds >= 42) {
    return 3;
  }

  if (seconds >= 18) {
    return 2;
  }

  return 1;
}

export function getDifficulty(elapsedMs: number): Difficulty {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const seconds = safeElapsedMs / 1000;
  const speedRamp = easeOutCubic(seconds / 100);
  const pressureRamp = easeOutCubic(seconds / 86);

  return {
    elapsedMs: safeElapsedMs,
    worldSpeed: Math.round(START_SPEED + (MAX_SPEED - START_SPEED) * speedRamp),
    spawnIntervalMs: Math.round(START_SPAWN_MS - (START_SPAWN_MS - MIN_SPAWN_MS) * pressureRamp),
    gapSize: Math.round(START_GAP - (START_GAP - MIN_GAP) * pressureRamp),
    patternLevel: patternLevelFor(seconds),
    pearlChance: 0.54,
    inkChance: clamp(0.12 - seconds / 1800, 0.055, 0.12),
    currentChance: clamp(seconds / 900, 0.035, 0.11)
  };
}
