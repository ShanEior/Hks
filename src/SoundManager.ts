/**
 * 音效管理器 — 使用 Web Audio API 合成音效，无需外部音频文件
 */
export class SoundManager {
  private static ctx: AudioContext | null = null;

  private static getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    // 移动端需要用户交互后才能 resume
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** 播放一个短音调 */
  private static playTone(
    freq: number, duration: number, type: OscillatorType = 'square',
    volume = 0.1, freqEnd?: number,
  ): void {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (freqEnd) {
        osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // 音频初始化失败时静默
    }
  }

  /** 噪音爆发 */
  private static playNoise(duration: number, volume = 0.05): void {
    try {
      const ctx = this.getCtx();
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start(ctx.currentTime);
      source.stop(ctx.currentTime + duration);
    } catch {
      // 静默
    }
  }

  // ── 技能释放音 ──

  /** 木构加固 — 低沉重击 */
  static skillWood(): void {
    this.playTone(120, 0.25, 'triangle', 0.15, 60);
  }

  /** 石材修补 — 碎石震波 */
  static skillStone(): void {
    this.playTone(200, 0.3, 'sawtooth', 0.08, 80);
    this.playNoise(0.15, 0.03);
  }

  /** 防水封护 — 水流波纹 */
  static skillWater(): void {
    this.playTone(400, 0.35, 'sine', 0.08, 300);
    this.playTone(600, 0.2, 'sine', 0.04, 500);
  }

  /** 防虫处理 — 喷雾嘶嘶 */
  static skillInsect(): void {
    this.playNoise(0.4, 0.04);
    this.playTone(300, 0.3, 'sine', 0.03, 500);
  }

  /** 彩绘修复 — 清脆颜料 */
  static skillPaint(): void {
    this.playTone(800, 0.12, 'sine', 0.1, 1200);
    this.playTone(1000, 0.08, 'sine', 0.05, 1400);
  }

  // ── 战斗音 ──

  /** 怪物受击 */
  static hitMonster(): void {
    this.playTone(300, 0.06, 'square', 0.04, 150);
    this.playNoise(0.03, 0.02);
  }

  /** 怪物死亡 */
  static killMonster(): void {
    this.playNoise(0.15, 0.06);
    this.playTone(250, 0.2, 'sawtooth', 0.06, 80);
  }

  /** 普攻发射 */
  static autoAttack(): void {
    this.playTone(600, 0.05, 'sine', 0.04, 900);
  }

  // ── 系统音 ──

  /** 经验拾取 */
  static expPickup(): void {
    this.playTone(900, 0.08, 'sine', 0.05, 1200);
  }

  /** 升级 */
  static levelUp(): void {
    this.playTone(400, 0.1, 'triangle', 0.12, 600);
    this.playTone(600, 0.1, 'triangle', 0.08, 900);
    this.playTone(800, 0.15, 'triangle', 0.1, 1200);
  }

  /** 古建受击 */
  static buildingHit(): void {
    this.playTone(80, 0.2, 'sawtooth', 0.1, 40);
    this.playNoise(0.08, 0.04);
  }

  /** 古建回血 */
  static buildingHeal(): void {
    this.playTone(500, 0.15, 'sine', 0.06, 700);
    this.playTone(700, 0.1, 'sine', 0.04, 900);
  }

  /** 胜利 */
  static victory(): void {
    this.playTone(523, 0.15, 'triangle', 0.12, 659);
    setTimeout(() => this.playTone(659, 0.15, 'triangle', 0.12, 784), 150);
    setTimeout(() => this.playTone(784, 0.3, 'triangle', 0.15, 1047), 300);
  }

  /** 失败 */
  static defeat(): void {
    this.playTone(200, 0.3, 'sawtooth', 0.1, 80);
    this.playTone(150, 0.4, 'sawtooth', 0.08, 50);
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
