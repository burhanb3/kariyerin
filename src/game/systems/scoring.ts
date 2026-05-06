export type ScoreState = {
  distancePixels: number;
  pearlCount: number;
  pearlScore: number;
  combo: number;
  comboTimerMs: number;
};

export type PearlCollectResult = {
  state: ScoreState;
  bonus: number;
  message: string;
};

export const DISTANCE_POINT_FACTOR = 0.08;
export const PEARL_BASE_POINTS = 75;
export const PEARL_COMBO_STEP = 15;
export const COMBO_WINDOW_MS = 2400;

export function createScoreState(): ScoreState {
  return {
    distancePixels: 0,
    pearlCount: 0,
    pearlScore: 0,
    combo: 0,
    comboTimerMs: 0
  };
}

export function addDistance(state: ScoreState, pixels: number): ScoreState {
  return {
    ...state,
    distancePixels: state.distancePixels + Math.max(0, pixels)
  };
}

export function computeDisplayScore(state: ScoreState): number {
  return Math.floor(state.distancePixels * DISTANCE_POINT_FACTOR) + state.pearlScore;
}

export function collectPearl(state: ScoreState): PearlCollectResult {
  const combo = state.combo + 1;
  const bonus = PEARL_BASE_POINTS + (combo - 1) * PEARL_COMBO_STEP;
  const nextState: ScoreState = {
    ...state,
    pearlCount: state.pearlCount + 1,
    pearlScore: state.pearlScore + bonus,
    combo,
    comboTimerMs: COMBO_WINDOW_MS
  };

  return {
    state: nextState,
    bonus,
    message: combo >= 3 ? `Combo x${combo}!` : '+ İnci'
  };
}

export function tickCombo(state: ScoreState, deltaMs: number): ScoreState {
  if (state.combo === 0) {
    return state;
  }

  const comboTimerMs = Math.max(0, state.comboTimerMs - Math.max(0, deltaMs));

  if (comboTimerMs === 0) {
    return {
      ...state,
      combo: 0,
      comboTimerMs
    };
  }

  return {
    ...state,
    comboTimerMs
  };
}
