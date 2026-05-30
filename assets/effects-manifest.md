# Terraria 特效素材清单

> 来源：Terraria 1.4+ Extra / Projectile 精灵
> 筛选标准：暖色调 / 明亮 / 适合东方古建主题
> 总大小：388KB (344 files)，dist 压缩后约 850KB

## 推荐用途分类

### ⭐ 粒子纹理 (替换 px_white 白块)
| 文件 | 尺寸 | 用途 |
|------|------|------|
| proj_Projectile_10.png | 64×64 | 大光点粒子 |
| proj_Projectile_251.png | 32×32 | 中光点粒子 |
| extra_Extra_252.png | 64×64 | 辉光粒子 |
| extra_Extra_283.png | 34×36 | 星形光点 |

### 🔥 火焰/暖色系 (火焰怪、火系技能)
| 文件 | 尺寸 | 用途 |
|------|------|------|
| proj 火焰相关 | 多种 | 火焰弹幕、爆炸粒子 |

### 💧 水系/冰系 (防水封护技能)
| 文件 | 尺寸 | 用途 |
|------|------|------|
| proj 蓝色系 | 多种 | 水珠、冰晶弹幕 |

### ⚡ 雷电/能量 (雷电链技能)
| 文件 | 尺寸 | 用途 |
|------|------|------|
| proj 闪电相关 | 多种 | 电弧、能量爆发 |

### 🌿 自然/木系 (木构加固、防虫处理)
| 文件 | 尺寸 | 用途 |
|------|------|------|
| proj 绿色系 | 多种 | 叶片粒子、孢子效果 |

### 💥 冲击/爆发 (Boss 技能、死亡特效)
| 文件 | 尺寸 | 用途 |
|------|------|------|
| extra_Extra_216.png | 512×512 | 大型冲击波 |
| extra_Extra_194.png | 256×256 | 中型爆炸 |
| extra_Extra_196.png | 256×256 | 能量环 |

### 🎨 动画条带 (Spritesheet)
| 文件 | 尺寸 | 帧数 | 用途 |
|------|------|------|------|
| extra_Extra_13.png | 290×638 | ~10帧 | 大型特效动画 |
| extra_Extra_159.png | 195×1221 | ~18帧 | 长特效条带 |
| proj_Projectile_957.png | 168×1296 | ~20帧 | 弹幕动画条带 |

## Phaser 加载方式

```typescript
// 静态图片 (粒子纹理)
this.load.image('fx_glow', 'assets/effects/extra_Extra_252.png');

// 动画条带 (水平排列帧)
this.load.spritesheet('fx_big_explosion', 'assets/effects/extra_Extra_13.png', {
  frameWidth: 29,   // 总宽 / 帧数
  frameHeight: 638
});
```
