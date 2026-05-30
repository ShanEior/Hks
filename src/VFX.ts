/**
 * VFX — 战斗手感特效模块
 * 命中反馈、死亡爆破、升级庆祝、碎屑粒子、屏幕震动
 * 支持夜雀食堂 FX 精灵（备用程序化 fallback）
 */
import Phaser from 'phaser';
import { MAP_WIDTH, MAP_HEIGHT } from './config';
import { nthKey } from './SpriteLoader';

export class VFX {
  // ═══════════════════════════════════
  // 精灵粒子工具（优先使用素材）
  // ═══════════════════════════════════

  /** 发射一组精灵粒子爆散（有素材用素材，没有回退程序化） */
  static spriteBurst(
    scene: Phaser.Scene, x: number, y: number,
    count: number, cat: string, speed = 100, scale = 0.5, lifetime = 500,
  ): void {
    const hasSprite = scene.textures.exists(nthKey(cat, 0));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.6);
      const dist = spd * (lifetime / 1000);

      if (hasSprite) {
        const key = nthKey(cat, i);
        const img = scene.add.image(x, y, key);
        img.setScale(scale * (0.5 + Math.random())).setDepth(40).setAlpha(0.9);
        if (Math.random() > 0.5) img.setFlipX(true);
        img.setAngle(Math.random() * 360);
        scene.tweens.add({
          targets: img,
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist,
          alpha: 0, scale: scale * 0.2,
          duration: lifetime,
          ease: 'Power2',
          onComplete: () => img.destroy(),
        });
      } else {
        // fallback: 小方块
        const colors = [0xcccccc, 0xffffff, 0xaaaaaa];
        const c = colors[i % colors.length];
        const p = scene.add.rectangle(x, y, 4, 4, c, 0.8);
        p.setDepth(40);
        scene.tweens.add({
          targets: p,
          x: x + Math.cos(angle) * dist * 0.6,
          y: y + Math.sin(angle) * dist * 0.6,
          alpha: 0, scale: 0.2,
          duration: lifetime,
          ease: 'Power2',
          onComplete: () => p.destroy(),
        });
      }
    }
  }

  /** 放置一个精灵并从中心扩散消失（适合冲击/命中） */
  static spritePop(
    scene: Phaser.Scene, x: number, y: number,
    cat: string, index: number, scale0 = 0.3, scale1 = 1.5, duration = 400,
  ): void {
    const key = nthKey(cat, index);
    if (!scene.textures.exists(key)) return;
    const img = scene.add.image(x, y, key);
    img.setScale(scale0).setDepth(40).setAlpha(0.9);
    scene.tweens.add({
      targets: img,
      scale: scale1, alpha: 0,
      duration,
      ease: 'Power2',
      onComplete: () => img.destroy(),
    });
  }

  // ═══════════════════════════════════
  // 粒子工具（保留原有程序化方法）
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

  /** 怪物受击 */
  static hitMonster(scene: Phaser.Scene, x: number, y: number, damage: number, _attackerX?: number, _attackerY?: number): void {
    VFX.spriteBurst(scene, x, y, 2, 'fx_ghost', 50, 0.2, 200);
    VFX.burst(scene, x, y, 2, [0xffffff, 0xcccccc], 40, 1, 180);
    const color = damage >= 20 ? '#ff4444' : damage >= 10 ? '#ffaa44' : '#ffffff';
    const size = damage >= 20 ? '16px' : '14px';
    VFX.floatText(scene, x + (Math.random() - 0.5) * 4, y, `${Math.round(damage)}`, color, size);
    if (damage >= 15) VFX.shake(scene, 0.002, 50);
  }

  /** 怪物死亡 */
  static killMonster(scene: Phaser.Scene, x: number, y: number, color: number): void {
    VFX.spriteBurst(scene, x, y, 8, 'fx_ghost', 130, 0.4, 450);
    VFX.burst(scene, x, y, 6, [color, 0xffffff, 0xffdd88], 120, 2, 400);
    VFX.shockwave(scene, x, y, 40, color, 350);
    VFX.shake(scene, 0.003, 60);
    const flash = scene.add.circle(x, y, 8, 0xffffff, 1);
    flash.setDepth(39);
    scene.tweens.add({
      targets: flash, scale: 4, alpha: 0, duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  /** 升级庆祝 — 金币粒子+螺旋上升 */
  static levelUp(scene: Phaser.Scene, x: number, y: number): void {
    // 金币/星星精灵螺旋上升
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const dist = 24 + Math.random() * 36;
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist - 30 * Math.random();

      const key = nthKey('fx_particle', i);
      if (scene.textures.exists(key)) {
        const img = scene.add.image(x, y, key);
        img.setScale(0.4).setDepth(45);
        scene.tweens.add({
          targets: img, x: tx, y: ty - 20, alpha: 0, scale: 0.6,
          duration: 800, delay: i * 30, ease: 'Power2',
          onComplete: () => img.destroy(),
        });
      } else {
        const p = scene.add.circle(x, y, 3, 0xffdd44, 1);
        p.setDepth(45);
        scene.tweens.add({
          targets: p, x: tx, y: ty - 20, alpha: 0, scale: 0.3,
          duration: 800, delay: i * 30, ease: 'Power2',
          onComplete: () => p.destroy(),
        });
      }
    }
    VFX.shockwave(scene, x, y, 80, 0xffdd44, 500);
    VFX.flash(scene, 80);
    VFX.shake(scene, 0.004, 100);
  }

  // ═══════════════════════════════════
  // 技能特效（大幅增强版）
  // ═══════════════════════════════════

  /** 木构加固：木梁冲击波 — 碎木精灵+裂纹 */
  static skillWood(scene: Phaser.Scene, x: number, y: number, _angle: number, lv: number): void {
    // 碎木精灵爆散
    VFX.spriteBurst(scene, x, y, lv >= 3 ? 12 : 6, 'fx_ghost', 120, 0.4, 450);
    // 地面裂纹
    VFX.spritePop(scene, x, y, 'fx_crack', 0, 0.5, lv >= 3 ? 2.0 : 1.2, 500);
    // 发射闪光
    const flash = scene.add.circle(x, y, 8, 0xffffff, 0.9);
    flash.setDepth(21);
    scene.tweens.add({
      targets: flash, scale: 4, alpha: 0, duration: 200,
      onComplete: () => flash.destroy(),
    });
    // Lv3 金色强化波
    if (lv >= 3) {
      VFX.shockwave(scene, x, y, 60, 0xffdd44, 400);
      VFX.spriteBurst(scene, x, y, 8, 'fx_particle', 80, 0.3, 350);
    }
  }

  /** 石材修补：多层震波+碎石+裂纹精灵 */
  static skillStone(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    // 3层震波
    const ringColors = [0x666666, 0x999999, 0xcccccc];
    for (let r = 0; r < 3; r++) {
      const ring = scene.add.circle(x, y, 4, 0, 0);
      ring.setStrokeStyle(3 - r * 0.8, ringColors[r], 1 - r * 0.25);
      ring.setDepth(35);
      scene.tweens.add({
        targets: ring, radius: radius * (0.7 + r * 0.2), alpha: 0,
        duration: 350 + r * 100, delay: r * 50, ease: 'Power3',
        onComplete: () => ring.destroy(),
      });
    }
    // 碎石精灵爆散
    VFX.spriteBurst(scene, x, y, lv >= 3 ? 14 : 8, 'fx_ghost', 160, 0.35, 500);
    // 地面裂纹
    VFX.spritePop(scene, x, y, 'fx_crack', 0, 0.4, lv >= 3 ? 1.8 : 1.0, 450);
    // 震波粒子
    VFX.burst(scene, x, y, lv >= 3 ? 10 : 6, [0x888888, 0xaaaaaa, 0xcccccc], 120, 2, 400);
  }

  /** 防水封护：多层水纹+幽灵精灵扩散 */
  static skillWater(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    const layers = lv >= 3 ? 5 : 3;
    for (let r = 0; r < layers; r++) {
      const ring = scene.add.circle(x, y, 6, 0, 0);
      ring.setStrokeStyle(3 - r * 0.4, 0x4488cc, 0.8 - r * 0.12);
      ring.setDepth(35);
      scene.tweens.add({
        targets: ring, radius: radius * (0.5 + r * 0.15), alpha: 0,
        duration: 450 + r * 120, delay: r * 40, ease: 'Sine.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
    // 水纹精灵扩散
    VFX.spriteBurst(scene, x, y, lv >= 3 ? 10 : 6, 'fx_ghost', 90, 0.3, 550);
    VFX.burst(scene, x, y, lv >= 3 ? 8 : 5, [0x4488cc, 0x66bbee, 0xaaddff], 80, 2, 500);
    // 中心闪光
    const pillar = scene.add.rectangle(x, y, 8, 4, 0xddeeff, 0.6);
    pillar.setDepth(36);
    scene.tweens.add({
      targets: pillar, scaleY: 4, scaleX: 0.3, alpha: 0, duration: 300,
      onComplete: () => pillar.destroy(),
    });
  }

  /** 防虫处理：浓密药雾+精灵粒子 */
  static skillInsect(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    const count = lv >= 3 ? 20 : 12;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * radius * 0.85;
      const p = scene.add.circle(x + Math.cos(a) * d * 0.2, y + Math.sin(a) * d * 0.2, 5, 0x44cc44, 0.35);
      p.setDepth(18);
      scene.tweens.add({
        targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        alpha: 0, scale: 2.5, duration: 1200 + Math.random() * 600, ease: 'Sine.easeOut',
        onComplete: () => p.destroy(),
      });
    }
    // 精灵药雾
    VFX.spriteBurst(scene, x, y, lv >= 2 ? 8 : 4, 'fx_ghost', 60, 0.25, 800);
  }

  /** 彩绘修复：彩虹拖尾+精灵爆炸 */
  static skillPaint(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    const colors = [0xff4488, 0xff8800, 0xffee00, 0x44ff88, 0x4488ff, 0xcc44ff];
    // 精灵彩色爆散
    VFX.spriteBurst(scene, x, y, lv >= 2 ? 10 : 6, 'fx_particle', 130, 0.45, 500);
    // 彩色冲击波
    for (let r = 0; r < 3; r++) {
      const ring = scene.add.circle(x, y, 4, 0, 0);
      ring.setStrokeStyle(2, colors[r * 2], 0.8).setDepth(35);
      scene.tweens.add({
        targets: ring, radius: 50 + r * 15, alpha: 0, duration: 300 + r * 60,
        ease: 'Power2', onComplete: () => ring.destroy(),
      });
    }
    // Lv3 金色弹射
    if (lv >= 3) {
      VFX.spriteBurst(scene, x, y, 6, 'fx_particle', 160, 0.5, 400);
    }
  }

  /** 普攻命中 */
  static boltHit(scene: Phaser.Scene, x: number, y: number): void {
    VFX.spritePop(scene, x, y, 'fx_ghost', 0, 0.15, 0.8, 250);
    VFX.burst(scene, x, y, 2, [0x88ccff, 0xffffff], 40, 1, 180);
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
