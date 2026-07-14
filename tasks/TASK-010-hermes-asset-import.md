# TASK-010 — Hermes 素材上传与幂等导入

## 状态

开发中

## 目标

提供 Hermes 可通过 Multipart Form Data 上传研报封面和正文图片的接口，复用现有 R2、D1、Token、Scope、幂等和导入日志底座，并返回可直接写入研报 HTML 的 `/media/{assetId}` 地址。

## API

- `POST /api/v1/import/assets`
- `GET /api/v1/import/assets/{externalId}`
- 复用 `GET /api/v1/import/status/{requestId}`

## 范围

- `assets:write` Scope 鉴权
- `imports:read` Scope 查询
- Multipart Form Data 图片上传
- `external_id`、`access_level`、`alt_text` 元数据
- JPEG、PNG、WebP 文件头、MIME、大小和 SHA-256 校验
- R2 Object 写入
- D1 素材元数据和 API Client 归属
- `(api_client_id, external_id)` 唯一规则
- `created` 与 `unchanged` 动作
- 不可变 external_id 冲突规则
- `Idempotency-Key` 请求重放与冲突
- 导入成功、警告和失败日志
- 安全响应快照
- R2 写入后 D1 失败的补偿删除
- API Actor 审计日志
- curl 示例文档
- 元数据、动作决策、规范哈希和不可变策略测试

## 非范围

- 图片压缩、裁剪、格式转换和缩略图
- SVG、GIF、视频、音频和 PDF
- 覆盖或替换已经存在的素材内容
- 分片上传和超大文件
- 外链图片抓取
- 素材批量上传
- 管理员素材页面改版

## 请求格式

`Content-Type: multipart/form-data`

字段：

- `external_id`：必填，1–200 字符，只允许字母、数字、点、下划线、冒号和连字符。
- `access_level`：必填，`public | member | private`。
- `alt_text`：可选，最多 500 字符。
- `file`：必填，JPEG、PNG 或 WebP，1 Byte–10 MiB。

请求总大小上限为 10.5 MiB，用于容纳 Multipart 边界和元数据。

## external_id 规则

- external_id 在同一个 API Client 下唯一。
- 首次提交：创建新素材，action=`created`。
- 再次提交，文件 SHA-256、access_level 和 alt_text 完全一致：action=`unchanged`。
- 再次提交但文件或关键元数据不同：返回 409 `ASSET_EXTERNAL_ID_CONFLICT`。
- deleted 素材的 external_id 不允许自动复用，返回 409 `ASSET_EXTERNAL_ID_DELETED`。
- 素材不可被静默覆盖，避免已发布研报中的图片发生变化。

## 幂等规则

- `Idempotency-Key` 必填，沿用 TASK-009 格式。
- 有效请求使用 external_id、文件 SHA-256、access_level 和 alt_text 生成稳定请求哈希，不受 Multipart boundary 和文件名变化影响。
- 无效 Multipart 请求使用原始请求字节 SHA-256 记录。
- 相同 Client、Key 和哈希：重放原响应。
- 相同 Client、Key 但不同哈希：返回 409 `IDEMPOTENCY_CONFLICT`。
- 并发创建冲突时删除本次新写入的 R2 Object，再重放已提交响应。

## 响应

成功响应包含：

- `request_id`
- `client_request_id`（若提供）
- `action`
- `asset_id`
- `external_id`
- `access_level`
- `mime_type`
- `size_bytes`
- `sha256`
- `url`
- `warnings`

## 验收标准

- [ ] 有效 `assets:write` Token 可以上传素材。
- [ ] 缺少 Token、Scope 或 Idempotency-Key 被拒绝。
- [ ] 非 Multipart、缺少字段、空文件、超大文件和非法图片被拒绝。
- [ ] 上传文件只存 R2，D1 只保存元数据。
- [ ] 首次 external_id 创建素材并返回 `/media/{UUID}`。
- [ ] 相同 external_id 和相同内容返回 unchanged。
- [ ] 相同 external_id 但内容或访问级别不同返回 409。
- [ ] 已删除 external_id 不会被自动复用。
- [ ] 相同幂等请求重放原响应。
- [ ] 幂等键内容冲突返回 409。
- [ ] D1 失败时删除本次 R2 Object。
- [ ] 并发幂等冲突不会留下孤儿 R2 Object。
- [ ] 查询接口只能读取当前 Client 自己上传的素材。
- [ ] API 响应和日志不返回 R2 Object Key。
- [ ] 审计日志不保存文件字节、Token 或 Authorization Header。
- [ ] curl 文档可直接替换 Token 和文件路径执行。
- [ ] 自动化测试覆盖元数据、稳定哈希、created/unchanged/conflict 和 deleted 策略。
- [ ] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/010-hermes-asset-import`
- Pull Request：待创建
- 验收通过后转为 Ready 并合并，再进入 TASK-011
