# Supabase 云端副本与 PostHog 行为事件

## 访客使用

原功能和本地数据继续可用。页面底部展开“云端保存与恢复”，点击“保存到云端”才会上传当前内容，并生成恢复码。请复制妥善保管；其他设备输入同一恢复码可恢复，也可再次保存更新或删除该码的云端副本。恢复码持有人拥有这份副本的读写和删除权限，丢失后无法找回。

不会在打开页面或输入文字时自动上传业务内容。每次明确保存的是当前快照；保存后继续编辑需再次保存。恢复有替换确认，删除云端不删除本地。城市恢复前另在本机保留一份原数据备份。

## 数据与权限

- 数据库：现有免费 Supabase 项目 `crgfsrfxnwyjcjgmvpjr`，未创建付费资源。
- API：`https://crgfsrfxnwyjcjgmvpjr.supabase.co/functions/v1/ember-vault`。
- 表：`public.ember_cloud_documents`，RLS 开启，无公开读写策略；通过 Edge Function 的服务端身份访问。
- 浏览器只持有 publishable key 和自己的随机 256-bit 恢复码；服务端密钥仅来自 Edge Function 系统环境变量。数据库仅保存“站点 + 恢复码”的 SHA-256 摘要，不保存明文恢复码。
- 按站点隔离；无列表接口。更新/删除使用版本号原子条件，旧快照返回 409，不静默覆盖。
- 单次请求最多 256 KiB。Edge Function 有每个运行实例、每个恢复码每分钟 30 次的尽力频率限制，不是跨实例全局配额；若未来流量扩大，应增加网关限流/验证码。
- Supabase 免费实例可能自动暂停；云端不可用时不虚报保存成功，本地编辑仍可继续。恢复码仅在当前浏览器记住，请自行备份。

## PostHog

沿用已有行为统计。新增 `cloud_save`、`cloud_restore`、`cloud_delete`，仅在成功后发送。属性只有固定聚合标记、site、traffic 和关闭用户画像/地理定位的设置；不包含卡片正文、观察、电影答案、恢复码、IP、邮箱或完整页面 URL。`analytics_test=1` 标记为测试流量；没有自动录屏或全量采集。

## 后端维护

共享后端源码、验证器与表结构保存在 `wenyimarius-ship-it/culturebridge` 的 `supabase/functions/ember-vault/` 和 `database/experiment-cloud-schema.sql`。三个实验中的 `cloud-vault.js/css` 是同一版本的客户端副本，修改时保持同步。网关 `verify_jwt=false` 是因为函数内部验证恢复凭证，不表示客户端可以无凭证读写数据。

## 已验证

真实 Supabase 的创建、读取、更新、删除、错误恢复码隔离、跨站点隔离、旧版本冲突、CORS 与公开密钥 RLS 拒绝读取通过。桌面 1440 和手机 375 的三个实验分别用独立浏览器上下文验证保存→恢复→更新→阻止旧版本→删除通过，测试副本已删除。既有核心功能回归通过。

未做生产数据迁移；默认不会把任何访客已有的浏览器内容上传云端。用户需主动保存。
