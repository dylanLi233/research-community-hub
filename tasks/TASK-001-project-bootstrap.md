# TASK-001 — Next.js 与 Cloudflare 项目初始化

## 状态

待开发

## 目标

建立一个可以在本地运行、可以构建为 Cloudflare Worker、具备基础 CI 的 Next.js 全栈项目骨架。

## 范围

- Next.js App Router + TypeScript
- Cloudflare Workers + OpenNext 配置
- 基础首页占位
- `/api/health` 健康检查
- ESLint、TypeScript 检查和构建脚本
- GitHub Actions CI
- Agent 开发约束

## 非范围

- D1 数据库表和迁移
- R2 素材上传
- 登录、Session 和会员权限
- Hermes API
- 研报、事件、课程业务页面
- 管理后台

## 验收标准

- [ ] `npm run dev` 可以启动 Next.js。
- [ ] `/api/health` 返回 JSON，包含服务名和 `ok` 状态。
- [ ] `npm run lint` 通过。
- [ ] `npm run typecheck` 通过。
- [ ] `npm run build` 通过。
- [ ] `npm run cf:build` 可生成 `.open-next` Worker 构建产物。
- [ ] `wrangler.jsonc` 使用 `nodejs_compat`。
- [ ] CI 在 Pull Request 中执行上述静态检查和构建。
- [ ] 未引入 Go、PostgreSQL、Redis 或 Docker 运行依赖。

## 交付方式

- 分支：`task/001-project-bootstrap`
- 独立 Draft Pull Request
- 验收通过后再合并，并进入 TASK-002
