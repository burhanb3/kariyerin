import Phaser from 'phaser';

import './style.css';
import './gameover-reference.css';
import './leaderboard-reference.css';
import './mobile-final.css';
import { AdminApp } from './admin/AdminApp.ts';
import { AudioManager } from './game/audio/AudioManager.ts';
import { PLAY_SCENE_KEY, PlayScene } from './game/scenes/PlayScene.ts';
import { createLeaderboard } from './game/services/leaderboard.ts';
import { GameUi } from './game/ui/GameUi.ts';
import { GameEvents, type SoundEffectName } from './game/types.ts';
import { getViewportMetrics, type ViewportMetrics } from './game/viewport.ts';

const gameRoot = document.querySelector<HTMLElement>('#game-root');
const uiRoot = document.querySelector<HTMLElement>('#ui-root');

if (!gameRoot || !uiRoot) {
  throw new Error('Octodive could not find its root elements.');
}

if (window.location.pathname.replace(/\/$/, '') === '/admin') {
  document.documentElement.dataset.mode = 'admin';
  document.body.dataset.mode = 'admin';
  gameRoot.setAttribute('hidden', 'true');
  new AdminApp({ root: uiRoot });
} else {
const initialViewport = getViewportMetrics();

function applyViewportCssVars(viewport: ViewportMetrics): void {
  document.documentElement.style.setProperty('--octodive-vvw', `${viewport.viewportWidth}px`);
  document.documentElement.style.setProperty('--octodive-vvh', `${viewport.viewportHeight}px`);
}

applyViewportCssVars(initialViewport);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameRoot,
  width: initialViewport.gameWidth,
  height: initialViewport.gameHeight,
  backgroundColor: '#052b46',
  pixelArt: false,
  antialias: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: initialViewport.gameWidth,
    height: initialViewport.gameHeight
  },
  scene: [PlayScene]
});

const leaderboard = createLeaderboard(import.meta.env);
const audio = new AudioManager(game.events);

game.events.on(GameEvents.sfx, ({ name }: { name: SoundEffectName }) => {
  switch (name) {
    case 'click':
      audio.playClick();
      break;
    case 'swim':
      audio.playSwim();
      break;
    case 'pearl':
      audio.playPearl();
      break;
    case 'shield':
      audio.playShield();
      break;
    case 'hit':
      audio.playHit();
      break;
  }
});

function getPlayScene(): PlayScene {
  return game.scene.getScene(PLAY_SCENE_KEY) as PlayScene;
}

new GameUi({
  root: uiRoot,
  eventBus: game.events,
  leaderboard,
  audio,
  clubName: import.meta.env.VITE_CLUB_NAME?.trim() || 'IEEE MSKÜ Student Branch',
  eventLabel: import.meta.env.VITE_EVENT_LABEL?.trim() || 'KARİYER-IN Etkinliği',
  startGame: () => getPlayScene().startRun(),
  togglePause: () => getPlayScene().togglePause(),
  setPaused: (paused) => getPlayScene().setPaused(paused)
});

let resizeFrame = 0;
let lastGameWidth = initialViewport.gameWidth;
let lastGameHeight = initialViewport.gameHeight;
let lastProfile = initialViewport.profile;

function syncViewport(): void {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => {
    const viewport = getViewportMetrics();
    const widthChanged = Math.abs(viewport.gameWidth - lastGameWidth) > 2;
    const heightChanged = Math.abs(viewport.gameHeight - lastGameHeight) > 2;
    const profileChanged = viewport.profile !== lastProfile;

    if (!widthChanged && !heightChanged && !profileChanged) {
      return;
    }

    lastGameWidth = viewport.gameWidth;
    lastGameHeight = viewport.gameHeight;
    lastProfile = viewport.profile;
    applyViewportCssVars(viewport);
    game.scale.resize(viewport.gameWidth, viewport.gameHeight);
    game.events.emit(GameEvents.viewportChange, viewport);
  });
}

window.addEventListener('resize', syncViewport);
window.addEventListener('orientationchange', syncViewport);
window.visualViewport?.addEventListener('resize', syncViewport);

window.addEventListener('blur', () => {
  const scene = getPlayScene();

  if (scene.isRunning()) {
    scene.setPaused(true);
  }
});
}
