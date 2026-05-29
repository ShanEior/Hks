/**
 * ArtGen — 启动时用 Canvas2D 生成全部游戏纹理
 * 零外部文件，纯代码绘制像素风格精灵
 */

import Phaser from 'phaser';

export function generateAllTextures(scene: Phaser.Scene): void {
  genBackground(scene);
  genPlayer(scene);
  genTermite(scene);
  genWind(scene);
  genAcidRain(scene);
  genFire(scene);
  genFreezeThaw(scene);
  genBuilding(scene);
  genExpOrb(scene);
  genBolt(scene);
}

// ── 通用工具 ──

function createCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false; // 像素风
  return { canvas, ctx };
}

function addToPhaser(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

// ── 背景：古风庭院（480×270，铺满1920×1080） ──

function genBackground(scene: Phaser.Scene): void {
  const tw = 480, th = 270;
  const { canvas, ctx } = createCanvas(tw, th);

  // 草地底色
  ctx.fillStyle = '#3A7D2C';
  ctx.fillRect(0, 0, tw, th);

  // 草斑（随机浅绿块）
  ctx.fillStyle = '#4A8D3C';
  for (let i = 0; i < 60; i++) {
    const rx = Math.random() * tw, ry = Math.random() * th;
    ctx.beginPath();
    ctx.arc(rx, ry, 6 + Math.random() * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // 深色土路
  ctx.fillStyle = '#8B7355';
  ctx.beginPath();
  // 十字路通中央
  ctx.moveTo(0, th * 0.45);
  ctx.lineTo(tw, th * 0.45);
  ctx.lineTo(tw, th * 0.55);
  ctx.lineTo(0, th * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tw * 0.45, 0);
  ctx.lineTo(tw * 0.55, 0);
  ctx.lineTo(tw * 0.55, th);
  ctx.lineTo(tw * 0.45, th);
  ctx.closePath();
  ctx.fill();

  // 中央庭院（石板地）
  ctx.fillStyle = '#9E9E9E';
  const cx = tw / 2, cy = th / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 50, 0, Math.PI * 2);
  ctx.fill();
  // 石板纹路
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  for (let a = 0; a < 6; a++) {
    const angle = (a / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48);
    ctx.stroke();
  }

  // 四角装饰树（简化松柏）
  function drawTree(tx: number, ty: number, s: number): void {
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(tx - s * 0.08, ty, s * 0.16, s * 0.5);
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.moveTo(tx, ty - s * 0.3);
    ctx.lineTo(tx + s * 0.25, ty + s * 0.15);
    ctx.lineTo(tx - s * 0.25, ty + s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx, ty - s * 0.1);
    ctx.lineTo(tx + s * 0.3, ty + s * 0.3);
    ctx.lineTo(tx - s * 0.3, ty + s * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  drawTree(30, 30, 40);
  drawTree(tw - 30, 30, 40);
  drawTree(30, th - 30, 40);
  drawTree(tw - 30, th - 30, 40);

  // 围墙
  ctx.strokeStyle = '#6D4C41';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, tw - 8, th - 8);

  // 西南角香炉
  const lx = 70, ly = th - 60;
  ctx.fillStyle = '#795548';
  ctx.beginPath();
  ctx.arc(lx, ly, 8, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(lx - 6, ly - 4, 12, 4);
  // 香烟
  ctx.strokeStyle = '#CCC';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(lx - 2 + i * 2, ly - 8);
    ctx.quadraticCurveTo(lx - 3 + i * 3, ly - 16, lx - 1 + i * 2, ly - 22);
    ctx.stroke();
  }

  addToPhaser(scene, 'background', canvas);
}

// ── 玩家：古建守护者（32×32） ──

function genPlayer(scene: Phaser.Scene): void {
  const s = 32;
  const { canvas, ctx } = createCanvas(s, s);
  const m = s / 2;

  // 斗笠/帽子
  ctx.fillStyle = '#8B5E3C';
  ctx.beginPath();
  ctx.arc(m, 7, 9, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#6B3A2A';
  ctx.fillRect(m - 10, 5, 20, 3);

  // 脸
  ctx.fillStyle = '#FFDDBB';
  ctx.beginPath();
  ctx.arc(m, 12, 6, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = '#000';
  ctx.fillRect(m - 3, 10, 2, 2);
  ctx.fillRect(m + 1, 10, 2, 2);

  // 身体（国风长袍）
  ctx.fillStyle = '#3366AA';
  ctx.fillRect(m - 6, 18, 12, 10);
  // 腰带
  ctx.fillStyle = '#FFCC44';
  ctx.fillRect(m - 6, 22, 12, 2);

  // 腿
  ctx.fillStyle = '#554433';
  ctx.fillRect(m - 5, 28, 4, 4);
  ctx.fillRect(m + 1, 28, 4, 4);

  // 手中毛笔（右下）
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(m + 7, 18, 2, 10);
  ctx.fillStyle = '#333';
  ctx.fillRect(m + 6, 26, 4, 3);

  addToPhaser(scene, 'player', canvas);
}

// ── 白蚁怪（16×16） ──

function genTermite(scene: Phaser.Scene): void {
  const s = 16, m = s / 2;
  const { canvas, ctx } = createCanvas(s, s);

  // 身体（椭圆）
  ctx.fillStyle = '#EEEEEE';
  ctx.beginPath();
  ctx.ellipse(m, 9, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 头
  ctx.fillStyle = '#DDDDDD';
  ctx.beginPath();
  ctx.arc(m, 4, 3, 0, Math.PI * 2);
  ctx.fill();

  // 触角
  ctx.strokeStyle = '#CCC';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m - 2, 2); ctx.lineTo(m - 5, 0);
  ctx.moveTo(m + 2, 2); ctx.lineTo(m + 5, 0);
  ctx.stroke();

  // 眼睛
  ctx.fillStyle = '#600';
  ctx.fillRect(m - 2, 3, 1, 1);
  ctx.fillRect(m + 1, 3, 1, 1);

  // 小脚
  ctx.fillStyle = '#CCC';
  ctx.fillRect(m - 3, 13, 2, 2);
  ctx.fillRect(m + 1, 13, 2, 2);

  addToPhaser(scene, 'termite', canvas);
}

// ── 风蚀怪（20×20） ──

function genWind(scene: Phaser.Scene): void {
  const s = 20, m = s / 2;
  const { canvas, ctx } = createCanvas(s, s);

  // 旋风身体
  ctx.fillStyle = '#EEDD88';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const r = i === 0 ? 2 : 8;
    ctx.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();

  // 简化为菱形旋转体
  ctx.fillStyle = '#EECC66';
  ctx.beginPath();
  ctx.moveTo(m, m - 8);
  ctx.lineTo(m + 6, m);
  ctx.lineTo(m, m + 8);
  ctx.lineTo(m - 6, m);
  ctx.closePath();
  ctx.fill();

  // 风刃线
  ctx.strokeStyle = '#FFEE99';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m - 5, m - 5);
  ctx.lineTo(m + 5, m + 5);
  ctx.moveTo(m + 5, m - 5);
  ctx.lineTo(m - 5, m + 5);
  ctx.stroke();

  // 中心眼
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(m, m, 2, 0, Math.PI * 2);
  ctx.fill();

  addToPhaser(scene, 'wind', canvas);
}

// ── 酸雨怪（22×22） ──

function genAcidRain(scene: Phaser.Scene): void {
  const s = 22, m = s / 2;
  const { canvas, ctx } = createCanvas(s, s);

  // 水滴形身体
  ctx.fillStyle = '#33AA33';
  ctx.beginPath();
  ctx.moveTo(m, s - 1);
  ctx.bezierCurveTo(m - 8, m + 4, m - 8, m - 6, m, 2);
  ctx.bezierCurveTo(m + 8, m - 6, m + 8, m + 4, m, s - 1);
  ctx.fill();

  // 腐蚀气泡
  ctx.fillStyle = '#66FF66';
  ctx.beginPath();
  ctx.arc(m - 3, 8, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(m + 3, 10, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = '#FFF';
  ctx.fillRect(m - 3, m - 2, 3, 3);
  ctx.fillRect(m + 1, m - 2, 3, 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(m - 2, m - 1, 2, 2);
  ctx.fillRect(m + 1, m - 1, 2, 2);

  addToPhaser(scene, 'acid_rain', canvas);
}

// ── 火焰怪（24×24） ──

function genFire(scene: Phaser.Scene): void {
  const s = 24, m = s / 2;
  const { canvas, ctx } = createCanvas(s, s);

  // 火焰外焰
  ctx.fillStyle = '#FF4400';
  ctx.beginPath();
  ctx.moveTo(m, 2);
  ctx.lineTo(m + 9, m + 2);
  ctx.lineTo(m + 5, s - 2);
  ctx.lineTo(m - 2, m + 6);
  ctx.lineTo(m - 9, m + 2);
  ctx.lineTo(m - 3, m - 2);
  ctx.closePath();
  ctx.fill();

  // 内焰
  ctx.fillStyle = '#FFAA00';
  ctx.beginPath();
  ctx.moveTo(m, 5);
  ctx.lineTo(m + 5, m + 2);
  ctx.lineTo(m + 2, s - 4);
  ctx.lineTo(m, m + 4);
  ctx.lineTo(m - 5, m + 2);
  ctx.lineTo(m - 1, m);
  ctx.closePath();
  ctx.fill();

  // 核心
  ctx.fillStyle = '#FFEE66';
  ctx.beginPath();
  ctx.arc(m, m + 1, 3, 0, Math.PI * 2);
  ctx.fill();

  // 凶眼
  ctx.fillStyle = '#FFF';
  ctx.fillRect(m - 3, m - 3, 3, 3);
  ctx.fillRect(m + 1, m - 3, 3, 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(m - 2, m - 2, 2, 2);
  ctx.fillRect(m + 1, m - 2, 2, 2);

  addToPhaser(scene, 'fire', canvas);
}

// ── 冻融怪（28×28） ──

function genFreezeThaw(scene: Phaser.Scene): void {
  const s = 28, m = s / 2;
  const { canvas, ctx } = createCanvas(s, s);

  // 冰块主体（六边形）
  ctx.fillStyle = '#6699CC';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 11 : 8;
    ctx.lineTo(m + Math.cos(a) * r, m + 1 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();

  // 冰晶高光
  ctx.fillStyle = '#AADDFF';
  ctx.beginPath();
  ctx.moveTo(m, m - 8);
  ctx.lineTo(m - 4, m + 2);
  ctx.lineTo(m, m);
  ctx.lineTo(m + 4, m + 2);
  ctx.closePath();
  ctx.fill();

  // 裂纹线
  ctx.strokeStyle = '#88BBEE';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m - 5, m - 3); ctx.lineTo(m + 2, m + 5);
  ctx.moveTo(m + 5, m - 2); ctx.lineTo(m - 3, m + 4);
  ctx.stroke();

  // 眼睛（凶光）
  ctx.fillStyle = '#FFF';
  ctx.fillRect(m - 5, m - 2, 3, 3);
  ctx.fillRect(m + 2, m - 2, 3, 3);
  ctx.fillStyle = '#0044AA';
  ctx.fillRect(m - 4, m - 1, 2, 2);
  ctx.fillRect(m + 2, m - 1, 2, 2);

  addToPhaser(scene, 'freeze_thaw', canvas);
}

// ── 古建寺庙（100×70） ──

function genBuilding(scene: Phaser.Scene): void {
  const w = 100, h = 70;
  const { canvas, ctx } = createCanvas(w, h);

  // 台基
  ctx.fillStyle = '#888';
  ctx.fillRect(5, h - 8, w - 10, 8);

  // 外墙
  ctx.fillStyle = '#6B4226';
  ctx.fillRect(10, 15, w - 20, h - 23);

  // 木柱纹理
  ctx.fillStyle = '#7B5236';
  for (let cx = 18; cx < w - 18; cx += 16) {
    ctx.fillRect(cx, 15, 4, h - 23);
  }

  // 屋顶（飞檐）
  ctx.fillStyle = '#A0522D';
  ctx.beginPath();
  ctx.moveTo(2, 16);
  ctx.lineTo(w - 2, 16);
  ctx.lineTo(w - 12, 6);
  ctx.lineTo(w / 2 + 8, 12);
  ctx.lineTo(w / 2, 2);
  ctx.lineTo(w / 2 - 8, 12);
  ctx.lineTo(12, 6);
  ctx.closePath();
  ctx.fill();

  // 屋脊装饰
  ctx.fillStyle = '#FFCC44';
  ctx.beginPath();
  ctx.arc(w / 2, 4, 3, 0, Math.PI * 2);
  ctx.fill();

  // 斗拱层
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(6, 14, w - 12, 4);
  for (let cx = 14; cx < w - 14; cx += 10) {
    ctx.fillRect(cx, 10, 4, 8);
  }

  // 大门
  ctx.fillStyle = '#3E2723';
  ctx.fillRect(w / 2 - 10, 35, 20, h - 43);
  ctx.fillStyle = '#FFCC44';
  ctx.fillRect(w / 2 - 1, 35, 2, h - 43); // 门缝

  // 窗户
  ctx.fillStyle = '#2E1703';
  ctx.fillRect(w / 2 - 30, 25, 10, 10);
  ctx.fillRect(w / 2 + 20, 25, 10, 10);
  ctx.strokeStyle = '#C4884D';
  ctx.lineWidth = 1;
  [w / 2 - 30, w / 2 + 20].forEach(wx => {
    ctx.strokeRect(wx, 25, 10, 10);
    ctx.beginPath();
    ctx.moveTo(wx + 5, 25); ctx.lineTo(wx + 5, 35);
    ctx.moveTo(wx, 30); ctx.lineTo(wx + 10, 30);
    ctx.stroke();
  });

  addToPhaser(scene, 'building', canvas);
}

// ── 经验球（12×12） ──

function genExpOrb(scene: Phaser.Scene): void {
  const s = 12, m = s / 2;
  const { canvas, ctx } = createCanvas(s, s);

  // 光晕
  const grad = ctx.createRadialGradient(m, m, 1, m, m, 6);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(0.3, '#88FF88');
  grad.addColorStop(1, 'rgba(0,255,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  // 核心亮点
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(m, m - 1, 2, 0, Math.PI * 2);
  ctx.fill();

  addToPhaser(scene, 'exp_orb', canvas);
}

// ── 普攻弹（6×6） ──

function genBolt(scene: Phaser.Scene): void {
  const s = 6, m = s / 2;
  const { canvas, ctx } = createCanvas(s, s);

  const grad = ctx.createRadialGradient(m, m, 0, m, m, 3);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(0.5, '#88CCFF');
  grad.addColorStop(1, 'rgba(0,0,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  addToPhaser(scene, 'bolt', canvas);
}
