# TASK-008 — Hermes API 鉴权与审核模式

## 状态

开发中

## 目标

建立 Hermes 调用网站导入接口所需的 API Client、Bearer Token 和 Scope 鉴权底座，并提供可由管理员开启或关闭的人工审核模式。

## 范围

- `review_mode = on | off` 系统配置
- 审核模式管理员读取和修改 API
- API Client 创建、列表、详情和修改 API
- API Token 创建、元数据列表和撤销 API
- Token 明文仅创建成功时返回一次
- 数据库仅保存 Token SHA-256 哈希和安全前缀
- API Client 与 Token 启用、禁用、撤销和到期判断
- Bearer Token 解析
- Scope 白名单和强制鉴权
- `requireApiClientRequest` 服务端鉴权助手
- Token 最后使用时间更新
- 管理员操作审计日志
- Token、Scope、审核模式和鉴权策略单元测试

## API

- `GET /api/admin/settings/review-mode`
- `PATCH /api/admin/settings/review-mode`
- `GET /api/admin/api-clients`
- `POST /api/admin/api-clients`
- `GET /api/admin/api-clients/{id}`
- `PATCH /api/admin/api-clients/{id}`
- `GET /api/admin/api-clients/{id}/tokens`
- `POST /api/admin/api-clients/{id}/tokens`
- `POST /api/admin/api-clients/{id}/tokens/{tokenId}/revoke`

## Scope

- `assets:write`
- `reports:write`
- `events:write`
- `courses:write`
- `imports:read`

## 非范围

- Hermes 素材上传和研报 Upsert
- Idempotency-Key 和导入日志写入
- 自动发布、待审核或退回流程
- IP 白名单
- OAuth、JWT 或第三方身份系统
- Token 自动轮换
- 前台页面

## 安全规则

- Token 格式使用固定前缀加高熵随机值。
- 明文 Token 只在创建响应中返回一次，之后无法读取。
- Token 数据库字段只保存 SHA-256 哈希。
- Token 查询和撤销 API 只能返回前缀、状态、到期时间和最后使用时间。
- Client disabled、Token revoked、Token expired 或 Scope 缺失均拒绝请求。
- 认证失败统一返回 `API_TOKEN_INVALID`，避免泄露具体状态。
- Scope 不足返回 `SCOPE_DENIED`。
- Token 到期时间可为空；非空时必须晚于创建时间。
- 管理员写请求必须通过 Session、管理员权限和同源检查。
- 审核模式缺少配置时默认 `on`。
- 所有 Client、Token 和审核模式变更必须记录审计日志。

## 验收标准

- [ ] 管理员可创建 API Client 并设置 Scope。
- [ ] Client 名称唯一，冲突返回明确错误。
- [ ] 管理员可禁用 Client 和调整 Scope。
- [ ] 管理员可创建 Token，响应只在本次返回明文。
- [ ] Token 列表不返回明文或哈希。
- [ ] 管理员可撤销 Token，重复撤销保持幂等。
- [ ] 有效 Token 与正确 Scope 可通过鉴权。
- [ ] 无效、撤销、过期或禁用 Client Token 被统一拒绝。
- [ ] Scope 不足返回 `SCOPE_DENIED`。
- [ ] 成功鉴权更新 `last_used_at`。
- [ ] 审核模式缺失时读取为 `on`。
- [ ] 管理员可在 `on` 和 `off` 间切换审核模式。
- [ ] API Token 明文、哈希和 Authorization Header 不进入审计日志。
- [ ] 自动化测试覆盖 Token 格式、Bearer 解析、Scope 和审核模式策略。
- [ ] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/008-hermes-auth-review-mode`
- Pull Request：待创建
- 验收通过后转为 Ready 并合并，再进入 TASK-009
