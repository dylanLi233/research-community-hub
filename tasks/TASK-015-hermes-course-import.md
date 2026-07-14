# TASK-015 — Hermes 课程与章节幂等导入

## 状态

开发中

## 目标

提供 Hermes 可通过 JSON 和 `curl` 调用的课程与章节导入接口，实现按 `external_id` Upsert、审核模式联动、HTML/素材校验、Idempotency-Key 重放和导入日志。

## API

### 课程

- `POST /api/v1/import/courses`
- `GET /api/v1/import/courses/{externalId}`

### 章节

- `POST /api/v1/import/courses/{courseExternalId}/chapters`
- `GET /api/v1/import/courses/{courseExternalId}/chapters/{chapterExternalId}`

复用：

- `GET /api/v1/import/status/{requestId}`

## 权限

- `courses:write`
- `imports:read`

## 范围

- 课程 snake_case 严格 JSON Schema
- 章节 snake_case 严格 JSON Schema
- 课程与章节 `external_id` Upsert
- `created`、`updated`、`unchanged`
- 审核开启进入 `pending_review`
- 审核关闭直接进入 `published`
- Idempotency-Key、X-Request-Id 和 1 MiB 限制
- 稳定 JSON SHA-256 请求哈希
- 课程简介和章节正文 HTML 清洗
- 章节付费墙规则
- 课程封面、简介和章节素材权限校验
- 课程与章节 Slug 冲突
- 导入成功、警告和失败日志
- 安全响应快照和原响应重放
- API Actor 审计日志
- external_id 查询
- curl 示例文档
- Schema、动作、审核状态和父子归属测试

## 课程请求字段

- `external_id`
- `title`
- `subtitle`
- `slug`
- `summary`
- `description_html`
- `cover_asset_id`
- `instructor_name`
- `tags`
- `access_level`
- `seo.title`
- `seo.description`

## 章节请求字段

- `external_id`
- `title`
- `slug`
- `summary`
- `body_html`
- `access_level`
- `preview_mode`
- `position`
- `estimated_minutes`

## 业务规则

- 课程 external_id 在同一 API Client 下唯一。
- 章节 external_id 在同一课程内唯一。
- 章节导入路径中的 courseExternalId 必须属于当前 API Client。
- 课程首次导入 action=created；哈希变化 updated；哈希相同 unchanged。
- 章节首次导入 action=created；哈希变化 updated；哈希相同 unchanged。
- unchanged 不修改时间戳、状态和发布时间。
- 审核开启时，课程或章节变化后进入 pending_review，HTTP 202。
- 审核关闭时，创建返回 201，更新返回 200，状态 published。
- 课程更新不自动修改章节状态。
- 章节导入允许父课程处于 draft、pending_review 或 published；父课程 archived 或 deleted 时拒绝。
- 已软删除的课程或章节 external_id 不自动恢复。
- 课程 slug 全站唯一；章节 slug 在课程内唯一。
- 网站不补字段、不改写正文、不调用 AI。

## 幂等规则

- 每个导入请求必须提供 Idempotency-Key。
- 相同 Client、相同 Key、相同请求哈希：重放原响应。
- 相同 Client、相同 Key、不同请求哈希：409 `IDEMPOTENCY_CONFLICT`。
- 失败请求也记录并重放。
- 课程与章节使用不同 endpoint，因此 Hermes 应使用不同 Key 命名空间。

## 非范围

- 前台课程目录与阅读页
- 批量导入整个课程包
- 自动创建缺失的父课程
- 视频、音频、附件和测验
- 学习进度、证书与支付
- 课程版本回滚

## 验收标准

- [ ] 有效 `courses:write` Token 可导入课程和章节。
- [ ] 缺少 Token、Scope 或 Idempotency-Key 被拒绝。
- [ ] 严格 Schema 拒绝未知字段和缺失字段。
- [ ] 课程 external_id 首次创建、变化更新、不变 unchanged。
- [ ] 章节 external_id 首次创建、变化更新、不变 unchanged。
- [ ] 章节只能导入到当前 Client 自己的课程。
- [ ] 父课程不存在、归档或删除时返回明确错误。
- [ ] 审核开关正确决定 pending_review 或 published。
- [ ] HTML、付费墙和素材权限错误返回字段级错误。
- [ ] 课程和章节 Slug 冲突返回明确错误。
- [ ] 相同幂等请求重放原响应。
- [ ] 幂等键冲突返回 409。
- [ ] 失败请求写入导入日志且不保存正文、Token 或 Header。
- [ ] external_id 查询只能读取当前 Client 自己的课程和章节。
- [ ] curl 文档可直接执行。
- [ ] 自动化测试覆盖 Schema、动作决策、审核状态和父子归属策略。
- [ ] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/015-hermes-course-import`
- Pull Request：待创建
- 验收通过后转为 Ready 并合并，再进入 TASK-016 前台课程阅读
