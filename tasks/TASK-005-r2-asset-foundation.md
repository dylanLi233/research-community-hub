# TASK-005 — R2 素材存储与访问控制底座

## 状态

已完成

## 目标

建立研报封面、正文图表和课程插图所需的统一素材底座，使管理员可以安全上传图片，并由网站根据素材权限从 Cloudflare R2 返回内容。

## 范围

- Cloudflare R2 `MEDIA_BUCKET` Binding
- D1 `assets` 表、约束、索引和 Drizzle Migration
- JPEG、PNG、WebP 文件头识别
- 最大 10 MB 限制
- 实际 MIME 与声明 MIME 一致性校验
- SHA-256 内容哈希
- 随机不可猜测的 R2 Object Key
- 管理员素材上传与列表 API
- `/media/{id}` 服务端素材读取路由
- `public`、`member`、`private` 三种访问级别
- 会员素材访问时复用现有会员有效性策略
- 数据库写入失败后的 R2 补偿删除
- 上传、校验和访问策略单元测试
- 上传和访问的安全响应头与缓存规则

## API

- `GET /api/admin/assets`
- `POST /api/admin/assets`
- `GET /media/{id}`

## 非范围

- Hermes API Token 与 Hermes 素材上传接口
- 图片压缩、裁剪、格式转换和缩略图
- 素材删除与批量管理页面
- 研报、事件和课程业务表
- HTML 正文清洗与付费墙
- 原始 PDF 上传
- SVG、GIF、视频和音频
- 公共 R2 Bucket 或直接暴露 Object Key

## 业务规则

- V1 只允许 JPEG、PNG 和 WebP。
- 服务端必须检查文件头，不信任扩展名或浏览器声明的 MIME。
- 文件大小必须在 1 Byte 到 10 MB 之间。
- 原始文件名只保存为元数据，不能作为 R2 路径。
- 素材 URL 统一为 `/media/{assetId}`，不向客户端返回 R2 Object Key。
- `public` 素材允许匿名访问并可公共缓存。
- `member` 素材仅有效会员和管理员可访问。
- `private` 素材仅管理员可访问。
- 未授权访问受限素材统一返回 404，避免确认素材是否存在。
- 受限素材响应使用 `private, no-store`。
- 管理员上传必须通过现有 Session、管理员权限和同源校验。
- 上传成功后必须记录上传管理员和审计日志。
- R2 写入成功但 D1 写入失败时，必须尽力删除刚写入的 R2 Object。

## 验收标准

- [x] `wrangler.jsonc` 与 Cloudflare Env 类型包含 `MEDIA_BUCKET`。
- [x] 本地和 CI 可以应用新增 Migration，重复执行不报错。
- [x] 管理员可通过 Multipart Form Data 上传合法图片。
- [x] 非管理员、未登录或跨源上传被拒绝。
- [x] 空文件、超过 10 MB、伪造 MIME、未知文件头被拒绝并返回机器可读错误。
- [x] API 不返回 R2 Object Key。
- [x] 管理员可以分页查看素材安全投影。
- [x] 匿名用户可读取 public 素材。
- [x] 有效会员可读取 member 素材，过期会员不可读取。
- [x] 只有管理员可读取 private 素材。
- [x] 受限素材未授权访问返回 404。
- [x] Public 素材支持 ETag 条件请求。
- [x] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

> 本任务已完成代码级、策略级、Migration 与 Cloudflare 构建验收。真实远程 R2 Bucket 的上传冒烟测试在部署任务绑定正式资源后执行。

## 分支与 PR

- 分支：`task/005-r2-asset-foundation`
- Pull Request：#5
- 验收通过后转为 Ready 并合并，再进入 TASK-006
