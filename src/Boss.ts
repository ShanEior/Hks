import Phaser from 'phaser';
import { BOSS_CONFIG, MAP_WIDTH, MAP_HEIGHT, SPEED_FACTOR, StructureType } from './config';
import { Building } from './Building';
import { VFX } from './VFX';
import { SoundManager } from './SoundManager';

/**
 * Boss: 灾蚀核心 (Calamity Core)
 *
 * 出场条件：关卡剩余 30 秒
 * - 500 HP，攻击古建全部 4 个结构
 * - 地震波：全屏震动 + 每个结构扣血
 * - 召唤小怪：每隔数秒召唤一批
 * - 死亡：掉落大量经验 + 必定掉修补箱
 */
export class Boss {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;

  hp: number;
  maxHp: number;
  speed: number;            // px/s
  damage: number;
  attackInterval: number;   // ms
  radius: number;
  expDrop: number;

  // 技能冷却
  private lastEarthquakeTime = 0;
  private lastSummonTime = 0;
  private lastAttackTime = 0;

  // 目标：古建所在位置
  private targetX: number;
  private targetY: number;
  private attackRange: number;

  isDead = false;
  isActive = false; // 是否已出场

  // 回调
  onAttack: ((boss: Boss) => void) | null = null;
  onSummon: ((count: number, type: string) => void) | null = null;
  onDeath: ((boss: Boss) => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    targetX: number, targetY: number,
    attackRange: number,
  ) {
    this.scene = scene;
    this.targetX = targetX;
    this.targetY = targetY;
    this.attackRange = attackRange;

    // 从配置读取
    this.hp = BOSS_CONFIG.hp;
    this.maxHp = BOSS_CONFIG.hp;
    this.speed = BOSS_CONFIG.speed * SPEED_FACTOR;
    this.damage = BOSS_CONFIG.damage;
    this.attackInterval = BOSS_CONFIG.attackInterval;
    this.radius = BOSS_CONFIG.radius;
    this.expDrop = BOSS_CONFIG.expDrop;

    // 初始化冷却为当前时间，避免首帧连放三技能
    const now = scene.time.now;
    this.lastAttackTime = now;
    this.lastSummonTime = now;
    this.lastEarthquakeTime = now;

    // 创建 Boss 精灵
    if (scene.textures.exists('calamity_core')) {
      this.sprite = scene.add.image(x, y, 'calamity_core');
    } else {
      // fallback：紫色大圆
      const key = '_boss_fallback';
      if (!scene.textures.exists(key)) {
        const gfx = scene.add.graphics();
        gfx.fillStyle(0x6611AA, 1);
        gfx.fillCircle(48, 48, 48);
        gfx.generateTexture(key, 96, 96);
        gfx.destroy();
      }
      this.sprite = scene.add.image(x, y, key);
    }
    this.sprite.setDepth(15);
    this.sprite.setScale(1.5); // 大尺寸

    // 出场动画：从透明放大出现
    this.sprite.setAlpha(0);
    this.sprite.setScale(0.5);
    scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      scale: 1.5,
      duration: 800,
      ease: 'Back.easeOut',
    });

    // 呼吸/脉动动画
    scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.55,
      scaleY: 1.45,
      duration: 1200 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 头顶血条
    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(16);
    this.drawHpBar();

    this.isActive = true;
  }

  update(time: number, delta: number): void {
    if (this.isDead || !this.isActive) return;

    // ── 移动：向古建缓慢靠近 ──
    const distToTarget = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      this.targetX, this.targetY,
    );

    const buildingRange = this.attackRange + 60; // boss 稍微远一点就开始攻击
    if (distToTarget > buildingRange) {
      const angle = Math.atan2(
        this.targetY - this.sprite.y,
        this.targetX - this.sprite.x,
      );
      const dt = delta / 1000;
      this.sprite.x += Math.cos(angle) * this.speed * dt;
      this.sprite.y += Math.sin(angle) * this.speed * dt;
    }

    // ── 技能 1：地震波（全屏震动 + 建筑扣血） ──
    if (time - this.lastEarthquakeTime >= BOSS_CONFIG.earthquakeCooldown) {
      this.lastEarthquakeTime = time;
      this.castEarthquake();
    }

    // ── 技能 2：召唤小怪 ──
    if (time - this.lastSummonTime >= BOSS_CONFIG.summonCooldown) {
      this.lastSummonTime = time;
      this.castSummon();
    }

    // ── 基础攻击：间隔攻击古建 ──
    if (time - this.lastAttackTime >= this.attackInterval) {
      this.lastAttackTime = time;
      this.onAttack?.(this);
      this.sprite.setTint(0xFF6688);
      this.scene.time.delayedCall(100, () => {
        if (this.sprite.active && !this.isDead) {
          this.sprite.clearTint();
        }
      });
    }

    // 绘制血条
    this.drawHpBar();
  }

  /** 地震波：全屏震动 + 建筑扣血 */
  private castEarthquake(): void {
    SoundManager.bossEarthquake();

    // 全屏震动（剧烈）
    VFX.bossEarthquake(this.scene);

    // 地面裂纹特效
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 120;
      VFX.shockwave(
        this.scene,
        this.sprite.x + Math.cos(angle) * dist,
        this.sprite.y + Math.sin(angle) * dist,
        30 + Math.random() * 40,
        0x6611AA,
        500,
      );
    }

    // 扣血由 Building.damageAllStructures 处理（从 GameScene 调用）
    // 这里通过回调告知 GameScene
    // 为了解耦，我们直接触发一个场景事件
    this.scene.events.emit('boss-earthquake', BOSS_CONFIG.earthquakeDamage);
  }

  /** 召唤小怪：在 Boss 周围生成一批小怪 */
  private castSummon(): void {
    SoundManager.bossSummon();

    // 召唤特效：紫色光环扩散
    VFX.shockwave(this.scene, this.sprite.x, this.sprite.y, 80, 0xAA44FF, 600);

    // 紫色粒子爆散
    VFX.burst(this.scene, this.sprite.x, this.sprite.y, 25,
      [0xAA44FF, 0xCC66FF, 0x8822CC, 0xFF66FF], 200, 4, 600);

    // 通过回调通知 GameScene 生成小怪
    this.onSummon?.(BOSS_CONFIG.summonCount, BOSS_CONFIG.summonType);
  }

  /** 受击 */
  takeDamage(amount: number): boolean {
    if (this.isDead) return false;
    this.hp -= amount;

    // 受击反馈
    SoundManager.bossHit();
    VFX.bossHit(this.scene, this.sprite.x, this.sprite.y, amount);

    // 受击闪白
    this.sprite.setTint(0xFFFFFF);
    this.scene.time.delayedCall(80, () => {
      if (this.sprite.active && !this.isDead) {
        this.sprite.clearTint();
      }
    });

    // Boss 低血量警告（HP < 30% 时闪烁红）
    if (this.hp / this.maxHp < 0.3) {
      this.sprite.setTint(0xFF4444);
      this.scene.time.delayedCall(120, () => {
        if (this.sprite.active && !this.isDead) {
          this.sprite.clearTint();
        }
      });
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true;
    }
    return false;
  }

  /** 死亡 */
  private die(): void {
    this.isDead = true;

    // 死亡特效：超大爆炸
    VFX.bossDeath(this.scene, this.sprite.x, this.sprite.y);

    // 巨型冲击波
    VFX.shockwave(this.scene, this.sprite.x, this.sprite.y, 200, 0xAA44FF, 1000);

    SoundManager.bossDeath();

    // 死亡回调（掉落经验 + 修补箱）
    this.onDeath?.(this);

    // 延迟销毁精灵（让死亡特效播放完）
    this.scene.time.delayedCall(600, () => {
      if (this.sprite.active) this.sprite.destroy();
      if (this.hpBar.active) this.hpBar.destroy();
    });
  }

  /** 计算 Boss 对古建的当期伤害（attached 在帧更新中调用） */
  get buildingDamage(): number {
    return this.damage;
  }

  /** 绘制头顶血条 */
  private drawHpBar(): void {
    this.hpBar.clear();
    if (this.isDead) return;

    const barW = 60;
    const barH = 5;
    const bx = this.sprite.x - barW / 2;
    const by = this.sprite.y - this.radius * 1.5 - 12;

    // 背景
    this.hpBar.fillStyle(0x330033, 0.8);
    this.hpBar.fillRect(bx, by, barW, barH);

    // 填充
    const ratio = this.hp / this.maxHp;
    const fillColor = ratio > 0.6 ? 0xCC44FF : ratio > 0.3 ? 0xFF8844 : 0xFF2244;
    this.hpBar.fillStyle(fillColor, 1);
    this.hpBar.fillRect(bx, by, barW * ratio, barH);

    // 金色边框
    this.hpBar.lineStyle(1, 0xFFCC44, 0.8);
    this.hpBar.strokeRect(bx, by, barW, barH);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}
