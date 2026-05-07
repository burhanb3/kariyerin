export type ViewportProfile = 'portrait-narrow' | 'landscape-phone' | 'desktop';

export type ViewportMetrics = {
  viewportWidth: number;
  viewportHeight: number;
  aspect: number;
  gameWidth: number;
  gameHeight: number;
  worldWidth: number;
  worldHeight: number;
  cameraZoom: number;
  profile: ViewportProfile;
};

export const BASE_GAME_HEIGHT = 540;
export const DEFAULT_GAME_WIDTH = 960;

const MIN_PHONE_GAME_WIDTH = 390;
const MAX_GAME_WIDTH = 1320;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getBrowserViewport(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: DEFAULT_GAME_WIDTH, height: BASE_GAME_HEIGHT };
  }

  const visualViewport = window.visualViewport;
  const width = Math.round(visualViewport?.width ?? window.innerWidth);
  const height = Math.round(visualViewport?.height ?? window.innerHeight);

  return {
    width: Math.max(320, width),
    height: Math.max(320, height)
  };
}

function isCoarsePhone(width: number, height: number): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarsePointer || Math.min(width, height) <= 760;
}

export function getViewportMetrics(): ViewportMetrics {
  const { width, height } = getBrowserViewport();
  const aspect = width / height;
  const phoneLike = isCoarsePhone(width, height);
  const profile: ViewportProfile =
    phoneLike && aspect < 0.85 ? 'portrait-narrow' : phoneLike && aspect >= 1 ? 'landscape-phone' : 'desktop';
  const gameHeight = profile === 'portrait-narrow' ? height : BASE_GAME_HEIGHT;
  const gameWidth =
    profile === 'portrait-narrow'
      ? clamp(width, 320, 520)
      : clamp(Math.round(BASE_GAME_HEIGHT * Math.max(aspect, 16 / 9)), MIN_PHONE_GAME_WIDTH, MAX_GAME_WIDTH);
  const cameraZoom = profile === 'portrait-narrow' ? 0.9 : 1;
  const worldWidth = Math.round(gameWidth / cameraZoom);
  const worldHeight = Math.round(gameHeight / cameraZoom);

  return {
    viewportWidth: width,
    viewportHeight: height,
    aspect,
    gameWidth,
    gameHeight,
    worldWidth,
    worldHeight,
    cameraZoom,
    profile
  };
}
