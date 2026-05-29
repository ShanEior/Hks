import Phaser from 'phaser';
import {
  ActiveSkill, SkillId, SkillLevelConfig, SKILL_CONFIGS,
  MonsterType, StructureType, PLAYER_CONFIG,
} from './config';
import { Player } from './Player';
import { Monster } from './Monster';
import { Building } from './Building';

// ── 投射物 ──
interface Projectile {
  graphic: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
  startX: number; startY: number;
  angle: number;
  speed: number;
  lifetime: number;
  elapsed: number;
  damage: number;
  repairType: StructureType[];
  repairAmount: number;
  widthMultiplier?: number;
  targetMonster?: Monster;  // 追踪型
  bounceUsed?: boolean;
}

// ── 持续区域 ──
interface Zone {
  x: number; y: number;
  radius: number;
  remaining: number;
  tickTimer: number;
  damage: number;
  repairType: StructureType[];
  repairAmount: number;
  bonusDamageVs?: MonsterType;
  bonusDamageMultiplier?: number;
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

  constructor(
    scene: Phaser.Scene,
    getMonsters: () => Monster[],
    getPlayer: () => Player,
    getBuilding: () => Building,
  ) {
    this.scene = scene;
    this.getMonsters = getMonsters;
    this.getPlayer = getPlayer;
    this.getBuilding = getBuilding;
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
    const building = this.getBuilding();

    // 技能冷却 → 自动释放
    for (const skill of this.skills) {
      skill.timer -= delta / 1000;
      if (skill.timer <= 0) {
        skill.timer = skill.cooldown;
        this.castSkill(skill, player, monsters);
      }
    }

    // 投射物更新
    this.updateProjectiles(delta, monsters, building);

    // 持续区域更新
    this.updateZones(delta, monsters, building);

    // 清理过期对象
    this.projectiles = this.projectiles.filter(p => p.elapsed < p.lifetime);
    this.zones = this.zones.filter(z => z.remaining > 0);
  }

  // ── 技能释放调度 ──
  private castSkill(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    switch (skill.id) {
      case 'wood_reinforce':
        this.castWoodReinforce(skill, player, monsters);
        break;
      case 'stone_repair':
        this.castStoneRepair(skill, player, monsters);
        break;
      case 'waterproof':
        this.castWaterproof(skill, player, monsters);
        break;
      case 'insect_control':
        this.castInsectControl(skill, player);
        break;
      case 'painting_restore':
        this.castPaintingRestore(skill, player, monsters);
        break;
    }
  }

  // ── 木构加固：向最近敌人发射矩形冲击波 ──
  private castWoodReinforce(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    const speed = 400;
    const lifetime = 0.6;
    const width = 30;
    const height = (skill.range / 2) * (skill.widthMultiplier ?? 1);

    // 找最近怪物作为目标方向
    let nearest: Monster | null = null;
    let nearestDist = Infinity;
    for (const m of monsters) {
      if (m.isDead) continue;
      const d = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);
      if (d < nearestDist) { nearestDist = d; nearest = m; }
    }
    const angle = nearest
      ? Math.atan2(nearest.y - player.y, nearest.x - player.x)
      : -Math.PI / 2; // 无目标时默认向上

    const rect = this.scene.add.rectangle(player.x, player.y, width, height, 0xC4884D, 0.8);
    rect.setDepth(15);
    rect.setRotation(angle);

    this.projectiles.push({
      graphic: rect,
      startX: player.x, startY: player.y,
      angle, speed, lifetime, elapsed: 0,
      damage: skill.damage,
      repairType: [...skill.repairType],
      repairAmount: skill.repairAmount,
      widthMultiplier: skill.widthMultiplier,
    });
  }

  // ── 石材修补：圆形震波 ──
  private castStoneRepair(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    // 瞬间伤害
    this.damageInRadius(player.x, player.y, skill.range, skill.damage, monsters, skill.repairType, skill.repairAmount);

    // Lv.3 击退
    if (skill.knockbackForce) {
      for (const m of monsters) {
        const dist = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);
        if (dist < skill.range && !m.isDead) {
          const a = Math.atan2(m.y - player.y, m.x - player.x);
          m.sprite.x += Math.cos(a) * skill.knockbackForce * 0.02;
          m.sprite.y += Math.sin(a) * skill.knockbackForce * 0.02;
        }
      }
    }

    // 视觉：扩散圈
    this.playAoeEffect(player.x, player.y, skill.range, 0x999999);
  }

  // ── 防水封护：圆形水纹 ──
  private castWaterproof(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    for (const m of monsters) {
      const dist = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);
      if (dist < skill.range && !m.isDead) {
        let dmg = skill.damage;
        // 对酸雨怪额外伤害
        if (skill.bonusDamageVs && m.type === skill.bonusDamageVs) {
          dmg *= (skill.bonusDamageMultiplier ?? 2);
        }
        m.takeDamage(dmg);
        // 回血
        this.applyRepair(skill.repairType, skill.repairAmount, m.type);
      }
    }
    this.playAoeEffect(player.x, player.y, skill.range, 0x4488cc);
  }

  // ── 防虫处理：持续药雾 ──
  private castInsectControl(skill: ActiveSkill, player: Player): void {
    const g = this.scene.add.graphics();
    g.fillStyle(0x44cc44, 0.15);
    g.fillCircle(player.x, player.y, skill.range);
    g.setDepth(4);

    this.zones.push({
      x: player.x, y: player.y,
      radius: skill.range,
      remaining: skill.zoneDuration ?? 3,
      tickTimer: 0,
      damage: skill.damage,
      repairType: [...skill.repairType],
      repairAmount: skill.repairAmount,
      bonusDamageVs: skill.bonusDamageVs,
      bonusDamageMultiplier: skill.bonusDamageMultiplier,
      graphic: g,
    });

    // 区域淡出销毁
    this.scene.tweens.add({
      targets: g, alpha: 0, duration: (skill.zoneDuration ?? 3) * 1000,
      onComplete: () => g.destroy(),
    });
  }

  // ── 彩绘修复：追踪颜料弹 ──
  private castPaintingRestore(skill: ActiveSkill, player: Player, monsters: Monster[]): void {
    // 找最近怪物
    let nearest: Monster | null = null;
    let nearestDist = Infinity;
    for (const m of monsters) {
      const d = Phaser.Math.Distance.Between(player.x, player.y, m.x, m.y);
      if (d < nearestDist && !m.isDead) {
        nearestDist = d;
        nearest = m;
      }
    }
    if (!nearest) return;

    const ball = this.scene.add.circle(player.x, player.y, 5, 0xFF66CC);
    ball.setDepth(15);

    this.projectiles.push({
      graphic: ball,
      startX: player.x, startY: player.y,
      angle: 0, speed: 300, lifetime: 3, elapsed: 0,
      damage: skill.damage,
      repairType: [...skill.repairType],
      repairAmount: skill.repairAmount,
      targetMonster: nearest,
      bounceUsed: false,
    });
  }

  // ── 投射物更新 ──
  private updateProjectiles(delta: number, monsters: Monster[], building: Building): void {
    const dt = delta / 1000;

    for (const p of this.projectiles) {
      if (p.elapsed >= p.lifetime) continue;
      p.elapsed += dt;

      if (p.targetMonster) {
        // 追踪型（彩绘修复）
        if (p.targetMonster.isDead) {
          // 目标死亡，找新目标
          let nearest: Monster | null = null;
          let nearestDist = Infinity;
          for (const m of monsters) {
            const d = Phaser.Math.Distance.Between(p.graphic.x, p.graphic.y, m.x, m.y);
            if (d < nearestDist && !m.isDead) {
              nearestDist = d;
              nearest = m;
            }
          }
          if (nearest) {
            p.targetMonster = nearest;
          } else {
            p.elapsed = p.lifetime; // 无目标，销毁
            p.graphic.destroy();
            continue;
          }
        }
        // 更新方向
        const angle = Math.atan2(
          p.targetMonster.y - p.graphic.y,
          p.targetMonster.x - p.graphic.x,
        );
        p.graphic.x += Math.cos(angle) * p.speed * dt;
        p.graphic.y += Math.sin(angle) * p.speed * dt;

        // 命中检测
        const dist = Phaser.Math.Distance.Between(
          p.graphic.x, p.graphic.y,
          p.targetMonster.x, p.targetMonster.y,
        );
        if (dist < 15) {
          const m = p.targetMonster;
          m.takeDamage(p.damage);
          this.applyRepair(p.repairType, p.repairAmount, m.type);

          // Lv.2 小范围爆炸
          if (p.damage >= 30) {
            this.damageInRadius(m.x, m.y, 60, p.damage * 0.5, monsters, p.repairType, p.repairAmount);
            this.playAoeEffect(m.x, m.y, 60, 0xFF66CC);
          }

          // Lv.3 弹射
          if (!p.bounceUsed) {
            const others = monsters.filter(o => o !== m && !o.isDead);
            if (others.length > 0) {
              const next = others.reduce((a, b) => {
                const da = Phaser.Math.Distance.Between(m.x, m.y, a.x, a.y);
                const db = Phaser.Math.Distance.Between(m.x, m.y, b.x, b.y);
                return da < db ? a : b;
              });
              p.targetMonster = next;
              p.graphic.x = m.x;
              p.graphic.y = m.y;
              p.bounceUsed = true;
              const ball = p.graphic as Phaser.GameObjects.Arc;
              ball.setFillStyle(0xFFCC00); // 弹射变金色
              continue;
            }
          }
          p.elapsed = p.lifetime;
          p.graphic.destroy();
        }
      } else {
        // 方向投射物（木构加固）
        p.graphic.x += Math.cos(p.angle) * p.speed * dt;
        p.graphic.y += Math.sin(p.angle) * p.speed * dt;

        // 与怪物碰撞检测
        for (const m of monsters) {
          if (m.isDead) continue;
          const dist = Phaser.Math.Distance.Between(p.graphic.x, p.graphic.y, m.x, m.y);
          const hitRadius = 20 + m.sprite.radius;
          if (dist < hitRadius) {
            m.takeDamage(p.damage);
            this.applyRepair(p.repairType, p.repairAmount, m.type);
            // 穿透型，不销毁
          }
        }
      }
    }
  }

  // ── 持续区域更新 ──
  private updateZones(delta: number, monsters: Monster[], building: Building): void {
    const dt = delta / 1000;

    for (const z of this.zones) {
      z.remaining -= dt;
      z.tickTimer += dt;
      if (z.remaining <= 0) {
        z.graphic.destroy();
        continue;
      }

      // 每秒 tick
      if (z.tickTimer >= 1.0) {
        z.tickTimer -= 1.0;
        for (const m of monsters) {
          if (m.isDead) continue;
          const dist = Phaser.Math.Distance.Between(z.x, z.y, m.x, m.y);
          if (dist < z.radius) {
            let dmg = z.damage;
            if (z.bonusDamageVs && m.type === z.bonusDamageVs) {
              dmg *= (z.bonusDamageMultiplier ?? 2);
            }
            m.takeDamage(dmg);
            // 回血（每秒 tick 也回血）
            this.applyRepair(z.repairType, z.repairAmount, m.type);
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
        m.takeDamage(damage);
        this.applyRepair(repairType, repairAmount, m.type);
      }
    }
  }

  // ── 条件回血 ──
  private applyRepair(repairTypes: StructureType[], amount: number, monsterType: MonsterType): void {
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
      widthMultiplier: config.widthMultiplier,
      bonusDamageVs: config.bonusDamageVs,
      bonusDamageMultiplier: config.bonusDamageMultiplier,
      knockbackForce: config.knockbackForce,
      projectileBounce: config.projectileBounce,
      zoneDuration: config.zoneDuration,
    };
  }
}
