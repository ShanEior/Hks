import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT, PALETTE } from './config';

interface Page {
  title: string;
  lines: string[];
}

export class TutorialScene extends Phaser.Scene {
  private currentPage = 0;
  private pageElements: Phaser.GameObjects.GameObject[] = [];
  private isTransitioning = false;

  private readonly pages: Page[] = [
    {
      title: '序',
      lines: [
        '山西，中华大地上的「古建筑博物馆」',
        '数千座木构寺庙、石窟、古塔屹立千年',
        '',
        '然而——',
        '',
        '白蚁蛀蚀、风沙侵蚀、酸雨渗透',
        '火灾吞噬、冻融崩裂……',
        '',
        '本作聚焦古建面临的五大自然灾害',
        '在战斗中了解古建保护知识',
        '',
        '千年瑰宝，危在旦夕',
        '守护之路，由此开启',
      ],
    },
    {
      title: '使命',
      lines: [
        '你，是一名古建守护者',
        '手持毛笔与修缮工具',
        '',
        '守护眼前的木构古寺',
        '抵御从四面八方涌来的灾害怪物',
        '',
        '坚持 5 分钟，古寺不倒',
        '即为胜利',
      ],
    },
    {
      title: '操作',
      lines: [
        'W A S D 或 方向键 移动',
        '技能自动释放，无需按键攻击',
        '',
        '击杀怪物 → 拾取经验球 → 升级',
        '升级时选择技能，最多升到 3 级',
        '',
        '怪物可能掉落修补箱，拾取后',
        '修补箱飞向古建回复结构血量',
        '',
        '技能命中怪物也可修缮古建',
        '攻守兼备，方能护寺周全',
      ],
    },
    {
      title: '古建结构',
      lines: [
        '古寺有四条结构血条：',
        '',
        '木质结构 — 怕白蚁、火焰',
        '石质结构 — 怕风蚀、酸雨、冻融',
        '砖瓦结构 — 怕酸雨、冻融',
        '彩绘壁画 — 怕风蚀、火焰',
        '',
        '任意一条血条归零 → 古建损毁 → 失败',
        '',
        '守护千年古建，就此一战！',
      ],
    },
  ];

  constructor() {
    super({ key: 'TutorialScene' });
  }

  create(): void {
    this.currentPage = 0;
    this.isTransitioning = false;
    this.pageElements = [];

    // 深色背景
    const bg = this.add.graphics();
    bg.fillStyle(0x1A1410, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.setDepth(0);

    // 边框
    const frame = this.add.graphics();
    frame.lineStyle(2, 0xDAA520, 0.5);
    frame.strokeRect(16, 16, GAME_WIDTH - 32, GAME_HEIGHT - 32);
    frame.lineStyle(1, 0x5C3A1E, 0.3);
    frame.strokeRect(24, 24, GAME_WIDTH - 48, GAME_HEIGHT - 48);
    frame.setDepth(0);

    // 显示第一页
    this.showPage(0);

    // 从黑屏淡入
    this.cameras.main.fadeIn(600, 26, 20, 16);
  }

  private showPage(index: number): void {
    // 清理上一页
    for (const el of this.pageElements) el.destroy();
    this.pageElements = [];

    const page = this.pages[index];
    if (!page) return;

    const cx = GAME_WIDTH / 2;
    const d = 2;

    // 页码指示器（顶部小圆点）
    const dotY = 50;
    const dotGap = 18;
    const totalDotsW = (this.pages.length - 1) * dotGap;
    const dotStartX = cx - totalDotsW / 2;
    for (let i = 0; i < this.pages.length; i++) {
      const dot = this.add.circle(dotStartX + i * dotGap, dotY, 4, i === index ? 0xDAA520 : 0x5C3A1E);
      dot.setDepth(d).setAlpha(i === index ? 1 : 0.5);
      this.pageElements.push(dot);
    }

    // 标题
    const title = this.add.text(cx, 100, page.title, {
      ...FONT.huge, color: PALETTE.BRIGHT_GOLD,
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(d).setAlpha(0);
    this.pageElements.push(title);

    // 标题下划线
    const uline = this.add.graphics();
    uline.fillStyle(0xDAA520, 0.6);
    uline.fillRect(cx - 30, 140, 60, 1);
    uline.setDepth(d).setAlpha(0);
    this.pageElements.push(uline);

    // 正文（逐行）
    const lineStartY = 175;
    const lineGap = 32;
    let hasEmpty = false;
    let lineIdx = 0;

    for (const text of page.lines) {
      if (text === '') {
        hasEmpty = true;
        continue;
      }
      const ly = lineStartY + lineIdx * lineGap + (hasEmpty ? 8 : 0);
      // 是否为关键句（含 →、数字、感叹号等）
      const isKey = /[→！0-9]|血条|归零|失败|胜利|打得越猛/.test(text);
      const t = this.add.text(cx, ly, text, {
        ...(isKey ? FONT.large : FONT.body),
        color: isKey ? PALETTE.BRIGHT_GOLD : PALETTE.PARCHMENT,
        stroke: '#000000', strokeThickness: isKey ? 3 : 2,
      }).setOrigin(0.5).setDepth(d).setAlpha(0);
      this.pageElements.push(t);
      lineIdx++;
    }

    // 翻页提示
    const isLast = index === this.pages.length - 1;
    const promptText = isLast ? '—  点击开始战斗  —' : '—  点击继续  —';
    const prompt = this.add.text(cx, GAME_HEIGHT - 70, promptText, {
      ...FONT.body, color: '#8A8A80',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(d).setAlpha(0);
    this.pageElements.push(prompt);

    // 「跳过教程」
    if (index === 0) {
      const skip = this.add.text(GAME_WIDTH - 24, 28, '跳过 »', {
        ...FONT.small, color: '#555555',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(d).setInteractive({ useHandCursor: true });
      skip.on('pointerover', () => skip.setColor('#8A8A80'));
      skip.on('pointerout', () => skip.setColor('#555555'));
      skip.on('pointerdown', () => this.goToGame());
      this.pageElements.push(skip);
    }

    // ── 入场动画 ──
    // 标题淡入 + 下划线展开
    this.tweens.add({ targets: title, alpha: 1, duration: 400, ease: 'Power2' });
    this.tweens.add({ targets: uline, alpha: 1, duration: 400, delay: 200 });
    this.tweens.add({
      targets: uline, scaleX: { from: 0, to: 1 }, duration: 500, delay: 200, ease: 'Power2',
    });
    // 各行依次淡入
    const allTexts = this.pageElements.filter(e => e instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text[];
    const bodyTexts = allTexts.filter(t => t !== title && t !== prompt);
    bodyTexts.forEach((t, i) => {
      this.tweens.add({ targets: t, alpha: 1, duration: 300, delay: 400 + i * 120, ease: 'Power2' });
    });
    // 提示最后出现
    this.tweens.add({ targets: prompt, alpha: 1, duration: 500, delay: 400 + bodyTexts.length * 120 + 200 });

    // ── 点击交互 ──
    this.input.once('pointerdown', () => this.nextPage());
  }

  private nextPage(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    if (this.currentPage < this.pages.length - 1) {
      // 还有下一页：淡出当前页，显示下一页
      for (const el of this.pageElements) {
        if (el instanceof Phaser.GameObjects.Text) {
          this.tweens.add({ targets: el, alpha: 0, duration: 200 });
        }
      }
      this.time.delayedCall(250, () => {
        this.currentPage++;
        this.showPage(this.currentPage);
        this.isTransitioning = false;
      });
    } else {
      // 最后一页：进入游戏
      this.goToGame();
    }
  }

  private goToGame(): void {
    this.isTransitioning = true;
    this.cameras.main.fadeOut(600, 26, 20, 16);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene');
    });
  }
}
