/**
 * VFX — 战斗手感特效模块
 * 命中反馈、死亡爆破、升级庆祝、碎屑粒子、屏幕震动
 */
import Phaser from 'phaser';
import { MAP_WIDTH, MAP_HEIGHT } from './config';

export class VFX {
  // ═══════════════════════════════════
  // 粒子工具
  // ═══════════════════════════════════

  /** 发射一组彩色粒子爆散 */
  static burst(
    scene: Phaser.Scene, x: number, y: number,
    count: number, colors: number[], speed = 120, size = 3, lifetime = 400,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random());
      const c = colors[Math.floor(Math.random() * colors.length)];
      const p = scene.add.circle(x, y, size, c, 1);
      p.setDepth(40);
      scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * spd * (lifetime / 1000),
        y: y + Math.sin(angle) * spd * (lifetime / 1000),
        alpha: 0,
        scale: 0.2,
        duration: lifetime,
        ease: 'Power2',
        onComplete: () => p.destroy(),
      });
    }
  }

  /** 冲击波扩散圈 */
  static shockwave(scene: Phaser.Scene, x: number, y: number, radius: number, color: number, duration = 300): void {
    const ring = scene.add.circle(x, y, 5, color, 0);
    ring.setStrokeStyle(3, color, 0.8);
    ring.setDepth(35);
    scene.tweens.add({
      targets: ring,
      radius: radius,
      alpha: 0,
      duration,
      ease: 'Power2',
      onUpdate: () => {
        ring.setStrokeStyle(2, color, ring.alpha * 0.8);
      },
      onComplete: () => ring.destroy(),
    });
  }

  /** 屏幕震动（强度随伤害递增） */
  static shake(scene: Phaser.Scene, intensity = 0.005, duration = 80): void {
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
    scene.tweens.add({
      targets: t, y: t.y - 36, alpha: 0, duration: 700, ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  // ═══════════════════════════════════
  // 战斗反馈
  // ═══════════════════════════════════

  /** 怪物受击反馈 */
  static hitMonster(scene: Phaser.Scene, x: number, y: number, damage: number, _attackerX?: number, _attackerY?: number): void {
    // 白碎屑
    VFX.burst(scene, x, y, 3, [0xffffff, 0xcccccc], 60, 2, 200);
    // 伤害数字（大伤害红色，偶数字号）
    const color = damage >= 20 ? '#ff4444' : damage >= 10 ? '#ffaa44' : '#ffffff';
    const size = damage >= 20 ? '16px' : '14px';
    // 微小随机抖动（复古像素感）
    VFX.floatText(scene, x + (Math.random() - 0.5) * 4, y, `${Math.round(damage)}`, color, size);
    // 微震
    if (damage >= 15) VFX.shake(scene, 0.002, 50);
  }

  /** 怪物死亡 */
  static killMonster(scene: Phaser.Scene, x: number, y: number, color: number): void {
    // 主爆散
    VFX.burst(scene, x, y, 10, [color, 0xffffff, 0xffdd88], 150, 3, 500);
    // 冲击波
    VFX.shockwave(scene, x, y, 40, color, 350);
    // 微震
    VFX.shake(scene, 0.003, 60);
    // 白色闪光
    const flash = scene.add.circle(x, y, 8, 0xffffff, 1);
    flash.setDepth(39);
    scene.tweens.add({
      targets: flash, scale: 4, alpha: 0, duration: 150,
      onComplete: () => flash.destroy(),
    });
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
      scene.tweens.add({
        targets: p,
        x: tx,
        y: ty - 20,
        alpha: 0,
        scale: 0.3,
        duration: 800,
        delay: i * 30,
        ease: 'Power2',
        onComplete: () => p.destroy(),
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
    scene.tweens.add({
      targets: flash, scale: 3, alpha: 0, duration: 200,
      onComplete: () => flash.destroy(),
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
      scene.tweens.add({
        targets: ring,
        radius: radius * (0.7 + r * 0.2),
        alpha: 0,
        duration: 350 + r * 100,
        delay: r * 50,
        ease: 'Power3',
        onComplete: () => ring.destroy(),
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
        scene.tweens.add({
          targets: rock,
          x: x + Math.cos(a) * 120,
          y: y + Math.sin(a) * 120,
          alpha: 0, rotation: rock.rotation + Math.PI * 2,
          duration: 600,
          ease: 'Power2',
          onComplete: () => rock.destroy(),
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
      scene.tweens.add({
        targets: ring,
        radius: radius * (0.5 + r * 0.15),
        alpha: 0,
        duration: 450 + r * 120,
        delay: r * 40,
        ease: 'Sine.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
    // 水珠喷溅
    VFX.burst(scene, x, y, lv >= 3 ? 16 : 10, [0x4488cc, 0x66bbee, 0xaaddff, 0xddeeff], 100, 3, 600);
    // 中心水柱闪光
    const pillar = scene.add.rectangle(x, y, 8, 4, 0xddeeff, 0.6);
    pillar.setDepth(36);
    scene.tweens.add({
      targets: pillar, scaleY: 4, scaleX: 0.3, alpha: 0, duration: 300,
      onComplete: () => pillar.destroy(),
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
      scene.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0, scale: 2.5,
        duration: 1200 + Math.random() * 600,
        ease: 'Sine.easeOut',
        onComplete: () => p.destroy(),
      });
    }
    // 草药碎屑
    if (lv >= 2) {
      for (let i = 0; i < 8; i++) {
        const s = scene.add.rectangle(x + (Math.random() - 0.5) * 40, y - 20, 3, 3, 0x88cc44, 0.7);
        s.setDepth(19);
        scene.tweens.add({
          targets: s, y: s.y + 30 + Math.random() * 20, x: s.x + (Math.random() - 0.5) * 30,
          alpha: 0, rotation: Math.random() * 3, duration: 1500,
          onComplete: () => s.destroy(),
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
      scene.tweens.add({
        targets: ring, radius: 50 + r * 15, alpha: 0, duration: 300 + r * 60,
        ease: 'Power2', onComplete: () => ring.destroy(),
      });
    }
    // Lv3 弹射标记
    if (lv >= 3) {
      const star = scene.add.star(x, y, 5, 6, 10, 0xffdd44, 1);
      star.setDepth(37);
      scene.tweens.add({
        targets: star, scale: 2, alpha: 0, rotation: Math.PI, duration: 400,
        onComplete: () => star.destroy(),
      });
    }
  }

  /** 木梁命中：木屑爆散 + 琥珀冲击圈 */
  static woodImpact(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    const count = lv >= 3 ? 10 : 6;
    VFX.burst(scene, x, y, count, [0xc4884d, 0xdaa060, 0x8b6914, 0xffdd88], 120, 3, 320);
    VFX.shockwave(scene, x, y, lv >= 3 ? 34 : 24, 0xc4884d, 220);
  }

  /** 水流命中：水花喷溅 + 冷色爆闪 */
  static waterImpact(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    VFX.burst(scene, x, y, lv >= 3 ? 12 : 8, [0x4488cc, 0x66bbee, 0xaaddff, 0xffffff], 110, 3, 420);
    VFX.shockwave(scene, x, y, Math.max(18, radius), 0x66bbee, 260);
    const flash = scene.add.circle(x, y, 6, 0xddeeff, 0.8);
    flash.setDepth(38);
    scene.tweens.add({
      targets: flash,
      scale: 3.5,
      alpha: 0,
      duration: 180,
      onComplete: () => flash.destroy(),
    });
  }

  /** 药雾跳动：绿色脉冲 + 草药微粒 */
  static insectTick(scene: Phaser.Scene, x: number, y: number, radius: number): void {
    VFX.shockwave(scene, x, y, Math.max(18, radius), 0x66dd66, 180);
    VFX.burst(scene, x, y, 4, [0x44cc44, 0x88cc44, 0xccee88], 70, 2, 260);
  }

  /** 颜料爆破：彩色溅射 + 环形炸开 */
  static paintImpact(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    const colors = [0xff4488, 0xff8800, 0xffee00, 0x44ff88, 0x4488ff, 0xcc44ff];
    VFX.burst(scene, x, y, lv >= 3 ? 14 : 10, colors, 150, 4, 420);
    VFX.shockwave(scene, x, y, Math.max(20, radius), 0xff66cc, 260);
  }

  /** 普攻命中 */
  static boltHit(scene: Phaser.Scene, x: number, y: number): void {
    VFX.burst(scene, x, y, 3, [0x88ccff, 0xffffff, 0xaaddff], 50, 2, 200);
    const spark = scene.add.circle(x, y, 3, 0xffffff, 0.9);
    spark.setDepth(40);
    scene.tweens.add({
      targets: spark, scale: 3, alpha: 0, duration: 150,
      onComplete: () => spark.destroy(),
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
      scene.tweens.add({
        targets: ring,
        radius: 150 + r * 30,
        alpha: 0,
        duration: 700 + r * 150,
        delay: r * 80,
        ease: 'Power3',
        onComplete: () => ring.destroy(),
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
    scene.tweens.add({
      targets: goldRing,
      radius: 300,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => goldRing.destroy(),
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
      scene.tweens.add({
        targets: p, y: p.y - 20, alpha: 0, duration: 600,
        onComplete: () => p.destroy(),
      });
    }
  }
}
