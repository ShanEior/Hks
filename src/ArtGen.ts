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
  genUIAllTextures(scene);
}

// ═══════════════════════════════════════════════
// 夜雀食堂风格草皮生成器
// ═══════════════════════════════════════════════

/** 生成一张无缝草皮瓦片 (物理像素) */
function genGrassTile(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);

  // 夜雀食堂草皮调色板 (橄榄绿/棕主色调)
  const base = [
    [0x90,0x80,0x40],[0xb0,0xa0,0x60],[0x70,0x50,0x20],
    [0x90,0x90,0x20],[0x90,0x70,0x40],[0x60,0x80,0x30],
    [0x70,0x70,0x20],[0x50,0x40,0x10],
  ];
  // 权重累积
  const weights = [35,55,70,78,84,90,95,100];

  const hash = (x: number, y: number): number =>
    ((x * 374761393 + y * 668265263) ^ 0x5bf03635) >>> 0;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const h = hash(px, py);
      const r2 = h % 100;
      let cidx = 0;
      for (let w = 0; w < weights.length; w++) {
        if (r2 < weights[w]) { cidx = w; break; }
      }
      const color = base[cidx];
      // 低对比微调 (±3)
      const j = ((h % 7) - 3) | 0;
      const i = (py * size + px) * 4;
      img.data[i]     = Math.max(0, Math.min(255, color[0] + j));
      img.data[i + 1] = Math.max(0, Math.min(255, color[1] + j));
      img.data[i + 2] = Math.max(0, Math.min(255, color[2] + j));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 稀疏深色杂点 (3%密度，模拟碎石/草根)
  for (let i = 0; i < size * size * 0.03; i++) {
    const sx = hash(i, 99) % size;
    const sy = hash(88, i) % size;
    ctx.fillStyle = hash(sx, sy) & 1 ? '#504010' : '#403008';
    ctx.fillRect(sx, sy, 1 + (hash(sx,sy) & 1), 1 + (hash(sy,sx) & 1));
  }

  return c;
}

// ═══════════════════════════════════════════════
// 背景：山西古建草地 960×540 像素格（=1920×1080 物理px）
// 夜雀食堂风格草皮 + 古建装饰，树木由 GameScene PNG 精灵放置
// 全地图单张，不重复平铺
// ═══════════════════════════════════════════════

function genBackground(scene: Phaser.Scene) {
  const W = 960, H = 540;
  const { canvas, ctx } = makeCanvas(W * PX, H * PX);

  // ── 夜雀食堂风格草皮满铺 ──
  const grassTile = genGrassTile(128); // 128物理px = 64逻辑px
  const GT = 64; // 草皮瓦片逻辑尺寸
  for (let ty = 0; ty < H; ty += GT) {
    for (let tx = 0; tx < W; tx += GT) {
      ctx.drawImage(grassTile, tx * PX, ty * PX);
    }
  }

  const cx = W / 2, cy = H / 2;
  const hash = (x: number, y: number): number => ((x * 374761393 + y * 668265263) ^ 0x5bf03635) >>> 0;

  // ── 石板路（深色覆盖模拟路径） ──
  function drawStoneRoad(sx: number, sy: number, w: number, h: number): void {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (hash(sx+dx, sy+dy) % 3 === 0) {
          px(ctx, sx+dx, sy+dy, hash(sx+dx, sy+dy) & 1 ? '#9a8e7e' : '#7a6e62');
        }
      }
    }
  }
  drawStoneRoad(cx - 8, cy - 8, 16, H - cy + 8);
  drawStoneRoad(cx - 6, 0, 12, cy + 20);
  drawStoneRoad(0, cy - 6, cx + 20, 12);
  drawStoneRoad(cx - 20, cy - 7, W - cx + 20, 14);
  drawStoneRoad(cx - 70, cy + 60, 16, H - cy - 40);
  drawStoneRoad(cx + 40, cy + 80, 16, H - cy - 60);

  // ── 古建环境元素 ──
  // 调色板
  const sdDark = '#4E3E26';
  const stoneColors = ['#bca36f','#b6a078','#c5baab','#b0a690','#c3a98d',
    '#b5a997','#7f7361','#bfb5a0','#bdae97','#a69886','#b69d72','#998777'];
  const wTile   = '#6E6058'; // 灰瓦
  const wTileL  = '#7E7068'; // 灰瓦亮
  const wWood   = '#5A3828'; // 深棕木
  const wWoodL  = '#7A4A32'; // 暖棕木
  const wWall   = '#D4C098'; // 土黄墙
  const wWallD  = '#C0AC80'; // 土黄墙暗
  const wPillar = '#8B4A2A'; // 红棕柱
  const wStone  = '#9A8E7E'; // 石质灰
  const wStoneD = '#7A6E62'; // 石质暗
  const wGold   = '#B89840'; // 暗金

  // 地面阴影（椭圆暗区）
  function shadow(sx: number, sy: number, rw: number, rh: number): void {
    for (let dy = -rh; dy <= rh; dy++) {
      const w3 = Math.floor(rw * Math.sqrt(Math.max(0, 1 - (dy / rh) ** 2)));
      for (let dx = -w3; dx <= w3; dx++) {
        const qx = sx + dx, qy = sy + dy;
        if (qx < 0 || qx >= W || qy < 0 || qy >= H) continue;
        if (hash(qx, qy) % 3 > 0) continue; // 半透明效果
        px(ctx, qx, qy, sdDark);
      }
    }
  }

  // 矮围墙：灰砖 + 墙垛 + 局部破损
  function drawLowWall(x: number, y: number, len: number, h: number): void {
    // 墙身
    for (let wy = 0; wy < h - 2; wy++) {
      pxHLine(ctx, x, y + wy, len, wy % 3 === 0 ? wStone : wStoneD);
    }
    pxHLine(ctx, x, y + h - 2, len, wTile);       // 墙顶瓦
    pxHLine(ctx, x, y + h - 1, len, wTileL);       // 墙顶高光
    // 墙垛
    for (let dx = 2; dx < len - 2; dx += 10) {
      pxRect(ctx, x + dx, y - 2, 3, 3, wStone);
      px(ctx, x + dx + 1, y - 2, wStoneD);
    }
    // 随机破损缺口
    for (let dx = 0; dx < len; dx++) {
      if (hash(x + dx, y) % 25 === 0) {
        for (let dy2 = -1; dy2 <= 1; dy2++) {
          if (y + h - 3 + dy2 >= y && y + h - 3 + dy2 < y + h) {
            px(ctx, x + dx, y + h - 3 + dy2, sdDark);
          }
        }
      }
    }
  }

  // 小牌坊：双柱 + 横梁 + 小屋顶
  function drawSmallGate(gx: number, gy: number, s: number): void {
    const w = Math.floor(12 * s), h = Math.floor(20 * s);
    const lx = gx - Math.floor(w / 2), rx = gx + Math.floor(w / 2);
    const top = gy - h;
    // 柱
    pxRect(ctx, lx, top + 6, 2, h - 6, s > 1 ? wPillar : wWood);
    pxRect(ctx, rx - 2, top + 6, 2, h - 6, s > 1 ? wWood : wWoodL);
    px(ctx, lx, top + 6, wWoodL);  // 左柱高光
    // 横梁
    pxRect(ctx, lx - 1, top + 2, w + 2, 4, wWood);
    pxHLine(ctx, lx - 1, top + 2, w + 2, wWoodL);
    // 小屋顶
    pxRect(ctx, lx - 3, top - 2, w + 6, 4, wTile);
    pxRect(ctx, lx - 2, top - 1, w + 4, 1, wTileL);
    px(ctx, lx - 3, top - 2, wTileL); px(ctx, rx + 2, top - 2, wTileL);
  }

  // 小偏殿：墙体 + 木柱 + 灰瓦屋顶 + 微翘飞檐
  function drawSideHall(hx: number, hy: number, w: number, h: number, s: number): void {
    const lx = hx - Math.floor(w / 2);
    const top = hy - h;
    // 屋顶
    pxRect(ctx, lx - 3, top - 4, w + 6, 5, wTile);
    pxRect(ctx, lx - 2, top - 5, w + 4, 4, wTileL);
    pxHLine(ctx, lx - 3, top - 1, w + 6, '#4A3A30'); // 檐下阴影
    // 飞檐翘角
    px(ctx, lx - 4, top - 6, wTileL);
    px(ctx, lx + w + 3, top - 6, wTile);
    // 斗拱层
    for (let dx = lx; dx < lx + w; dx += 3) {
      pxRect(ctx, dx, top, 2, 2, wWood);
    }
    // 墙体
    for (let wy = 0; wy < h - 12; wy++) {
      pxHLine(ctx, lx + 1, top + 4 + wy, w - 2, wy % 5 === 0 ? wWallD : wWall);
    }
    // 木柱（两侧各一）
    pxRect(ctx, lx, top, 2, h - 6, s > 1 ? wPillar : wWood);
    pxRect(ctx, lx + w - 2, top, 2, h - 6, s > 1 ? wWood : wWoodL);
    px(ctx, lx, top + 2, wWoodL); // 柱高光
    // 门洞
    const doorX = hx - Math.floor(w / 6), doorW = Math.floor(w / 3);
    pxRect(ctx, doorX, top + h - 14, doorW, 10, '#2A1A10');
    pxRect(ctx, doorX + 1, top + h - 13, doorW - 2, 8, '#1A0E08');
  }

  // 石灯：底座 + 灯柱 + 灯龛
  function drawStoneLantern(lx: number, ly: number): void {
    // 底座
    pxRect(ctx, lx - 3, ly - 2, 7, 3, wStoneD);
    pxRect(ctx, lx - 2, ly - 3, 5, 2, wStone);
    // 柱身
    pxVLine(ctx, lx, ly - 9, 7, wStone);
    px(ctx, lx - 1, ly - 8, wStone); // 宽一点
    // 灯龛
    pxRect(ctx, lx - 2, ly - 12, 5, 4, wStone);
    pxRect(ctx, lx - 1, ly - 12, 3, 3, '#FFE8B0'); // 烛光
    px(ctx, lx, ly - 12, '#FFF0D0');               // 焰心
    // 灯顶
    pxRect(ctx, lx - 3, ly - 13, 7, 2, wStone);
    px(ctx, lx - 2, ly - 14, wStone);
    px(ctx, lx + 1, ly - 14, wStone);
  }

  // 石碑：底座 + 碑身 + 碑额
  function drawStele(sx: number, sy: number, h: number): void {
    const halfW = 3;
    // 底座（龟趺简化）
    pxRect(ctx, sx - halfW - 1, sy - 2, halfW * 2 + 3, 3, wStoneD);
    pxRect(ctx, sx - halfW, sy - 4, halfW * 2 + 1, 3, wStone);
    // 碑身
    for (let dy = 0; dy < h; dy++) {
      pxHLine(ctx, sx - halfW + 1, sy - 4 - h + dy, halfW * 2 - 1, dy % 3 === 0 ? wStone : wStoneD);
    }
    // 碑额（圆顶）
    const top = sy - 4 - h;
    pxRect(ctx, sx - halfW, top - 2, halfW * 2 + 1, 3, wStone);
    px(ctx, sx - 1, top - 3, wStone);
    px(ctx, sx, top - 3, wStoneD);
  }

  // 香炉：炉身 + 三足 + 烟
  function drawIncenseBurner(ix: number, iy: number): void {
    // 炉身
    pxRect(ctx, ix - 4, iy - 6, 9, 7, wWood);
    pxRect(ctx, ix - 3, iy - 5, 7, 5, wWoodL);
    // 炉口
    pxRect(ctx, ix - 5, iy - 7, 11, 2, wStoneD);
    pxRect(ctx, ix - 4, iy - 8, 9, 1, wStone);
    // 三足
    pxRect(ctx, ix - 3, iy, 2, 2, wStoneD);
    pxRect(ctx, ix + 1, iy, 2, 2, wStoneD);
    // 双耳
    pxRect(ctx, ix - 5, iy - 4, 2, 3, wStoneD);
    pxRect(ctx, ix + 3, iy - 4, 2, 3, wStoneD);
    // 烟
    for (let s = 0; s < 2; s++) {
      for (let j = 0; j < 5; j++) {
        const sx2 = ix - 1 + s * 3 + (j % 2);
        const sy2 = iy - 10 - j * 3;
        if (sy2 > 0) px(ctx, sx2, sy2, j < 2 ? '#CCC' : '#DDD');
      }
    }
  }

  // 石板路：连点成线
  function drawStonePath(points: [number,number][], pw: number): void {
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1];
      const segLen = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
      for (let s = 0; s < segLen; s++) {
        const t = s / segLen;
        const qx = Math.floor(x1 + (x2-x1) * t);
        const qy = Math.floor(y1 + (y2-y1) * t);
        for (let dw = -pw/2; dw < pw/2; dw++) {
          for (let dh = -1; dh <= 1; dh++) {
            const rx = qx + Math.floor(dw), ry = qy + dh;
            if (rx<0||rx>=W||ry<0||ry>=H) continue;
            if (hash(rx,ry) % 5 < 3) px(ctx, rx, ry, stoneColors[hash(rx,ry)%stoneColors.length]);
          }
        }
      }
    }
  }
  function drawWell(wx:number,wy:number):void{
    for(let dy=-2;dy<=2;dy++)for(let dx=-3;dx<=3;dx++)
      if(Math.abs(dx)+Math.abs(dy)<=4)px(ctx,wx+dx,wy+dy,wStoneD);
    pxRect(ctx,wx-2,wy-3,5,1,wStone);pxRect(ctx,wx-3,wy-2,1,4,wStone);
    pxRect(ctx,wx-5,wy-12,2,10,wWood);pxRect(ctx,wx+3,wy-12,2,10,wWood);
    pxRect(ctx,wx-6,wy-13,12,2,wWood);
    pxRect(ctx,wx-2,wy-10,4,3,wWoodL);
  }
  function drawSmallPagoda(px2:number,py:number,s:number):void{
    const lw=[6,5,4],lh=[10,8,7];let ty=py;
    for(let l=0;l<3;l++){
      const w2=Math.floor(lw[l]*s),h2=Math.floor(lh[l]*s),lx2=px2-w2;
      for(let dy=0;dy<h2;dy++)pxHLine(ctx,lx2,ty-dy,w2*2,dy%4===0?wStone:wStoneD);
      pxRect(ctx,lx2-1,ty-h2,w2*2+2,2,wTile);
      px(ctx,lx2-1,ty-h2,wTileL);px(ctx,lx2+w2*2,ty-h2,wTile);
      ty-=h2+1;
    }
    pxVLine(ctx,px2,ty-4,5,wWood);pxRect(ctx,px2-2,ty-5,5,3,wGold);px(ctx,px2,ty-6,'#FFE8B0');
  }

  // ═══ 石板路网 ═══
  const plazaR=40;
  for(let dy=-plazaR;dy<plazaR;dy++)for(let dx=-plazaR;dx<plazaR;dx++)
    if(Math.abs(dx)+Math.abs(dy)<plazaR&&hash(cx+dx,cy+dy)%5<3)
      px(ctx,cx+dx,cy+dy,stoneColors[hash(cx+dx,cy+dy)%stoneColors.length]);
  drawStonePath([[cx,cy],[cx,490] as any],12);
  drawStonePath([[cx,cy],[cx,50] as any],10);
  drawStonePath([[cx,cy],[10,cy] as any],10);
  drawStonePath([[cx,cy],[890,cy] as any],11);
  drawStonePath([[cx-80,cy+60],[80,330] as any],6);
  drawStonePath([[cx+80,cy+60],[W-90,325] as any],6);
  drawStonePath([[cx-60,cy-50],[120,258] as any],5);
  drawStonePath([[80,330],[120,258] as any],5);
  drawStonePath([[W-90,325],[W-55,455] as any],5);
  drawStonePath([[80,330],[65,475] as any],5);
  drawStonePath([[cx-40,cy+80],[110,425] as any],5);
  drawStonePath([[cx+50,cy+90],[W-140,415] as any],5);

  // ═══ 布局放置 ═══

  // ── 远景层（y:120-200, 淡, 0.6-0.8x） ──
  drawLowWall(50,148,70,5);shadow(85,153,38,5);
  drawLowWall(W-140,142,100,5);shadow(W-90,147,52,5);
  drawLowWall(300,138,40,5);shadow(320,143,22,5);
  shadow(160,140,12,8);drawSmallGate(160,140,0.7);
  shadow(W-110,152,18,10);drawSideHall(W-110,152,20,24,0.7);
  drawStele(70,162,6);shadow(70,162,4,3);
  drawStele(350,155,5);shadow(350,155,4,3);
  shadow(400,148,12,8);drawSmallPagoda(400,148,0.6);
  shadow(200,165,14,10);drawSmallGate(200,165,0.7);
  shadow(280,170,8,6);drawWell(280,170);

  // ── 中景层（y:250-360, 正常, 0.9-1.0x） ──
  shadow(120,258,14,10);drawSmallGate(120,258,1.0);
  drawLowWall(25,275,65,6);shadow(58,281,35,5);
  drawLowWall(W-140,285,95,6);shadow(W-93,291,50,5);
  drawLowWall(300,270,55,6);shadow(328,276,30,5);
  shadow(80,322,26,16);drawSideHall(80,322,28,32,1.0);
  shadow(W-90,318,22,14);drawSideHall(W-90,318,24,28,0.9);
  shadow(340,300,16,12);drawSideHall(340,300,18,22,0.85);
  shadow(180,280,12,8);drawSmallGate(180,280,0.85);
  drawStele(50,310,8);shadow(50,310,5,4);
  drawStele(W-50,305,7);shadow(W-50,305,5,3);
  drawStele(320,290,6);shadow(320,290,4,3);
  shadow(250,340,10,8);drawWell(250,340);
  shadow(160,345,8,6);drawIncenseBurner(160,345);
  shadow(420,320,6,4);drawStoneLantern(420,320);
  shadow(460,335,12,8);drawSmallPagoda(460,335,0.7);
  shadow(30,350,18,12);drawSmallGate(30,350,0.8);

  // ── 近景层（y:380-510, 深, 1.0-1.2x） ──
  shadow(50,395,6,4);drawStoneLantern(50,395);
  shadow(W-60,390,6,4);drawStoneLantern(W-60,390);
  shadow(200,385,6,4);drawStoneLantern(200,385);
  shadow(400,385,6,4);drawStoneLantern(400,385);
  shadow(110,425,8,6);drawIncenseBurner(110,425);
  shadow(W-140,415,5,4);drawStele(W-140,415,9);
  shadow(300,410,5,4);drawStele(300,410,8);
  shadow(450,420,5,3);drawStele(450,420,7);
  drawLowWall(W-110,435,80,7);shadow(W-70,442,42,6);
  drawLowWall(15,455,60,6);shadow(45,461,32,5);
  drawLowWall(350,445,55,6);shadow(378,451,30,5);
  shadow(W-55,455,28,20);drawSideHall(W-55,455,30,38,1.1);
  shadow(65,475,14,10);drawSmallGate(65,475,0.95);
  shadow(330,470,16,12);drawSmallGate(330,470,0.9);
  shadow(250,490,10,8);drawWell(250,490);
  shadow(420,480,8,6);drawIncenseBurner(420,480);
  shadow(480,465,6,4);drawStoneLantern(480,465);
  shadow(15,500,18,14);drawSideHall(15,500,20,26,1.0);
  shadow(500,500,18,14);drawSideHall(500,500,20,26,1.0);
  shadow(170,505,8,6);drawIncenseBurner(170,505);
  shadow(W-200,500,8,6);drawIncenseBurner(W-200,500);
  shadow(380,510,12,8);drawSmallGate(380,510,0.85);
  shadow(580,495,6,4);drawStoneLantern(580,495);


  // ── 7. 底部暗角 ──
  for (let gy = H - 20; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      if (hash(gx, gy) % 5 === 0) {
        px(ctx, gx, gy, sdDark);
      }
    }
  }

  // ── 8. 四角聚焦暗角 ──
  const corners = [[0,0],[W-1,0],[0,H-1],[W-1,H-1]];
  for (const [cx2, cy2] of corners) {
    for (let dy = 0; dy < 50; dy++) {
      for (let dx = 0; dx < 50; dx++) {
        const qx = cx2 === 0 ? dx : W - 1 - dx;
        const qy = cy2 === 0 ? dy : H - 1 - dy;
        if (Math.sqrt(dx*dx + dy*dy) < 40 && hash(qx, qy) % 6 === 0) {
          px(ctx, qx, qy, sdDark);
        }
      }
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

// ═══════════════════════════════════════════════
// UI 纹理 — 像素风面板和按钮（Canvas2D 程序化）
// ═══════════════════════════════════════════════

/** 装饰面板：深色底 + 金色边框 + 四角花纹 */
export function genOrnatePanel(
  scene: Phaser.Scene, key: string,
  w: number, h: number,
  borderColor: string, bgColor: string,
): void {
  if (scene.textures.exists(key)) return;
  const { canvas, ctx } = makeCanvas(w * PX, h * PX);
  // 背景
  pxRect(ctx, 0, 0, w, h, bgColor);
  // 边框
  pxRect(ctx, 0, 0, w, 1, borderColor);
  pxRect(ctx, 0, h - 1, w, 1, borderColor);
  pxRect(ctx, 0, 0, 1, h, borderColor);
  pxRect(ctx, w - 1, 0, 1, h, borderColor);
  // 内框
  pxRect(ctx, 2, 2, w - 4, 1, borderColor);
  pxRect(ctx, 2, h - 3, w - 4, 1, borderColor);
  pxRect(ctx, 2, 2, 1, h - 4, borderColor);
  pxRect(ctx, w - 3, 2, 1, h - 4, borderColor);
  // 四角装饰
  px(ctx, 1, 1, borderColor);
  px(ctx, w - 2, 1, borderColor);
  px(ctx, 1, h - 2, borderColor);
  px(ctx, w - 2, h - 2, borderColor);
  addTex(scene, key, canvas);
}

/** 像素按钮：暖棕底 + 金色边框 + 悬停高亮 */
export function genPixelButton(
  scene: Phaser.Scene, key: string,
  w: number, h: number,
  bgColor: string, borderColor: string,
): void {
  // 正常态
  {
    const { canvas, ctx } = makeCanvas(w * PX, h * PX);
    pxRect(ctx, 0, 0, w, h, bgColor);
    pxRect(ctx, 0, 0, w, 1, borderColor);
    pxRect(ctx, 0, h - 1, w, 1, borderColor);
    pxRect(ctx, 0, 0, 1, h, borderColor);
    pxRect(ctx, w - 1, 0, 1, h, borderColor);
    pxRect(ctx, 1, 1, w - 2, 1, '#00000022');
    pxRect(ctx, 1, h - 2, w - 2, 1, '#00000044');
    addTex(scene, key + '_normal', canvas);
  }
  // 悬停态（更亮）
  {
    const { canvas, ctx } = makeCanvas(w * PX, h * PX);
    const lighter = bgColor; // 简化：颜色由外部控制
    pxRect(ctx, 0, 0, w, h, lighter);
    pxRect(ctx, 0, 0, w, 1, '#FFFFFF');
    pxRect(ctx, 0, h - 1, w, 1, '#FFFFFF');
    pxRect(ctx, 0, 0, 1, h, '#FFFFFF');
    pxRect(ctx, w - 1, 0, 1, h, '#FFFFFF');
    addTex(scene, key + '_hover', canvas);
  }
  // 按压态
  {
    const { canvas, ctx } = makeCanvas(w * PX, h * PX);
    const darker = '#2D1B0E';
    pxRect(ctx, 0, 0, w, h, darker);
    pxRect(ctx, 0, 0, w, 1, '#B8960A');
    pxRect(ctx, 0, h - 1, w, 1, '#B8960A');
    pxRect(ctx, 0, 0, 1, h, '#B8960A');
    pxRect(ctx, w - 1, 0, 1, h, '#B8960A');
    addTex(scene, key + '_press', canvas);
  }
}

// ═══════════════════════════════════
// 像素框架
// ═══════════════════════════════════

function genPixelFrame(scene: Phaser.Scene, key: string, w: number, h: number, borderColor: string, bgColor: string): void {
  if (scene.textures.exists(key)) return;
  const { canvas, ctx } = makeCanvas(w * PX, h * PX);
  pxRect(ctx, 0, 0, w, h, bgColor);
  pxRect(ctx, 0, 0, 2, 2, borderColor); pxRect(ctx, w - 2, 0, 2, 2, borderColor);
  pxRect(ctx, 0, h - 2, 2, 2, borderColor); pxRect(ctx, w - 2, h - 2, 2, 2, borderColor);
  pxHLine(ctx, 2, 0, w - 4, borderColor); pxHLine(ctx, 2, h - 1, w - 4, borderColor);
  pxVLine(ctx, 0, 2, h - 4, borderColor); pxVLine(ctx, w - 1, 2, h - 4, borderColor);
  addTex(scene, key, canvas);
}

// ═══════════════════════════════════
// 血条底板 — 带刻度标记
// ═══════════════════════════════════

function genBarBg(scene: Phaser.Scene, key: string, w: number, h: number, bgColor: string, borderColor: string, notchColor: string): void {
  const { canvas, ctx } = makeCanvas(w * PX, h * PX);
  pxRect(ctx, 0, 0, w, h, bgColor);
  pxHLine(ctx, 0, 0, w, borderColor); pxHLine(ctx, 0, h - 1, w, borderColor);
  pxVLine(ctx, 0, 0, h, borderColor); pxVLine(ctx, w - 1, 0, h, borderColor);
  px(ctx, 0, 0, borderColor); px(ctx, w - 1, 0, borderColor);
  px(ctx, 0, h - 1, borderColor); px(ctx, w - 1, h - 1, borderColor);
  for (const mx of [Math.floor(w * 0.25), Math.floor(w * 0.5), Math.floor(w * 0.75)]) {
    px(ctx, mx, 1, notchColor); px(ctx, mx, h - 2, notchColor);
  }
  addTex(scene, key, canvas);
}

// ═══════════════════════════════════
// 血条填充 — 带顶/底高光
// ═══════════════════════════════════

function genBarFill(scene: Phaser.Scene, key: string, w: number, h: number, fillColor: string): void {
  const { canvas, ctx } = makeCanvas(w * PX, h * PX);
  pxRect(ctx, 0, 0, w, h, fillColor);
  const r = parseInt(fillColor.slice(1, 3), 16), g = parseInt(fillColor.slice(3, 5), 16), b = parseInt(fillColor.slice(5, 7), 16);
  pxHLine(ctx, 0, 0, w, `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)})`);
  pxHLine(ctx, 0, h - 1, w, `rgb(${Math.max(0, r - 50)},${Math.max(0, g - 50)},${Math.max(0, b - 50)})`);
  addTex(scene, key, canvas);
}

// ═══════════════════════════════════
// 经验条外框
// ═══════════════════════════════════

function genExpBarFrame(scene: Phaser.Scene): void {
  const w = 1000, h = 14, b = '#8A8A80';
  const { canvas, ctx } = makeCanvas(w * PX, h * PX);
  pxRect(ctx, 0, 0, w, h, '#1A1410');
  pxHLine(ctx, 0, 0, w, b); pxHLine(ctx, 0, h - 1, w, b);
  pxVLine(ctx, 0, 0, h, b); pxVLine(ctx, w - 1, 0, h, b);
  for (const dx of [0, w - 1]) { px(ctx, dx, 0, '#DAA520'); px(ctx, dx, h - 1, '#DAA520'); }
  for (const dx of [2, w - 6]) { px(ctx, dx, h / 2 - 1, '#DAA520'); px(ctx, dx + 1, h / 2, '#DAA520'); px(ctx, dx, h / 2 + 1, '#DAA520'); }
  addTex(scene, 'exp_bar_frame', canvas);
}

// ═══════════════════════════════════
// 计时面板
// ═══════════════════════════════════

function genTimerPanel(scene: Phaser.Scene): void {
  genPixelFrame(scene, 'timer_panel', 80, 28, '#DAA520', '#1E1810');
}

// ═══════════════════════════════════
// 像素图标（12×12 像素格 = 24×24 物理px）
// ═══════════════════════════════════

function genIconStructWood(scene: Phaser.Scene): void {
  const S = 12; const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  pxRect(ctx, 1, 1, 10, 10, '#C4884D');
  pxHLine(ctx, 1, 3, 10, '#B0783D'); pxHLine(ctx, 1, 6, 10, '#D4985D'); pxHLine(ctx, 1, 9, 10, '#B0783D');
  px(ctx, 5, 5, '#8B6914'); px(ctx, 7, 4, '#8B6914');
  pxHLine(ctx, 0, 0, S, '#5C3A1E'); pxHLine(ctx, 0, S - 1, S, '#5C3A1E');
  pxVLine(ctx, 0, 0, S, '#5C3A1E'); pxVLine(ctx, S - 1, 0, S, '#5C3A1E');
  addTex(scene, 'icon_wood', canvas);
}

function genIconStructStone(scene: Phaser.Scene): void {
  const S = 12; const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  pxRect(ctx, 1, 1, 10, 10, '#8A8A80');
  pxHLine(ctx, 1, 5, 10, '#999990'); pxVLine(ctx, 5, 1, 4, '#777770'); pxVLine(ctx, 3, 5, 5, '#777770');
  px(ctx, 4, 4, '#AAAAA0'); px(ctx, 8, 7, '#AAAAA0');
  pxHLine(ctx, 0, 0, S, '#555550'); pxHLine(ctx, 0, S - 1, S, '#555550');
  pxVLine(ctx, 0, 0, S, '#555550'); pxVLine(ctx, S - 1, 0, S, '#555550');
  addTex(scene, 'icon_stone', canvas);
}

function genIconStructTile(scene: Phaser.Scene): void {
  const S = 12; const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  pxRect(ctx, 1, 1, 10, 10, '#C04040');
  for (let r = 0; r < 3; r++) {
    const ry = 2 + r * 3; pxHLine(ctx, 2, ry, 8, '#8B2020'); pxHLine(ctx, 2, ry + 1, 8, '#D06050');
  }
  pxHLine(ctx, 0, 0, S, '#6B1010'); pxHLine(ctx, 0, S - 1, S, '#6B1010');
  pxVLine(ctx, 0, 0, S, '#6B1010'); pxVLine(ctx, S - 1, 0, S, '#6B1010');
  addTex(scene, 'icon_tile', canvas);
}

function genIconStructPainting(scene: Phaser.Scene): void {
  const S = 12; const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  pxRect(ctx, 1, 1, 10, 10, '#9966CC');
  pxHLine(ctx, 1, 2, 10, '#CC88EE'); pxHLine(ctx, 1, 4, 10, '#FFCC44');
  pxHLine(ctx, 1, 6, 10, '#88CCEE'); pxHLine(ctx, 1, 8, 10, '#FF8888');
  px(ctx, 3, 3, '#FFFFFF'); px(ctx, 8, 5, '#FFFFFF');
  pxHLine(ctx, 0, 0, S, '#553388'); pxHLine(ctx, 0, S - 1, S, '#553388');
  pxVLine(ctx, 0, 0, S, '#553388'); pxVLine(ctx, S - 1, 0, S, '#553388');
  addTex(scene, 'icon_painting', canvas);
}

function genIconTimer(scene: Phaser.Scene): void {
  const S = 10; const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  pxRect(ctx, 3, 1, 4, 1, '#DAA520'); pxRect(ctx, 2, 2, 6, 1, '#DAA520');
  pxRect(ctx, 2, 3, 2, 2, '#DAA520'); pxRect(ctx, 6, 3, 2, 2, '#DAA520');
  pxRect(ctx, 3, 4, 4, 1, '#8A8A80');
  pxRect(ctx, 2, 5, 2, 2, '#DAA520'); pxRect(ctx, 6, 5, 2, 2, '#DAA520');
  pxRect(ctx, 2, 7, 6, 1, '#DAA520'); pxRect(ctx, 3, 8, 4, 1, '#DAA520');
  px(ctx, 4, 4, '#FFD700');
  addTex(scene, 'icon_timer', canvas);
}

function genIconClose(scene: Phaser.Scene): void {
  const S = 8; const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  for (const [x, y] of [[1,1],[6,1],[2,2],[5,2],[3,3],[4,3],[3,4],[4,4],[2,5],[5,5],[1,6],[6,6]]) px(ctx, x, y, '#C04040');
  addTex(scene, 'icon_close', canvas);
}

function genIconDiamond(scene: Phaser.Scene): void {
  const S = 6; const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  px(ctx, 3, 0, '#FFD700'); px(ctx, 2, 1, '#FFD700'); px(ctx, 4, 1, '#FFD700');
  px(ctx, 1, 2, '#DAA520'); px(ctx, 3, 2, '#FFD700'); px(ctx, 5, 2, '#DAA520');
  px(ctx, 2, 3, '#DAA520'); px(ctx, 4, 3, '#DAA520'); px(ctx, 3, 4, '#DAA520');
  addTex(scene, 'icon_diamond', canvas);
}

function genIconExp(scene: Phaser.Scene): void {
  const S = 8, cx = 4, cy = 4; const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  px(ctx, cx, cy - 3, '#44FF88'); px(ctx, cx - 1, cy - 2, '#44FF88'); px(ctx, cx + 1, cy - 2, '#44FF88');
  px(ctx, cx - 2, cy - 1, '#44CC66'); px(ctx, cx, cy - 1, '#FFFFFF'); px(ctx, cx + 2, cy - 1, '#44CC66');
  px(ctx, cx - 2, cy, '#44CC66'); px(ctx, cx + 2, cy, '#44CC66');
  px(ctx, cx - 1, cy + 1, '#44FF88'); px(ctx, cx + 1, cy + 1, '#44FF88'); px(ctx, cx, cy + 2, '#44FF88');
  addTex(scene, 'icon_exp', canvas);
}

// ═══════════════════════════════════
// 菜单背景 + 柱子 + 标题横幅
// ═══════════════════════════════════

function genMenuBg(scene: Phaser.Scene): void {
  const W = 512, H = 384; const { canvas, ctx } = makeCanvas(W * PX, H * PX);
  pxRect(ctx, 0, 0, W, H, '#1A1410');
  for (let i = 0; i < 1200; i++) px(ctx, Math.floor(Math.random() * W), Math.floor(Math.random() * H), ['#2A1A10','#2A2018','#221810','#1E1810'][i % 4]);
  const m = 4;
  pxHLine(ctx, 0, 0, W, '#DAA520'); pxHLine(ctx, 0, H - 1, W, '#DAA520');
  pxVLine(ctx, 0, 0, H, '#DAA520'); pxVLine(ctx, W - 1, 0, H, '#DAA520');
  pxHLine(ctx, m, m, W - m * 2, '#5C3A1E'); pxHLine(ctx, m, H - m - 1, W - m * 2, '#5C3A1E');
  pxVLine(ctx, m, m, H - m * 2, '#5C3A1E'); pxVLine(ctx, W - m - 1, m, H - m * 2, '#5C3A1E');
  for (const [cx, cy] of [[m,m],[W-m-1,m],[m,H-m-1],[W-m-1,H-m-1]]) { px(ctx, cx, cy, '#FFD700'); px(ctx, cx+1, cy, '#DAA520'); px(ctx, cx, cy+1, '#DAA520'); }
  addTex(scene, 'menu_bg', canvas);
}

function genPillar(scene: Phaser.Scene): void {
  const w = 16, h = 768; const { canvas, ctx } = makeCanvas(w * PX, h * PX);
  pxRect(ctx, 0, 0, w, h, '#C04040');
  for (let y = 0; y < h; y += 3) pxHLine(ctx, 1, y, w - 2, y % 6 === 0 ? '#D05050' : '#B03030');
  pxRect(ctx, 2, h - 12, w - 4, 12, '#8A8A80'); pxRect(ctx, 3, h - 14, w - 6, 3, '#999990');
  pxRect(ctx, 2, 0, w - 4, 14, '#8A8A80'); pxRect(ctx, 3, 12, w - 6, 3, '#999990');
  pxHLine(ctx, 2, 5, w - 4, '#FFD700'); pxHLine(ctx, 2, 8, w - 4, '#FFD700');
  pxVLine(ctx, 3, 14, h - 28, '#DAA520');
  addTex(scene, 'pillar', canvas);
}

function genTitleBanner(scene: Phaser.Scene): void {
  const w = 420, h = 60; const { canvas, ctx } = makeCanvas(w * PX, h * PX);
  pxRect(ctx, 0, 0, w, h, '#3E2510');
  for (let i = 0; i < 3; i++) { pxHLine(ctx, 0, i, w, ['#FFD700','#DAA520','#B8960A'][i]); pxHLine(ctx, 0, h-1-i, w, ['#FFD700','#DAA520','#B8960A'][i]); }
  pxVLine(ctx, 0, 0, h, '#DAA520'); pxVLine(ctx, w - 1, 0, h, '#DAA520');
  for (const dx of [12, w - 16]) { px(ctx, dx, h/2-1, '#FFD700'); px(ctx, dx+1, h/2, '#FFD700'); px(ctx, dx, h/2+1, '#FFD700'); }
  addTex(scene, 'title_banner', canvas);
}

function genPixelBorder16(scene: Phaser.Scene): void {
  const S = 16, bc = '#DAA520'; const { canvas, ctx } = makeCanvas(S * PX, S * PX);
  pxRect(ctx, 0, 0, S, S, '#1E1810');
  pxRect(ctx, 0, 0, 2, 2, bc); pxRect(ctx, S-2, 0, 2, 2, bc); pxRect(ctx, 0, S-2, 2, 2, bc); pxRect(ctx, S-2, S-2, 2, 2, bc);
  pxHLine(ctx, 2, 0, S-4, bc); pxHLine(ctx, 2, S-1, S-4, bc); pxVLine(ctx, 0, 2, S-4, bc); pxVLine(ctx, S-1, 2, S-4, bc);
  addTex(scene, 'pixel_border', canvas);
}

// ═══════════════════════════════════
// 怪物血条
// ═══════════════════════════════════

function genHPBarMonster(scene: Phaser.Scene): void {
  { const w = 20, h = 4; const { canvas, ctx } = makeCanvas(w * PX, h * PX);
    pxRect(ctx, 0, 0, w, h, '#333333'); pxHLine(ctx, 0, 0, w, '#555555'); pxHLine(ctx, 0, h - 1, w, '#111111');
    addTex(scene, 'hp_monster_bg', canvas); }
  { const w = 20, h = 4; const { canvas, ctx } = makeCanvas(w * PX, h * PX);
    pxRect(ctx, 0, 0, w, h, '#44CC44'); pxHLine(ctx, 0, 0, w, '#88EE88');
    addTex(scene, 'hp_monster_fill', canvas); }
}

// ═══════════════════════════════════
// UI 总入口
// ═══════════════════════════════════

function genUIAllTextures(scene: Phaser.Scene): void {
  genBarBg(scene, 'bar_bg', 130, 16, '#2A2218', '#5C3A1E', '#3E2510');
  genBarFill(scene, 'bar_fill_wood', 130, 16, '#C4884D');
  genBarFill(scene, 'bar_fill_stone', 130, 16, '#8A8A80');
  genBarFill(scene, 'bar_fill_tile', 130, 16, '#C04040');
  genBarFill(scene, 'bar_fill_painting', 130, 16, '#9966CC');
  genBarFill(scene, 'bar_fill_exp', 1000, 14, '#DAA520');
  genExpBarFrame(scene);
  genTimerPanel(scene);
  genPixelBorder16(scene);
  genIconStructWood(scene); genIconStructStone(scene); genIconStructTile(scene); genIconStructPainting(scene);
  genIconTimer(scene); genIconClose(scene); genIconDiamond(scene); genIconExp(scene);
  genMenuBg(scene); genPillar(scene); genTitleBanner(scene);
  genHPBarMonster(scene);
}
