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

  /** 发射一组彩色粒子爆散（GPU 批处理，单次 draw call）
   * @param texture  粒子纹理 key，默认 'px_white'，可传入 Terraria 特效纹理
   */
  static burst(
    scene: Phaser.Scene, x: number, y: number,
    count: number, colors: number[], speed = 120, size = 3, lifetime = 400,
    texture = 'px_white',
  ): void {
    // 确保粒子纹理存在，退回到白方块
    const texKey = scene.textures.exists(texture) ? texture : 'px_white';
    if (!scene.textures.exists(texKey)) return;

    const emitter = scene.add.particles(x, y, texKey, {
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

  /** 推荐的粒子纹理池（从 Terraria 特效精选） */
  static readonly PARTICLE_POOL = {
    glow:        'fx_glow_64',
    spark:       'fx_bolt_hit',
    star:        'fx_star_34',
    dust:        'fx_dust_16',
    ring:        'fx_ring_42',
    slash:       'fx_slash',
    impact:      'fx_impact',
    heal:        'fx_heal',
    boss_ring:   'fx_boss_ring',
    bolt:        'fx_bolt_extra',
  };

  /** 随机选一个粒子纹理 key */
  static randomParticleTexture(): string {
    const pool = Object.values(VFX.PARTICLE_POOL).filter(k => {
      // 延迟检查：运行时由 scene 判断
      return true;
    });
    return pool[Math.floor(Math.random() * pool.length)] || 'px_white';
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
    VFX.burst(scene, x, y, 3, particleColors, 60, 2, 200, 'fx_dust_16');

    // 方向性冲击粒子（沿攻击方向的受力视觉）
    if (_attackerX !== undefined && _attackerY !== undefined) {
      const dir = Math.atan2(y - _attackerY, x - _attackerX);
      const spread = 0.6; // ±35° 扇形
      for (let i = 0; i < 3; i++) {
        const a = dir + (Math.random() - 0.5) * spread;
        const spd = 80 + Math.random() * 40;
        const c = particleColors[Math.floor(Math.random() * particleColors.length)];
        const p = scene.add.circle(x, y, 2, c, 0.8);
        p.setDepth(40);
        const cleanup = () => { if (p.active) p.destroy(); };
        scene.tweens.add({
          targets: p,
          x: x + Math.cos(a) * spd * 0.25,
          y: y + Math.sin(a) * spd * 0.25,
          alpha: 0, scale: 0.2,
          duration: 180, ease: 'Power2',
          onComplete: cleanup, onStop: cleanup,
        });
      }
    }

    // 伤害数字（按伤害值分层 + 元素底色）
    const tier: DamageNumberTier = damage >= 30 ? 'heavy' : 'normal';
    const style = DAMAGE_NUMBER_CONFIG[tier];
    const color = damage >= 20 ? '#ff4444' : damage >= 10 ? '#ffaa44' : baseColor;
    const size = style.size;
    VFX.floatText(scene, x + (Math.random() - 0.5) * 4, y, `${Math.round(damage)}`, color, size);

  }

  /** 怪物死亡 */
  static killMonster(scene: Phaser.Scene, x: number, y: number, color: number, monsterType?: MonsterType): void {
    const elem = monsterType ? ELEMENT_COLORS[monsterType] : null;
    const burstColors = elem ? elem.particles : [color, 0xffffff, 0xffdd88];
    const ringColor = elem ? elem.flash : color;

    // 主爆散
    VFX.burst(scene, x, y, 10, burstColors, 150, 3, 500, 'fx_bolt_hit');
    // 冲击波
    VFX.shockwave(scene, x, y, 40, ringColor, 350);
    // 白色闪光（淡）
    const flash = scene.add.circle(x, y, 6, 0xffffff, 0.6);
    flash.setDepth(39);
    const cleanup = () => { if (flash.active) flash.destroy(); };
    scene.tweens.add({
      targets: flash, scale: 2.5, alpha: 0, duration: 120,
      onComplete: cleanup,
      onStop: cleanup,
    });
  }

  /** 升级庆祝 — 仅金色粒子螺旋上升 + 轻震，摒弃全屏闪 */
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
    // 单一金色扩散圈（柔和）
    VFX.shockwave(scene, x, y, 60, 0xffdd44, 400);
  }

  // ═══════════════════════════════════
  // 技能特效（大幅增强版）
  // ═══════════════════════════════════

  /** 木构加固：木梁冲击波 — 粗梁+年轮纹理+碎木四溅 */
  static skillWood(scene: Phaser.Scene, x: number, y: number, angle: number, lv: number): void {
    // 发射点木屑爆发
    const woodColors = [0xc4884d, 0xdaa060, 0x8b6914, 0xffdd88];
    VFX.burst(scene, x, y, lv >= 3 ? 15 : 8, woodColors, 100, 3, 400, 'fx_dust_16');
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
    // 5层震波（灰→浅灰→白）
    const ringColors = [0x555555, 0x777777, 0x999999, 0xbbbbbb, 0xdddddd];
    for (let r = 0; r < 5; r++) {
      const ring = scene.add.circle(x, y, 4, 0, 0);
      ring.setStrokeStyle(4 - r * 0.6, ringColors[r], 1 - r * 0.15);
      ring.setDepth(35);
      const cleanup = () => { if (ring.active) ring.destroy(); };
      scene.tweens.add({
        targets: ring,
        radius: radius * (0.6 + r * 0.2),
        alpha: 0,
        duration: 400 + r * 120,
        delay: r * 40,
        ease: 'Power3',
        onComplete: cleanup,
        onStop: cleanup,
      });
    }
    // 碎石爆散（更浓密）
    const count = lv >= 3 ? 30 : 20;
    VFX.burst(scene, x, y, count, [0x888888, 0xaaaaaa, 0x999999, 0xcccccc, 0x777777, 0xdddddd], 220, 4, 550, 'fx_bolt_hit');
    VFX.shake(scene, 0.006, 80);
    // 中心闪光
    const flash = scene.add.circle(x, y, 5, 0xffffff, 0.5);
    flash.setDepth(36);
    scene.tweens.add({
      targets: flash, scale: 2.5, alpha: 0, duration: 250,
      onComplete: () => { if (flash.active) flash.destroy(); },
    });
    // Lv2+ 大石块
    if (lv >= 2) {
      const rockCount = lv >= 3 ? 8 : 4;
      for (let i = 0; i < rockCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const rock = scene.add.rectangle(x, y, 7, 7, 0x777777, 1);
        rock.setDepth(36);
        rock.setRotation(Math.random() * Math.PI);
        const cleanup = () => { if (rock.active) rock.destroy(); };
        scene.tweens.add({
          targets: rock,
          x: x + Math.cos(a) * 160,
          y: y + Math.sin(a) * 160,
          alpha: 0, rotation: rock.rotation + Math.PI * 2,
          duration: 700,
          ease: 'Power2',
          onComplete: cleanup,
          onStop: cleanup,
        });
      }
    }
  }

  /** 石材脉冲命中：碎石环 + 灰白粒子爆散 */
  static stonePulse(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    // 灰白碎石环（更大更浓）
    VFX.shockwave(scene, x, y, 36 + lv * 8, 0xaaaaaa, 320);
    // 碎石子 burst
    VFX.burst(scene, x, y, 10 + lv * 3, [0x888888, 0xaaaaaa, 0xcccccc, 0xdddddd, 0xffffff], 140, 4, 400, 'fx_bolt_hit');
    // 震屏
    VFX.shake(scene, 0.004, 60);
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
    VFX.burst(scene, x, y, lv >= 3 ? 16 : 10, [0x4488cc, 0x66bbee, 0xaaddff, 0xddeeff], 100, 3, 600, 'fx_ring_42');
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
    VFX.burst(scene, x, y, lv >= 2 ? 10 : 6, colors, 120, 4, 500, 'fx_star_34');
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
    VFX.burst(scene, x, y, 3, [0x88ccff, 0xffffff, 0xaaddff], 50, 2, 200, 'fx_bolt_hit');
    // 精灵冲击波（优先）+ procedural 圆环 fallback
    if (scene.textures.exists('fx_impact')) {
      const ring = scene.add.image(x, y, 'fx_impact').setAlpha(0.9).setDepth(40).setScale(0.5);
      scene.tweens.add({
        targets: ring, scale: 2.0, alpha: 0, duration: 180,
        onComplete: () => ring.destroy(),
      });
    } else {
      const spark = scene.add.circle(x, y, 3, 0xffffff, 0.9);
      spark.setDepth(40);
      scene.tweens.add({
        targets: spark, scale: 3, alpha: 0, duration: 150,
        onComplete: () => spark.destroy(),
      });
    }
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
    VFX.burst(scene, x, y, 5, colors, 90, 2, 350, 'fx_dust_16');
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
    VFX.burst(scene, x, y, 30, [0xAA44FF, 0xCC66FF, 0x8822CC, 0xFF66FF, 0xFFFFFF], 250, 5, 800, 'fx_glow_64');
    // Boss 精灵冲击波叠加
    if (scene.textures.exists('fx_boss_ring')) {
      const bossRing = scene.add.image(x, y, 'fx_boss_ring').setAlpha(0.7).setDepth(39).setScale(0.2);
      scene.tweens.add({
        targets: bossRing, scale: 1.5, alpha: 0, duration: 900, ease: 'Power2',
        onComplete: () => bossRing.destroy(),
      });
    }
    // 全屏闪紫
    scene.cameras.main.flash(400, 100, 50, 150, false);
    VFX.shake(scene, 0.012, 400);
  }

  /** Boss 受击：紫色碎屑 + 大伤害数字 */
  static bossHit(scene: Phaser.Scene, x: number, y: number, damage: number): void {
    VFX.burst(scene, x, y, 5, [0xAA44FF, 0xCC66FF, 0xFFFFFF], 80, 4, 300, 'fx_glow_64');
    const color = damage >= 30 ? '#FF44FF' : '#CC88FF';
    const size = damage >= 30 ? '22px' : '18px';
    VFX.floatText(scene, x, y, `${Math.round(damage)}`, color, size);
    VFX.shake(scene, 0.004, 80);
  }

  /** Boss 死亡：巨型紫色爆炸 */
  static bossDeath(scene: Phaser.Scene, x: number, y: number): void {
    // 超大爆散
    VFX.burst(scene, x, y, 50, [0xAA44FF, 0xCC66FF, 0x8822CC, 0xFF66FF, 0xFFFFFF, 0xFFDD88], 350, 6, 1200, 'fx_glow_64');
    // 全屏闪白
    scene.cameras.main.flash(500, 255, 255, 255, false);
    VFX.shake(scene, 0.015, 600);
    // Boss 死灵冲击波叠加
    if (scene.textures.exists('fx_boss_ring')) {
      const deathRing = scene.add.image(x, y, 'fx_boss_ring').setAlpha(0.8).setDepth(39).setScale(0.3);
      scene.tweens.add({
        targets: deathRing, scale: 2.0, alpha: 0, duration: 1100, ease: 'Power3',
        onComplete: () => deathRing.destroy(),
      });
    }
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
    VFX.burst(scene, x, y, 30, [0xFFD700, 0xFFCC44, 0xFFFFFF], 200, 4, 800, 'fx_star_34');
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
    VFX.burst(scene, x + 18, y, 10 + lv * 2, [0x66ddff, 0xaaddff, 0xffffff], 90, 3, 380, 'fx_slash');
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
    VFX.burst(scene, x, y, 12 + lv * 2, [0x66ddff, 0xaaddff, 0xffffff], 130, 3, 360, 'fx_slash');
    VFX.shockwave(scene, x, y, 44 + lv * 12, 0x66ddff, 280);
  }

  static skillFireRain(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    VFX.burst(scene, x, y, 8 + lv * 2, [0xffaa33, 0xff6633, 0xffee88], 100, 3, 420, 'fx_glow_64');
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
    VFX.burst(scene, x, y, 12 + lv * 2, [0xffcc44, 0xff8844, 0xff4422, 0xffffff], 170, 4, 420, 'fx_glow_64');
    VFX.shockwave(scene, x, y, Math.max(24, radius), 0xff6633, 260);
    VFX.shake(scene, 0.003 + lv * 0.001, 70);
  }

  static skillLightningCast(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    VFX.burst(scene, x, y, 16 + lv * 4, [0x66ccff, 0xffffff, 0x99eeff], 220, 4, 520, 'fx_bolt_hit');
  }

  static lightningArc(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number, _fromPlayer: boolean, lv: number): void {
    const g = scene.add.graphics();
    g.setDepth(39);
    // 外层粗辉光
    g.lineStyle(_fromPlayer ? 10 : 8, _fromPlayer ? 0x88ccff : 0x5599dd, 0.4);
    g.beginPath();
    g.moveTo(x1, y1);
    const segments = 8 + lv * 2;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jitter = 12 + lv * 3;
      const px = Phaser.Math.Linear(x1, x2, t) + Phaser.Math.Between(-jitter, jitter);
      const py = Phaser.Math.Linear(y1, y2, t) + Phaser.Math.Between(-jitter, jitter);
      g.lineTo(px, py);
    }
    g.lineTo(x2, y2);
    g.strokePath();
    // 内层亮芯
    g.lineStyle(_fromPlayer ? 5 : 4, _fromPlayer ? 0xccffff : 0xaaddff, 0.9);
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jitter = 9 + lv * 2;
      const px = Phaser.Math.Linear(x1, x2, t) + Phaser.Math.Between(-jitter, jitter);
      const py = Phaser.Math.Linear(y1, y2, t) + Phaser.Math.Between(-jitter, jitter);
      g.lineTo(px, py);
    }
    g.lineTo(x2, y2);
    g.strokePath();

    const splash = scene.add.circle(x2, y2, 6, 0xaaddff, 0.9);
    splash.setDepth(40);
    scene.tweens.add({
      targets: [g, splash], alpha: 0, duration: 400,
      onComplete: () => { g.destroy(); splash.destroy(); },
    });
  }

  /** 雷击命中爆发：白蓝闪点 + 4方向电弧 + 金属火花 */
  static lightningImpact(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    // 中心白蓝闪光
    const flash = scene.add.circle(x, y, 4, 0xaaddff, 0.95);
    flash.setDepth(39);
    const cleanupFlash = () => { if (flash.active) flash.destroy(); };
    scene.tweens.add({
      targets: flash, scale: 4.0, alpha: 0, duration: 240,
      onComplete: cleanupFlash, onStop: cleanupFlash,
    });
    // 6 方向电弧（更多、更粗）
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.random() * 0.4;
      const spark = scene.add.rectangle(x, y, 3, 12 + lv * 5, 0xccddff, 0.85);
      spark.setDepth(38);
      spark.setRotation(a);
      const cleanup = () => { if (spark.active) spark.destroy(); };
      scene.tweens.add({
        targets: spark,
        x: x + Math.cos(a) * (22 + lv * 6),
        y: y + Math.sin(a) * (22 + lv * 6),
        alpha: 0, scaleX: 0.2,
        duration: 180,
        onComplete: cleanup, onStop: cleanup,
      });
    }
    // 金属火花 burst
    VFX.burst(scene, x, y, 8 + lv * 2, [0xffffff, 0xaaddff, 0xccddff, 0x88bbff], 140, 2, 300, 'fx_bolt_hit');
    // 微震
    VFX.shake(scene, 0.004, 50);
  }

  static woodImpact(scene: Phaser.Scene, x: number, y: number, lv: number): void {
    const count = lv >= 3 ? 18 : 12;
    VFX.burst(scene, x, y, count, [0xc4884d, 0xdaa060, 0x8b6914, 0xffdd88], 180, 4, 520, 'fx_dust_16');
    VFX.shockwave(scene, x, y, lv >= 3 ? 48 : 34, 0xc4884d, 340);
  }

  static waterImpact(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    VFX.burst(scene, x, y, lv >= 3 ? 18 : 12, [0x4488cc, 0x66bbee, 0xaaddff, 0xffffff], 150, 4, 620, 'fx_ring_42');
    VFX.shockwave(scene, x, y, Math.max(24, radius * 1.1), 0x66bbee, 360);
    const flash = scene.add.circle(x, y, 6, 0xddeeff, 0.8);
    flash.setDepth(38);
    scene.tweens.add({
      targets: flash, scale: 3.5, alpha: 0, duration: 260,
      onComplete: () => flash.destroy(),
    });
  }

  /** 防水炮击预警标记 */
  static waterBombWarning(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    // 光圈从大缩到小
    const ring = scene.add.circle(x, y, radius, 0x0000ff, 0);
    ring.setStrokeStyle(4, 0x4488ff, 0.8);
    ring.setDepth(37);
    scene.tweens.add({
      targets: ring,
      radius: 12,
      alpha: 0,
      duration: 600,
      ease: 'Sine.easeIn',
      onComplete: () => ring.destroy(),
    });
    // 内侧第二个环
    const inner = scene.add.circle(x, y, radius * 0.65, 0x0000ff, 0);
    inner.setStrokeStyle(2, 0x88ccff, 0.6);
    inner.setDepth(37);
    scene.tweens.add({
      targets: inner,
      radius: 0,
      alpha: 0,
      duration: 520,
      ease: 'Sine.easeIn',
      onComplete: () => inner.destroy(),
    });
    // 预警小点闪烁
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const d = radius * 0.85;
      const dot = scene.add.circle(x + Math.cos(a) * d, y + Math.sin(a) * d, 4, 0x88ccff, 0.9);
      dot.setDepth(37);
      scene.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * d * 0.3,
        y: y + Math.sin(a) * d * 0.3,
        alpha: 0,
        scale: 0.3,
        duration: 600,
        ease: 'Sine.easeIn',
        onComplete: () => dot.destroy(),
      });
    }
  }

  /** 防水炸弹从天而降 */
  static waterBombFall(scene: Phaser.Scene, x: number, y: number, lv: number, onLand: () => void): void {
    const bombTex = 'fx_water_bomb';
    if (!scene.textures.exists(bombTex)) { onLand(); return; }

    const startY = -60;
    const bomb = scene.add.image(x, startY, bombTex);
    bomb.setDepth(38);
    bomb.setScale(1.4 + lv * 0.3);
    bomb.setAlpha(0.9);
    bomb.setFlipY(true); // 180度翻转
    bomb.setBlendMode(Phaser.BlendModes.ADD);

    // 尾迹光点
    const trailInterval = scene.time.addEvent({
      delay: 30,
      repeat: Math.floor(500 / 30),
      callback: () => {
        if (!bomb.active) { trailInterval.remove(false); return; }
        const dot = scene.add.circle(
          bomb.x + (Math.random() - 0.5) * 10,
          bomb.y + (Math.random() - 0.5) * 4,
          2 + Math.random() * 3,
          0x88ccff,
          0.5,
        );
        dot.setDepth(37);
        scene.tweens.add({
          targets: dot, alpha: 0, scale: 0.2, duration: 200,
          onComplete: () => dot.destroy(),
        });
      },
    });

    // 下落动画
    scene.tweens.add({
      targets: bomb,
      y: y,
      scaleX: bomb.scaleX * 1.1,
      scaleY: bomb.scaleY * 1.1,
      duration: 500,
      ease: 'Sine.easeIn',
      onComplete: () => {
        trailInterval.remove(false);
        bomb.destroy();
        onLand();
      },
    });
  }

  /** 防水炮击爆炸：蓝色冲击波 + 粒子 + Extra_46 贴图 */
  static waterBombImpact(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    // 主贴图 — Extra_46 蓝色冲击（翻转）
    const bombTex = 'fx_water_bomb';
    if (scene.textures.exists(bombTex)) {
      const bomb = scene.add.image(x, y, bombTex);
      bomb.setDepth(38);
      bomb.setScale(1.8 + lv * 0.4);
      bomb.setAlpha(0.9);
      bomb.setFlipY(true);
      bomb.setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: bomb,
        scaleX: bomb.scaleX * 2.0,
        scaleY: bomb.scaleY * 2.0,
        alpha: 0,
        duration: 600,
        ease: 'Sine.easeOut',
        onComplete: () => bomb.destroy(),
      });
    }

    // 中心闪光
    const flash = scene.add.circle(x, y, 8, 0xddeeff, 0.9);
    flash.setDepth(39);
    scene.tweens.add({
      targets: flash,
      scale: 5.0,
      alpha: 0,
      duration: 400,
      ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    });

    // 重冲击波
    VFX.shockwave(scene, x, y, radius * 1.3, 0x4488ff, 560, lv >= 3 ? 50 : 30);

    // 第二圈外扩冲击波
    const shock2 = scene.add.circle(x, y, 10, 0x0000ff, 0);
    shock2.setStrokeStyle(3, 0x66aaff, 0.5);
    shock2.setDepth(36);
    scene.tweens.add({
      targets: shock2,
      radius: radius * 1.6,
      alpha: 0,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => shock2.destroy(),
    });

    // 蓝色粒子爆散
    VFX.burst(scene, x, y, 24 + lv * 6, [0x2255cc, 0x4488ff, 0x66aaff, 0xaaddff, 0xffffff], 260, 5, 800, 'fx_glow_64');
    VFX.burst(scene, x, y, 12 + lv * 4, [0x0044aa, 0x2266cc, 0x4488ff, 0x88ccff], 180, 3, 600, 'fx_bolt_hit');
    VFX.burst(scene, x, y, 8 + lv * 3, [0x3377dd, 0x66bbff, 0xaaddff, 0xddeeff], 320, 4, 700, 'fx_ring_42');

    // 屏幕震动
    VFX.shake(scene, 0.003 + lv * 0.001, 120);
  }

  static insectTick(scene: Phaser.Scene, x: number, y: number, radius: number): void {
    VFX.shockwave(scene, x, y, Math.max(24, radius * 1.2), 0x66dd66, 260);
    VFX.burst(scene, x, y, 8, [0x44cc44, 0x88cc44, 0xccee88], 100, 3, 420, 'fx_star_34');
  }

  /** 药雾孢子命中：绿色菌丝 burst + 微光环 */
  static insectSpore(scene: Phaser.Scene, x: number, y: number): void {
    VFX.burst(scene, x, y, 5, [0x44cc44, 0x88cc44, 0xaadd88, 0xccee88], 70, 2, 280, 'fx_impact');
    // 微光环
    VFX.shockwave(scene, x, y, 16, 0x88cc44, 200);
  }

  static paintImpact(scene: Phaser.Scene, x: number, y: number, radius: number, lv: number): void {
    const colors = [0xff4488, 0xff8800, 0xffee00, 0x44ff88, 0x4488ff, 0xcc44ff];
    VFX.burst(scene, x, y, lv >= 3 ? 32 : 24, colors, 280, 6, 700, 'fx_bolt_hit');
    VFX.shockwave(scene, x, y, Math.max(40, radius * 1.4), 0xff66cc, 420);
    // 闪光
    const flash = scene.add.circle(x, y, 4, 0xffddff, 0.7);
    flash.setDepth(39);
    scene.tweens.add({
      targets: flash, scale: 3.0, alpha: 0, duration: 200,
      onComplete: () => { if (flash.active) flash.destroy(); },
    });
    // 颜料弹专属微震
    VFX.shake(scene, 0.003, 60);
  }
}
