import Phaser from 'phaser';
import { StructureType } from './config';
import { SoundManager } from './SoundManager';
import { VFX } from './VFX';

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

    // 优先使用 PNG 贴图，fallback 程序化纹理
    const texKey = scene.textures.exists('gj') ? 'gj' : 'building';
    this.graphics = scene.add.image(x, y, texKey);
    this.graphics.setDepth(3);
  }

  /** 对指定结构造成伤害 */
  damageStructure(type: StructureType, amount: number): void {
    const s = this.structures.get(type);
    if (!s) return;
    s.currentHp = Math.max(0, s.currentHp - amount);
    SoundManager.buildingHit();
    VFX.buildingHit(this.scene, this.x, this.y, type);
    this.flashDamage(amount);
    this.shakeSprite();

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
      VFX.buildingHeal(this.scene, this.x, this.y);
      this.flashHeal();
      this.updateAppearance();
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

  /** 根据最低血条百分比切换外观 */
  updateAppearance(): void {
    let minRatio = 1;
    for (const s of this.structures.values()) {
      minRatio = Math.min(minRatio, s.currentHp / s.maxHp);
    }
    let key = 'building_100';
    if (minRatio <= 0) key = 'building_0';
    else if (minRatio <= 0.25) key = 'building_25';
    else if (minRatio <= 0.5) key = 'building_50';
    else if (minRatio <= 0.75) key = 'building_75';

    if (this.scene.textures.exists(key)) {
      this.graphics.setTexture(key);
    }
  }

  private flashDamage(damage: number): void {
    // 比例反馈：伤害越大闪越狠
    const severity = Math.min(damage / 20, 1);
    this.graphics.setAlpha(1 - severity * 0.6);
    if (severity > 0.5) this.graphics.setTint(0xff4444);
    this.scene.time.delayedCall(120, () => {
      if (this.graphics.active) {
        this.graphics.setAlpha(1);
        this.graphics.clearTint();
      }
    });
    this.updateAppearance();
  }

  /** 古建被击中时短暂抖动（不是全局摇晃） */
  private shakeSprite(): void {
    const ox = this.graphics.x;
    this.scene.tweens.add({
      targets: this.graphics,
      x: ox + 3,
      duration: 30,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => { this.graphics.x = ox; },
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
