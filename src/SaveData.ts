// ── localStorage 存档 / 最高分 ──

export interface GameRecord {
  killCount: number;
  survivalTime: number;   // 秒
  level: number;
  bossKilled: boolean;
  victory: boolean;
  date: string;           // ISO 日期字符串
}

export interface SaveData {
  highScore: GameRecord | null;
  bestKillCount: number;
  bestSurvivalTime: number;
  bestLevel: number;
  hasWon: boolean;
  hasKilledBoss: boolean;
  totalGames: number;
}

const STORAGE_KEY = 'shanxi_arch_defense_save';

function defaultSave(): SaveData {
  return {
    highScore: null,
    bestKillCount: 0,
    bestSurvivalTime: 0,
    bestLevel: 0,
    hasWon: false,
    hasKilledBoss: false,
    totalGames: 0,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    // 合并默认值，防止旧存档缺少字段
    const def = defaultSave();
    return { ...def, ...parsed };
  } catch {
    return defaultSave();
  }
}

export function saveRecord(record: GameRecord): SaveData {
  const prev = loadSave();
  prev.totalGames++;

  // 更新各项最佳
  if (record.killCount > prev.bestKillCount) {
    prev.bestKillCount = record.killCount;
  }
  if (record.survivalTime > prev.bestSurvivalTime) {
    prev.bestSurvivalTime = record.survivalTime;
  }
  if (record.level > prev.bestLevel) {
    prev.bestLevel = record.level;
  }
  if (record.victory) {
    prev.hasWon = true;
  }
  if (record.bossKilled) {
    prev.hasKilledBoss = true;
  }

  // 判断是否新高分（综合评分：击杀数 × 10 + 存活时间 × 2 + 等级 × 5 + Boss + 胜利）
  const score = (r: GameRecord) =>
    r.killCount * 10 + r.survivalTime * 2 + r.level * 5 + (r.bossKilled ? 50 : 0) + (r.victory ? 100 : 0);

  if (!prev.highScore || score(record) > score(prev.highScore)) {
    prev.highScore = record;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
  } catch {
    // localStorage 满了或不可用，静默失败
  }

  return prev;
}

/** 清除存档 */
export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
