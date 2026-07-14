# TASK-009 — Hermes 研报 Upsert 与幂等导入

## 状态

已完成

## 目标

提供 Hermes 可通过 `curl` 调用的研报导入接口，实现严格校验、按 `external_id` Upsert、`Idempotency-Key` 重放、审核模式联动和机器可读错误。

## API

- `POST /api/v1/import/reports`
- `GET /api/v1/import/status/{requestId}`
- `GET /api/v1/import/reports/{externalId}`

## 范围

- `reports:write` Scope 鉴权
- `imports:read` Scope 查询
- `Idempotency-Key` 请求头校验
- 可选 `X-Request-Id` UUID 校验并回传
- 导入请求 SHA-256 哈希
- `(api_client_id, idempotency_key)` 唯一幂等规则
- 相同幂等键与相同请求重放原响应
- 相同幂等键与不同请求返回 `IDEMPOTENCY_CONFLICT`
- `(api_client_id, external_id)` 研报 Upsert
- `created`、`updated`、`unchanged` 动作
- 研报 Schema、HTML、付费墙和素材权限复用
- 审核模式开启时进入 `pending_review`
- 审核模式关闭时直接进入 `published`
- 导入成功、警告和失败日志
- 安全响应快照，用于幂等重放与状态查询
- API Actor 审计日志
- 字段级错误、重试语义和 HTTP 状态码
- curl 示例文档
- 幂等、审核模式、动作和错误响应单元测试

## 非范围

- Hermes 素材上传接口
- 市场事件和课程导入
- 预约发布
- 管理员审核退回 UI
- 异步队列和 Webhook
- IP 白名单
- 自动修复、AI 补全或内容改写

## 请求规则

- `Authorization: Bearer {token}` 必填。
- `Idempotency-Key` 必填，1–200 字符，只允许可打印 ASCII，不允许空白、换行和控制字符。
- `X-Request-Id` 可选；提供时必须是 UUID。
- 请求体必须是 JSON，最大 1 MiB。
- `external_id` 在同一 API Client 下唯一，1–200 字符。
- 网站不补字段；任何缺失或非法字段返回字段级错误。
- 请求体不保存到导入日志，只保存 SHA-256 哈希和安全响应快照。

## Upsert 规则

- 首次提交 `external_id`：创建研报，action=`created`。
- 再次提交且内容哈希变化：更新同一研报，action=`updated`。
- 再次提交且内容哈希不变：不写研报，action=`unchanged`。
- Slug 被其他研报占用：返回 `SLUG_CONFLICT`。
- 审核模式开启：创建或更新后 `status=pending_review`，HTTP 202。
- 审核模式关闭：创建或更新后 `status=published`，HTTP 200/201。
- `unchanged` 保留当前状态和发布时间。
- 更新不得覆盖其他 API Client 创建的同名 `external_id`。

## 幂等规则

- 首次处理后保存请求哈希、HTTP 状态和响应快照。
- 相同 Client、相同 Key、相同哈希：返回保存的原响应和原 HTTP 状态。
- 相同 Client、相同 Key、不同哈希：返回 409 `IDEMPOTENCY_CONFLICT`。
- 并发冲突时重新读取已提交的幂等记录并按上述规则返回。
- 失败响应也记录并可重放，避免同一无效请求重复消耗资源。

## 验收标准

- [x] 有效 `reports:write` Token 可以导入研报。
- [x] 缺少或非法 Token 被拒绝。
- [x] 缺少或非法 Idempotency-Key 被拒绝。
- [x] 非法 JSON、过大请求和字段错误返回标准错误。
- [x] 首次 external_id 创建研报。
- [x] 内容变化更新原研报，不创建重复记录。
- [x] 内容不变返回 unchanged，不修改研报时间戳。
- [x] 审核开关正确决定 pending_review 或 published。
- [x] 相同幂等请求返回原始响应快照。
- [x] 幂等键冲突返回 409。
- [x] 失败请求写入导入日志且不泄露 Token 或正文。
- [x] 查询接口只能读取当前 Client 自己的导入记录和研报。
- [x] 响应包含 request_id、action、report_id、external_id、status、url 和 warnings。
- [x] API 审计日志不保存请求正文、Token 或 Header。
- [x] curl 示例可以直接替换 Token 和 JSON 文件执行。
- [x] 自动化测试覆盖哈希、幂等、审核状态和动作决策。
- [x] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

> 本任务完成网站自动接收研报的核心链路。Hermes 素材上传将在 TASK-010 复用同一 Token、幂等和导入日志机制。

## 分支与 PR

- 分支：`task/009-hermes-report-import`
- Pull Request：#11
- 验收通过后转为 Ready 并合并，再进入 TASK-010
