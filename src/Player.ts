import Phaser from 'phaser';
import { MAP_WIDTH, MAP_HEIGHT, SPEED_FACTOR } from './config';

export class Player {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Arc;
  private baseMoveSpeed: number;

  // 成长属性
  exp = 0;
  level = 1;
  expToNext = 15;

  // 控制效果
  private slowFactor = 1.0;
  private knockbackVx = 0;
  private knockbackVy = 0;

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
    radius: number, color: number,
  ) {
    this.scene = scene;
    this.baseMoveSpeed = moveSpeed * SPEED_FACTOR;

    this.sprite = scene.add.circle(x, y, radius, color);
    this.sprite.setDepth(10);

    const kb = scene.input.keyboard!;
    this.keys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  /** 当前有效移动速度（含减速） */
  get moveSpeed(): number {
    return this.baseMoveSpeed * this.slowFactor;
  }

  /** 设置减速 */
  setSlow(active: boolean, factor = 0.4): void {
    this.slowFactor = active ? factor : 1.0;
  }

  /** 施加击退 */
  applyKnockback(fromX: number, fromY: number, force: number): void {
    const angle = Math.atan2(this.sprite.y - fromY, this.sprite.x - fromX);
    this.knockbackVx += Math.cos(angle) * force;
    this.knockbackVy += Math.sin(angle) * force;
  }

  update(delta: number): void {
    const dt = delta / 1000;

    // 1. 计算输入方向
    let vx = 0, vy = 0;
    if (this.keys.A.isDown) vx -= 1;
    if (this.keys.D.isDown) vx += 1;
    if (this.keys.W.isDown) vy -= 1;
    if (this.keys.S.isDown) vy += 1;

    // 2. 对角线归一化
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0) { vx /= len; vy /= len; }

    // 3. 输入移动 + 击退速度
    let nx = this.sprite.x + vx * this.moveSpeed * dt + this.knockbackVx * dt;
    let ny = this.sprite.y + vy * this.moveSpeed * dt + this.knockbackVy * dt;

    // 4. 击退衰减
    this.knockbackVx *= Math.pow(0.05, dt);
    this.knockbackVy *= Math.pow(0.05, dt);

    // 5. 世界边界 clamp
    const r = this.sprite.radius;
    nx = Phaser.Math.Clamp(nx, r, MAP_WIDTH - r);
    ny = Phaser.Math.Clamp(ny, r, MAP_HEIGHT - r);

    this.sprite.x = nx;
    this.sprite.y = ny;
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}
