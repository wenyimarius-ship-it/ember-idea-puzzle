# 朋友圈会话漏斗（待预览入库验收，不发布）

正式分享入口（验收并确认发布后再发）：

**https://ember-idea-puzzle.vercel.app/?utm_source=wechat_moments**

## 现状与接收端

仓库检查未发现现成的统计 SDK、自动访问统计或事件埋点。当前无法访问正式站点、GitHub API 或 Vercel 后台（代理 CONNECT 403 / Forbidden），因此不能确认平台是否另外注入了 Web Analytics，也不能宣称远端 Preview、后台入库或正式部署已验证。

本分支基于用户已认可的 `d8c862e`，保持界面和完成态不变。核查时远端 main 仍为 `a521819`，不要将本分支直接推广到 Production。

增加官方 `@vercel/analytics` 适配器，默认不启用。优先在现有 Vercel 项目复用 Web Analytics；需先在后台确认项目已启用 Web Analytics、账号套餐支持 **Custom Events**（仅基础访问统计不足以提供此漏斗）。本次未升级套餐、创建其他统计账号、写入 Vercel 配置或触发 Production。

仅在 Preview 设置 `VITE_PUZZLE_ANALYTICS=vercel` 后重新构建；Vite 环境变量是构建时读取的。未设置、设为 `off` 或浏览器 sessionStorage 不可用时不加载统计脚本、不发送事件。Production 待用户确认发布后再单独启用。

## 实际口径

| 节点         | 事件名                  | 实际界面动作                                                                                       |
| ------------ | ----------------------- | -------------------------------------------------------------------------------------------------- |
| 打开首页     | `puzzle_home_open`      | Puzzle 根入口的客户端脚本首次初始化；在本标签页刷新画布也属于同一次入口会话，不增加次数            |
| 首次开始拼图 | `puzzle_first_start`    | 首次点击「试一组示例」或「写我自己的」；自定义尚未输入时已算开始                                   |
| 首次完成拼图 | `puzzle_first_complete` | 点击「带走这一步」后，结果卡「这一组，拼好了。」渲染成功；不以选择第二张卡、复制或进入画布作为完成 |

新版已有明确完成态，因此不需用复制行为替代完成。示例和自定义共用同一个去重漏斗，切换路径也不会多计。

保留两种比例，含义不同：

- **点开后完成比例 = 完成会话数 ÷ 打开会话数**。
- **开始后完成比例 = 完成会话数 ÷ 开始会话数**。

对应分母为 0 时显示“无数据”，不做除零或算成 0%。Vercel Events 如不支持这两种自定义公式，用同一筛选范围的三个事件次数在表格计算，不宣称后台自动提供。

## 会话与来源

使用独立的 `sessionStorage` 键 `idea-puzzle-funnel-v1`，会话以浏览器标签页的 sessionStorage 生命周期为准，不是用户人数、设备人数或 30 分钟活跃会话。刷新、站内返回、重复拼图不创建新会话。新标签页通常有独立会话；复制标签页/带 opener 的窗口和浏览器恢复可能继承 sessionStorage，以浏览器行为为准。

首次打开时只保留来源类别：`wechat_moments`、`direct`、`other`。任意其他 utm_source 都归入 other，不上传原值。首触来源在该会话固定；后续删除或更换 URL 中的 UTM、点击品牌回首页、转入原画布，后续节点仍使用同一个来源。先从 direct 打开的会话不会因稍后添加朋友圈参数重新归因。

本地只存来源和已发送节点，不生成/发送 session ID、用户 ID、账号、设备标识、念头、关系说明、行动文字或拼图 JSON。不会读取原画布的存储键。应用事件属性严格只有 `{source: 'wechat_moments'}` 这类固定值，节点由事件名称表达。

关闭 SDK 自动 pageview，beforeSend 丢弃 pageview 并把事件 URL 规范为站点根路径（去掉查询参数和 hash）。页面使用 no-referrer，避免把查询参数作为后续请求的 Referer 发送。统计服务仍会处理网络请求固有的 IP/UA/时间等基础设施元数据，应用没有另行附加这些身份字段；后台漏斗只用三个事件的次数，不使用访客识别维度。

为保证每节点至多一次，先将发送标记写入 sessionStorage，再交给 SDK。断网、广告拦截、关闭页面、服务端不可用或统计脚本失败时可能漏计；不自动重发，无法承诺远端 exactly-once 入库。存储不可用时关闭统计，避免刷新产生无法去重的重复次数；拼图照常可用。

## 去哪里看朋友圈数据

启用并实际入库后：Vercel Dashboard → **ember-idea-puzzle** 项目 → **Analytics / Web Analytics → Events（Custom Events）**。

1. 选 **Production** 环境、朋友圈发布日起的完整日期范围，排除 Preview 测试。
2. 分别打开上述三个事件，按事件属性 `source = wechat_moments` 筛选，读取事件总次数（不要拿 Visitors/Unique Visitors/普通 Pageviews 代替）。如后台套餐不支持属性筛选，需要可导出的事件数据或其他接收端，不能宣称已有可用朋友圈报表。
3. 三个总次数分别是被采集的打开、开始、完成会话数。分别计算 `puzzle_first_complete / puzzle_home_open` 和 `puzzle_first_complete / puzzle_first_start`。本次不另建复杂后台或改动界面。
4. 时间窗口应覆盖同一批会话从开始到结束；跨日会话的开始、完成事件可能落在不同日期。本实现无会话 ID，不提供跨窗口的精确 cohort 联表分析，也不自动把每日百分比当作真人转化结论。

目前没有后台权限，**没有确认此菜单/套餐的实际可用性，也没有真实朋友圈访问数据**。

## 本地 Preview 验证与远端验收

```sh
VITE_PUZZLE_ANALYTICS=vercel npm run build
VITE_PUZZLE_ANALYTICS=vercel npm test -- --workers=2
npm run preview -- --port 4176
node docs/check-analytics-preview.mjs
```

浏览器测试拦截统计脚本和接收端，实际走示例与自定义流程，断言三事件各一次、重复完成/刷新不增加、来源保留、URL 清洗、无用户输入、独立会话和存储禁用。另保留原工具回归。结果见 `analytics-preview-result.json`。

该 JSON 来自生产构建的本地 Preview + 明确模拟的接收端，不是 Vercel 已入库证明，其中单会话 100% 只用于断言，不能当作真实完成率。真实 Vercel Preview 仍需检查与提交匹配的部署、在浏览器网络中查看三个 2xx 接收请求，并在 Preview 的 Events 中确认三个事件各 1；重新试玩不能增加，新会话则增加。完成这项验收后仍等待用户确认发布。

## 用户协助核对后台（不升级、不启用付费服务）

打开 Vercel Dashboard → ember-idea-puzzle → Analytics / Web Analytics。需要看到页面顶部是否出现 Enable、已有 Pageviews/Visitors 图表，以及 Events / Custom Events 是否可用或显示套餐限制；提供这些区域截图即可，不要截密钥、付款信息或用户明细。不要求先点升级或开通付费。

若只有基础访问统计，通常可查看页面访问次数和匿名访客等访问维度；是否支持 UTM 来源筛选要以实际后台为准。Pageviews 会受刷新影响，Visitors 是服务端访客口径，两者都不等于本任务的 sessionStorage 会话数。基础统计无法说明开始和完成节点，也无法直接计算两种会话比例。当前无法读后台，尚不能声称该项目已有任何一种可用报表。

只有测试事件在实际 Preview 后台出现，并确认来源属性可单独筛选后，才提供可用于朋友圈的正式统计入口；在此之前，文档顶部地址只作为待发布的配置说明，不能当作已就绪的统计链接。本轮停止在预览验收阶段，发布需用户后续确认。
