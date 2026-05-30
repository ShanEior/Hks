import Phaser from 'phaser';
import {
  MAP_WIDTH, MAP_HEIGHT, GAME_WIDTH, GAME_HEIGHT, GAME_DURATION,
  PLAYER_CONFIG, BUILDING_CONFIG, MONSTER_TEMPLATES,
  SPAWN_DISTANCE, INITIAL_SPAWN_INTERVAL, MAX_MONSTERS,
  EXP_ORB_CONFIG, PICKUP_RANGE,
  BASE_EXP_TO_LEVEL, EXP_PER_LEVEL, ALL_SKILL_IDS,
  SKILL_CONFIGS, WAVE_STAGES,
  calcTimeScaling,
  MonsterType, SkillId, WaveStage,
} from './config';
import { Player } from './Player';
import { Building } from './Building';
import { Monster } from './Monster';
import { HUD } from './HUD';
import { SkillManager } from './SkillManager';
import { SoundManager } from './SoundManager';
import { VFX } from './VFX';
import { generateAllTextures } from './ArtGen';
import { preloadSprites, nthKey } from './SpriteLoader';

// ── 水洼 ──
interface Puddle {
  x: number; y: number;
  radius: number;
  remaining: number;
  graphic: Phaser.GameObjects.Graphics;
}

// ── 自动普攻弹 ──
interface AutoBolt {
  graphic: Phaser.GameObjects.Image;
  target: Monster;
  speed: number;
  damage: number;
  lifetime: number;
}

// ── 经验球 ──
interface ExpOrb {
  graphic: Phaser.GameObjects.Image;
  value: number;
  x: number; y: number;
  lifetime: number;
}

// ── 修补箱 ──
interface RepairCrate {
  graphic: Phaser.GameObjects.Image;
  x: number; y: number;
  lifetime: number;
}

// ── 升级选项 ──
interface LevelUpOption {
  id: SkillId;
  name: string;
  level: number;
  isUpgrade: boolean;
  description: string;
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private building!: Building;
  private hud!: HUD;
  private skillManager!: SkillManager;
  private monsters: Monster[] = [];
  private puddles: Puddle[] = [];
  private expOrbs: ExpOrb[] = [];
  private repairCrates: RepairCrate[] = [];

  private gameTime = GAME_DURATION;
  private spawnTimer = 0;
  private killCount = 0;
  private invincibleTimer = 0;
  private spawnInterval = INITIAL_SPAWN_INTERVAL;
  private isGameOver = false;
  private isPaused = false;
  private seenMonsterTypes = new Set<MonsterType>();

  // 自动普攻
  private autoAttackTimer = 0;
  private readonly autoAttackCooldown = 0.7;
  private readonly autoAttackDamage = 22;
  private autoBolts: AutoBolt[] = [];

  // 升级面板状态
  private levelUpPanelActive = false;

  // 虚拟摇杆（移动端）
  private joystickBase: Phaser.GameObjects.Arc | null = null;
  private joystickKnob: Phaser.GameObjects.Arc | null = null;
  private joystickActive = false;
  private joystickId: number | null = null;
  private joystickStartX = 0;
  private joystickStartY = 0;
  private readonly joystickMaxDist = 50;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    preloadSprites(this);
  }

  create(): void {
    // 生成全部程序化精灵纹理（玩家、怪物、古建、UI等）
    generateAllTextures(this);

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.drawBackground();
    this.placeEnvironmentSprites();

    this.building = new Building(
      this, BUILDING_CONFIG.x, BUILDING_CONFIG.y,
      BUILDING_CONFIG.structures as any,
    );
    this.building.onFailure = () => this.endGame(false);

    this.player = new Player(
      this, BUILDING_CONFIG.x,
      BUILDING_CONFIG.y + PLAYER_CONFIG.startOffsetY,
      PLAYER_CONFIG.maxHp, PLAYER_CONFIG.moveSpeed,
      PLAYER_CONFIG.radius, PLAYER_CONFIG.color,
    );
    this.cameras.main.startFollow(this.player.sprite, true, 0.09, 0.09);

    this.hud = new HUD(this);

    this.skillManager = new SkillManager(
      this, () => this.monsters, () => this.player, () => this.building,
    );
    this.skillManager.addSkill('wood_reinforce');

    this.setupDebugControls();
    this.setupTouchJoystick();
  }

  update(time: number, delta: number): void {
    if (this.isGameOver) return;

    if (this.isPaused) {
      // 暂停期间仅更新 HUD（血量条）
      this.hud.update(this.player, this.building, this.gameTime);
      return;
    }

    this.player.update(delta);

    // 刷怪（波次驱动）
    const stage = this.getCurrentStage();
    if (stage) {
    this.invincibleTimer = Math.max(0, this.invincibleTimer - delta);
      this.spawnTimer += delta;
      if (this.spawnTimer >= stage.spawnInterval) {
        this.spawnTimer -= stage.spawnInterval;
        this.spawnWave(stage);
      }
    }

    // 怪物更新
    for (const m of this.monsters) {
      m.update(time, delta);
    }

    this.checkPlayerMonsterCollision();
    this.checkFreezeAura();
    this.monsters = this.monsters.filter(m => !m.isDead);

    // 经验球更新
    this.updateExpOrbs(delta);
    // 修补箱更新
    this.updateRepairCrates(delta);

    // 自动普攻
    this.updateAutoAttack(delta);

    // 技能更新
    this.skillManager.update(delta, time);

    // 水洼/灼烧
    this.updatePuddles(delta);
    this.building.updateBurn(delta);

    // 升级检测（在经验球拾取后）
    this.checkLevelUp();

    this.gameTime -= delta / 1000;
    if (this.gameTime <= 0) {
      this.gameTime = 0;
      this.endGame(true);
      return;
    }

    this.hud.update(this.player, this.building, this.gameTime);
  }

  // ── 背景 ──
  private drawBackground(): void {
    const tex = this.textures.get('background');
    if (tex) {
      this.add.image(MAP_WIDTH / 2, MAP_HEIGHT / 2, 'background').setDepth(0);
    } else {
      const bg = this.add.graphics();
      bg.fillStyle(0x4a6530, 1);
      bg.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      bg.setDepth(0);
    }
  }

  // ── 树 + 石头精灵 ──
  private placeEnvironmentSprites(): void {
    const cx = MAP_WIDTH / 2, cy = MAP_HEIGHT / 2;
    const hash = (x: number, y: number): number =>
      ((x * 374761393 + y * 668265263) ^ 0x5bf03635) >>> 0;

    // ── 石头稀疏散布 ──
    let gi = 0;
    for (let i = 0; i < 40; i++) {
      const gx = hash(i+999, 30) % MAP_WIDTH;
      const gy = hash(40, i+999) % MAP_HEIGHT;
      if (Math.abs(gy-cy) < 50 && Math.abs(gx-cx) < 50) continue;
      if (hash(gx+1, gy+1) % 12 > 0) continue;
      const key = nthKey('ground', gi);
      if (!this.textures.exists(key)) continue;
      this.add.image(gx, gy, key)
        .setScale(0.5 + (hash(gx,gy) % 100) / 100 * 0.6)
        .setDepth(1);
      gi++;
    }

    // ═══ 第 4 层：树木 ═══
    const treeSpots: [number, number, number, number, boolean][] = [
      [420,340,0.6,2,false],[1540,330,0.55,2,true],[720,310,0.5,2,false],
      [1300,320,0.55,2,true],[900,330,0.5,2,true],[1080,325,0.55,2,false],
      [340,480,0.55,2,true],[1600,470,0.5,2,false],
      [260,620,0.75,3,true],[1660,600,0.7,3,false],[560,580,0.65,3,false],
      [1440,590,0.7,3,true],[760,640,0.65,3,true],[1200,630,0.7,3,false],
      [140,700,0.8,3,false],[1760,690,0.75,3,true],
      [220,780,0.75,3,false],[1720,770,0.8,3,true],
      [180,880,0.95,4,false],[1720,860,0.9,4,true],
      [420,900,0.9,4,true],[1560,920,0.85,4,false],
      [700,940,0.85,4,false],[1300,930,0.9,4,true],
      [100,1000,1.05,4,false],[1820,980,1.0,4,true],
      [520,1050,0.95,4,true],[1400,1030,0.9,4,false],
      [900,1070,0.85,4,true],[1080,1065,0.9,4,false],
    ];
    let ti = 0;
    for (const [tx, ty, s, d, flip] of treeSpots) {
      if (Math.abs(ty-cy)<80 && Math.abs(tx-cx)<80) continue;
      const key = nthKey('trees', ti);
      if (!this.textures.exists(key)) continue;
      const img = this.add.image(tx, ty, key);
      img.setScale(s).setDepth(d);
      if (flip) img.setFlipX(true);
      ti++;
    }

    // ═══ 第 5 层：竹子 ═══
    const bSpot: [number, number, number, number][] = [
      [640,720,0.65,3],[1360,710,0.6,3],
      [600,960,0.8,4],[1400,950,0.75,4],
      [540,1080,0.95,4],[1480,1060,0.9,4],
    ];
    let bi = 0;
    for (const [bx, by, s, d] of bSpot) {
      const key = nthKey('bamboo', bi);
      if (this.textures.exists(key))
        this.add.image(bx, by, key).setScale(s).setDepth(d);
      bi++;
    }

    // ═══ 第 6 层：山脉远景 ═══
    const mSpot: [number, number, number, number][] = [
      [200,250,0.3,0],[600,240,0.28,0],[1000,250,0.32,0],
      [1400,245,0.27,0],[1700,240,0.3,0],
      [100,400,0.35,1],[1800,390,0.33,1],
      [300,500,0.4,1],[1600,490,0.38,1],
    ];
    let mi = 0;
    for (const [mx, my, s, d] of mSpot) {
      const key = nthKey('mountain', mi);
      if (this.textures.exists(key))
        this.add.image(mx, my, key).setScale(s).setDepth(d);
      mi++;
    }
  }

  // ── 波次系统 ──
  private getCurrentStage(): WaveStage | null {
    const elapsed = GAME_DURATION - this.gameTime;
    for (const stage of WAVE_STAGES) {
      if (elapsed >= stage.timeStart && elapsed < stage.timeEnd) return stage;
    }
    return null;
  }

  private spawnWave(stage: WaveStage): void {
    if (this.monsters.length >= MAX_MONSTERS) return;
    const totalW = stage.monsters.reduce((s, m) => s + m.weight, 0);
    for (let i = 0; i < stage.countPerWave; i++) {
      let r = Math.random() * totalW;
      let type: MonsterType = stage.monsters[0].type;
      for (const entry of stage.monsters) {
        r -= entry.weight;
        if (r <= 0) { type = entry.type; break; }
      }
      this.spawnSingleMonster(type);
    }
  }

  private spawnSingleMonster(type: MonsterType): void {
    const template = MONSTER_TEMPLATES[type];
    const elapsed = GAME_DURATION - this.gameTime;
    // 随时间增强: 每30秒HP+15%,伤害+10%,速度+5%,最高3倍
    const factor = 1 + Math.min(2, elapsed / 30 * 0.15);
    const scaledTemplate = { ...template,
      hp: Math.round(template.hp * factor),
      damage: Math.round(template.damage * (1 + (factor - 1) * 0.7)),
      speed: template.speed * (1 + (factor - 1) * 0.3),
    };
    const angle = Math.random() * Math.PI * 2;
    const sx = MAP_WIDTH / 2 + Math.cos(angle) * SPAWN_DISTANCE;
    const sy = MAP_HEIGHT / 2 + Math.sin(angle) * SPAWN_DISTANCE;

    // 根据已过时间计算敌怪强化倍率
    const elapsed = GAME_DURATION - this.gameTime;
    const scaling = calcTimeScaling(elapsed);

    const monster = new Monster(
      this, sx, sy, scaledTemplate,
      BUILDING_CONFIG.x, BUILDING_CONFIG.y,
      BUILDING_CONFIG.attackRange,
      scaling,
    );

    monster.onAttack = (m) => {
      for (const structType of m.attackStructures) {
        this.building.damageStructure(structType, m.damage);
      }
      if (m.type === 'acid_rain') this.addPuddle(m.x, m.y);
      if (m.type === 'fire') {
        for (const st of m.attackStructures) this.building.applyBurn(st, 5, 2);
      }
    };

    monster.onPlayerContact = (m) => {
      if (m.type === 'wind') this.player.applyKnockback(m.x, m.y, 250);
    };

    monster.onDeath = (m) => {
      this.killCount++;
      this.killCount++;
      this.spawnExpOrb(m.x, m.y, m.expDrop);
      // 15% 概率掉落修补箱
      if (Math.random() < 0.15) {
        this.spawnRepairCrate(m.x, m.y);
      }
    };

    this.monsters.push(monster);

    // 首次遭遇弹窗（暂停游戏）
    if (!this.seenMonsterTypes.has(type)) {
      this.seenMonsterTypes.add(type);
      this.time.delayedCall(300, () => {
        if (!this.isGameOver) {
          this.isPaused = true;
          this.hud.showMonsterPopup(type, () => { this.isPaused = false; });
        }
      });
    }
  }

  // ── 经验球 ──
  private spawnExpOrb(x: number, y: number, value: number): void {
    const orb = this.add.image(x, y, 'exp_orb');
    orb.setDepth(8);
    this.expOrbs.push({
      graphic: orb, value, x, y,
      lifetime: EXP_ORB_CONFIG.lifetime,
    });
  }

  private updateExpOrbs(delta: number): void {
    const dt = delta / 1000;
    for (const orb of this.expOrbs) {
      orb.lifetime -= dt;
      if (orb.lifetime <= 0) {
        orb.graphic.destroy();
        continue;
      }

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, orb.x, orb.y);
      if (dist < PICKUP_RANGE) {
        // 吸附
        const a = Math.atan2(this.player.y - orb.y, this.player.x - orb.x);
        orb.x += Math.cos(a) * EXP_ORB_CONFIG.attractSpeed * dt;
        orb.y += Math.sin(a) * EXP_ORB_CONFIG.attractSpeed * dt;
        orb.graphic.x = orb.x;
        orb.graphic.y = orb.y;

        // 收集
        if (dist < EXP_ORB_CONFIG.collectDist) {
          this.player.exp += orb.value;
          SoundManager.expPickup();
          orb.graphic.destroy();
        }
      }

      // 闪烁（快过期时）
      if (orb.lifetime < 5) {
        orb.graphic.setAlpha(Math.sin(orb.lifetime * 10) > 0 ? 1 : 0.3);
      }
    }
    this.expOrbs = this.expOrbs.filter(o => o.lifetime > 0 && o.graphic.active);
  }

  // ── 修补箱 ──
  private spawnRepairCrate(x: number, y: number): void {
    const crate = this.add.image(x, y, 'repair_crate');
    crate.setDepth(9);
    this.repairCrates.push({ graphic: crate, x, y, lifetime: 20 });
  }

  private updateRepairCrates(delta: number): void {
    const dt = delta / 1000;
    for (const c of this.repairCrates) {
      c.lifetime -= dt;
      if (c.lifetime <= 0) { c.graphic.destroy(); continue; }

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      if (dist < PICKUP_RANGE) {
        // 吸附
        const a = Math.atan2(this.player.y - c.y, this.player.x - c.x);
        c.x += Math.cos(a) * EXP_ORB_CONFIG.attractSpeed * dt;
        c.y += Math.sin(a) * EXP_ORB_CONFIG.attractSpeed * dt;
        c.graphic.x = c.x;
        c.graphic.y = c.y;

        if (dist < 16) {
          // 拾取：每个结构 +10 HP
          for (const type of ['wood', 'stone', 'tile', 'painting'] as const) {
            this.building.healStructure(type, 10);
          }
          VFX.burst(this, c.x, c.y, 12, [0x44ff88, 0xffdd44, 0xffffff], 80, 3, 400);
          SoundManager.expPickup();
          c.graphic.destroy();
        }
      }

      // 快过期闪烁
      if (c.lifetime < 5) {
        c.graphic.setAlpha(Math.sin(c.lifetime * 10) > 0 ? 1 : 0.3);
      }
    }
    this.repairCrates = this.repairCrates.filter(c => c.lifetime > 0 && c.graphic.active);
  }

  // ── 升级检测 ──
  private checkLevelUp(): void {
    if (this.levelUpPanelActive) return;
    if (this.player.exp >= this.player.expToNext) {
      SoundManager.levelUp();
      VFX.levelUp(this, this.player.x, this.player.y);
      this.player.exp -= this.player.expToNext;
      this.player.level++;
      this.player.expToNext = BASE_EXP_TO_LEVEL + this.player.level * EXP_PER_LEVEL;

      if (this.player.level === 1 || this.player.level % 5 === 0) {
        this.pauseForLevelUp();
      } else {
        this.hud.showLevelNotify(this.player.level);
      }
    }
  }

  // ── 暂停并显示升级面板 ──
  private pauseForLevelUp(): void {
    this.isPaused = true;
    this.levelUpPanelActive = true;

    const options = this.generateSkillOptions();
    if (options.length === 0) {
      // 所有技能已满级，不显示面板
      this.isPaused = false;
      this.levelUpPanelActive = false;
      return;
    }

    this.hud.showLevelUpPanel(options, (id, isUpgrade) => {
      if (isUpgrade) {
        const oldLevel = this.skillManager.getSkillLevel(id);
        this.skillManager.upgradeSkill(id);
        this.hud.showSkillPopup(id, oldLevel + 1);
      } else {
        this.skillManager.addSkill(id);
        this.hud.showSkillPopup(id, 1);
      }
      this.hud.hideLevelUpPanel();
      this.isPaused = false;
      this.levelUpPanelActive = false;
    });
  }

  // ── 技能池生成 ──
  private generateSkillOptions(): LevelUpOption[] {
    const pool: LevelUpOption[] = [];

    // 未获得的基础技能
    for (const skillId of ALL_SKILL_IDS) {
      if (this.skillManager.getSkillLevel(skillId) === 0) {
        const cfg = SKILL_CONFIGS[skillId][0];
        pool.push({
          id: skillId, name: cfg.name, level: 1,
          isUpgrade: false,
          description: this.getSkillDescription(skillId, 1),
        });
      }
    }

    // 已获得但未满级的升级
    for (const skill of this.skillManager.skills) {
      if (skill.level < skill.maxLevel) {
        const nextLevel = skill.level + 1;
        const cfg = SKILL_CONFIGS[skill.id][nextLevel - 1];
        pool.push({
          id: skill.id, name: cfg.name, level: nextLevel,
          isUpgrade: true,
          description: this.getSkillDescription(skill.id, nextLevel),
        });
      }
    }

    // 随机抽 3 个
    this.shuffleArray(pool);
    return pool.slice(0, 3);
  }

  private getSkillDescription(skillId: SkillId, level: number): string {
    const cfg = SKILL_CONFIGS[skillId][level - 1];
    const prevCfg = level > 1 ? SKILL_CONFIGS[skillId][level - 2] : null;
    const structNames: Record<string, string> = { wood: '木质', stone: '石质', tile: '砖瓦', painting: '彩绘' };
    const monsterNames: Record<string, string> = { acid_rain: '酸雨怪', termite: '白蚁怪' };

    const lines: string[] = [];

    switch (skillId) {
      case 'wood_reinforce':
        lines.push(`向前方发射木梁冲击波`);
        lines.push(`伤害 ${cfg.damage}  CD ${cfg.cooldown}s  范围 ${cfg.range}`);
        if (cfg.widthMultiplier) lines.push(`冲击波宽度 ×${cfg.widthMultiplier}`);
        if (cfg.repairAmount > 0) lines.push(`命中回复${structNames[cfg.repairType[0]]}结构 ${cfg.repairAmount} HP`);
        if (prevCfg) {
          lines.push(`↑ 伤害 +${cfg.damage - prevCfg.damage}  CD ${cfg.cooldown}s`);
          if (cfg.repairAmount > 0 && prevCfg.repairAmount === 0) lines.push('↑ 新增强：命中回血');
        }
        break;

      case 'stone_repair':
        lines.push(`释放圆形震波，范围内全伤`);
        lines.push(`伤害 ${cfg.damage}  CD ${cfg.cooldown}s  范围 ${cfg.range}`);
        if (cfg.knockbackForce) lines.push('附带击退效果，推开近身怪物');
        if (cfg.repairAmount > 0) lines.push(`命中回复${structNames[cfg.repairType[0]]}结构 ${cfg.repairAmount} HP`);
        if (prevCfg) {
          lines.push(`↑ 范围 +${cfg.range - prevCfg.range}`);
          if (cfg.repairAmount > 0 && prevCfg.repairAmount === 0) lines.push('↑ 新增强：命中回血+击退');
        }
        break;

      case 'waterproof':
        lines.push(`释放水纹护罩，对酸雨怪特攻`);
        lines.push(`伤害 ${cfg.damage}  CD ${cfg.cooldown}s  范围 ${cfg.range}`);
        if (cfg.bonusDamageVs) lines.push(`对${monsterNames[cfg.bonusDamageVs]}伤害 ×${cfg.bonusDamageMultiplier}`);
        if (cfg.repairAmount > 0) lines.push(`命中回复${cfg.repairType.map(t => structNames[t]).join('+')}各 ${cfg.repairAmount} HP`);
        if (prevCfg) {
          lines.push(`↑ 伤害 +${cfg.damage - prevCfg.damage}  范围 +${cfg.range - prevCfg.range}`);
          if (cfg.repairAmount > 0 && prevCfg.repairAmount === 0) lines.push('↑ 新增强：命中酸雨怪大回血');
        }
        break;

      case 'insect_control':
        lines.push(`在脚下释放持续药雾区域`);
        lines.push(`每秒 ${cfg.damage} 伤害  CD ${cfg.cooldown}s  范围 ${cfg.range}  持续 ${cfg.zoneDuration}s`);
        if (cfg.bonusDamageVs) lines.push(`对${monsterNames[cfg.bonusDamageVs]}伤害 ×${cfg.bonusDamageMultiplier}`);
        if (cfg.repairAmount > 0) lines.push(`区域内每秒回复${structNames[cfg.repairType[0]]}结构 ${cfg.repairAmount} HP`);
        if (prevCfg) {
          lines.push(`↑ 持续 +${(cfg.zoneDuration ?? 0) - (prevCfg.zoneDuration ?? 0)}s`);
          if (cfg.repairAmount > 0 && prevCfg.repairAmount === 0) lines.push('↑ 新增强：雾中持续回血');
        }
        break;

      case 'painting_restore':
        lines.push(`追踪最近敌人的颜料弹`);
        lines.push(`伤害 ${cfg.damage}  CD ${cfg.cooldown}s`);
        if (cfg.range > 0) lines.push(`命中后小范围爆炸 半径${cfg.range}`);
        if (cfg.projectileBounce) lines.push('命中后弹射至第二目标');
        if (cfg.repairAmount > 0) lines.push(`命中回复${structNames[cfg.repairType[0]]}结构 ${cfg.repairAmount} HP`);
        if (prevCfg) {
          lines.push(`↑ 伤害 +${cfg.damage - prevCfg.damage}  CD ${cfg.cooldown}s`);
          if (cfg.projectileBounce && !prevCfg.projectileBounce) lines.push('↑ 新增强：弹射攻击');
        }
        break;
    }

    return lines.join('\n');
  }

  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // ── 玩家碰撞 ──
  private checkPlayerMonsterCollision(): void {
    for (const m of this.monsters) {
      if (m.isDead) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
      if (dist < PLAYER_CONFIG.radius + m.radius) {
        m.onPlayerContact?.(m);
        // 玩家无敌，不扣血
      }
    }
  }

  private checkFreezeAura(): void {
    let near = false;
    for (const m of this.monsters) {
      if (m.isDead || m.type !== 'freeze_thaw') continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y) < 120) {
        near = true; break;
      }
    }
    this.player.setSlow(near, 0.4);
  }

  // ── 自动普攻 ──
  private updateAutoAttack(delta: number): void {
    const dt = delta / 1000;
    this.autoAttackTimer += dt;
    if (this.autoAttackTimer >= this.autoAttackCooldown) {
      this.autoAttackTimer -= this.autoAttackCooldown;
      this.fireAutoBolt();
    }

    for (const bolt of this.autoBolts) {
      bolt.lifetime -= dt;
      if (bolt.lifetime <= 0 || bolt.target.isDead) {
        bolt.graphic.destroy(); continue;
      }
      const a = Math.atan2(bolt.target.y - bolt.graphic.y, bolt.target.x - bolt.graphic.x);
      bolt.graphic.x += Math.cos(a) * bolt.speed * dt;
      bolt.graphic.y += Math.sin(a) * bolt.speed * dt;
      if (Phaser.Math.Distance.Between(bolt.graphic.x, bolt.graphic.y, bolt.target.x, bolt.target.y) < 12) {
        bolt.target.takeDamage(bolt.damage);
        VFX.boltHit(this, bolt.graphic.x, bolt.graphic.y);
        bolt.graphic.destroy();
      }
    }
    this.autoBolts = this.autoBolts.filter(b => b.lifetime > 0 && b.graphic.active);
  }

  private fireAutoBolt(): void {
    let nearest: Monster | null = null, nearestDist = Infinity;
    for (const m of this.monsters) {
      if (m.isDead) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
      if (d < nearestDist) { nearestDist = d; nearest = m; }
    }
    if (!nearest) return;
    SoundManager.autoAttack();
    const bolt = this.add.image(this.player.x, this.player.y, 'bolt');
    bolt.setDepth(12);
    this.autoBolts.push({ graphic: bolt, target: nearest, speed: 350, damage: this.autoAttackDamage, lifetime: 2 });
  }

  // ── 水洼 ──
  addPuddle(x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x44CC44, 0.25);
    g.fillCircle(x, y, 40);
    g.setDepth(1);
    this.puddles.push({ x, y, radius: 40, remaining: 5, graphic: g });
  }

  private updatePuddles(delta: number): void {
    let onPuddle = false;
    for (const p of this.puddles) {
      p.remaining -= delta / 1000;
      if (p.remaining <= 0) { p.graphic.destroy(); continue; }
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y) < p.radius) onPuddle = true;
    }
    this.puddles = this.puddles.filter(p => p.remaining > 0);
    if (onPuddle) this.player.setSlow(true, 0.6);
  }

  // ── 胜负 ──
  private endGame(victory: boolean): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    if (victory) SoundManager.victory(); else SoundManager.defeat();
    const elapsed = GAME_DURATION - this.gameTime;
    const m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60);

    // 半透明遮罩
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(199);

    const cy = GAME_HEIGHT / 2 - 70;
    // 标题
    this.add.text(GAME_WIDTH / 2, cy, victory ? '古建守卫成功！' : '古建被毁...', {
      fontSize: '38px', color: victory ? '#ffdd44' : '#ff4444',
      fontFamily: 'sans-serif', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // 统计
    const stats = [
      `坚持时间 ${m}:${s.toString().padStart(2, '0')}`,
      `击败怪物 ${this.killCount}`,
      `最高等级 Lv.${this.player.level}`,
    ];
    let sy = cy + 45;
    for (const line of stats) {
      this.add.text(GAME_WIDTH / 2, sy, line, {
        fontSize: '15px', color: '#ddd',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
      sy += 24;
    }

    // 古建各结构剩余
    sy += 8;
    const structLabels: Record<string, string> = { wood: '木质结构', stone: '石质结构', tile: '砖瓦结构', painting: '彩绘壁画' };
    const structColors = [0xC4884D, 0x999999, 0xA0522D, 0x9966CC];
    let ci = 0;
    for (const [type, label] of Object.entries(structLabels)) {
      const st = this.building.getStructure(type as any);
      const pct = st ? Math.round((st.currentHp / st.maxHp) * 100) : 0;
      const color = Phaser.Display.Color.IntegerToColor(structColors[ci]);
      this.add.text(GAME_WIDTH / 2, sy, `${label}: ${pct}%`, {
        fontSize: '13px', color: `#${color.red.toString(16).padStart(2, '0')}${color.green.toString(16).padStart(2, '0')}${color.blue.toString(16).padStart(2, '0')}`,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
      sy += 20;
      ci++;
    }

    // 重新开始按钮
    sy += 10;
    const restartBtn = this.add.text(GAME_WIDTH / 2, sy, '返回菜单', {
      fontSize: '18px', color: '#ffcc44', fontFamily: 'sans-serif',
      backgroundColor: '#553322', padding: { x: 24, y: 8 },
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200)
      .setInteractive({ useHandCursor: true });

    restartBtn.on('pointerover', () => restartBtn.setColor('#ffffff'));
    restartBtn.on('pointerout', () => restartBtn.setColor('#ffcc44'));
    restartBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
  }

  // ── 移动端虚拟摇杆 ──
  private setupTouchJoystick(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver || this.isPaused) return;
      // 只在屏幕左半侧激活摇杆
      if (pointer.x > GAME_WIDTH / 2) return;
      if (this.joystickActive) return;

      this.joystickActive = true;
      this.joystickId = pointer.id;
      this.joystickStartX = pointer.x;
      this.joystickStartY = pointer.y;

      // 摇杆底座
      this.joystickBase = this.add.circle(pointer.x, pointer.y, 40, 0xffffff, 0.2)
        .setScrollFactor(0).setDepth(400);
      // 摇杆把手
      this.joystickKnob = this.add.circle(pointer.x, pointer.y, 18, 0xffffff, 0.5)
        .setScrollFactor(0).setDepth(401);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.joystickActive || pointer.id !== this.joystickId) return;

      const dx = pointer.x - this.joystickStartX;
      const dy = pointer.y - this.joystickStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampDist = Math.min(dist, this.joystickMaxDist);
      const nx = dist > 0 ? (dx / dist) * clampDist : 0;
      const ny = dist > 0 ? (dy / dist) * clampDist : 0;

      if (this.joystickKnob) {
        this.joystickKnob.x = this.joystickStartX + nx;
        this.joystickKnob.y = this.joystickStartY + ny;
      }

      // 归一化移动向量
      this.player.joystickVx = clampDist > 5 ? nx / this.joystickMaxDist : 0;
      this.player.joystickVy = clampDist > 5 ? ny / this.joystickMaxDist : 0;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.joystickId) return;
      this.joystickActive = false;
      this.joystickId = null;
      this.player.joystickVx = 0;
      this.player.joystickVy = 0;
      if (this.joystickBase) { this.joystickBase.destroy(); this.joystickBase = null; }
      if (this.joystickKnob) { this.joystickKnob.destroy(); this.joystickKnob = null; }
    });
  }

  // ── 调试 ──
  private setupDebugControls(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-Q', () => { this.player.exp += this.player.expToNext; });
  }
}