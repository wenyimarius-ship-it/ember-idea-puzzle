# Puzzle · PostHog 预览验收（不发布）

## 配置与发布边界

使用用户提供的公开只写 Project token、`https://us.i.posthog.com`，配置在 `config/posthog-preview.json`。该 token 会作为网页公开采集凭据编入 Preview，不是能读取数据的 Personal API key。没有读取后台的权限，也没有开通付费功能。

Vite 只在 Vercel `VERCEL_ENV=preview` 或显式本地测试标志 `PUZZLE_ANALYTICS_LOCAL_TEST=1` 下编入配置。`VERCEL_ENV=production` 优先关闭统计，即使误设本地测试标志也不会启用。已检验 Production 产物没有 token 和 PostHog host。不更改 Vercel 项目配置，不合并 main，不部署 Production。

## 三个事件及属性

| 节点 | 事件名                  | 界面口径                                             |
| ---- | ----------------------- | ---------------------------------------------------- |
| 打开 | `puzzle_home_open`      | 根入口客户端初始化                                   |
| 开始 | `puzzle_first_start`    | 首次点击「试一组示例」或「写我自己的」               |
| 完成 | `puzzle_first_complete` | 「带走这一步」后，结果卡「这一组，拼好了。」成功显示 |

预览属性固定为 `site=puzzle`、`traffic=test`、`source=wechat_moments`。未带朋友圈参数且没有已建立的朋友圈测试会话时，不初始化或发送，避免点击 Vercel Visit 后消耗验收会话。只发送这三个手动事件，直接使用 PostHog Capture API `/i/v0/e/`，没有 analytics SDK、自动 pageview、pageleave、autocapture、录屏、自动识别用户或画像功能。

同一标签页会话，每节点最多尝试发送一次。沿用原逻辑、使用独立的 `idea-puzzle-funnel-posthog-test-v1` sessionStorage 键，避免旧 Vercel 测试标记阻止新后台验收。首次来源归因固定；删除 UTM、刷新、回到首页、反复拼图不会改来源或多计。不同标签页通常是不同会话；浏览器复制标签页/恢复窗口的 sessionStorage 继承行为以浏览器为准。

PostHog 协议必需的 `distinct_id` 为本标签页随机 UUID，只存在 sessionStorage，不使用真实身份，不跨站关联。`$process_person_profile=false` 禁用人物画像，`$geoip_disable=true` 禁用地理解析。不发送 URL、查询字符串、referrer、念头、关系、行动、画布数据或账号。页面 referrer policy 为 no-referrer，fetch 使用 credentials omit。

发送标记在网络请求前保存；网络失败不重试以免重复。因此客户端去重不等于远端 exactly-once 入库，广告拦截、代理、断网等仍会漏计。存储不可用时停止统计，不影响拼图。

## 本地与远端验证

```sh
# 正式构建关闭测试，甚至本地测试标志被误设也不会启用
VERCEL_ENV=production PUZZLE_ANALYTICS_LOCAL_TEST=1 npm run build
# 模拟 Vercel Preview
VERCEL_ENV=preview npm run build
npm run preview -- --port 4180
node docs/check-analytics-preview.mjs
# 真接收端尝试，不拦截响应；只有明确授权的测试才运行
POSTHOG_REAL_CAPTURE=1 node docs/check-analytics-preview.mjs
# 单元与完整浏览器回归
PUZZLE_ANALYTICS_LOCAL_TEST=1 npm test -- --workers=2
```

本轮构建通过；5 项单元测试通过、41 项浏览器测试通过、1 项桌面触控专项按设计跳过。模拟接收端记录见 `analytics-preview-result.json`；真实接收端尝试见 `posthog-real-attempt.json`。模拟 200 响应不作为入库证明，真实 API 的 2xx 也不替代后台三个节点的次数核验。当前环境到 PostHog 为 CONNECT 403，GitHub/Vercel API 和部署域名也受限制，不能推断远端部署 READY 或编造 Preview URL。

## 用户查看与验收

1. 在 Vercel 项目 `ember-idea-puzzle` 的 Deployments 中，选择分支 `feat/wechat-session-funnel` 对应最新提交；确认 **Environment = Preview**、状态 Ready，复制该部署的真实 URL。不要用正式域名验收，不要点 Promote to Production。
2. 测试 URL 在真实 Preview URL 后加 `?utm_source=wechat_moments`。每轮独立验收用新标签页会话，先记下开始时间。打开 → 试一组示例 → 任意两卡 → 带走这一步。随后再来一组并完成、刷新、再次完成。
3. PostHog 项目 → **Activity / Live events**（或 Activity → Explore），筛 `site=puzzle`、`source=wechat_moments`、`traffic=test` 和本轮时间范围。核对上述三个事件各一条、匿名 distinct_id 一致，刷新和重复后该会话仍只有三条。
4. 用 **Product Analytics → Trends** 的 Total event count 分别显示 A=打开、B=开始、C=完成，保持相同过滤及时间范围。公式 `C/A`、`C/B` 分别为「点开后完成」和「开始后完成」；分母为 0 显示无数据。不使用 Unique users、PostHog 自带 session 定义或按人数计算的 Funnel 替代本应用的标签页会话口径。

后台实际入库、真实 Preview URL、部署对应 SHA 均需实证。只写 token 无法查询项目数据；若环境不能访问后台，由用户在以上位置核对，不索取 Personal API key。正式链接与 Production 更新仍等待用户确认。

## Cinema

用户最新指示优先验收 Puzzle。本轮未修改 Cinema；此前只读检查发现 Cinema 有 CSP `connect-src 'none'`，后续接入还需在其独立预览分支精确允许 PostHog 接收地址。不要将本轮 Puzzle 测试结果描述成 Cinema 已入库或两站均验收通过。
