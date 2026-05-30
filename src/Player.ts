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

    this.sprite = scene.add.image(x, y, 'player');
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

  applyKnockback(fromX: number, fromY: number, force: number): void {
    const angle = Math.atan2(this.sprite.y - fromY, this.sprite.x - fromX);
    this.knockbackVx += Math.cos(angle) * force;
    this.knockbackVy += Math.sin(angle) * force;
  }

  update(delta: number): void {
    const dt = delta / 1000;

    let vx = this.joystickVx, vy = this.joystickVy;
    if (this.keys.A.isDown) vx -= 1;
    if (this.keys.D.isDown) vx += 1;
    if (this.keys.W.isDown) vy -= 1;
    if (this.keys.S.isDown) vy += 1;

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

    // 移动时轻微弹跳缩放（lerp 平滑过渡，使用独立朝向避免绝对值冲突）
    const isMoving = len > 0.1;
    const targetScale = isMoving ? 1.04 : 1.0;
    const currentScale = Math.abs(this.sprite.scaleX);
    const newAbsScale = currentScale + (targetScale - currentScale) * 0.12;
    const signedScale = this.facingRight ? newAbsScale : -newAbsScale;
    this.sprite.setScale(signedScale, newAbsScale);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}
