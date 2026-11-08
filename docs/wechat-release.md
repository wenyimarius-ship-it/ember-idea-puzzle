# Puzzle · 仅统计发布准备

## 基准与范围

用户确认当前 Vercel Production 来自 main / a521819733ef9eed91a494966ba8a1deb22e41f4。本分支 release/puzzle-wechat-statistics 从该提交创建，不包含 ux/puzzle-first-play、feat/first-puzzle-experience 或 feat/wechat-session-funnel 的界面及功能变更。

src/main.js 仅添加 import 和 installCanvasAnalytics 调用，所有观察行为在独立模块中。样式、模板主体、画布功能、数据模型、锁文件及原功能测试不变。无新依赖。唯一页面元信息调整为 no-referrer，避免向统计请求附带 URL 查询。

## 本版实际口径（不同于新版 Preview）

- puzzle_home_open：旧版页面初始化完成。
- puzzle_first_start：首次点击引导「开始拼图」，或首次选择/新建/编辑/移动卡片、设置行动等既有操作。
- puzzle_first_complete：用户主动勾选旧版「我完成了这一步」，且当时已有非空的行动文字。这代表用户标记下一步行动完成，不冒充新版的结果卡生成或真实执行验证。已有 done=true 数据加载、勾选空行动不会自动计完成。

此前用户认可的是新版 Preview 的去重和入库；不能直接将其作为本旧版界面路径的真实入库证据。待本分支 Preview 在旧版路径再次核验。

## 流量隔离

只采集 utm_source=wechat_moments（首次来源会话内保留），不采集普通来源。手动 Capture API，无自动浏览/点击、录屏或人物画像，不传用户内容、URL、账号。PostHog 所需 distinct_id 仅为标签页短期随机值，按环境和流量类别分开。

- Vercel Preview：全部匹配来源的事件 traffic=test。
- Vercel Production：普通朋友圈入口 traffic=production。
- Vercel Production 测试入口增加 analytics_test=1：traffic=test。
- 正式测试标记在当前标签页会话内保持，去掉 URL 参数、刷新或再次操作不会转为 production。正式与测试的去重键及匿名标记独立，测试不会消耗正式会话，也不会混入正向 traffic=production 筛选。
- 纯本地默认构建关闭；PUZZLE_ANALYTICS_LOCAL_TEST=1 仅用于本地 Preview 模拟。

## 验证

PUZZLE_ANALYTICS_LOCAL_TEST=1 npm test -- --workers=2：6 项单元测试通过、21 项浏览器测试通过、1 项桌面触控专项跳过，原有回归仍执行。

VERCEL_ENV=production npm run build：构建成功。npm run preview -- --port 4184 后运行 node docs/check-production-analytics.mjs，验证手机 375px、桌面 1440px 下正式与测试各三条、刷新/重复不增加，测试产生 0 条正式报表记录。接收端是模拟，不是 Production 已部署或已入库证明；结果见 production-analytics-local-result.json。

## 实际发布的前提

1. 从本分支向 main 建 PR，仅审查统计差异；核对 CI、冲突、分支保护。
2. 本分支真实 Vercel Preview 验证旧版路径和 PostHog 入库；不能沿用新版界面 Preview 结果冒充。
3. 合并后核对 Vercel Production READY、Git 提交与 main 匹配。
4. 使用正式域名带 utm_source=wechat_moments&analytics_test=1 的测试入口，按旧版操作路径验证三个事件各一次；PostHog 筛 site=puzzle、source=wechat_moments、traffic=test 和本轮时间范围及同一 distinct_id。
5. 正式报表严格筛 traffic=production，确认本轮测试记录不出现。然后才交付无测试参数的正式朋友圈入口。

当前环境 GitHub API、PostHog 与正式/预览域名请求被代理阻断；本报告不声称 PR 已创建/合并、Production 已部署或正式测试已入库。公开 Project token 只有采集权限，不能查询事件或创建保存报表，不索取 Personal API key。

## 报表配置（待在后台实际保存并核验，不是假定已存在的链接）

PostHog Product Analytics → Trends，所有卡片共同过滤：

- site equals puzzle
- source equals wechat_moments
- traffic equals production（必须正向等于，不用仅排除 test）

三条 series 均选择 Total count：A=puzzle_home_open、B=puzzle_first_start、C=puzzle_first_complete，使用同一日期范围。

建议保存：

- Puzzle｜朋友圈｜正式会话数：A、B、C，总数视图。
- Puzzle｜朋友圈｜点开后完成（%）：公式 100*C/A。
- Puzzle｜朋友圈｜开始后完成（%）：公式 100*C/B。

分母为 0 无可解释比例，不当作 0% 或真人转化结论。选择覆盖完整会话的时间范围，不混入测试、新版 Preview、Cinema 或 funnel_* 历史事件，不使用 Unique users 替代本应用会话去重口径。

需要有后台权限的账号保存后提供实际项目/报表 URL，才能交付可点击的已验证报表入口。目前只准备配置，尚未创建真实报表。
