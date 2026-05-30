import Phaser from 'phaser';
import {
  MAP_WIDTH, MAP_HEIGHT, GAME_WIDTH, GAME_HEIGHT, GAME_DURATION,
  PLAYER_CONFIG, BUILDING_CONFIG, MONSTER_TEMPLATES,
  SPAWN_DISTANCE, INITIAL_SPAWN_INTERVAL, MAX_MONSTERS,
  EXP_ORB_CONFIG, PICKUP_RANGE,
  BASE_EXP_TO_LEVEL, EXP_PER_LEVEL, ALL_SKILL_IDS,
  SKILL_CONFIGS, WAVE_STAGES,
  AUTO_ATTACK_CONFIG, BOSS_CONFIG,
  calcTimeScaling,
  MonsterType, SkillId, WaveStage, StructureType,
  EASY_MODE,
} from './config';
import { Player } from './Player';
import { Building } from './Building';
import { Monster } from './Monster';
import { Boss } from './Boss';
import { HUD } from './HUD';
import { SkillManager } from './SkillManager';
import { SoundManager } from './SoundManager';
import { VFX } from './VFX';
import { CombatFeel } from './CombatFeel';
import { generateAllTextures } from './ArtGen';
import { saveRecord } from './SaveData';

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
  angle?: number;
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
  triggered: boolean;
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
  private combatFeel!: CombatFeel;
  private monsters: Monster[] = [];
  private freezeThawTimers = new Map<Monster, number>();
  private monsterFlameFx = new Map<Monster, Phaser.GameObjects.Particles.ParticleEmitter>();
  private acidRainPuddleTimer = 0;
  private puddles: Puddle[] = [];
  private expOrbs: ExpOrb[] = [];
  private repairCrates: RepairCrate[] = [];
  private collidables: {x:number,y:number,radius:number}[] = [];
  private collidableRects: {x:number,y:number,w:number,h:number}[] = [];
  private collidableTriangles: {x1:number,y1:number,x2:number,y2:number,x3:number,y3:number}[] = [];

  private gameTime = GAME_DURATION;
  private spawnTimer = 0;
  private killCount = 0;
  private invincibleTimer = 0;
  private spawnInterval = INITIAL_SPAWN_INTERVAL;
  private isGameOver = false;
  private isPaused = false;
  private seenMonsterTypes = new Set<MonsterType>();

  // Boss 状态
  private boss: Boss | null = null;
  private bossArrow: Phaser.GameObjects.Image | null = null;
  private freezeOverlay: Phaser.GameObjects.Rectangle | null = null;
  private bossWarningDone = false;
  private bossSpawned = false;
  private bossKilled = false;

  // 自动普攻
  private autoAttackTimer = 0;
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

  /** 场景重启时 Phaser 调用，重置所有运行状态 */
  init(): void {
    this.monsters = [];
    this.freezeThawTimers = new Map();
    this.monsterFlameFx = new Map();
    this.acidRainPuddleTimer = 0;
    this.puddles = [];
    this.expOrbs = [];
    this.repairCrates = [];
    this.collidables = [];
    this.collidableRects = [];
    this.collidableTriangles = [];

    this.gameTime = GAME_DURATION;
    this.spawnTimer = 0;
    this.killCount = 0;
    this.invincibleTimer = 0;
    this.spawnInterval = INITIAL_SPAWN_INTERVAL;
    this.isGameOver = false;
    this.isPaused = false;
    this.seenMonsterTypes = new Set();

    this.boss = null;
    this.bossArrow = null;
    this.freezeOverlay = null;
    this.bossWarningDone = false;
    this.bossSpawned = false;
    this.bossKilled = false;

    this.autoAttackTimer = 0;
    this.autoBolts = [];
    this.levelUpPanelActive = false;

    this.joystickBase = null;
    this.joystickKnob = null;
    this.joystickActive = false;
    this.joystickId = null;
    this.joystickStartX = 0;
    this.joystickStartY = 0;

    this.debugMonsterIndex = 0;
    this.debugDraw = false;
    this.debugGfx = null;
    this.debugDisableAutoAttack = false;
    this.debugMode = false;
    this.nPressTimes = [];
    EASY_MODE.active = false;  // 每局重置菜鸡模式

    // 清除 Boss 事件监听（避免 create 重复注册）
    this.events.off('boss-earthquake');
  }

  preload(): void {
    this.load.image('bg', 'assets/bg.png');
    this.load.image('illus_termite','assets/monster_termite.png');
    this.load.image('illus_wind','assets/monster_wind.png');
    this.load.image('illus_acid_rain','assets/monster_acid_rain.png');
    this.load.image('illus_fire','assets/monster_fire.png');
    this.load.image('fire','assets/fire_monster.png');
    this.load.image('fire_flame','assets/fire_flame.png');
    this.load.image('freeze_thaw','assets/freeze_thaw_monster.png');
    this.load.image('illus_freeze_thaw','assets/monster_freeze_thaw.png');
    this.load.image('player_idle', 'assets/player_idle.png');
    this.load.image('player_attack', 'assets/player_attack.png');
    this.load.image('calamity_core', 'assets/boss.png');
    this.load.image('leaf', 'assets/leaf.png');
    this.load.image('gj', 'assets/building.png');
    this.load.image('arrow', 'assets/arrow.png');

    // ── Terraria 特效精灵纹理 ──
    // fx_glow_64 由 ArtGen 程序化生成

    this.load.image('fx_star_34',    'assets/effects/extra_Extra_283.png');
    this.load.image('fx_ring_42',    'assets/effects/extra_Extra_76.png');
    this.load.image('fx_dust_16',    'assets/effects/proj_Projectile_187.png');
    this.load.image('fx_slash',      'assets/effects/proj_Projectile_340.png');
    this.load.image('fx_whirlwind',  'assets/effects/proj_Projectile_97.png');
    this.load.image('fx_bolt_extra', 'assets/effects/proj_Projectile_108.png');
    this.load.image('fx_bolt_hit',   'assets/effects/proj_Projectile_165.png');
    this.load.image('fx_water_bomb','assets/effects/extra_46.png');
    this.load.image('fx_impact',     'assets/effects/extra_Extra_33.png');
    this.load.image('fx_ring_impact','assets/effects/extra_Extra_148.png');
    this.load.image('fx_heal',       'assets/effects/proj_Projectile_164.png');
    this.load.image('fx_boss_ring',  'assets/effects/extra_Extra_196.png');
    // ── 冰块/冰晶主题 ──
    this.load.image('fx_ice_shard',  'assets/effects/proj_Projectile_350.png');
    this.load.image('fx_ice_orb',    'assets/effects/proj_Projectile_116.png');
    this.load.image('fx_ice_crack',  'assets/effects/extra_Extra_36.png');
  }

  create(): void {
    // 生成全部程序化精灵纹理（玩家、怪物、古建、UI等）
    generateAllTextures(this);

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.drawBackground();

    this.building = new Building(
      this, BUILDING_CONFIG.x, BUILDING_CONFIG.y - 130,
      BUILDING_CONFIG.structures as any,
    );
    this.building.graphics.setScale(0.68);
    this.building.onFailure = () => this.endGame(false);
    // 古建碰撞体 — 三角形（塔形：上尖下宽）
    const bx = BUILDING_CONFIG.x, by = BUILDING_CONFIG.y - 130;
    this.collidableTriangles.push({
      x1: bx, y1: by - 130,
      x2: bx - 160, y2: by + 150,
      x3: bx + 160, y3: by + 150,
    });

    this.player = new Player(
      this, BUILDING_CONFIG.x,
      BUILDING_CONFIG.y + PLAYER_CONFIG.startOffsetY,
      PLAYER_CONFIG.maxHp, PLAYER_CONFIG.moveSpeed,
      PLAYER_CONFIG.radius, PLAYER_CONFIG.color,
    );
    this.cameras.main.startFollow(this.player.sprite, true, 0.09, 0.09);

    this.hud = new HUD(this);

    // 命中反馈管线（创伤震动 + Hit Stop + 镜头冲击）
    this.combatFeel = new CombatFeel(this);

    this.skillManager = new SkillManager(
      this, () => this.monsters, () => this.player, () => this.building, () => this.boss,
    );
    // Boss 事件监听
    this.events.on('boss-earthquake', (damage: number) => {
      if (!this.boss || this.boss.isDead) return;
      // 地震波：所有结构扣血
      const structTypes: StructureType[] = ['wood', 'stone', 'tile', 'painting'];
      for (const type of structTypes) {
        this.building.damageStructure(type, damage);
      }
    });

    // 动态飘落落叶
    if (this.textures.exists('leaf')) {
      this.add.particles(0, -60, 'leaf', {
        x: { min: 0, max: MAP_WIDTH },
        y: { min: 0, max: 0 },
        speed: { min: 15, max: 40 },
        angle: { min: 90, max: 100 },
        rotate: { min: 0, max: 360 },
        scale: { start: 1.5, end: 0.6 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 20000,
        frequency: 500,
        quantity: 1,
        tint: [0xC4884D, 0xD4A060, 0x8B6914, 0xB08050],
      }).setDepth(2);
    }

    this.setupDebugControls();
    this.setupTouchJoystick();
  }

  update(time: number, delta: number): void {
    if (this.isGameOver) return;

    if (this.isPaused) {
      // 暂停期间仅更新 HUD（血量条）
      this.hud.update(this.player, this.building, this.gameTime, this.killCount);
      return;
    }

    // ── CombatFeel：计算 Hit Stop 后的有效 delta ──
    const effectiveDelta = this.combatFeel.update(delta, time);

    // ── VFX 创伤屏震：每帧衰减并应用累积震动 ──
    VFX.updateTrauma(this, delta);

    this.player.update(delta); // 玩家始终全速

    // 冰冻滤镜
    if (this.player.isFrozen) {
      if (!this.freezeOverlay) {
        this.freezeOverlay = this.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x2266CC, 0.15);
        this.freezeOverlay.setDepth(90).setScrollFactor(0);
        // 冰晶边框效果
        this.cameras.main.setBackgroundColor(0x112244);
      }
    } else {
      if (this.freezeOverlay) { this.freezeOverlay.destroy(); this.freezeOverlay = null; }
      this.cameras.main.setBackgroundColor(0x1a1a2e);
    }

    this.resolveCollision(this.player.sprite, 14); // 玩家环境碰撞

    // 刷怪（使用有效 delta，Hit Stop 期间暂停生怪）
    const stage = this.getCurrentStage();
    if (stage) {
      this.spawnTimer += effectiveDelta;
      this.invincibleTimer = Math.max(0, this.invincibleTimer - delta);
      if (this.spawnTimer >= stage.spawnInterval) {
        this.spawnTimer -= stage.spawnInterval;
        this.spawnWave(stage);
      }
    }

    // 怪物更新（使用有效 delta，Hit Stop 期间怪物几乎冻结）
    for (const m of this.monsters) {
      m.update(time, effectiveDelta);
      this.resolveCollision(m.sprite, m.radius);
      // 火焰特效跟随
      const fx = this.monsterFlameFx.get(m);
      if (fx && !m.isDead) { fx.setPosition(m.x, m.y); }
    }

    this.checkPlayerMonsterCollision();
    this.checkFreezeAura();
    this.updateAcidRainPuddles(delta); // 酸雨怪在场时定期落水洼
    this.updatePuddles(delta); // 在 freeze aura 之后，水洼减速更强且可覆盖
    this.updateFreezeThawShockwave(delta);
    this.monsters = this.monsters.filter(m => !m.isDead);

    // 经验球更新（全速）
    this.updateExpOrbs(delta);
    // 修补箱更新（全速）
    this.updateRepairCrates(delta);

    // 自动普攻 + 技能（使用 effectiveDelta，Hit Stop 期间暂停）
    this.updateAutoAttack(effectiveDelta);
    this.skillManager.update(effectiveDelta, time);

    // ═══ Boss 预警 & 出场逻辑 ═══
    if (!this.bossWarningDone && this.gameTime <= BOSS_CONFIG.appearTime + BOSS_CONFIG.warnDuration) {
      this.startBossWarning();
    }
    if (!this.bossSpawned && this.gameTime <= BOSS_CONFIG.appearTime) {
      this.spawnBoss();
    }

    // Boss 更新
    if (this.boss && this.boss.isActive && !this.boss.isDead) {
      this.boss.update(time, effectiveDelta);
      const distToBuilding = Phaser.Math.Distance.Between(
        this.boss.x, this.boss.y, BUILDING_CONFIG.x, BUILDING_CONFIG.y - 130,
      );
      if (distToBuilding < BUILDING_CONFIG.attackRange + 60) {
        // Boss 接近建筑持续侵蚀
      }
      this.hud.updateBossHpBar(this.boss.hp, this.boss.maxHp);
      // 红色箭头指向 Boss
      this.drawBossArrow();
    } else {
      if (this.bossArrow) { this.bossArrow.destroy(); this.bossArrow = null; }
    }

    // 水洼/灼烧（checkFreezeAura 在前，puddles 在后以覆盖更强减速）
    this.building.updateBurn(delta);

    // 升级检测（在经验球拾取后）
    this.checkLevelUp();

    this.gameTime -= delta / 1000;
    // 最后 30 秒倒计时滴答
    if (this.gameTime > 0 && this.gameTime <= 30 &&
        Math.floor(this.gameTime + delta / 1000) !== Math.floor(this.gameTime)) {
      SoundManager.countdownTick();
    }
    if (this.gameTime <= 0) {
      this.gameTime = 0;
      // 如果 Boss 还活着，超时也算胜利（没有杀死也行）
      this.endGame(true);
      return;
    }

    if (this.debugDraw) this.drawDebugColliders();
    this.hud.update(this.player, this.building, this.gameTime, this.killCount);
  }

  // ── 环境碰撞 ──
  private resolveCollision(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, r: number): void {
    for (const c of this.collidables) {
      const dx = sprite.x - c.x, dy = sprite.y - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const min = r + c.radius;
      if (dist < min && dist > 0.01) {
        sprite.x += (dx / dist) * (min - dist);
        sprite.y += (dy / dist) * (min - dist);
      }
    }
    for (const rect of this.collidableRects) {
      const cx = Math.max(rect.x, Math.min(sprite.x, rect.x + rect.w));
      const cy = Math.max(rect.y, Math.min(sprite.y, rect.y + rect.h));
      const dx = sprite.x - cx, dy = sprite.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < r) {
        if (dist < 0.01) {
          // 在矩形内部，推向最近边
          const dl = sprite.x - rect.x, dr = rect.x + rect.w - sprite.x;
          const dt = sprite.y - rect.y, db = rect.y + rect.h - sprite.y;
          const minD = Math.min(dl, dr, dt, db);
          if (minD === dl) sprite.x = rect.x - r;
          else if (minD === dr) sprite.x = rect.x + rect.w + r;
          else if (minD === dt) sprite.y = rect.y - r;
          else sprite.y = rect.y + rect.h + r;
        } else {
          sprite.x += (dx / dist) * (r - dist);
          sprite.y += (dy / dist) * (r - dist);
        }
      }
    }
    for (const tri of this.collidableTriangles) {
      // 找到三角形上离 sprite 最近的点
      let cx = tri.x1, cy = tri.y1, minDist = Infinity;
      const edges: [number,number,number,number][] = [
        [tri.x1, tri.y1, tri.x2, tri.y2],
        [tri.x2, tri.y2, tri.x3, tri.y3],
        [tri.x3, tri.y3, tri.x1, tri.y1],
      ];
      for (const [ex1, ey1, ex2, ey2] of edges) {
        const edx = ex2 - ex1, edy = ey2 - ey1;
        const len2 = edx * edx + edy * edy;
        let t = len2 > 0 ? ((sprite.x - ex1) * edx + (sprite.y - ey1) * edy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = ex1 + t * edx, py = ey1 + t * edy;
        const d = (sprite.x - px) ** 2 + (sprite.y - py) ** 2;
        if (d < minDist) { minDist = d; cx = px; cy = py; }
      }
      const dx = sprite.x - cx, dy = sprite.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < r && dist > 0.01) {
        sprite.x += (dx / dist) * (r - dist);
        sprite.y += (dy / dist) * (r - dist);
      }
    }
  }

  // ── 背景 ──
  private drawBackground(): void {
    // 优先使用 PNG 背景图
    if (this.textures.exists('bg')) {
      const bgImg = this.add.image(MAP_WIDTH / 2, MAP_HEIGHT / 2, 'bg').setDepth(0);
      bgImg.setDisplaySize(MAP_WIDTH, MAP_HEIGHT);
    } else if (this.textures.exists('background')) {
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
    // 已移除：场景仅用 bg.png，不再放置环境精灵
    const nthKey = (_cat:string, _n:number) => 'bolt';
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

  private spawnSingleMonster(type: MonsterType, _sx?: number, _sy?: number): void {
    // 冻融怪场上最多 10 只
    if (type === 'freeze_thaw') {
      const ftCount = this.monsters.filter(m => !m.isDead && m.type === 'freeze_thaw').length;
      if (ftCount >= 10) return;
    }
    const template = MONSTER_TEMPLATES[type];
    // 指定位置或从地图左右两侧外生成
    let sx: number, sy: number;
    if (_sx !== undefined && _sy !== undefined) {
      sx = _sx; sy = _sy;
    } else {
      const fromLeft = Math.random() < 0.5;
      sx = fromLeft ? -60 : MAP_WIDTH + 60;
      sy = 80 + Math.random() * (MAP_HEIGHT - 160);
    }

    // 时间缩放 — 唯一来源
    const scaling = calcTimeScaling(GAME_DURATION - this.gameTime);
    // 最后 120s 风蚀怪血量翻倍
    if (type === 'wind' && this.gameTime <= 120) {
      scaling.hpMult *= 2;
    }

    const monster = new Monster(
      this, sx, sy, template,
      BUILDING_CONFIG.x, BUILDING_CONFIG.y - 130,
      BUILDING_CONFIG.attackRange,
      scaling,
    );

    monster.onAttack = (m) => {
      for (const structType of m.attackStructures) {
        this.building.damageStructure(structType, m.damage);
      }
      if (m.type === 'fire') {
        for (const st of m.attackStructures) this.building.applyBurn(st, 0.5, 2);
      }
    };

    // 火焰怪：挂载火焰粒子特效
    if (type === 'fire' && this.textures.exists('fire_flame')) {
      const flameFx = this.add.particles(monster.x, monster.y, 'fire_flame', {
        speed: { min: 10, max: 30 },
        scale: { start: 0.8, end: 0.2 },
        alpha: { start: 0.6, end: 0 },
        lifespan: 400,
        frequency: 60,
        angle: { min: 0, max: 360 },
        tint: [0xFF6633, 0xFF8833, 0xFF4422],
      });
      flameFx.setDepth(6);
      this.monsterFlameFx.set(monster, flameFx);
    }

    monster.onPlayerContact = (m) => {
      if (m.type === 'wind') this.player.applyKnockback(m.x, m.y, 250);
    };

    // 命中反馈 → CombatFeel（打击感管线）
    monster.onDamageFeedback = (m, dmg) => {
      // 根据伤害选择 Hit Stop 等级
      let tier: 'light' | 'medium' | 'heavy' | 'ultra' = 'light';
      if (dmg >= 60) tier = 'ultra';
      else if (dmg >= 30) tier = 'heavy';
      else if (dmg >= 15) tier = 'medium';
      this.combatFeel.onHit({
        damage: dmg,
        worldX: m.x, worldY: m.y,
        attackerX: this.player.x, attackerY: this.player.y,
        tier,
      });
    };

    monster.onDeath = (m) => {
      // 清理火焰特效
      const flameFx = this.monsterFlameFx.get(m);
      if (flameFx) { flameFx.stop(); this.time.delayedCall(500, () => { if (flameFx.active) flameFx.destroy(); }); this.monsterFlameFx.delete(m); }
      this.killCount++;
      this.spawnExpOrb(m.x, m.y, m.expDrop);
      // 8% 概率掉落修补箱
      if (Math.random() < 0.08) {
        this.spawnRepairCrate(m.x, m.y);
      }
    };

    this.monsters.push(monster);

    // 怪物生成轻提示
    SoundManager.monsterSpawn(type);

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

  // ═══ Boss 系统 ═══

  /** Boss 出场预警：屏幕闪红 + 文字警告 */
  private startBossWarning(): void {
    if (this.bossWarningDone) return;
    this.bossWarningDone = true;

    SoundManager.bossAlert();
    VFX.bossWarning(this);

    // 全屏红色警告文字
    const warnY = GAME_HEIGHT / 2 - 100;
    const warnText = this.add.text(GAME_WIDTH / 2, warnY, '⚠ 警告：灾蚀核心即将降临 ⚠', {
      fontSize: '28px',
      color: '#FF2222',
      fontFamily: 'sans-serif',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    // 第二次文字（更靠近中心）
    const warnText2 = this.add.text(GAME_WIDTH / 2, warnY + 40, '守住古建！', {
      fontSize: '18px',
      color: '#FF6644',
      fontFamily: 'sans-serif',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    // 闪动动画
    this.tweens.add({
      targets: [warnText, warnText2],
      alpha: { from: 1, to: 0.3 },
      duration: 300,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // 3 秒后淡出
        this.tweens.add({
          targets: [warnText, warnText2],
          alpha: 0,
          duration: 500,
          onComplete: () => {
            warnText.destroy();
            warnText2.destroy();
          },
        });
      },
    });
  }

  /** 生成 Boss */
  private spawnBoss(): void {
    if (this.bossSpawned) return;
    this.bossSpawned = true;

    // Boss 从屏幕外边缘出现
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = SPAWN_DISTANCE + 100;
    const bx = MAP_WIDTH / 2 + Math.cos(angle) * spawnDist;
    const by = MAP_HEIGHT / 2 + Math.sin(angle) * spawnDist;

    this.boss = new Boss(
      this, bx, by,
      BUILDING_CONFIG.x, BUILDING_CONFIG.y - 130,
      BUILDING_CONFIG.attackRange,
    );

    // Boss 出场特效
    SoundManager.bossAppear();
    VFX.bossAppear(this, bx, by);

    // 显示 Boss 血条
    this.hud.showBossHpBar(this.boss.maxHp);

    // Boss 攻击回调
    this.boss.onAttack = (b) => {
      const structTypes: StructureType[] = ['wood', 'stone', 'tile', 'painting'];
      for (const st of structTypes) {
        this.building.damageStructure(st, b.damage);
      }
    };

    // Boss 召唤回调
    this.boss.onSummon = (count: number, type: string) => {
      this.bossSummonMinions(count, type as MonsterType);
    };

    // Boss 死亡回调
    this.boss.onDeath = (b) => {
      this.bossKilled = true;
      this.hud.hideBossHpBar();

      // 掉落大量经验
      const expValue = b.expDrop;
      // 在 Boss 周围散布 5 个经验球
      for (let i = 0; i < 5; i++) {
        const ex = b.x + (Math.random() - 0.5) * 80;
        const ey = b.y + (Math.random() - 0.5) * 80;
        this.spawnExpOrb(ex, ey, Math.floor(expValue / 5));
      }
      // 第 6 个经验球来自中心（更吸引眼球）
      this.spawnExpOrb(b.x, b.y, Math.floor(expValue / 5));

      // 必定掉修补箱
      for (let i = 0; i < BOSS_CONFIG.guaranteedCrateCount; i++) {
        this.spawnRepairCrate(b.x + (Math.random() - 0.5) * 40, b.y + (Math.random() - 0.5) * 40);
      }

      // 全屏胜利提示
      const bossDefeatText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, '灾蚀核心 已被击败！', {
        fontSize: '32px',
        color: '#FFD700',
        fontFamily: 'sans-serif',
        stroke: '#000000',
        strokeThickness: 6,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(250);

      this.tweens.add({
        targets: bossDefeatText,
        alpha: { from: 1, to: 0.6 },
        y: bossDefeatText.y - 20,
        duration: 2000,
        yoyo: true,
        onComplete: () => {
          this.tweens.add({
            targets: bossDefeatText,
            alpha: 0,
            duration: 500,
            onComplete: () => bossDefeatText.destroy(),
          });
        },
      });
    };
  }

  /** 红色箭头指向 Boss */
  private drawBossArrow(): void {
    if (!this.boss || this.boss.isDead) {
      if (this.bossArrow) { this.bossArrow.destroy(); this.bossArrow = null; }
      return;
    }
    const angle = Math.atan2(this.boss.y - this.player.y, this.boss.x - this.player.x);
    const dist = 50; // 箭头离玩家距离
    const ax = this.player.x + Math.cos(angle) * dist;
    const ay = this.player.y + Math.sin(angle) * dist;
    if (!this.bossArrow) {
      this.bossArrow = this.add.image(ax, ay, 'arrow').setDepth(50).setTint(0xFF2222).setScale(1.2);
    } else {
      this.bossArrow.setPosition(ax, ay);
    }
    this.bossArrow.setRotation(angle + Math.PI / 2);
  }

  /** Boss 召唤小怪 */
  private bossSummonMinions(count: number, type: MonsterType): void {
    const template = MONSTER_TEMPLATES[type];
    // 小怪削弱版
    const minionTemplate = { ...template,
      hp: Math.round(template.hp * BOSS_CONFIG.summonHpMult),
      expDrop: Math.round(template.expDrop * 0.3),
    };

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 80 + Math.random() * 40;
      const sx = (this.boss?.x ?? MAP_WIDTH / 2) + Math.cos(angle) * dist;
      const sy = (this.boss?.y ?? MAP_HEIGHT / 2) + Math.sin(angle) * dist;

      // 小怪以古建为目标
      const monster = new Monster(
        this, sx, sy, minionTemplate,
        BUILDING_CONFIG.x, BUILDING_CONFIG.y - 130,
        BUILDING_CONFIG.attackRange,
      );

      monster.onAttack = (m) => {
        for (const structType of m.attackStructures) {
          this.building.damageStructure(structType, m.damage);
        }
      };

      monster.onDeath = (m) => {
        this.killCount++;
        this.spawnExpOrb(m.x, m.y, m.expDrop);
      };

      this.monsters.push(monster);
    }

    // Boss 召唤文字提示
    const summonText = this.add.text(
      this.boss?.x ?? MAP_WIDTH / 2,
      (this.boss?.y ?? MAP_HEIGHT / 2) - 60,
      `召唤 ${template.name} ×${count}`,
      {
        fontSize: '16px',
        color: '#CC88FF',
        fontFamily: 'sans-serif',
        stroke: '#000000',
        strokeThickness: 4,
      },
    ).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: summonText,
      y: summonText.y - 30,
      alpha: 0,
      duration: 1500,
      onComplete: () => summonText.destroy(),
    });
  }

  // ── 经验球 ──
  private spawnExpOrb(x: number, y: number, value: number): void {
    if (EASY_MODE.active) value *= 2;
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
    this.repairCrates.push({ graphic: crate, x, y, lifetime: 20, triggered: false });
  }

  private updateRepairCrates(delta: number): void {
    const dt = delta / 1000;
    const bx = this.building.x;
    const by = this.building.y;
    for (const c of this.repairCrates) {
      c.lifetime -= dt;
      if (c.lifetime <= 0) { c.graphic.destroy(); continue; }

      const distToPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      // 玩家靠近即触发，之后自行飞向古建
      if (distToPlayer < PICKUP_RANGE) c.triggered = true;
      if (c.triggered) {
        const a = Math.atan2(by - c.y, bx - c.x);
        const speed = 340;
        c.x += Math.cos(a) * speed * dt;
        c.y += Math.sin(a) * speed * dt;
        c.graphic.x = c.x;
        c.graphic.y = c.y;

        const distToBuilding = Phaser.Math.Distance.Between(bx, by, c.x, c.y);
        if (distToBuilding < 40) {
          for (const type of ['wood', 'stone', 'tile', 'painting'] as const) {
            this.building.healStructure(type, 10);
          }
          VFX.burst(this, bx, by, 14, [0x44ff88, 0x88ff66, 0xffffff], 100, 4, 500, 'fx_heal');
          VFX.floatText(this, bx + (Math.random() - 0.5) * 20, by - 50, '+10×4', '#44ff66', '17px');
          this.building.flashHeal();
          SoundManager.repairCratePickup();
          c.graphic.destroy();
        }
      }
    }
    this.repairCrates = this.repairCrates.filter(c => c.lifetime > 0 && c.graphic.active);
  }

  // ── 升级检测 ──
  private checkLevelUp(): void {
    if (this.levelUpPanelActive) return;
    if (this.player.exp >= this.player.expToNext) {
      // 升级庆祝（仅金色粒子 + 音阶音，不再闪全屏）
      SoundManager.levelUp();
      VFX.levelUp(this, this.player.x, this.player.y);
      this.player.exp -= this.player.expToNext;
      this.player.level++;
      this.player.expToNext = BASE_EXP_TO_LEVEL + this.player.level * EXP_PER_LEVEL;

      // level 已 ++ 过，Lv.2 是第一次升级，每 5 级再选一次
      if (this.player.level === 2 || this.player.level % 5 === 0) {
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
        lines.push(`朝最近敌群连续射出木梁，穿透前排`);
        lines.push(`单梁 ${cfg.damage}  CD ${cfg.cooldown}s  射程 ${cfg.range}`);
        if (cfg.shots) lines.push(`每次发射 ${cfg.shots} 根木梁`);
        if (cfg.pierceCount) lines.push(`每根最多穿透 ${cfg.pierceCount} 个敌人`);
        if (cfg.widthMultiplier) lines.push(`木梁宽度 ×${cfg.widthMultiplier}`);
        if (cfg.splashRadius) lines.push(`命中后震裂周围 半径${cfg.splashRadius}`);
        if (cfg.repairAmount > 0) lines.push(`命中回复${structNames[cfg.repairType[0]]}结构 ${cfg.repairAmount} HP`);
        if (prevCfg) {
          lines.push(`↑ 单梁伤害 +${cfg.damage - prevCfg.damage}  数量 ${cfg.shots ?? 1}`);
          if (cfg.repairAmount > 0 && prevCfg.repairAmount === 0) lines.push('↑ 新增强：命中回血');
        }
        break;

      case 'stone_repair':
        lines.push(`连续释放环形震波，反复震退近身怪`);
        lines.push(`每段 ${cfg.damage}  CD ${cfg.cooldown}s  范围 ${cfg.range}`);
        if (cfg.pulseCount) lines.push(`连续脉冲 ${cfg.pulseCount} 次`);
        if (cfg.knockbackForce) lines.push('附带击退效果，推开近身怪物');
        if (cfg.repairAmount > 0) lines.push(`命中回复${structNames[cfg.repairType[0]]}结构 ${cfg.repairAmount} HP`);
        if (prevCfg) {
          lines.push(`↑ 脉冲数 ${cfg.pulseCount ?? 1}  范围 +${cfg.range - prevCfg.range}`);
          if (cfg.repairAmount > 0 && prevCfg.repairAmount === 0) lines.push('↑ 新增强：命中回血+击退');
        }
        break;

      case 'waterproof':
        lines.push(`召唤水幕锁定敌群，连点多目标`);
        lines.push(`单次 ${cfg.damage}  CD ${cfg.cooldown}s  搜敌范围 ${cfg.range}`);
        if (cfg.shots) lines.push(`每次打击 ${cfg.shots} 个目标`);
        if (cfg.splashRadius) lines.push(`命中溅射 半径${cfg.splashRadius}`);
        if (cfg.bonusDamageVs) lines.push(`对${monsterNames[cfg.bonusDamageVs]}伤害 ×${cfg.bonusDamageMultiplier}`);
        if (cfg.repairAmount > 0) lines.push(`命中回复${cfg.repairType.map(t => structNames[t]).join('+')}各 ${cfg.repairAmount} HP`);
        if (prevCfg) {
          lines.push(`↑ 伤害 +${cfg.damage - prevCfg.damage}  目标数 ${cfg.shots ?? 1}`);
          if (cfg.repairAmount > 0 && prevCfg.repairAmount === 0) lines.push('↑ 新增强：命中酸雨怪大回血');
        }
        break;

      case 'insect_control':
        lines.push(`生成跟随玩家的药雾圈，持续绞杀近身怪`);
        lines.push(`每跳 ${cfg.damage} 伤害  CD ${cfg.cooldown}s  范围 ${cfg.range}  持续 ${cfg.zoneDuration}s`);
        if (cfg.tickInterval) lines.push(`药雾每 ${cfg.tickInterval}s 触发一次`);
        if (cfg.shots) lines.push(`每次额外喷射 ${cfg.shots} 枚药雾孢子`);
        if (cfg.bonusDamageVs) lines.push(`对${monsterNames[cfg.bonusDamageVs]}伤害 ×${cfg.bonusDamageMultiplier}`);
        if (cfg.repairAmount > 0) lines.push(`区域内每秒回复${structNames[cfg.repairType[0]]}结构 ${cfg.repairAmount} HP`);
        if (prevCfg) {
          lines.push(`↑ 持续 +${(cfg.zoneDuration ?? 0) - (prevCfg.zoneDuration ?? 0)}s  Tick更快`);
          if (cfg.repairAmount > 0 && prevCfg.repairAmount === 0) lines.push('↑ 新增强：雾中持续回血');
        }
        break;

      case 'painting_restore':
        lines.push(`发射多枚追踪颜料弹，命中后绽开彩爆`);
        lines.push(`单弹 ${cfg.damage}  CD ${cfg.cooldown}s`);
        if (cfg.shots) lines.push(`每次发射 ${cfg.shots} 枚颜料弹`);
        if (cfg.splashRadius || cfg.range > 0) lines.push(`命中爆炸 半径${cfg.splashRadius ?? cfg.range}`);
        if (cfg.chainCount) lines.push(`命中后额外弹射 ${cfg.chainCount} 次`);
        if (cfg.repairAmount > 0) lines.push(`命中回复${structNames[cfg.repairType[0]]}结构 ${cfg.repairAmount} HP`);
        if (prevCfg) {
          lines.push(`↑ 单弹伤害 +${cfg.damage - prevCfg.damage}  数量 ${cfg.shots ?? 1}`);
          if (cfg.chainCount && !(prevCfg.chainCount && prevCfg.chainCount > 0)) lines.push('↑ 新增强：弹射攻击');
        }
        break;

      case 'whirlwind_slash':
        lines.push(`朝前方发射旋风刃，沿路径切割敌人`);
        lines.push(`单刃 ${cfg.damage}  CD ${cfg.cooldown}s  飞行距离 ${cfg.range}`);
        if (cfg.shots) lines.push(`每次发射 ${cfg.shots} 枚旋风刃`);
        if (cfg.pierceCount) lines.push(`单刃最多穿透 ${cfg.pierceCount} 个目标`);
        if (cfg.knockbackForce) lines.push('命中后附带击退');
        if (prevCfg) lines.push(`↑ 伤害 +${cfg.damage - prevCfg.damage}  数量 ${cfg.shots ?? 1}`);
        break;

      case 'chain_lightning':
        lines.push(`释放雷电链，在敌人之间连续跳跃`);
        lines.push(`首跳 ${cfg.damage}  CD ${cfg.cooldown}s  搜敌范围 ${cfg.range}`);
        if (cfg.chainCount) lines.push(`最多连锁 ${cfg.chainCount} 次`);
        if (cfg.shots && cfg.shots > 1) lines.push(`同时放出 ${cfg.shots} 条主雷链`);
        if (prevCfg) lines.push(`↑ 伤害 +${cfg.damage - prevCfg.damage}  连锁数 ${cfg.chainCount ?? 1}`);
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
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y) < 60) {
        near = true; break;
      }
    }
    this.player.setSlow(near, 0.4);
  }

  /** 冻融怪冲击波：每 5s 朝玩家方向释放柱状冻结区域 */
  private updateFreezeThawShockwave(delta: number): void {
    const dt = delta / 1000;
    for (const m of this.monsters) {
      if (m.isDead || m.type !== 'freeze_thaw') continue;

      let timer = this.freezeThawTimers.get(m) ?? 0;
      timer += dt;
      if (timer >= 5) {
        timer = 0;
        this.fireFreezeShockwave(m);
      }
      this.freezeThawTimers.set(m, timer);
    }
    // 清理死亡怪物的计时器
    for (const key of this.freezeThawTimers.keys()) {
      if (key.isDead) this.freezeThawTimers.delete(key);
    }
  }

  private fireFreezeShockwave(m: Monster): void {
    const px = this.player.x, py = this.player.y;
    const mx = m.x, my = m.y;
    const angle = Math.atan2(py - my, px - mx);
    const dist = Phaser.Math.Distance.Between(mx, my, px, py);
    const length = Math.max(dist + 10, 60);
    const halfW = 16;

    // 柱状区域中心坐标
    const cx = mx + Math.cos(angle) * length / 2;
    const cy = my + Math.sin(angle) * length / 2;

    // 预警矩形
    const warn = this.add.rectangle(cx, cy, length, halfW * 2, 0x000000, 0);
    warn.setStrokeStyle(3, 0xFF2222, 0.7);
    warn.setRotation(angle);
    warn.setDepth(20);

    // 0.75s 后引爆
    this.time.delayedCall(750, () => {
      warn.destroy();
      // 检测玩家是否在柱状区域内
      const dx = px - mx, dy = py - my;
      const proj = dx * Math.cos(angle) + dy * Math.sin(angle);
      const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
      if (proj > 0 && proj < length && perp < halfW) {
        if (this.player.tryFreeze(2)) {
          // 冻结成功 — 冰爆特效
          const ice = this.add.circle(px, py, 32, 0xFF3333, 0.4);
          ice.setDepth(45);
          this.tweens.add({ targets: ice, scale: 1.6, alpha: 0, duration: 400, onComplete: () => ice.destroy() });
          VFX.shake(this, 0.005, 150);
        }
      }
    });

    // 预警收缩动画
    this.tweens.add({
      targets: warn,
      alpha: 0.7,
      duration: 350,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => { if (warn.active) warn.setAlpha(0.3); },
    });
  }

  // ── 自动普攻 ──
  private updateAutoAttack(delta: number): void {
    if (this.debugDisableAutoAttack) return;
    const dt = delta / 1000;
    this.autoAttackTimer += dt;
    if (this.autoAttackTimer >= AUTO_ATTACK_CONFIG.cooldown) {
      this.autoAttackTimer -= AUTO_ATTACK_CONFIG.cooldown;
      this.fireAutoBolt();
    }

    for (const bolt of this.autoBolts) {
      // 飞出地图外才销毁
      const margin = 100;
      if (bolt.graphic.x < -margin || bolt.graphic.x > MAP_WIDTH + margin ||
          bolt.graphic.y < -margin || bolt.graphic.y > MAP_HEIGHT + margin) {
        bolt.graphic.destroy(); continue;
      }
      // 目标死亡后，箭头沿原方向继续飞出场景
      if (bolt.target.isDead) {
        if (bolt.angle === undefined) {
          bolt.angle = Math.atan2(bolt.target.y - bolt.graphic.y, bolt.target.x - bolt.graphic.x);
          bolt.graphic.setRotation(bolt.angle + Math.PI / 2);
        }
        bolt.graphic.x += Math.cos(bolt.angle) * bolt.speed * dt;
        bolt.graphic.y += Math.sin(bolt.angle) * bolt.speed * dt;
        continue;
      }
      const a = Math.atan2(bolt.target.y - bolt.graphic.y, bolt.target.x - bolt.graphic.x);
      bolt.graphic.setRotation(a + Math.PI / 2);
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
      if (m.isDead || !m.canBeTargeted) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
      if (d < nearestDist) { nearestDist = d; nearest = m; }
    }
    // 检查 Boss 是否比最近怪物更近
    if (this.boss && !this.boss.isDead) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      if (d < nearestDist) { nearestDist = d; }
    }
    if (!nearest) {
      // 没有普通怪物，尝试打 Boss
      if (this.boss && !this.boss.isDead) {
        SoundManager.autoAttack(this.player.x, this.player.y);
        this.player.applyAttackRecoil();
        const a0 = Math.atan2(this.boss.y - this.player.y, this.boss.x - this.player.x);
        const bolt = this.add.image(this.player.x, this.player.y, 'arrow').setScale(1.0);
        bolt.setRotation(a0 + Math.PI / 2);
        bolt.setDepth(12);
        let bossTargetDead = false;
        const bossTarget = {
          x: this.boss.x, y: this.boss.y,
          get isDead() { return bossTargetDead; },
          takeDamage: (dmg: number) => {
            if (this.boss && !this.boss.isDead) {
              this.boss.takeDamage(dmg);
              VFX.boltHit(this, this.boss.x, this.boss.y);
            }
            bossTargetDead = true;
          },
        };
        this.autoBolts.push({ graphic: bolt, target: bossTarget as any, speed: AUTO_ATTACK_CONFIG.boltSpeed, damage: AUTO_ATTACK_CONFIG.damage, lifetime: AUTO_ATTACK_CONFIG.boltLifetime });
      }
      return;
    }
    SoundManager.autoAttack(this.player.x, this.player.y);
    this.player.applyAttackRecoil();
    const a0 = Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x);
    const bolt = this.add.image(this.player.x, this.player.y, 'arrow').setScale(1.2);
    bolt.setRotation(a0 + Math.PI / 2);
    bolt.setDepth(12);
    this.autoBolts.push({ graphic: bolt, target: nearest, speed: AUTO_ATTACK_CONFIG.boltSpeed, damage: AUTO_ATTACK_CONFIG.damage, lifetime: AUTO_ATTACK_CONFIG.boltLifetime });
  }

  // ── 水洼 ──
  addPuddle(x: number, y: number): void {
    const r = 65;
    const g = this.add.graphics();
    g.fillStyle(0xCC2222, 0.22);
    g.fillCircle(x, y, r);
    g.setDepth(1);
    // 内圈更浓
    g.fillStyle(0xAA1111, 0.15);
    g.fillCircle(x, y, r * 0.5);
    this.puddles.push({ x, y, radius: r, remaining: 5, graphic: g });

    // 下雨粒子特效
    const rainEmitter = this.add.particles(x, y - 80, 'px_white', {
      speed: { min: 180, max: 350 },
      angle: { min: 85, max: 95 },
      scale: { start: 0.3, end: 0.1 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 500,
      tint: [0xCC3333, 0xDD4444, 0xFF5555],
      frequency: 30,
      x: { min: -r, max: r },
    });
    rainEmitter.setDepth(19);
    // 5秒后停止下雨
    this.time.delayedCall(5000, () => {
      rainEmitter.stop();
      this.time.delayedCall(600, () => { if (rainEmitter.active) rainEmitter.destroy(); });
    });
  }

  /** 酸雨怪专有：在玩家位置生成警示后落水洼 */
  private addPuddleWithWarning(x: number, y: number): void {
    const r = 65;
    const warn = this.add.circle(x, y, r, 0x000000, 0);
    warn.setStrokeStyle(3, 0xCC3333, 0.7);
    warn.setDepth(20);
    this.tweens.add({
      targets: warn,
      radius: 8,
      alpha: 0,
      duration: 600,
      ease: 'Sine.easeIn',
      onComplete: () => {
        warn.destroy();
        this.addPuddle(x, y);
      },
    });
  }

  /** 酸雨怪在场时每隔 1s 在玩家脚下生成水洼 */
  private updateAcidRainPuddles(delta: number): void {
    const hasAcidRain = this.monsters.some(m => !m.isDead && m.type === 'acid_rain');
    if (!hasAcidRain) {
      this.acidRainPuddleTimer = 0;
      return;
    }
    this.acidRainPuddleTimer += delta / 1000;
    if (this.acidRainPuddleTimer >= 1) {
      this.acidRainPuddleTimer -= 1;
      this.addPuddleWithWarning(this.player.x, this.player.y);
    }
  }

  private updatePuddles(delta: number): void {
    let onPuddle = false;
    for (const p of this.puddles) {
      p.remaining -= delta / 1000;
      if (p.remaining <= 0) { p.graphic.destroy(); continue; }
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y) < p.radius) onPuddle = true;
    }
    this.puddles = this.puddles.filter(p => p.remaining > 0);
    // 只在踩中水洼时覆盖减速（比冻融光环更强），离开时不重置
    if (onPuddle) this.player.setSlow(true, 0.25);
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

    // Boss 战况
    let bossStat = '';
    if (this.bossKilled) {
      bossStat = '击败 Boss ✓';
    } else if (this.bossSpawned && this.boss && !this.boss.isDead) {
      bossStat = 'Boss 未击败 ✗';
    }

    // 统计
    const stats = [
      `坚持时间 ${m}:${s.toString().padStart(2, '0')}`,
      `击败怪物 ${this.killCount}`,
      `最高等级 Lv.${this.player.level}`,
    ];
    if (bossStat) {
      stats.push(bossStat);
    }
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

    // ── 保存最高纪录 ──
    saveRecord({
      killCount: this.killCount,
      survivalTime: elapsed,
      level: this.player.level,
      bossKilled: this.bossKilled,
      victory,
      date: new Date().toISOString(),
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
  private debugMonsterIndex = 0;
  private debugDraw = false;
  private debugGfx: Phaser.GameObjects.Graphics | null = null;
  private debugDisableAutoAttack = false;
  private debugMode = false;
  private nPressTimes: number[] = [];

  private setupDebugControls(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    // N: 2s内连点3次切换调试模式
    kb.on('keydown-N', () => {
      const now = this.time.now;
      this.nPressTimes.push(now);
      // 清除超过2s的记录
      this.nPressTimes = this.nPressTimes.filter(t => now - t < 2000);
      if (this.nPressTimes.length >= 3) {
        this.nPressTimes = [];
        this.debugMode = !this.debugMode;
        const msg = this.debugMode ? '🔧 进入开发者模式' : '🔒 已退出开发者模式';
        const t = this.add.text(GAME_WIDTH/2, 60, msg, {
          fontSize: '22px', fontFamily: 'sans-serif', color: this.debugMode ? '#FFD700' : '#888888',
          stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, y: 50, duration: 300, yoyo: true, hold: 800,
          onComplete: () => t.destroy() });
      }
    });

    // M: 2s内连点3次切换菜鸡模式
    let mPressTimes: number[] = [];
    kb.on('keydown-M', () => {
      const now = this.time.now;
      mPressTimes.push(now);
      mPressTimes = mPressTimes.filter(t => now - t < 2000);
      if (mPressTimes.length >= 3) {
        mPressTimes = [];
        EASY_MODE.active = !EASY_MODE.active;
        const msg = EASY_MODE.active ? '🐣 进入菜鸡模式（怪物血量减半 · 伤害翻倍 · 经验翻倍）' : '🦅 已退出菜鸡模式';
        const t = this.add.text(GAME_WIDTH/2, 60, msg, {
          fontSize: '20px', fontFamily: 'sans-serif',
          color: EASY_MODE.active ? '#FFD700' : '#888888',
          stroke: '#000', strokeThickness: 4,
          wordWrap: { width: GAME_WIDTH - 80 },
          align: 'center',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, y: 50, duration: 300, yoyo: true, hold: 1200,
          onComplete: () => t.destroy() });
      }
    });

    // I: 开关普攻
    kb.on('keydown-I', () => {
      if (!this.debugMode) return;
      this.debugDisableAutoAttack = !this.debugDisableAutoAttack;
    });

    // T: 切换碰撞箱可视化
    kb.on('keydown-T', () => {
      if (!this.debugMode) return;
      this.debugDraw = !this.debugDraw;
      if (!this.debugDraw && this.debugGfx) { this.debugGfx.clear(); }
    });

    // Q: 快速升级
    kb.on('keydown-Q', () => {
      if (!this.debugMode) return;
      this.player.exp += this.player.expToNext;
    });

    // 空格: 秒杀全屏怪物
    kb.on('keydown-SPACE', () => {
      if (!this.debugMode) return;
      for (const m of this.monsters) {
        if (!m.isDead) m.takeDamage(9999);
      }
    });

    // 1-4: 在玩家脚下召唤指定类型怪物
    kb.on('keydown-ONE', () => { if (!this.debugMode) return; this.spawnSingleMonster('wind', this.player.x, this.player.y); });
    kb.on('keydown-TWO', () => { if (!this.debugMode) return; this.spawnSingleMonster('acid_rain', this.player.x, this.player.y); });
    kb.on('keydown-THREE', () => { if (!this.debugMode) return; this.spawnSingleMonster('fire', this.player.x, this.player.y); });
    kb.on('keydown-FOUR', () => { if (!this.debugMode) return; this.spawnSingleMonster('freeze_thaw', this.player.x, this.player.y); });

    // O: 秒杀全屏怪物
    kb.on('keydown-O', () => {
      if (!this.debugMode) return;
      for (const m of this.monsters) {
        if (!m.isDead) m.takeDamage(9999);
      }
    });

    // 0: 掉落治疗箱
    kb.on('keydown-ZERO', () => {
      if (!this.debugMode) return;
      this.spawnRepairCrate(this.player.x, this.player.y);
    });

    // P: 快进到 360s
    kb.on('keydown-P', () => {
      if (!this.debugMode) return;
      this.gameTime = 60;
    });

    // R: 循环显示下一个怪物科普弹窗
    const allTypes: MonsterType[] = ['termite', 'wind', 'acid_rain', 'fire', 'freeze_thaw'];
    kb.on('keydown-R', () => {
      if (!this.debugMode) return;
      const type = allTypes[this.debugMonsterIndex % allTypes.length];
      this.debugMonsterIndex++;
      this.isPaused = true;
      this.hud.showMonsterPopup(type, () => { this.isPaused = false; });
    });
  }

  private drawDebugColliders(): void {
    if (!this.debugGfx) {
      this.debugGfx = this.add.graphics();
      this.debugGfx.setDepth(100);
    }
    const g = this.debugGfx;
    g.clear();

    // 玩家碰撞圆
    g.lineStyle(2, 0x00ff00, 0.8);
    g.strokeCircle(this.player.x, this.player.y, 14);

    // 怪物碰撞圆
    g.lineStyle(2, 0xff4444, 0.6);
    for (const m of this.monsters) {
      if (m.isDead) continue;
      g.strokeCircle(m.x, m.y, m.radius);
    }

    // Boss 碰撞圆
    if (this.boss && !this.boss.isDead) {
      g.lineStyle(2, 0xff00ff, 0.8);
      g.strokeCircle(this.boss.x, this.boss.y, this.boss.radius);
    }

    // 圆形碰撞体
    g.lineStyle(2, 0xffff00, 0.5);
    for (const c of this.collidables) {
      g.strokeCircle(c.x, c.y, c.radius);
    }

    // 矩形碰撞体
    g.lineStyle(2, 0xff8800, 0.6);
    for (const r of this.collidableRects) {
      g.strokeRect(r.x, r.y, r.w, r.h);
    }

    // 三角形碰撞体（古建）
    g.lineStyle(2, 0xff8800, 0.8);
    for (const tri of this.collidableTriangles) {
      g.beginPath();
      g.moveTo(tri.x1, tri.y1);
      g.lineTo(tri.x2, tri.y2);
      g.lineTo(tri.x3, tri.y3);
      g.closePath();
      g.strokePath();
    }
  }
}
