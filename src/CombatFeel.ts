/**
 * CombatFeel — 命中反馈管线管理器
 *
 * 管理：Hit Stop（顿帧）、命中点光晕、镜头冲击、击中震动。
 * 采用命中点局部反馈策略，不拖拽全局摄像机。
 */
import Phaser from 'phaser';
import { HIT_STOP_CONFIG, HitStopTier, IMPACT_FLASH_CONFIG, COMBAT_FEEL_EXTRA } from './config';
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

  // ── Hit Stop ──
  private hitStopRemaining = 0;
  private lastHitStopTime = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ═══════════════════════════════════
  // 命中入口
  // ═══════════════════════════════════

  onHit(event: HitEvent): void {
    const cfg = HIT_STOP_CONFIG[event.tier];
    const now = this.scene.time.now;

    // Hit Stop + 冷却（同一窗口内命中闪/镜头冲击也只触发一次）
    const canActivate = now - this.lastHitStopTime >= HIT_STOP_CONFIG.cooldownMs;
    if (canActivate) {
      this.hitStopRemaining = Math.max(this.hitStopRemaining, cfg.freezeMs);
      this.lastHitStopTime = now;

      // ── 命中点径向光晕（替代全屏闪白） ──
      this.spawnImpactFlash(event);

      // ── 镜头冲击（仅重击/ultra） ──
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
  }

  // ═══════════════════════════════════
  // 命中点光晕
  // ═══════════════════════════════════

  private spawnImpactFlash(event: HitEvent): void {
    const cfg = IMPACT_FLASH_CONFIG[event.tier];
    if (!cfg) return;

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
    // ── Hit Stop ──
    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining -= delta;
      if (this.hitStopRemaining <= 0) {
        this.hitStopRemaining = 0;
      }
      return COMBAT_FEEL_EXTRA.minEffectiveDelta;
    }

    return delta;
  }

  // ═══════════════════════════════════
  // 查询
  // ═══════════════════════════════════

  get isInHitStop(): boolean {
    return this.hitStopRemaining > 0;
  }
}
