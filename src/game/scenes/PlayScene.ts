import Phaser from 'phaser';

import { createGameTextures, TextureKeys } from '../render/createTextures.ts';
import { getDifficulty, type Difficulty } from '../systems/difficulty.ts';
import {
  addDistance,
  collectPearl,
  computeDisplayScore,
  createScoreState,
  tickCombo,
  type ScoreState
} from '../systems/scoring.ts';
import { GAME_HEIGHT, GAME_WIDTH, GameEvents, type GameOverPayload, type ScorePayload } from '../types.ts';

export const PLAY_SCENE_KEY = 'octodash-play';
const PLAYER_SCALE = 0.112;
const PLAYER_X = Math.max(86, Math.min(188, GAME_WIDTH * 0.24));

type ArcadeImage = Phaser.Physics.Arcade.Image;
type ArcadeSprite = Phaser.Physics.Arcade.Sprite;

export class PlayScene extends Phaser.Scene {
  player!: ArcadeSprite;
  shield!: Phaser.GameObjects.Image;
  obstacles!: Phaser.Physics.Arcade.Group;
  pearls!: Phaser.Physics.Arcade.Group;
  powerUps!: Phaser.Physics.Arcade.Group;
  currents!: Phaser.Physics.Arcade.Group;

  private reefBack!: Phaser.GameObjects.TileSprite;
  private waterLines!: Phaser.GameObjects.TileSprite;
  private seafloor!: Phaser.GameObjects.TileSprite;
  private bubbles: Phaser.GameObjects.Image[] = [];
  private fish: Phaser.GameObjects.Image[] = [];
  private reefSprouts: Phaser.GameObjects.Image[] = [];
  private scoreState: ScoreState = createScoreState();
  private elapsedMs = 0;
  private spawnTimerMs = 0;
  private scoreEmitTimerMs = 0;
  private shieldTimerMs = 0;
  private running = false;
  private ended = false;
  private pausedByUser = false;
  private currentDifficulty: Difficulty = getDifficulty(0);
  private mascotFrameIndex = 0;
  private mascotFrameTimerMs = 0;

  constructor() {
    super(PLAY_SCENE_KEY);
  }

  preload(): void {
    this.load.image(TextureKeys.octopus, '/assets/octodash-mascot-clean.png');
    this.load.image(TextureKeys.reefBack, '/assets/distant-reef.png');
    this.load.image(TextureKeys.shield, '/assets/shield-bubble.png');
    this.load.image(TextureKeys.coral, '/assets/coral-branch.png');
    this.load.image(TextureKeys.jellyfish, '/assets/jellyfish.png');
    this.load.image(TextureKeys.jellyfishSign, '/assets/jellyfish-sign.png');
    this.load.image(TextureKeys.mine, '/assets/sea-mine.png');
    this.load.image(TextureKeys.seaweed, '/assets/seaweed.png');
    this.load.image(TextureKeys.reefSprout, '/assets/reef-sprout.png');
    this.load.image(TextureKeys.rock, '/assets/rock-pillar.png');
    this.load.image(TextureKeys.trash, '/assets/trash-bottle.png');
    this.load.image(TextureKeys.pearl, '/assets/pearl.png');
    this.load.image(TextureKeys.ink, '/assets/ink-drop.png');
    this.load.image(TextureKeys.bubble, '/assets/bubble-soft.png');
    this.load.image(TextureKeys.fish, '/assets/ambient-fish.png');
  }

  create(): void {
    createGameTextures(this);
    this.createWorld();
    this.createPhysicsObjects();
    this.createInput();
    this.physics.pause();
    this.emitScore();
  }

  update(_time: number, delta: number): void {
    const deltaMs = Math.min(delta, 34);
    const scenicSpeed = this.running && !this.pausedByUser ? this.currentDifficulty.worldSpeed : 115;
    this.updateBackground(deltaMs, scenicSpeed);

    if (!this.running || this.pausedByUser || this.ended) {
      return;
    }

    this.elapsedMs += deltaMs;
    this.currentDifficulty = getDifficulty(this.elapsedMs);
    this.scoreState = tickCombo(
      addDistance(this.scoreState, (this.currentDifficulty.worldSpeed * deltaMs) / 1000),
      deltaMs
    );

    this.spawnTimerMs -= deltaMs;
    this.scoreEmitTimerMs -= deltaMs;

    if (this.spawnTimerMs <= 0) {
      const patternCooldownMs = this.spawnPattern(this.currentDifficulty);
      this.spawnTimerMs = this.currentDifficulty.spawnIntervalMs + patternCooldownMs + Phaser.Math.Between(-80, 130);
    }

    if (this.scoreEmitTimerMs <= 0) {
      this.emitScore();
      this.scoreEmitTimerMs = 90;
    }

    this.updatePlayer(deltaMs);
    this.updateObjectSpeeds(this.currentDifficulty.worldSpeed);
    this.updateShield(deltaMs);
    this.cleanOffscreen();
  }

  startRun(): void {
    this.running = true;
    this.ended = false;
    this.pausedByUser = false;
    this.elapsedMs = 0;
    this.spawnTimerMs = 520;
    this.scoreEmitTimerMs = 0;
    this.shieldTimerMs = 0;
    this.mascotFrameIndex = 0;
    this.mascotFrameTimerMs = 0;
    this.scoreState = createScoreState();
    this.currentDifficulty = getDifficulty(0);

    this.clearRunObjects();
    this.player.clearTint();
    this.player.setActive(true).setVisible(true);
    this.player.setTexture(TextureKeys.octopus);
    this.player.setPosition(PLAYER_X, 260);
    this.player.setVelocity(0, 0);
    this.player.setAngularVelocity(0);
    this.player.setScale(PLAYER_SCALE);
    this.shield.setVisible(false);
    this.physics.resume();

    this.game.events.emit(GameEvents.runStart);
    this.emitScore();
  }

  setPaused(paused: boolean): void {
    if (!this.running || this.ended) {
      return;
    }

    this.pausedByUser = paused;

    if (paused) {
      this.physics.pause();
    } else {
      this.physics.resume();
    }

    this.game.events.emit(GameEvents.pauseChange, { paused });
  }

  togglePause(): void {
    this.setPaused(!this.pausedByUser);
  }

  isRunning(): boolean {
    return this.running && !this.ended;
  }

  private createWorld(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TextureKeys.background).setDepth(0);
    this.waterLines = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.43, GAME_WIDTH + 240, 620, TextureKeys.waterLines)
      .setDepth(0.65)
      .setAlpha(0.28);
    this.reefBack = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 172, GAME_WIDTH, 170, TextureKeys.reefBack)
      .setDepth(1)
      .setAlpha(0.58);
    this.seafloor = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 64, GAME_WIDTH, 130, TextureKeys.seafloor)
      .setDepth(2);

    for (let i = 0; i < 34; i += 1) {
      this.bubbles.push(this.createBubble(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(20, GAME_HEIGHT)));
    }

    for (let i = 0; i < Math.max(8, Math.floor(GAME_WIDTH / 150)); i += 1) {
      this.reefSprouts.push(
        this.createReefSprout(Phaser.Math.Between(-80, GAME_WIDTH + 80), GAME_HEIGHT - Phaser.Math.Between(8, 24))
      );
    }

    for (let i = 0; i < 7; i += 1) {
      const fish = this.add
        .image(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(86, 360), TextureKeys.fish)
        .setDepth(1.5)
        .setAlpha(Phaser.Math.FloatBetween(0.1, 0.22))
        .setScale(Phaser.Math.FloatBetween(0.42, 0.76));
      fish.setData('speed', Phaser.Math.FloatBetween(8, 24));
      this.fish.push(fish);
    }
  }

  private createPhysicsObjects(): void {
    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.pearls = this.physics.add.group({ allowGravity: false });
    this.powerUps = this.physics.add.group({ allowGravity: false });
    this.currents = this.physics.add.group({ allowGravity: false });

    this.player = this.physics.add.sprite(PLAYER_X, 260, TextureKeys.octopus);
    this.player.setDepth(20);
    this.player.setScale(PLAYER_SCALE);
    this.player.setGravityY(880);
    this.player.setDragY(36);
    this.player.setCollideWorldBounds(false);
    this.player.setMaxVelocity(0, 520);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(620, 500, true);

    this.shield = this.add.image(this.player.x, this.player.y, TextureKeys.shield).setDepth(19).setScale(0.86).setVisible(false);

    this.physics.add.overlap(this.player, this.obstacles, this.handleObstacleOverlap, undefined, this);
    this.physics.add.overlap(this.player, this.pearls, this.handlePearlOverlap, undefined, this);
    this.physics.add.overlap(this.player, this.powerUps, this.handlePowerUpOverlap, undefined, this);
    this.physics.add.overlap(this.player, this.currents, this.handleCurrentOverlap, undefined, this);
  }

  private createInput(): void {
    this.input.on('pointerdown', () => {
      this.swim();
    });

    this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      this.swim();
    });

    this.input.keyboard?.on('keydown-P', () => {
      this.togglePause();
    });
  }

  private swim(): void {
    if (!this.running || this.pausedByUser || this.ended) {
      return;
    }

    this.player.setVelocityY(-350);
    this.player.setAngle(-14);
    this.mascotFrameIndex = 0;
    this.tweens.killTweensOf(this.player);
    this.tweens.add({
      targets: this.player,
      scaleX: PLAYER_SCALE * 1.08,
      scaleY: PLAYER_SCALE * 0.94,
      duration: 70,
      yoyo: true,
      ease: 'Sine.easeOut'
    });
    this.game.events.emit(GameEvents.sfx, { name: 'swim' });
  }

  private updateBackground(deltaMs: number, speed: number): void {
    const seconds = deltaMs / 1000;
    this.waterLines.x = GAME_WIDTH / 2 + Math.sin(this.elapsedMs / 2200) * 7;
    this.waterLines.y = GAME_HEIGHT * 0.43 + Math.sin(this.elapsedMs / 1700) * 3;
    this.reefBack.tilePositionX += speed * 0.08 * seconds;
    this.seafloor.tilePositionX += speed * 0.2 * seconds;

    for (const bubble of this.bubbles) {
      bubble.x -= (speed * 0.025 + bubble.getData('drift')) * seconds;
      bubble.y -= bubble.getData('rise') * seconds;

      if (bubble.y < -24 || bubble.x < -28) {
        this.resetBubble(bubble, GAME_WIDTH + Phaser.Math.Between(0, 160), GAME_HEIGHT + Phaser.Math.Between(0, 120));
      }
    }

    for (const fish of this.fish) {
      fish.x -= (fish.getData('speed') + speed * 0.025) * seconds;

      if (fish.x < -70) {
        fish.x = GAME_WIDTH + Phaser.Math.Between(40, 260);
        fish.y = Phaser.Math.Between(82, 360);
        fish.setAlpha(Phaser.Math.FloatBetween(0.1, 0.22));
        fish.setScale(Phaser.Math.FloatBetween(0.42, 0.76));
      }
    }

    for (const sprout of this.reefSprouts) {
      sprout.x -= speed * sprout.getData('drift') * seconds;
      sprout.y = sprout.getData('baseY') + Math.sin(this.elapsedMs / 760 + sprout.getData('phase')) * 1.8;

      if (sprout.x < -130) {
        this.resetReefSprout(sprout, GAME_WIDTH + Phaser.Math.Between(36, 190));
      }
    }
  }

  private updatePlayer(deltaMs: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.mascotFrameTimerMs += deltaMs;

    if (TextureKeys.octopusFrames.length > 1 && this.mascotFrameTimerMs >= 115) {
      this.mascotFrameTimerMs = 0;
      this.mascotFrameIndex = (this.mascotFrameIndex + 1) % TextureKeys.octopusFrames.length;
      this.player.setTexture(TextureKeys.octopusFrames[this.mascotFrameIndex]);
    }

    this.player.setAngle(Phaser.Math.Clamp(body.velocity.y / 18, -18, 30));

    if (this.player.y < 36) {
      this.player.y = 36;
      this.player.setVelocityY(10);
    }

    if (this.player.y > GAME_HEIGHT + 52) {
      this.endRun();
    }

    if (this.shieldTimerMs > 0) {
      this.shield.x = this.player.x;
      this.shield.y = this.player.y;
      this.shield.rotation += deltaMs * 0.004;
      this.shield.setAlpha(0.66 + Math.sin(this.elapsedMs / 90) * 0.14);
    }
  }

  private updateObjectSpeeds(speed: number): void {
    this.setGroupVelocity(this.obstacles, -speed);
    this.setGroupVelocity(this.pearls, -speed);
    this.setGroupVelocity(this.powerUps, -speed);
    this.setGroupVelocity(this.currents, -speed * 1.05);
  }

  private setGroupVelocity(group: Phaser.Physics.Arcade.Group, xVelocity: number): void {
    group.children.each((child) => {
      const image = child as ArcadeImage;
      if (image.active && image.body) {
        image.setVelocityX(xVelocity);
      }

      return true;
    });
  }

  private updateShield(deltaMs: number): void {
    if (this.shieldTimerMs <= 0) {
      this.shield.setVisible(false);
      return;
    }

    this.shieldTimerMs = Math.max(0, this.shieldTimerMs - deltaMs);
    this.shield.setVisible(this.shieldTimerMs > 0);
  }

  private spawnPattern(difficulty: Difficulty): number {
    const x = GAME_WIDTH + 98;
    const centerY = Phaser.Math.Between(142, GAME_HEIGHT - 132);
    const roll = Phaser.Math.Between(0, 100);
    let patternCooldownMs = 0;

    if (difficulty.patternLevel >= 4 && roll > 72) {
      this.spawnTrashField(x, centerY, difficulty);
      patternCooldownMs = 210;
    } else if (difficulty.patternLevel >= 3 && roll > 52) {
      this.spawnJellyArc(x, centerY, difficulty);
      patternCooldownMs = 120;
    } else if (difficulty.patternLevel >= 2 && roll > 32) {
      this.spawnRockArch(x, centerY, difficulty);
      patternCooldownMs = 220;
    } else if (roll > 16) {
      this.spawnSeaweedGate(x, centerY, difficulty);
      patternCooldownMs = 80;
    } else {
      this.spawnCoralGate(x, centerY, difficulty);
      patternCooldownMs = 80;
    }

    if (Math.random() < difficulty.inkChance) {
      const shieldSpot = this.pickSafeBonusSpot(x + Phaser.Math.Between(260, 420), centerY, 72, 72);

      if (shieldSpot) {
        this.createPowerUp(shieldSpot.x, shieldSpot.y);
      }
    }

    if (Math.random() < difficulty.currentChance) {
      const currentSpot = this.pickSafeBonusSpot(x + Phaser.Math.Between(300, 470), centerY, 96, 168);

      if (currentSpot) {
        this.createCurrent(currentSpot.x, currentSpot.y);
      }
    }

    return patternCooldownMs;
  }

  private spawnCoralGate(x: number, centerY: number, difficulty: Difficulty): void {
    const gap = difficulty.gapSize;
    this.createObstacle(TextureKeys.coral, x, Math.min(centerY - gap / 2 - 114, 114), 1, true);
    this.createObstacle(TextureKeys.coral, x + 18, Math.max(centerY + gap / 2 + 114, GAME_HEIGHT - 114), 1, false);
    this.spawnPearlTrail(x + 70, centerY, 3, difficulty.pearlChance);
  }

  private spawnSeaweedGate(x: number, centerY: number, difficulty: Difficulty): void {
    const gap = difficulty.gapSize + 18;
    this.createObstacle(TextureKeys.seaweed, x, Math.max(centerY + gap / 2 + 111, GAME_HEIGHT - 111), 1, false);
    this.createObstacle(this.pickJellyfishKey(0.3), x + 96, Math.max(74, centerY - gap / 2 - 62), 0.96, false);
    this.spawnPearlTrail(x + 44, centerY + 14, 2, difficulty.pearlChance + 0.08);
  }

  private spawnRockArch(x: number, centerY: number, difficulty: Difficulty): void {
    const gap = difficulty.gapSize - 8;
    this.createObstacle(TextureKeys.rock, x, Math.min(centerY - gap / 2 - 148, 120), 1, true);
    this.createObstacle(TextureKeys.rock, x, Math.max(centerY + gap / 2 + 148, GAME_HEIGHT - 120), 1, false);
    this.spawnPearlTrail(x + 86, centerY - 12, difficulty.patternLevel >= 3 ? 4 : 3, difficulty.pearlChance);
  }

  private spawnJellyArc(x: number, centerY: number, difficulty: Difficulty): void {
    const high = Phaser.Math.Clamp(centerY - 96, 70, GAME_HEIGHT - 90);
    const low = Phaser.Math.Clamp(centerY + 92, 96, GAME_HEIGHT - 72);
    this.createObstacle(this.pickJellyfishKey(0.38), x, high, 1, false);
    this.createObstacle(TextureKeys.mine, x + 142, low, 0.94, false);

    if (difficulty.patternLevel >= 4) {
      const trashY = Phaser.Math.Clamp(centerY + (centerY < GAME_HEIGHT / 2 ? 118 : -118), 88, GAME_HEIGHT - 88);
      this.createObstacle(TextureKeys.trash, x + 246, trashY, 0.96, false);
    }

    this.spawnPearlTrail(x + 74, centerY, 3, difficulty.pearlChance + 0.1);
  }

  private spawnTrashField(x: number, centerY: number, difficulty: Difficulty): void {
    const safeCenterY = Phaser.Math.Clamp(centerY, 150, GAME_HEIGHT - 150);
    this.createObstacle(TextureKeys.trash, x, safeCenterY - 128, 1, false);
    this.createObstacle(TextureKeys.mine, x + 136, safeCenterY + 104, 0.88, false);
    this.createObstacle(TextureKeys.trash, x + 268, safeCenterY - 72, 0.92, false);
    this.spawnPearlTrail(x + 76, safeCenterY - 10, 4, difficulty.pearlChance + 0.12);
  }

  private createObstacle(key: string, x: number, y: number, scale: number, flipY: boolean): ArcadeImage {
    const obstacle = this.obstacles.create(x, y, key) as ArcadeImage;
    obstacle.setDepth(9);
    obstacle.setScale(this.getObstacleScale(key, scale));
    obstacle.setFlipY(flipY);
    obstacle.setVelocityX(-this.currentDifficulty.worldSpeed);
    obstacle.setImmovable(true);

    const body = obstacle.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;

    if (key === TextureKeys.mine) {
      body.setCircle(29, 15, 15);
    } else if (key === TextureKeys.rock) {
      body.setSize(170, 720, true);
    } else if (key === TextureKeys.trash) {
      body.setSize(82, 50, true);
    } else if (key === TextureKeys.jellyfish || key === TextureKeys.jellyfishSign) {
      body.setSize(310, 440, true);
    } else {
      body.setSize(obstacle.width * 0.58, obstacle.height * 0.82, true);
    }

    return obstacle;
  }

  private pickJellyfishKey(signChance: number): string {
    return Math.random() < signChance ? TextureKeys.jellyfishSign : TextureKeys.jellyfish;
  }

  private getObstacleScale(key: string, scale: number): number {
    if (key === TextureKeys.jellyfish || key === TextureKeys.jellyfishSign) {
      return scale * 0.18;
    }

    if (key === TextureKeys.rock) {
      return scale * 0.34;
    }

    if (key === TextureKeys.trash) {
      return scale * 0.58;
    }

    return scale;
  }

  private pickSafeBonusSpot(x: number, centerY: number, width: number, height: number): { x: number; y: number } | null {
    const yOffsets = [0, -52, 52, -88, 88, -124, 124];
    const xOffsets = [0, 72, 136, 208];

    for (const xOffset of xOffsets) {
      for (const yOffset of yOffsets) {
        const candidateX = x + xOffset;
        const candidateY = Phaser.Math.Clamp(centerY + yOffset, 126, GAME_HEIGHT - 126);
        const candidateBounds = new Phaser.Geom.Rectangle(
          candidateX - width / 2,
          candidateY - height / 2,
          width,
          height
        );

        if (this.isSpawnAreaClear(candidateBounds)) {
          return { x: candidateX, y: candidateY };
        }
      }
    }

    return null;
  }

  private isSpawnAreaClear(candidateBounds: Phaser.Geom.Rectangle): boolean {
    let clear = true;

    this.obstacles.children.each((child) => {
      const obstacle = child as ArcadeImage;

      if (!obstacle.active) {
        return true;
      }

      const bounds = obstacle.getBounds();
      const paddedBounds = new Phaser.Geom.Rectangle(
        bounds.x - 42,
        bounds.y - 38,
        bounds.width + 84,
        bounds.height + 76
      );

      if (Phaser.Geom.Intersects.RectangleToRectangle(candidateBounds, paddedBounds)) {
        clear = false;
        return false;
      }

      return true;
    });

    return clear;
  }

  private spawnPearlTrail(x: number, y: number, count: number, chance: number): void {
    if (Math.random() > chance) {
      return;
    }

    for (let i = 0; i < count; i += 1) {
      this.createPearl(x + i * 44, y + Math.sin(i * 0.95) * 26);
    }
  }

  private createPearl(x: number, y: number): ArcadeImage {
    const pearl = this.pearls.create(x, y, TextureKeys.pearl) as ArcadeImage;
    pearl.setDepth(12);
    pearl.setVelocityX(-this.currentDifficulty.worldSpeed);
    pearl.setData('baseY', y);
    pearl.setData('phase', Math.random() * Math.PI * 2);
    const body = pearl.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setCircle(15, 6, 6);
    this.tweens.add({
      targets: pearl,
      y: y - 9,
      duration: 680,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    return pearl;
  }

  private createPowerUp(x: number, y: number): void {
    const powerUp = this.powerUps.create(x, y, TextureKeys.ink) as ArcadeImage;
    powerUp.setDepth(13);
    powerUp.setScale(0.18);
    powerUp.setVelocityX(-this.currentDifficulty.worldSpeed);
    const body = powerUp.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setCircle(82, 28, 46);
    this.tweens.add({
      targets: powerUp,
      angle: 10,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private createCurrent(x: number, y: number): void {
    const current = this.currents.create(x, y, TextureKeys.current) as ArcadeImage;
    current.setDepth(4);
    current.setAlpha(0.86);
    current.setVelocityX(-this.currentDifficulty.worldSpeed * 1.05);
    const body = current.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setSize(74, 146, true);
  }

  private handleObstacleOverlap(_player: unknown, obstacleObject: unknown): void {
    const obstacle = obstacleObject as ArcadeImage;

    if (this.shieldTimerMs > 0) {
      this.createInkBurst(obstacle.x, obstacle.y);
      obstacle.disableBody(true, true);
      this.cameras.main.shake(90, 0.003);
      return;
    }

    this.endRun();
  }

  private handlePearlOverlap(_player: unknown, pearlObject: unknown): void {
    const pearl = pearlObject as ArcadeImage;
    pearl.disableBody(true, true);

    const result = collectPearl(this.scoreState);
    this.scoreState = result.state;
    this.floatText(pearl.x, pearl.y, `+${result.bonus}`);
    this.game.events.emit(GameEvents.sfx, { name: 'pearl' });
    this.emitScore();
  }

  private handlePowerUpOverlap(_player: unknown, powerUpObject: unknown): void {
    const powerUp = powerUpObject as ArcadeImage;
    powerUp.disableBody(true, true);
    this.shieldTimerMs = 6000;
    this.shield.setVisible(true);
    this.game.events.emit(GameEvents.sfx, { name: 'shield' });
    this.emitScore();
  }

  private handleCurrentOverlap(): void {
    if (!this.running || this.pausedByUser) {
      return;
    }

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.player.setVelocityY(Math.max(playerBody.velocity.y - 9, -320));

  }

  private endRun(): void {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.running = false;
    this.physics.pause();
    this.player.setTint(0xffb6d5);
    this.shield.setVisible(false);
    this.cameras.main.shake(180, 0.008);
    this.createInkBurst(this.player.x, this.player.y);
    this.game.events.emit(GameEvents.sfx, { name: 'hit' });

    const payload: GameOverPayload = {
      score: computeDisplayScore(this.scoreState),
      pearls: this.scoreState.pearlCount,
      elapsedMs: this.elapsedMs
    };
    this.game.events.emit(GameEvents.gameOver, payload);
  }

  private clearRunObjects(): void {
    this.obstacles.clear(true, true);
    this.pearls.clear(true, true);
    this.powerUps.clear(true, true);
    this.currents.clear(true, true);
  }

  private cleanOffscreen(): void {
    for (const group of [this.obstacles, this.pearls, this.powerUps, this.currents]) {
      group.children.each((child) => {
        const image = child as ArcadeImage;

        if (image.x < -180) {
          image.destroy();
        }

        return true;
      });
    }
  }

  private emitScore(): void {
    const payload: ScorePayload = {
      score: computeDisplayScore(this.scoreState),
      pearls: this.scoreState.pearlCount,
      combo: this.scoreState.combo,
      shieldMs: this.shieldTimerMs,
      elapsedMs: this.elapsedMs
    };
    this.game.events.emit(GameEvents.score, payload);
  }

  private floatText(x: number, y: number, text: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: 'Inter, ui-sans-serif, system-ui',
        fontSize: '22px',
        fontStyle: '800',
        color: '#f9fbff',
        stroke: '#0a314a',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(28);

    this.tweens.add({
      targets: label,
      y: y - 34,
      alpha: 0,
      duration: 720,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy()
    });
  }

  private createInkBurst(x: number, y: number): void {
    for (let i = 0; i < 10; i += 1) {
      const dot = this.add
        .circle(x, y, Phaser.Math.Between(4, 10), Phaser.Display.Color.GetColor(38, 43, 115), 0.58)
        .setDepth(24);
      this.tweens.add({
        targets: dot,
        x: x + Phaser.Math.Between(-46, 46),
        y: y + Phaser.Math.Between(-38, 38),
        alpha: 0,
        scale: 0.25,
        duration: 360,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy()
      });
    }
  }

  private createBubble(x: number, y: number): Phaser.GameObjects.Image {
    const bubble = this.add
      .image(x, y, TextureKeys.bubble)
      .setDepth(3)
      .setAlpha(Phaser.Math.FloatBetween(0.16, 0.5))
      .setScale(Phaser.Math.FloatBetween(0.42, 1.22));
    this.resetBubble(bubble, x, y);
    return bubble;
  }

  private resetBubble(bubble: Phaser.GameObjects.Image, x: number, y: number): void {
    bubble.setPosition(x, y);
    bubble.setAlpha(Phaser.Math.FloatBetween(0.16, 0.5));
    bubble.setScale(Phaser.Math.FloatBetween(0.42, 1.22));
    bubble.setData('rise', Phaser.Math.FloatBetween(8, 28));
    bubble.setData('drift', Phaser.Math.FloatBetween(4, 16));
  }

  private createReefSprout(x: number, y: number): Phaser.GameObjects.Image {
    const sprout = this.add
      .image(x, y, TextureKeys.reefSprout)
      .setOrigin(0.5, 1)
      .setDepth(2.6)
      .setAlpha(0.96);
    this.resetReefSprout(sprout, x);
    return sprout;
  }

  private resetReefSprout(sprout: Phaser.GameObjects.Image, x: number): void {
    sprout.setPosition(x, GAME_HEIGHT - Phaser.Math.Between(8, 24));
    sprout.setScale(Phaser.Math.FloatBetween(0.22, 0.34));
    sprout.setFlipX(Math.random() > 0.5);
    sprout.setData('baseY', sprout.y);
    sprout.setData('drift', Phaser.Math.FloatBetween(0.16, 0.24));
    sprout.setData('phase', Math.random() * Math.PI * 2);
  }
}
