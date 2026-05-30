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
    color: 0xDDDDDD, radius: 8, expDrop: 3,
  },
  wind: {
    type: 'wind', name: '风蚀怪',
    hp: 12, speed: 0.6, damage: 3,
    attackInterval: 1200,
    attackStructures: ['stone', 'painting'],
    color: 0xDDCC88, radius: 10, expDrop: 5,
  },
  acid_rain: {
    type: 'acid_rain', name: '酸雨怪',
    hp: 15, speed: 0.4, damage: 3,
    attackInterval: 2000,
    attackStructures: ['stone', 'tile'],
    color: 0x44CC44, radius: 11, expDrop: 6,
  },
  fire: {
    type: 'fire', name: '火焰怪',
    hp: 18, speed: 0.7, damage: 4,
    attackInterval: 1500,
    attackStructures: ['wood', 'painting'],
    color: 0xFF6633, radius: 12, expDrop: 8,
  },
  freeze_thaw: {
    type: 'freeze_thaw', name: '冻融怪',
    hp: 25, speed: 0.3, damage: 5,
    attackInterval: 2000,
    attackStructures: ['stone', 'tile'],
    color: 0x6699FF, radius: 14, expDrop: 10,
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
  hpGrowthPerMin: 0.35,      // 5分钟时 ≈ 2.75x
  damageGrowthPerMin: 0.20,  // 5分钟时 ≈ 2.0x
  speedGrowthPerMin: 0.08,   // 5分钟时 ≈ 1.4x
  expGrowthPerMin: 0.35,     // 和经验挂钩，5分钟时 ≈ 2.75x
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
