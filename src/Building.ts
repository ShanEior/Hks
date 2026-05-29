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
  graphics: Phaser.GameObjects.Image;
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

    // 使用生成的精灵纹理
    this.graphics = scene.add.image(x, y, 'building');
    this.graphics.setDepth(3);
  }

  /** 对指定结构造成伤害 */
  damageStructure(type: StructureType, amount: number): void {
    const s = this.structures.get(type);
    if (!s) return;
    s.currentHp = Math.max(0, s.currentHp - amount);
    SoundManager.buildingHit();
    this.flashDamage();
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

  applyBurn(type: StructureType, dps: number, duration: number): void {
    this.burns.set(type, { dps, remaining: duration });
  }

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

  private flashHeal(): void {
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0xffdd44, 0.3);
    overlay.fillRect(this.x - 55, this.y - 40, 110, 80);
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
