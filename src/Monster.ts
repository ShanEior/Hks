import Phaser from 'phaser';
import { MonsterTemplate, MonsterType, StructureType, SPEED_FACTOR } from './config';
import { SoundManager } from './SoundManager';
import { VFX } from './VFX';

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

  isDead = false;

  /** 攻击时触发 */
  onAttack: ((monster: Monster) => void) | null = null;
  /** 死亡时触发 */
  onDeath: ((monster: Monster) => void) | null = null;
  /** 接触玩家时触发（用于控制效果） */
  onPlayerContact: ((monster: Monster) => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    template: MonsterTemplate,
    targetX: number, targetY: number,
    attackRange: number,
  ) {
    this.scene = scene;
    this.type = template.type;
    this.hp = template.hp;
    this.maxHp = template.hp;
    this.speed = template.speed * SPEED_FACTOR;
    this.damage = template.damage;
    this.attackInterval = template.attackInterval;
    this.attackStructures = [...template.attackStructures];
    this.expDrop = template.expDrop;
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

    const color = MONSTER_COLORS[this.type] ?? 0xDDDDDD;
    VFX.killMonster(this.scene, this.sprite.x, this.sprite.y, color);

    this.sprite.destroy();
    this.hpBar.destroy();
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
