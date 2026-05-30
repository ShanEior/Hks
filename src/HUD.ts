import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, StructureType, SkillId, SKILL_CONFIGS, FONT, PALETTE, STRUCT_BAR, LEVELUP_CARD, MonsterType } from './config';
import { Player } from './Player';
import { Building } from './Building';
import { genOrnatePanel, genPixelButton } from './ArtGen';

interface StructBar {
  type: StructureType;
  bg: Phaser.GameObjects.Image;
  fill: Phaser.GameObjects.Image;
  hpText: Phaser.GameObjects.Text;
}

interface LevelUpOption {
  id: SkillId;
  name: string;
  level: number;
  isUpgrade: boolean;
  description: string;
}

export class HUD {
  scene: Phaser.Scene;

  // 4 条古建结构血条
  private structBars: StructBar[] = [];

  // 倒计时
  private timerText!: Phaser.GameObjects.Text;

  // 经验条
  private expBg!: Phaser.GameObjects.Image;
  private expFill!: Phaser.GameObjects.Image;
  private expLabel!: Phaser.GameObjects.Text;

  // 升级面板（动态创建/销毁）
  private levelUpElements: Phaser.GameObjects.GameObject[] = [];
  // 技能弹窗
  private popupElements: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createStructureBars();
    this.createTimer();
    this.createExpBar();
  }

  // ── 4 条古建血条（屏幕左侧竖排，紧凑像素风） ──
  private createStructureBars(): void {
    const types: StructureType[] = ['wood', 'stone', 'tile', 'painting'];
    const icons = ['icon_wood', 'icon_stone', 'icon_tile', 'icon_painting'];
    const fillKeys = ['bar_fill_wood', 'bar_fill_stone', 'bar_fill_tile', 'bar_fill_painting'];
    const barW = 130, barH = 16, gap = 6;
    const y = 12; // 起始 Y
    const depth = 102;
    const leftX = 14;

    types.forEach((type, i) => {
      const by = y + i * (barH + gap);

      // 血条底板（像素纹理）
      const bg = this.scene.add.image(leftX, by, 'bar_bg')
        .setOrigin(0, 0).setScrollFactor(0).setDepth(100);
      // 填充
      const fill = this.scene.add.image(leftX, by, fillKeys[i])
        .setOrigin(0, 0).setScrollFactor(0).setDepth(101);
      // 像素图标
      this.scene.add.image(leftX + 8, by + barH / 2, icons[i])
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(depth).setDisplaySize(12, 12);
      // 标签
      this.scene.add.text(leftX + 24, by + barH / 2, type === 'wood' ? '木' : type === 'stone' ? '石' : type === 'tile' ? '瓦' : '绘',
        { ...FONT.body, color: '#FFFFFF', stroke: '#000000', strokeThickness: 3 })
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(depth);
      // HP 数值（右对齐）
      const hpText = this.scene.add.text(leftX + barW - 6, by + barH / 2, '',
        { ...FONT.body, color: '#FFFFFF', stroke: '#000000', strokeThickness: 3 })
        .setOrigin(1, 0.5).setScrollFactor(0).setDepth(depth);

      this.structBars.push({ type, bg, fill, hpText });
    });
  }

  // ── 倒计时（右上，不再溢出） ──
  private timerPanelBg!: Phaser.GameObjects.Image;

  private createTimer(): void {
    // 计时面板 80px 格宽 = 160 物理px，贴在右边缘留 8px margin
    const panelCenterX = GAME_WIDTH - 88;
    const py = 18;
    this.timerPanelBg = this.scene.add.image(panelCenterX, py, 'timer_panel')
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
    // 沙漏图标
    this.scene.add.image(panelCenterX - 28, py + 14, 'icon_timer')
      .setScrollFactor(0).setDepth(102).setDisplaySize(14, 14);
    // 倒计时文字
    this.timerText = this.scene.add.text(panelCenterX + 2, py + 14, '5:00',
      { ...FONT.large, color: '#FFFFFF' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(102);
  }

  // ── 经验条（底部全宽，金色像素风格） ──
  private expIcon!: Phaser.GameObjects.Image;

  private createExpBar(): void {
    const barLeft = 12;
    const barW = GAME_WIDTH - 24;
    const barH = 14; // 像素格
    const barY = GAME_HEIGHT - 30;
    const depth = 102;

    // 像素边框底板
    this.expBg = this.scene.add.image(barLeft, barY, 'exp_bar_frame')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    // 金色填充
    this.expFill = this.scene.add.image(barLeft, barY, 'bar_fill_exp')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(101);
    this.expFill.setCrop(0, 0, 0, barH * 2);

    // 经验图标（稍大）
    this.expIcon = this.scene.add.image(barLeft + 10, barY + (barH * 2) / 2, 'icon_exp')
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(depth).setDisplaySize(14, 14);

    // 等级/经验文字（放大加粗，带阴影 stroke）
    this.expLabel = this.scene.add.text(GAME_WIDTH / 2, barY + (barH * 2) / 2, 'Lv.1  0/15', {
      ...FONT.body, color: '#FFFFFF',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth);
  }

  // ── 每帧刷新 ──
  update(player: Player, building: Building, gameTime: number): void {
    // 古建结构血条（左侧竖排）
    for (const bar of this.structBars) {
      const s = building.getStructure(bar.type);
      if (!s) continue;
      const ratio = s.currentHp / s.maxHp;
      const fullW = 130 * 2; // 物理 px（纹理 2×）
      const fullH = 16 * 2;
      bar.fill.setCrop(0, 0, Math.max(0, Math.floor(fullW * ratio)), fullH);
      bar.hpText.setText(`${s.currentHp}/${s.maxHp}`);
      if (ratio < 0.3) {
        bar.fill.setAlpha(0.5 + 0.5 * Math.sin(this.scene.time.now * 0.008));
      } else {
        bar.fill.setAlpha(1);
      }
    }

    // 倒计时
    const m = Math.floor(gameTime / 60);
    const s = Math.floor(gameTime % 60);
    this.timerText.setText(`${m}:${s.toString().padStart(2, '0')}`);
    if (gameTime < 30) {
      this.timerText.setColor('#E04040');
      // 危险闪烁：面板 alpha 脉冲
      this.timerPanelBg.setAlpha(0.5 + 0.5 * Math.sin(this.scene.time.now * 0.01));
    } else {
      this.timerText.setColor('#FFFFFF');
      this.timerPanelBg.setAlpha(1);
    }

    // 经验条
    const expRatio = player.level > 0 ? player.exp / player.expToNext : 0;
    const fullW = (GAME_WIDTH - 24) * 2;
    const barHpx = 14 * 2;
    this.expFill.setCrop(0, 0, Math.max(0, Math.floor(fullW * expRatio)), barHpx);
    if (expRatio > 0.8) {
      const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now * 0.008);
      this.expFill.setAlpha(pulse);
      this.expLabel.setColor('#FFD700');
    } else {
      this.expFill.setAlpha(1);
      this.expLabel.setColor('#FFFFFF');
    }
    this.expLabel.setText(`Lv.${player.level}  ${player.exp}/${player.expToNext}`);
  }

  // ── 升级选择面板（像素风） ──
  showLevelUpPanel(
    options: LevelUpOption[],
    onSelect: (id: SkillId, isUpgrade: boolean) => void,
  ): void {
    this.hideLevelUpPanel();

    const cardW = LEVELUP_CARD.w, cardH = LEVELUP_CARD.h;
    const cardGap = 24;
    const totalW = cardW * options.length + cardGap * (options.length - 1);
    const startX = (GAME_WIDTH - totalW) / 2;
    const centerY = GAME_HEIGHT / 2 - 20;
    const depth = 300;
    const cardGridW = Math.ceil(cardW / 2);
    const cardGridH = Math.ceil(cardH / 2);

    // 半透明遮罩
    const overlay = this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(depth);
    this.levelUpElements.push(overlay);

    // 标题（像素风）
    const title = this.scene.add.text(GAME_WIDTH / 2, centerY - cardH / 2 - 45, '升级！选择一个技能', {
      ...FONT.title, color: PALETTE.BRIGHT_GOLD,
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.levelUpElements.push(title);

    options.forEach((opt, i) => {
      const cx = startX + i * (cardW + cardGap) + cardW / 2;
      const cardKey = `card_${cardGridW}_${cardGridH}_${i}`;
      // 边框颜色：新技能=玉绿，升级=金色
      const borderColor = opt.isUpgrade ? PALETTE.BRIGHT_GOLD : PALETTE.JADE_GREEN;
      genOrnatePanel(this.scene, cardKey, cardGridW, cardGridH, borderColor, '#3E2510');

      // 卡片背景（像素纹理）
      const bg = this.scene.add.image(cx, centerY, cardKey)
        .setScrollFactor(0).setDepth(depth + 1)
        .setInteractive({ useHandCursor: true });
      this.levelUpElements.push(bg);

      // 类型徽章（像素小标签）
      const tag = opt.isUpgrade ? '技能升级' : '获得技能';
      const tagColor = opt.isUpgrade ? PALETTE.BRIGHT_GOLD : PALETTE.JADE_GREEN;
      const tagBg = this.scene.add.rectangle(cx, centerY - cardH / 2 + 18, 60, 14, 0x1A1410, 0.8)
        .setScrollFactor(0).setDepth(depth + 2).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(tagColor).color);
      this.levelUpElements.push(tagBg);
      const tagText = this.scene.add.text(cx, centerY - cardH / 2 + 18, tag, {
        ...FONT.tiny, color: tagColor,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 3);
      this.levelUpElements.push(tagText);

      // 技能名
      const nameText = this.scene.add.text(cx, centerY - 32, opt.name, {
        ...FONT.large, color: '#FFFFFF',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
      this.levelUpElements.push(nameText);

      // 等级
      const lvText = this.scene.add.text(cx, centerY - 10, `Lv.${opt.level}`, {
        ...FONT.body, color: PALETTE.BRIGHT_GOLD,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
      this.levelUpElements.push(lvText);

      // 效果描述
      const desc = this.scene.add.text(cx, centerY + 35, opt.description, {
        ...FONT.small, color: PALETTE.PARCHMENT,
        wordWrap: { width: cardW - 30 }, align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
      this.levelUpElements.push(desc);

      // 像素按钮
      const btnW = Math.ceil(100 / 2), btnH = Math.ceil(28 / 2);
      const btnKey = `btn_card_${cardGridW}_${i}`;
      genPixelButton(this.scene, btnKey, btnW, btnH, PALETTE.OAK_WOOD, PALETTE.DARK_GOLD);
      const btnY = centerY + cardH / 2 - 30;
      const btnImg = this.scene.add.image(cx, btnY, btnKey + '_normal')
        .setScrollFactor(0).setDepth(depth + 2).setInteractive({ useHandCursor: true });
      this.levelUpElements.push(btnImg);

      // 按钮文字
      const btnText = this.scene.add.text(cx, btnY, '点此选择', {
        ...FONT.body, color: PALETTE.BRIGHT_GOLD,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 3);
      this.levelUpElements.push(btnText);

      // hover 效果
      bg.on('pointerover', () => { bg.setScale(1.02); btnImg.setTexture(btnKey + '_hover'); });
      bg.on('pointerout', () => { bg.setScale(1); btnImg.setTexture(btnKey + '_normal'); });
      btnImg.on('pointerover', () => btnImg.setTexture(btnKey + '_hover'));
      btnImg.on('pointerout', () => btnImg.setTexture(btnKey + '_normal'));
      btnImg.on('pointerdown', () => btnImg.setTexture(btnKey + '_press'));

      // 选择动作
      const handler = () => onSelect(opt.id, opt.isUpgrade);
      bg.on('pointerdown', handler);
      btnImg.on('pointerup', handler);
    });
  }

  hideLevelUpPanel(): void {
    for (const el of this.levelUpElements) el.destroy();
    this.levelUpElements = [];
  }

  /** 手动 CJK 换行 — 按字符数估算每行宽度 */
  private wrapCJK(text: string, fontSize: string, maxWidth: number): string {
    const charW = parseInt(fontSize, 10); // CJK 字符约等于字号宽度
    const charsPerLine = Math.floor(maxWidth / charW);
    if (charsPerLine <= 0) return text;

    let result = '';
    let lineLen = 0;
    for (const ch of text) {
      result += ch;
      if (ch === '\n') { lineLen = 0; continue; }
      lineLen++;
      if (lineLen >= charsPerLine) {
        result += '\n';
        lineLen = 0;
      }
    }
    return result;
  }

  // ── 怪物首次遭遇科普弹窗（详细：灾害背景 + 游戏影响） ──
  showMonsterPopup(monsterType: MonsterType, onClose?: () => void): void {
    const data: Record<MonsterType, {
      name: string; desc: string; dangerColor: string; illusKey: string;
    }> = {
      termite: {
        name: '白蚁怪', dangerColor: '#DDDDDD', illusKey: 'illus_termite',
        desc: '白蚁蛀蚀是木构古建最普遍的病害。它们钻进梁、柱、斗拱内部，将木材蛀成空壳，表面完好而内部已朽。\n\n▸ 攻击木质结构，快速啃噬\n▸ 数量多、速度快，优先围攻古建',
      },
      wind: {
        name: '风蚀怪', dangerColor: '#DDCC88', illusKey: 'illus_wind',
        desc: '风沙侵蚀对露天石质文物威胁极大。携带沙粒的强风不断打磨石刻表面，使雕刻纹饰逐渐模糊消失。\n\n▸ 攻击石质结构 + 彩绘壁画\n▸ 接触玩家时造成击退',
      },
      acid_rain: {
        name: '酸雨怪', dangerColor: '#44CC44', illusKey: 'illus_acid_rain',
        desc: '酸雨渗入砖瓦缝隙后加速化学风化，冬季结冰还会胀裂墙体。雨水沿裂缝渗入内部木构件，造成腐朽霉变。\n\n▸ 攻击石质结构 + 砖瓦结构\n▸ 攻击时留下腐蚀水洼，踩中减速',
      },
      fire: {
        name: '火焰怪', dangerColor: '#FF6633', illusKey: 'illus_fire',
        desc: '火灾可在数小时内摧毁一座千年古建。木构架遇火即燃，彩绘壁画在高温下颜料起泡剥落。\n\n▸ 攻击木质结构 + 彩绘壁画\n▸ 造成灼烧，目标结构持续掉血',
      },
      freeze_thaw: {
        name: '冻融怪', dangerColor: '#6699FF', illusKey: 'illus_freeze_thaw',
        desc: '水渗入砖石裂隙后结冰膨胀，产生巨大张力使裂缝扩大。反复冻融循环是砖石古建冬季的头号威胁。\n\n▸ 攻击石质结构 + 砖瓦结构\n▸ 血厚攻高，靠近玩家时减速',
      },
    };
    const info = data[monsterType];
    if (!info) return;

    for (const el of this.popupElements) el.destroy();
    this.popupElements = [];

    const depth = 350;
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const w = 720, h = 400;
    const illW = 160, illH = 160;
    const padding = 24;
    const leftX = cx - w / 2, topY = cy - h / 2;

    // 半透明遮罩
    const overlay = this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setScrollFactor(0).setDepth(depth).setInteractive();
    this.popupElements.push(overlay);

    // 像素面板背景
    const gridW = Math.ceil(w / 2), gridH = Math.ceil(h / 2);
    const panelKey = `monster_popup_${monsterType}`;
    genOrnatePanel(this.scene, panelKey, gridW, gridH, info.dangerColor, '#1A1410');
    const panel = this.scene.add.image(cx, cy, panelKey)
      .setScrollFactor(0).setDepth(depth + 1);
    this.popupElements.push(panel);

    // ═══ 左侧：怪物图标 ═══
    const illX = leftX + padding + illW / 2, illY = topY + padding + illH / 2 + 20;
    if (this.scene.textures.exists(monsterType)) {
      const illBg = this.scene.add.rectangle(illX, illY, illW + 12, illH + 12, 0x0a0806, 0.8)
        .setScrollFactor(0).setDepth(depth + 2);
      this.popupElements.push(illBg);
      const ill = this.scene.add.image(illX, illY, monsterType)
        .setScrollFactor(0).setDepth(depth + 3)
        .setDisplaySize(illW, illH);
      this.popupElements.push(ill);
    }

    // ═══ 右侧：标题 + 描述 ═══
    const rightX = leftX + illW + padding * 2;
    const rightW = w - illW - padding * 3;
    const textTop = topY + padding + 14;
    const textMaxH = h - padding * 2 - 40;

    // 怪物名称
    const title = this.scene.add.text(rightX, textTop, info.name, {
      fontSize: '24px', fontFamily: 'monospace', color: info.dangerColor,
      stroke: '#000', strokeThickness: 4,
    }).setScrollFactor(0).setDepth(depth + 2);
    this.popupElements.push(title);

    // 分隔线
    const sepY = textTop + 36;
    const sepG = this.scene.add.graphics();
    sepG.fillStyle(0x5C3A1E, 0.6);
    sepG.fillRect(rightX, sepY, rightW, 1);
    sepG.setScrollFactor(0).setDepth(depth + 2);
    this.popupElements.push(sepG);

    // 描述文字 — 自动缩放字号防溢出
    let fontSize = 14;
    const maxCharsPerLine = Math.floor(rightW / (fontSize * 0.6));
    const lines = info.desc.split('\n');
    let totalLines = 0;
    for (const line of lines) {
      totalLines += Math.ceil(line.length / Math.max(1, maxCharsPerLine));
    }
    const neededH = totalLines * (fontSize + 6);
    if (neededH > textMaxH) {
      fontSize = Math.max(10, Math.floor(fontSize * textMaxH / neededH));
    }

    const desc = this.scene.add.text(rightX, sepY + 12, info.desc, {
      fontSize: `${fontSize}px`, fontFamily: 'monospace',
      color: PALETTE.PARCHMENT, lineSpacing: 4,
      wordWrap: { width: rightW },
    }).setScrollFactor(0).setDepth(depth + 2);
    this.popupElements.push(desc);

    // ── 底部关闭提示 ──
    const closeHint = this.scene.add.text(cx, cy + h / 2 - 18, '— 点击任意处关闭 —', {
      fontSize: '11px', fontFamily: 'monospace', color: '#666666',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
    this.popupElements.push(closeHint);

    // ── 关闭逻辑 ──
    const close = () => {
      for (const el of this.popupElements) { if (el.active) el.destroy(); }
      this.popupElements = [];
      onClose?.();
    };
    this.scene.time.delayedCall(8000, close);
    overlay.on('pointerdown', close);
  }

  // ── 技能提示弹窗（像素风） ──
  showSkillPopup(skillId: SkillId, level: number): void {
    for (const el of this.popupElements) el.destroy();
    this.popupElements = [];

    const cfg = SKILL_CONFIGS[skillId][level - 1];
    const depth = 350;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 120;
    const w = 300, h = 150;
    const gridW = Math.ceil(w / 2), gridH = Math.ceil(h / 2);

    // 像素面板背景
    genOrnatePanel(this.scene, 'popup_panel', gridW, gridH, PALETTE.BRIGHT_GOLD, '#1E1810');
    const bg = this.scene.add.image(cx, cy, 'popup_panel')
      .setScrollFactor(0).setDepth(depth)
      .setInteractive().setScale(0.8);
    this.popupElements.push(bg);

    // 入场动画：scale 0.8 → 1.0
    this.scene.tweens.add({ targets: bg, scale: 1, duration: 150, ease: 'Back.easeOut' });

    // 标题
    const title = this.scene.add.text(cx, cy - h / 2 + 22, `获得技能：${cfg.name}`, {
      ...FONT.body, color: PALETTE.BRIGHT_GOLD,
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.popupElements.push(title);

    // 效果描述
    const descLines = [
      `CD ${cfg.cooldown}s，伤害 ${cfg.damage}`,
      cfg.range > 0 ? `范围 ${cfg.range}` : '',
      cfg.repairAmount > 0 ? `回复${cfg.repairType.join('/')} ${cfg.repairAmount} 点` : '',
    ].filter(Boolean).join('，');
    const desc = this.scene.add.text(cx, cy, descLines, {
      ...FONT.small, color: PALETTE.PARCHMENT,
      wordWrap: { width: w - 40 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.popupElements.push(desc);

    // 小知识
    const tips: Record<string, string> = {
      wood_reinforce: '木构古建需要定期检查梁、柱、斗拱等构件。',
      stone_repair: '石质古建面层风化是常见病害，需定期修补。',
      waterproof: '防水是古建保护的关键，雨水渗漏会造成严重损害。',
      insect_control: '木构古建需要注意白蚁和蛀虫防治。',
      painting_restore: '彩绘壁画受潮后颜料层会起甲、剥落。',
    };
    const tip = this.scene.add.text(cx, cy + h / 2 - 30, tips[skillId] ?? '', {
      ...FONT.tiny, color: '#8A8A80',
      wordWrap: { width: w - 40 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.popupElements.push(tip);

    // 关闭图标 + 文字
    const closeIcon = this.scene.add.image(cx, cy + h / 2 - 12, 'icon_close')
      .setScrollFactor(0).setDepth(depth + 1).setDisplaySize(10, 10);
    this.popupElements.push(closeIcon);
    const closeHint = this.scene.add.text(cx + 12, cy + h / 2 - 12, '点击关闭', {
      ...FONT.tiny, color: '#666666',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(depth + 1);
    this.popupElements.push(closeHint);

    // 2 秒自动关闭
    this.scene.time.delayedCall(2500, () => {
      for (const el of this.popupElements) { if (el.active) el.destroy(); }
      this.popupElements = [];
    });

    // 点击关闭
    bg.on('pointerdown', () => {
      for (const el of this.popupElements) { if (el.active) el.destroy(); }
      this.popupElements = [];
    });
  }
}
