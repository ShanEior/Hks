import Phaser from 'phaser';
import { MAP_WIDTH, MAP_HEIGHT, SPEED_FACTOR } from './config';

export class Player {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Image;
  private baseMoveSpeed: number;

  exp = 0;
  level = 1;
  expToNext = 15;

  private slowFactor = 1.0;
  private frozenTimer = 0;
  private freezeImmunityTimer = 0;
  private knockbackVx = 0;
  private knockbackVy = 0;
  joystickVx = 0;
  joystickVy = 0;

  /** 上次 X 坐标（用于判断朝向） */
  private lastX: number;
  /** 独立追踪朝向，避免 scaleX 翻转与弹跳缩放的绝对值冲突 */
  private facingRight = true;

  private keys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    _maxHp: number, moveSpeed: number,
    _radius: number, _color: number,
  ) {
    this.scene = scene;
    this.baseMoveSpeed = moveSpeed * SPEED_FACTOR;

    const texKey = scene.textures.exists('player_idle') ? 'player_idle' : 'player';
    this.sprite = scene.add.image(x, y, texKey);
    this.sprite.setDepth(10);
    this.lastX = x;

    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = {
        W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    } else {
      this.keys = { W: {} as any, A: {} as any, S: {} as any, D: {} as any };
    }
  }

  get moveSpeed(): number {
    return this.baseMoveSpeed * this.slowFactor;
  }

  setSlow(active: boolean, factor = 0.4): void {
    this.slowFactor = active ? factor : 1.0;
  }

  /** 冻结玩家指定秒数（需检查免疫） */
  tryFreeze(duration: number): boolean {
    if (this.freezeImmunityTimer > 0 || this.frozenTimer > 0) return false;
    this.frozenTimer = duration;
    return true;
  }

  get isFrozen(): boolean { return this.frozenTimer > 0; }

  applyKnockback(fromX: number, fromY: number, force: number): void {
    const angle = Math.atan2(this.sprite.y - fromY, this.sprite.x - fromX);
    this.knockbackVx += Math.cos(angle) * force;
    this.knockbackVy += Math.sin(angle) * force;
  }

  /** 攻击时切换贴图 + 轻微后坐力 */
  applyAttackRecoil(): void {
    if (this.scene.textures.exists('player_attack')) {
      this.sprite.setTexture('player_attack');
      this.scene.time.delayedCall(150, () => {
        if (this.sprite.active) {
          this.sprite.setTexture(this.scene.textures.exists('player_idle') ? 'player_idle' : 'player');
        }
      });
    }
    const recoil = this.facingRight ? -3 : 3;
    this.sprite.x += recoil;
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.sprite.x - recoil,
      duration: 60,
      ease: 'Sine.easeOut',
    });
  }

  update(delta: number): void {
    const dt = delta / 1000;

    // 冻结计时
    if (this.frozenTimer > 0) {
      this.frozenTimer -= dt;
      if (this.frozenTimer <= 0) {
        this.frozenTimer = 0;
        this.freezeImmunityTimer = 1.5; // 解冻后 1.5s 免疫
      }
    }
    if (this.freezeImmunityTimer > 0) this.freezeImmunityTimer -= dt;

    let vx = this.joystickVx, vy = this.joystickVy;
    if (!this.isFrozen) {
      if (this.keys.A.isDown) vx -= 1;
      if (this.keys.D.isDown) vx += 1;
      if (this.keys.W.isDown) vy -= 1;
      if (this.keys.S.isDown) vy += 1;
    }

    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0) { vx /= len; vy /= len; }

    let nx = this.sprite.x + vx * this.moveSpeed * dt + this.knockbackVx * dt;
    let ny = this.sprite.y + vy * this.moveSpeed * dt + this.knockbackVy * dt;

    this.knockbackVx *= Math.pow(0.05, dt);
    this.knockbackVy *= Math.pow(0.05, dt);

    const r = 16;
    nx = Phaser.Math.Clamp(nx, r, MAP_WIDTH - r);
    ny = Phaser.Math.Clamp(ny, r, MAP_HEIGHT - r);

    this.sprite.x = nx;
    this.sprite.y = ny;

    // 根据移动方向翻转精灵
    const dx = nx - this.lastX;
    if (Math.abs(dx) > 0.5) {
      this.facingRight = dx > 0;
    }
    this.sprite.setFlipX(!this.facingRight);
    this.lastX = nx;

    // 冻结视觉：蓝色 + 不缩放
    if (this.isFrozen) {
      this.sprite.setTint(0x88bbff);
      this.sprite.setScale(1, 1);
    } else {
      this.sprite.clearTint();
      // 移动时轻微弹跳缩放
      const isMoving = len > 0.1;
      const targetScale = isMoving ? 1.04 : 1.0;
      const currentScale = Math.abs(this.sprite.scaleX);
      const newAbsScale = currentScale + (targetScale - currentScale) * 0.12;
      this.sprite.setScale(newAbsScale, newAbsScale);
    }
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}
