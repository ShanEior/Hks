// ============================================================
// 山西古建保卫战 — 全局常量配置
// ============================================================

// ---- 地图 ----
export const MAP_WIDTH = 1920;
export const MAP_HEIGHT = 1080;
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;
export const GAME_DURATION = 300; // 秒 (5 分钟)

// ---- 速度转换系数 ----
// spec 数值基于 60fps 每帧移动量，代码中转为 px/s
export const SPEED_FACTOR = 60;

// ---- 玩家 ----
export const PLAYER_CONFIG = {
  maxHp: 100,
  moveSpeed: 4,          // spec 值，代码中 * 60 = 240 px/s
  radius: 16,
  color: 0x4488ff,
  startOffsetY: 120,     // 出生在古建下方
};

// ---- 古建基地（木构古寺） ----
export const BUILDING_CONFIG = {
  x: MAP_WIDTH / 2,      // 960
  y: MAP_HEIGHT / 2,     // 540
  attackRange: 80,       // 怪物在此距离内开始攻击
  structures: {
    wood:     { maxHp: 120, color: 0xC4884D, label: '木质结构' },
    stone:    { maxHp:  70, color: 0x999999, label: '石质结构' },
    tile:     { maxHp:  90, color: 0xA0522D, label: '砖瓦结构' },
    painting: { maxHp:  80, color: 0x9966CC, label: '彩绘壁画' },
  },
} as const;

export type StructureType = keyof typeof BUILDING_CONFIG.structures;

// ---- 怪物模板 ----
export type MonsterType = 'termite' | 'wind' | 'acid_rain' | 'fire' | 'freeze_thaw';

export interface MonsterTemplate {
  type: MonsterType;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  attackInterval: number; // ms
  attackStructures: StructureType[];
  color: number;
  radius: number;
  expDrop: number;
}

export const MONSTER_TEMPLATES: Record<MonsterType, MonsterTemplate> = {
  termite: {
    type: 'termite', name: '白蚁怪',
    hp: 8, speed: 0.5, damage: 2,
    attackInterval: 1000,
    attackStructures: ['wood'],
    color: 0xDDDDDD, radius: 8, expDrop: 6,
  },
  wind: {
    type: 'wind', name: '风蚀怪',
    hp: 12, speed: 0.6, damage: 3,
    attackInterval: 1200,
    attackStructures: ['stone', 'painting'],
    color: 0xDDCC88, radius: 10, expDrop: 10,
  },
  acid_rain: {
    type: 'acid_rain', name: '酸雨怪',
    hp: 15, speed: 0.4, damage: 3,
    attackInterval: 2000,
    attackStructures: ['stone', 'tile'],
    color: 0x44CC44, radius: 11, expDrop: 12,
  },
  fire: {
    type: 'fire', name: '火焰怪',
    hp: 18, speed: 0.7, damage: 4,
    attackInterval: 1500,
    attackStructures: ['wood', 'painting'],
    color: 0xFF6633, radius: 12, expDrop: 15,
  },
  freeze_thaw: {
    type: 'freeze_thaw', name: '冻融怪',
    hp: 25, speed: 0.3, damage: 5,
    attackInterval: 2000,
    attackStructures: ['stone', 'tile'],
    color: 0x6699FF, radius: 14, expDrop: 20,
  },
};

// ---- 怪物生成 ----
export const SPAWN_DISTANCE = 700; // 从地图中心算起的生成距离
export const INITIAL_SPAWN_INTERVAL = 2000;
export const MAX_MONSTERS = 80; // ms

// ---- 经验 ----
export const BASE_EXP_TO_LEVEL = 10;
export const EXP_PER_LEVEL = 5; // ExpToNext = BASE + Level * EXP_PER_LEVEL
export const PICKUP_RANGE = 120;
export const INVINCIBILITY_DURATION = 300; // ms (0.3s) // 经验球自动吸附范围 (spec 1.5 * 60)

// ---- 技能 ----
export type SkillId =
  | 'wood_reinforce'
  | 'stone_repair'
  | 'waterproof'
  | 'insect_control'
  | 'painting_restore'
  | 'repair_field'
  | 'whirlwind_slash'
  | 'chain_lightning';

export interface SkillLevelConfig {
  level: number;
  name: string;
  cooldown: number;         // 秒
  damage: number;
  range: number;            // 圆形半径 / 投射物宽度
  repairType: StructureType[];
  repairAmount: number;
  shots?: number;           // 单次释放的投射物/落点数量
  pulseCount?: number;      // 连续脉冲次数
  pulseInterval?: number;   // 脉冲间隔（秒）
  tickInterval?: number;    // 持续区域 tick 间隔（秒）
  splashRadius?: number;    // 命中后的溅射半径
  pierceCount?: number;     // 投射物最多命中数量
  chainCount?: number;      // 追踪弹额外弹射次数
  followPlayer?: boolean;   // 区域是否跟随玩家
  widthMultiplier?: number;
  bonusDamageVs?: MonsterType;
  bonusDamageMultiplier?: number;
  knockbackForce?: number;
  projectileBounce?: boolean;
  zoneDuration?: number;    // 药雾持续时间（秒）
}

export interface ActiveSkill {
  id: SkillId;
  name: string;
  level: number;
  maxLevel: number;
  cooldown: number;
  timer: number;
  damage: number;
  range: number;
  repairType: StructureType[];
  repairAmount: number;
  shots?: number;
  pulseCount?: number;
  pulseInterval?: number;
  tickInterval?: number;
  splashRadius?: number;
  pierceCount?: number;
  chainCount?: number;
  followPlayer?: boolean;
  widthMultiplier?: number;
  bonusDamageVs?: MonsterType;
  bonusDamageMultiplier?: number;
  knockbackForce?: number;
  projectileBounce?: boolean;
  zoneDuration?: number;
}

export const SKILL_CONFIGS: Record<SkillId, SkillLevelConfig[]> = {
  wood_reinforce: [
    { level: 1, name: '木构加固', cooldown: 3.8, damage: 40, range: 120, repairType: [], repairAmount: 0, shots: 1, pierceCount: 3, widthMultiplier: 1.2 },
    { level: 2, name: '梁柱补强', cooldown: 3.4, damage: 58, range: 150, repairType: ['wood'], repairAmount: 2, shots: 2, pierceCount: 5, widthMultiplier: 1.6 },
    { level: 3, name: '榫卯强化', cooldown: 3.0, damage: 82, range: 180, repairType: ['wood'], repairAmount: 4, shots: 3, pierceCount: 8, widthMultiplier: 2.1, splashRadius: 28 },
  ],
  stone_repair: [
    { level: 1, name: '石材修补', cooldown: 5.2, damage: 24, range: 180, repairType: [], repairAmount: 0, pulseCount: 2, pulseInterval: 0.14 },
    { level: 2, name: '石粉填补', cooldown: 4.8, damage: 32, range: 220, repairType: [], repairAmount: 0, pulseCount: 3, pulseInterval: 0.13 },
    { level: 3, name: '表层加固', cooldown: 4.4, damage: 42, range: 260, repairType: ['stone'], repairAmount: 2, pulseCount: 4, pulseInterval: 0.12, knockbackForce: 280 },
  ],
  waterproof: [
    { level: 1, name: '防水封护', cooldown: 5.2, damage: 26, range: 220, repairType: [], repairAmount: 0, shots: 4, splashRadius: 40 },
    { level: 2, name: '排水导流', cooldown: 4.8, damage: 34, range: 240, repairType: [], repairAmount: 0, shots: 6, splashRadius: 52, bonusDamageVs: 'acid_rain', bonusDamageMultiplier: 3 },
    { level: 3, name: '防渗保护层', cooldown: 4.4, damage: 44, range: 270, repairType: ['stone', 'tile'], repairAmount: 2, shots: 8, splashRadius: 64, bonusDamageVs: 'acid_rain', bonusDamageMultiplier: 3.4 },
  ],
  insect_control: [
    { level: 1, name: '防虫处理', cooldown: 5.0, damage: 9, range: 150, repairType: [], repairAmount: 0, zoneDuration: 4, tickInterval: 0.45, followPlayer: true, shots: 0 },
    { level: 2, name: '虫害清查', cooldown: 4.7, damage: 12, range: 180, repairType: [], repairAmount: 0, zoneDuration: 5.5, tickInterval: 0.35, followPlayer: true, shots: 1, bonusDamageVs: 'termite', bonusDamageMultiplier: 2.8 },
    { level: 3, name: '木构驱虫', cooldown: 4.3, damage: 15, range: 210, repairType: ['wood'], repairAmount: 1, zoneDuration: 7, tickInterval: 0.28, followPlayer: true, shots: 2, bonusDamageVs: 'termite', bonusDamageMultiplier: 3.4 },
  ],
  painting_restore: [
    { level: 1, name: '彩绘修复', cooldown: 3.2, damage: 24, range: 0, repairType: [], repairAmount: 0, shots: 2 },
    { level: 2, name: '颜料补绘', cooldown: 2.8, damage: 34, range: 60, repairType: [], repairAmount: 0, shots: 3, splashRadius: 60 },
    { level: 3, name: '壁画护色', cooldown: 2.4, damage: 46, range: 78, repairType: ['painting'], repairAmount: 2, shots: 4, splashRadius: 78, projectileBounce: true, chainCount: 2 },
  ],
  repair_field: [
    { level: 1, name: '修复法阵', cooldown: 7, damage: 0, range: 145, repairType: ['wood', 'stone', 'tile', 'painting'], repairAmount: 3, zoneDuration: 4, tickInterval: 0.65, followPlayer: true, shots: 6 },
    { level: 2, name: '生机回环', cooldown: 6.2, damage: 0, range: 170, repairType: ['wood', 'stone', 'tile', 'painting'], repairAmount: 5, zoneDuration: 5, tickInterval: 0.55, followPlayer: true, shots: 8 },
    { level: 3, name: '结构复苏', cooldown: 5.4, damage: 0, range: 190, repairType: ['wood', 'stone', 'tile', 'painting'], repairAmount: 7, zoneDuration: 6, tickInterval: 0.42, followPlayer: true, shots: 10 },
  ],
  whirlwind_slash: [
    { level: 1, name: '旋风斩', cooldown: 4.2, damage: 28, range: 250, repairType: [], repairAmount: 0, shots: 1, pierceCount: 4, widthMultiplier: 1.1 },
    { level: 2, name: '烈风轮斩', cooldown: 3.8, damage: 40, range: 290, repairType: [], repairAmount: 0, shots: 2, pierceCount: 5, widthMultiplier: 1.2 },
    { level: 3, name: '青岚风暴', cooldown: 3.3, damage: 54, range: 330, repairType: [], repairAmount: 0, shots: 3, pierceCount: 6, widthMultiplier: 1.3, knockbackForce: 220 },
  ],
  chain_lightning: [
    { level: 1, name: '雷电链', cooldown: 4.1, damage: 34, range: 290, repairType: [], repairAmount: 0, chainCount: 3, shots: 1 },
    { level: 2, name: '奔雷锁链', cooldown: 3.6, damage: 46, range: 330, repairType: [], repairAmount: 0, chainCount: 5, shots: 1 },
    { level: 3, name: '九霄雷网', cooldown: 3.1, damage: 58, range: 360, repairType: [], repairAmount: 0, chainCount: 7, shots: 2 },
  ],
};

// ---- 经验球 ----
export const EXP_ORB_CONFIG = {
  radius: 6,
  color: 0x44ff88,
  lifetime: 30,      // 地面存活秒数
  attractSpeed: 400, // 吸附飞行速度 px/s
  collectDist: 12,   // 收集判定距离
};

// ---- 全部技能 ID 列表（用于技能池生成） ----
export const ALL_SKILL_IDS: SkillId[] = [
  'wood_reinforce', 'stone_repair', 'waterproof', 'insect_control', 'painting_restore',
  'repair_field', 'whirlwind_slash', 'chain_lightning',
];

// ---- 敌怪时间缩放 ----
// 让敌怪随时间变强：基础值 × (1 + growthRate × 经过分钟数)
// 例如经过 3 分钟时，termite 的 HP = 8 × (1 + 0.35 × 3) ≈ 16.4
export interface TimeScaling {
  hpGrowthPerMin: number;     // HP 每分钟增长系数
  damageGrowthPerMin: number; // 伤害每分钟增长系数
  speedGrowthPerMin: number;  // 速度每分钟增长系数
  expGrowthPerMin: number;    // 经验每分钟增长系数
}

export const TIME_SCALING: TimeScaling = {
  hpGrowthPerMin: 0.6,      // 5分钟时 ≈ 4x
  damageGrowthPerMin: 0.4,  // 5分钟时 ≈ 3x
  speedGrowthPerMin: 0.15,   // 5分钟时 ≈ 1.75x
  expGrowthPerMin: 0.5,     // 经验同步增长，5分钟时 ≈ 3.5x
};

/** 根据已过秒数计算当前缩放倍率 */
export function calcTimeScaling(elapsedSec: number): {
  hpMult: number;
  damageMult: number;
  speedMult: number;
  expMult: number;
} {
  const t = elapsedSec / 60; // 转换为分钟
  return {
    hpMult:     1 + TIME_SCALING.hpGrowthPerMin      * t,
    damageMult: 1 + TIME_SCALING.damageGrowthPerMin  * t,
    speedMult:  1 + TIME_SCALING.speedGrowthPerMin   * t,
    expMult:    1 + TIME_SCALING.expGrowthPerMin     * t,
  };
}

// ============================================================
// Boss 配置（灾蚀核心）
// ============================================================

export const BOSS_CONFIG = {
  type: 'calamity_core' as const,
  name: '灾蚀核心',
  hp: 500,
  speed: 0.25,             // spec 值，* 60 = 15 px/s
  damage: 8,                // 每次攻击对每个结构伤害
  attackInterval: 1500,     // ms
  radius: 48,               // 像素格
  color: 0x6611AA,
  expDrop: 200,

  // 技能
  earthquakeCooldown: 5000,   // 地震波冷却 ms
  earthquakeDamage: 6,        // 每个结构地震伤害
  summonCooldown: 8000,       // 召唤冷却 ms
  summonCount: 4,             // 每次召唤数量
  summonType: 'termite' as MonsterType,  // 召唤小怪类型
  summonHpMult: 0.5,          // 小怪 HP 倍率

  // 出场
  appearTime: 30,             // 剩余秒数时出场
  warnDuration: 3,            // 预警秒数

  // 奖励
  guaranteedCrateCount: 1,    // 必定掉修补箱数量
} as const;

// ---- 波次阶段（spec 13.4） ----
export interface WaveStage {
  timeStart: number;
  timeEnd: number;
  spawnInterval: number; // ms
  monsters: { type: MonsterType; weight: number }[];
  countPerWave: number;
}

export const WAVE_STAGES: WaveStage[] = [
  { timeStart: 0,  timeEnd: 30,  spawnInterval: 1500, monsters: [{type:'termite',weight:100}], countPerWave: 6 },
  { timeStart: 30, timeEnd: 60,  spawnInterval: 1200, monsters: [{type:'termite',weight:80},{type:'wind',weight:20}], countPerWave: 10 },
  { timeStart: 60, timeEnd: 120, spawnInterval: 1000, monsters: [{type:'termite',weight:60},{type:'wind',weight:25},{type:'acid_rain',weight:15}], countPerWave: 15 },
  { timeStart: 120,timeEnd: 180, spawnInterval: 800,  monsters: [{type:'termite',weight:45},{type:'wind',weight:20},{type:'acid_rain',weight:20},{type:'fire',weight:15}], countPerWave: 20 },
  { timeStart: 180,timeEnd: 240, spawnInterval: 600,  monsters: [{type:'termite',weight:35},{type:'wind',weight:20},{type:'acid_rain',weight:20},{type:'fire',weight:15},{type:'freeze_thaw',weight:10}], countPerWave: 25 },
  { timeStart: 240,timeEnd: 300, spawnInterval: 500,  monsters: [{type:'termite',weight:30},{type:'wind',weight:18},{type:'acid_rain',weight:18},{type:'fire',weight:18},{type:'freeze_thaw',weight:16}], countPerWave: 30 },
];

// ---- 刷怪权重（Phase 2 简单权重，后续改为波次驱动） ----
export const SPAWN_WEIGHTS: { type: MonsterType; weight: number }[] = [
  { type: 'termite', weight: 40 },
  { type: 'wind', weight: 20 },
  { type: 'acid_rain', weight: 20 },
  { type: 'fire', weight: 15 },
  { type: 'freeze_thaw', weight: 5 },
];

// ============================================================
// UI 样式 — 像素风调色板 + 字体预设
// ============================================================

export const PALETTE = {
  GOLD:         '#DAA520',
  BRIGHT_GOLD:  '#FFD700',
  DARK_GOLD:    '#B8960A',
  DARK_WOOD:    '#3E2510',
  OAK_WOOD:     '#6B4226',
  PALE_WOOD:    '#C4884D',
  CINNABAR:     '#C04040',
  JADE_GREEN:   '#5B8C5A',
  STONE_GRAY:   '#8A8A80',
  PARCHMENT:    '#F0E8D0',
  INK_BLACK:    '#1A1410',
  DANGER_RED:   '#E04040',
  HEAL_GREEN:   '#44CC66',
  PANEL_BG:     '#1E1810',
  BAR_BG:       '#2A2218',
} as const;

/** 字体预设 — 系统 CJK 字体栈，清晰可读，关键层级加粗 */
export const FONT = {
  tiny:     { fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif', fontSize: '12px' },
  small:    { fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif', fontSize: '14px' },
  body:     { fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif', fontSize: '16px', fontStyle: 'bold' },
  large:    { fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif', fontSize: '20px', fontStyle: 'bold' },
  title:    { fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif', fontSize: '24px', fontStyle: 'bold' },
  huge:     { fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif', fontSize: '40px', fontStyle: 'bold' },
} as const;

/** 像素纹理的单位块大小（与 ArtGen.ts 中的 PX 一致） */
export const UI_PX = 2;

/** 结构血条通用尺寸 */
export const STRUCT_BAR = { w: 160, h: 14, gap: 10 } as const;

/** 升级卡片尺寸 */
export const LEVELUP_CARD = { w: 230, h: 250 } as const;

// ============================================================
// 战斗手感 — 命中点光晕（替代全屏闪白）
// ============================================================

export const IMPACT_FLASH_CONFIG = {
  light:   { coreColor: 0xffffff, coreRadius: 6,  coreDuration: 100, ringColor: 0xcccccc, ringRadius: 30,  ringDuration: 200 },
  medium:  { coreColor: 0xffffff, coreRadius: 8,  coreDuration: 130, ringColor: 0xffdd88, ringRadius: 45,  ringDuration: 250 },
  heavy:   { coreColor: 0xffdd44, coreRadius: 12, coreDuration: 160, ringColor: 0xffaa44, ringRadius: 60,  ringDuration: 300 },
  ultra:   { coreColor: 0xffdd44, coreRadius: 16, coreDuration: 200, ringColor: 0xff6600, ringRadius: 80,  ringDuration: 400 },
} as const;

// ============================================================
// 战斗手感 — 命中停顿（Hit Stop）
// ============================================================

export const HIT_STOP_CONFIG = {
  none:    { freezeMs: 0   },
  light:   { freezeMs: 33  },
  medium:  { freezeMs: 66  },
  heavy:   { freezeMs: 100 },
  ultra:   { freezeMs: 150 },

  cooldownMs: 150,
} as const;

export type HitStopTier = keyof typeof HIT_STOP_CONFIG & ('none' | 'light' | 'medium' | 'heavy' | 'ultra');

// ============================================================
// 战斗手感 — 击退
// ============================================================

export const KNOCKBACK_CONFIG = {
  light:      { force: 100, stunMs: 50  },
  medium:     { force: 200, stunMs: 100 },
  heavy:      { force: 350, stunMs: 150 },
  autoAttack: { force: 60,  stunMs: 40  },
  decayPerFrame: 0.85,
  minDurationMs: 100,
} as const;

export type KnockbackTier = keyof typeof KNOCKBACK_CONFIG & ('light' | 'medium' | 'heavy' | 'autoAttack');

// ============================================================
// 自动攻击配置
// ============================================================

export const AUTO_ATTACK_CONFIG = {
  damage: 22,
  cooldown: 0.7,
  boltSpeed: 350,
  boltLifetime: 2,
  boltRadius: 12,
} as const;

// ============================================================
// Batch 2 — 音频合成配置
// ============================================================

export const SOUND_CONFIG = {
  compressor: {
    threshold: -18,
    ratio: 6,
    attack: 0.003,
    release: 0.08,
    knee: 12,
  },
  voicePool: {
    maxVoices: 24,
    PRI_CRITICAL:  1,  // 玩家受伤、Boss 死亡、古建濒危
    PRI_IMPORTANT: 2,  // 技能释放、怪物受击/死亡
    PRI_NORMAL:    3,  // 普攻、古建回血
    PRI_AMBIENT:   4,  // 拾取、UI
  },
  pitchVar: {
    subBass:  0.02,
    impact:   0.05,
    lightAttack: 0.10,
    pickup:   0.15,
    ui:       0.03,
  },
  skillPower: {
    levels: [
      { layers: 2, durationMs: 150, volMul: 1.0, transientBoost: 1.0 },
      { layers: 3, durationMs: 220, volMul: 1.2, transientBoost: 1.0 },
      { layers: 3, durationMs: 280, volMul: 1.4, transientBoost: 1.5 },
    ],
  },
} as const;

export const SKILL_AUDIO: Record<SkillId, {
  theme: string;
  primaryFreq: [number, number];
  bodyFreq: [number, number];
  bodyType: 'triangle' | 'sawtooth' | 'square' | 'sine';
  noiseLowpass: number;
  noiseHighpass: number;
  crackFilter: number;
  crackQ: number;
  travel?: { archetype: string; startFreq: number; endFreq: number; duration: number; volume: number; };
}> = {
  wood_reinforce: {
    theme: 'wood',
    primaryFreq: [200, 80], bodyFreq: [150, 100], bodyType: 'triangle',
    noiseLowpass: 300, noiseHighpass: 150, crackFilter: 1200, crackQ: 2,
    travel: { archetype: 'whoosh', startFreq: 2000, endFreq: 400, duration: 0.7, volume: 0.08 },
  },
  stone_repair: {
    theme: 'stone',
    primaryFreq: [60, 30], bodyFreq: [120, 80], bodyType: 'sawtooth',
    noiseLowpass: 400, noiseHighpass: 100, crackFilter: 2000, crackQ: 3,
  },
  waterproof: {
    theme: 'water',
    primaryFreq: [800, 600], bodyFreq: [200, 150], bodyType: 'sine',
    noiseLowpass: 600, noiseHighpass: 200, crackFilter: 1500, crackQ: 1,
    travel: { archetype: 'hiss', startFreq: 4000, endFreq: 1200, duration: 0.5, volume: 0.06 },
  },
  insect_control: {
    theme: 'insect',
    primaryFreq: [100, 60], bodyFreq: [300, 200], bodyType: 'triangle',
    noiseLowpass: 2500, noiseHighpass: 800, crackFilter: 3000, crackQ: 4,
  },
  painting_restore: {
    theme: 'paint',
    primaryFreq: [1000, 1400], bodyFreq: [1500, 1800], bodyType: 'sine',
    noiseLowpass: 5000, noiseHighpass: 2000, crackFilter: 5000, crackQ: 2,
    travel: { archetype: 'buzz', startFreq: 600, endFreq: 200, duration: 0.6, volume: 0.08 },
  },
  repair_field: {
    theme: 'repair',
    primaryFreq: [620, 820], bodyFreq: [220, 160], bodyType: 'sine',
    noiseLowpass: 900, noiseHighpass: 120, crackFilter: 1800, crackQ: 1,
  },
  whirlwind_slash: {
    theme: 'wind',
    primaryFreq: [720, 300], bodyFreq: [180, 120], bodyType: 'triangle',
    noiseLowpass: 2200, noiseHighpass: 700, crackFilter: 2600, crackQ: 2,
    travel: { archetype: 'whoosh', startFreq: 3000, endFreq: 600, duration: 0.55, volume: 0.10 },
  },
  chain_lightning: {
    theme: 'lightning',
    primaryFreq: [1400, 500], bodyFreq: [2200, 900], bodyType: 'square',
    noiseLowpass: 4200, noiseHighpass: 1200, crackFilter: 5200, crackQ: 4,
    travel: { archetype: 'crackle', startFreq: 800, endFreq: 2000, duration: 0.25, volume: 0.10 },
  },
} as const;

// ============================================================
// Batch 3/4 — 技能反馈映射表（Cast + Hit 音效/特效统一入口）
// ============================================================

export interface SkillFeedbackProfile {
  castSound: string;   // SoundManager 方法名
  castVFX: string;     // VFX 方法名
  hitSound?: string;   // SoundManager 命中方法名（纯治疗技能无命中）
  hitVFX?: string;     // VFX 命中方法名
}

export const SKILL_FEEDBACK_MAP: Record<SkillId, SkillFeedbackProfile> = {
  wood_reinforce: {
    castSound: 'skillWood',    castVFX: 'skillWood',
    hitSound:  'skillWoodHit', hitVFX:   'woodImpact',
  },
  stone_repair: {
    castSound: 'skillStone',   castVFX: 'skillStone',
    hitSound:  'skillStoneHit',hitVFX:   'stonePulse',
  },
  waterproof: {
    castSound: 'skillWater',   castVFX: 'skillWater',
    hitSound:  'skillWaterHit',hitVFX:   'waterImpact',
  },
  insect_control: {
    castSound: 'skillInsect',  castVFX: 'skillInsect',
    hitSound:  'skillInsectHit',hitVFX:  'insectSpore',
  },
  painting_restore: {
    castSound: 'skillPaint',   castVFX: 'skillPaint',
    hitSound:  'skillPaintHit',hitVFX:   'paintImpact',
  },
  repair_field: {
    castSound: 'skillRepairField', castVFX: 'skillRepairField',
    // 纯治疗技能，无 hitSound/hitVFX
  },
  whirlwind_slash: {
    castSound: 'skillWhirlwind',   castVFX: 'skillWhirlwind',
    hitSound:  'skillWhirlwindHit',hitVFX:   'whirlwindHit',
  },
  chain_lightning: {
    castSound: 'skillLightning',    castVFX: 'skillLightningCast',
    hitSound:  'skillLightningHit', hitVFX:   'lightningImpact',
  },
};

export const MONSTER_DEATH_AUDIO: Record<MonsterType, {
  thumpFreq: number; bodyFreq: number; crunchHighpass: number;
  duration: number; volume: number;
}> = {
  termite:     { thumpFreq: 100, bodyFreq: 300, crunchHighpass: 1200, duration: 0.25, volume: 0.08 },
  wind:        { thumpFreq: 60,  bodyFreq: 200, crunchHighpass: 800,  duration: 0.3,  volume: 0.07 },
  acid_rain:   { thumpFreq: 80,  bodyFreq: 250, crunchHighpass: 1000, duration: 0.28, volume: 0.06 },
  fire:        { thumpFreq: 70,  bodyFreq: 180, crunchHighpass: 1500, duration: 0.22, volume: 0.09 },
  freeze_thaw: { thumpFreq: 50,  bodyFreq: 150, crunchHighpass: 600,  duration: 0.35, volume: 0.07 },
} as const;

// ============================================================
// Batch 3 — 元素颜色体系（命中反馈 + 粒子 + 伤害数字统一）
// ============================================================

/** 怪物类型 → 元素反馈颜色映射
 *  参照 Death Must Die 9 神体系 + Diablo 4 元素辨识设计
 *  flash: 命中闪光色 = lerp(elementColor, white, 0.7)
 *  particles: 粒子色阶（深→浅）
 *  damageColor: 浮动数字 CSS 色
 */
export const ELEMENT_COLORS: Record<MonsterType, {
  flash: number;
  particles: number[];
  damageColor: string;
  theme: 'physical' | 'fire' | 'ice' | 'nature';
}> = {
  termite: {
    flash: 0xEEEEEE,
    particles: [0xDDDDDD, 0xCCBB99, 0xFFFFFF],
    damageColor: '#DDDDDD',
    theme: 'physical',
  },
  wind: {
    flash: 0xEEEEDD,
    particles: [0xDDCC88, 0xEEEECC, 0xFFFFFF],
    damageColor: '#DDCC88',
    theme: 'physical',
  },
  acid_rain: {
    flash: 0xAAFFAA,
    particles: [0x44CC44, 0x66EE66, 0xAAFFAA],
    damageColor: '#66EE66',
    theme: 'nature',
  },
  fire: {
    flash: 0xFFAA66,
    particles: [0xFF6633, 0xFF8844, 0xFFCC44, 0xFF4444],
    damageColor: '#FF8844',
    theme: 'fire',
  },
  freeze_thaw: {
    flash: 0xAADDFF,
    particles: [0x6699FF, 0x88BBFF, 0xCCEEFF, 0xFFFFFF],
    damageColor: '#88BBFF',
    theme: 'ice',
  },
} as const;

// ============================================================
// Batch 3 — 伤害数字信息层级
// ============================================================

export interface DamageNumberStyle {
  color: string;
  size: string;
  scale: number;
  prefix?: string;
  suffix?: string;
}

export const DAMAGE_NUMBER_CONFIG = {
  normal:  { color: '#FFFFFF', size: '14px', scale: 1.0 },
  heavy:   { color: '#FFAA44', size: '16px', scale: 1.2 },
  crit:    { color: '#FF6600', size: '20px', scale: 1.5, suffix: '!' },
  kill:    { color: '#FF4444', size: '18px', scale: 1.3, prefix: '击杀 ' },
  boss:    { color: '#CC44FF', size: '22px', scale: 1.4 },
  heal:    { color: '#44FF66', size: '14px', scale: 1.0, prefix: '+' },
} as const;

export type DamageNumberTier = keyof typeof DAMAGE_NUMBER_CONFIG;

// ============================================================
// Batch 3 — 屏震创伤累积系统（参照 Nuclear Throne）
// ============================================================

export const SHAKE_TRAUMA_CONFIG = {
  /** 每点伤害增加的创伤值 */
  traumaPerDamage: 0.008,
  /** 每帧衰减系数 */
  decayPerFrame: 0.88,
  /** 最大创伤（对应最大屏震幅度） */
  maxTrauma: 0.025,
  /** 最小有效创伤（低于此值归零） */
  minTrauma: 0.0005,
  /** 创伤→屏震强度映射系数 */
  intensityScale: 1.0,
} as const;

// ============================================================
// Batch 3 — CombatFeel 扩展配置
// ============================================================

export const COMBAT_FEEL_EXTRA = {
  /** Hit Stop 期间返回的最小有效 delta（原来是硬编码 0.05） */
  minEffectiveDelta: 0.05,
  /** 扩散环基础缩放 */
  shockwaveBaseScale: 0.8,
  /** 扩散环伤害映射上限对应的伤害值 */
  shockwaveMaxDamageRef: 80,
  /** 暴击扩散环倍数 */
  shockwaveCritMult: 2.0,
  /** Boss 扩散环倍数 */
  shockwaveBossMult: 3.0,
} as const;

// ============================================================
// Batch 3/4 — VFX 性能控制
// ============================================================

export const VFX_PERF = {
  /** burst() 全局同时存活粒子数上限 */
  maxAliveParticles: 200,
  /** 低于此伤害的命中不生成粒子 burst（仅浮动数字） */
  hitParticleMinDamage: 8,
} as const;
