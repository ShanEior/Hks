/**
 * 音效管理器 — Web Audio API 合成，零外部音频文件
 *
 * Batch 2 升级:
 * - 3 层冲击音色 (瞬态噼啪 + 主体重击 + 低频重量)
 * - 音高随机化防听觉疲劳
 * - 24 语音池 + 优先级驱逐
 * - 主总线 DynamicsCompressor 防削波
 * - 立体声声像
 * - 技能等级功率曲线
 */
import { SOUND_CONFIG, SKILL_AUDIO, MONSTER_DEATH_AUDIO, MAP_WIDTH } from './config';
import type { SkillId, MonsterType } from './config';

export class SoundManager {
  private static ctx: AudioContext | null = null;

  // ── 主压缩器 ──
  private static masterCompressor: DynamicsCompressorNode | null = null;

  // ── 语音池 ──
  private static voiceCount = 0;

  // ── 音效去重 ──
  private static lastPlayed: Map<string, number> = new Map();
  private static readonly DEDUP_MS = 50;

  // ═══════════════════════════════════
  // 基础设施
  // ═══════════════════════════════════

  private static getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** 主总线 — 经 DynamicsCompressorNode 保护 */
  private static getMasterOut(): AudioNode {
    const ctx = this.getCtx();
    if (!this.masterCompressor) {
      this.masterCompressor = ctx.createDynamicsCompressor();
      const c = SOUND_CONFIG.compressor;
      this.masterCompressor.threshold.setValueAtTime(c.threshold, ctx.currentTime);
      this.masterCompressor.ratio.setValueAtTime(c.ratio, ctx.currentTime);
      this.masterCompressor.attack.setValueAtTime(c.attack, ctx.currentTime);
      this.masterCompressor.release.setValueAtTime(c.release, ctx.currentTime);
      this.masterCompressor.knee.setValueAtTime(c.knee, ctx.currentTime);
      this.masterCompressor.connect(ctx.destination);
    }
    return this.masterCompressor;
  }

  /** 语音池准入 */
  private static reserveVoice(priority: number, _durationMs: number): boolean {
    if (this.voiceCount < SOUND_CONFIG.voicePool.maxVoices) {
      this.voiceCount++;
      return true;
    }
    // 池满：仅 priority 1 (CRITICAL) 强行通过
    return priority <= SOUND_CONFIG.voicePool.PRI_CRITICAL;
  }

  /** 语音释放（由 setTimeout 触发） */
  private static scheduleRelease(durationMs: number): void {
    setTimeout(() => {
      this.voiceCount = Math.max(0, this.voiceCount - 1);
    }, durationMs + 100);
  }

  /** 音效去重：同一 key 在 DEDUP_MS 内只播一次 */
  private static dedup(key: string): boolean {
    const now = performance.now();
    const last = this.lastPlayed.get(key) ?? 0;
    if (now - last < this.DEDUP_MS) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  /** 音高随机化 */
  private static varyPitch(baseFreq: number, pct: number): number {
    if (pct <= 0) return baseFreq;
    return baseFreq * (1 + (Math.random() * 2 - 1) * pct);
  }

  /** 简易延迟混响（无外部文件） */
  private static connectReverb(src: AudioNode, wetLevel: number): void {
    if (wetLevel <= 0) return;
    const ctx = this.getCtx();
    const delay = ctx.createDelay(0.3);
    delay.delayTime.value = 0.12;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(wetLevel, ctx.currentTime);

    src.connect(wetGain);
    wetGain.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(this.getMasterOut());
  }

  // ═══════════════════════════════════
  // 核心合成方法
  // ═══════════════════════════════════

  private static playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    volume = 0.1,
    freqEnd?: number,
    pitchVar = 0,
    pan = 0,
    filterType?: BiquadFilterType,
    filterFreq?: number,
    filterQ = 1,
    priority = 3,
    reverbWet = 0,
  ): void {
    const durMs = duration * 1000;
    if (!this.reserveVoice(priority, durMs)) return;
    this.scheduleRelease(durMs);

    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = type;
      const actualFreq = this.varyPitch(freq, pitchVar);
      osc.frequency.setValueAtTime(actualFreq, now);
      if (freqEnd !== undefined) {
        const actualEnd = this.varyPitch(freqEnd, pitchVar);
        osc.frequency.linearRampToValueAtTime(actualEnd, now + duration);
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      let lastNode: AudioNode = osc;
      if (filterType && filterFreq) {
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, now);
        filter.Q.setValueAtTime(filterQ, now);
        osc.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(gain);

      if (pan !== 0) {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, now);
        gain.connect(panner);
        panner.connect(this.getMasterOut());
      } else {
        gain.connect(this.getMasterOut());
      }

      if (reverbWet > 0) this.connectReverb(gain, reverbWet);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch { /* silent */ }
  }

  private static playNoise(
    duration: number,
    volume = 0.05,
    highpass = 800,
    lowpass?: number,
    bandpassFreq?: number,
    bandpassQ = 1,
    pitchVar = 0,
    pan = 0,
    priority = 3,
  ): void {
    const durMs = duration * 1000;
    if (!this.reserveVoice(priority, durMs)) return;
    this.scheduleRelease(durMs);

    try {
      const ctx = this.getCtx();
      const now = ctx.currentTime;
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      if (pitchVar > 0) {
        source.playbackRate.value = 1 + (Math.random() * 2 - 1) * pitchVar;
      }

      let lastNode: AudioNode = source;
      if (bandpassFreq) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(bandpassFreq, now);
        bp.Q.setValueAtTime(bandpassQ, now);
        source.connect(bp);
        lastNode = bp;
      } else if (highpass > 0) {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(highpass, now);
        (lastNode as AudioNode).connect(hp);
        lastNode = hp;
      }
      if (lowpass) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(lowpass, now);
        (lastNode as AudioNode).connect(lp);
        lastNode = lp;
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      (lastNode as AudioNode).connect(gain);

      if (pan !== 0) {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, now);
        gain.connect(panner);
        panner.connect(this.getMasterOut());
      } else {
        gain.connect(this.getMasterOut());
      }

      source.start(now);
      source.stop(now + duration + 0.05);
    } catch { /* silent */ }
  }

  /** 3 层冲击音色核心 — 所有战斗声音的复用基元 */
  private static playImpact(cfg: {
    thumpFreq: number; thumpVol: number;
    bodyFreq: number; bodyVol: number; bodyType: OscillatorType;
    crackHighpass: number; crackVol: number;
    crackBandpass?: number;
    duration: number;
    pitchVar?: number; pan?: number; priority: number;
    reverbWet?: number;
  }): void {
    const pv = cfg.pitchVar ?? SOUND_CONFIG.pitchVar.impact;
    const pan = cfg.pan ?? 0;
    const pri = cfg.priority;

    // Layer 1 — 低频锤击核心 (sub-bass thump)
    this.playTone(cfg.thumpFreq, cfg.duration, 'sine', cfg.thumpVol,
      cfg.thumpFreq / 3, SOUND_CONFIG.pitchVar.subBass, pan,
      'lowpass', 200, 1, pri);

    // Layer 2 — 中频体质感 (body resonance)
    this.playTone(cfg.bodyFreq, cfg.duration, cfg.bodyType, cfg.bodyVol,
      cfg.bodyFreq / 2, pv, pan, 'lowpass', 500, 1, pri);

    // Layer 3 — 高频瞬态噼啪 (transient crack)
    const bp = cfg.crackBandpass ?? cfg.crackHighpass;
    this.playNoise(cfg.duration * 0.5, cfg.crackVol,
      cfg.crackHighpass, undefined, bp, 3, pv * 1.5, pan, pri);

    if (cfg.reverbWet) this.connectReverb(
      this.getCtx().createGain(), cfg.reverbWet,
    );
  }

  /** 从世界坐标计算立体声 pan */
  private static worldPan(worldX: number): number {
    return ((worldX - MAP_WIDTH / 2) / (MAP_WIDTH / 2)) * 0.6;
  }

  // ═══════════════════════════════════
  // 战斗音效
  // ═══════════════════════════════════

  static hitMonster(x = 0, y = 0): void {
    if (!this.dedup('hit')) return;
    const pan = this.worldPan(x);
    const pri = SOUND_CONFIG.voicePool.PRI_IMPORTANT;
    this.playImpact({
      thumpFreq: 120, thumpVol: 0.5,
      bodyFreq: 250, bodyVol: 0.25, bodyType: 'square',
      crackHighpass: 1000, crackVol: 0.18,
      duration: 0.12, pan, priority: pri,
    });
    this.playNoise(0.04, 0.03, 600, undefined, undefined, undefined, 0.1, pan, pri);
  }

  static killMonster(monsterType: MonsterType = 'termite'): void {
    if (!this.dedup('kill')) return;
    const mat = MONSTER_DEATH_AUDIO[monsterType];
    const pri = SOUND_CONFIG.voicePool.PRI_IMPORTANT;
    this.playImpact({
      thumpFreq: mat.thumpFreq, thumpVol: mat.volume,
      bodyFreq: mat.bodyFreq, bodyVol: mat.volume * 0.5, bodyType: 'sawtooth',
      crackHighpass: mat.crunchHighpass, crackVol: mat.volume * 0.7,
      duration: mat.duration, priority: pri,
    });
    this.playNoise(0.18, 0.04, 600, 300, undefined, 2, 0.1, 0, pri);
  }

  static autoAttack(x = 0, _y = 0): void {
    const pan = this.worldPan(x);
    const pri = SOUND_CONFIG.voicePool.PRI_NORMAL;
    // whoosh: 向下扫频替代上行 ping
    this.playTone(800, 0.08, 'sine', 0.04, 400,
      SOUND_CONFIG.pitchVar.lightAttack, pan, undefined, undefined, undefined, pri);
    this.playNoise(0.06, 0.02, 1500, 300, undefined, 2, 0.1, pan, pri);
  }

  // ═══════════════════════════════════
  // 技能音效 — Lv 感知 + 元素签名
  // ═══════════════════════════════════

  static skillWood(level = 1, x = 0, _y = 0): void {
    const a = SKILL_AUDIO.wood_reinforce;
    const p = SOUND_CONFIG.skillPower.levels[Math.min(level, 3) - 1];
    const pan = this.worldPan(x);
    const pri = SOUND_CONFIG.voicePool.PRI_IMPORTANT;

    for (let i = 0; i < p.layers; i++) {
      this.playTone(a.primaryFreq[0] + i * 30, p.durationMs / 1000, a.bodyType,
        0.12 * p.volMul, a.primaryFreq[1],
        SOUND_CONFIG.pitchVar.impact, pan, 'lowpass', a.noiseLowpass + i * 50, 1, pri);
    }
    this.playNoise(0.12 * p.transientBoost, 0.04 * p.volMul,
      a.noiseHighpass, a.noiseLowpass, a.crackFilter, a.crackQ,
      SOUND_CONFIG.pitchVar.impact, pan, pri);
    if (level >= 3) {
      this.playTone(60, 0.25, 'sine', 0.06, 30, 0.02, pan, 'lowpass', 100, 1, pri, 0.2);
    }
  }

  static skillStone(level = 1, x = 0, _y = 0): void {
    const a = SKILL_AUDIO.stone_repair;
    const p = SOUND_CONFIG.skillPower.levels[Math.min(level, 3) - 1];
    const pan = this.worldPan(x);
    const pri = SOUND_CONFIG.voicePool.PRI_IMPORTANT;

    this.playTone(a.primaryFreq[0], p.durationMs / 1000, 'sawtooth',
      0.13 * p.volMul, a.primaryFreq[1],
      SOUND_CONFIG.pitchVar.subBass, pan, 'lowpass', 150, 1, pri);
    this.playNoise(0.2 * p.transientBoost, 0.06 * p.volMul,
      100, a.noiseLowpass, undefined, undefined,
      SOUND_CONFIG.pitchVar.impact, pan, pri);
    if (level >= 2) {
      this.playNoise(0.08, 0.03, 2000, undefined, undefined, 3, 0.15, pan, pri);
    }
    if (level >= 3) {
      this.playTone(40, 0.3, 'sine', 0.08, 20, 0.02, pan, 'lowpass', 80, 1, pri, 0.15);
    }
  }

  static skillWater(level = 1, x = 0, _y = 0): void {
    const a = SKILL_AUDIO.waterproof;
    const p = SOUND_CONFIG.skillPower.levels[Math.min(level, 3) - 1];
    const pan = this.worldPan(x);
    const pri = SOUND_CONFIG.voicePool.PRI_IMPORTANT;

    this.playTone(a.primaryFreq[0], p.durationMs / 1000, 'sine',
      0.07 * p.volMul, a.primaryFreq[1],
      SOUND_CONFIG.pitchVar.lightAttack, pan, 'lowpass', a.noiseLowpass, 1, pri);
    this.playNoise(0.3 * p.transientBoost, 0.03 * p.volMul,
      a.noiseHighpass, a.noiseLowpass, a.crackFilter, a.crackQ,
      SOUND_CONFIG.pitchVar.impact, pan, pri);
    if (level >= 2) {
      this.playTone(1200, 0.1, 'sine', 0.03, 1000, 0.12, pan, 'highpass', 800, 1, pri);
    }
    if (level >= 3) {
      this.playTone(a.primaryFreq[0], 0.3, 'sine', 0.04, a.primaryFreq[1],
        0.05, pan, 'lowpass', 400, 1, pri, 0.25);
    }
  }

  static skillInsect(level = 1, x = 0, _y = 0): void {
    const a = SKILL_AUDIO.insect_control;
    const p = SOUND_CONFIG.skillPower.levels[Math.min(level, 3) - 1];
    const pan = this.worldPan(x);
    const pri = SOUND_CONFIG.voicePool.PRI_IMPORTANT;

    this.playTone(a.primaryFreq[0], p.durationMs / 1000, 'triangle',
      0.05 * p.volMul, a.primaryFreq[1],
      SOUND_CONFIG.pitchVar.subBass, pan, 'lowpass', 250, 1, pri);
    this.playNoise(0.35 * p.transientBoost, 0.04 * p.volMul,
      a.noiseHighpass, a.noiseLowpass, undefined, undefined, 0.1, pan, pri);
    this.playNoise(0.15, 0.02, 3000, undefined, a.crackFilter, a.crackQ, 0.15, pan, pri);
    if (level >= 3) {
      this.playTone(300, 0.2, 'triangle', 0.03, 150, 0.08, pan, 'lowpass', 500, 1, pri, 0.15);
    }
  }

  static skillPaint(level = 1, x = 0, _y = 0): void {
    const a = SKILL_AUDIO.painting_restore;
    const p = SOUND_CONFIG.skillPower.levels[Math.min(level, 3) - 1];
    const pan = this.worldPan(x);
    const pri = SOUND_CONFIG.voicePool.PRI_IMPORTANT;

    this.playTone(a.primaryFreq[0], p.durationMs / 1000, 'sine',
      0.07 * p.volMul, a.primaryFreq[1],
      SOUND_CONFIG.pitchVar.pickup, pan, 'highpass', 600, 1, pri);
    this.playTone(a.bodyFreq[0], 0.1, 'sine',
      0.03 * p.volMul, a.bodyFreq[1],
      SOUND_CONFIG.pitchVar.pickup, pan, 'highpass', 1000, 1, pri);
    this.playNoise(0.06, 0.02, a.noiseHighpass, undefined, a.crackFilter, a.crackQ,
      0.2, pan, pri);
    if (level >= 3) {
      this.playTone(a.primaryFreq[0], 0.25, 'sine', 0.05, a.primaryFreq[1],
        0.05, pan, 'highpass', 400, 1, pri, 0.3);
    }
  }

  // ═══════════════════════════════════
  // 系统音效
  // ═══════════════════════════════════

  static buildingHit(): void {
    const pri = SOUND_CONFIG.voicePool.PRI_CRITICAL;
    this.playImpact({
      thumpFreq: 60, thumpVol: 0.7,
      bodyFreq: 100, bodyVol: 0.4, bodyType: 'sawtooth',
      crackHighpass: 500, crackVol: 0.25,
      duration: 0.25, priority: pri,
    });
    this.playNoise(0.1, 0.05, 200, 600, undefined, undefined, 0.03, 0, pri);
  }

  static buildingHeal(): void {
    const pri = SOUND_CONFIG.voicePool.PRI_NORMAL;
    this.playTone(500, 0.15, 'sine', 0.08, 800,
      SOUND_CONFIG.pitchVar.ui, 0, 'highpass', 300, 1, pri);
    this.playTone(700, 0.1, 'sine', 0.05, 1000,
      SOUND_CONFIG.pitchVar.ui, 0, 'highpass', 500, 1, pri);
  }

  static expPickup(): void {
    const pri = SOUND_CONFIG.voicePool.PRI_AMBIENT;
    this.playTone(1800, 0.06, 'sine', 0.06, 2400,
      SOUND_CONFIG.pitchVar.pickup, 0, 'highpass', 800, 1, pri);
  }

  static levelUp(): void {
    const pri = SOUND_CONFIG.voicePool.PRI_AMBIENT;
    const pv = SOUND_CONFIG.pitchVar.pickup;
    this.playTone(523, 0.12, 'triangle', 0.1, 659, pv, -0.3, 'highpass', 300, 1, pri);
    this.playTone(659, 0.12, 'triangle', 0.08, 784, pv, 0, 'highpass', 400, 1, pri);
    this.playTone(784, 0.2, 'triangle', 0.1, 1047, pv, 0.3, 'highpass', 500, 1, pri);
  }

  static victory(): void {
    const pri = SOUND_CONFIG.voicePool.PRI_AMBIENT;
    setTimeout(() => this.playTone(523, 0.15, 'triangle', 0.12, 659, 0.03, -0.4, 'highpass', 300, 1, pri), 0);
    setTimeout(() => this.playTone(659, 0.15, 'triangle', 0.12, 784, 0.03, 0, 'highpass', 400, 1, pri), 150);
    setTimeout(() => this.playTone(784, 0.3, 'triangle', 0.15, 1047, 0.03, 0.4, 'highpass', 500, 1, pri), 300);
  }

  static defeat(): void {
    const pri = SOUND_CONFIG.voicePool.PRI_AMBIENT;
    this.playTone(200, 0.3, 'sawtooth', 0.1, 80, 0.02, 0, 'lowpass', 400, 1, pri);
    this.playTone(150, 0.4, 'sawtooth', 0.08, 50, 0.02, 0, 'lowpass', 300, 1, pri);
  }

  // ═══════════════════════════════════
  // 新增音效 (Batch 2)
  // ═══════════════════════════════════

  static playerHurt(): void {
    const pri = SOUND_CONFIG.voicePool.PRI_CRITICAL;
    this.playImpact({
      thumpFreq: 80, thumpVol: 0.7,
      bodyFreq: 200, bodyVol: 0.3, bodyType: 'square',
      crackHighpass: 1500, crackVol: 0.3,
      duration: 0.18, priority: pri,
    });
    this.playTone(1200, 0.12, 'square', 0.04, 600, 0.05, 0, 'highpass', 800, 1, pri);
  }

  static skillReady(): void {
    const pri = SOUND_CONFIG.voicePool.PRI_AMBIENT;
    this.playTone(800, 0.06, 'sine', 0.04, 1000,
      SOUND_CONFIG.pitchVar.ui, 0, 'highpass', 600, 1, pri);
  }

  static countdownTick(): void {
    const pri = SOUND_CONFIG.voicePool.PRI_IMPORTANT;
    this.playTone(440, 0.03, 'square', 0.06, undefined,
      SOUND_CONFIG.pitchVar.ui, 0, 'highpass', 300, 1, pri);
  }

  static monsterSpawn(monsterType: MonsterType): void {
    const pri = SOUND_CONFIG.voicePool.PRI_NORMAL;
    const mat = MONSTER_DEATH_AUDIO[monsterType];
    this.playTone(mat.bodyFreq, 0.1, 'triangle', 0.04, mat.bodyFreq * 1.5,
      SOUND_CONFIG.pitchVar.lightAttack, 0, undefined, undefined, undefined, pri);
    this.playNoise(0.05, 0.02, mat.crunchHighpass, undefined, undefined, undefined, 0.1, 0, pri);
  }

  static repairCratePickup(): void {
    const pri = SOUND_CONFIG.voicePool.PRI_AMBIENT;
    this.playTone(600, 0.1, 'sine', 0.06, 800,
      SOUND_CONFIG.pitchVar.pickup, 0, 'highpass', 400, 1, pri);
    this.playTone(800, 0.08, 'sine', 0.04, 1000,
      SOUND_CONFIG.pitchVar.pickup, 0, 'highpass', 600, 1, pri);
  }

  // ── Boss 音效 ──

  /** Boss 出场预警 */
  static bossAlert(): void {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playTone(200, 0.2, 'square', 0.12, 400);
        this.playTone(300, 0.15, 'square', 0.1, 500);
      }, i * 500);
    }
  }

  /** Boss 出场 */
  static bossAppear(): void {
    this.playTone(120, 0.5, 'sawtooth', 0.15, 60);
    setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 0.12, 80), 200);
    setTimeout(() => this.playTone(300, 0.3, 'sawtooth', 0.1, 100), 400);
  }

  /** Boss 地震波 */
  static bossEarthquake(): void {
    this.playTone(40, 0.6, 'sawtooth', 0.2, 20);
    this.playNoise(0.5, 0.1);
  }

  /** Boss 召唤 */
  static bossSummon(): void {
    this.playTone(600, 0.2, 'sine', 0.08, 800);
    this.playTone(800, 0.15, 'sine', 0.06, 1000);
    this.playNoise(0.2, 0.05);
  }

  /** Boss 受击 */
  static bossHit(): void {
    this.playTone(100, 0.08, 'square', 0.08, 50);
    this.playNoise(0.05, 0.04);
  }

  /** Boss 死亡 */
  static bossDeath(): void {
    this.playTone(80, 0.4, 'sawtooth', 0.18, 30);
    setTimeout(() => this.playTone(200, 0.3, 'sawtooth', 0.12, 60), 300);
    setTimeout(() => this.playTone(500, 0.5, 'triangle', 0.15, 800), 600);
  }
}
