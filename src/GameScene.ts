import Phaser from 'phaser';
import {
  MAP_WIDTH, MAP_HEIGHT, GAME_WIDTH, GAME_HEIGHT, GAME_DURATION,
  PLAYER_CONFIG, BUILDING_CONFIG, MONSTER_TEMPLATES,
  SPAWN_DISTANCE, INITIAL_SPAWN_INTERVAL, SPAWN_WEIGHTS,
  MonsterType, SkillId,
} from './config';
import { Player } from './Player';
import { Building } from './Building';
import { Monster } from './Monster';
import { HUD } from './HUD';
import { SkillManager } from './SkillManager';

// ── 水洼 ──
interface Puddle {
  x: number; y: number;
  radius: number;
  remaining: number;
  graphic: Phaser.GameObjects.Graphics;
}

// ── 自动普攻弹 ──
interface AutoBolt {
  graphic: Phaser.GameObjects.Arc;
  target: Monster;
  speed: number;
  damage: number;
  lifetime: number;
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private building!: Building;
  private hud!: HUD;
  private skillManager!: SkillManager;
  private monsters: Monster[] = [];
  private puddles: Puddle[] = [];

  private gameTime = GAME_DURATION;
  private spawnTimer = 0;
  private spawnInterval = INITIAL_SPAWN_INTERVAL;
  private isGameOver = false;
  private killCount = 0;

  // 自动普攻
  private autoAttackTimer = 0;
  private readonly autoAttackCooldown = 0.7;
  private readonly autoAttackDamage = 8;
  private autoBolts: AutoBolt[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.drawBackground();

    // 古建
    this.building = new Building(
      this,
      BUILDING_CONFIG.x, BUILDING_CONFIG.y,
      BUILDING_CONFIG.structures as any,
    );
    this.building.onFailure = () => this.endGame(false);

    // 玩家
    this.player = new Player(
      this,
      BUILDING_CONFIG.x,
      BUILDING_CONFIG.y + PLAYER_CONFIG.startOffsetY,
      PLAYER_CONFIG.maxHp,
      PLAYER_CONFIG.moveSpeed,
      PLAYER_CONFIG.radius,
      PLAYER_CONFIG.color,
    );

    this.cameras.main.startFollow(this.player.sprite, true, 0.09, 0.09);

    // HUD
    this.hud = new HUD(this);

    // 技能管理器
    this.skillManager = new SkillManager(
      this,
      () => this.monsters,
      () => this.player,
      () => this.building,
    );
    this.skillManager.addSkill('wood_reinforce'); // 初始自带

    // 调试键
    this.setupDebugControls();
  }

  update(time: number, delta: number): void {
    if (this.isGameOver) return;

    // 玩家
    this.player.update(delta);

    // 刷怪
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval;
      this.spawnMonster();
    }

    // 怪物更新
    for (const m of this.monsters) {
      m.update(time, delta);
    }

    // 玩家-怪物碰撞
    this.checkPlayerMonsterCollision();

    // 冻融怪减速检测
    this.checkFreezeAura();

    // 清理死怪
    this.monsters = this.monsters.filter(m => !m.isDead);

    // 自动普攻
    this.updateAutoAttack(delta);

    // 技能更新
    this.skillManager.update(delta, time);

    // 水洼更新
    this.updatePuddles(delta);

    // 灼烧更新
    this.building.updateBurn(delta);

    // 玩家死亡
    if (this.player.isDead) {
      this.endGame(false);
      return;
    }

    // 倒计时
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
    const bg = this.add.graphics();
    bg.fillStyle(0x2d5a1e, 1);
    bg.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    bg.lineStyle(1, 0x3d6a2e, 0.25);
    const step = 64;
    for (let x = 0; x <= MAP_WIDTH; x += step) {
      bg.moveTo(x, 0); bg.lineTo(x, MAP_HEIGHT);
    }
    for (let y = 0; y <= MAP_HEIGHT; y += step) {
      bg.moveTo(0, y); bg.lineTo(MAP_WIDTH, y);
    }
    bg.strokePath();
    bg.setDepth(0);
  }

  // ── 刷怪：权重随机 ──
  private spawnMonster(): void {
    const type = this.weightedRandomType();
    const template = MONSTER_TEMPLATES[type];
    const angle = Math.random() * Math.PI * 2;
    const sx = MAP_WIDTH / 2 + Math.cos(angle) * SPAWN_DISTANCE;
    const sy = MAP_HEIGHT / 2 + Math.sin(angle) * SPAWN_DISTANCE;

    const monster = new Monster(
      this, sx, sy, template,
      BUILDING_CONFIG.x, BUILDING_CONFIG.y,
      BUILDING_CONFIG.attackRange,
    );

    // 攻击回调
    monster.onAttack = (m) => {
      for (const structType of m.attackStructures) {
        this.building.damageStructure(structType, m.damage);
      }
      // 酸雨怪生成水洼
      if (m.type === 'acid_rain') {
        this.addPuddle(m.x, m.y);
      }
      // 火焰怪施加灼烧
      if (m.type === 'fire') {
        for (const st of m.attackStructures) {
          this.building.applyBurn(st, 5, 2);
        }
      }
    };

    // 接触玩家回调（风蚀怪击退）
    monster.onPlayerContact = (m) => {
      if (m.type === 'wind') {
        this.player.applyKnockback(m.x, m.y, 250);
      }
    };

    // 死亡回调
    monster.onDeath = () => {
      this.killCount++;
    };

    this.monsters.push(monster);
  }

  private weightedRandomType(): MonsterType {
    const totalWeight = SPAWN_WEIGHTS.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * totalWeight;
    for (const entry of SPAWN_WEIGHTS) {
      r -= entry.weight;
      if (r <= 0) return entry.type;
    }
    return 'termite';
  }

  // ── 玩家-怪物碰撞 ──
  private checkPlayerMonsterCollision(): void {
    for (const m of this.monsters) {
      if (m.isDead) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, m.x, m.y,
      );
      const contactDist = PLAYER_CONFIG.radius + m.sprite.radius;
      if (dist < contactDist) {
        m.onPlayerContact?.(m);
        this.player.takeDamage(m.damage);
      }
    }
  }

  // ── 冻融怪减速光环 ──
  private checkFreezeAura(): void {
    let nearFreeze = false;
    for (const m of this.monsters) {
      if (m.isDead || m.type !== 'freeze_thaw') continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, m.x, m.y,
      );
      if (dist < 120) {
        nearFreeze = true;
        break;
      }
    }
    this.player.setSlow(nearFreeze, 0.4);
  }

  // ── 自动普攻 ──
  private updateAutoAttack(delta: number): void {
    const dt = delta / 1000;

    // 冷却计时
    this.autoAttackTimer += dt;
    if (this.autoAttackTimer >= this.autoAttackCooldown) {
      this.autoAttackTimer -= this.autoAttackCooldown;
      this.fireAutoBolt();
    }

    // 更新飞行中的普攻弹
    for (const bolt of this.autoBolts) {
      bolt.lifetime -= dt;
      if (bolt.lifetime <= 0 || bolt.target.isDead) {
        bolt.graphic.destroy();
        continue;
      }

      // 追踪目标
      const angle = Math.atan2(
        bolt.target.y - bolt.graphic.y,
        bolt.target.x - bolt.graphic.x,
      );
      bolt.graphic.x += Math.cos(angle) * bolt.speed * dt;
      bolt.graphic.y += Math.sin(angle) * bolt.speed * dt;

      // 命中检测
      const dist = Phaser.Math.Distance.Between(
        bolt.graphic.x, bolt.graphic.y,
        bolt.target.x, bolt.target.y,
      );
      if (dist < 12) {
        bolt.target.takeDamage(bolt.damage);
        bolt.graphic.destroy();
      }
    }

    this.autoBolts = this.autoBolts.filter(b => b.lifetime > 0 && b.graphic.active);
  }

  private fireAutoBolt(): void {
    // 找最近怪物
    let nearest: Monster | null = null;
    let nearestDist = Infinity;
    for (const m of this.monsters) {
      if (m.isDead) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = m;
      }
    }
    if (!nearest) return;

    const bolt = this.add.circle(this.player.x, this.player.y, 3, 0x88ccff);
    bolt.setDepth(12);

    this.autoBolts.push({
      graphic: bolt,
      target: nearest,
      speed: 350,
      damage: this.autoAttackDamage,
      lifetime: 2,
    });
  }

  // ── 水洼系统 ──
  addPuddle(x: number, y: number): void {
    const radius = 40;
    const g = this.add.graphics();
    g.fillStyle(0x44CC44, 0.25);
    g.fillCircle(x, y, radius);
    g.setDepth(1);

    this.puddles.push({ x, y, radius, remaining: 5, graphic: g });
  }

  private updatePuddles(delta: number): void {
    let playerOnPuddle = false;

    for (const p of this.puddles) {
      p.remaining -= delta / 1000;
      if (p.remaining <= 0) {
        p.graphic.destroy();
        continue;
      }

      // 检测玩家是否站在水洼中
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, p.x, p.y,
      );
      if (dist < p.radius) {
        playerOnPuddle = true;
      }
    }

    this.puddles = this.puddles.filter(p => p.remaining > 0);

    // 水洼减速独立于冻融
    if (playerOnPuddle) {
      this.player.setSlow(true, 0.6);
    } else {
      // 如果没有冻融减速，恢复（冻融在 checkFreezeAura 中设置）
    }
  }

  // ── 胜负 ──
  private endGame(victory: boolean): void {
    if (this.isGameOver) return;
    this.isGameOver = true;

    const elapsed = GAME_DURATION - this.gameTime;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);

    const msg = victory ? '古建守卫成功！' : '古建被毁...';
    const color = victory ? '#ffdd44' : '#ff4444';
    const subtitle = `坚持时间 ${mins}:${secs.toString().padStart(2, '0')}  |  击杀 ${this.killCount}`;

    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.5,
    ).setScrollFactor(0).setDepth(199);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, msg, {
      fontSize: '42px', color, fontFamily: 'sans-serif',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, subtitle, {
      fontSize: '16px', color: '#ccc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, '刷新页面重开一局', {
      fontSize: '13px', color: '#888',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
  }

  // ── 调试键 ──
  private setupDebugControls(): void {
    const kb = this.input.keyboard!;

    // 空格：秒杀所有怪物
    kb.on('keydown-SPACE', () => {
      for (const m of this.monsters) m.takeDamage(999);
    });

    // K / H：扣/回木质结构
    kb.on('keydown-K', () => this.building.damageStructure('wood', 10));
    kb.on('keydown-H', () => this.building.healStructure('wood', 10));

    // 1-4：摧毁指定结构
    kb.on('keydown-ONE', () => this.building.damageStructure('wood', 200));
    kb.on('keydown-TWO', () => this.building.damageStructure('stone', 200));
    kb.on('keydown-THREE', () => this.building.damageStructure('tile', 200));
    kb.on('keydown-FOUR', () => this.building.damageStructure('painting', 200));

    // Q：强制升级（给经验）
    kb.on('keydown-Q', () => {
      this.player.exp += this.player.expToNext;
    });

    // Z/X/C/V/B：直接添加 5 个技能
    const skillIds: SkillId[] = ['wood_reinforce', 'stone_repair', 'waterproof', 'insect_control', 'painting_restore'];
    const keys = ['Z', 'X', 'C', 'V', 'B'];
    keys.forEach((key, i) => {
      kb.on(`keydown-${key}`, () => {
        this.skillManager.addSkill(skillIds[i]);
        // 直接升满 3 级
        this.skillManager.upgradeSkill(skillIds[i]);
        this.skillManager.upgradeSkill(skillIds[i]);
      });
    });
  }
}
