# Idea Puzzle · 想法拼图

给零散想法一张桌面。先写几张卡片，把相关的想法归入同一主题，再从中选一个想法，写下具体的下一步。

[打开想法拼图](https://puzzle.mariustang.com/) · [Ember Lab 作品目录](https://lab.mariustang.com/)

## 从卡片到行动

1. 新建卡片，在编辑区填写多行文字，按需设置颜色和自由文本分类。
2. 拖动卡片的手柄调整位置，或聚焦手柄用方向键移动。按住 Shift 可加大步长。手机上可滑动画布，拖卡片时按住手柄。
3. 创建或选择主题，将相关卡片加入。可重命名主题、移出卡片，移出最后一张时空主题自动移除。
4. 将一张卡片设为下一步，写下行动并在完成后勾选。更换已有行动、删除卡片、清空和恢复示例有确认流程。

画布为 2460 × 1800 px。主题边界随成员变化，卡片仍独立移动，目前没有画布缩放或整组拖动。

## 本地开发

应用是原生 JavaScript 与 CSS，由 Vite 7 提供开发服务和构建。可使用 Node.js 22.12+。在仓库根目录运行以下命令。

```sh
npm ci
npm run dev
npm run build
npm run preview
```

开发默认端口 5173，静态产物在 `dist/`。测试运行 `npx playwright install chromium` 后执行 `npm test`，包含 Node 单元测试与 Playwright 浏览器测试。可用 `CHROMIUM_PATH` 指定浏览器。[playwright.config.js](playwright.config.js) 管理本地测试服务和桌面、手机尺寸。模拟触控无法覆盖真实设备差异。

## 数据与实现

- [src/main.js](src/main.js) 管理桌面、拖动与编辑。[src/state.js](src/state.js) 管理示例和状态校验。[src/style.css](src/style.css) 定义画布及响应式样式。
- 卡片、主题和行动自动保存到 `localStorage` 的 `ember-idea-puzzle-v1`。不同设备、浏览器与域名不共享数据。存储失败仍可编辑和导出，损坏记录不会自动覆盖。多个标签页以最后写入为准。
- JSON 导出用于备份，当前界面没有导入功能。卡片及行动文字留在浏览器。
- [vite.config.js](vite.config.js) 按 Vercel 环境注入手动事件配置。[src/canvas-analytics.js](src/canvas-analytics.js) 记录打开、开始和主动勾选带文字行动的完成事件。正式版本可记录各流量来源，Preview 和标记为 `analytics_test=1` 的生产会话归为测试流量。默认本地关闭采集，`PUZZLE_ANALYTICS_LOCAL_TEST=1` 可模拟 Preview。[历史发布说明](docs/wechat-release.md) 保留早期仅朋友圈来源的方案。

## 部署

Vercel 项目 `ember-idea-puzzle` 从本仓库 `main` 部署，核对到的 Production 记录为 READY（`dc72894`）。使用 Vite preset，从仓库根目录安装依赖并运行 `npm run build`，发布 `dist/`。基础功能无需密钥、账号或数据库。自定义域名和默认 Vercel 地址的画布数据各自保存在对应站点来源。平台 READY 状态与 PostHog 实际入库是两项独立检查。
