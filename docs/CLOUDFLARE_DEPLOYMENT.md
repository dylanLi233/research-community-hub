# Cloudflare 生产部署手册

本文档用于将 Research Community Hub 部署到 Cloudflare Workers，并接入正式 D1 与私有 R2。

仓库不会保存真实 Cloudflare 资源 ID、管理员密码或 Secret。部署者需要在自己的 Cloudflare 账号中创建资源，再将非敏感的 D1 UUID 写入 `wrangler.jsonc`。

## 0. 部署前确认

建议使用 Node.js 22，并确保当前目录是最新的 `main`：

```bash
git checkout main
git pull
node --version
npm install
npx wrangler whoami
```

尚未登录 Cloudflare 时执行：

```bash
npx wrangler login
```

先完成全部代码检查：

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

此时 `npm run deploy:check` 仍应失败，因为仓库中的 D1 UUID 是全零占位符。这是预期行为。

## 1. 创建正式 D1 数据库

创建数据库名称必须与 `wrangler.jsonc` 保持一致：

```bash
npx wrangler d1 create research-community-hub
```

命令输出会包含正式数据库的 `database_id`。保存该 UUID。

如果 Wrangler 询问是否自动修改配置，建议选择不覆盖现有配置，然后手工替换 `wrangler.jsonc` 中的占位 UUID，以免改变已经固定的 Binding 名称 `DB` 和 Migration 目录。

## 2. 创建预览 D1 数据库

为本地远程预览、测试部署和生产数据隔离创建独立数据库：

```bash
npx wrangler d1 create research-community-hub-preview
```

保存输出的 UUID，并将其用于 `preview_database_id`。

预览库名称不需要写入生产 `database_name`；`wrangler.jsonc` 仍保留：

```json
{
  "binding": "DB",
  "database_name": "research-community-hub",
  "database_id": "<正式 D1 UUID>",
  "preview_database_id": "<预览 D1 UUID>",
  "migrations_dir": "drizzle/migrations"
}
```

不要把两个字段继续保留为：

```text
00000000-0000-0000-0000-000000000000
```

替换完成后执行：

```bash
npm run deploy:check
```

检查必须通过后才能继续。

## 3. 创建私有 R2 素材桶

素材桶名称已经固定为 `research-community-hub-media`：

```bash
npx wrangler r2 bucket create research-community-hub-media
```

确认资源存在：

```bash
npx wrangler r2 bucket list
```

R2 桶保持私有，不要为它开启公共域名或 `r2.dev` 公共访问。研报、事件和课程中的图片统一通过应用的 `/media/{assetId}` 路由读取，由服务端根据 public、member、private 权限判定。

`wrangler.jsonc` 中应保持：

```json
{
  "binding": "MEDIA_BUCKET",
  "bucket_name": "research-community-hub-media"
}
```

## 4. 检查最终 Binding

部署前的关键配置应满足：

```text
Worker name: research-community-hub
Static assets binding: ASSETS
D1 binding: DB
R2 binding: MEDIA_BUCKET
D1 database name: research-community-hub
R2 bucket name: research-community-hub-media
nodejs_compat: enabled
D1 production UUID: non-zero
D1 preview UUID: non-zero
```

执行生产检查：

```bash
npm run deploy:check
```

该命令会阻止以下情况继续部署：

- D1 UUID 仍为全零占位符
- DB、MEDIA_BUCKET 或 ASSETS Binding 缺失
- OpenNext Worker 入口或静态资源目录错误
- `nodejs_compat` 缺失
- Compatibility Date 过旧
- 数据库名或素材桶名与应用约定不一致

## 5. 应用正式数据库 Migration

先查看待执行 Migration：

```bash
npx wrangler d1 migrations list research-community-hub --remote
```

应用仓库中已经验收的全部 Migration：

```bash
npm run db:migrate:remote
```

再次执行相同命令确认没有遗漏：

```bash
npm run db:migrate:remote
```

生产首次部署必须在开放业务流量前完成 Migration，否则登录、会员、素材、研报、事件和课程接口都会因为缺表失败。

## 6. 首次部署 Worker

执行：

```bash
npm run deploy
```

`deploy` 会先执行 `npm run deploy:check`，然后构建 Next.js、生成 OpenNext Worker 并部署到 Cloudflare。

记录输出的 `workers.dev` 地址，例如：

```text
https://research-community-hub.<subdomain>.workers.dev
```

先不要绑定正式域名。

## 7. 首次无管理员冒烟检查

设置临时变量：

```bash
export BASE_URL="https://research-community-hub.<subdomain>.workers.dev"
```

检查 Worker 和 D1：

```bash
curl --fail-with-body "$BASE_URL/api/health"
curl --fail-with-body "$BASE_URL/api/health/database"
```

检查公开页面返回正常 HTML：

```bash
curl --fail-with-body "$BASE_URL/"
curl --fail-with-body "$BASE_URL/reports"
curl --fail-with-body "$BASE_URL/events"
curl --fail-with-body "$BASE_URL/courses"
```

此时 Bootstrap Secret 尚未配置，`POST /api/setup/admin` 应表现为接口不存在。

## 8. 临时写入 Bootstrap Secret

在本地生成足够长的随机 Secret，例如：

```bash
export BOOTSTRAP_ADMIN_SECRET="$(openssl rand -base64 48)"
printf '%s' "$BOOTSTRAP_ADMIN_SECRET" | npx wrangler secret put BOOTSTRAP_ADMIN_SECRET
```

不要把 Secret 写入：

- Git 提交
- `wrangler.jsonc` 的 `vars`
- README 或部署日志
- 聊天记录或工单

`wrangler secret put` 会为 Worker 创建并部署一个包含 Secret 的新版本。

## 9. 创建首个管理员

准备强密码，不要直接复用 Bootstrap Secret：

```bash
export ADMIN_PASSWORD="replace-with-a-unique-strong-password"
```

调用一次 Bootstrap 接口：

```bash
curl --fail-with-body \
  -X POST "$BASE_URL/api/setup/admin" \
  -H "Authorization: Bearer $BOOTSTRAP_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"admin\",
    \"displayName\": \"管理员\",
    \"password\": \"$ADMIN_PASSWORD\"
  }"
```

成功响应应为 HTTP `201`，并返回管理员 ID、用户名和角色，但不会返回密码或密码哈希。

验证一次性关闭规则：再次调用相同接口应返回 HTTP `409 BOOTSTRAP_ALREADY_COMPLETED`。

## 10. 删除 Bootstrap Secret

管理员创建成功后立即执行：

```bash
npx wrangler secret delete BOOTSTRAP_ADMIN_SECRET
unset BOOTSTRAP_ADMIN_SECRET
unset ADMIN_PASSWORD
```

删除后再次请求 Bootstrap 接口应返回 HTTP `404`。这样即使后续出现应用层错误，也不能通过该接口创建第二个初始管理员。

## 11. 登录与后台冒烟检查

浏览器打开：

```text
$BASE_URL/login
```

用刚创建的管理员账号登录，依次检查：

- `/admin/users`：用户和会员管理
- `/admin/assets`：素材上传和列表
- 管理员研报 API
- 管理员事件 API
- 管理员课程与章节 API
- 审核模式 API
- API Client 与 Token API

建议创建一个测试会员账号，分别验证：

1. 未登录访客只能看到研报/章节试读和事件基础信息。
2. 有效会员可以查看完整 member 研报、事件影响与重点观察、member 课程章节。
3. 会员过期后，受限正文和字段不再出现在 HTML 或 React Server Component 数据中。
4. 管理员始终可以查看会员内容。

## 12. 创建 Hermes API Client

在管理员鉴权下创建 API Client，并配置所需 Scope：

```text
assets:write
reports:write
events:write
courses:write
imports:read
```

创建 Token 时，明文 Token 只返回一次。立即保存到 Hermes 的 Secret 管理中，不要存入仓库。

然后按以下文档做真实导入冒烟：

- `docs/HERMES_ASSET_IMPORT.md`
- `docs/HERMES_REPORT_IMPORT.md`
- `docs/HERMES_EVENT_IMPORT.md`
- `docs/HERMES_COURSE_IMPORT.md`

推荐顺序：

1. 上传 public 封面或正文素材。
2. 用返回的 `/media/{assetId}` 写入 HTML。
3. 导入研报、事件或课程。
4. 审核模式开启时，在管理员端发布内容。
5. 从访客和会员两个会话验证权限差异。

## 13. 绑定自定义域名

只有 workers.dev 冒烟检查完全通过后再绑定域名。

在 Cloudflare Dashboard 中进入：

```text
Workers & Pages
→ research-community-hub
→ Settings
→ Domains & Routes
→ Add Custom Domain
```

绑定后更新：

```bash
export BASE_URL="https://your-domain.example"
```

重新执行公开页面、登录、D1、R2 和 Hermes 冒烟检查。

如果域名切换后登录 Cookie 异常，优先检查：

- 是否全站使用 HTTPS
- 浏览器是否仍保存旧 workers.dev Cookie
- 是否发生跨域跳转
- 登录 returnTo 是否为站内相对路径

## 14. 生产更新顺序

后续每次更新建议按以下顺序：

```bash
git pull
npm install
npm run deploy:check
npm run check
npx wrangler d1 migrations list research-community-hub --remote
npm run db:migrate:remote
npm run deploy
```

原则：

- 先确认 Migration 可应用，再部署依赖新表或新字段的代码。
- 破坏性 Schema 变更需要单独的迁移与回滚方案。
- 不要手工修改已经应用的历史 Migration。
- 部署后立即检查健康接口和三大公开模块。

## 15. 回滚与故障处理

### Worker 代码故障

在 Cloudflare Worker 的 Deployments / Versions 页面回滚到上一个正常版本。

### D1 Migration 故障

- 初次上线前可删除空数据库并重新创建。
- 已有生产数据后，不要直接删除数据库或手工回改历史 Migration。
- 在执行高风险 Migration 前确认 D1 的备份与 Time Travel 状态，并保留变更前时间点。
- 优先使用向前修复 Migration。

### R2 素材故障

- 不要公开 R2 桶。
- 不要直接替换已有 Object Key 对应内容。
- Hermes external_id 素材采用不可变策略；需要修改图片时上传新的 external_id，再更新正文引用。
- D1 中删除或失效的素材不应通过 `/media/{id}` 返回。

### 日志

`wrangler.jsonc` 已开启 Workers Observability。发生 5xx 时检查 Worker Logs，同时使用响应中的 `request_id` 对照：

- `import_requests`
- `import_response_snapshots`
- `audit_logs`

日志和审计中不应出现 Authorization Header、Bearer Token、管理员密码或完整上传文件。

## 16. 最终上线清单

- [ ] `main` 为最新并且 CI 全绿
- [ ] 正式 D1 已创建
- [ ] 独立预览 D1 已创建
- [ ] `database_id` 与 `preview_database_id` 已替换
- [ ] 私有 R2 桶已创建
- [ ] `npm run deploy:check` 通过
- [ ] 远程 Migration 全部应用
- [ ] Worker 部署成功
- [ ] `/api/health` 正常
- [ ] `/api/health/database` 正常
- [ ] 首个管理员已创建
- [ ] Bootstrap Secret 已删除
- [ ] 管理员登录正常
- [ ] 访客与会员权限差异通过
- [ ] R2 素材上传和 `/media/{id}` 读取通过
- [ ] Hermes 研报、事件、课程导入通过
- [ ] workers.dev 冒烟通过
- [ ] 自定义域名绑定并复验
