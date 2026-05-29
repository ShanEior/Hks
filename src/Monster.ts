import Phaser from 'phaser';
import { MonsterTemplate, MonsterType, StructureType, SPEED_FACTOR } from './config';
import { SoundManager } from './SoundManager';

export class Monster {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Arc;
  hpBar: Phaser.GameObjects.Graphics;
  type: MonsterType;

  hp: number;
  maxHp: number;
  speed: number;         // px/s
  damage: number;
  attackInterval: number; // ms
  attackStructures: StructureType[];
  expDrop: number;

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

    // 用精灵图替代纯色圆
    if (scene.textures.exists(template.type)) {
      const img = scene.add.image(x, y, template.type);
      img.setDepth(5);
      (this as any)._image = img;
    }
    // 保留圆用于碰撞检测
    this.sprite = scene.add.circle(x, y, template.radius, template.color, 0);
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

    // 同步精灵图位置
    const img = (this as any)._image as Phaser.GameObjects.Image | undefined;
    if (img) { img.x = this.sprite.x; img.y = this.sprite.y; }

    this.drawHpBar();
  }

  takeDamage(amount: number): boolean {
    if (this.isDead) return false;
    this.hp -= amount;
    SoundManager.hitMonster();
    // 浮动伤害数字
    if (amount > 0) {
      const num = this.scene.add.text(this.x + (Math.random() - 0.5) * 16, this.y - 12, `${Math.round(amount)}`, {
        fontSize: '13px', color: '#ffffff', fontFamily: 'monospace', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(50);
      this.scene.tweens.add({
        targets: num, y: this.y - 36, alpha: 0, duration: 600,
        onComplete: () => num.destroy(),
      });
    }
    // 受击闪白
    this.sprite.setFillStyle(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.sprite.active && !this.isDead) {
        const colors: Record<string, number> = {
          termite: 0xDDDDDD, wind: 0xDDCC88, acid_rain: 0x44CC44,
          fire: 0xFF6633, freeze_thaw: 0x6699FF,
        };
        this.sprite.setFillStyle(colors[this.type] ?? 0xDDDDDD);
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

    // 死亡爆散粒子
    const colors: Record<string, number> = {
      termite: 0xDDDDDD, wind: 0xDDCC88, acid_rain: 0x44CC44,
      fire: 0xFF6633, freeze_thaw: 0x6699FF,
    };
    const color = colors[this.type] ?? 0xDDDDDD;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
      const p = this.scene.add.circle(this.sprite.x, this.sprite.y, 3, color);
      p.setDepth(7);
      this.scene.tweens.add({
        targets: p,
        x: this.sprite.x + Math.cos(a) * (30 + Math.random() * 20),
        y: this.sprite.y + Math.sin(a) * (30 + Math.random() * 20),
        alpha: 0, scale: 0.2,
        duration: 350,
        onComplete: () => p.destroy(),
      });
    }

    const img = (this as any)._image as Phaser.GameObjects.Image | undefined;
    if (img) img.destroy();
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
