import Phaser from 'phaser';

import { BASE_GAME_HEIGHT, DEFAULT_GAME_WIDTH } from '../viewport.ts';

export const TextureKeys = {
  background: 'generated:bg-gradient',
  waterLines: 'generated:water-lines',
  reefBack: 'asset:distant-reef',
  seafloor: 'generated:seafloor',
  octopus: 'asset:octodash-mascot',
  octopusFrames: ['asset:octodash-mascot'],
  shield: 'asset:shield-bubble',
  coral: 'asset:coral-branch',
  jellyfish: 'asset:jellyfish',
  jellyfishSign: 'asset:jellyfish-sign',
  mine: 'asset:sea-mine',
  rock: 'asset:rock-pillar',
  seaweed: 'asset:seaweed',
  reefSprout: 'asset:reef-sprout',
  trash: 'asset:trash-bottle',
  pearl: 'asset:pearl',
  ink: 'asset:ink-drop',
  bubble: 'asset:bubble-soft',
  fish: 'asset:ambient-fish',
  current: 'generated:current'
} as const;

type DrawCallback = (context: CanvasRenderingContext2D, width: number, height: number) => void;

export function createGameTextures(scene: Phaser.Scene, width = DEFAULT_GAME_WIDTH, height = BASE_GAME_HEIGHT): void {
  const generatedWidth = Math.max(width, DEFAULT_GAME_WIDTH);

  addTexture(scene, TextureKeys.background, generatedWidth, height, drawBackground);
  addTexture(scene, TextureKeys.waterLines, generatedWidth + 240, 620, drawWaterLines);
  addTexture(scene, TextureKeys.reefBack, generatedWidth, 170, drawReefBack);
  addTexture(scene, TextureKeys.seafloor, generatedWidth, 130, drawSeafloor);
  TextureKeys.octopusFrames.forEach((key, index) => {
    addTexture(scene, key, 132, 112, (context, width, height) => drawOctopus(context, width, height, index));
  });
  addTexture(scene, TextureKeys.shield, 112, 100, drawShield);
  addTexture(scene, TextureKeys.coral, 96, 228, drawCoral);
  addTexture(scene, TextureKeys.jellyfish, 96, 126, drawJellyfish);
  addTexture(scene, TextureKeys.mine, 88, 88, drawMine);
  addTexture(scene, TextureKeys.rock, 122, 268, drawRock);
  addTexture(scene, TextureKeys.seaweed, 88, 222, drawSeaweed);
  addTexture(scene, TextureKeys.trash, 92, 72, drawTrash);
  addTexture(scene, TextureKeys.pearl, 42, 42, drawPearl);
  addTexture(scene, TextureKeys.ink, 48, 54, drawInk);
  addTexture(scene, TextureKeys.bubble, 22, 22, drawBubble);
  addTexture(scene, TextureKeys.fish, 52, 24, drawFish);
  addTexture(scene, TextureKeys.current, 110, 170, drawCurrent);
}

function addTexture(scene: Phaser.Scene, key: string, width: number, height: number, draw: DrawCallback): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    throw new Error(`Could not create texture: ${key}`);
  }

  const context = texture.getContext();
  context.clearRect(0, 0, width, height);
  draw(context, width, height);
  texture.refresh();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#0d8bb1');
  gradient.addColorStop(0.42, '#086173');
  gradient.addColorStop(1, '#052b46');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(width * 0.28, height * 0.05, 20, width * 0.28, height * 0.05, 390);
  glow.addColorStop(0, 'rgba(154, 235, 255, 0.38)');
  glow.addColorStop(1, 'rgba(154, 235, 255, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

}

function drawWaterLines(context: CanvasRenderingContext2D, width: number, _height: number): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';

  for (let i = 0; i < 7; i += 1) {
    const y = 54 + i * 82;
    const amplitude = 16 + (i % 3) * 5;
    const segment = 260 + (i % 2) * 40;

    context.strokeStyle = 'rgba(153, 238, 250, 0.08)';
    context.lineWidth = 9;
    context.beginPath();
    context.moveTo(-120, y);

    for (let x = -120; x < width + segment; x += segment) {
      const lift = i % 2 === 0 ? -amplitude : amplitude;
      context.bezierCurveTo(x + segment * 0.32, y + lift, x + segment * 0.68, y - lift, x + segment, y);
    }

    context.stroke();

    context.strokeStyle = 'rgba(196, 254, 255, 0.14)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-120, y);

    for (let x = -120; x < width + segment; x += segment) {
      const lift = i % 2 === 0 ? -amplitude : amplitude;
      context.bezierCurveTo(x + segment * 0.32, y + lift, x + segment * 0.68, y - lift, x + segment, y);
    }

    context.stroke();
  }
}

function drawReefBack(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = 'rgba(2, 32, 48, 0.42)';
  for (let x = -20; x < width + 80; x += 94) {
    const base = height;
    context.beginPath();
    context.moveTo(x, base);
    context.quadraticCurveTo(x + 26, base - 80, x + 52, base - 30);
    context.quadraticCurveTo(x + 80, base - 112, x + 116, base);
    context.closePath();
    context.fill();
  }

  context.strokeStyle = 'rgba(3, 43, 60, 0.54)';
  context.lineWidth = 8;
  for (let x = 48; x < width; x += 150) {
    context.beginPath();
    context.moveTo(x, height);
    context.bezierCurveTo(x - 4, height - 50, x + 22, height - 84, x + 8, height - 128);
    context.stroke();
  }
}

function drawSeafloor(context: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(6, 61, 77, 0)');
  gradient.addColorStop(0.36, '#0a475d');
  gradient.addColorStop(1, '#042b43');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#0d5062';
  context.beginPath();
  context.moveTo(0, 70);
  for (let x = 0; x <= width + 40; x += 80) {
    context.quadraticCurveTo(x + 40, 44 + Math.sin(x) * 10, x + 80, 70);
  }
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  context.fillStyle = 'rgba(4, 38, 54, 0.24)';
  for (let x = 24; x < width; x += 116) {
    context.beginPath();
    context.ellipse(x, 102, 38, 12, 0, 0, Math.PI * 2);
    context.fill();
  }
}

function drawOctopus(context: CanvasRenderingContext2D, width: number, height: number, frame: number): void {
  context.save();
  context.translate(width / 2, height / 2);
  context.lineCap = 'round';

  const bob = Math.sin(frame * (Math.PI / 2)) * 3;
  const kick = frame % 2 === 0 ? -1 : 1;

  function tentacle(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, widthValue: number): void {
    const gradient = context.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, '#23a9dc');
    gradient.addColorStop(0.55, '#2d89cc');
    gradient.addColorStop(1, '#ea80f0');
    context.strokeStyle = '#17317c';
    context.lineWidth = widthValue + 7;
    context.beginPath();
    context.moveTo(x1, y1);
    context.quadraticCurveTo(cx, cy, x2, y2);
    context.stroke();
    context.strokeStyle = gradient;
    context.lineWidth = widthValue;
    context.beginPath();
    context.moveTo(x1, y1);
    context.quadraticCurveTo(cx, cy, x2, y2);
    context.stroke();
  }

  tentacle(-34, 15, -53, 39 + kick * 2, -38, 48, 11);
  tentacle(-18, 24, -23, 51 - kick * 4, -4, 48, 12);
  tentacle(0, 27, 2 + kick * 4, 56, 22, 48, 12);
  tentacle(21, 21, 48, 35 + kick * 3, 43, 52, 11);
  tentacle(36, 4, 58, 12 - kick * 2, 54, 33, 10);

  context.fillStyle = '#ee83ef';
  for (const [x, y] of [
    [-40, 47],
    [-4, 48],
    [23, 48],
    [42, 52],
    [54, 32]
  ]) {
    context.beginPath();
    context.ellipse(x, y, 8, 5, -0.2, 0, Math.PI * 2);
    context.fill();
  }

  const torsoGradient = context.createLinearGradient(0, -2, 0, 32);
  torsoGradient.addColorStop(0, '#f0ffff');
  torsoGradient.addColorStop(1, '#bff6ff');
  context.fillStyle = '#17317c';
  context.beginPath();
  context.ellipse(0, 11 + bob, 29, 30, -0.08, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = torsoGradient;
  context.beginPath();
  context.ellipse(0, 10 + bob, 24, 25, -0.08, 0, Math.PI * 2);
  context.fill();

  const finGradient = context.createLinearGradient(-56, -20, 60, -6);
  finGradient.addColorStop(0, '#35c4e6');
  finGradient.addColorStop(0.72, '#39a6dc');
  finGradient.addColorStop(1, '#e48af3');
  context.fillStyle = '#17317c';
  context.beginPath();
  context.ellipse(-36, -15 + bob, 22, 15, -0.22, 0, Math.PI * 2);
  context.ellipse(36, -15 + bob, 22, 15, 0.22, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = finGradient;
  context.beginPath();
  context.ellipse(-36, -15 + bob, 18, 11, -0.22, 0, Math.PI * 2);
  context.ellipse(36, -15 + bob, 18, 11, 0.22, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#ea80f0';
  for (const x of [-48, -38, 38, 48]) {
    context.beginPath();
    context.arc(x, -9 + bob, 4, 0, Math.PI * 2);
    context.fill();
  }

  const headGradient = context.createRadialGradient(-16, -41 + bob, 7, 0, -22 + bob, 41);
  headGradient.addColorStop(0, '#75e8ff');
  headGradient.addColorStop(0.55, '#2aa9d6');
  headGradient.addColorStop(1, '#2478c4');
  context.fillStyle = '#17317c';
  context.beginPath();
  context.ellipse(0, -23 + bob, 38, 32, 0.05, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = headGradient;
  context.beginPath();
  context.ellipse(0, -24 + bob, 33, 27, 0.05, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(239, 255, 255, 0.34)';
  context.beginPath();
  context.ellipse(-14, -37 + bob, 13, 5, -0.55, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.rotate(0.04);
  context.fillStyle = '#131a4b';
  roundedRect(context, -24, -29 + bob, 50, 21, 7);
  context.fill();
  context.fillStyle = '#eaffff';
  roundedRect(context, -16, -21 + bob, 11, 4, 2);
  context.fill();
  roundedRect(context, 7, -21 + bob, 11, 4, 2);
  context.fill();
  context.restore();

  context.strokeStyle = '#25306f';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(24, -26 + bob);
  context.lineTo(34, -25 + bob);
  context.stroke();

  context.strokeStyle = '#ffd166';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(50, -21 + bob, 8, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawShield(context: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = context.createRadialGradient(width / 2, height / 2, 14, width / 2, height / 2, 55);
  gradient.addColorStop(0, 'rgba(116, 246, 255, 0.05)');
  gradient.addColorStop(0.48, 'rgba(116, 246, 255, 0.22)');
  gradient.addColorStop(0.82, 'rgba(88, 220, 255, 0.54)');
  gradient.addColorStop(1, 'rgba(255, 226, 135, 0.58)');
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(width / 2, height / 2, 50, 42, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(8, 54, 83, 0.66)';
  context.lineWidth = 7;
  context.beginPath();
  context.ellipse(width / 2, height / 2, 48, 40, 0, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = 'rgba(234, 255, 255, 0.96)';
  context.lineWidth = 3.5;
  context.beginPath();
  context.ellipse(width / 2, height / 2, 47, 39, 0, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = 'rgba(255, 214, 112, 0.82)';
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(width / 2, height / 2, 38, 31, 0, 0.3, Math.PI * 1.35);
  context.stroke();

  context.fillStyle = 'rgba(255, 245, 178, 0.94)';
  for (const [x, y, radius] of [
    [22, 22, 2.6],
    [88, 72, 2.4],
    [75, 16, 1.9]
  ] as const) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawCoral(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#f06a80';
  context.lineWidth = 16;
  context.beginPath();
  context.moveTo(width * 0.5, height);
  context.lineTo(width * 0.5, 0);
  context.moveTo(width * 0.5, 130);
  context.quadraticCurveTo(26, 102, 22, 70);
  context.moveTo(width * 0.5, 98);
  context.quadraticCurveTo(74, 60, 78, 18);
  context.moveTo(width * 0.5, 172);
  context.quadraticCurveTo(70, 146, 84, 114);
  context.stroke();

  context.strokeStyle = '#ff9b8a';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(width * 0.5 - 5, height - 12);
  context.lineTo(width * 0.5 - 5, 4);
  context.stroke();

  context.fillStyle = '#ffd166';
  for (const [x, y] of [
    [22, 70],
    [78, 18],
    [84, 114],
    [48, 7]
  ]) {
    context.beginPath();
    context.arc(x, y, 8, 0, Math.PI * 2);
    context.fill();
  }
}

function drawJellyfish(context: CanvasRenderingContext2D, width: number, _height: number): void {
  const bell = context.createRadialGradient(37, 25, 7, width / 2, 48, 42);
  bell.addColorStop(0, 'rgba(236, 252, 255, 0.96)');
  bell.addColorStop(0.46, 'rgba(173, 177, 255, 0.92)');
  bell.addColorStop(1, 'rgba(116, 82, 218, 0.88)');
  context.fillStyle = bell;
  context.strokeStyle = '#453bba';
  context.lineWidth = 5;
  context.beginPath();
  context.ellipse(width / 2, 46, 36, 32, 0, Math.PI, Math.PI * 2);
  context.bezierCurveTo(82, 74, 67, 82, 52, 76);
  context.bezierCurveTo(39, 84, 23, 80, 16, 74);
  context.closePath();
  context.fill();
  context.stroke();

  context.lineCap = 'round';
  for (let x = 23; x <= 73; x += 10) {
    const tint = x % 20 === 3 ? '#aefcff' : '#e8ffff';
    context.strokeStyle = tint;
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(x, 74);
    context.bezierCurveTo(x - 8, 92, x + 10, 104, x - 2, 122);
    context.stroke();
  }

  context.fillStyle = '#172150';
  context.beginPath();
  context.arc(40, 56, 2.6, 0, Math.PI * 2);
  context.arc(56, 56, 2.6, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(255, 238, 255, 0.95)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(48, 62, 5, 0.1, Math.PI - 0.1);
  context.stroke();

  context.fillStyle = 'rgba(255, 255, 255, 0.45)';
  context.beginPath();
  context.ellipse(39, 31, 10, 5, -0.55, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(255, 140, 229, 0.42)';
  context.beginPath();
  context.arc(28, 62, 6, 0, Math.PI * 2);
  context.arc(68, 62, 6, 0, Math.PI * 2);
  context.fill();
}

function drawMine(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.translate(width / 2, height / 2);
  context.strokeStyle = '#202b3a';
  context.lineWidth = 8;
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    context.beginPath();
    context.moveTo(Math.cos(angle) * 24, Math.sin(angle) * 24);
    context.lineTo(Math.cos(angle) * 39, Math.sin(angle) * 39);
    context.stroke();
  }

  const gradient = context.createRadialGradient(-12, -12, 4, 0, 0, 34);
  gradient.addColorStop(0, '#64738a');
  gradient.addColorStop(1, '#172131');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, 31, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#f85f73';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, 0, 18, 0, Math.PI * 2);
  context.stroke();
}

function drawRock(context: CanvasRenderingContext2D, _width: number, height: number): void {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#8ca0a7');
  gradient.addColorStop(0.55, '#536979');
  gradient.addColorStop(1, '#2c4357');
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(24, height);
  context.lineTo(12, 58);
  context.quadraticCurveTo(36, 18, 70, 36);
  context.quadraticCurveTo(100, 52, 104, 96);
  context.lineTo(112, height);
  context.closePath();
  context.fill();

  context.fillStyle = 'rgba(255, 255, 255, 0.12)';
  context.beginPath();
  context.moveTo(32, 78);
  context.quadraticCurveTo(48, 54, 70, 62);
  context.quadraticCurveTo(52, 110, 44, 186);
  context.closePath();
  context.fill();
}

function drawSeaweed(context: CanvasRenderingContext2D, _width: number, height: number): void {
  context.lineCap = 'round';
  const colors = ['#35c486', '#63d49d', '#1e9d7a'];
  for (let i = 0; i < 7; i += 1) {
    const x = 14 + i * 10;
    context.strokeStyle = colors[i % colors.length];
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(x, height);
    context.bezierCurveTo(x - 18, height - 72, x + 20, height - 146, x - 2, (i % 3) * 8);
    context.stroke();
  }

  context.fillStyle = 'rgba(227, 255, 212, 0.18)';
  context.beginPath();
  context.ellipse(46, 94, 26, 58, -0.18, 0, Math.PI * 2);
  context.fill();
}

function drawTrash(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.save();
  context.translate(width / 2, height / 2);
  context.rotate(-0.22);
  context.fillStyle = '#d9e7ef';
  roundedRect(context, -32, -15, 54, 30, 7);
  context.fill();
  context.fillStyle = '#e65f6d';
  roundedRect(context, -24, -15, 14, 30, 4);
  context.fill();
  context.strokeStyle = 'rgba(31, 55, 70, 0.25)';
  context.lineWidth = 2;
  context.strokeRect(-26, -11, 44, 22);
  context.restore();

  context.fillStyle = '#88d9ff';
  roundedRect(context, 56, 33, 22, 16, 5);
  context.fill();
}

function drawPearl(context: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = context.createRadialGradient(15, 12, 4, width / 2, height / 2, 20);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.42, '#d7fbff');
  gradient.addColorStop(1, '#9ac8ff');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(width / 2, height / 2, 16, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(width / 2, height / 2, 17, 0, Math.PI * 2);
  context.stroke();
}

function drawInk(context: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = context.createRadialGradient(16, 13, 4, width / 2, height / 2, 26);
  gradient.addColorStop(0, '#5149ff');
  gradient.addColorStop(0.55, '#202066');
  gradient.addColorStop(1, '#090923');
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(width / 2, 4);
  context.bezierCurveTo(42, 20, 44, 42, width / 2, 51);
  context.bezierCurveTo(7, 42, 8, 20, width / 2, 4);
  context.fill();

  context.fillStyle = 'rgba(128, 235, 255, 0.45)';
  context.beginPath();
  context.arc(19, 20, 5, 0, Math.PI * 2);
  context.fill();
}

function drawBubble(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.strokeStyle = 'rgba(210, 255, 255, 0.68)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(width / 2, height / 2, 8, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = 'rgba(255, 255, 255, 0.35)';
  context.beginPath();
  context.arc(8, 7, 2.6, 0, Math.PI * 2);
  context.fill();
}

function drawFish(context: CanvasRenderingContext2D, _width: number, height: number): void {
  context.fillStyle = 'rgba(3, 35, 53, 0.38)';
  context.beginPath();
  context.ellipse(24, height / 2, 18, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(40, height / 2);
  context.lineTo(52, 4);
  context.lineTo(52, height - 4);
  context.closePath();
  context.fill();
}

function drawCurrent(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const column = context.createLinearGradient(0, 0, width, 0);
  column.addColorStop(0, 'rgba(91, 239, 255, 0)');
  column.addColorStop(0.5, 'rgba(91, 239, 255, 0.18)');
  column.addColorStop(1, 'rgba(91, 239, 255, 0)');
  context.fillStyle = column;
  context.beginPath();
  context.ellipse(width / 2, height / 2, 38, height / 2 - 8, 0, 0, Math.PI * 2);
  context.fill();

  for (let i = 0; i < 3; i += 1) {
    const x = 30 + i * 18;
    const alpha = 0.52 + i * 0.12;
    context.strokeStyle = `rgba(224, 255, 255, ${alpha})`;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x, 18);
    context.bezierCurveTo(x + 26, 44, x - 18, 74, x + 16, 104);
    context.bezierCurveTo(x + 34, 121, x - 8, 140, x + 14, 158);
    context.stroke();
  }

  for (let y = 31; y <= 133; y += 34) {
    const arrow = context.createLinearGradient(39, y, 76, y);
    arrow.addColorStop(0, 'rgba(255, 247, 179, 0.12)');
    arrow.addColorStop(1, 'rgba(164, 252, 255, 0.86)');
    context.strokeStyle = 'rgba(4, 52, 76, 0.28)';
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(40, y);
    context.lineTo(66, y + 12);
    context.lineTo(40, y + 24);
    context.stroke();

    context.strokeStyle = arrow;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(40, y);
    context.lineTo(66, y + 12);
    context.lineTo(40, y + 24);
    context.stroke();
  }

  context.fillStyle = 'rgba(221, 255, 255, 0.58)';
  for (const [x, y, radius] of [
    [24, 38, 2],
    [82, 62, 1.7],
    [31, 121, 1.6],
    [76, 145, 2.2]
  ] as const) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}
