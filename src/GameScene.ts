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
  private combatFeel!: CombatFeel;
  private monsters: Monster[] = [];
  private puddles: Puddle[] = [];
  private expOrbs: ExpOrb[] = [];
  private repairCrates: RepairCrate[] = [];
  private collidables: {x:number,y:number,radius:number}[] = [];
  private collidableRects: {x:number,y:number,w:number,h:number}[] = [];

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

  preload(): void {
    this.load.image('bg', 'assets/bg.png');
    this.load.image('png_earth', 'assets/earth.png');
    for(let i=1;i<=9;i++)this.load.image('grass'+i,'assets/精灵-000'+i+'.png');
    this.load.image('illus_termite','assets/monster_termite.png');
    this.load.image('illus_wind','assets/monster_wind.png');
    this.load.image('illus_acid_rain','assets/monster_acid_rain.png');
    this.load.image('illus_fire','assets/monster_fire.png');
    this.load.image('illus_freeze_thaw','assets/monster_freeze_thaw.png');
    this.load.image('gj', 'assets/building.png');
    preloadSprites(this);
  }

  create(): void {
    // 生成全部程序化精灵纹理（玩家、怪物、古建、UI等）
    generateAllTextures(this);

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.drawBackground();

    this.building = new Building(
      this, BUILDING_CONFIG.x, BUILDING_CONFIG.y - 260,
      BUILDING_CONFIG.structures as any,
    );
    this.building.graphics.setScale(0.45);
    this.building.onFailure = () => this.endGame(false);
    // 古建碰撞体
    // 古建碰撞 — 矩形下半部分（890*0.6≈534宽, 1176*0.6≈706高, 下半=353高）
    const bw = 280, bh = 220;
    this.collidableRects.push({ x: BUILDING_CONFIG.x - bw/2, y: BUILDING_CONFIG.y - 260 + 40, w: bw, h: bh });

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
      this, () => this.monsters, () => this.player, () => this.building,
    );
    this.skillManager.addSkill('wood_reinforce');

    // Boss 事件监听
    this.events.on('boss-earthquake', (damage: number) => {
      if (!this.boss || this.boss.isDead) return;
      // 地震波：所有结构扣血
      const structTypes: StructureType[] = ['wood', 'stone', 'tile', 'painting'];
      for (const type of structTypes) {
        this.building.damageStructure(type, damage);
      }
    });

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

    this.player.update(delta); // 玩家始终全速
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
    }

    this.checkPlayerMonsterCollision();
    this.checkFreezeAura();
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
      this.boss.update(time, delta);
      const distToBuilding = Phaser.Math.Distance.Between(
        this.boss.x, this.boss.y, BUILDING_CONFIG.x, BUILDING_CONFIG.y,
      );
      if (distToBuilding < BUILDING_CONFIG.attackRange + 60) {
        // Boss 接近建筑持续侵蚀
      }
      this.hud.updateBossHpBar(this.boss.hp, this.boss.maxHp);
    }

    // 水洼/灼烧
    this.updatePuddles(delta);
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
    const angle = Math.random() * Math.PI * 2;
    const sx = MAP_WIDTH / 2 + Math.cos(angle) * SPAWN_DISTANCE;
    const sy = MAP_HEIGHT / 2 + Math.sin(angle) * SPAWN_DISTANCE;

    // 时间缩放 — 唯一来源
    const scaling = calcTimeScaling(GAME_DURATION - this.gameTime);

    const monster = new Monster(
      this, sx, sy, template,
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
      this.killCount++;
      this.spawnExpOrb(m.x, m.y, m.expDrop);
      // 15% 概率掉落修补箱
      if (Math.random() < 0.15) {
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
      BUILDING_CONFIG.x, BUILDING_CONFIG.y,
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
        BUILDING_CONFIG.x, BUILDING_CONFIG.y,
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
          SoundManager.repairCratePickup();
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
    if (this.autoAttackTimer >= AUTO_ATTACK_CONFIG.cooldown) {
      this.autoAttackTimer -= AUTO_ATTACK_CONFIG.cooldown;
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
        const bolt = this.add.image(this.player.x, this.player.y, 'bolt').setScale(2.5);
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
    const bolt = this.add.image(this.player.x, this.player.y, 'bolt').setScale(2.5);
    bolt.setDepth(12);
    this.autoBolts.push({ graphic: bolt, target: nearest, speed: AUTO_ATTACK_CONFIG.boltSpeed, damage: AUTO_ATTACK_CONFIG.damage, lifetime: AUTO_ATTACK_CONFIG.boltLifetime });
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

  private setupDebugControls(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    // Q: 快速升级
    kb.on('keydown-Q', () => { this.player.exp += this.player.expToNext; });

    // 空格: 秒杀全屏怪物
    kb.on('keydown-SPACE', () => {
      for (const m of this.monsters) {
        if (!m.isDead) m.takeDamage(9999);
      }
    });

    // R: 循环显示下一个怪物科普弹窗
    const allTypes: MonsterType[] = ['termite', 'wind', 'acid_rain', 'fire', 'freeze_thaw'];
    kb.on('keydown-R', () => {
      const type = allTypes[this.debugMonsterIndex % allTypes.length];
      this.debugMonsterIndex++;
      this.isPaused = true;
      this.hud.showMonsterPopup(type, () => { this.isPaused = false; });
    });
  }
}