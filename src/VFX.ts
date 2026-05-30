/**
 * VFX — 战斗手感特效模块
 * 命中反馈、死亡爆破、升级庆祝、碎屑粒子、屏幕震动
 */
import Phaser from 'phaser';
import { MAP_WIDTH, MAP_HEIGHT, MonsterType, ELEMENT_COLORS, DAMAGE_NUMBER_CONFIG, DamageNumberTier, SHAKE_TRAUMA_CONFIG, COMBAT_FEEL_EXTRA } from './config';

export class VFX {
  // ═══════════════════════════════════
  // 屏震创伤累积系统 (Nuclear Throne style)
  // ═══════════════════════════════════

  private static trauma = 0;
  private static traumaScene: Phaser.Scene | null = null;

  /** 每帧调用：衰减创伤并应用屏震 */
  static updateTrauma(scene: Phaser.Scene, delta: number): void {
    if (VFX.trauma <= 0) return;
    VFX.traumaScene = scene;

    // 衰减创伤 (Nuclear Throne: 0.9/frame at 30fps → ~0.95/frame at 60fps)
    VFX.trauma *= Math.pow(SHAKE_TRAUMA_CONFIG.decayPerFrame, delta / 16.67);

    if (VFX.trauma < SHAKE_TRAUMA_CONFIG.minTrauma) {
      VFX.trauma = 0;
      return;
    }

    // 以当前创伤值作为强度施加屏震
    const intensity = VFX.trauma * SHAKE_TRAUMA_CONFIG.intensityScale;
    scene.cameras.main.shake(16, Math.min(intensity, SHAKE_TRAUMA_CONFIG.maxTrauma));
  }

  // ═══════════════════════════════════
  // 粒子工具
  // ═══════════════════════════════════

  /** 发射一组彩色粒子爆散（GPU 批处理，单次 draw call） */
  static burst(
    scene: Phaser.Scene, x: number, y: number,
    count: number, colors: number[], speed = 120, size = 3, lifetime = 400,
  ): void {
    // 确保粒子纹理存在
    if (!scene.textures.exists('px_white')) return;

    const emitter = scene.add.particles(x, y, 'px_white', {
      speed: { min: speed * 0.3, max: speed },
      scale: { start: size / 4, end: size / 4 * 0.2 },
      alpha: { start: 1, end: 0 },
      lifespan: lifetime,
      tint: colors,
      emitting: false,
      gravityY: 80,
    });
    emitter.setDepth(40);
    emitter.explode(count);

    // 粒子全部消失后自动清理 emitter
    scene.time.delayedCall(lifetime + 200, () => {
      if (emitter && emitter.active) emitter.destroy();
    });
  }

  /** 冲击波扩散圈：可选 damage 参数，伤害越高环越大 */
  static shockwave(scene: Phaser.Scene, x: number, y: number, radius: number, color: number, duration = 300, damage?: number): void {
    // 根据伤害值动态缩放半径（伤害越高环越大）
    let finalRadius = radius;
    if (damage !== undefined) {
      const scale = COMBAT_FEEL_EXTRA.shockwaveBaseScale +
        Math.min(damage / COMBAT_FEEL_EXTRA.shockwaveMaxDamageRef, 0.7);
      finalRadius = radius * scale;
    }

    const ring = scene.add.circle(x, y, 5, color, 0);
    ring.setStrokeStyle(3, color, 0.8);
    ring.setDepth(35);
    const cleanup = () => { if (ring.active) ring.destroy(); };
    scene.tweens.add({
      targets: ring,
      radius: finalRadius,
      alpha: 0,
      duration,
      ease: 'Power2',
      onUpdate: () => {
        ring.setStrokeStyle(2, color, ring.alpha * 0.8);
      },
      onComplete: cleanup,
      onStop: cleanup,
    });
  }

  /** 屏幕震动（累积创伤 + 即时反馈） */
  static shake(scene: Phaser.Scene, intensity = 0.005, duration = 80): void {
    // 添加到创伤累积器（多个命中叠加，持续屏震）
    VFX.trauma += intensity;
    VFX.trauma = Math.min(VFX.trauma, SHAKE_TRAUMA_CONFIG.maxTrauma);
    VFX.traumaScene = scene;
    // 同时施加即时微小震动，提供瞬间命中反馈
    scene.cameras.main.shake(duration, Math.min(intensity, 0.02));
  }

  /** 镜头短暂闪白 */
  static flash(scene: Phaser.Scene, duration = 60): void {
    scene.cameras.main.flash(duration, 255, 255, 255, false);
  }

  /** 浮动数字 */
  static floatText(
    scene: Phaser.Scene, x: number, y: number,
    text: string, color = '#ffffff', size = '14px',
  ): void {
    const t = scene.add.text(x + (Math.random() - 0.5) * 16, y - 8, text, {
      fontSize: size, color, fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    const cleanup = () => { if (t.active) t.destroy(); };
    scene.tweens.add({
      targets: t, y: t.y - 36, alpha: 0, duration: 700, ease: 'Power2',
      onComplete: cleanup,
      onStop: cleanup,
    });
  }

  /** 特殊标记浮动文字（击杀确认/暴击/Boss） */
  static floatSpecial(
    scene: Phaser.Scene, x: number, y: number,
    tier: DamageNumberTier,
  ): void {
    const cfg = DAMAGE_NUMBER_CONFIG[tier];
    let text = '';
    if ('prefix' in cfg && cfg.prefix) text += cfg.prefix;
    if ('suffix' in cfg && cfg.suffix) text += cfg.suffix;
    if (!text) return;

    const t = scene.add.text(x + (Math.random() - 0.5) * 12, y - 12, text, {
      fontSize: cfg.size, color: cfg.color, fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    // 弹入动画
    t.setScale(0.3);
    scene.tweens.add({
      targets: t, scale: cfg.scale, duration: 150, ease: 'Back.easeOut',
    });

    const cleanup = () => { if (t.active) t.destroy(); };
    scene.tweens.add({
      targets: t, y: t.y - 28, alpha: 0, duration: 600, delay: 200, ease: 'Power2',
      onComplete: cleanup, onStop: cleanup,
    });
  }

  // ═══════════════════════════════════
  // 战斗反馈
  // ═══════════════════════════════════

  /** 怪物受击反馈 */
  static hitMonster(scene: Phaser.Scene, x: number, y: number, damage: number, _attackerX?: number, _attackerY?: number, monsterType?: MonsterType): void {
    const elem = monsterType ? ELEMENT_COLORS[monsterType] : null;
    const particleColors = elem ? elem.particles : [0xffffff, 0xcccccc];
    const baseColor = elem ? elem.damageColor : '#ffffff';

    // 元素色碎屑
    VFX.burst(scene, x, y, 3, particleColors, 60, 2, 200);

    // 伤害数字（按伤害值分层 + 元素底色）
    const tier: DamageNumberTier = damage >= 30 ? 'heavy' : 'normal';
    const style = DAMAGE_NUMBER_CONFIG[tier];
    const color = damage >= 20 ? '#ff4444' : damage >= 10 ? '#ffaa44' : baseColor;
    const size = style.size;
    VFX.floatText(scene, x + (Math.random() - 0.5) * 4, y, `${Math.round(damage)}`, color, size);

    // 微震
    if (damage >= 15) VFX.shake(scene, 0.002, 50);
  }

  /** 怪物死亡 */
  static killMonster(scene: Phaser.Scene, x: number, y: number, color: number, monsterType?: MonsterType): void {
    const elem = monsterType ? ELEMENT_COLORS[monsterType] : null;
    const burstColors = elem ? elem.particles : [color, 0xffffff, 0xffdd88];
    const ringColor = elem ? elem.flash : color;

    // 主爆散
    VFX.burst(scene, x, y, 10, burstColors, 150, 3, 500);
    // 冲击波
    VFX.shockwave(scene, x, y, 40, ringColor, 350);
    // 微震
    VFX.shake(scene, 0.003, 60);
    // 白色闪光
    const flash = scene.add.circle(x, y, 8, 0xffffff, 1);
    flash.setDepth(39);
    const cleanup = () => { if (flash.active) flash.destroy(); };
    scene.tweens.add({
      targets: flash, scale: 4, alpha: 0, duration: 150,
      onComplete: cleanup,
      onStop: cleanup,
    });
    // 击杀确认文字
    if (monsterType) {
      VFX.floatSpecial(scene, x, y, 'kill');
    }
  }

  /** 升级庆祝 */
  static levelUp(scene: Phaser.Scene, x: number, y: number): void {
    // 金色粒子螺旋上升
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const dist = 20 + Math.random() * 30;
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist - 30 * Math.random();
      const p = scene.add.circle(x, y, 3, 0xffdd44, 1);
      p.setDepth(45);
      const cleanup = () => { if (p.active) p.destroy(); };
      scene.tweens.add({
        targets: p,
        x: tx,
        y: ty - 20,
        alpha: 0,
        scale: 0.3,
        duration: 800,
        delay: i * 30,
        ease: 'Power2',
        onComplete: cleanup,
        onStop: cleanup,
      });
    }
    // 冲击波
    VFX.shockwave(scene, x, y, 80, 0xffdd44, 500);
    // 闪光
    VFX.flash(scene, 80);
    VFX.shake(scene, 0.004, 100);
  }

  // ═══════════════════════════════════
  // 技能特效（大幅增强版）
  // ═══════════════════════════════════

  /** 木构加固：木梁冲击波 — 粗梁+年轮纹理+碎木四溅 */
  static skillWood(scene: Phaser.Scene, x: number, y: number, angle: number, lv: number): void {
    // 发射点木屑爆发
    const woodColors = [0xc4884d, 0xdaa060, 0x8b6914, 0xffdd88];
    VFX.burst(scene, x, y, lv >= 3 ? 15 : 8, woodColors, 100, 3, 400);
    // 发射闪光
    const flash = scene.add.circle(x, y, 6, 0xffffff, 0.9);
    flash.setDepth(21);
    const cleanup = () => { if (flash.active) flash.destroy(); };
    scene.tweens.add({
      targets: flash, scale: 3, alpha: 0, duration: 200,
      onComplete: cleanup,
      onStop: cleanup,
    });
    // Lv3 额外金色强化光
    if (lv >= 3) {
      VFX.shockwave(scene, x, y, 50, 0xffdd44, 350);
    }
  }

  /** 石材修补：多层震波+碎石爆散+地面裂纹 */
  static skillStone(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    // 3层震波（灰→浅灰→白）
    const ringColors = [0x666666, 0x999999, 0xcccccc];
    for (let r = 0; r < 3; r++) {
      const ring = scene.add.circle(x, y, 4, 0, 0);
      ring.setStrokeStyle(3 - r * 0.8, ringColors[r], 1 - r * 0.25);
      ring.setDepth(35);
      const cleanup = () => { if (ring.active) ring.destroy(); };
      scene.tweens.add({
        targets: ring,
        radius: radius * (0.7 + r * 0.2),
        alpha: 0,
        duration: 350 + r * 100,
        delay: r * 50,
        ease: 'Power3',
        onComplete: cleanup,
        onStop: cleanup,
      });
    }
    // 碎石爆散
    const count = lv >= 3 ? 20 : 12;
    VFX.burst(scene, x, y, count, [0x888888, 0xaaaaaa, 0x999999, 0xcccccc, 0x777777], 180, 3, 500);
    // Lv3 额外大石块
    if (lv >= 3) {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        const rock = scene.add.rectangle(x, y, 6, 6, 0x777777, 1);
        rock.setDepth(36);
        rock.setRotation(Math.random() * Math.PI);
        const cleanup = () => { if (rock.active) rock.destroy(); };
        scene.tweens.add({
          targets: rock,
          x: x + Math.cos(a) * 120,
          y: y + Math.sin(a) * 120,
          alpha: 0, rotation: rock.rotation + Math.PI * 2,
          duration: 600,
          ease: 'Power2',
          onComplete: cleanup,
          onStop: cleanup,
        });
      }
    }
  }

  /** 防水封护：4层水纹+水珠飞溅+护罩穹顶弧线 */
  static skillWater(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    const layers = lv >= 3 ? 5 : 3;
    for (let r = 0; r < layers; r++) {
      const ring = scene.add.circle(x, y, 6, 0, 0);
      ring.setStrokeStyle(3 - r * 0.4, 0x4488cc, 0.8 - r * 0.12);
      ring.setDepth(35);
      const cleanup = () => { if (ring.active) ring.destroy(); };
      scene.tweens.add({
        targets: ring,
        radius: radius * (0.5 + r * 0.15),
        alpha: 0,
        duration: 450 + r * 120,
        delay: r * 40,
        ease: 'Sine.easeOut',
        onComplete: cleanup,
        onStop: cleanup,
      });
    }
    // 水珠喷溅
    VFX.burst(scene, x, y, lv >= 3 ? 16 : 10, [0x4488cc, 0x66bbee, 0xaaddff, 0xddeeff], 100, 3, 600);
    // 中心水柱闪光
    const pillar = scene.add.rectangle(x, y, 8, 4, 0xddeeff, 0.6);
    pillar.setDepth(36);
    const cleanup = () => { if (pillar.active) pillar.destroy(); };
    scene.tweens.add({
      targets: pillar, scaleY: 4, scaleX: 0.3, alpha: 0, duration: 300,
      onComplete: cleanup,
      onStop: cleanup,
    });
  }

  /** 防虫处理：浓密药雾+草药碎屑飘散 */
  static skillInsect(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    const count = lv >= 3 ? 25 : 15;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * radius * 0.85;
      const p = scene.add.circle(x + Math.cos(a) * d * 0.2, y + Math.sin(a) * d * 0.2, 5, 0x44cc44, 0.35);
      p.setDepth(18);
      const cleanup = () => { if (p.active) p.destroy(); };
      scene.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0, scale: 2.5,
        duration: 1200 + Math.random() * 600,
        ease: 'Sine.easeOut',
        onComplete: cleanup,
        onStop: cleanup,
      });
    }
    // 草药碎屑
    if (lv >= 2) {
      for (let i = 0; i < 8; i++) {
        const s = scene.add.rectangle(x + (Math.random() - 0.5) * 40, y - 20, 3, 3, 0x88cc44, 0.7);
        s.setDepth(19);
        const cleanup = () => { if (s.active) s.destroy(); };
        scene.tweens.add({
          targets: s, y: s.y + 30 + Math.random() * 20, x: s.x + (Math.random() - 0.5) * 30,
          alpha: 0, rotation: Math.random() * 3, duration: 1500,
          onComplete: cleanup,
          onStop: cleanup,
        });
      }
    }
  }

  /** 彩绘修复：彩虹拖尾+命中颜料大爆炸 */
  static skillPaint(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    // 发射点彩色闪光
    const colors = [0xff4488, 0xff8800, 0xffee00, 0x44ff88, 0x4488ff, 0xcc44ff];
    VFX.burst(scene, x, y, lv >= 2 ? 10 : 6, colors, 120, 4, 500);
    // 多层彩色冲击波
    for (let r = 0; r < 3; r++) {
      const ring = scene.add.circle(x, y, 4, 0, 0);
      ring.setStrokeStyle(2, colors[r * 2], 0.8);
      ring.setDepth(35);
      const cleanup = () => { if (ring.active) ring.destroy(); };
      scene.tweens.add({
        targets: ring, radius: 50 + r * 15, alpha: 0, duration: 300 + r * 60,
        ease: 'Power2',
        onComplete: cleanup,
        onStop: cleanup,
      });
    }
    // Lv3 弹射标记
    if (lv >= 3) {
      const star = scene.add.star(x, y, 5, 6, 10, 0xffdd44, 1);
      star.setDepth(37);
      const cleanup = () => { if (star.active) star.destroy(); };
      scene.tweens.add({
        targets: star, scale: 2, alpha: 0, rotation: Math.PI, duration: 400,
        onComplete: cleanup,
        onStop: cleanup,
      });
    }
  }

  /** 普攻命中 */
  static boltHit(scene: Phaser.Scene, x: number, y: number): void {
    VFX.burst(scene, x, y, 3, [0x88ccff, 0xffffff, 0xaaddff], 50, 2, 200);
    const spark = scene.add.circle(x, y, 3, 0xffffff, 0.9);
    spark.setDepth(40);
    const cleanup = () => { if (spark.active) spark.destroy(); };
    scene.tweens.add({
      targets: spark, scale: 3, alpha: 0, duration: 150,
      onComplete: cleanup,
      onStop: cleanup,
    });
  }

  // ═══════════════════════════════════
  // 古建特效
  // ═══════════════════════════════════

  /** 古建受击碎屑 */
  static buildingHit(scene: Phaser.Scene, x: number, y: number, type: string): void {
    const colorMap: Record<string, number[]> = {
      wood: [0xc4884d, 0xa07040, 0x8b6914],
      stone: [0x999999, 0x888888, 0xaaaaaa],
      tile: [0xa0522d, 0x8b4513, 0xb0603d],
      painting: [0x9966cc, 0x8855bb, 0xaa77dd],
    };
    const colors = colorMap[type] ?? [0xcccccc];
    VFX.burst(scene, x, y, 5, colors, 90, 2, 350);
    VFX.shake(scene, 0.005, 100);
  }

  // ═══════════════════════════════════
  // Boss 特效
  // ═══════════════════════════════════

  /** Boss 出场（紫色能量爆发 + 闪电环） */
  static bossAppear(scene: Phaser.Scene, x: number, y: number): void {
    // 大型紫色冲击波
    VFX.shockwave(scene, x, y, 250, 0xAA44FF, 1000);
    // 多层圆环
    for (let r = 0; r < 4; r++) {
      const ring = scene.add.circle(x, y, 5, 0, 0);
      ring.setStrokeStyle(4 - r, 0xAA44FF, 0.9 - r * 0.18);
      ring.setDepth(38);
      const cleanup = () => { if (ring.active) ring.destroy(); };
      scene.tweens.add({
        targets: ring,
        radius: 150 + r * 30,
        alpha: 0,
        duration: 700 + r * 150,
        delay: r * 80,
        ease: 'Power3',
        onComplete: cleanup,
        onStop: cleanup,
      });
    }
    // 紫色粒子爆散
    VFX.burst(scene, x, y, 30, [0xAA44FF, 0xCC66FF, 0x8822CC, 0xFF66FF, 0xFFFFFF], 250, 5, 800);
    // 全屏闪紫
    scene.cameras.main.flash(400, 100, 50, 150, false);
    VFX.shake(scene, 0.012, 400);
  }

  /** Boss 受击：紫色碎屑 + 大伤害数字 */
  static bossHit(scene: Phaser.Scene, x: number, y: number, damage: number): void {
    VFX.burst(scene, x, y, 5, [0xAA44FF, 0xCC66FF, 0xFFFFFF], 80, 4, 300);
    const color = damage >= 30 ? '#FF44FF' : '#CC88FF';
    const size = damage >= 30 ? '22px' : '18px';
    VFX.floatText(scene, x, y, `${Math.round(damage)}`, color, size);
    VFX.shake(scene, 0.004, 80);
  }

  /** Boss 死亡：巨型紫色爆炸 */
  static bossDeath(scene: Phaser.Scene, x: number, y: number): void {
    // 超大爆散
    VFX.burst(scene, x, y, 50, [0xAA44FF, 0xCC66FF, 0x8822CC, 0xFF66FF, 0xFFFFFF, 0xFFDD88], 350, 6, 1200);
    // 全屏闪白
    scene.cameras.main.flash(500, 255, 255, 255, false);
    VFX.shake(scene, 0.015, 600);
    // 金色冲击波（胜利象征）
    const goldRing = scene.add.circle(x, y, 10, 0, 0);
    goldRing.setStrokeStyle(4, 0xFFD700, 0.9);
    goldRing.setDepth(38);
    const cleanupGold = () => { if (goldRing.active) goldRing.destroy(); };
    scene.tweens.add({
      targets: goldRing,
      radius: 300,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: cleanupGold,
      onStop: cleanupGold,
    });
    // 二次金色粒子
    VFX.burst(scene, x, y, 30, [0xFFD700, 0xFFCC44, 0xFFFFFF], 200, 4, 800);
  }

  /** Boss 出场预警：全屏闪红 + 脉冲 */
  static bossWarning(scene: Phaser.Scene): void {
    // 多次红闪
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(i * 400, () => {
        if (scene.scene.isActive()) {
          scene.cameras.main.flash(150, 200, 30, 30, false);
          VFX.shake(scene, 0.003 + i * 0.003, 100);
        }
      });
    }
    // 红色圆环脉冲
    VFX.shockwave(scene, MAP_WIDTH / 2, MAP_HEIGHT / 2, 500, 0xFF2222, 1200);
  }

  /** 地震波：全屏震动 + 地面裂纹 */
  static bossEarthquake(scene: Phaser.Scene): void {
    VFX.shake(scene, 0.020, 500);
    scene.cameras.main.flash(200, 80, 30, 50, false);
    // 镜头轻微偏移模拟地震
    const origX = scene.cameras.main.scrollX;
    const origY = scene.cameras.main.scrollY;
    scene.tweens.add({
      targets: scene.cameras.main,
      scrollX: origX + (Math.random() - 0.5) * 20,
      scrollY: origY + (Math.random() - 0.5) * 20,
      yoyo: true,
      duration: 50,
      repeat: 5,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        scene.cameras.main.scrollX = origX;
        scene.cameras.main.scrollY = origY;
      },
    });
  }

  /** 古建回血粒子 */
  static buildingHeal(scene: Phaser.Scene, x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const p = scene.add.circle(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 40, 2, 0x44ff88, 0.8);
      p.setDepth(42);
      const cleanup = () => { if (p.active) p.destroy(); };
      scene.tweens.add({
        targets: p, y: p.y - 20, alpha: 0, duration: 600,
        onComplete: cleanup,
        onStop: cleanup,
      });
    }
  }

  // ═══ pipi3 新增技能特效 ═══

  static skillRepairField(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    VFX.shockwave(scene, x, y, radius * 0.95, 0x88ff66, 760);
    VFX.burst(scene, x, y, 18 + lv * 5, [0x88ff66, 0xaaff88, 0xddffcc, 0xffffff], 120, 4, 950);
  }

  static repairFieldPulse(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number, orbCount: number): void {
    VFX.shockwave(scene, x, y, radius, 0x99ff66, 420);
    for (let i = 0; i < orbCount; i++) {
      const a = (Math.PI * 2 * i) / orbCount;
      const sx = x + Math.cos(a) * radius * 0.45, sy = y + Math.sin(a) * radius * 0.45;
      const p = scene.add.circle(sx, sy, 3 + (i % 2), 0xaaff88, 0.9);
      p.setDepth(42);
      scene.tweens.add({
        targets: p, x: sx + Math.cos(a) * 22, y: sy + Math.sin(a) * 22 - 10,
        alpha: 0, scale: 0.3, duration: 700 + lv * 100,
        onComplete: () => p.destroy(),
      });
    }
  }

  static skillWhirlwind(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    for (let i = 0; i < 2 + lv; i++) {
      const arc = scene.add.arc(x, y, 32 + i * 12, -55, 55, false, 0x00c8ff, 0);
      arc.setStrokeStyle(4 - Math.min(i, 2), 0x66ddff, 0.9 - i * 0.12);
      arc.setDepth(36);
      arc.rotation = Phaser.Math.DegToRad(-18 + i * 22);
      scene.tweens.add({
        targets: arc, x: x + 28 + i * 8, rotation: arc.rotation + Math.PI * 0.9,
        alpha: 0, duration: 480, ease: 'Sine.easeOut',
        onComplete: () => arc.destroy(),
      });
    }
    VFX.burst(scene, x + 18, y, 10 + lv * 2, [0x66ddff, 0xaaddff, 0xffffff], 90, 3, 380);
  }

  static whirlwindHit(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    const arc = scene.add.arc(x, y, 42 + lv * 10, -70, 70, false, 0x00c8ff, 0);
    arc.setStrokeStyle(4, 0x99f0ff, 0.9);
    arc.setDepth(37);
    arc.rotation = Phaser.Math.DegToRad((scene.time.now / 5) % 360);
    scene.tweens.add({
      targets: arc, rotation: arc.rotation + Math.PI * 1.3, alpha: 0, duration: 260,
      onComplete: () => arc.destroy(),
    });
    VFX.burst(scene, x, y, 12 + lv * 2, [0x66ddff, 0xaaddff, 0xffffff], 130, 3, 360);
    VFX.shockwave(scene, x, y, 44 + lv * 12, 0x66ddff, 280);
  }

  static skillFireRain(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    VFX.burst(scene, x, y, 8 + lv * 2, [0xffaa33, 0xff6633, 0xffee88], 100, 3, 420);
    VFX.shockwave(scene, x, y, radius * 0.45, 0xff8844, 320);
  }

  static fireRainMarker(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    const mark = scene.add.circle(x, y, 10, 0xffaa33, 0.12);
    mark.setStrokeStyle(2, 0xff8844, 0.8);
    mark.setDepth(34);
    scene.tweens.add({
      targets: mark, radius: 22 + lv * 3, alpha: 0, duration: 220,
      onComplete: () => mark.destroy(),
    });
  }

  static fireRainImpact(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    const pillar = scene.add.rectangle(x, y - 40, 10, 90, 0xffaa33, 0.9);
    pillar.setDepth(38);
    scene.tweens.add({
      targets: pillar, y: y, alpha: 0, duration: 180,
      onComplete: () => pillar.destroy(),
    });
    VFX.burst(scene, x, y, 12 + lv * 2, [0xffcc44, 0xff8844, 0xff4422, 0xffffff], 170, 4, 420);
    VFX.shockwave(scene, x, y, Math.max(24, radius), 0xff6633, 260);
    VFX.shake(scene, 0.003 + lv * 0.001, 70);
  }

  static skillLightningCast(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    VFX.burst(scene, x, y, 16 + lv * 4, [0x66ccff, 0xffffff, 0x99eeff], 220, 4, 520);
    VFX.flash(scene, 80);
  }

  static lightningArc(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number, _fromPlayer: boolean, lv: number): void {
    const g = scene.add.graphics();
    g.setDepth(39);
    g.lineStyle(_fromPlayer ? 5 : 4, _fromPlayer ? 0x99eeff : 0x66ccff, 0.98);
    g.beginPath();
    g.moveTo(x1, y1);
    const segments = 6 + lv;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const px = Phaser.Math.Linear(x1, x2, t) + Phaser.Math.Between(-10, 10);
      const py = Phaser.Math.Linear(y1, y2, t) + Phaser.Math.Between(-10, 10);
      g.lineTo(px, py);
    }
    g.lineTo(x2, y2);
    g.strokePath();
    const splash = scene.add.circle(x2, y2, 5, 0xaaddff, 0.9);
    splash.setDepth(40);
    scene.tweens.add({
      targets: [g, splash], alpha: 0, duration: 180,
      onComplete: () => { g.destroy(); splash.destroy(); },
    });
  }

  static woodImpact(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    const count = lv >= 3 ? 18 : 12;
    VFX.burst(scene, x, y, count, [0xc4884d, 0xdaa060, 0x8b6914, 0xffdd88], 180, 4, 520);
    VFX.shockwave(scene, x, y, lv >= 3 ? 48 : 34, 0xc4884d, 340);
  }

  static waterImpact(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    VFX.burst(scene, x, y, lv >= 3 ? 18 : 12, [0x4488cc, 0x66bbee, 0xaaddff, 0xffffff], 150, 4, 620);
    VFX.shockwave(scene, x, y, Math.max(24, radius * 1.1), 0x66bbee, 360);
    const flash = scene.add.circle(x, y, 6, 0xddeeff, 0.8);
    flash.setDepth(38);
    scene.tweens.add({
      targets: flash, scale: 3.5, alpha: 0, duration: 260,
      onComplete: () => flash.destroy(),
    });
  }

  static insectTick(scene: Phaser.Scene, x: number, y: number, radius: number): void {
    VFX.shockwave(scene, x, y, Math.max(24, radius * 1.2), 0x66dd66, 260);
    VFX.burst(scene, x, y, 8, [0x44cc44, 0x88cc44, 0xccee88], 100, 3, 420);
  }

  static paintImpact(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    const colors = [0xff4488, 0xff8800, 0xffee00, 0x44ff88, 0x4488ff, 0xcc44ff];
    VFX.burst(scene, x, y, lv >= 3 ? 22 : 16, colors, 210, 5, 650);
    VFX.shockwave(scene, x, y, Math.max(28, radius * 1.15), 0xff66cc, 380);
  }
}
