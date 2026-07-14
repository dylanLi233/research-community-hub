# Research Community Hub

面向炒股社群成员的会员制投研内容平台。网站负责接收、确定性校验、存储、审核、发布、权限控制和展示；英文 PDF 的解析、翻译和内容加工由 Hermes 或其他上游工作流完成。

## 已实现功能

### 内容模块

- **研报精选**：管理员管理、Hermes 幂等导入、访客试读、会员全文。
- **重要事件**：管理员管理、Hermes 幂等导入、按周事件时间表、会员影响判断与重点观察。
- **宏观课程**：课程/章节管理、Hermes 幂等导入、课程目录、章节试读与会员全文。

### 平台能力

- 用户名/密码登录与 Session
- 管理员手工创建用户和会员有效期
- public、member、private 服务端权限控制
- HTML 白名单清洗与 `<!-- PAYWALL -->` 服务端裁剪
- Cloudflare R2 图片素材和 `/media/{id}` 权限路由
- Hermes API Client、一次性 Token、Scope 和撤销
- `Idempotency-Key`、请求哈希、响应快照和导入日志
- 人工审核模式开关
- D1 审计日志
- Cloudflare Workers / OpenNext 构建

## 技术架构

- Next.js App Router + TypeScript
- React 19
- Cloudflare Workers + OpenNext
- Cloudflare D1 + Drizzle ORM
- Cloudflare R2
- Zod
- Vitest

## 主要页面

```text
/                         首页
/login                    登录
/account/password         修改密码
/reports                  研报列表
/reports/{slug}           研报阅读
/events                   周度重要事件时间表
/courses                  课程列表
/courses/{slug}           课程介绍与目录
/courses/{slug}/{chapter} 章节阅读
/admin/users              用户与会员管理
/admin/assets             素材管理
```

健康检查：

```text
/api/health
/api/health/database
```

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

默认访问地址：

```text
http://localhost:3000
```

OpenNext 在 `next dev` 中加载 Wrangler 本地平台环境，因此 Route Handler 可以访问本地 `DB`、`MEDIA_BUCKET` 和 `.dev.vars` 中的 Secret。

## 首个管理员

系统不开放自助注册。空数据库首次使用时，在 `.dev.vars` 设置随机 `BOOTSTRAP_ADMIN_SECRET`，然后调用一次：

```bash
curl -X POST http://localhost:3000/api/setup/admin \
  -H "Authorization: Bearer $BOOTSTRAP_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "displayName": "管理员",
    "password": "replace-with-a-strong-password"
  }'
```

规则：

- 未配置 Secret 时接口返回 404。
- Secret 无效时返回 401。
- `users` 表存在任意记录后，接口永久返回 409。
- 接口不会返回密码或密码哈希。

## 数据库

Schema 分布在：

```text
src/db/schema.ts
src/db/assets-schema.ts
src/db/reports-schema.ts
src/db/events-schema.ts
src/db/courses-schema.ts
src/db/import-schema.ts
```

常用命令：

```bash
npm run db:generate
npm run db:check
npm run db:migrate:local
npm run db:migrate:remote
```

不要修改已经应用的历史 Migration。Schema 变化应生成新的 Migration，并通过空数据库和重复应用检查。

## Hermes 导入文档

```text
docs/HERMES_ASSET_IMPORT.md
docs/HERMES_REPORT_IMPORT.md
docs/HERMES_EVENT_IMPORT.md
docs/HERMES_COURSE_IMPORT.md
```

Hermes Token 由管理员创建，数据库只保存 Token Hash，明文只在创建成功时返回一次。

## 构建与验收

```bash
npm run deploy:check:ci
npm run lint
npm run typecheck
npm run test
npm run db:generate
npm run db:check
npm run db:migrate:local
npm run db:migrate:local
npm run build
npm run cf:build
```

CI 会检查：

- Cloudflare 配置结构
- Lint 和 TypeScript
- Vitest
- Migration 漂移
- D1 Migration 首次和重复执行
- Next.js 构建
- OpenNext Cloudflare 构建

## Cloudflare 部署

完整生产部署手册：

```text
docs/CLOUDFLARE_DEPLOYMENT.md
```

仓库中的 `wrangler.jsonc` 故意保留全零 D1 UUID。创建真实 Cloudflare D1 后，必须替换：

```text
database_id
preview_database_id
```

生产部署命令：

```bash
npm run deploy:check
npm run db:migrate:remote
npm run deploy
```

`npm run deploy` 会在 OpenNext 构建和上传前自动执行配置检查；全零 D1 UUID、Binding 缺失或 OpenNext 配置错误会阻止部署。

R2 素材桶名称固定为：

```text
research-community-hub-media
```

R2 桶保持私有，素材通过 `/media/{id}` 读取，不开放 R2 公共域名。

## 认证与内容安全

- 密码使用 PBKDF2-HMAC-SHA-256、600,000 次迭代和独立随机 Salt。
- 数据库不保存明文密码。
- 浏览器持有随机 Session Token，D1 只保存 Token SHA-256 Hash。
- Session Cookie 使用 HttpOnly、SameSite=Lax，生产环境启用 Secure。
- 修改密码后撤销全部旧 Session。
- HTML 在保存前执行固定白名单清洗。
- 访客响应不会包含付费墙后的会员 HTML。
- 研报、事件和课程页面使用 `private, no-store` 与 `Vary: Cookie`。
- R2 Object Key、Bearer Token、密码和 Authorization Header 不进入前台响应或审计元数据。

## 开发流程

1. 每张任务卡使用独立分支。
2. 每张任务卡创建独立 Draft Pull Request。
3. Lint、Typecheck、Vitest、Migration、Next.js 和 OpenNext 全部通过后再转为 Ready。
4. 使用 squash merge 合并到 `main`。
5. 生产资源 ID 和 Secret 永远不提交到仓库。
