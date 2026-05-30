import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT, PALETTE } from './config';
import { genPixelButton } from './ArtGen';
import { loadSave, clearSave } from './SaveData';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  preload(): void {
    this.load.image('menu_bg_img', 'assets/menu_bg.jpg');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const d = 10;

    // ═══ 背景图 ═══
    if (this.textures.exists('menu_bg_img')) {
      const bgImg = this.add.image(cx, GAME_HEIGHT / 2, 'menu_bg_img')
        .setDepth(0)
        .setAlpha(0.35);
      // 背景淡入
      this.tweens.add({ targets: bgImg, alpha: 0.35, duration: 800 });
    }

    // 暗色遮罩
    const overlay = this.add.graphics();
    overlay.fillStyle(0x1A1410, 0.55);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setDepth(0.5);

    // 外框金边
    const frameG = this.add.graphics();
    frameG.lineStyle(2, 0xDAA520, 0.6);
    frameG.strokeRect(12, 12, GAME_WIDTH - 24, GAME_HEIGHT - 24);
    frameG.lineStyle(1, 0x5C3A1E, 0.4);
    frameG.strokeRect(20, 20, GAME_WIDTH - 40, GAME_HEIGHT - 40);
    frameG.setDepth(1);

    // 四角金饰
    const corners = [
      [20, 20], [GAME_WIDTH - 20, 20],
      [20, GAME_HEIGHT - 20], [GAME_WIDTH - 20, GAME_HEIGHT - 20],
    ];
    const cornerG = this.add.graphics();
    for (const [qx, qy] of corners) {
      cornerG.fillStyle(0xDAA520, 0.8);
      cornerG.fillRect(qx - 6, qy - 2, 8, 4);
      cornerG.fillRect(qx - 2, qy - 6, 4, 8);
      cornerG.fillStyle(0xFFD700, 1);
      cornerG.fillRect(qx - 1, qy - 1, 2, 2);
    }
    cornerG.setDepth(2);

    // ═══ 标题区域 ═══
    const titleY = 135;
    const bw = 440, bh = 72, bx = cx - bw / 2, by2 = titleY - bh / 2;
    const bannerG = this.add.graphics();
    bannerG.fillStyle(0x3E2510, 0.9);
    bannerG.fillRect(bx, by2, bw, bh);
    [0, 3, bh - 3, bh - 1].forEach((off, i) => {
      const shade = i < 2 ? 0xFFD700 : 0xDAA520;
      bannerG.fillStyle(shade, 1);
      bannerG.fillRect(bx, by2 + off, bw, i < 2 ? 1 : 2);
    });
    [0, bw - 1].forEach(ox => {
      bannerG.fillStyle(0xDAA520, 1);
      bannerG.fillRect(bx + ox, by2, 2, bh);
    });
    [16, bw - 20].forEach(dx => {
      bannerG.fillStyle(0xFFD700, 1);
      bannerG.fillRect(bx + dx, by2 + bh / 2 - 2, 2, 4);
      bannerG.fillRect(bx + dx - 1, by2 + bh / 2, 4, 2);
    });
    bannerG.setDepth(3);
    // 横幅飞入（从上方）
    bannerG.y = -80;
    bannerG.setAlpha(0);
    this.tweens.add({ targets: bannerG, y: 0, alpha: 1, duration: 600, delay: 100, ease: 'Back.easeOut' });

    // 标题文字
    const title = this.add.text(cx, titleY, '山西古建保卫战', {
      ...FONT.huge, color: PALETTE.BRIGHT_GOLD,
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(4).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 600, delay: 300 });

    // 副标题
    const sub = this.add.text(cx, titleY + 50, 'Shanxi  ·  Ancient Architecture Defense', {
      ...FONT.small, color: '#8A8A80',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(4).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 500, delay: 500 });

    // ═══ 古建展示 ═══
    const iconY = 290;
    if (this.textures.exists('building')) {
      const bld = this.add.image(cx, iconY, 'building').setDepth(3).setDisplaySize(96, 60);
      // 从左侧飞入
      bld.x = -60;
      bld.setAlpha(0);
      this.tweens.add({ targets: bld, x: cx, alpha: 1, duration: 700, delay: 400, ease: 'Back.easeOut' });

      const bFrame = this.add.graphics();
      bFrame.lineStyle(2, 0xDAA520, 0.7);
      bFrame.strokeRect(cx - 54, iconY - 36, 108, 72);
      bFrame.fillStyle(0xDAA520, 0.5);
      const fc = [[cx-54,iconY-36],[cx+54,iconY-36],[cx-54,iconY+36],[cx+54,iconY+36]];
      for (const [fx, fy] of fc) bFrame.fillRect(fx-3, fy-3, 6, 6);
      bFrame.setDepth(4).setAlpha(0);
      this.tweens.add({ targets: bFrame, alpha: 1, duration: 500, delay: 700 });
    }

    // ═══ 开始按钮 ═══
    const btnW = Math.ceil(240 / 2), btnH = Math.ceil(56 / 2);
    const btnKey = 'btn_menu_start';
    genPixelButton(this, btnKey, btnW, btnH, PALETTE.OAK_WOOD, PALETTE.BRIGHT_GOLD);

    const btnY = 395;
    const btnImg = this.add.image(0, btnY, btnKey + '_normal')
      .setDepth(4).setInteractive({ useHandCursor: true });
    // 从下方飞入
    btnImg.setAlpha(0);
    this.tweens.add({ targets: btnImg, x: cx, alpha: 1, duration: 600, delay: 600, ease: 'Back.easeOut' });

    const btnText = this.add.text(cx, btnY, '开  始  游  戏', {
      ...FONT.title, color: PALETTE.BRIGHT_GOLD,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5).setAlpha(0);
    this.tweens.add({ targets: btnText, alpha: 1, duration: 500, delay: 800 });

    btnImg.on('pointerover', () => { btnImg.setTexture(btnKey + '_hover'); btnText.setColor('#FFFFFF'); });
    btnImg.on('pointerout', () => { btnImg.setTexture(btnKey + '_normal'); btnText.setColor(PALETTE.BRIGHT_GOLD); });
    btnImg.on('pointerdown', () => { btnImg.setTexture(btnKey + '_press'); });
    btnImg.on('pointerup', () => {
      this.cameras.main.fadeOut(500, 26, 20, 16);
      this.time.delayedCall(550, () => {
        this.scene.start('TutorialScene');
      });
    });

    // 按钮脉冲
    this.tweens.add({ targets: btnText, alpha: 0.7, duration: 1000, yoyo: true, repeat: -1, delay: 1500 });

    // ═══ 操作说明 ═══
    const tipsY = 475;
    const tips = [
      'W A S D  移 动  ·  自 动 攻 击 + 技 能 自 动 释 放',
      '击 杀 怪 物 → 拾 取 经 验 → 升 级 选 择 技 能',
      '保 护 古 建 四 条 结 构 血 条  ·  坚 持 5 分 钟 即 可 获 胜',
    ];
    tips.forEach((line, i) => {
      const tip = this.add.text(cx, tipsY + i * 36, line, {
        ...FONT.body, color: PALETTE.PARCHMENT,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(3).setAlpha(0);
      this.tweens.add({ targets: tip, alpha: 1, duration: 500, delay: 800 + i * 150 });
    });

    // 菱形分隔线
    const sepY = tipsY + tips.length * 36 + 12;
    const sepG = this.add.graphics();
    sepG.fillStyle(0xDAA520, 0.4);
    sepG.fillRect(cx - 140, sepY, 280, 1);
    for (let dx2 = -120; dx2 <= 120; dx2 += 60) {
      sepG.fillStyle(0xDAA520, 0.6);
      sepG.fillRect(cx + dx2 - 1, sepY - 2, 2, 4);
    }
    sepG.setDepth(3).setAlpha(0);
    this.tweens.add({ targets: sepG, alpha: 1, duration: 500, delay: 1100 });

    // ═══ 最高纪录 ═══
    const save = loadSave();
    const recordY = sepY + 28;
    if (save.totalGames > 0) {
      const m2 = Math.floor(save.bestSurvivalTime / 60), s2 = Math.floor(save.bestSurvivalTime % 60);

      // 标题行
      const hsTitle = this.add.text(cx, recordY, '🏆 最 高 纪 录', {
        ...FONT.body, color: PALETTE.BRIGHT_GOLD,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(3).setAlpha(0);
      this.tweens.add({ targets: hsTitle, alpha: 1, duration: 500, delay: 1200 });

      // 详情行
      const hsLines = [
        `击杀 ${save.bestKillCount}  ·  存活 ${m2}:${s2.toString().padStart(2, '0')}  ·  Lv.${save.bestLevel}`,
        save.hasWon ? '✨ 已通关' : save.hasKilledBoss ? '⚔ 击败 Boss' : `共 ${save.totalGames} 场`,
      ];
      hsLines.forEach((line, i) => {
        const txt = this.add.text(cx, recordY + 24 + i * 22, line, {
          ...FONT.small, color: i === 0 ? '#E0D8C0' : '#9A9070',
          stroke: '#000000', strokeThickness: 1.5,
        }).setOrigin(0.5).setDepth(3).setAlpha(0);
        this.tweens.add({ targets: txt, alpha: 1, duration: 500, delay: 1300 + i * 100 });
      });
    }

    // ═══ 底部 ═══
    const footer = this.add.text(cx, GAME_HEIGHT - 30, '山西古建保护主题 · 肉鸽割草小游戏', {
      ...FONT.tiny, color: '#666666',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(3).setAlpha(0);
    this.tweens.add({ targets: footer, alpha: 1, duration: 500, delay: 1200 });

    // 左右装饰竖线
    const sideG = this.add.graphics();
    sideG.fillStyle(0x5C3A1E, 0.3);
    sideG.fillRect(8, 60, 2, GAME_HEIGHT - 120);
    sideG.fillRect(GAME_WIDTH - 10, 60, 2, GAME_HEIGHT - 120);
    sideG.setDepth(1).setAlpha(0);
    this.tweens.add({ targets: sideG, alpha: 1, duration: 600, delay: 300 });
  }
}
