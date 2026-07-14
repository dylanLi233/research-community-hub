# TASK-002 — D1 与 Drizzle 数据库底座

## 状态

开发中

## 目标

建立 Cloudflare D1 的本地开发、Schema、迁移和类型安全访问底座，为后续登录、会员、Hermes API 和审计功能提供统一数据库基础。

## 范围

- Cloudflare D1 `DB` Binding
- Next.js 开发环境中的 Cloudflare Context 初始化
- Drizzle ORM 与 Drizzle Kit
- 数据库连接辅助函数
- 第一版平台基础表：
  - `users`
  - `memberships`
  - `sessions`
  - `app_settings`
  - `api_clients`
  - `api_tokens`
  - `import_requests`
  - `audit_logs`
- 索引、唯一约束、外键和基础 Check 约束
- Drizzle SQL Migration
- 本地 D1 迁移校验
- 数据库健康检查接口

## 非范围

- 登录、退出和密码校验
- 管理员用户页面
- 会员权限中间件
- Hermes 内容导入接口
- 研报、事件、课程和素材业务表
- 生产 D1 实例创建与真实 `database_id`
- Seed 管理员账号

## 技术决策

- 数据库：Cloudflare D1 / SQLite
- ORM：Drizzle ORM
- Migration：Drizzle Kit 生成 SQL，Wrangler 负责应用
- 主键：应用层生成 UUID，数据库使用 `TEXT`
- 时间：Unix epoch milliseconds，数据库使用 `INTEGER`
- JSON：数据库使用 `TEXT`，Drizzle 以 JSON Mode 映射
- 用户名：同时保存显示值和规范化小写值；唯一约束作用于规范化字段

## 验收标准

- [ ] `wrangler.jsonc` 声明 `DB` D1 Binding。
- [ ] `next dev` 可通过 OpenNext Cloudflare Context 访问本地 D1。
- [ ] `getDb()` 返回带 Schema 类型的 Drizzle D1 Client。
- [ ] 基础表、外键、唯一索引和查询索引定义完整。
- [ ] Migration 文件由 Drizzle Kit 生成并纳入版本控制。
- [ ] `npm run db:migrate:local` 可在空本地 D1 上成功应用 Migration。
- [ ] 重复应用 Migration 不会重复建表或失败。
- [ ] `GET /api/health/database` 成功时返回 `status=ok`，不可用时返回 503。
- [ ] `npm run lint`、`npm run typecheck`、`npm run build`、`npm run cf:build` 通过。
- [ ] CI 校验 Drizzle Migration 和本地 D1 Migration。

## 分支与 PR

- 分支：`task/002-d1-drizzle-foundation`
- 独立 Draft Pull Request
- 验收通过后合并，再进入 TASK-003
