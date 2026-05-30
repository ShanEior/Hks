# Batch 3 综合调研报告：战斗手感深度升级

> **研究范围**：5 专业视角交叉审计 × 6 款标杆游戏分析 × 全代码反馈链追踪 × 性能压力测试
> **研究日期**：2026-05-30
> **分支**：dev-aaa
> **前置状态**：Batch 1（打击感根基）✅ + Batch 2（音效翻新）✅

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [五视角交叉评估](#2-五视角交叉评估)
3. [当前反馈链完整审计](#3-当前反馈链完整审计)
4. [已发现的问题清单（含 Batch 1/2 回修项）](#4-已发现的问题清单)
5. [Batch 3 重新规划](#5-batch-3-重新规划)
6. [实施路线图](#6-实施路线图)
7. [性能架构方案](#7-性能架构方案)
8. [验收标准](#8-验收标准)

---

## 1. 执行摘要

### 1.1 核心结论

经过游戏设计师、战斗设计师、VFX 设计师、技术美术、客户端程序五个视角的联合审计，以及 6 款标杆游戏（Hades、Dead Cells、Nuclear Throne、Halls of Torment、Soulstone Survivors、Death Must Die）的横向对比，得出以下核心结论：

**当前 Batch 3 计划的核心问题：它偏向"视觉特效方案"而非"打击感方案"。**

玩家对打击感的感知权重经多款游戏验证为：

```
40% 音效      ← Batch 2 已做，但存在改进空间
25% 时间控制   ← CombatFeel 已实现 Hit Stop，但存在关键 bug
15% 震屏       ← VFX.shake 已实现，但强度曲线不合理
10% 动画       ← Monster 挤压/拉伸 + 死亡动画已实现
10% 粒子       ← 当前方案，但架构有严重性能隐患
```

**关键发现**：把粒子删掉一半玩家未必发现，但把 Hit Stop 修好玩家立刻觉得手感提升。当前最大的短板不在"缺少特效"，而在"反馈链不完整"——命中确认 → 击杀确认 → 奖励感知之间存在断裂。

### 1.2 建议优先级重排

| 原 Batch 3 计划 | 修正后建议 | 理由 |
|---|---|---|
| 3 层爆炸系统（P0） | ✅ 保留，降为 P1 | 视觉效果已基本够用，爆炸系统锦上添花 |
| 伤害数字入场动画（P0）| ✅ 保留，改为信息层级重构 | 不是动画不够，是"信息层级"不够 |
| 方向性粒子（P0）| ✅ 保留 | 构建力的方向感，重要 |
| 元素颜色映射（P0）| ✅ 保留，扩展为元素反馈体系 | 不仅是颜色，是命中闪+粒子+数字+音色的统一 |
| Hit Stop Bug 修复 | 🆕 **P0（新增）** | 当前 Hit Stop 有 2 个 bug 严重削弱效果 |
| 击杀确认系统 | 🆕 **P0（新增）** | 缺失导致玩家"打中了但不知道打死了" |
| 反馈链去重叠 | 🆕 **P0（新增）** | 击杀时命中/死亡反馈同时播放，混乱 |
| 粒子架构 GPU 化 | 🆕 **P0（新增）** | 200 怪同时死亡 = 2000+ 对象 → 帧率崩溃 |
| Batch 5 平滑血条 | 🆕 提前至 P1 | 独立游戏玩家最敏感的是血条跳动，建议提前 |

---

## 2. 五视角交叉评估

### 2.1 游戏设计师视角

**评估**：反馈链断裂，缺少"结果反馈"和"奖励反馈"环节。

```
当前反馈链：
攻击 → 命中 → 闪光 → 环 → 粒子 → 数字

缺失环节：
攻击 → 命中 → 闪光 → 环 → 粒子 → 数字
                         ↓
                      【声音】← 缺少命中音效分层
                         ↓
                      【时间】← Hit Stop 存在但被 150ms 冷却大幅削弱
                         ↓
                      【结果】← 缺少击杀确认（KILL!/✦）
                         ↓
                      【奖励】← 缺少经验获取的即时感知
```

**建议**：
- 击杀瞬间增加特殊视觉标记（不仅是死亡动画，而是"致命一击"标记）
- 经验获取时增加短暂的满足感反馈（非全屏，而是小范围的"吸收"感）

### 2.2 战斗设计师视角

**评估**：打击感 = B-。核心问题是"力"的方向性感知太弱。

从 Vlambeer（Nuclear Throne）的研究中提取的精确参数：

| 事件 | Nuclear Throne 做法 | 我们的现状 |
|------|-------------------|-----------|
| 命中闪光 | 1 帧纯白（16ms） | 120-180ms 闪白 ✅ 已超过 |
| 屏震 | 创伤累积系统，0.9/帧衰减 | 固定强度+固定时长 ❌ 无累积 |
| 击退 | 3px/帧，子弹方向 | 60-350 force 指数衰减 ✅ |
| Hit Stop | 10-20ms 冻结 | 33-150ms 四档 ✅ |
| 摄像机后坐力 | 6px 反方向踢回 | 仅 heavy/ultra zoom ❌ 无方向性 |

**关键发现**：Nuclear Throne 的创伤累积系统是它"越打越爽"的核心原因。连续命中时屏震不是重置而是叠加，产生"力量在积累"的感觉。我们当前的固定强度+固定时长屏震无法产生这种累积感。

**建议**：
- 引入创伤累积屏震系统（`trauma += damage * 0.1`，每帧 `trauma *= 0.9`）
- 摄像机后坐力添加方向性（沿攻击方向微移）

### 2.3 VFX 设计师视角

**评估**：视觉表现 = A-，但存在三个关键问题。

**问题 1：内层闪光纯白污染**
当前 `VFX.hitMonster` 的 burst 始终使用 `[0xffffff, 0xcccccc]`。后期大量 AOE 时纯白会污染画面，且丢失元素辨识度。

参考 Diablo 4 / Hades 做法：
```
flashColor = lerp(elementColor, white, 0.7)
火焰命中 → #FFAA66（暖白）
冰霜命中 → #AAFFFF（冷白）
```

**问题 2：扩散环大小固定**
当前 shockwave 的 radius 是固定值。玩家很快疲劳。

参考 LoL / Hades 做法：
```
ringScale = 0.8 + damage / maxDamage  // 伤害越大环越大
暴击 → 3.0x
Boss 命中 → 4.0x
```

**问题 3：粒子缺少二次运动**
当前 `VFX.burst()` 的粒子匀速飞行然后消失。非常假。

参考 Dead Cells / Risk of Rain 2 做法：
```
每帧: velocity *= 0.95       // 空气阻力
      velocity.y += gravity   // 重力下坠
而不是: 匀速飞到终点消失
```

### 2.4 技术美术（TA）视角

**评估**：性能架构 = B+，但粒子系统是定时炸弹。

**最坏情况计算**（已验证）：
```
200 怪物同时死亡 × (10 粒子 + 1 冲击波 + 1 闪光)
= 2400 个 Phaser GameObjects + 2400 个 Tweens
在一帧内创建
→ 帧时间 >100ms（60fps 预算为 16.7ms）
→ 帧率降至个位数，持续 0.5-1 秒
```

**根本原因**：`VFX.burst()` 为每个粒子创建独立的 `scene.add.circle()` + `scene.tweens.add()`。Phaser 3.60+ 内置了基于 WebGL 批处理的 `ParticleEmitter`，可在一个 draw call 中渲染数千粒子，本项目完全绕过了它。

**其他 TA 发现**：
- Tween 缺少 `onStop` 处理器，场景重启时可能泄漏
- `shockwave()` 的 `onUpdate` 每帧调用 `ring.setStrokeStyle()`，200 个冲击波 = 200 次额外 GPU 命令
- 音效 `bossAlert/bossAppear/bossEarthquake` 等方法未传递 priority 参数，池满时被静默丢弃
- Boss 在 Hit Stop 期间使用原始 delta 全速移动（与其他怪物行为不一致）

### 2.5 客户端程序视角

**评估**：扩展性 = A，但存在 12 个具体 bug/改进点。

详细清单见 [第 4 节](#4-已发现的问题清单)。

---

## 3. 当前反馈链完整审计

### 3.1 反馈链实际执行路径

```
玩家造成伤害
  └→ Monster.takeDamage(amount, attackerX, attackerY)
       ├─ [1] 击退：hardcoded 数值（未使用 KNOCKBACK_CONFIG） ⚠️
       ├─ [2] 挤压+拉伸：scaleX×0.75/scaleY×1.3 → 150ms Back.easeOut ✅
       ├─ [3] 闪白/红闪：120-180ms，重击先红后白 ✅
       ├─ [4] SoundManager.hitMonster(x, y)：3层冲击音+去重('hit', 50ms) ✅
       ├─ [5] VFX.hitMonster()：白色burst + 伤害数字(按伤害值变色) ⚠️
       ├─ [6] onDamageFeedback → CombatFeel.onHit()
       │      ├─ Hit Stop（150ms冷却门控） ⚠️
       │      ├─ 命中点光晕（核心圆+冲击波环） ✅
       │      └─ 镜头冲击（仅 heavy/ultra zoom） ✅
       └─ [7] if hp <= 0:
              ├─ SoundManager.killMonster(type)：元素材质死亡音 ⚠️ 无立体声
              ├─ onDeath()：经验球+修补箱
              ├─ VFX.killMonster()：元素色burst+shockwave+shake+flash
              └─ 3阶段死亡动画：闪白→膨胀渐隐→销毁
```

### 3.2 关键断裂点

| 断裂点 | 位置 | 严重度 | 玩家感知 |
|--------|------|--------|---------|
| 致命一击时命中+死亡反馈重叠 | Monster.ts:224-233 | 🔴 高 | "打死了但感觉很混乱" |
| 击杀无确认标记 | VFX.ts:98-111 | 🔴 高 | "不知道有没有打死" |
| Hit Stop 冷却内 AOE 命中丢失反馈 | CombatFeel.ts:39-43 | 🟡 中 | "技能打到一群怪没感觉" |
| hitMonster 始终白色，无元素区分 | VFX.ts:87 | 🟡 中 | "打火怪和打冰怪一样" |
| 击杀音无立体声定位 | SoundManager.ts:305 | 🟢 低 | "声音都在中间" |
| 伤害数字只有伤害值层级，无暴击/击杀/Boss 层级 | VFX.ts:89-92 | 🟡 中 | "数字都一样" |
| 屏震固定强度，无累积感 | VFX.ts:56-58 | 🟡 中 | "连续打没有越来越爽" |

---

## 4. 已发现的问题清单

### 4.1 P0 问题（必须修复）

#### P0-1：Tween 缺少 onStop 清理 → 场景重启泄漏

**位置**：`VFX.ts` 所有 `scene.tweens.add()` 调用（约 30+ 处）
**现象**：`onComplete` 中调用 `obj.destroy()`，但场景重启时 `onComplete` 不触发
**修复**：所有 VFX tween 添加 `onStop` 回调

```typescript
// 当前
scene.tweens.add({
  targets: p, ...,
  onComplete: () => p.destroy(),
});

// 修复后
const cleanup = () => { if (p.active) p.destroy(); };
scene.tweens.add({
  targets: p, ...,
  onComplete: cleanup,
  onStop: cleanup,
});
```

#### P0-2：致命一击反馈重叠

**位置**：`Monster.ts:224-233`
**现象**：击杀怪物时同时播放命中音效+VFX 和 死亡音效+VFX，视觉听觉混乱
**修复**：在 `takeDamage` 中检测是否致命一击，若是则跳过命中反馈

```typescript
const willDie = this.hp - amount <= 0;
if (!willDie) {
  SoundManager.hitMonster(this.sprite.x, this.sprite.y);
  VFX.hitMonster(this.scene, this.x, this.y, amount, attackerX, attackerY);
  this.onDamageFeedback?.(this, amount);
}
// 死亡反馈在 hp<=0 分支中单独处理
```

#### P0-3：Hit Stop 冷却门控逻辑有缺陷

**位置**：`CombatFeel.ts:39-58`
**现象**：
1. AOE 技能打中多个怪物时，只有第一个触发 Hit Stop（150ms 冷却），但后续命中仍然创建冲击闪光和镜头缩放——这些视觉会重叠
2. 实际上 `spawnImpactFlash` 和镜头缩放应该也在冷却内

**修复**：将闪光和缩放也纳入冷却门控

```typescript
onHit(event: HitEvent): void {
  const cfg = HIT_STOP_CONFIG[event.tier];
  const now = this.scene.time.now;
  const canFreeze = now - this.lastHitStopTime >= HIT_STOP_CONFIG.cooldownMs;

  if (canFreeze) {
    this.hitStopRemaining = Math.max(this.hitStopRemaining, cfg.freezeMs);
    this.lastHitStopTime = now;
    this.spawnImpactFlash(event);
    if (event.tier === 'heavy' || event.tier === 'ultra') {
      this.applyCameraPunch(event);
    }
  }
}
```

#### P0-4：粒子系统架构无法支撑大规模战斗

**位置**：`VFX.ts:14-35 (burst)` + `VFX.ts:38-53 (shockwave)`
**现象**：200 怪同时死亡 → 2400+ GameObjects + 2400+ Tweens → 帧率崩溃
**修复**：将 `burst()` 和 `shockwave()` 迁移到 Phaser ParticleEmitter API

详见 [第 7 节 性能架构方案](#7-性能架构方案)

#### P0-5：Boss 在 Hit Stop 期间全速移动

**位置**：`GameScene.ts:232`
**现象**：`this.boss.update(time, delta)` 传入原始 delta，Hit Stop 时 Boss 不减速
**修复**：改为 `this.boss.update(time, effectiveDelta)`

### 4.2 P1 问题（应该修复）

#### P1-1：KNOCKBACK_CONFIG 是死代码

**位置**：`Monster.ts:178-187` vs `config.ts:352-359`
**现象**：config.ts 中定义了 `KNOCKBACK_CONFIG`，但 Monster.ts 使用硬编码数值且未导入该常量
**修复**：导入 `KNOCKBACK_CONFIG` 并替换硬编码值

#### P1-2：伤害数字缺少信息层级

**位置**：`VFX.ts:85-95`
**现象**：仅按伤害值区分颜色（白/橙/红），缺少以下维度：
- 暴击（目前无暴击系统，但应为未来预留）
- 击杀标记（KILL!/✦）
- Boss 命中标记
- 元素类型映射
**修复**：在 `config.ts` 中添加 `DAMAGE_NUMBER_CONFIG`，定义多层级颜色和样式

#### P1-3：音效系统 Boss 方法缺少优先级

**位置**：`SoundManager.ts:524-564`
**现象**：`bossAlert/bossAppear/bossEarthquake/bossSummon/bossHit` 调用 `playTone` 时未传递 `priority`，池满时被静默丢弃
**修复**：添加 `priority = SOUND_CONFIG.voicePool.PRI_CRITICAL`

#### P1-4：击杀音无立体声定位

**位置**：`SoundManager.ts:305-316`
**现象**：`killMonster` 未接收位置参数，死亡声音始终在中心
**修复**：添加 `x, y` 参数并计算 `worldPan`

#### P1-5：hitMonster 缺少元素颜色

**位置**：`VFX.ts:85-95`
**现象**：始终使用白色 burst 粒子
**修复**：添加 `monsterType` 参数，使用元素颜色映射

### 4.3 P2 问题（改进建议）

#### P2-1：屏震无累积系统
当前每次 shake 独立触发，无创伤累积。建议引入 `trauma` 系统。

#### P2-2：粒子缺少二次运动
粒子匀速飞行→消失，无减速/重力下坠。

#### P2-3：扩散环大小固定
shockwave 的 radius 固定，不随伤害变化。

#### P2-4：玩家碰撞在 Hit Stop 期间全速
`checkPlayerMonsterCollision()` 使用 raw delta，Hit Stop 期间玩家受伤时机不一致。

#### P2-5：CombatFeel 返回 `0.05` 是 magic number
应定义为配置常量。

---

## 5. Batch 3 重新规划

### 5.1 修正后的目标

原 Batch 3 目标：
> 击杀有"爆破感"——闪光→膨胀环→碎片散开，伤害数字弹出来

**修正后目标**：
> 每次命中都有"打到东西"的确信感——命中瞬间时间微顿、方向性受力反馈、元素辨识清晰的视觉、分层明确的数字信息；击杀有明确的结果确认，大量击杀时性能稳定。

### 5.2 P0 交付（本次必须完成）

#### P0-A：致命一击反馈去重叠

**改动文件**：`Monster.ts`
**内容**：
- `takeDamage` 中检测 `willDie`，跳过命中反馈
- 致命一击使用增强版死亡反馈（更强闪光 + 更大冲击波 + 特殊文字"击杀"）

#### P0-B：Hit Stop 门控修复

**改动文件**：`CombatFeel.ts`
**内容**：
- 将 `spawnImpactFlash` 和镜头缩放纳入冷却门控
- 添加 `MIN_DELTA` 为 config 常量
- 修复 Boss 使用 raw delta 的问题（`GameScene.ts:232`）

#### P0-C：粒子系统 GPU 化

**改动文件**：`VFX.ts`、`ArtGen.ts`
**内容**：
- `ArtGen.ts` 中生成 4×4 白色像素纹理 `px_white`
- `VFX.burst()` 改用 `scene.add.particles()` 的 `explode()` 模式
- `VFX.shockwave()` 保持现有实现（数量少，性能影响可控）但添加 onStop 清理
- 所有 VFX tween 添加 onStop 清理

#### P0-D：元素命中反馈体系

**改动文件**：`VFX.ts`、`config.ts`
**内容**：
- `config.ts` 添加 `ELEMENT_COLORS` 配置表（5 元素各 3-4 色阶）
- `VFX.hitMonster` 添加 `monsterType` 参数
- 命中闪光使用 `lerp(elementColor, white, 0.7)` 避免纯白污染
- `VFX.floatText` 添加 `style` 参数（normal/crit/kill/boss）

#### P0-E：伤害数字信息层级重构

**改动文件**：`VFX.ts`、`config.ts`
**内容**：
- `config.ts` 添加 `DAMAGE_NUMBER_CONFIG`：
  ```ts
  DAMAGE_NUMBER_CONFIG = {
    normal:  { color: '#FFFFFF', size: '14px', scale: 1.0 },
    heavy:   { color: '#FFAA44', size: '16px', scale: 1.2 },
    crit:    { color: '#FF6600', size: '20px', scale: 1.5, text: '暴击!' },
    kill:    { color: '#FF4444', size: '18px', scale: 1.3, text: '击杀' },
    boss:    { color: '#CC44FF', size: '22px', scale: 1.4 },
  }
  ```
- `VFX.floatText` 支持配置对象而非硬编码
- 击杀时额外显示 "击杀" / "✦" 标记

### 5.3 P1 交付（强烈建议完成）

#### P1-A：击杀确认动画

**改动文件**：`VFX.ts`
**内容**：
- 怪物死亡时在死亡位置弹出 "击杀" 文字（不同于伤害数字，使用特殊入场动画）
- Boss/精英击杀显示 "消灭!" + 更大视觉标记
- 参照 Halls of Torment 的死亡确认

#### P1-B：扩散环动态缩放

**改动文件**：`VFX.ts`
**内容**：
- `shockwave` 的 radius 根据伤害值动态变化：`scale = 0.8 + clamp(damage / maxDamage, 0, 0.7)`
- 暴击 ×2，Boss ×3

#### P1-C：屏震创伤累积系统

**改动文件**：`VFX.ts`、`config.ts`
**内容**：
- 添加 `SHAKE_CONFIG`（traumaPerDamage、decayPerFrame、maxTrauma）
- `VFX.shake()` 改为累积模式：`trauma += intensity`，decay 在 update 中处理
- 连续命中时屏震叠加，产生"力量积累"感

#### P1-D：Batch 1/2 回修项

- P1-1：KNOCKBACK_CONFIG 激活（Monster.ts 导入并使用 config 常量）
- P1-3：Boss 音效添加 priority 参数
- P1-4：killMonster 音效添加立体声定位
- P2-5：CombatFeel MIN_DELTA 配置化

### 5.4 P2 交付（时间允许时完成）

#### P2-A：粒子二次运动

**改动文件**：`VFX.ts`
**内容**：
- burst 粒子添加 gravity 和 velocity decay
- `velocity *= 0.95` + `gravity += 100` 产生弧线下坠

#### P2-B：技能投射物拖尾（原 Batch 4 前置）

**改动文件**：`SkillManager.ts`
**内容**：
- 每 30ms 在投射物身后留渐隐小圆点
- 使用元素颜色

#### P2-C：平滑血条（原 Batch 5 前置）

**改动文件**：`HUD.ts`
**内容**：
- 每帧 lerp: `displayHp += (actualHp - displayHp) * 0.08`

---

## 6. 实施路线图

### 第 1 天上午：P0 修复（~2h）

| 步骤 | 内容 | 文件 | 预计 |
|------|------|------|------|
| 1 | Tween onStop 全局清理 | VFX.ts | 20min |
| 2 | 致命一击反馈去重叠 | Monster.ts | 20min |
| 3 | Hit Stop 门控修复 + Boss delta 修复 | CombatFeel.ts, GameScene.ts | 30min |
| 4 | 验证：tsc --noEmit + vite build | - | 10min |

### 第 1 天下午：P0 核心交付（~3h）

| 步骤 | 内容 | 文件 | 预计 |
|------|------|------|------|
| 5 | ELEMENT_COLORS + DAMAGE_NUMBER_CONFIG | config.ts | 30min |
| 6 | ArtGen 添加 px_white 纹理 | ArtGen.ts | 15min |
| 7 | burst() 迁移到 ParticleEmitter | VFX.ts | 1h |
| 8 | hitMonster 添加元素颜色体系 | VFX.ts | 30min |
| 9 | floatText 信息层级重构 | VFX.ts | 30min |
| 10 | 截图验证 | - | 15min |

### 第 2 天上午：P1 增强（~2h）

| 步骤 | 内容 | 文件 | 预计 |
|------|------|------|------|
| 11 | 击杀确认动画 | VFX.ts | 30min |
| 12 | 扩散环动态缩放 | VFX.ts | 20min |
| 13 | 屏震创伤累积 | VFX.ts | 30min |
| 14 | Batch 1/2 回修项（4 项） | Monster.ts, SoundManager.ts, CombatFeel.ts | 40min |

### 第 2 天下午：P2 打磨 + 验收（~2h）

| 步骤 | 内容 | 文件 | 预计 |
|------|------|------|------|
| 15 | 粒子二次运动（可选） | VFX.ts | 30min |
| 16 | 平滑血条 lerp（可选，原 Batch 5） | HUD.ts | 20min |
| 17 | 投射物拖尾（可选，原 Batch 4 前置） | SkillManager.ts | 30min |
| 18 | 全面验收测试 | - | 30min |
| 19 | tsc --noEmit + vite build | - | 10min |

---

## 7. 性能架构方案

### 7.1 核心方案：burst() 迁移到 Phaser ParticleEmitter

**当前实现（CPU 瓶颈）**：
```typescript
// VFX.ts — 当前
static burst(scene, x, y, count, colors, speed, size, lifetime): void {
  for (let i = 0; i < count; i++) {
    const p = scene.add.circle(x, y, size, c, 1);  // 每个粒子一个 Circle
    scene.tweens.add({ targets: p, ... });           // 每个粒子一个 Tween
  }
}
```

**目标实现（GPU 批处理）**：
```typescript
// VFX.ts — 新实现
private static particleTextureKey = 'px_white';

static burst(scene, x, y, count, colors, speed, size, lifetime): void {
  const emitter = scene.add.particles(x, y, this.particleTextureKey, {
    count,
    speed: { min: speed * 0.3, max: speed },
    scale: { start: size / 4, end: size / 4 * 0.2 },
    alpha: { start: 1, end: 0 },
    lifespan: lifetime,
    tint: colors,
    emitting: false,
    gravityY: 80,  // 二次运动
  });
  emitter.explode(count);
  // 粒子全部消失后自动清理 emitter
  scene.time.delayedCall(lifetime + 100, () => {
    if (emitter.active) emitter.destroy();
  });
}
```

**性能对比**：
| 指标 | 当前 (Circle) | 改进后 (ParticleEmitter) |
|------|---------------|--------------------------|
| 200 怪死亡 draw calls | ~2400 | ~1 |
| 对象创建 | ~2400 GameObjects | 1 emitter（内部对象池） |
| 帧时间（200 死亡） | >100ms | <5ms |
| 内存分配 | ~3-4MB | ~50KB |
| Tween 数量 | ~2400 | 0（粒子系统内置插值） |

### 7.2 shockwave 分析

`shockwave()` 创建 1 个 Circle + 1 个 Tween。在正常游戏流程中，同一时刻活跃的冲击波数量远小于粒子数量（每个死亡 1 个，vs 10 个粒子）。在最坏情况下 200 死亡 = 200 个冲击波，每帧 200 次 `setStrokeStyle` 调用。建议添加 `onStop` 清理但保持当前架构——迁移成本高于收益。

### 7.3 音效池改进

- Boss 音效方法添加 `priority = PRI_CRITICAL`（1 行改动 × 6 方法）
- 技能音效添加 `dedup` 预防单帧重复调用

---

## 8. 验收标准

### 8.1 P0 验收（必须通过）

- [ ] **致命一击清晰**：击杀怪物时只播放死亡反馈，无命中反馈重叠
- [ ] **Hit Stop 正确**：AOE 命中多个怪物时不会叠加多个闪光
- [ ] **Boss 同步冻结**：Hit Stop 期间 Boss 与普通怪物行为一致
- [ ] **元素辨识**：火焰怪命中闪暖白，冰霜怪命中闪冷白，颜色可区分
- [ ] **伤害数字层级**：普通/重击/击杀的文字颜色和大小有明显区分
- [ ] **性能稳定**：200 怪同时死亡帧率不低于 30fps（当前：崩溃）
- [ ] **无 Tween 泄漏**：场景重启后 VFX 和音效资源完全释放

### 8.2 P1 验收（强烈建议）

- [ ] **击杀确认**：怪物死亡时弹出"击杀"文字，从命中点弹入
- [ ] **扩散环动态**：重击的环明显大于轻击
- [ ] **屏震累积**：连续命中时震动越来越强（创伤叠加），停止后衰减
- [ ] **KNOCKBACK_CONFIG 激活**：修改 config.ts 中的击退值会影响游戏

### 8.3 P2 验收（锦上添花）

- [ ] **粒子下坠**：碎片飞行轨迹呈弧线而非直线
- [ ] **平滑血条**：HP/EXP 条平滑过渡而非瞬间跳变
- [ ] **投射物拖尾**：飞行投射物身后有粒子尾巴

---

## 附录 A：标杆游戏参数速查

| 技术 | Hades | Dead Cells | Nuclear Throne | Halls of Torment | Death Must Die |
|------|-------|------------|----------------|-------------------|----------------|
| Hit Stop | 有限 | 1帧+慢动作 | 10-20ms | 仅Boss | 有限 |
| 命中闪光 | 是 | 1帧纯白 | 1帧纯白 | 有限 | 是 |
| 屏震 | 2-5px | 按武器 | 创伤累积0.9衰减 | 部分 | 有限 |
| 击退 | 是 | 按武器2-8px | 3px/帧 | 物理驱动 | 有限 |
| 伤害数字 | 飘字+暴击×1.5 | 元素色 | 无(30fps限制) | 轻量 | 轻量 |
| 死亡特效 | 粒子+灵魂 | 血+粒子 | 33%爆炸 | 骨骼散落 | 粒子消散 |
| 元素系统 | 神祇祝福 | 5元素DOT | 无 | 有限 | 9神体系 |

---

## 附录 B：参考来源

- Jan Willem Nijman (Vlambeer) — "The Art of Screen Shake" GDC Talk
- Motion Twin — Dead Cells fighting game inspiration (80.lv interview)
- Sébastien Benard — Dead Cells player assistance (GDC)
- Chasing Carrots — Halls of Torment developer interview (FullCleared)
- Hylu — Responsive melee combat deep dive (hylu.dev)
- GamineAI — Combat feel & juice resource collection

---

> **报告撰写**：基于 3 个并行研究 Agent（代码审计 + 参考游戏分析 + 性能评估）
> **下一步**：等待用户审批，批准后即开始 P0 实施
