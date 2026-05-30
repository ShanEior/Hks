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
    hp: 20, speed: 2.8, damage: 3,
    attackInterval: 1000,
    attackStructures: ['wood'],
    color: 0xDDDDDD, radius: 8, expDrop: 1,
  },
  wind: {
    type: 'wind', name: '风蚀怪',
    hp: 35, speed: 3.2, damage: 5,
    attackInterval: 1200,
    attackStructures: ['stone', 'painting'],
    color: 0xDDCC88, radius: 10, expDrop: 2,
  },
  acid_rain: {
    type: 'acid_rain', name: '酸雨怪',
    hp: 45, speed: 1.8, damage: 6,
    attackInterval: 2000,
    attackStructures: ['stone', 'tile'],
    color: 0x44CC44, radius: 11, expDrop: 3,
  },
  fire: {
    type: 'fire', name: '火焰怪',
    hp: 50, speed: 2.4, damage: 8,
    attackInterval: 1500,
    attackStructures: ['wood', 'painting'],
    color: 0xFF6633, radius: 12, expDrop: 4,
  },
  freeze_thaw: {
    type: 'freeze_thaw', name: '冻融怪',
    hp: 80, speed: 1.4, damage: 10,
    attackInterval: 2000,
    attackStructures: ['stone', 'tile'],
    color: 0x6699FF, radius: 14, expDrop: 5,
  },
};

// ---- 怪物生成 ----
export const SPAWN_DISTANCE = 700; // 从地图中心算起的生成距离
export const INITIAL_SPAWN_INTERVAL = 2000; // ms

// ---- 经验 ----
export const BASE_EXP_TO_LEVEL = 10;
export const EXP_PER_LEVEL = 5; // ExpToNext = BASE + Level * EXP_PER_LEVEL
export const PICKUP_RANGE = 90; // 经验球自动吸附范围 (spec 1.5 * 60)

// ---- 技能 ----
export type SkillId =
  | 'wood_reinforce'
  | 'stone_repair'
  | 'waterproof'
  | 'insect_control'
  | 'painting_restore';

export interface SkillLevelConfig {
  level: number;
  name: string;
  cooldown: number;         // 秒
  damage: number;
  range: number;            // 圆形半径 / 投射物宽度
  repairType: StructureType[];
  repairAmount: number;
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
  widthMultiplier?: number;
  bonusDamageVs?: MonsterType;
  bonusDamageMultiplier?: number;
  knockbackForce?: number;
  projectileBounce?: boolean;
  zoneDuration?: number;
}

export const SKILL_CONFIGS: Record<SkillId, SkillLevelConfig[]> = {
  wood_reinforce: [
    { level: 1, name: '木构加固', cooldown: 4, damage: 35, range: 100, repairType: [], repairAmount: 0 },
    { level: 2, name: '梁柱补强', cooldown: 4, damage: 55, range: 100, repairType: ['wood'], repairAmount: 2 },
    { level: 3, name: '榫卯强化', cooldown: 3.5, damage: 80, range: 140, repairType: ['wood'], repairAmount: 4, widthMultiplier: 2 },
  ],
  stone_repair: [
    { level: 1, name: '石材修补', cooldown: 5, damage: 30, range: 160, repairType: [], repairAmount: 0 },
    { level: 2, name: '石粉填补', cooldown: 5, damage: 48, range: 200, repairType: [], repairAmount: 0 },
    { level: 3, name: '表层加固', cooldown: 4.5, damage: 70, range: 220, repairType: ['stone'], repairAmount: 3, knockbackForce: 300 },
  ],
  waterproof: [
    { level: 1, name: '防水封护', cooldown: 6, damage: 25, range: 190, repairType: [], repairAmount: 0 },
    { level: 2, name: '排水导流', cooldown: 6, damage: 40, range: 200, repairType: [], repairAmount: 0, bonusDamageVs: 'acid_rain', bonusDamageMultiplier: 2.5 },
    { level: 3, name: '防渗保护层', cooldown: 5.5, damage: 45, range: 240, repairType: ['stone', 'tile'], repairAmount: 3, bonusDamageVs: 'acid_rain', bonusDamageMultiplier: 3 },
  ],
  insect_control: [
    { level: 1, name: '防虫处理', cooldown: 5, damage: 12, range: 130, repairType: [], repairAmount: 0, zoneDuration: 3 },
    { level: 2, name: '虫害清查', cooldown: 5, damage: 14, range: 140, repairType: [], repairAmount: 0, zoneDuration: 4.5, bonusDamageVs: 'termite', bonusDamageMultiplier: 2.5 },
    { level: 3, name: '木构驱虫', cooldown: 4.5, damage: 18, range: 170, repairType: ['wood'], repairAmount: 2, zoneDuration: 5, bonusDamageVs: 'termite', bonusDamageMultiplier: 3 },
  ],
  painting_restore: [
    { level: 1, name: '彩绘修复', cooldown: 3.5, damage: 30, range: 0, repairType: [], repairAmount: 0 },
    { level: 2, name: '颜料补绘', cooldown: 3, damage: 50, range: 70, repairType: [], repairAmount: 0 },
    { level: 3, name: '壁画护色', cooldown: 2.5, damage: 70, range: 80, repairType: ['painting'], repairAmount: 3, projectileBounce: true },
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
];

// ---- 波次阶段（spec 13.4） ----
export interface WaveStage {
  timeStart: number;
  timeEnd: number;
  spawnInterval: number; // ms
  monsters: { type: MonsterType; weight: number }[];
  countPerWave: number;
}

export const WAVE_STAGES: WaveStage[] = [
  // 0-30s 教学期：仅白蚁，极慢
  { timeStart: 0,  timeEnd: 45,  spawnInterval: 4000, monsters: [{type:'termite',weight:100}], countPerWave: 1 },
  // 45-90s 加入风蚀
  { timeStart: 45, timeEnd: 90,  spawnInterval: 2500, monsters: [{type:'termite',weight:85},{type:'wind',weight:15}], countPerWave: 3 },
  // 90-150s 加入酸雨
  { timeStart: 90, timeEnd: 150, spawnInterval: 2000, monsters: [{type:'termite',weight:60},{type:'wind',weight:25},{type:'acid_rain',weight:15}], countPerWave: 4 },
  // 150-210s 加入火焰
  { timeStart: 150,timeEnd: 210, spawnInterval: 1700, monsters: [{type:'termite',weight:45},{type:'wind',weight:20},{type:'acid_rain',weight:20},{type:'fire',weight:15}], countPerWave: 5 },
  // 210-270s 加入冻融，压力明显
  { timeStart: 210,timeEnd: 270, spawnInterval: 1400, monsters: [{type:'termite',weight:35},{type:'wind',weight:20},{type:'acid_rain',weight:20},{type:'fire',weight:15},{type:'freeze_thaw',weight:10}], countPerWave: 6 },
  // 270-300s 全力输出
  { timeStart: 270,timeEnd: 300, spawnInterval: 1100, monsters: [{type:'termite',weight:30},{type:'wind',weight:18},{type:'acid_rain',weight:18},{type:'fire',weight:18},{type:'freeze_thaw',weight:16}], countPerWave: 8 },
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
  light:   { freezeMs: 33  },
  medium:  { freezeMs: 66  },
  heavy:   { freezeMs: 100 },
  ultra:   { freezeMs: 150 },

  cooldownMs: 150,
} as const;

export type HitStopTier = keyof typeof HIT_STOP_CONFIG & ('light' | 'medium' | 'heavy' | 'ultra');

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
}> = {
  wood_reinforce: {
    theme: 'wood',
    primaryFreq: [200, 80], bodyFreq: [150, 100], bodyType: 'triangle',
    noiseLowpass: 300, noiseHighpass: 150, crackFilter: 1200, crackQ: 2,
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
  },
} as const;

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
