import Phaser from 'phaser';

import './style.css';
import './gameover-reference.css';
import './leaderboard-reference.css';
import { AdminApp } from './admin/AdminApp.ts';
import { AudioManager } from './game/audio/AudioManager.ts';
import { PLAY_SCENE_KEY, PlayScene } from './game/scenes/PlayScene.ts';
import { createLeaderboard } from './game/services/leaderboard.ts';
import { GameUi } from './game/ui/GameUi.ts';
import { GAME_HEIGHT, GAME_WIDTH, GameEvents, type SoundEffectName } from './game/types.ts';

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
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameRoot,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
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
    width: GAME_WIDTH,
    height: GAME_HEIGHT
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

window.addEventListener('blur', () => {
  const scene = getPlayScene();

  if (scene.isRunning()) {
    scene.setPaused(true);
  }
});
}
