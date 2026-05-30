# /snap — 游戏截图分析

用 Playwright 截取游戏画面，结合 vision MCP 做视觉分析。

## 触发词

"截图" "看看效果" "画面" "snap" "外观" "长什么样"

## 执行流程

1. 确保 `npm run dev` 正在运行（否则先启动）
2. 用 Playwright 连接 `http://localhost:3000`
3. 等待 Phaser Game 渲染完成
4. 截图保存到 `.claude/screenshots/snap-{scene}-{timestamp}.png`
5. 可选：模拟特定操作后再截图（如等待升级面板出现、等待怪物生成）
6. 用 vision MCP 分析截图：
   - UI 元素是否遮挡/截断
   - 文字是否清晰可读
   - 像素艺术是否模糊
   - 调色板是否统一
   - 动画帧是否存在撕裂
7. 用 chrome-devtools MCP 检查 Canvas FPS

## 输出

- 截图文件路径
- vision 分析报告
- FPS 数据（如有性能问题）
- 改进建议列表
