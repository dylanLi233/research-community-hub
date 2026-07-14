# TASK-017 — Cloudflare 部署就绪与上线手册

## 状态

开发中

## 目标

在不创建或提交真实 Cloudflare 资源凭证的前提下，让仓库具备可重复、可检查的生产部署流程，避免使用占位 D1 ID 误部署，并提供从资源创建、数据库迁移、Worker 部署到首次管理员初始化的完整上线手册。

## 范围

- Cloudflare 部署前配置检查脚本
- 阻止全零 D1 database_id 和 preview_database_id 进入生产部署
- 校验 DB、MEDIA_BUCKET、ASSETS Binding
- 校验 OpenNext main、静态资源目录、nodejs_compat 和 compatibility_date
- `npm run deploy` 自动执行部署前检查
- CI 以允许占位 ID 的模式验证配置结构
- `public/_headers` 长期缓存 Next.js 指纹静态资源
- D1 正式库与预览库创建步骤
- R2 私有素材桶创建步骤
- 远程 Migration 应用顺序
- Worker 首次部署、Bootstrap Secret、首个管理员与 Secret 删除步骤
- workers.dev 冒烟检查和自定义域名切换清单
- 回滚、日志、备份和安全注意事项
- README 更新到当前完整产品状态

## 非范围

- 代替用户登录 Cloudflare 创建真实资源
- 在仓库提交真实 D1 UUID、域名、密码或 Secret
- 自动购买域名或修改 DNS
- 自动创建生产管理员、会员和 Hermes Token
- 生产数据迁移或导入真实内容

## 安全规则

- 真实 D1 ID 必须由部署者写入 `wrangler.jsonc` 后再部署。
- Bootstrap Secret 必须通过 Wrangler Secret 写入，不能写进 Git、wrangler vars 或 README。
- 首个管理员创建成功后应删除 `BOOTSTRAP_ADMIN_SECRET`。
- R2 桶保持私有，所有素材继续通过 `/media/{id}` 服务端权限路由读取。
- 远程数据库迁移必须在 Worker 首次接收业务流量前完成。
- 部署前必须通过 Lint、Typecheck、Vitest、Migration、Next.js 和 OpenNext 构建。
- 自定义域名应在 workers.dev 冒烟检查通过后再绑定。

## 验收标准

- [ ] `npm run deploy:check` 在全零 D1 ID 下失败并给出明确修复提示。
- [ ] 配置检查在有效生产配置下通过。
- [ ] CI 可在保留仓库占位 ID 时验证配置结构。
- [ ] `npm run deploy` 在构建和上传前执行配置检查。
- [ ] `public/_headers` 为 `/_next/static/*` 设置 immutable 一年缓存。
- [ ] 部署手册包含 D1、R2、Migration、Worker、Secret、Bootstrap、冒烟检查和域名步骤。
- [ ] 部署手册不包含真实 Secret、账号、D1 UUID 或密码。
- [ ] README 不再把 R2、研报、事件和课程描述为后续功能。
- [ ] `.dev.vars.example` 明确本地开发环境与 Bootstrap Secret。
- [ ] 自动化测试覆盖占位 ID、Binding 缺失和有效配置。
- [ ] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/017-deployment-readiness`
- Pull Request：待创建
- 验收通过后转为 Ready 并合并，随后进入真实 Cloudflare 部署
