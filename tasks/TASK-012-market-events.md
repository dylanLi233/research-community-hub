# TASK-012 — 重要会议与市场事件模型、管理与导入

## 状态

开发中

## 目标

建立“下周重要会议与事件时间表”所需的结构化事件模型、管理员 CRUD、发布状态机和 Hermes 幂等导入接口，为后续前台日历与周度事件表提供稳定数据源。

## 范围

- D1 `market_events` 表、约束、索引和 Drizzle Migration
- 管理员事件创建、列表、详情和编辑 API
- 显式发布与归档操作
- Hermes `events:write` 幂等 Upsert
- `imports:read` external_id 查询
- 审核模式联动
- `created`、`updated`、`unchanged` 动作
- 事件内容 SHA-256 哈希
- 日期、时间、时区、分类、重要性和关注点校验
- API 与管理员审计日志
- 导入成功、警告和失败响应快照
- curl 示例文档
- 字段规范化、时间范围、动作和审核状态测试

## 管理员 API

- `GET /api/admin/events`
- `POST /api/admin/events`
- `GET /api/admin/events/{id}`
- `PATCH /api/admin/events/{id}`
- `POST /api/admin/events/{id}/publish`
- `POST /api/admin/events/{id}/archive`

## Hermes API

- `POST /api/v1/import/events`
- `GET /api/v1/import/events/{externalId}`
- 复用 `GET /api/v1/import/status/{requestId}`

## 字段

- `external_id`
- `title`
- `event_date`：`YYYY-MM-DD`
- `starts_at`：可选 ISO 8601 时间
- `ends_at`：可选 ISO 8601 时间
- `timezone`：IANA 时区，默认 `Asia/Shanghai`
- `all_day`
- `category`
- `importance`
- `region`
- `summary`
- `impact`
- `focus_points`
- `source_name`
- `source_url`
- `tags`
- `access_level`
- `status`

## 枚举

### category

- `macro`
- `policy`
- `central_bank`
- `economic_data`
- `industry`
- `company`
- `earnings`
- `market`
- `geopolitics`
- `other`

### importance

- `high`
- `medium`
- `low`

### access_level

- `public`
- `member`
- `private`

## 业务规则

- 管理员创建事件时状态固定为 `draft`。
- Hermes 创建或更新事件时，审核开启进入 `pending_review`，审核关闭直接 `published`。
- `event_date` 必须是有效日历日期。
- `starts_at` 和 `ends_at` 必须包含时区偏移。
- 提供 `starts_at` 时，其日期必须与 `event_date` 在指定时区下对应。
- `ends_at` 必须晚于 `starts_at`。
- `all_day=true` 时不得提供 starts_at 或 ends_at。
- `focus_points` 最多 8 条，每条最多 300 字符，去重并删除空项。
- `tags` 最多 10 个，每个最多 30 字符，去重。
- `source_url` 仅允许 HTTP 或 HTTPS。
- `external_id` 在同一 API Client 下唯一。
- 相同 external_id、内容哈希变化时更新原事件。
- 内容哈希不变返回 unchanged，不修改事件时间戳和状态。
- 普通 PATCH 不允许直接修改状态、导入归属和审计字段。
- 发布和归档只能通过显式动作接口。
- 已软删除 external_id 不自动恢复。

## 非范围

- 前台 `/events` 日历与表格
- 邮件和 Markdown 导出
- 日历订阅 ICS
- 自动抓取会议时间
- AI 补全和事件影响判断
- 提醒与推送
- 批量导入
- 事件关联股票与行业表

## 验收标准

- [ ] Migration 可在空数据库应用并可重复执行迁移命令。
- [ ] 管理员可创建、筛选、读取和编辑事件。
- [ ] 非管理员、未登录或跨源写请求被拒绝。
- [ ] 日期、时间范围、时区、分类和重要性错误返回字段级错误。
- [ ] 管理员 PATCH 不能直接修改状态。
- [ ] 发布和归档记录审计日志。
- [ ] 有效 `events:write` Token 可以导入事件。
- [ ] external_id 首次创建、变化更新、不变 unchanged。
- [ ] 审核开关正确决定 pending_review 或 published。
- [ ] 相同 Idempotency-Key 重放原响应，不同请求返回 409。
- [ ] 失败请求写入导入日志且不保存完整请求体或 Token。
- [ ] external_id 查询仅能读取当前 Client 自己的事件。
- [ ] curl 文档可直接替换 Token 和 JSON 文件执行。
- [ ] 自动化测试覆盖日期、时间范围、字段规范化、哈希和动作决策。
- [ ] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/012-market-events`
- Pull Request：待创建
- 验收通过后转为 Ready 并合并，再进入 TASK-013 前台事件日历
