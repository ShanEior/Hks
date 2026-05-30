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
  accumulator: number;  // 累积小数伤害，>=1 时才释放
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
    this.pngMode = texKey === 'gj';
    this.graphics = scene.add.image(x, y, texKey);
    this.graphics.setDepth(3);
  }

  /** 对指定结构造成伤害。skipSound 用于 DoT 类伤害抑制音效/VFX 刷屏 */
  damageStructure(type: StructureType, amount: number, skipSound = false): void {
    const s = this.structures.get(type);
    if (!s) return;
    const dmg = Math.max(1, Math.round(amount));
    s.currentHp = Math.max(0, s.currentHp - dmg);
    if (!skipSound) {
      SoundManager.buildingHit();
      VFX.buildingHit(this.scene, this.x, this.y, type);
    }
    if (!skipSound) {
      this.flashDamage(dmg);
      // 跳出伤害数字（DoT 不重复浮字，避免刷屏）
      VFX.floatText(this.scene, this.x + (Math.random() - 0.5) * 30, this.y - 60, `${dmg}`, '#ff4444', '15px');
    }

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
    this.burns.set(type, { dps, remaining: duration, accumulator: 0 });
  }

  updateBurn(delta: number): void {
    for (const [type, burn] of this.burns) {
      burn.remaining -= delta / 1000;
      burn.accumulator += burn.dps * delta / 1000;
      // 累积满 1 点伤害后才释放，避免每帧小数舍入爆炸
      while (burn.accumulator >= 1) {
        burn.accumulator -= 1;
        this.damageStructure(type, 1, true); // skipSound: 燃烧只浮字不堆音效
      }
      if (burn.remaining <= 0) this.burns.delete(type);
    }
  }

  private pngMode = false;

  /** 根据最低血条百分比切换外观 */
  updateAppearance(): void {
    // PNG 贴图模式不切换纹理，只通过 alpha 闪红反馈
    if (this.pngMode) return;
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
    // 闪红：伤害越大闪越狠
    this.graphics.setTint(0xff3333);
    this.scene.time.delayedCall(150, () => {
      if (this.graphics.active) {
        this.graphics.clearTint();
      }
    });
    this.shakeSprite();
    this.updateAppearance();
  }

  /** 古建被击中时短暂抖动 */
  private shakeSprite(): void {
    const baseX = this.x;
    // 停止之前未完成的抖动 tween，防止位置偏移
    this.scene.tweens.killTweensOf(this.graphics);
    this.graphics.x = baseX;
    this.scene.tweens.add({
      targets: this.graphics,
      x: baseX - 3,
      duration: 25,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => { this.graphics.x = baseX; },
    });
  }

  flashHeal(): void {
    // 古建绿色闪光
    this.graphics.setTint(0x44ff66);
    this.scene.time.delayedCall(200, () => {
      if (this.graphics.active) this.graphics.clearTint();
    });
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
