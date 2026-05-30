/**
 * CombatFeel — 命中反馈管线管理器
 *
 * 管理：Hit Stop（顿帧）、命中点光晕、镜头冲击、击中震动。
 * 采用命中点局部反馈策略，不拖拽全局摄像机。
 */
import Phaser from 'phaser';
import { HitStopTier, IMPACT_FLASH_CONFIG } from './config';
import { VFX } from './VFX';

export interface HitEvent {
  damage: number;
  worldX: number;
  worldY: number;
  attackerX?: number;
  attackerY?: number;
  tier: HitStopTier;
}

export class CombatFeel {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ═══════════════════════════════════
  // 命中入口
  // ═══════════════════════════════════

  onHit(event: HitEvent): void {
    // 命中点径向光晕（替代全屏闪白）
    this.spawnImpactFlash(event);

    // 镜头冲击（仅重击/ultra）
    if (event.tier === 'heavy' || event.tier === 'ultra') {
      const zoomIn = event.tier === 'ultra' ? 1.04 : 1.025;
      const recoverMs = event.tier === 'ultra' ? 250 : 180;
      this.scene.cameras.main.zoomTo(zoomIn, 30, 'Power1', true);
      this.scene.time.delayedCall(40, () => {
        if (this.scene.cameras.main) {
          this.scene.cameras.main.zoomTo(1.0, recoverMs, 'Power2', true);
        }
      });
    }
  }

  // ═══════════════════════════════════
  // 命中点光晕
  // ═══════════════════════════════════

  private spawnImpactFlash(event: HitEvent): void {
    if (event.tier === 'none') return;
    const cfg = IMPACT_FLASH_CONFIG[event.tier];

    // 核心光点：从命中点快速膨胀再缩小
    const core = this.scene.add.circle(
      event.worldX, event.worldY,
      cfg.coreRadius, cfg.coreColor, 0.9,
    );
    core.setDepth(38);
    this.scene.tweens.add({
      targets: core,
      radius: cfg.coreRadius * 3,
      alpha: 0,
      duration: cfg.coreDuration,
      ease: 'Power2',
      onComplete: () => core.destroy(),
    });

    // 冲击波环
    VFX.shockwave(
      this.scene, event.worldX, event.worldY,
      cfg.ringRadius, cfg.ringColor, cfg.ringDuration,
    );
  }

  // ═══════════════════════════════════
  // 每帧更新 — 返回 effectiveDelta
  // ═══════════════════════════════════

  update(delta: number, _time: number): number {
    // Hit Stop 已迁移至 Monster.freezeTimer（单怪冻结），不再管理全局时间
    // CombatFeel 现仅负责命中 VFX（冲击光环 + 镜头冲击）
    return delta;
  }
}
