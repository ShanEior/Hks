import Phaser from 'phaser';
import { MonsterTemplate, MonsterType, StructureType, SPEED_FACTOR } from './config';
import { SoundManager } from './SoundManager';
import { VFX } from './VFX';

/** 时间缩放因子，用于让敌怪随时间变强 */
export interface TimeScalingFactors {
  hpMult: number;
  damageMult: number;
  speedMult: number;
  expMult: number;
}

/** 怪物颜色映射表（用于无纹理时的圆形占位 + 受击闪回） */
const MONSTER_COLORS: Record<string, number> = {
  termite: 0xDDDDDD,
  wind: 0xDDCC88,
  acid_rain: 0x44CC44,
  fire: 0xFF6633,
  freeze_thaw: 0x6699FF,
};

export class Monster {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;
  type: MonsterType;

  hp: number;
  maxHp: number;
  speed: number;         // px/s
  damage: number;
  attackInterval: number; // ms
  attackStructures: StructureType[];
  expDrop: number;
  radius: number;

  private targetX: number;
  private targetY: number;
  private attackRange: number;
  private lastAttackTime = 0;
  private idleTween: Phaser.Tweens.Tween | null = null;

  // ── 击退 + 命中反应 ──
  private knockbackVx = 0;
  private knockbackVy = 0;
  private hitStunTimer = 0;

  isDead = false;

  /** 攻击时触发 */
  onAttack: ((monster: Monster) => void) | null = null;
  /** 死亡时触发 */
  onDeath: ((monster: Monster) => void) | null = null;
  /** 接触玩家时触发（用于控制效果） */
  onPlayerContact: ((monster: Monster) => void) | null = null;
  /** 受击反馈回调（由 GameScene 注入，连接 CombatFeel） */
  onDamageFeedback: ((monster: Monster, damage: number) => void) | null = null;

  /** 记录应用的时间缩放因子，用于显示"经过强化的敌怪"效果 */
  readonly timeScale: TimeScalingFactors;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    template: MonsterTemplate,
    targetX: number, targetY: number,
    attackRange: number,
    timeScale?: TimeScalingFactors,
  ) {
    this.scene = scene;
    this.type = template.type;
    this.timeScale = timeScale ?? { hpMult: 1, damageMult: 1, speedMult: 1, expMult: 1 };
    this.hp = Math.round(template.hp * this.timeScale.hpMult);
    this.maxHp = this.hp;
    this.speed = template.speed * SPEED_FACTOR * this.timeScale.speedMult;
    this.damage = Math.round(template.damage * this.timeScale.damageMult);
    this.attackInterval = template.attackInterval;
    this.attackStructures = [...template.attackStructures];
    this.expDrop = Math.round(template.expDrop * this.timeScale.expMult);
    this.targetX = targetX;
    this.targetY = targetY;
    this.attackRange = attackRange;
    this.radius = template.radius;

    // 使用 ArtGen 像素纹理创建精灵（优先），无纹理时用纯色圆占位
    if (scene.textures.exists(template.type)) {
      this.sprite = scene.add.image(x, y, template.type);
    } else {
      // 占位：用 graphics 生成一个纯色圆纹理（fallback）
      const key = `_fallback_${template.type}`;
      if (!scene.textures.exists(key)) {
        const gfx = scene.add.graphics();
        gfx.fillStyle(template.color, 1);
        gfx.fillCircle(template.radius, template.radius, template.radius);
        gfx.generateTexture(key, template.radius * 2, template.radius * 2);
        gfx.destroy();
      }
      this.sprite = scene.add.image(x, y, key);
    }
    this.sprite.setDepth(5);

    // 启动待机动画
    this.startIdleAnim();

    // 头顶血条
    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(6);
    this.drawHpBar();
  }

  update(time: number, delta: number): void {
    if (this.isDead) return;

    const dt = delta / 1000;

    // ── 命中眩晕期间：仅应用击退，跳过正常 AI ──
    if (this.hitStunTimer > 0) {
      this.hitStunTimer -= delta;
      // 击退衰减
      const decay = Math.pow(0.85, dt * 60);
      this.knockbackVx *= decay;
      this.knockbackVy *= decay;
      // 速度太小则归零
      const kbSpeed = Math.sqrt(this.knockbackVx ** 2 + this.knockbackVy ** 2);
      if (kbSpeed < 5) { this.knockbackVx = 0; this.knockbackVy = 0; }
      // 应用击退位移
      this.sprite.x += this.knockbackVx * dt;
      this.sprite.y += this.knockbackVy * dt;
      this.drawHpBar();
      return;
    }

    // ── 残余击退衰减（无眩晕时也衰减，但不用等待眩晕结束） ──
    if (Math.abs(this.knockbackVx) > 0.5 || Math.abs(this.knockbackVy) > 0.5) {
      const decay = Math.pow(0.85, dt * 60);
      this.knockbackVx *= decay;
      this.knockbackVy *= decay;
      const kbSpeed = Math.sqrt(this.knockbackVx ** 2 + this.knockbackVy ** 2);
      if (kbSpeed < 5) { this.knockbackVx = 0; this.knockbackVy = 0; }
      this.sprite.x += this.knockbackVx * dt;
      this.sprite.y += this.knockbackVy * dt;
    }

    // ── 正常 AI 移动 ──
    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      this.targetX, this.targetY,
    );

    if (dist > this.attackRange) {
      const angle = Math.atan2(
        this.targetY - this.sprite.y,
        this.targetX - this.sprite.x,
      );
      this.sprite.x += Math.cos(angle) * this.speed * dt;
      this.sprite.y += Math.sin(angle) * this.speed * dt;
    } else {
      if (time - this.lastAttackTime >= this.attackInterval) {
        this.lastAttackTime = time;
        this.onAttack?.(this);
      }
    }

    this.drawHpBar();
  }

  takeDamage(amount: number, attackerX?: number, attackerY?: number): boolean {
    if (this.isDead) return false;
    this.hp -= amount;

    // ── 击退 ──
    const refX = attackerX ?? this.targetX;
    const refY = attackerY ?? this.targetY;
    const angle = Math.atan2(this.sprite.y - refY, this.sprite.x - refX);

    // 选择击退等级（提取为 number 避免 as const 字面类型冲突）
    const kbForce =
      amount >= 60 ? 350 :
      amount >= 30 ? 200 :
      amount >= 15 ? 100 :
      60; // KNOCKBACK_CONFIG.autoAttack.force
    const kbStun =
      amount >= 60 ? 150 :
      amount >= 30 ? 100 :
      amount >= 15 ? 50 :
      40; // KNOCKBACK_CONFIG.autoAttack.stunMs

    this.knockbackVx += Math.cos(angle) * kbForce;
    this.knockbackVy += Math.sin(angle) * kbForce;
    this.hitStunTimer = Math.max(this.hitStunTimer, kbStun);

    // ── 挤压+拉伸（暂停待机 tween） ──
    const origScaleX = this.sprite.scaleX;
    const origScaleY = this.sprite.scaleY;
    this.idleTween?.pause();
    this.sprite.setScale(origScaleX * 0.75, origScaleY * 1.3);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: origScaleX,
      scaleY: origScaleY,
      duration: 150,
      ease: 'Back.easeOut',
      overwrite: true,
      onComplete: () => { if (!this.isDead) this.idleTween?.resume(); },
    });

    // ── 受击闪白 ──
    const flashDuration = amount >= 30 ? 180 : 120;
    if (amount >= 40) {
      // 重击：先红闪再白闪
      this.sprite.setTint(0xff4444);
      this.scene.time.delayedCall(40, () => {
        if (this.sprite.active && !this.isDead) this.sprite.setTint(0xffffff);
      });
    } else {
      this.sprite.setTint(0xffffff);
    }
    this.scene.time.delayedCall(flashDuration, () => {
      if (this.sprite.active && !this.isDead) this.sprite.clearTint();
    });

    // ── 音效 + VFX ──
    SoundManager.hitMonster(this.sprite.x, this.sprite.y);
    VFX.hitMonster(this.scene, this.x, this.y, amount, attackerX, attackerY);

    // ── 命中反馈回调 → CombatFeel ──
    this.onDamageFeedback?.(this, amount);

    if (this.hp <= 0) {
      this.hp = 0;
      SoundManager.killMonster(this.type);
      this.die();
      return true;
    }
    return false;
  }

  private die(): void {
    this.isDead = true;
    this.onDeath?.(this);

    // 停止待机动画
    if (this.idleTween) { this.idleTween.stop(); this.idleTween = null; }

    const color = MONSTER_COLORS[this.type] ?? 0xDDDDDD;
    VFX.killMonster(this.scene, this.sprite.x, this.sprite.y, color);

    // ── 3 阶段死亡动画 ──
    // 阶段 1 (0-60ms)：闪白定格
    this.sprite.setTint(0xffffff);

    // 阶段 2 (60-360ms)：膨胀 + 渐隐
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.sprite.scaleX * 1.3,
      scaleY: this.sprite.scaleY * 1.3,
      alpha: 0,
      duration: 300,
      delay: 60,
      ease: 'Power2',
      // 阶段 3 (360ms)：销毁
      onComplete: () => {
        if (this.sprite.active) this.sprite.destroy();
        if (this.hpBar.active) this.hpBar.destroy();
      },
    });
  }

  /** 启动待机动画（Tween 驱动，无额外纹理开销） */
  private startIdleAnim(): void {
    switch (this.type) {
      case 'termite':
        // 快速小幅度左右摇摆 + 轻微伸缩
        this.idleTween = this.scene.tweens.add({
          targets: this.sprite,
          scaleX: { from: 1.0, to: 1.08 },
          scaleY: { from: 1.08, to: 1.0 },
          duration: 300 + Math.random() * 100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
      case 'wind':
        // 旋转 + 缩放脉冲
        this.idleTween = this.scene.tweens.add({
          targets: this.sprite,
          angle: { from: -8, to: 8 },
          scaleX: { from: 1.0, to: 1.06 },
          scaleY: { from: 1.0, to: 1.06 },
          duration: 500 + Math.random() * 200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
      case 'acid_rain':
        // 上下压缩拉伸 bounce（仅缩放，不改变位置）
        this.idleTween = this.scene.tweens.add({
          targets: this.sprite,
          scaleY: { from: 1.0, to: 0.82 },
          scaleX: { from: 1.0, to: 1.15 },
          duration: 450,
          yoyo: true,
          repeat: -1,
          ease: 'Bounce.easeOut',
        });
        break;
      case 'fire':
        // 火焰闪烁（快速不规则缩放）
        this.idleTween = this.scene.tweens.add({
          targets: this.sprite,
          scaleX: { from: 0.94, to: 1.08 },
          scaleY: { from: 1.04, to: 0.90 },
          duration: 200 + Math.random() * 150,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
      case 'freeze_thaw':
        // 缓慢漂浮（透明度脉冲 + 微小缩放）
        this.idleTween = this.scene.tweens.add({
          targets: this.sprite,
          alpha: { from: 0.88, to: 1.0 },
          scaleX: { from: 0.98, to: 1.02 },
          scaleY: { from: 0.98, to: 1.02 },
          duration: 1500 + Math.random() * 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
    }
  }

  private drawHpBar(): void {
    this.hpBar.clear();
    if (this.isDead) return;

    const barW = 20;
    const barH = 3;
    const bx = this.sprite.x - barW / 2;
    const by = this.sprite.y - this.sprite.displayHeight / 2 - 6;

    this.hpBar.fillStyle(0x333333, 0.8);
    this.hpBar.fillRect(bx, by, barW, barH);

    const ratio = this.hp / this.maxHp;
    const fillColor = ratio > 0.6 ? 0x44ff44 : ratio > 0.3 ? 0xffff44 : 0xff4444;
    this.hpBar.fillStyle(fillColor, 1);
    this.hpBar.fillRect(bx, by, barW * ratio, barH);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}
