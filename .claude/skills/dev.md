# /dev — 开发启动

启动 Vite 开发服务器，用 Playwright 打开浏览器验证游戏加载。

## 触发词

"启动" "运行" "开发" "dev" "跑起来" "npm run dev"

## 执行流程

1. 检查 `node_modules` 是否存在，不存在则 `npm install`
2. 执行 `npm run dev` 在后台启动
3. 等待 3 秒让 Vite 就绪
4. 用 Playwright 打开 `http://localhost:3000`
5. 等待 Phaser Game 初始化（检查 canvas 元素出现）
6. 截图保存到 `.claude/screenshots/dev-{timestamp}.png`
7. 报告：是否成功加载、控制台有无报错、canvas 是否存在

## 输出

- ✅/❌ 启动状态
- 截图路径
- 控制台错误摘要（如有）
- 包体积信息
