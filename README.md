# Research Community Hub

面向炒股社群成员的会员制投研内容平台。

## V1 技术架构

- Next.js App Router + TypeScript
- Cloudflare Workers + OpenNext
- Cloudflare D1
- Cloudflare R2
- Drizzle ORM（后续任务接入）
- Zod（后续任务接入）

网站只负责接收、确定性校验、存储、审核、发布、权限控制和展示；不负责英文 PDF 的解析、翻译或 AI 加工。

## 本地开发

```bash
npm install
npm run dev
```

访问：

- 首页：`http://localhost:3000`
- 健康检查：`http://localhost:3000/api/health`

## 构建检查

```bash
npm run lint
npm run typecheck
npm run build
npm run cf:build
```

`npm run cf:build` 会使用 OpenNext 生成 Cloudflare Worker 构建产物。普通 `next dev` 运行在 Node.js，而正式部署运行在 Workers 的 `workerd`，因此两类构建都必须通过。

## Cloudflare 预览与部署

```bash
npm run preview
npm run deploy
```

D1 和 R2 资源将在后续任务创建并写入 `wrangler.jsonc`。

## 开发流程

1. 每张任务卡使用独立分支。
2. 每张任务卡创建独立 Pull Request。
3. 测试和验收通过后再合并。
4. 当前任务未通过前，不进入下一张任务卡。
