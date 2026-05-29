# Aseprite 精灵规格说明

> 调色板文件：`assets/palette.gpl`（导入方式：Aseprite → Color Palette → Import）

---

## 全局设置

- **像素块大小：** 2×2 物理像素 = 1 像素格（Phaser PX=2）
- **导出格式：** PNG-8 索引色（256 色调色板）
- **Spritesheet 排列：** 横向一行（Horizontal Strip），帧从左到右
- **Padding：** 2px（帧之间）
- **Phaser 配置：** `pixelArt: true`, `roundPixels: true`

---

## 1. 玩家：古建守护者

```
Aseprite 画布：32×48 px
物理像素：    64×96 px
帧数：        4帧 × 4方向 = 16帧
排列：        行1=向下走, 行2=向左走, 行3=向右走, 行4=向上走
每行帧：      4帧（帧1左脚前, 帧2并脚, 帧3右脚前, 帧4并脚）
帧率：        10 fps（行走）/ 6 fps（待机）
导出文件：    player-sheet.png
帧尺寸：      每个精灵帧 32×48, spritesheet 总尺寸 128×192
```

### 设计要点
- Q版二头身（头:身 ≈ 1:1.2）
- 大斗笠（三层渐变锥形，金色笠沿装饰线）
- 圆脸红晕 + 大圆眼带白色高光
- 藏青蓝袍交领右衽 + 金色宽腰带
- 右手持大毛笔（笔杆棕色，笔尖黑色）
- 黑布鞋带白色鞋底边

### 行走动画细节
- 身体上下起伏 ±1px
- 手臂前后摆动 ±2px
- 斗笠轻微晃动
- 袍摆左右摆动

---

## 2. 白蚁怪 (termite)

```
画布：20×20 px
帧数：4帧行走
帧率：8 fps
导出：termite-sheet.png（80×20）
```

- 四节身体（米白→浅灰渐变）
- 长触角左右摆动（帧间 ±2px）
- 六足交替前后移动
- 暗红眼带红色高光

---

## 3. 风蚀怪 (wind)

```
画布：28×28 px
帧数：4帧旋转
帧率：10 fps
导出：wind-sheet.png（112×28）
```

- 四层风刃菱形漩涡，每层不同旋转偏移
- 十字风刃线
- 中心白眼 + 黑瞳高光
- 帧间各层旋转角度不同（营造旋转感）

---

## 4. 酸雨怪 (acid_rain)

```
画布：24×28 px
帧数：4帧跳动
帧率：8 fps
导出：acid_rain-sheet.png（96×28）
```

- 泪滴形轮廓（上窄中宽下尖）
- 多层绿色渐变（上亮下暗）
- 内部 3-4 个白/浅绿气泡
- 帧间上下压缩拉伸（bounce 效果）

---

## 5. 火焰怪 (fire)

```
画布：32×32 px
帧数：6帧闪烁
帧率：12 fps
导出：fire-sheet.png（192×32）
```

- 外焰不规则轮廓带顶端分叉
- 内焰暖橙缩进 3px
- 核心金黄 + 纯白中心
- 怒眉凶眼（白底红瞳）
- 帧间火焰边缘随机跳动

---

## 6. 冻融怪 (freeze_thaw)

```
画布：34×34 px
帧数：4帧漂浮
帧率：6 fps
导出：freeze_thaw-sheet.png（136×34）
```

- 六边形冰块主体，冰晶纹理
- 左上方向强高光条
- 4-5 条深蓝裂纹线
- 冷光蓝瞳（白底蓝眼）
- 帧间微微上下浮动 + 高光晃动

---

## 7. 古建寺庙（5 段损毁状态）

```
画布：96×56 px
帧数：5帧（5个独立状态，非动画帧）
导出：building-sheet.png（480×56）
排列：frame0=完好, frame1=轻损, frame2=中损, frame3=重损, frame4=废墟
```

### 各状态要点
| 帧 | 状态 | 视觉变化 |
|----|------|---------|
| 0 | 完好 100% | 全部结构完整，金色鸱吻脊饰高亮，6柱完整 |
| 1 | 轻损 75% | 屋顶掉瓦 3-5处，外墙微裂，脊饰变小 |
| 2 | 中损 50% | 屋顶明显缺瓦，右窗破损，外墙裂缝增多，斗拱部分暗色 |
| 3 | 重损 25% | 屋顶大洞，中柱倾斜断裂，右窗全毁，左窗微损，斗拱半数损坏 |
| 4 | 废墟 0% | 屋顶全塌→碎片，仅剩残垣断壁，台基裂缝，杂草丛生 |

---

## 8. 经验球

```
画布：10×10 px
帧数：4帧辉光旋转
帧率：8 fps
导出：exp_orb-sheet.png（40×10）
```

- 外围绿色辉光
- 内圈金色光晕
- 核心白色亮点
- 帧间辉光旋转（亮暗交替）

---

## Phaser 加载代码（准备好后使用）

```ts
// preload 阶段
this.load.spritesheet('player', 'assets/player-sheet.png', { frameWidth: 32, frameHeight: 48 });
this.load.spritesheet('termite', 'assets/termite-sheet.png', { frameWidth: 20, frameHeight: 20 });
// ... 其他精灵同理

// create 阶段
this.anims.create({ key: 'player_walk_down',  frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
this.anims.create({ key: 'player_walk_left',  frames: this.anims.generateFrameNumbers('player', { start: 4, end: 7 }), frameRate: 10, repeat: -1 });
this.anims.create({ key: 'player_walk_right', frames: this.anims.generateFrameNumbers('player', { start: 8, end: 11 }), frameRate: 10, repeat: -1 });
this.anims.create({ key: 'player_walk_up',    frames: this.anims.generateFrameNumbers('player', { start: 12, end: 15 }), frameRate: 10, repeat: -1 });
```
