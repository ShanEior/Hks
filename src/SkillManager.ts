import Phaser from 'phaser';
import {
  ActiveSkill, SkillId, SkillLevelConfig, SKILL_CONFIGS,
  MonsterType, StructureType, PLAYER_CONFIG,
} from './config';
import { Player } from './Player';
import { Monster } from './Monster';
import { Boss } from './Boss';
import { Building } from './Building';
import { SoundManager } from './SoundManager';
import { VFX } from './VFX';

type SkillTarget = Monster | Boss;

// ── 投射物 ──
interface Projectile {
  graphic: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  glow?: Phaser.GameObjects.Image;  // 光晕图
  startX: number; startY: number;
  angle: number;
  speed: number;
  lifetime: number;
  elapsed: number;
  damage: number;
  repairType: StructureType[];
  repairAmount: number;
  level: number;
  widthMultiplier?: number;
  targetMonster?: SkillTarget;  // 追踪型
  hitTargets?: Set<SkillTarget>;
  remainingHits?: number;
  splashRadius?: number;
  chainRemaining?: number;
  hitRadius?: number;
  trailColor?: number;
  spinSpeed?: number;
  knockbackForce?: number;
  effectType?: 'wood' | 'paint' | 'whirlwind';
  bounceUsed?: boolean;
  trail?: Phaser.GameObjects.Particles.ParticleEmitter;
}

// ── 持续区域 ──
interface Zone {
  x: number; y: number;
  radius: number;
  remaining: number;
  tickTimer: number;
  tickInterval: number;
  kind: 'poison' | 'repair';
  damage: number;
  repairType: StructureType[];
  repairAmount: number;
  bonusDamageVs?: MonsterType;
  bonusDamageMultiplier?: number;
  followPlayer?: boolean;
  owner?: Player;
  extraShots?: number;
  level: number;
  graphic: Phaser.GameObjects.Graphics;
}

export class SkillManager {
  scene: Phaser.Scene;
  skills: ActiveSkill[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];

  // 提供外部引用
  getMonsters: () => Monster[];
  getPlayer: () => Player;
  getBuilding: () => Building;
  getBoss: () => Boss | null;

  constructor(
    scene: Phaser.Scene,
    getMonsters: () => Monster[],
    getPlayer: () => Player,
    getBuilding: () => Building,
    getBoss: () => Boss | null,
  ) {
    this.scene = scene;
    this.getMonsters = getMonsters;
    this.getPlayer = getPlayer;
    this.getBuilding = getBuilding;
    this.getBoss = getBoss;
  }

  /** 添加技能（新获得 Lv.1） */
  addSkill(skillId: SkillId): ActiveSkill | null {
    const existing = this.skills.find(s => s.id === skillId);
    if (existing) return null; // 已有此技能

    const config = SKILL_CONFIGS[skillId][0];
    const skill = this.createSkillFromConfig(skillId, config);
    this.skills.push(skill);
    return skill;
  }

  /** 升级技能 */
  upgradeSkill(skillId: SkillId): boolean {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill || skill.level >= skill.maxLevel) return false;

    const config = SKILL_CONFIGS[skillId][skill.level]; // level 是 1-indexed，数组是 0-indexed
    if (!config) return false;

    // 更新属性
    Object.assign(skill, {
      name: config.name,
      level: config.level,
      cooldown: config.cooldown,
      damage: config.damage,
      range: config.range,
      repairType: [...config.repairType],
      repairAmount: config.repairAmount,
      shots: config.shots,
      pulseCount: config.pulseCount,
      pulseInterval: config.pulseInterval,
      tickInterval: config.tickInterval,
      splashRadius: config.splashRadius,
      pierceCount: config.pierceCount,
      chainCount: config.chainCount,
      followPlayer: config.followPlayer,
      widthMultiplier: config.widthMultiplier,
      bonusDamageVs: config.bonusDamageVs,
      bonusDamageMultiplier: config.bonusDamageMultiplier,
      knockbackForce: config.knockbackForce,
      projectileBounce: config.projectileBounce,
      zoneDuration: config.zoneDuration,
    });
    return true;
  }

  /** 获取技能当前配置 */
  getSkillLevel(skillId: SkillId): number {
    const skill = this.skills.find(s => s.id === skillId);
    return skill ? skill.level : 0;
  }

  /** 主更新 */
  update(delta: number, time: number): void {
    const player = this.getPlayer();
    const monsters = this.getMonsters();

    // 技能冷却 → 自动释放
    for (const skill of this.skills) {
      skill.timer -= delta / 1000;
      if (skill.timer <= 0) {
        skill.timer = skill.cooldown;
        this.castSkill(skill, player, monsters);
      }
    }

    // 投射物更新
    this.updateProjectiles(delta, monsters);

    // 持续区域更新
    this.updateZones(delta, monsters);

    // 清理过期对象
    this.projectiles = this.projectiles.filter(p => {
      if (p.elapsed >= p.lifetime) {
        this.destroyProjectile(p);
        return false;
      }
      return true;
    });
    this.zones = this.zones.filter(z => z.remaining > 0);
  }

  // ── 技能释放调度 ──
  private castSkill(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    // ── 统一释放反馈（Cast Burst）：角色微缩 + 微闪 + 轻震 ──
    player.sprite.setScale(1.04, 1.04);
    this.scene.tweens.add({
      targets: player.sprite, scaleX: 1, scaleY: 1,
      duration: 50, ease: 'Back.easeOut',
    });
    const flashRing = this.scene.add.circle(player.x, player.y, 3, 0xffffff, 0.35);
    flashRing.setDepth(25);
    const flashCleanup = () => { if (flashRing.active) flashRing.destroy(); };
    this.scene.tweens.add({
      targets: flashRing, radius: 8, alpha: 0, duration: 80,
      onComplete: flashCleanup, onStop: flashCleanup,
    });
    VFX.shake(this.scene, 0.001, 30);

    switch (skill.id) {
      case 'wood_reinforce':
        SoundManager.skillWood(skill.level, player.x, player.y);
        VFX.skillWood(this.scene, player.x, player.y, 0, skill.level);
        this.castWoodReinforce(skill, player, monsters);
        break;
      case 'stone_repair':
        SoundManager.skillStone(skill.level, player.x, player.y);
        VFX.skillStone(this.scene, player.x, player.y, skill.range, skill.level);
        this.castStoneRepair(skill, player, monsters);
        break;
      case 'waterproof':
        SoundManager.skillWater(skill.level, player.x, player.y);
        VFX.skillWater(this.scene, player.x, player.y, skill.range, skill.level);
        this.castWaterproof(skill, player, monsters);
        break;
      case 'insect_control':
        SoundManager.skillInsect(skill.level, player.x, player.y);
        VFX.skillInsect(this.scene, player.x, player.y, skill.range, skill.level);
        this.castInsectControl(skill, player);
        break;
      case 'painting_restore':
        SoundManager.skillPaint(skill.level, player.x, player.y);
        VFX.skillPaint(this.scene, player.x, player.y, skill.level);
        this.castPaintingRestore(skill, player, monsters);
        break;
      case 'repair_field':
        SoundManager.skillRepairField(skill.level, player.x, player.y);
        VFX.skillRepairField(this.scene, player.x, player.y, skill.range, skill.level);
        this.castRepairField(skill, player);
        break;
      case 'whirlwind_slash':
        SoundManager.skillWhirlwind(skill.level, player.x, player.y);
        VFX.skillWhirlwind(this.scene, player.x, player.y, skill.level);
        this.castWhirlwindSlash(skill, player, monsters);
        break;
      case 'chain_lightning':
        SoundManager.skillLightning(skill.level, player.x, player.y);
        VFX.skillLightningCast(this.scene, player.x, player.y, skill.level);
        this.castChainLightning(skill, player, monsters);
        break;
    }
  }

  // ── 木构加固：向最近敌人发射木梁冲击波 ──
  private castWoodReinforce(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    const speed = 520;
    const lifetime = 0.75;
    const shots = skill.shots ?? 1;
    const spread = Phaser.Math.DegToRad(16);
    const nearest = this.findNearestTarget(player.x, player.y, monsters);
    const baseAngle = nearest
      ? Math.atan2(nearest.y - player.y, nearest.x - player.x)
      : -Math.PI / 2;

    for (let i = 0; i < shots; i++) {
      const offset = shots === 1 ? 0 : (i - (shots - 1) / 2) * spread;
      const angle = baseAngle + offset;
      const texKey = 'wood_beam';
      const beam = this.scene.textures.exists(texKey)
        ? this.scene.add.image(player.x, player.y, texKey)
        : this.scene.add.rectangle(player.x, player.y, 30, 80, 0xC4884D, 0.9) as any;

      beam.setDepth(15);
      beam.setRotation(angle);
      beam.setScale(skill.widthMultiplier ?? 1.1, 1.05 + skill.level * 0.12);

      // Travel 拖尾
      const woodTrail = VFX.projectileTrail(this.scene, beam as any, [0xc4884d, 0xdaa060, 0x8b6914], 40, 120, 0.5);

      this.projectiles.push({
        graphic: beam as Phaser.GameObjects.Image,
        trail: woodTrail,
        startX: player.x, startY: player.y,
        angle, speed, lifetime, elapsed: 0,
        damage: skill.damage,
        repairType: [...skill.repairType],
        repairAmount: skill.repairAmount,
        level: skill.level,
        widthMultiplier: skill.widthMultiplier,
        hitTargets: new Set(),
        remainingHits: skill.pierceCount ?? 3,
        splashRadius: skill.splashRadius,
        hitRadius: 24 * (skill.widthMultiplier ?? 1),
        trailColor: 0xc4884d,
        effectType: 'wood',
      });
    }
    // Travel 音效延迟 60ms 启动（避开 Cast 音覆盖）
    this.scene.time.delayedCall(60, () => SoundManager.skillWoodTravel(player.x, player.y));
  }

  // ── 石材修补：圆形震波 ──
  private castStoneRepair(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    const pulses = skill.pulseCount ?? 1;
    const pulseInterval = (skill.pulseInterval ?? 0.15) * 1000;

    for (let i = 0; i < pulses; i++) {
      this.scene.time.delayedCall(i * pulseInterval, () => {
        const radiusFactor = 0.55 + i * 0.18;
        const radius = skill.range * Math.min(radiusFactor, 1);
        const damageFactor = 1 - i * 0.12;
        this.damageInRadius(
          player.x, player.y, radius, skill.damage * damageFactor,
          monsters, skill.repairType, skill.repairAmount,
        );
        if (skill.knockbackForce) {
          this.applyKnockbackInRadius(player.x, player.y, radius, skill.knockbackForce * (0.85 + i * 0.08), monsters);
        }
        this.playAoeEffect(player.x, player.y, radius, 0x999999);
        VFX.burst(this.scene, player.x, player.y, 4 + i * 2, [0x777777, 0x999999, 0xcccccc], 80, 3, 260);
        VFX.stonePulse(this.scene, player.x, player.y, skill.level);
        SoundManager.skillStoneHit(skill.level, player.x, player.y);
      });
    }
  }

  // ── 防水封护：多目标水幕打击 ──
  private castWaterproof(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    const targets = this.getNearestTargets(player.x, player.y, monsters, skill.shots ?? 4, skill.range);
    if (targets.length === 0) {
      this.damageInRadius(player.x, player.y, skill.range * 0.6, skill.damage, monsters, skill.repairType, skill.repairAmount);
      this.playAoeEffect(player.x, player.y, skill.range * 0.6, 0x4488cc);
      return;
    }

    targets.forEach((target, index) => {
      this.scene.time.delayedCall(index * 60, () => {
        if (target.isDead) return;
        const hitX = target.x;
        const hitY = target.y;
        let damage = skill.damage;
        if (skill.bonusDamageVs && target instanceof Monster && target.type === skill.bonusDamageVs) {
          damage *= skill.bonusDamageMultiplier ?? 2;
        }
        target.takeDamage(damage, undefined, undefined, true);
        SoundManager.skillWaterHit(skill.level, hitX, hitY);
        this.applyRepair(skill.repairType, skill.repairAmount);
        this.damageSplash(
          hitX, hitY, target, skill.splashRadius ?? 0, damage * 0.45,
          monsters, skill.repairType, skill.repairAmount,
        );
        VFX.waterImpact(this.scene, hitX, hitY, skill.splashRadius ?? 26, skill.level);
      });
    });
    // Travel 音效延迟 60ms 启动（避开 Cast 音覆盖）
    this.scene.time.delayedCall(60, () => SoundManager.skillWaterTravel(player.x, player.y));
  }

  // ── 防虫处理：跟随玩家的持续药雾 ──
  private castInsectControl(skill: ActiveSkill, player: Player): void {
    const g = this.scene.add.graphics();
    g.setPosition(player.x, player.y);
    g.setDepth(4);

    this.zones.push({
      x: player.x, y: player.y,
      radius: skill.range,
      remaining: skill.zoneDuration ?? 3,
      tickTimer: 0,
      tickInterval: skill.tickInterval ?? 1,
      kind: 'poison',
      damage: skill.damage,
      repairType: [...skill.repairType],
      repairAmount: skill.repairAmount,
      bonusDamageVs: skill.bonusDamageVs,
      bonusDamageMultiplier: skill.bonusDamageMultiplier,
      followPlayer: skill.followPlayer,
      owner: skill.followPlayer ? player : undefined,
      extraShots: skill.shots ?? 0,
      level: skill.level,
      graphic: g,
    });
  }

  // ── 恢复结构血条：跟随玩家的修复法阵 ──
  private castRepairField(skill: ActiveSkill, player: Player): void {
    const g = this.scene.add.graphics();
    g.setPosition(player.x, player.y);
    g.setDepth(4);

    this.zones.push({
      x: player.x, y: player.y,
      radius: skill.range,
      remaining: skill.zoneDuration ?? 4,
      tickTimer: 0,
      tickInterval: skill.tickInterval ?? 0.6,
      kind: 'repair',
      damage: 0,
      repairType: [...skill.repairType],
      repairAmount: skill.repairAmount,
      followPlayer: true,
      owner: player,
      extraShots: skill.shots ?? 6,
      level: skill.level,
      graphic: g,
    });
  }

  // ── 旋风斩：朝目标方向发射旋风刃 ──
  private castWhirlwindSlash(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    const speed = 460 + skill.level * 45;
    const lifetime = skill.range / speed;
    const shots = skill.shots ?? 1;
    const spread = Phaser.Math.DegToRad(12);
    const nearest = this.findNearestTarget(player.x, player.y, monsters);
    const baseAngle = nearest
      ? Math.atan2(nearest.y - player.y, nearest.x - player.x)
      : -Math.PI / 2;

    for (let i = 0; i < shots; i++) {
      const offset = shots === 1 ? 0 : (i - (shots - 1) / 2) * spread;
      const angle = baseAngle + offset;
      const blade = this.scene.add.rectangle(player.x, player.y, 58, 22, 0x66ddff, 0.95);
      blade.setDepth(15);
      blade.setRotation(angle);
      blade.setScale(skill.widthMultiplier ?? 1.15, 1.0 + skill.level * 0.06);

      // Travel 拖尾
      const whirlTrail = VFX.projectileTrail(this.scene, blade as any, [0x66ddff, 0xaaddff, 0xffffff], 20, 80, 0.4);

      this.projectiles.push({
        graphic: blade as Phaser.GameObjects.Rectangle,
        trail: whirlTrail,
        startX: player.x, startY: player.y,
        angle, speed, lifetime, elapsed: 0,
        damage: skill.damage,
        repairType: [...skill.repairType],
        repairAmount: skill.repairAmount,
        level: skill.level,
        widthMultiplier: skill.widthMultiplier,
        hitTargets: new Set(),
        remainingHits: skill.pierceCount ?? 4,
        hitRadius: 24 * (skill.widthMultiplier ?? 1.1),
        trailColor: 0x66ddff,
        spinSpeed: 14,
        knockbackForce: skill.knockbackForce,
        effectType: 'whirlwind',
      });
    }
    // Travel 音效延迟 60ms 启动（避开 Cast 音覆盖）
    this.scene.time.delayedCall(60, () => SoundManager.skillWhirlwindTravel(player.x, player.y));
  }

  // ── 雷电链：锁定最近敌人并连续弹射 ──
  private castChainLightning(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    const shots = skill.shots ?? 1;
    const used = new Set<SkillTarget>();
    for (let i = 0; i < shots; i++) {
      const first = this.findNearestTarget(player.x, player.y, monsters, used);
      if (!first) return;
      used.add(first);
      this.scene.time.delayedCall(i * 90, () => {
        const hitSet = new Set<SkillTarget>();
        let current: SkillTarget | null = first;
        let fromX = player.x;
        let fromY = player.y;
        let hops = 0;
        while (current && hops <= (skill.chainCount ?? 3)) {
          SoundManager.skillLightningTravel(player.x, player.y);
          VFX.lightningArc(this.scene, fromX, fromY, current.x, current.y, hops === 0, skill.level);
          VFX.lightningImpact(this.scene, current.x, current.y, skill.level);
          current.takeDamage(skill.damage * Math.max(0.62, 1 - hops * 0.08), undefined, undefined, true);
          SoundManager.skillLightningHit(skill.level, current.x, current.y);
          hitSet.add(current);
          fromX = current.x;
          fromY = current.y;
          current = this.findNearestTarget(fromX, fromY, monsters, hitSet, 180);
          hops++;
        }
      });
    }
  }

  // ── 彩绘修复：多枚追踪颜料弹 ──
  private castPaintingRestore(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    const shots = skill.shots ?? 1;
    const targets = this.getNearestTargets(player.x, player.y, monsters, shots, 9999);
    if (targets.length === 0) return;

    for (let i = 0; i < shots; i++) {
      const target = targets[i % targets.length];
      const offset = shots === 1 ? 0 : (i - (shots - 1) / 2) * 10;
      const ball = this.scene.add.image(player.x + offset, player.y - 6, 'paint_ball');
      ball.setDepth(15);
      ball.setScale(skill.level >= 2 ? 1.25 : 1.05);

      const paintTrail = VFX.projectileTrail(this.scene, ball as any, [0xff4488, 0xff8800, 0x4488ff, 0xcc44ff], 30, 150, 0.45);

      const glowTexKey = 'exp_orb';
      const glow = this.scene.textures.exists(glowTexKey)
        ? this.scene.add.image(player.x + offset, player.y - 6, glowTexKey)
        : null;
      if (glow) {
        glow.setDepth(14);
        glow.setAlpha(0.28);
        glow.setScale(1.15);
        glow.setTint([0xff4488, 0xff8800, 0x4488ff, 0xcc44ff][i % 4]);
      }

      this.projectiles.push({
        graphic: ball as Phaser.GameObjects.Image,
        glow: glow ?? undefined,
        trail: paintTrail,
        startX: player.x, startY: player.y,
        angle: 0, speed: 360 + i * 25, lifetime: 3.2, elapsed: 0,
        damage: skill.damage,
        repairType: [...skill.repairType],
        repairAmount: skill.repairAmount,
        level: skill.level,
        targetMonster: target,
        hitTargets: new Set(),
        splashRadius: skill.splashRadius,
        chainRemaining: skill.chainCount ?? 0,
        hitRadius: 16,
        trailColor: [0xff4488, 0xff8800, 0x4488ff, 0xcc44ff][i % 4],
        spinSpeed: 8,
        effectType: 'paint',
        bounceUsed: false,
      });
    }
    // Travel 音效延迟 60ms 启动（避开 Cast 音覆盖）
    this.scene.time.delayedCall(60, () => SoundManager.skillPaintTravel(player.x, player.y));
  }

  // ── 投射物更新 ──
  private updateProjectiles(delta: number, monsters: Monster[]): void {
    const dt = delta / 1000;

    for (const p of this.projectiles) {
      if (p.elapsed >= p.lifetime) continue;
      p.elapsed += dt;
      if (p.spinSpeed) {
        p.graphic.rotation += p.spinSpeed * dt;
        if (p.glow) p.glow.rotation -= p.spinSpeed * 0.6 * dt;
      }

      if (p.targetMonster) {
        if (p.targetMonster.isDead) {
          const nearest = this.findNearestTarget(p.graphic.x, p.graphic.y, monsters, p.hitTargets);
          if (nearest) {
            p.targetMonster = nearest;
          } else {
            p.elapsed = p.lifetime;
            this.destroyProjectile(p);
            continue;
          }
        }
        const angle = Math.atan2(
          p.targetMonster.y - p.graphic.y,
          p.targetMonster.x - p.graphic.x,
        );
        p.graphic.x += Math.cos(angle) * p.speed * dt;
        p.graphic.y += Math.sin(angle) * p.speed * dt;
        if (p.glow) {
          p.glow.x = p.graphic.x;
          p.glow.y = p.graphic.y;
        }
        if (p.trailColor && Math.random() < 0.35) {
          this.spawnTrailDot(p.graphic.x, p.graphic.y, p.trailColor);
        }

        const dist = Phaser.Math.Distance.Between(
          p.graphic.x, p.graphic.y,
          p.targetMonster.x, p.targetMonster.y,
        );
        if (dist < (p.hitRadius ?? 16)) {
          this.handleProjectileHit(p, p.targetMonster, monsters);
        }
      } else {
        p.graphic.x += Math.cos(p.angle) * p.speed * dt;
        p.graphic.y += Math.sin(p.angle) * p.speed * dt;
        if (p.trailColor && Math.random() < 0.22) {
          this.spawnTrailDot(p.graphic.x, p.graphic.y, p.trailColor);
        }

        for (const m of monsters) {
          if (m.isDead || p.hitTargets?.has(m)) continue;
          const dist = Phaser.Math.Distance.Between(p.graphic.x, p.graphic.y, m.x, m.y);
          const hitRadius = (p.hitRadius ?? 18) + m.radius * 0.6;
          if (dist < hitRadius) {
            this.handleProjectileHit(p, m, monsters);
            if (!p.graphic.active) break;
          }
        }

        const boss = this.getBoss();
        if (boss && !boss.isDead && !p.hitTargets?.has(boss) && p.graphic.active) {
          const dist = Phaser.Math.Distance.Between(p.graphic.x, p.graphic.y, boss.x, boss.y);
          const hitRadius = (p.hitRadius ?? 18) + boss.radius * 0.45;
          if (dist < hitRadius) {
            this.handleProjectileHit(p, boss, monsters);
          }
        }
      }
    }
  }

  // ── 持续区域更新 ──
  private updateZones(delta: number, monsters: Monster[]): void {
    const dt = delta / 1000;

    for (const z of this.zones) {
      z.remaining -= dt;
      if (z.remaining <= 0) {
        z.graphic.destroy();
        continue;
      }

      if (z.followPlayer && z.owner) {
        z.x = z.owner.x;
        z.y = z.owner.y;
        z.graphic.x = z.x;
        z.graphic.y = z.y;
      }
      if (z.kind === 'poison') {
        this.renderPoisonZone(z);
      } else {
        this.renderRepairZone(z);
      }

      z.tickTimer += dt;
      while (z.tickTimer >= z.tickInterval) {
        z.tickTimer -= z.tickInterval;

        if (z.kind === 'poison') {
          VFX.insectTick(this.scene, z.x, z.y, Math.min(42, z.radius * 0.35));
          for (const m of monsters) {
            if (m.isDead) continue;
            const dist = Phaser.Math.Distance.Between(z.x, z.y, m.x, m.y);
            if (dist < z.radius) {
              let dmg = z.damage;
              if (z.bonusDamageVs && m.type === z.bonusDamageVs) {
                dmg *= (z.bonusDamageMultiplier ?? 2);
              }
              m.takeDamage(dmg, undefined, undefined, true);
              SoundManager.skillInsectHit(z.level, m.x, m.y);
              this.applyRepair(z.repairType, z.repairAmount);
            }
          }

          const extraTargets = z.extraShots ?? 0;
          if (extraTargets > 0) {
            const spores = this.getNearestTargets(z.x, z.y, monsters, extraTargets, z.radius + 70);
            for (const target of spores) {
              if (target.isDead) continue;
              let sporeDamage = z.damage * 0.65;
              if (z.bonusDamageVs && target instanceof Monster && target.type === z.bonusDamageVs) {
                sporeDamage *= z.bonusDamageMultiplier ?? 2;
              }
              target.takeDamage(sporeDamage, undefined, undefined, true);
              SoundManager.skillInsectHit(z.level, target.x, target.y);
              VFX.insectSpore(this.scene, target.x, target.y);
            }
          }
        } else {
          // 修复法阵纯回复，不产生命中音效
          this.applyRepair(z.repairType, z.repairAmount);
          VFX.repairFieldPulse(this.scene, z.x, z.y, z.radius, z.level, z.extraShots ?? 6);
        }
      }
    }
  }

  // ── 圆形范围伤害 ──
  private damageInRadius(
    cx: number, cy: number, radius: number, damage: number,
    monsters: Monster[],
    repairType: StructureType[], repairAmount: number,
  ): void {
    for (const m of monsters) {
      if (m.isDead) continue;
      const dist = Phaser.Math.Distance.Between(cx, cy, m.x, m.y);
      if (dist < radius) {
        m.takeDamage(damage, undefined, undefined, true);
        this.applyRepair(repairType, repairAmount);
      }
    }

    const boss = this.getBoss();
    if (boss && !boss.isDead) {
      const dist = Phaser.Math.Distance.Between(cx, cy, boss.x, boss.y);
      if (dist < radius) {
        boss.takeDamage(damage);
      }
    }
  }

  private damageSplash(
    cx: number, cy: number, primary: SkillTarget, radius: number, damage: number,
    monsters: Monster[],
    repairType: StructureType[], repairAmount: number,
  ): void {
    if (radius <= 0) return;
    for (const m of monsters) {
      if (m.isDead || m === primary) continue;
      const dist = Phaser.Math.Distance.Between(cx, cy, m.x, m.y);
      if (dist < radius) {
        m.takeDamage(damage, undefined, undefined, true);
        this.applyRepair(repairType, repairAmount);
      }
    }

    const boss = this.getBoss();
    if (boss && !boss.isDead && boss !== primary) {
      const dist = Phaser.Math.Distance.Between(cx, cy, boss.x, boss.y);
      if (dist < radius) {
        boss.takeDamage(damage);
      }
    }
  }

  // ── 条件回血 ──
  private applyRepair(repairTypes: StructureType[], amount: number): void {
    if (amount <= 0 || repairTypes.length === 0) return;
    const building = this.getBuilding();
    for (const type of repairTypes) {
      building.healStructure(type, amount);
    }
  }

  // ── AOE 视觉特效 ──
  private playAoeEffect(x: number, y: number, radius: number, color: number): void {
    const g = this.scene.add.graphics();
    g.lineStyle(3, color, 0.8);
    g.strokeCircle(x, y, 10);
    g.setDepth(20);

    this.scene.tweens.add({
      targets: g,
      scaleX: radius / 10,
      scaleY: radius / 10,
      alpha: 0,
      duration: 250,
      onComplete: () => g.destroy(),
    });
  }

  private applyKnockbackInRadius(cx: number, cy: number, radius: number, force: number, monsters: Monster[]): void {
    for (const m of monsters) {
      if (m.isDead) continue;
      const dist = Phaser.Math.Distance.Between(cx, cy, m.x, m.y);
      if (dist >= radius) continue;
      const a = Math.atan2(m.y - cy, m.x - cx);
      const factor = 1 - dist / radius;
      m.sprite.x += Math.cos(a) * force * 0.02 * factor;
      m.sprite.y += Math.sin(a) * force * 0.02 * factor;
    }
  }

  private handleProjectileHit(p: Projectile, target: SkillTarget, monsters: Monster[]): void {
    const hitX = target.x;
    const hitY = target.y;
    p.hitTargets?.add(target);
    target.takeDamage(p.damage, undefined, undefined, true);
    this.applyRepair(p.repairType, p.repairAmount);

    if (p.splashRadius) {
      this.damageSplash(hitX, hitY, target, p.splashRadius, p.damage * 0.5, monsters, p.repairType, p.repairAmount);
    }

    if (p.effectType === 'wood') {
      SoundManager.skillWoodHit(p.level, hitX, hitY);
      VFX.woodImpact(this.scene, hitX, hitY, p.level);
    } else if (p.effectType === 'paint') {
      SoundManager.skillPaintHit(p.level, hitX, hitY);
      VFX.paintImpact(this.scene, hitX, hitY, p.splashRadius ?? 24, p.level);
    } else if (p.effectType === 'whirlwind') {
      SoundManager.skillWhirlwindHit(p.level, hitX, hitY);
      VFX.whirlwindHit(this.scene, hitX, hitY, p.level);
      if (p.knockbackForce) {
        this.applyKnockbackInRadius(hitX, hitY, 70, p.knockbackForce, monsters);
      }
    }

    if (p.targetMonster) {
      if ((p.chainRemaining ?? 0) > 0) {
        const next = this.findNearestTarget(hitX, hitY, monsters, p.hitTargets);
        if (next) {
          p.targetMonster = next;
          p.chainRemaining = (p.chainRemaining ?? 0) - 1;
          p.graphic.x = hitX;
          p.graphic.y = hitY;
          if (p.glow) {
            p.glow.x = hitX;
            p.glow.y = hitY;
          }
          p.bounceUsed = true;
          if ('setTint' in p.graphic) {
            (p.graphic as Phaser.GameObjects.Image).setTint(0xffdd44);
          }
          return;
        }
      }
      p.elapsed = p.lifetime;
      this.destroyProjectile(p);
      return;
    }

    p.remainingHits = (p.remainingHits ?? 1) - 1;
    if ((p.remainingHits ?? 0) <= 0) {
      p.elapsed = p.lifetime;
      this.destroyProjectile(p);
    }
  }

  private findNearestTarget(
    x: number, y: number, monsters: Monster[],
    excluded: Set<SkillTarget> = new Set(),
    maxDistance = Infinity,
  ): SkillTarget | null {
    let nearest: SkillTarget | null = null;
    let nearestDist = Infinity;
    for (const m of monsters) {
      if (m.isDead || excluded.has(m)) continue;
      const d = Phaser.Math.Distance.Between(x, y, m.x, m.y);
      if (d < nearestDist && d <= maxDistance) {
        nearestDist = d;
        nearest = m;
      }
    }
    const boss = this.getBoss();
    if (boss && !boss.isDead && !excluded.has(boss)) {
      const d = Phaser.Math.Distance.Between(x, y, boss.x, boss.y);
      if (d < nearestDist && d <= maxDistance) {
        nearest = boss;
      }
    }
    return nearest;
  }

  private getNearestTargets(
    x: number, y: number, monsters: Monster[],
    count: number, maxDistance: number,
  ): SkillTarget[] {
    const result: SkillTarget[] = monsters
      .filter(m => !m.isDead && Phaser.Math.Distance.Between(x, y, m.x, m.y) <= maxDistance)
      .sort((a, b) => {
        const da = Phaser.Math.Distance.Between(x, y, a.x, a.y);
        const db = Phaser.Math.Distance.Between(x, y, b.x, b.y);
        return da - db;
      })
      .slice(0, count);

    const boss = this.getBoss();
    if (boss && !boss.isDead && Phaser.Math.Distance.Between(x, y, boss.x, boss.y) <= maxDistance) {
      result.push(boss);
      result.sort((a, b) => {
        const da = Phaser.Math.Distance.Between(x, y, a.x, a.y);
        const db = Phaser.Math.Distance.Between(x, y, b.x, b.y);
        return da - db;
      });
    }
    return result.slice(0, count);
  }

  private spawnTrailDot(x: number, y: number, color: number): void {
    const dot = this.scene.add.circle(x, y, 2, color, 0.35);
    dot.setDepth(13);
    this.scene.tweens.add({
      targets: dot,
      scale: 0.3,
      alpha: 0,
      duration: 140,
      onComplete: () => dot.destroy(),
    });
  }

  private destroyProjectile(p: Projectile): void {
    if (p.trail && p.trail.active) {
      p.trail.stop();
      this.scene.time.delayedCall(200, () => { if (p.trail && p.trail.active) p.trail.destroy(); });
    }
    if (p.glow?.active) p.glow.destroy();
    if (p.graphic.active) p.graphic.destroy();
  }

  private renderPoisonZone(z: Zone): void {
    const g = z.graphic;
    const t = this.scene.time.now / 1000;
    g.clear();
    g.fillStyle(0x44cc44, 0.18);
    g.lineStyle(3, 0x88cc44, 0.36);
    g.fillCircle(0, 0, z.radius);
    g.strokeCircle(0, 0, z.radius * 0.94);
    g.lineStyle(2, 0xaaff66, 0.26);
    g.strokeCircle(0, 0, z.radius * (0.72 + Math.sin(t * 3) * 0.03));
    for (let i = 0; i < 26 + z.level * 8; i++) {
      const a = t * (0.6 + i * 0.03) + i * 1.27;
      const d = (0.18 + ((i * 17) % 100) / 100 * 0.7) * z.radius;
      const x = Math.cos(a) * d;
      const y = Math.sin(a * 1.15) * d * 0.72;
      const r = 2 + (i % 4);
      const alpha = 0.18 + ((i % 4) * 0.06);
      g.fillStyle(i % 3 === 0 ? 0xccee88 : 0x66dd66, alpha);
      g.fillCircle(x, y, r);
    }
  }

  private renderRepairZone(z: Zone): void {
    const g = z.graphic;
    const t = this.scene.time.now / 1000;
    g.clear();
    g.lineStyle(3, 0x99ff66, 0.45);
    g.strokeCircle(0, 0, z.radius);
    g.lineStyle(2, 0x66ff88, 0.28);
    g.strokeCircle(0, 0, z.radius * 0.72);
    for (let i = 0; i < (z.extraShots ?? 6); i++) {
      const a = t * 1.8 + (Math.PI * 2 * i) / (z.extraShots ?? 6);
      const d = i % 2 === 0 ? z.radius * 0.72 : z.radius * 0.42;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      g.fillStyle(0x99ff88, 0.9);
      g.fillCircle(x, y, 4);
      g.fillStyle(0xffffff, 0.45);
      g.fillCircle(x, y, 2);
    }
  }


  // ── 工具 ──
  private createSkillFromConfig(skillId: SkillId, config: SkillLevelConfig): ActiveSkill {
    return {
      id: skillId,
      name: config.name,
      level: config.level,
      maxLevel: 3,
      cooldown: config.cooldown,
      timer: 1.0, // 首次释放延迟 1s
      damage: config.damage,
      range: config.range,
      repairType: [...config.repairType],
      repairAmount: config.repairAmount,
      shots: config.shots,
      pulseCount: config.pulseCount,
      pulseInterval: config.pulseInterval,
      tickInterval: config.tickInterval,
      splashRadius: config.splashRadius,
      pierceCount: config.pierceCount,
      chainCount: config.chainCount,
      followPlayer: config.followPlayer,
      widthMultiplier: config.widthMultiplier,
      bonusDamageVs: config.bonusDamageVs,
      bonusDamageMultiplier: config.bonusDamageMultiplier,
      knockbackForce: config.knockbackForce,
      projectileBounce: config.projectileBounce,
      zoneDuration: config.zoneDuration,
    };
  }
}
