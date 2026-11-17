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
- JSON 导出与页面底部的“导入 JSON”用于本机备份。导出文件为平铺的状态对象，原来已有 `version: 1`，现在增加 `schema: "ember-idea-puzzle"`；导入也兼容缺少 schema/version 的旧文件。卡片及行动文字留在浏览器。
- 导入上限为 1 MB，确认前展示卡片和主题数量。校验复用 `src/state.js` 并补充文字长度检查：最多 1000 张卡片、1000 个主题，卡片文字 5000 字符、分类及主题名 40 字符、行动 1000 字符；坐标沿用 x=24–2170、y=60–1500，确保卡片留在 2460×1800 画布内。未知字段被丢弃，HTML 标签作为普通文字显示。
- 确认导入后，先将当前状态保存至 `ember-idea-puzzle-backup-v1`（只保留最近一份），再写入原 key `ember-idea-puzzle-v1`。只有写入成功才替换界面；校验、文件读取或写入失败都保留当前画布。损坏的原记录不自动覆盖。点击“恢复上一份”并确认可撤销，恢复前的内容成为最近备份。备份也仅属于当前浏览器和域名，清理浏览器数据会删除它。
- [vite.config.js](vite.config.js) 按 Vercel 环境注入手动事件配置。[src/canvas-analytics.js](src/canvas-analytics.js) 记录打开、开始和主动勾选带文字行动的完成事件。正式版本可记录各流量来源，Preview 和标记为 `analytics_test=1` 的生产会话归为测试流量。默认本地关闭采集，`PUZZLE_ANALYTICS_LOCAL_TEST=1` 可模拟 Preview。[历史发布说明](docs/wechat-release.md) 保留早期仅朋友圈来源的方案。
- 完成带文字的行动后，行动面板提供“有用 / 一般 / 没用”反馈；同一标签页会话只接受一次，刷新后仍锁定。新增 `puzzle_feedback` 的业务属性严格为 `site: "puzzle"`、`rating: useful / neutral / not_useful`、`traffic: production / test`，不含卡片、行动、主题文字、来源或 URL。沿用已有匿名会话 ID 和流量分类；`analytics_test=1` 的生产测试标记在会话内保持，归入 `traffic=test`。反馈仅向配置的正式 origin `https://puzzle.mariustang.com` 发送，Preview 域名不会发送此事件。默认本地关闭采集，`PUZZLE_ANALYTICS_LOCAL_TEST=1` 可在 localhost/127.0.0.1/::1 的 HTTP 开发服务模拟 Preview。

## 部署

Vercel 项目 `ember-idea-puzzle` 从本仓库 `main` 部署，核对到的 Production 记录为 READY（`dc72894`）。使用 Vite preset，从仓库根目录安装依赖并运行 `npm run build`，发布 `dist/`。基础功能无需密钥、账号或数据库。自定义域名和默认 Vercel 地址的画布数据各自保存在对应站点来源。平台 READY 状态与 PostHog 实际入库是两项独立检查。

## 云端副本

新增主动保存与恢复入口，默认仍在本地使用。恢复码支持换设备取回、更新、删除云端副本；正文进入 Supabase，PostHog 只记录行为。详见 [接入与权限说明](docs/cloud-persistence.md)。

## 反馈与 JSON 导入验证

`npm test` 包含格式、白名单、边界、备份及写入失败的单元测试，以及 375px/1440px 的反馈、文件选择、导出导入往返、取消、恢复与防注入浏览器检查。原有统计集成测试默认仍按其条件跳过。反馈传输可另行模拟验证：

```sh
CI=1 PUZZLE_ANALYTICS_LOCAL_TEST=1 npx playwright test tests/puzzle.spec.js --grep "feedback capture"
CI=1 VERCEL_ENV=production npx playwright test tests/puzzle.spec.js --grep "feedback capture"
```

第二条只为本机开发服务模拟生产配置，并将正式 origin 的页面请求转到本机；两条均拦截 PostHog 请求，不写入真实统计。覆盖最终属性白名单、匿名会话复用、刷新与重复完成去重、测试流量和正式 origin 限制。真实 PostHog 入库、统计报表及真实手机文件选择器仍需上线后人工核验。
