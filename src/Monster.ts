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

  isDead = false;

  /** 攻击时触发 */
  onAttack: ((monster: Monster) => void) | null = null;
  /** 死亡时触发 */
  onDeath: ((monster: Monster) => void) | null = null;
  /** 接触玩家时触发（用于控制效果） */
  onPlayerContact: ((monster: Monster) => void) | null = null;

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

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      this.targetX, this.targetY,
    );

    if (dist > this.attackRange) {
      const angle = Math.atan2(
        this.targetY - this.sprite.y,
        this.targetX - this.sprite.x,
      );
      const dt = delta / 1000;
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

  takeDamage(amount: number): boolean {
    if (this.isDead) return false;
    this.hp -= amount;
    SoundManager.hitMonster();
    VFX.hitMonster(this.scene, this.x, this.y, amount);

    // 受击闪白（tint 方式，像素艺术友好）
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.sprite.active && !this.isDead) {
        this.sprite.clearTint();
      }
    });

    if (this.hp <= 0) {
      this.hp = 0;
      SoundManager.killMonster();
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

    this.sprite.destroy();
    this.hpBar.destroy();
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
