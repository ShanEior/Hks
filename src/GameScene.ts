import Phaser from 'phaser';
import {
  MAP_WIDTH, MAP_HEIGHT, GAME_WIDTH, GAME_HEIGHT, GAME_DURATION,
  PLAYER_CONFIG, BUILDING_CONFIG, MONSTER_TEMPLATES,
  SPAWN_DISTANCE, INITIAL_SPAWN_INTERVAL,
  EXP_ORB_CONFIG, PICKUP_RANGE,
  BASE_EXP_TO_LEVEL, EXP_PER_LEVEL, ALL_SKILL_IDS,
  SKILL_CONFIGS, WAVE_STAGES,
  MonsterType, SkillId, WaveStage,
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

// ── 经验球 ──
interface ExpOrb {
  graphic: Phaser.GameObjects.Arc;
  value: number;
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

  private gameTime = GAME_DURATION;
  private spawnTimer = 0;
  private spawnInterval = INITIAL_SPAWN_INTERVAL;
  private isGameOver = false;
  private isPaused = false;
  private killCount = 0;

  // 自动普攻
  private autoAttackTimer = 0;
  private readonly autoAttackCooldown = 0.7;
  private readonly autoAttackDamage = 8;
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

  create(): void {
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.drawBackground();

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

  // ── 波次系统 ──
  private getCurrentStage(): WaveStage | null {
    const elapsed = GAME_DURATION - this.gameTime;
    for (const stage of WAVE_STAGES) {
      if (elapsed >= stage.timeStart && elapsed < stage.timeEnd) return stage;
    }
    return null;
  }

  private spawnWave(stage: WaveStage): void {
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

    const monster = new Monster(
      this, sx, sy, template,
      BUILDING_CONFIG.x, BUILDING_CONFIG.y,
      BUILDING_CONFIG.attackRange,
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
      this.spawnExpOrb(m.x, m.y, m.expDrop);
    };

    this.monsters.push(monster);
  }

  // ── 经验球 ──
  private spawnExpOrb(x: number, y: number, value: number): void {
    const orb = this.add.circle(x, y, EXP_ORB_CONFIG.radius, EXP_ORB_CONFIG.color);
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

  // ── 升级检测 ──
  private checkLevelUp(): void {
    if (this.levelUpPanelActive) return;
    if (this.player.exp >= this.player.expToNext) {
      this.player.exp -= this.player.expToNext;
      this.player.level++;
      this.player.expToNext = BASE_EXP_TO_LEVEL + this.player.level * EXP_PER_LEVEL;
      this.pauseForLevelUp();
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
    const parts: string[] = [];
    parts.push(`CD ${cfg.cooldown}s，伤害 ${cfg.damage}`);
    if (cfg.range > 0) parts.push(`范围 ${cfg.range}`);
    if (cfg.repairAmount > 0 && cfg.repairType.length > 0) {
      parts.push(`回复${cfg.repairType.join('/')} ${cfg.repairAmount} 点`);
    }
    if (cfg.bonusDamageVs) {
      const names: Record<string, string> = { acid_rain: '酸雨怪', termite: '白蚁怪' };
      parts.push(`对${names[cfg.bonusDamageVs] ?? cfg.bonusDamageVs}伤害 ×${cfg.bonusDamageMultiplier}`);
    }
    if (cfg.knockbackForce) parts.push('击退敌人');
    if (cfg.widthMultiplier) parts.push('加宽冲击波');
    if (cfg.projectileBounce) parts.push('弹射 1 次');
    if (cfg.zoneDuration) parts.push(`持续 ${cfg.zoneDuration}s`);
    return parts.join('，');
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
      if (dist < PLAYER_CONFIG.radius + m.sprite.radius) {
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
    const bolt = this.add.circle(this.player.x, this.player.y, 3, 0x88ccff);
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
