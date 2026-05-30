/**
 * CombatFeel — 命中反馈管线管理器
 *
 * 统一管理：Hit Stop（顿帧）、Trauma 屏幕震动、镜头冲击。
 * 参照 arXiv 2208.06155 学术结论（Hit Stop > 音效 > 镜头控制）、
 * Squirrel Eiserloh GDC 创伤值模型、Vlambeer 震屏实践。
 */
import Phaser from 'phaser';
import {
  TRAUMA_CONFIG, HIT_STOP_CONFIG,
  TraumaTier, HitStopTier,
} from './config';

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

  // ── Trauma 震动 ──
  private trauma = 0;
  private noisePhase = 0;

  // ── Hit Stop ──
  private hitStopRemaining = 0;
  private lastHitStopTime = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ═══════════════════════════════════
  // 命中入口 — 所有命中反馈统一走这里
  // ═══════════════════════════════════

  onHit(event: HitEvent): void {
    const cfg = HIT_STOP_CONFIG[event.tier];
    const now = this.scene.time.now;

    // Hit Stop + 冷却
    if (now - this.lastHitStopTime >= HIT_STOP_CONFIG.cooldownMs) {
      this.hitStopRemaining = Math.max(this.hitStopRemaining, cfg.freezeMs);
      this.lastHitStopTime = now;
    }

    // Trauma 累积
    this.trauma = Math.min(1.0, this.trauma + TRAUMA_CONFIG.events[cfg.shake]);

    // 镜头闪白（重击/超级）
    if (cfg.flash) {
      this.scene.cameras.main.flash(50, 255, 255, 255);
    }

    // 镜头冲击（重击+）
    if (event.tier === 'heavy' || event.tier === 'ultra') {
      const zoomIn = event.tier === 'ultra' ? 1.06 : 1.04;
      const punchMs = event.tier === 'ultra' ? 50 : 40;
      const recoverMs = event.tier === 'ultra' ? 300 : 200;
      this.scene.cameras.main.zoomTo(zoomIn, punchMs, 'Power1', true);
      this.scene.time.delayedCall(punchMs, () => {
        if (this.scene.cameras.main) {
          this.scene.cameras.main.zoomTo(1.0, recoverMs, 'Power2', true);
        }
      });
    }
  }

  // ═══════════════════════════════════
  // 每帧更新 — 返回 effectiveDelta
  // ═══════════════════════════════════

  /**
   * @returns 有效的 delta 乘数：正常为原始 delta，
   *          Hit Stop 期间为 0.05（怪物几乎冻结）
   */
  update(delta: number, _time: number): number {
    const dt = delta / 1000;

    // ── Trauma 衰减 + 震屏偏移 ──
    this.trauma = Math.max(0, this.trauma - TRAUMA_CONFIG.decayPerSecond * dt);

    if (this.trauma > 0.001) {
      const shakeAmount =
        Math.pow(this.trauma, TRAUMA_CONFIG.exponent) *
        TRAUMA_CONFIG.maxOffset;
      this.noisePhase += dt * 12;

      // 伪 Perlin 噪声（叠加正弦波，视觉上有机）
      const nx =
        Math.sin(this.noisePhase * 1.3 + 0.7) *
        Math.cos(this.noisePhase * 0.7 + 1.3);
      const ny =
        Math.cos(this.noisePhase * 1.1 + 0.3) *
        Math.sin(this.noisePhase * 0.9 + 2.1);

      // 通过 follow offset 施加震动，不干扰 camera follow
      this.scene.cameras.main.setFollowOffset(
        nx * shakeAmount * TRAUMA_CONFIG.horizontalDamping,
        ny * shakeAmount,
      );
    } else {
      this.scene.cameras.main.setFollowOffset(0, 0);
    }

    // ── Hit Stop ──
    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining -= delta;
      if (this.hitStopRemaining <= 0) {
        this.hitStopRemaining = 0;
      }
      return 0.05; // 怪物几乎冻结，但 VFX 全速
    }

    return delta; // 正常速度
  }

  // ═══════════════════════════════════
  // 查询
  // ═══════════════════════════════════

  get currentTrauma(): number {
    return this.trauma;
  }

  get isInHitStop(): boolean {
    return this.hitStopRemaining > 0;
  }
}
