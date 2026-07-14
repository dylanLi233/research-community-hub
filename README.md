# Research Community Hub

面向炒股社群成员的会员制投研内容平台。

## V1 技术架构

- Next.js App Router + TypeScript
- Cloudflare Workers + OpenNext
- Cloudflare D1 + Drizzle ORM
- Cloudflare R2（后续任务接入）
- Zod
- Vitest

网站只负责接收、确定性校验、存储、审核、发布、权限控制和展示；不负责英文 PDF 的解析、翻译或 AI 加工。

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

访问：

- 首页：`http://localhost:3000`
- 登录：`http://localhost:3000/login`
- 修改密码：`http://localhost:3000/account/password`
- 服务健康检查：`http://localhost:3000/api/health`
- 数据库健康检查：`http://localhost:3000/api/health/database`

OpenNext 在 `next dev` 中加载 Wrangler 本地平台环境，因此 Route Handler 可以访问本地 `DB` Binding 和 `.dev.vars` 中的 Secret。

## 首个管理员

系统不开放自助注册。空数据库首次使用时，先在 `.dev.vars` 设置一个足够长的随机 `BOOTSTRAP_ADMIN_SECRET`，然后调用一次 Bootstrap 接口：

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

- 未配置 `BOOTSTRAP_ADMIN_SECRET` 时接口返回 404。
- Secret 无效时返回 401。
- `users` 表存在任意记录后，接口永久返回 409。
- 接口不会返回密码或密码哈希。

生产环境通过 Wrangler 写入 Secret，不要把真实 Secret 放进仓库：

```bash
npx wrangler secret put BOOTSTRAP_ADMIN_SECRET
```

## 认证安全

- 密码使用 PBKDF2-HMAC-SHA-256、600,000 次迭代和独立随机 Salt。
- 数据库不保存明文密码。
- 浏览器只持有随机 Session Token；D1 只保存 Token 的 SHA-256 Hash。
- Session Cookie 使用 HttpOnly、SameSite=Lax，生产环境启用 Secure。
- 连续登录失败会按用户名与来源 IP 的组合哈希进行限流。
- 修改密码后撤销全部旧 Session 并签发新 Session。

## 数据库

Schema 位于：

```text
src/db/schema.ts
```

生成并校验 Migration：

```bash
npm run db:generate
npm run db:check
```

应用到本地 D1：

```bash
npm run db:migrate:local
```

应用到生产 D1：

```bash
npm run db:migrate:remote
```

`wrangler.jsonc` 当前使用全零 UUID 作为 D1 占位符，仅用于代码构建和本地数据库。创建真实 Cloudflare D1 后，必须将 `database_id` 和 `preview_database_id` 替换为真实值才能部署。

## 构建检查

```bash
npm run lint
npm run typecheck
npm run test
npm run db:generate
npm run db:check
npm run build
npm run cf:build
```

CI 会在生成 Migration 后检查仓库是否出现未提交的 Migration 漂移。

`npm run cf:build` 会使用 OpenNext 生成 Cloudflare Worker 构建产物。普通 `next dev` 运行在 Node.js，而正式部署运行在 Workers 的 `workerd`，因此两类构建都必须通过。

## Cloudflare 预览与部署

```bash
npm run preview
npm run deploy
```

R2 资源将在后续任务创建并写入 `wrangler.jsonc`。

## 开发流程

1. 每张任务卡使用独立分支。
2. 每张任务卡创建独立 Pull Request。
3. 测试和验收通过后再合并。
4. 当前任务未通过前，不进入下一张任务卡。
