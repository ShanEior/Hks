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
    { level: 1, name: '木构加固', cooldown: 5, damage: 20, range: 80, repairType: [], repairAmount: 0 },
    { level: 2, name: '梁柱补强', cooldown: 5, damage: 30, range: 80, repairType: ['wood'], repairAmount: 1 },
    { level: 3, name: '榫卯强化', cooldown: 5, damage: 45, range: 120, repairType: ['wood'], repairAmount: 2, widthMultiplier: 1.5 },
  ],
  stone_repair: [
    { level: 1, name: '石材修补', cooldown: 6, damage: 18, range: 150, repairType: [], repairAmount: 0 },
    { level: 2, name: '石粉填补', cooldown: 6, damage: 28, range: 180, repairType: [], repairAmount: 0 },
    { level: 3, name: '表层加固', cooldown: 6, damage: 40, range: 180, repairType: ['stone'], repairAmount: 2, knockbackForce: 200 },
  ],
  waterproof: [
    { level: 1, name: '防水封护', cooldown: 7, damage: 15, range: 180, repairType: [], repairAmount: 0 },
    { level: 2, name: '排水导流', cooldown: 7, damage: 22, range: 180, repairType: [], repairAmount: 0, bonusDamageVs: 'acid_rain', bonusDamageMultiplier: 2 },
    { level: 3, name: '防渗保护层', cooldown: 7, damage: 22, range: 210, repairType: ['stone', 'tile'], repairAmount: 2, bonusDamageVs: 'acid_rain', bonusDamageMultiplier: 2 },
  ],
  insect_control: [
    { level: 1, name: '防虫处理', cooldown: 6, damage: 8, range: 120, repairType: [], repairAmount: 0, zoneDuration: 3 },
    { level: 2, name: '虫害清查', cooldown: 6, damage: 8, range: 120, repairType: [], repairAmount: 0, zoneDuration: 4, bonusDamageVs: 'termite', bonusDamageMultiplier: 2 },
    { level: 3, name: '木构驱虫', cooldown: 6, damage: 8, range: 150, repairType: ['wood'], repairAmount: 1, zoneDuration: 4, bonusDamageVs: 'termite', bonusDamageMultiplier: 2 },
  ],
  painting_restore: [
    { level: 1, name: '彩绘修复', cooldown: 4, damage: 20, range: 0, repairType: [], repairAmount: 0 },
    { level: 2, name: '颜料补绘', cooldown: 4, damage: 30, range: 60, repairType: [], repairAmount: 0 },
    { level: 3, name: '壁画护色', cooldown: 4, damage: 40, range: 0, repairType: ['painting'], repairAmount: 2, projectileBounce: true },
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

/** 像素风字体预设 — 统一用 monospace 偶数字号，在 pixelArt:true 下足够锐利 */
export const FONT = {
  tiny:     { fontFamily: 'monospace', fontSize: '8px' },
  small:    { fontFamily: 'monospace', fontSize: '10px' },
  body:     { fontFamily: 'monospace', fontSize: '12px' },
  large:    { fontFamily: 'monospace', fontSize: '16px' },
  title:    { fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold' },
  huge:     { fontFamily: 'monospace', fontSize: '32px', fontStyle: 'bold' },
} as const;

/** 像素纹理的单位块大小（与 ArtGen.ts 中的 PX 一致） */
export const UI_PX = 2;

/** 结构血条通用尺寸 */
export const STRUCT_BAR = { w: 160, h: 14, gap: 10 } as const;

/** 升级卡片尺寸 */
export const LEVELUP_CARD = { w: 220, h: 210 } as const;
