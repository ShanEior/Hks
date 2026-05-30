import Phaser from 'phaser';
import {
  ActiveSkill, SkillId, SkillLevelConfig, SKILL_CONFIGS,
  MonsterType, StructureType, PLAYER_CONFIG,
  MAP_WIDTH, MAP_HEIGHT,
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
}

// ── 持续区域 ──
interface Zone {
  x: number; y: number;
  radius: number;
  remaining: number;
  tickTimer: number;
  tickInterval: number;
  kind: 'poison' | 'quake';
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
    // ── 统一释放反馈（Cast Burst）：角色微缩 + 微闪 ──
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
    const speed = 340;
    const lifetime = 99;
    const shots = skill.shots ?? 1;
    const spread = Phaser.Math.DegToRad(14);
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
        : this.scene.add.rectangle(player.x, player.y, 80, 22, 0xC4884D, 0.9) as any;

      beam.setDepth(15);
      beam.setRotation(angle + Math.PI / 2); // 横过来：长边垂直于飞行方向
      const s = skill.widthMultiplier ?? 1.15;
      beam.setScale(s * 2.2, 1.3 + skill.level * 0.2);

      this.projectiles.push({
        graphic: beam as Phaser.GameObjects.Image,
        startX: player.x, startY: player.y,
        angle, speed, lifetime, elapsed: 0,
        damage: skill.damage,
        repairType: [...skill.repairType],
        repairAmount: skill.repairAmount,
        level: skill.level,
        widthMultiplier: skill.widthMultiplier,
        hitTargets: new Set(),
        remainingHits: 999,
        splashRadius: skill.splashRadius,
        hitRadius: 100,
        trailColor: 0xc4884d,
        effectType: 'wood',
      });
    }
  }

  // ── 石材修补：持续地震区域 ──
  private castStoneRepair(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    const g = this.scene.add.graphics();
    g.setPosition(player.x, player.y);
    g.setDepth(4);

    const zoneDuration = skill.zoneDuration ?? 3;

    // 施放瞬间大震
    VFX.stonePulse(this.scene, player.x, player.y, skill.level);
    SoundManager.skillStoneHit(skill.level, player.x, player.y);
    VFX.shake(this.scene, 0.004, 120);

    this.zones.push({
      x: player.x, y: player.y,
      radius: skill.range,
      remaining: zoneDuration,
      tickTimer: 0,
      tickInterval: skill.tickInterval ?? 0.5,
      kind: 'quake',
      damage: skill.damage,
      repairType: [...skill.repairType],
      repairAmount: skill.repairAmount,
      followPlayer: false,
      extraShots: skill.knockbackForce ?? 0, // 复用 extraShots 传递击退力
      level: skill.level,
      graphic: g,
    });
  }

  // ── 防水封护：随机炮击地图上3个圆形区域 ──
  private castWaterproof(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    const bombCount = 3;
    const margin = 80;
    const delayPerBomb = 400; // ms between each bomb

    for (let i = 0; i < bombCount; i++) {
      this.scene.time.delayedCall(i * delayPerBomb, () => {
        // 绕开古建区域
        const building = this.getBuilding();
        const bx = building.x;
        const by = building.y;
        const safeDist = 240;
        let tx: number, ty: number;
        let tries = 0;
        do {
          tx = margin + Math.random() * (MAP_WIDTH - margin * 2);
          ty = margin + Math.random() * (MAP_HEIGHT - margin * 2);
          tries++;
        } while (Phaser.Math.Distance.Between(tx, ty, bx, by) < safeDist && tries < 20);

        // 预警标记 — 蓝色光圈收缩
        VFX.waterBombWarning(this.scene, tx, ty, skill.range, skill.level);

        // 炸弹从天而降（600ms 预警后）
        this.scene.time.delayedCall(600, () => {
          VFX.waterBombFall(this.scene, tx, ty, skill.level, () => {
            // 落地后爆炸
            VFX.waterBombImpact(this.scene, tx, ty, skill.range, skill.level);
            SoundManager.skillWaterHit(skill.level, tx, ty);

            this.damageInRadius(tx, ty, skill.range, skill.damage, monsters, skill.repairType, skill.repairAmount);
            if (skill.splashRadius && skill.splashRadius > 0) {
              this.damageInRadius(tx, ty, skill.splashRadius, skill.damage * 0.5, monsters, skill.repairType, skill.repairAmount);
              VFX.shockwave(this.scene, tx, ty, skill.splashRadius, 0x4488ff, 450, skill.damage);
            }
          });
        });
      });
    }
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

  // ── 旋风斩：地图内反弹飞行，持续时间结束后消失 ──
  private castWhirlwindSlash(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    const speed = 380 + skill.level * 40;
    const lifetime = skill.zoneDuration ?? 6;
    const shots = skill.shots ?? 1;
    const spread = Phaser.Math.DegToRad(shots > 1 ? 360 / shots : 0);

    for (let i = 0; i < shots; i++) {
      const angle = shots === 1
        ? Math.random() * Math.PI * 2
        : (i / shots) * Math.PI * 2 + Math.random() * 0.3;
      const blade = this.scene.add.image(player.x, player.y, 'fx_whirlwind');
      blade.setDepth(15);
      blade.setRotation(angle);
      const s = skill.widthMultiplier ?? 1.15;
      blade.setScale(s * 1.2, 1.0 + skill.level * 0.08);

      this.projectiles.push({
        graphic: blade,
        startX: player.x, startY: player.y,
        angle, speed, lifetime, elapsed: 0,
        damage: skill.damage,
        repairType: [...skill.repairType],
        repairAmount: skill.repairAmount,
        level: skill.level,
        widthMultiplier: skill.widthMultiplier,
        hitTargets: new Set(),
        remainingHits: skill.pierceCount ?? 99,
        hitRadius: 30 * (skill.widthMultiplier ?? 1.1),
        trailColor: 0x66ddff,
        spinSpeed: 18,
        knockbackForce: skill.knockbackForce,
        effectType: 'whirlwind',
      });
    }
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
          const hopFromX = fromX;
          const hopFromY = fromY;
          const hopTarget = current;
          const hopIdx = hops;
          this.scene.time.delayedCall(hopIdx * 80, () => {
            if (hopTarget.isDead) return;
            VFX.lightningArc(this.scene, hopFromX, hopFromY, hopTarget.x, hopTarget.y, hopIdx === 0, skill.level);
            VFX.lightningImpact(this.scene, hopTarget.x, hopTarget.y, skill.level);
            hopTarget.takeDamage(skill.damage * Math.max(0.62, 1 - hopIdx * 0.08), undefined, undefined, true);
            SoundManager.skillLightningHit(skill.level, hopTarget.x, hopTarget.y);
          });
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
      ball.setScale(skill.level >= 2 ? 2.0 : 1.6);

      const glowTexKey = 'exp_orb';
      const glow = this.scene.textures.exists(glowTexKey)
        ? this.scene.add.image(player.x + offset, player.y - 6, glowTexKey)
        : null;
      if (glow) {
        glow.setDepth(14);
        glow.setAlpha(0.5);
        glow.setScale(1.8);
        glow.setTint([0xff4488, 0xff8800, 0x4488ff, 0xcc44ff][i % 4]);
      }

      this.projectiles.push({
        graphic: ball as Phaser.GameObjects.Image,
        glow: glow ?? undefined,
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
        if (p.effectType === 'whirlwind') {
          this.spawnWhirlwindTrail(p.graphic.x, p.graphic.y, p.graphic.rotation, p.level);
        } else if (p.trailColor && Math.random() < 0.22) {
          this.spawnTrailDot(p.graphic.x, p.graphic.y, p.trailColor);
        }

        for (const m of monsters) {
          if (m.isDead || !m.canBeTargeted || p.hitTargets?.has(m)) continue;
          const dist = Phaser.Math.Distance.Between(p.graphic.x, p.graphic.y, m.x, m.y);
          const hitRadius = (p.hitRadius ?? 18) + m.radius * 0.6;
          if (dist < hitRadius) {
            // 木梁直接伤害（确保命中）
            if (p.effectType === 'wood') {
              p.hitTargets!.add(m);
              m.takeDamage(p.damage);
              this.applyRepair(p.repairType, p.repairAmount);
              SoundManager.skillWoodHit(p.level, m.x, m.y);
              VFX.woodImpact(this.scene, m.x, m.y, p.level);
            } else {
              this.handleProjectileHit(p, m, monsters);
            }
            if (!p.graphic.active) break;
          }
        }

        const boss = this.getBoss();
        if (boss && !boss.isDead && !p.hitTargets?.has(boss) && p.graphic.active) {
          const dist = Phaser.Math.Distance.Between(p.graphic.x, p.graphic.y, boss.x, boss.y);
          const hitRadius = (p.hitRadius ?? 18) + boss.radius * 0.45;
          if (dist < hitRadius) {
            // 木梁直接伤害 Boss
            if (p.effectType === 'wood') {
              p.hitTargets!.add(boss);
              boss.takeDamage(p.damage);
              this.applyRepair(p.repairType, p.repairAmount);
              SoundManager.skillWoodHit(p.level, boss.x, boss.y);
              VFX.woodImpact(this.scene, boss.x, boss.y, p.level);
            } else {
              this.handleProjectileHit(p, boss, monsters);
            }
          }
        }
      }

      // 旋风刃碰到地图边缘反弹
      if (p.effectType === 'whirlwind' && p.graphic.active) {
        if (p.graphic.x < 20) { p.graphic.x = 20; p.angle = Math.PI - p.angle; }
        else if (p.graphic.x > MAP_WIDTH - 20) { p.graphic.x = MAP_WIDTH - 20; p.angle = Math.PI - p.angle; }
        if (p.graphic.y < 20) { p.graphic.y = 20; p.angle = -p.angle; }
        else if (p.graphic.y > MAP_HEIGHT - 20) { p.graphic.y = MAP_HEIGHT - 20; p.angle = -p.angle; }
      }
      // 木梁飞出地图后销毁
      if (p.effectType === 'wood' && p.graphic.active) {
        const margin = 100;
        if (p.graphic.x < -margin || p.graphic.x > MAP_WIDTH + margin ||
            p.graphic.y < -margin || p.graphic.y > MAP_HEIGHT + margin) {
          this.destroyProjectile(p);
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
      } else if (z.kind === 'quake') {
        this.renderQuakeZone(z);
      }

      z.tickTimer += dt;
      while (z.tickTimer >= z.tickInterval) {
        z.tickTimer -= z.tickInterval;

        if (z.kind === 'quake') {
          // 地震脉冲：伤害 + 向外击退
          VFX.stonePulse(this.scene, z.x, z.y, z.level);
          SoundManager.skillStoneHit(z.level, z.x, z.y);
          VFX.shake(this.scene, 0.003 + z.level * 0.001, 80);
          // 石屑粒子爆散 — 每次脉冲大量碎石飞溅
          VFX.burst(this.scene, z.x, z.y, 14 + z.level * 4, [0x666655, 0x888877, 0x999988, 0xaaaa99], 180, 4, 500, 'fx_bolt_hit');
          VFX.burst(this.scene, z.x, z.y, 8 + z.level * 3, [0x555544, 0x777766, 0x888877, 0xccccbb], 140, 3, 400, 'fx_dust_16');
          VFX.burst(this.scene, z.x, z.y, 5 + z.level * 2, [0x444433, 0x666655, 0x888877], 260, 5, 550, 'fx_glow_64');
          // 地面尘圈
          VFX.shockwave(this.scene, z.x, z.y, z.radius * 0.5, 0x888877, 280, z.damage);
          for (const m of monsters) {
            if (m.isDead) continue;
            const dist = Phaser.Math.Distance.Between(z.x, z.y, m.x, m.y);
            if (dist < z.radius) {
              m.takeDamage(z.damage, undefined, undefined, true);
              this.applyRepair(z.repairType, z.repairAmount);
              // 向圆心外击退
              const knockbackForce = z.extraShots ?? 200;
              const angle = Math.atan2(m.y - z.y, m.x - z.x);
              const factor = 1 - dist / z.radius;
              m.sprite.x += Math.cos(angle) * knockbackForce * 0.025 * factor;
              m.sprite.y += Math.sin(angle) * knockbackForce * 0.025 * factor;
            }
          }
          // Boss 也吃地震
          const boss = this.getBoss();
          if (boss && !boss.isDead) {
            const dist = Phaser.Math.Distance.Between(z.x, z.y, boss.x, boss.y);
            if (dist < z.radius) {
              boss.takeDamage(z.damage);
            }
          }
        } else if (z.kind === 'poison') {
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
      if (m.isDead || !m.canBeTargeted || excluded.has(m)) continue;
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
      .filter(m => !m.isDead && m.canBeTargeted && Phaser.Math.Distance.Between(x, y, m.x, m.y) <= maxDistance)
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

  private spawnWhirlwindTrail(x: number, y: number, rotation: number, level: number): void {
    // 每帧以 ~55% 概率生成旋转粒子
    if (Math.random() > 0.55) return;

    const colors = [0x66ddff, 0xaaddff, 0xffffff, 0x44bbee, 0x88eeff];
    const color = colors[Math.floor(Math.random() * colors.length)];

    // 1) 旋转弧光 — 大范围弧形残影甩出
    const arcAngle = rotation + (Math.random() - 0.5) * 2.0;
    const arcR = 24 + level * 10;
    const arc = this.scene.add.arc(x, y, arcR, arcAngle - 0.45, arcAngle + 0.45, false, color, 0);
    arc.setStrokeStyle(4 + level * 2, color, 0.8);
    arc.setDepth(16);
    this.scene.tweens.add({
      targets: arc,
      x: x + Math.cos(arcAngle) * 70,
      y: y + Math.sin(arcAngle) * 70,
      alpha: 0,
      duration: 200 + Math.random() * 150,
      ease: 'Sine.easeOut',
      onComplete: () => arc.destroy(),
    });

    // 2) 厚重粒子爆散 — 每次2~3个大颗粒
    const texKey = ['fx_slash', 'fx_glow_64', 'fx_bolt_hit'][Math.floor(Math.random() * 3)];
    const particleCount = 2 + level;
    for (let i = 0; i < particleCount; i++) {
      if (!this.scene.textures.exists(texKey)) continue;
      const p = this.scene.add.image(x, y, texKey);
      p.setDepth(16);
      p.setScale(0.8 + Math.random() * 1.2);
      p.setAlpha(0.8 + Math.random() * 0.2);
      p.setTint(color);
      p.setRotation(Math.random() * Math.PI * 2);
      const spreadAngle = rotation + (Math.random() - 0.5) * 2.5;
      const dist = 120 + Math.random() * 180;
      this.scene.tweens.add({
        targets: p,
        x: p.x + Math.cos(spreadAngle) * dist * 0.3,
        y: p.y + Math.sin(spreadAngle) * dist * 0.3,
        alpha: 0,
        scaleX: p.scaleX * 0.15,
        scaleY: p.scaleY * 0.15,
        rotation: p.rotation + (Math.random() - 0.5) * 6,
        duration: 250 + Math.random() * 250,
        ease: 'Sine.easeOut',
        onComplete: () => p.destroy(),
      });
    }

    // 3) 小碎屑 — 大范围密度层
    for (let i = 0; i < 2 + level * 2; i++) {
      const dot = this.scene.add.circle(
        x + (Math.random() - 0.5) * 40,
        y + (Math.random() - 0.5) * 40,
        2 + Math.random() * 4,
        color,
        0.6 + Math.random() * 0.4,
      );
      dot.setDepth(16);
      this.scene.tweens.add({
        targets: dot,
        x: dot.x + (Math.random() - 0.5) * 80,
        y: dot.y + (Math.random() - 0.5) * 80,
        alpha: 0,
        scale: 0.1,
        duration: 160 + Math.random() * 200,
        ease: 'Sine.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  private destroyProjectile(p: Projectile): void {
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

  private renderQuakeZone(z: Zone): void {
    const g = z.graphic;
    const t = this.scene.time.now / 1000;
    const pulse = 1 + Math.sin(t * 8) * 0.06;
    g.clear();

    // 灰色阴影填充 — 暗化地面
    g.fillStyle(0x333333, 0.18);
    g.fillCircle(0, 0, z.radius * 0.95 * pulse);
    g.fillStyle(0x222222, 0.12);
    g.fillCircle(0, 0, z.radius * 0.6 * pulse);

    // 外圈主环 — 加粗灰褐色
    g.lineStyle(7, 0x887766, 0.55);
    g.strokeCircle(0, 0, z.radius * pulse);
    g.lineStyle(4, 0x998877, 0.38);
    g.strokeCircle(0, 0, z.radius * 0.78 * pulse);
    g.lineStyle(2, 0x776655, 0.28);
    g.strokeCircle(0, 0, z.radius * 0.48 * pulse);

    // 地面裂缝 — 加粗锯齿线，更多裂缝
    const cracks = 10 + z.level * 4;
    for (let i = 0; i < cracks; i++) {
      const baseAngle = (Math.PI * 2 * i) / cracks + t * 0.25;
      const len = z.radius * (0.4 + 0.45 * Math.abs(Math.sin(i * 2.7 + t * 0.5)));
      g.lineStyle(3, 0x665544, 0.45);
      const segments = 5;
      for (let s = 0; s < segments; s++) {
        const r1 = (s / segments) * len;
        const r2 = ((s + 1) / segments) * len;
        const ax = Math.cos(baseAngle + s * 0.2) * r1;
        const ay = Math.sin(baseAngle + s * 0.2) * r1;
        const bx = Math.cos(baseAngle + (s + 1) * 0.2) * r2;
        const by = Math.sin(baseAngle + (s + 1) * 0.2) * r2;
        g.lineBetween(ax, ay, bx, by);
      }
    }

    // 碎石粒子 — 更大、更多
    for (let i = 0; i < 16 + z.level * 6; i++) {
      const a = t * 1.2 + i * 0.85;
      const d = z.radius * (0.15 + 0.65 * Math.abs(Math.sin(i * 1.3 + t)));
      const sx = Math.cos(a) * d;
      const sy = Math.sin(a * 0.7) * d;
      g.fillStyle(0x665544, 0.55);
      g.fillCircle(sx, sy, 2 + (i % 5));
    }

    // 中心暗核
    g.fillStyle(0x111111, 0.22);
    g.fillCircle(0, 0, 14 + z.level * 4);
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
