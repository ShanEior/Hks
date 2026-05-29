import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, StructureType, SkillId, SKILL_CONFIGS } from './config';
import { Player } from './Player';
import { Building } from './Building';

interface StructBar {
  type: StructureType;
  bg: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
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
  private expBg!: Phaser.GameObjects.Rectangle;
  private expFill!: Phaser.GameObjects.Rectangle;
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

  // ── 4 条古建血条（屏幕上方居中） ──
  private createStructureBars(): void {
    const types: StructureType[] = ['wood', 'stone', 'tile', 'painting'];
    const colors = [0xC4884D, 0x999999, 0xA0522D, 0x9966CC];
    const labels = ['木质', '石质', '砖瓦', '彩绘'];
    const barW = 150, barH = 12, gap = 8;
    const totalW = 4 * barW + 3 * gap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const y = 8;

    types.forEach((type, i) => {
      const bx = startX + i * (barW + gap);

      // 标签
      this.scene.add.text(bx, y - 12, labels[i],
        { fontSize: '9px', color: '#ccc' })
        .setScrollFactor(0).setDepth(102);

      // 底色
      const bg = this.scene.add.rectangle(bx, y, barW, barH, 0x333333)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(100);

      // 填充
      const fill = this.scene.add.rectangle(bx, y, barW, barH, colors[i])
        .setOrigin(0, 0).setScrollFactor(0).setDepth(101);

      // 数值
      const hpText = this.scene.add.text(bx + 2, y + 1, '',
        { fontSize: '8px', color: '#fff', fontFamily: 'monospace' })
        .setScrollFactor(0).setDepth(102);

      this.structBars.push({ type, bg, fill, hpText });
    });
  }

  // ── 倒计时（右上） ──
  private createTimer(): void {
    this.timerText = this.scene.add.text(GAME_WIDTH - 12, 12, '5:00',
      { fontSize: '22px', color: '#fff', fontFamily: 'monospace' })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(102);
  }

  // ── 经验条（底部全宽） ──
  private createExpBar(): void {
    const h = 10;
    const y = GAME_HEIGHT - 14;
    const fullW = GAME_WIDTH - 24;
    this.expBg = this.scene.add.rectangle(12, y, fullW, h, 0x333333)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    this.expFill = this.scene.add.rectangle(12, y, 0, h, 0x44aaff)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(101);
    this.expLabel = this.scene.add.text(GAME_WIDTH / 2, y + h / 2, 'Lv.1  0/15',
      { fontSize: '9px', color: '#fff', fontFamily: 'monospace' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(102);
  }

  // ── 每帧刷新 ──
  update(player: Player, building: Building, gameTime: number): void {
    const fullW = GAME_WIDTH - 24;

    // 古建结构血条
    for (const bar of this.structBars) {
      const s = building.getStructure(bar.type);
      if (!s) continue;
      const ratio = s.currentHp / s.maxHp;
      bar.fill.setSize(150 * ratio, 12);
      bar.hpText.setText(`${s.currentHp}/${s.maxHp}`);
    }

    // 倒计时
    const m = Math.floor(gameTime / 60);
    const s = Math.floor(gameTime % 60);
    this.timerText.setText(`${m}:${s.toString().padStart(2, '0')}`);
    this.timerText.setColor(gameTime < 30 ? '#ff4444' : '#ffffff');

    // 经验条
    const expRatio = player.level > 0 ? player.exp / player.expToNext : 0;
    this.expFill.setSize(fullW * expRatio, 10);
    this.expLabel.setText(`Lv.${player.level}  ${player.exp}/${player.expToNext}`);
  }

  // ── 升级选择面板 ──
  showLevelUpPanel(
    options: LevelUpOption[],
    onSelect: (id: SkillId, isUpgrade: boolean) => void,
  ): void {
    this.hideLevelUpPanel();

    const panelW = GAME_WIDTH - 80;
    const cardW = (panelW - 40) / Math.min(3, options.length);
    const cardH = 200;
    const cardGap = 20;
    const startX = (GAME_WIDTH - (cardW * options.length + cardGap * (options.length - 1))) / 2;
    const centerY = GAME_HEIGHT / 2 - 20;
    const depth = 300;

    const colors = [0x553322, 0x445533, 0x334455, 0x443355, 0x554433];

    // 半透明遮罩
    const overlay = this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(depth);
    this.levelUpElements.push(overlay);

    // 标题
    const title = this.scene.add.text(GAME_WIDTH / 2, centerY - cardH / 2 - 40, '升级！选择一个技能', {
      fontSize: '22px', color: '#ffdd44', fontFamily: 'sans-serif', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.levelUpElements.push(title);

    options.forEach((opt, i) => {
      const cx = startX + i * (cardW + cardGap) + cardW / 2;

      // 卡片背景
      const bg = this.scene.add.rectangle(cx, centerY, cardW, cardH, colors[i % colors.length], 0.9)
        .setScrollFactor(0).setDepth(depth + 1).setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true });
      this.levelUpElements.push(bg);

      // 类型标签
      const tag = opt.isUpgrade ? '技能升级' : '获得技能';
      const tagText = this.scene.add.text(cx, centerY - cardH / 2 + 20, tag, {
        fontSize: '10px', color: opt.isUpgrade ? '#ffdd44' : '#44ff88', fontFamily: 'sans-serif',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
      this.levelUpElements.push(tagText);

      // 技能名
      const nameText = this.scene.add.text(cx, centerY - 30, opt.name, {
        fontSize: '18px', color: '#fff', fontFamily: 'sans-serif', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
      this.levelUpElements.push(nameText);

      // 等级
      const lvText = this.scene.add.text(cx, centerY - 8, `Lv.${opt.level}`, {
        fontSize: '14px', color: '#ffcc00', fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
      this.levelUpElements.push(lvText);

      // 效果描述
      const desc = this.scene.add.text(cx, centerY + 30, opt.description, {
        fontSize: '10px', color: '#ccc', fontFamily: 'sans-serif',
        wordWrap: { width: cardW - 20 }, align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
      this.levelUpElements.push(desc);

      // 选择按钮
      const btn = this.scene.add.text(cx, centerY + cardH / 2 - 30, '点此选择', {
        fontSize: '12px', color: '#fff', fontFamily: 'sans-serif',
        backgroundColor: '#447744', padding: { x: 16, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2).setInteractive({ useHandCursor: true });
      this.levelUpElements.push(btn);

      // hover 效果
      bg.on('pointerover', () => bg.setAlpha(1));
      bg.on('pointerout', () => bg.setAlpha(0.9));
      btn.on('pointerover', () => btn.setColor('#ffff00'));
      btn.on('pointerout', () => btn.setColor('#ffffff'));

      // 点击（背景和按钮都响应）
      const handler = () => onSelect(opt.id, opt.isUpgrade);
      bg.on('pointerdown', handler);
      btn.on('pointerdown', handler);
    });
  }

  hideLevelUpPanel(): void {
    for (const el of this.levelUpElements) el.destroy();
    this.levelUpElements = [];
  }

  // ── 技能提示弹窗 ──
  showSkillPopup(skillId: SkillId, level: number): void {
    // 清理旧弹窗
    for (const el of this.popupElements) el.destroy();
    this.popupElements = [];

    const cfg = SKILL_CONFIGS[skillId][level - 1];
    const depth = 350;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 120;
    const w = 280, h = 140;

    // 背景
    const bg = this.scene.add.rectangle(cx, cy, w, h, 0x222222, 0.92)
      .setScrollFactor(0).setDepth(depth).setStrokeStyle(2, 0xffcc44);
    this.popupElements.push(bg);

    // 标题
    const title = this.scene.add.text(cx, cy - h / 2 + 20, `获得技能：${cfg.name}`, {
      fontSize: '15px', color: '#ffdd44', fontFamily: 'sans-serif', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.popupElements.push(title);

    // 效果
    const descLines = [
      `CD ${cfg.cooldown}s，伤害 ${cfg.damage}`,
      cfg.range > 0 ? `范围 ${cfg.range}` : '',
      cfg.repairAmount > 0 ? `回复 ${cfg.repairType.join('/')} ${cfg.repairAmount} 点` : '',
    ].filter(Boolean).join('，');
    const desc = this.scene.add.text(cx, cy - 5, descLines, {
      fontSize: '11px', color: '#ccc', fontFamily: 'sans-serif',
      wordWrap: { width: w - 30 }, align: 'center',
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
      fontSize: '9px', color: '#aaa', fontFamily: 'sans-serif',
      wordWrap: { width: w - 30 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.popupElements.push(tip);

    // 关闭提示
    const closeHint = this.scene.add.text(cx, cy + h / 2 - 12, '(点击关闭)', {
      fontSize: '9px', color: '#666', fontFamily: 'sans-serif',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.popupElements.push(closeHint);

    // 2 秒自动关闭
    this.scene.time.delayedCall(2000, () => {
      for (const el of this.popupElements) {
        if (el.active) el.destroy();
      }
      this.popupElements = [];
    });

    // 点击关闭
    bg.setInteractive();
    bg.on('pointerdown', () => {
      for (const el of this.popupElements) {
        if (el.active) el.destroy();
      }
      this.popupElements = [];
    });
  }
}
