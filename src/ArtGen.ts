/**
 * ArtGen — 像素风精灵纹理生成器 v2
 * 全部使用 Canvas2D 绘制，零外部文件
 * 风格参考：东方夜雀食堂（暖色调、精细像素、Q版萌系）
 * 像素块：PX=2（1 像素格 = 2×2 物理像素）
 */

import Phaser from 'phaser';

// ═══════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════

const PX = 2; // 像素块大小

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

function addTex(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

/** 绘制单个像素块 */
function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, PX, PX);
}

/** 绘制矩形像素块 */
function pxRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, w * PX, h * PX);
}

/** 水平线 */
function pxHLine(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string) {
  pxRect(ctx, x, y, len, 1, color);
}

/** 垂直线 */
function pxVLine(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string) {
  pxRect(ctx, x, y, 1, len, color);
}

// ═══════════════════════════════════════════════
// 全局暖色调色板（参考美术文档 15.2）
// ═══════════════════════════════════════════════

const PAL = {
  // 暖棕系
  darkBrown:   '#2D1B0E',
  midBrown:    '#4A3528',
  warmBrown:   '#6B4C3B',
  goldBrown:   '#8B6914',
  lightBrown:  '#B8956E',
  creamGold:   '#D4A76A',
  // 暖红系
  darkRed:     '#8B3A1A',
  warmRed:     '#A0522D',
  orangeBrown: '#C87848',
  brightOrange:'#E89858',
  // 暖绿系
  darkGreen:   '#2D4A1E',
  midGreen:    '#3D6A2A',
  leafGreen:   '#5A8A4A',
  lightGreen:  '#8AB868',
  // 暖金系
  gold:        '#FFCC44',
  lightGold:   '#FFDD88',
  warmWhite:   '#FFF0C0',
  pureWhite:   '#FFFFFF',
  // 中性色
  deepBrown:   '#554433',
  darkGray:    '#777766',
  midGray:     '#999999',
  lightGray:   '#BBBBAA',
  // 冷色（仅冻融怪/水纹）
  iceBlue:     '#3366AA',
  midBlue:     '#5599CC',
  lightBlue:   '#88CCEE',
  iceWhite:    '#CCEEFF',
  // 肤色
  skin:        '#FFDDBB',
  skinShadow:  '#FFCCAA',
  skinDark:    '#CC9977',
  // 布料
  blueCloth:   '#3355AA',
  blueClothL:  '#3A6ED8',
  // 笔/墨
  inkBlack:    '#222222',
  penBrown:    '#8B6914',
  penTip:      '#333333',
};

// ═══════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════

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
  genRepairCrate(scene);
  genSkillTextures(scene);
}

// ═══════════════════════════════════════════════
// 背景：古风庭院 480×270 像素格（=960×540 物理px）
// ═══════════════════════════════════════════════

function genBackground(scene: Phaser.Scene) {
  const W = 480, H = 270;
  const { canvas, ctx } = makeCanvas(W * PX, H * PX);

  // 草地基底 — 暖绿色
  pxRect(ctx, 0, 0, W, H, PAL.leafGreen);

  // 草斑纹理（更密集，150+ 点）
  const grassColors = [PAL.midGreen, PAL.darkGreen, '#4A7A3A', '#6A9A5A', PAL.lightGreen];
  for (let i = 0; i < 150; i++) {
    const rx = Math.floor(Math.random() * W);
    const ry = Math.floor(Math.random() * H);
    px(ctx, rx, ry, grassColors[i % grassColors.length]);
  }

  // 土路（十字）— 暖棕色
  pxRect(ctx, 0, H / 2 - 4, W, 8, PAL.lightBrown);
  pxRect(ctx, W / 2 - 4, 0, 8, H, PAL.lightBrown);
  // 路面纹理
  const roadTex = [PAL.creamGold, PAL.warmBrown, '#C9A47A'];
  for (let i = 0; i < 100; i++) {
    px(ctx, Math.floor(Math.random() * W), H / 2 - 3 + Math.floor(Math.random() * 6), roadTex[i % 3]);
    px(ctx, W / 2 - 3 + Math.floor(Math.random() * 6), Math.floor(Math.random() * H), roadTex[i % 3]);
  }

  // 中央石板庭院 — 扩大
  const plazaCX = W / 2, plazaCY = H / 2;
  pxRect(ctx, plazaCX - 28, plazaCY - 28, 56, 56, PAL.lightGray);
  for (let gx = 0; gx < 6; gx++) {
    for (let gy = 0; gy < 6; gy++) {
      const sx = plazaCX - 26 + gx * 9;
      const sy = plazaCY - 26 + gy * 9;
      pxRect(ctx, sx, sy, 8, 8, '#B8A890');
      pxRect(ctx, sx + 1, sy + 1, 6, 6, '#C8B898');
    }
  }

  // 四角松柏 — 更大更精细
  function tree(tx: number, ty: number) {
    // 树干（三层色）
    pxRect(ctx, tx - 2, ty + 14, 4, 14, PAL.deepBrown);
    pxVLine(ctx, tx, ty + 12, 16, PAL.midBrown);       // 高光
    // 树冠（四层三角，从暗到亮）
    pxRect(ctx, tx - 10, ty - 2, 20, 6, PAL.darkGreen);  // L1 暗底
    pxRect(ctx, tx - 8, ty + 0, 16, 5, PAL.midGreen);    // L1 亮面
    pxRect(ctx, tx - 13, ty + 4, 26, 6, PAL.darkGreen);  // L2 暗底
    pxRect(ctx, tx - 11, ty + 6, 22, 5, PAL.midGreen);   // L2 亮面
    pxRect(ctx, tx - 16, ty + 10, 32, 5, PAL.darkGreen); // L3 暗底
    pxRect(ctx, tx - 14, ty + 12, 28, 4, PAL.midGreen);  // L3 亮面
    // 高光点
    px(ctx, tx - 3, ty - 1, PAL.lightGreen);
    px(ctx, tx + 1, ty + 5, PAL.lightGreen);
    px(ctx, tx - 5, ty + 11, PAL.lightGreen);
    px(ctx, tx + 2, ty + 13, PAL.lightGreen);
  }
  tree(26, 38);
  tree(W - 28, 38);
  tree(26, H - 52);
  tree(W - 28, H - 52);

  // 围墙 — 更完整的院墙
  for (let wx = 8; wx < W - 8; wx++) {
    px(ctx, wx, 8, PAL.midGray);     // 上墙
    px(ctx, wx, H - 9, PAL.midGray); // 下墙
  }
  for (let wy = 8; wy < H - 8; wy++) {
    px(ctx, 8, wy, PAL.midGray);     // 左墙
    px(ctx, W - 9, wy, PAL.midGray); // 右墙
  }
  // 墙垛（更密）
  for (let wx = 8; wx < W - 8; wx += 20) {
    pxRect(ctx, wx, 6, 5, 2, '#A08070');
    pxRect(ctx, wx, H - 7, 5, 2, '#A08070');
  }

  // 四角灯笼柱
  function lanternPole(lx: number, ly: number) {
    pxRect(ctx, lx, ly, 2, 18, PAL.deepBrown);          // 柱
    pxRect(ctx, lx - 2, ly - 4, 6, 5, PAL.warmRed);     // 灯笼
    pxRect(ctx, lx - 1, ly - 3, 4, 3, PAL.brightOrange);// 灯笼亮面
    px(ctx, lx + 1, ly - 1, PAL.gold);                   // 烛光
  }
  lanternPole(15, 10);
  lanternPole(W - 18, 10);
  lanternPole(15, H - 28);
  lanternPole(W - 18, H - 28);

  // 香炉（左下，更精细）
  const lx = 50, ly = H - 44;
  pxRect(ctx, lx - 5, ly, 10, 10, PAL.midBrown);      // 炉身
  pxRect(ctx, lx - 4, ly - 1, 8, 2, PAL.warmBrown);   // 炉身亮面
  pxRect(ctx, lx - 6, ly - 2, 12, 3, PAL.midGray);     // 炉口
  pxRect(ctx, lx - 7, ly - 4, 14, 2, PAL.lightGray);   // 炉檐
  // 三足
  pxRect(ctx, lx - 4, ly + 9, 3, 3, PAL.darkGray);
  pxRect(ctx, lx + 1, ly + 9, 3, 3, PAL.darkGray);
  // 炊烟（3 缕弯曲上升）
  for (let s = 0; s < 3; s++) {
    const ox = lx - 2 + s * 3;
    for (let j = 0; j < 6; j++) {
      const sx = ox + (j % 2 === 0 ? 0 : 1);
      const sy = ly - 8 - j * 3;
      px(ctx, sx, sy, j < 2 ? '#CCCCCC' : '#DDDDDD');
    }
  }

  addTex(scene, 'background', canvas);
}

// ═══════════════════════════════════════════════
// 玩家：古建守护者 32×48 像素格（=64×96 物理px）
// Q版二头身，斗笠+蓝袍+毛笔
// ═══════════════════════════════════════════════

function genPlayer(scene: Phaser.Scene) {
  const W = 32, H = 48;
  const { canvas, ctx } = makeCanvas(W * PX, H * PX);

  // ── 斗笠（大而圆润） ──
  // 笠底暗面
  pxRect(ctx, 7, 12, 18, 2, PAL.darkBrown);
  // 笠身（三层锥形）
  pxRect(ctx, 6, 10, 20, 3, PAL.midBrown);
  pxRect(ctx, 4, 8, 24, 3, PAL.warmBrown);
  pxRect(ctx, 2, 6, 28, 3, PAL.goldBrown);
  // 笠顶
  px(ctx, 14, 4, PAL.lightBrown);
  px(ctx, 15, 4, PAL.creamGold);
  px(ctx, 14, 5, PAL.goldBrown);
  px(ctx, 15, 5, PAL.lightBrown);
  // 笠沿装饰线
  pxHLine(ctx, 4, 13, 24, PAL.lightBrown);
  pxHLine(ctx, 5, 14, 22, PAL.creamGold);

  // ── 头部（圆脸） ──
  pxRect(ctx, 10, 14, 12, 9, PAL.skin);
  pxRect(ctx, 9, 16, 14, 5, PAL.skinShadow);
  // 脸颊红晕
  px(ctx, 9, 19, '#FFBBAA');
  px(ctx, 21, 19, '#FFBBAA');
  // 眼睛（大圆眼 + 高光）
  pxRect(ctx, 12, 16, 3, 3, PAL.inkBlack);
  px(ctx, 12, 16, PAL.pureWhite);   // 高光
  pxRect(ctx, 17, 16, 3, 3, PAL.inkBlack);
  px(ctx, 17, 16, PAL.pureWhite);   // 高光
  // 小嘴
  px(ctx, 15, 21, PAL.skinDark);
  // 眉毛（短横线）
  pxRect(ctx, 11, 15, 3, 1, PAL.inkBlack);
  pxRect(ctx, 18, 15, 3, 1, PAL.inkBlack);

  // ── 身体（蓝袍交领） ──
  // 领口
  pxRect(ctx, 13, 23, 6, 2, PAL.blueClothL);
  // 袍身
  pxRect(ctx, 9, 25, 14, 13, PAL.blueCloth);
  pxRect(ctx, 8, 26, 16, 10, '#2A4AA0');  // 暗面（左侧）
  // 交领右衽 — 斜线装饰
  px(ctx, 13, 25, '#4455BB');
  px(ctx, 12, 26, '#4455BB');
  px(ctx, 11, 27, '#4455BB');
  // 袍摆
  pxHLine(ctx, 9, 37, 14, '#224499');
  // 袖口（左右宽袖）
  pxRect(ctx, 6, 25, 4, 7, PAL.blueClothL);
  pxRect(ctx, 22, 25, 4, 7, PAL.blueClothL);
  // 袖口边
  pxHLine(ctx, 6, 31, 4, PAL.gold);

  // ── 腰带 ──
  pxHLine(ctx, 10, 32, 12, PAL.gold);
  pxHLine(ctx, 11, 33, 10, PAL.lightGold);
  // 带扣
  pxRect(ctx, 14, 31, 4, 3, PAL.warmBrown);
  px(ctx, 15, 32, PAL.gold);

  // ── 手臂 ──
  pxRect(ctx, 5, 27, 3, 5, PAL.skin);
  pxRect(ctx, 24, 27, 3, 5, PAL.skin);
  // 左手（自然下垂）
  pxRect(ctx, 4, 31, 3, 3, PAL.skin);

  // ── 右手握毛笔 ──
  pxRect(ctx, 25, 26, 3, 3, PAL.skin);
  // 笔杆
  pxRect(ctx, 26, 21, 2, 8, PAL.penBrown);
  // 笔尖
  pxRect(ctx, 25, 28, 3, 3, PAL.penTip);
  px(ctx, 26, 29, PAL.penTip);

  // ── 腿 ──
  pxRect(ctx, 11, 38, 4, 6, PAL.deepBrown);
  pxRect(ctx, 17, 38, 4, 6, PAL.deepBrown);
  // 鞋（圆头布鞋）
  pxRect(ctx, 9, 43, 7, 3, PAL.inkBlack);
  pxRect(ctx, 16, 43, 7, 3, PAL.inkBlack);
  // 鞋底白边
  pxHLine(ctx, 9, 45, 7, '#BBBBBB');
  pxHLine(ctx, 16, 45, 7, '#BBBBBB');

  addTex(scene, 'player', canvas);
}

// ═══════════════════════════════════════════════
// 白蚁怪 20×20 像素格（=40×40 物理px）
// ═══════════════════════════════════════════════

function genTermite(scene: Phaser.Scene) {
  const S = 20;
  const { canvas, ctx } = makeCanvas(S * PX, S * PX);

  // 身体（四节，渐变从亮到暗）
  pxRect(ctx, 6, 7, 8, 4, '#F0ECE4');   // 前段
  pxRect(ctx, 6, 11, 8, 3, '#E8E4DC');  // 中前段
  pxRect(ctx, 5, 14, 9, 2, '#DDD8D0');  // 中后段
  pxRect(ctx, 4, 16, 10, 2, '#D0C8C0'); // 后段
  // 体节线
  pxHLine(ctx, 6, 10, 8, '#CCC8C0');
  pxHLine(ctx, 6, 13, 8, '#C8C0B8');
  pxHLine(ctx, 5, 15, 8, '#C0B8B0');

  // 头（大圆头）
  pxRect(ctx, 7, 3, 6, 5, '#F5F0E8');
  pxRect(ctx, 6, 5, 8, 3, '#F0ECE4');
  // 大颚（一对）
  pxRect(ctx, 5, 6, 2, 2, '#C8B898');
  pxRect(ctx, 13, 6, 2, 2, '#C8B898');
  // 触角（长而弯）
  px(ctx, 6, 1, '#CCCCCC');
  px(ctx, 13, 1, '#CCCCCC');
  px(ctx, 5, 0, '#BBBBBB');
  px(ctx, 14, 0, '#BBBBBB');
  px(ctx, 4, 1, '#AAAAAA');
  px(ctx, 15, 1, '#AAAAAA');
  // 眼睛（暗红，带高光）
  pxRect(ctx, 7, 4, 2, 2, '#AA1111');
  px(ctx, 7, 4, '#FF4444');
  pxRect(ctx, 11, 4, 2, 2, '#AA1111');
  px(ctx, 11, 4, '#FF4444');

  // 六足（分节明显）
  function leg(x: number, y: number, dir: number) {
    pxRect(ctx, x, y, 2, 2, '#D8D0C8');
    if (dir < 0) {
      px(ctx, x - 1, y + 1, '#C8C0B8');
    } else {
      px(ctx, x + 2, y + 1, '#C8C0B8');
    }
  }
  leg(4, 8, -1);  leg(S - 6, 8, 1);   // 前足
  leg(3, 12, -1); leg(S - 5, 12, 1);  // 中足
  leg(4, 17, -1); leg(S - 6, 17, 1);  // 后足

  addTex(scene, 'termite', canvas);
}

// ═══════════════════════════════════════════════
// 风蚀怪 28×28 像素格（=56×56 物理px）
// ═══════════════════════════════════════════════

function genWind(scene: Phaser.Scene) {
  const S = 28;
  const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  const cx = 14, cy = 14;

  // 多层风刃漩涡（菱形旋转，每层偏移）
  const layers = [
    { r: 11, color: '#FFF8CC', count: 12 },
    { r: 9, color: '#F5E8A0', count: 10, offset: 0.15 },
    { r: 7, color: '#E8D470', count: 8, offset: 0.3 },
    { r: 5, color: '#D4C040', count: 6, offset: 0.45 },
  ];

  for (const layer of layers) {
    for (let a = 0; a < layer.count; a++) {
      const angle = (a / layer.count) * Math.PI * 2 + (layer.offset ?? 0);
      const sx = Math.floor(cx + Math.cos(angle) * layer.r);
      const sy = Math.floor(cy + Math.sin(angle) * layer.r);
      px(ctx, sx, sy, layer.color);
    }
  }

  // 十字风刃线（更粗）
  pxRect(ctx, cx - 1, cy - 10, 3, 20, '#FFFFDD');
  pxRect(ctx, cx - 10, cy - 1, 20, 3, '#FFFFDD');
  // 对角线风刃
  for (let d = -8; d <= 8; d++) {
    if (Math.abs(d) > 3) {
      px(ctx, cx + d, cy + d, d % 2 === 0 ? '#FFFFDD' : '#FFF8CC');
      px(ctx, cx + d, cy - d, d % 2 === 0 ? '#FFFFDD' : '#FFF8CC');
    }
  }

  // 中心眼
  pxRect(ctx, cx - 2, cy - 2, 5, 5, PAL.pureWhite);
  pxRect(ctx, cx - 1, cy - 1, 3, 3, PAL.inkBlack);
  px(ctx, cx, cy, PAL.pureWhite);  // 眼高光

  addTex(scene, 'wind', canvas);
}

// ═══════════════════════════════════════════════
// 酸雨怪 24×28 像素格（=48×56 物理px）
// ═══════════════════════════════════════════════

function genAcidRain(scene: Phaser.Scene) {
  const W = 24, H = 28;
  const { canvas, ctx } = makeCanvas(W * PX, H * PX);

  // 泪滴形身体（像素画轮廓）
  const bodyPixels: [number, number, string][] = [];
  // 上半部（窄）
  for (let y = 2; y <= 6; y++) {
    const w = 4 + y;
    const start = Math.floor((W - w) / 2);
    for (let x = start; x < start + w; x++) {
      const shade = y <= 3 ? PAL.lightGreen : '#55CC55';
      bodyPixels.push([x, y, shade]);
    }
  }
  // 中部（最宽）
  for (let y = 7; y <= 16; y++) {
    const w = 14;
    const start = Math.floor((W - w) / 2);
    for (let x = start; x < start + w; x++) {
      const shade = y <= 10 ? '#44BB44' : '#33AA33';
      bodyPixels.push([x, y, shade]);
    }
  }
  // 下半部（收窄成尖）
  for (let y = 17; y <= 25; y++) {
    const w = 14 - (y - 16) * 2;
    const start = Math.floor((W - w) / 2);
    for (let x = start; x < start + w; x++) {
      bodyPixels.push([x, y, '#228822']);
    }
  }

  for (const [bx, by, color] of bodyPixels) {
    if (bx >= 0 && bx < W && by >= 0 && by < H) {
      px(ctx, bx, by, color);
    }
  }

  // 内部气泡（3-4 个）
  pxRect(ctx, 7, 8, 2, 2, '#AAFFAA');
  px(ctx, 14, 9, '#CCFFCC');
  pxRect(ctx, 9, 14, 2, 2, '#AAFFAA');
  px(ctx, 13, 11, '#CCFFCC');

  // 顶部水珠高光
  px(ctx, 11, 1, PAL.lightGreen);
  px(ctx, 12, 2, '#AAFFAA');

  // 眼睛（圆眼，白底黑瞳）
  pxRect(ctx, 8, 7, 4, 3, PAL.pureWhite);
  pxRect(ctx, 13, 7, 4, 3, PAL.pureWhite);
  px(ctx, 9, 8, PAL.inkBlack);
  px(ctx, 14, 8, PAL.inkBlack);

  addTex(scene, 'acid_rain', canvas);
}

// ═══════════════════════════════════════════════
// 火焰怪 32×32 像素格（=64×64 物理px）
// ═══════════════════════════════════════════════

function genFire(scene: Phaser.Scene) {
  const S = 32;
  const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  const cx = 16, cy = 16;

  // 外焰（不规则火焰轮廓，顶端分叉）
  const outerFlame: [number, number][] = [];
  // 左边火焰
  for (let y = -14; y <= 12; y++) {
    const w = 8 + Math.abs(y) * 0.4 + (Math.sin(y * 0.5) * 3);
    for (let x = -Math.floor(w); x <= Math.floor(w); x++) {
      outerFlame.push([cx + x, cy + y]);
    }
  }
  // 顶端分叉
  outerFlame.push([cx - 2, cy - 15], [cx - 1, cy - 15], [cx, cy - 16],
    [cx + 1, cy - 15], [cx + 2, cy - 15],
    [cx - 4, cy - 14], [cx + 4, cy - 14]);

  for (const [fx, fy] of outerFlame) {
    if (fx >= 0 && fx < S && fy >= 0 && fy < S) {
      px(ctx, fx, fy, PAL.darkRed);
    }
  }

  // 内焰（缩小 3px）
  for (let y = -10; y <= 8; y++) {
    const w = 5 + Math.abs(y) * 0.3;
    for (let x = -Math.floor(w); x <= Math.floor(w); x++) {
      const px2 = cx + x, py2 = cy + y;
      if (px2 >= 0 && px2 < S && py2 >= 0 && py2 < S) {
        px(ctx, px2, py2, PAL.warmRed);
      }
    }
  }

  // 内核焰（更小）
  for (let y = -6; y <= 4; y++) {
    const w = 3 + Math.abs(y) * 0.2;
    for (let x = -Math.floor(w); x <= Math.floor(w); x++) {
      const px3 = cx + x, py3 = cy + y;
      if (px3 >= 0 && px3 < S && py3 >= 0 && py3 < S) {
        px(ctx, px3, py3, PAL.gold);
      }
    }
  }

  // 核心白亮
  pxRect(ctx, cx - 3, cy - 2, 7, 5, PAL.lightGold);
  pxRect(ctx, cx - 2, cy - 1, 5, 3, PAL.warmWhite);
  px(ctx, cx, cy, PAL.pureWhite);

  // 眼睛（凶眼，在核心上方）
  pxRect(ctx, cx - 5, cy - 5, 3, 3, PAL.pureWhite);
  pxRect(ctx, cx + 2, cy - 5, 3, 3, PAL.pureWhite);
  px(ctx, cx - 4, cy - 4, '#CC0000');
  px(ctx, cx + 3, cy - 4, '#CC0000');
  // 眉毛（怒眉）
  pxRect(ctx, cx - 6, cy - 7, 4, 1, PAL.darkRed);
  pxRect(ctx, cx + 2, cy - 7, 4, 1, PAL.darkRed);

  addTex(scene, 'fire', canvas);
}

// ═══════════════════════════════════════════════
// 冻融怪 34×34 像素格（=68×68 物理px）
// ═══════════════════════════════════════════════

function genFreezeThaw(scene: Phaser.Scene) {
  const S = 34;
  const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  const cx = 17, cy = 17;

  // 六边形冰块主体（填充）
  for (let dy = -13; dy <= 13; dy++) {
    for (let dx = -13; dx <= 13; dx++) {
      const qx = Math.abs(dx) * 0.866 + Math.abs(dy) * 0.5;
      const qy = Math.abs(dy) * 0.866;
      if (qx < 12 && qy < 12) {
        const px2 = cx + dx, py2 = cy + dy;
        const shade = (dx + dy) % 4 === 0
          ? PAL.lightBlue
          : (dx + dy) % 4 === 1
            ? PAL.midBlue
            : (dx + dy) % 4 === 2
              ? '#6AAADD'
              : PAL.iceBlue;
        px(ctx, px2, py2, shade);
      }
    }
  }

  // 冰晶高光（左上方向强光条）
  pxRect(ctx, cx - 5, cy - 10, 2, 12, PAL.iceWhite);
  pxRect(ctx, cx - 3, cy - 8, 2, 8, '#DDEEFF');
  px(ctx, cx - 1, cy - 9, PAL.iceWhite);
  px(ctx, cx - 7, cy - 8, PAL.lightBlue);
  px(ctx, cx - 8, cy - 6, PAL.lightBlue);
  px(ctx, cx + 3, cy - 4, PAL.iceWhite);

  // 裂纹（深蓝色不规则线）
  const cracks = [
    [cx - 8, cy - 2], [cx - 7, cy - 1], [cx - 6, cy], [cx - 5, cy + 1],
    [cx - 4, cy + 3], [cx - 3, cy + 5],
    [cx + 5, cy - 7], [cx + 6, cy - 6], [cx + 7, cy - 5],
    [cx + 6, cy - 2], [cx + 5, cy], [cx + 4, cy + 2],
    [cx + 1, cy + 8], [cx + 2, cy + 9],
  ];
  for (const [cx2, cy2] of cracks) {
    px(ctx, cx2, cy2, PAL.iceBlue);
  }

  // 眼睛（冷光，在冰晶核心）
  pxRect(ctx, cx - 6, cy - 3, 4, 3, PAL.pureWhite);
  pxRect(ctx, cx + 2, cy - 3, 4, 3, PAL.pureWhite);
  px(ctx, cx - 5, cy - 2, '#0044AA');
  px(ctx, cx + 3, cy - 2, '#0044AA');

  addTex(scene, 'freeze_thaw', canvas);
}

// ═══════════════════════════════════════════════
// 古建寺庙：5 段受损状态  96×56 像素格（=192×112 物理px）
// ═══════════════════════════════════════════════

function genBuilding(scene: Phaser.Scene) {
  const states = [
    { key: 'building_100', damage: 0 },
    { key: 'building_75', damage: 1 },
    { key: 'building_50', damage: 2 },
    { key: 'building_25', damage: 3 },
    { key: 'building_0', damage: 4 },
  ];

  for (const st of states) {
    const W = 96, H = 56;
    const { canvas, ctx } = makeCanvas(W * PX, H * PX);
    const dm = st.damage; // 0=完好, 4=废墟

    // ═══ 台基 ═══
    const baseY = H - 6;
    pxRect(ctx, 4, baseY, W - 8, 6, dm >= 3 ? PAL.darkGray : PAL.midGray);
    // 台阶纹路（三层）
    if (dm < 3) {
      pxHLine(ctx, 8, baseY + 1, W - 16, PAL.lightGray);
      pxHLine(ctx, 6, baseY + 3, W - 12, PAL.lightGray);
    }
    if (dm >= 4) {
      // 台基碎裂
      for (let i = 0; i < 12; i++) {
        px(ctx, 10 + Math.floor(Math.random() * (W - 20)), baseY + Math.floor(Math.random() * 4), PAL.deepBrown);
      }
    }

    // ═══ 外墙 ═══
    const wallTop = 20, wallBot = baseY;
    const wallLeft = 10, wallRight = W - 10;

    if (dm < 4) {
      // 主墙面
      pxRect(ctx, wallLeft, wallTop, wallRight - wallLeft, wallBot - wallTop, PAL.warmBrown);
      // 墙面纹理横线（模拟木板拼接）
      for (let wy2 = wallTop + 6; wy2 < wallBot - 2; wy2 += 8) {
        pxHLine(ctx, wallLeft + 2, wy2, wallRight - wallLeft - 4, PAL.midBrown);
      }
    } else {
      // 废墟：残垣
      pxRect(ctx, wallLeft, wallBot - 12, 16, 8, PAL.warmBrown);
      pxRect(ctx, W - 26, wallBot - 10, 16, 6, PAL.warmBrown);
    }

    // 外墙裂缝（dm>=2）
    if (dm >= 2) {
      const crackCount = dm === 4 ? 10 : dm * 3;
      for (let i = 0; i < crackCount; i++) {
        const cx2 = wallLeft + 4 + Math.floor(Math.random() * (wallRight - wallLeft - 8));
        const cy2 = wallTop + 2 + Math.floor(Math.random() * (wallBot - wallTop - 6));
        px(ctx, cx2, cy2, PAL.darkBrown);
        if (dm >= 3) {
          px(ctx, Math.min(cx2 + 1, wallRight - 4), cy2, PAL.darkBrown);
        }
      }
    }

    // ═══ 木柱 ═══
    const pillars = [18, 32, 48, 64, 78];
    for (const pX of pillars) {
      if (dm >= 3 && pX === 48) continue;         // 中柱断裂
      if (dm >= 4 && (pX === 18 || pX === 78)) continue;
      // 柱身
      pxRect(ctx, pX, wallTop - 2, 3, wallBot - wallTop + 2, PAL.goldBrown);
      // 柱高光（左边缘）
      pxVLine(ctx, pX, wallTop - 2, wallBot - wallTop + 2, PAL.creamGold);
      // 柱础
      pxRect(ctx, pX - 1, wallBot - 2, 5, 3, PAL.lightGray);
    }
    // 断裂柱
    if (dm >= 3) {
      pxRect(ctx, 48, wallTop - 2, 3, 8, PAL.goldBrown);
      // 断裂面
      pxHLine(ctx, 47, wallTop + 5, 5, PAL.creamGold);
    }

    // ═══ 斗拱层 ═══
    const dougongY = wallTop - 8;
    if (dm < 3) {
      pxRect(ctx, 6, dougongY, W - 12, 4, PAL.midBrown);
      for (let dx = 12; dx < W - 12; dx += 10) {
        pxRect(ctx, dx, dougongY - 3, 4, 5, PAL.warmBrown);
        pxRect(ctx, dx + 1, dougongY - 4, 2, 6, PAL.goldBrown);
      }
    } else if (dm < 4) {
      // 部分斗拱损坏
      pxRect(ctx, 6, dougongY, 28, 4, PAL.midBrown);
      pxRect(ctx, W - 34, dougongY, 28, 4, PAL.midBrown);
    }

    // ═══ 屋顶（歇山顶 + 飞檐） ═══
    const roofBaseY = dm >= 3 ? dougongY + 2 : dougongY;
    if (dm < 4) {
      const roofColor = dm >= 2 ? PAL.darkRed : PAL.warmRed;
      const roofDark = dm >= 2 ? '#6B2010' : '#8B3A1A';

      // 主屋面（宽大）
      pxRect(ctx, 3, roofBaseY - 3, W - 6, 6, roofColor);
      pxRect(ctx, 5, roofBaseY - 5, W - 10, 5, roofDark);
      // 屋面纹理瓦垄
      for (let tx = 6; tx < W - 6; tx += 3) {
        pxVLine(ctx, tx, roofBaseY - 4, 5, PAL.orangeBrown);
      }

      // 飞檐翘角（左右）
      if (dm < 2) {
        px(ctx, 1, roofBaseY - 5, roofColor);
        px(ctx, 1, roofBaseY - 6, PAL.orangeBrown);
        px(ctx, W - 2, roofBaseY - 5, roofColor);
        px(ctx, W - 2, roofBaseY - 6, PAL.orangeBrown);
      }
      // 檐下阴影
      pxHLine(ctx, 4, roofBaseY + 2, W - 8, PAL.deepBrown);

      // 正脊（顶部横脊）
      pxRect(ctx, W / 2 - 14, roofBaseY - 7, 28, 3, PAL.darkRed);
      // 脊饰（金色鸱吻）
      if (dm < 1) {
        pxRect(ctx, W / 2 - 4, roofBaseY - 10, 8, 4, PAL.gold);
        px(ctx, W / 2, roofBaseY - 12, PAL.gold);
        px(ctx, W / 2 - 1, roofBaseY - 11, PAL.lightGold);
        px(ctx, W / 2 + 1, roofBaseY - 11, PAL.lightGold);
      } else if (dm === 1) {
        pxRect(ctx, W / 2 - 3, roofBaseY - 9, 6, 3, PAL.gold);
      }
    } else {
      // 废墟屋顶碎片
      pxRect(ctx, 6, roofBaseY + 4, 16, 4, PAL.darkRed);
      pxRect(ctx, W - 22, roofBaseY + 5, 14, 3, PAL.darkRed);
    }

    // ═══ 大门 ═══
    const doorY = wallTop + 8;
    if (dm < 3) {
      pxRect(ctx, W / 2 - 10, doorY, 20, wallBot - doorY, PAL.darkBrown);
      // 门框
      pxRect(ctx, W / 2 - 11, doorY - 1, 22, 2, PAL.goldBrown);
      // 门缝
      pxVLine(ctx, W / 2, doorY + 2, wallBot - doorY - 2, PAL.gold);
      // 门环
      pxRect(ctx, W / 2 - 4, doorY + 10, 3, 3, PAL.gold);
      pxRect(ctx, W / 2 + 1, doorY + 10, 3, 3, PAL.gold);
    } else if (dm < 4) {
      pxRect(ctx, W / 2 - 6, doorY + 4, 12, wallBot - doorY - 4, PAL.darkBrown);
    }

    // ═══ 窗户 ═══
    if (dm < 4) {
      [W / 2 - 28, W / 2 + 22].forEach((wX, wi) => {
        if (dm >= 3 && wi === 1) return; // 右窗损坏
        pxRect(ctx, wX, doorY + 2, 7, 8, '#2E1703');
        // 直棂窗格
        for (let lx = 0; lx < 3; lx++) {
          pxVLine(ctx, wX + 1 + lx * 2, doorY + 2, 8, PAL.goldBrown);
        }
        pxHLine(ctx, wX, doorY + 5, 7, PAL.goldBrown);
      });
    }

    // ═══ 废墟杂草（dm≥4） ═══
    if (dm >= 4) {
      for (let i = 0; i < 16; i++) {
        const gx = 4 + Math.floor(Math.random() * (W - 8));
        const gy = baseY - 4 + Math.floor(Math.random() * 6);
        px(ctx, gx, gy, PAL.midGreen);
        if (Math.random() > 0.5) px(ctx, gx, gy - 1, PAL.leafGreen);
      }
    }

    // 注册纹理
    if (dm === 0) {
      addTex(scene, 'building', canvas);
    }
    addTex(scene, st.key, canvas);
  }
}

// ═══════════════════════════════════════════════
// 经验球 10×10 像素格（=20×20 物理px）
// ═══════════════════════════════════════════════

function genExpOrb(scene: Phaser.Scene) {
  const S = 10;
  const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  const cx2 = 5, cy2 = 5;

  // 辉光（多层柔光）
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 4.5) {
        const brightness = 1 - d / 4.5;
        const g = Math.floor(180 + brightness * 75);
        const r = Math.floor(brightness * 80);
        const b = Math.floor(brightness * 60);
        px(ctx, cx2 + dx, cy2 + dy, `rgb(${r},${g},${b})`);
      }
    }
  }

  // 内圈亮光
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= 3) {
        px(ctx, cx2 + dx, cy2 + dy, PAL.lightGold);
      }
    }
  }

  // 核心亮点
  px(ctx, cx2, cy2, PAL.warmWhite);
  px(ctx, cx2 - 1, cy2, PAL.pureWhite);

  addTex(scene, 'exp_orb', canvas);
}

// ═══════════════════════════════════════════════
// 普攻弹 8×8 像素格（=16×16 物理px）
// ═══════════════════════════════════════════════

function genBolt(scene: Phaser.Scene) {
  const S = 8;
  const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  const cx2 = 4, cy2 = 4;

  // 外围光晕
  px(ctx, cx2 - 1, cy2, PAL.lightBlue);
  px(ctx, cx2 + 1, cy2, PAL.lightBlue);
  px(ctx, cx2, cy2 - 1, PAL.lightBlue);
  px(ctx, cx2, cy2 + 1, PAL.lightBlue);
  px(ctx, cx2 - 1, cy2 - 1, PAL.midBlue);
  px(ctx, cx2 + 1, cy2 - 1, PAL.midBlue);
  px(ctx, cx2 - 1, cy2 + 1, PAL.midBlue);
  px(ctx, cx2 + 1, cy2 + 1, PAL.midBlue);
  // 核心
  px(ctx, cx2, cy2, PAL.pureWhite);

  addTex(scene, 'bolt', canvas);
}

// ═══════════════════════════════════════════════
// 技能特效纹理
// ═══════════════════════════════════════════════

// ── 修补箱 12×12 像素格（=24×24物理px） ──

function genRepairCrate(scene: Phaser.Scene) {
  const S = 12;
  const { canvas, ctx } = makeCanvas(S * PX, S * PX);

  // 木箱本体
  pxRect(ctx, 1, 2, 10, 9, PAL.midBrown);
  // 箱面亮面
  pxRect(ctx, 2, 3, 8, 7, PAL.warmBrown);
  // 木纹
  pxHLine(ctx, 2, 5, 8, PAL.goldBrown);
  pxHLine(ctx, 2, 8, 8, PAL.goldBrown);
  // 金属包角
  px(ctx, 1, 2, PAL.gold);
  px(ctx, 10, 2, PAL.gold);
  px(ctx, 1, 10, PAL.gold);
  px(ctx, 10, 10, PAL.gold);
  // 十字绷带/加固带
  pxVLine(ctx, 6, 2, 9, PAL.lightBrown);
  pxHLine(ctx, 1, 6, 10, PAL.lightBrown);
  // 中心金色加固扣
  pxRect(ctx, 5, 5, 2, 2, PAL.gold);
  px(ctx, 6, 6, PAL.lightGold);
  // 绿色十字（修复标记）
  px(ctx, 4, 1, PAL.lightGreen);
  px(ctx, 8, 1, PAL.lightGreen);
  px(ctx, 2, 3, PAL.lightGreen);
  px(ctx, 10, 3, PAL.lightGreen);

  addTex(scene, 'repair_crate', canvas);
}

function genSkillTextures(scene: Phaser.Scene) {
  // ── 木构加固：木梁冲击波 16×6 px格 ──
  {
    const W = 16, H = 6;
    const { canvas, ctx } = makeCanvas(W * PX, H * PX);
    pxRect(ctx, 0, 0, W, H, PAL.goldBrown);
    pxRect(ctx, 0, 1, W, 1, PAL.creamGold);     // 高光中线
    pxRect(ctx, 0, 5, W, 1, PAL.midBrown);      // 暗底边
    // 木纹竖线
    for (let i = 2; i < W; i += 3) {
      pxVLine(ctx, i, 1, 4, PAL.warmBrown);
    }
    // 头部箭头
    px(ctx, W - 1, 0, PAL.lightGold);
    px(ctx, W - 1, H - 1, PAL.lightGold);
    px(ctx, W, 1, PAL.lightGold);
    px(ctx, W, H - 2, PAL.lightGold);
    addTex(scene, 'wood_beam', canvas);
  }

  // ── 石材修补：石粉震波碎片 6×6 px格 ──
  {
    const S = 6;
    const { canvas, ctx } = makeCanvas(S * PX, S * PX);
    px(ctx, 2, 1, PAL.lightGray);
    px(ctx, 3, 1, PAL.midGray);
    px(ctx, 1, 2, PAL.midGray);
    px(ctx, 2, 2, PAL.lightGray);
    px(ctx, 3, 2, PAL.darkGray);
    px(ctx, 4, 2, PAL.lightGray);
    px(ctx, 2, 3, PAL.darkGray);
    px(ctx, 3, 3, PAL.midGray);
    px(ctx, 3, 4, PAL.lightGray);
    addTex(scene, 'stone_dust', canvas);
  }

  // ── 防水封护：水纹护罩环段 10×4 px格 ──
  {
    const W = 10, H = 4;
    const { canvas, ctx } = makeCanvas(W * PX, H * PX);
    pxRect(ctx, 0, 1, W, 2, PAL.midBlue);
    pxRect(ctx, 1, 0, W - 2, 4, PAL.lightBlue);
    pxRect(ctx, 2, 1, W - 4, 2, PAL.iceWhite);
    px(ctx, 1, 1, PAL.pureWhite);
    px(ctx, W - 2, 1, PAL.pureWhite);
    addTex(scene, 'water_shield', canvas);
  }

  // ── 防虫处理：药雾颗粒 5×5 px格 ──
  {
    const S = 5;
    const { canvas, ctx } = makeCanvas(S * PX, S * PX);
    px(ctx, 2, 1, PAL.lightGreen);
    px(ctx, 1, 2, PAL.midGreen);
    px(ctx, 2, 2, PAL.leafGreen);
    px(ctx, 3, 2, PAL.lightGreen);
    px(ctx, 2, 3, PAL.midGreen);
    px(ctx, 2, 0, '#AAFFAA');
    addTex(scene, 'insect_mist', canvas);
  }

  // ── 彩绘修复：颜料弹 8×8 px格 ──
  {
    const S = 8;
    const { canvas, ctx } = makeCanvas(S * PX, S * PX);
    const cx2 = 4, cy2 = 4;
    // 彩球
    const colorBands = ['#9966CC', '#CC88EE', '#FFCC44', '#88CCEE'];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 3) {
          const colorIdx = (dx + dy + 4) % 4;
          px(ctx, cx2 + dx, cy2 + dy, colorBands[colorIdx]);
        }
      }
    }
    // 高光
    px(ctx, cx2, cy2 - 1, PAL.warmWhite);
    // 拖尾（2px）
    px(ctx, cx2 - 1, cy2 + 2, PAL.gold);
    px(ctx, cx2 + 1, cy2 + 2, PAL.lightBlue);
    addTex(scene, 'paint_ball', canvas);
  }
}
