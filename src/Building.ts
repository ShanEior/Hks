import Phaser from 'phaser';
import { StructureType } from './config';
import { SoundManager } from './SoundManager';

interface StructureState {
  currentHp: number;
  maxHp: number;
  color: number;
  label: string;
}

interface StructureConfig {
  maxHp: number;
  color: number;
  label: string;
}

interface BurnState {
  dps: number;
  remaining: number;
}

export class Building {
  scene: Phaser.Scene;
  x: number;
  y: number;
  graphics: Phaser.GameObjects.Graphics;
  structures: Map<StructureType, StructureState>;
  private burns: Map<StructureType, BurnState> = new Map();

  onFailure: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    structureConfigs: Record<StructureType, StructureConfig>,
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.structures = new Map();

    for (const [key, data] of Object.entries(structureConfigs) as [StructureType, StructureConfig][]) {
      this.structures.set(key, {
        currentHp: data.maxHp,
        maxHp: data.maxHp,
        color: data.color,
        label: data.label,
      });
    }

    this.graphics = this.drawBuilding();
  }

  private drawBuilding(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.setDepth(3);

    const x = this.x, y = this.y;

    // 外墙
    g.fillStyle(0x6B4226, 1);
    g.fillRect(x - 50, y - 35, 100, 70);

    // 屋顶
    g.fillStyle(0xA0522D, 1);
    g.fillRect(x - 58, y - 45, 116, 14);

    // 内殿
    g.fillStyle(0x8B7355, 1);
    g.fillRect(x - 18, y - 12, 36, 40);

    // 四根木柱
    g.fillStyle(0xC4884D, 1);
    g.fillRect(x - 42, y - 30, 6, 60);
    g.fillRect(x - 32, y - 30, 6, 60);
    g.fillRect(x + 26, y - 30, 6, 60);
    g.fillRect(x + 36, y - 30, 6, 60);

    // 屋脊
    g.lineStyle(2, 0x8B4513, 1);
    g.moveTo(x, y - 45);
    g.lineTo(x, y - 35);
    g.strokePath();

    return g;
  }

  /** 对指定结构造成伤害 */
  damageStructure(type: StructureType, amount: number): void {
    const s = this.structures.get(type);
    if (!s) return;
    s.currentHp = Math.max(0, s.currentHp - amount);
    SoundManager.buildingHit();
    this.flashDamage();
    // 屏幕震动
    this.scene.cameras.main.shake(80, 0.004);

    if (s.currentHp <= 0 && this.onFailure) {
      this.onFailure();
    }
  }

  /** 回复指定结构血条 */
  healStructure(type: StructureType, amount: number): void {
    const s = this.structures.get(type);
    if (!s) return;
    const oldHp = s.currentHp;
    s.currentHp = Math.min(s.maxHp, s.currentHp + amount);
    if (s.currentHp > oldHp) {
      SoundManager.buildingHeal();
      this.flashHeal();
    }
  }

  /** 施加灼烧 DoT */
  applyBurn(type: StructureType, dps: number, duration: number): void {
    this.burns.set(type, { dps, remaining: duration });
  }

  /** 每帧更新灼烧 */
  updateBurn(delta: number): void {
    for (const [type, burn] of this.burns) {
      burn.remaining -= delta / 1000;
      this.damageStructure(type, burn.dps * delta / 1000);
      if (burn.remaining <= 0) this.burns.delete(type);
    }
  }

  private flashDamage(): void {
    this.graphics.setAlpha(0.4);
    this.scene.time.delayedCall(120, () => {
      if (this.graphics.active) this.graphics.setAlpha(1);
    });
  }

  /** 回血闪光：短暂叠加金色覆盖层 */
  private flashHeal(): void {
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0xffdd44, 0.3);
    overlay.fillRect(this.x - 60, this.y - 50, 120, 100);
    overlay.setDepth(4);
    this.scene.time.delayedCall(200, () => overlay.destroy());
  }

  getStructure(type: StructureType): StructureState | undefined {
    return this.structures.get(type);
  }

  isAnyStructureDestroyed(): boolean {
    for (const s of this.structures.values()) {
      if (s.currentHp <= 0) return true;
    }
    return false;
  }
}
