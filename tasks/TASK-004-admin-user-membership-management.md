# TASK-004 — 管理员用户与会员管理

## 状态

已完成

## 目标

让管理员可以在网站后台手工创建和维护社群成员账号，并建立后续会员内容权限所需的统一会员状态判定。

## 范围

- 服务端 `requireSession` 与 `requireAdmin` 鉴权辅助函数
- 会员状态计算：未开始、有效、已到期、停用、无会员记录
- 管理员用户列表、详情、创建和更新 API
- 管理员创建用户名与初始密码
- 用户名唯一和规范化校验
- 修改显示名称、角色和账号状态
- 设置会员开始时间、到期时间、状态和备注
- 续期会员
- 管理员重置用户密码
- 重置后强制用户首次登录修改密码
- 撤销指定用户全部 Session
- 禁用账号后立即撤销全部 Session
- 防止禁用或降级最后一个有效管理员
- 管理后台用户列表、创建和编辑页面
- 所有关键写操作记录审计日志
- 会员策略、管理员安全策略和输入规则自动化测试

## API

- `GET /api/admin/users`
- `POST /api/admin/users`
- `GET /api/admin/users/{id}`
- `PATCH /api/admin/users/{id}`
- `POST /api/admin/users/{id}/reset-password`
- `POST /api/admin/users/{id}/revoke-sessions`

## 页面

- `/admin/users`
- `/admin/users/new`
- `/admin/users/{id}`

## 非范围

- 用户自助注册
- 在线支付、订单和自动续费
- 批量导入用户
- 邮件或短信发送初始密码
- Hermes API Client 管理
- 研报、事件、课程与内容权限渲染
- 细粒度后台 RBAC

## 业务规则

- 用户名按 NFKC 和小写形式建立唯一约束，但展示保留管理员输入的规范化原样。
- 管理员创建用户时必须设置 12–128 字符的初始密码。
- 新建用户默认 `must_change_password=true`。
- 管理员不能读取任何用户的现有密码或密码哈希。
- 重置密码后撤销该用户全部 Session。
- 禁用账号后立即撤销该用户全部 Session。
- 会员有效条件：账号为 active、会员记录为 active、开始时间不晚于当前时间、到期时间为空或晚于当前时间。
- `expires_at=null` 表示长期有效。
- `expires_at` 必须晚于 `starts_at`。
- 系统必须至少保留一个 active 管理员，禁止禁用或降级最后一个 active 管理员。
- 管理员不能删除用户；V1 只允许禁用。

## 验收标准

- [x] 未登录访问管理 API 返回 401。
- [x] 非管理员访问管理 API 返回 403。
- [x] 管理员可以创建普通会员和管理员账号。
- [x] 重复用户名返回 409，不泄露密码数据。
- [x] 创建用户时密码只以哈希形式存储。
- [x] 管理员可以更新账号状态、角色、显示名称和会员期限。
- [x] 会员状态计算覆盖未开始、有效、已到期、停用和无记录。
- [x] 禁用账号和重置密码会撤销全部未撤销 Session。
- [x] 无法禁用或降级最后一个 active 管理员。
- [x] 管理接口响应使用安全投影，不包含 `password_hash`、Session Token Hash 等敏感字段。
- [x] 管理员后台可以完成列表、创建、编辑、续期、重置密码和撤销会话。
- [x] 关键操作写入审计日志。
- [x] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

> 本任务完成代码级、策略级和构建级验收；浏览器端完整 E2E 回归在系统集成任务中统一执行。

## 分支与 PR

- 分支：`task/004-admin-user-membership-management`
- Pull Request：#4
- 验收通过后转为 Ready 并合并，再进入 TASK-005
