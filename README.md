# Research Community Hub

面向炒股社群成员的会员制投研内容平台。

## 产品范围

- 研报精选：Hermes 通过 API 上传已加工完成的中文 HTML 内容
- 重要事件：展示每周、每月宏观与市场事件
- 宏观课程：18 章宏观经济基础课程
- 会员权限：访客查看公开摘要或试读，会员查看完整内容
- 管理后台：用户、内容、审核模式、导入日志管理

## 技术方向

- Next.js App Router + TypeScript
- Cloudflare Workers（OpenNext）
- Cloudflare D1
- Cloudflare R2
- Drizzle ORM
- Zod

网站只负责内容接收、确定性校验、存储、审核、发布、权限控制和展示；不负责英文 PDF 的解析、翻译或 AI 加工。

## 开发流程

1. 每张任务卡使用独立分支。
2. 每张任务卡创建独立 Pull Request。
3. 测试与验收通过后再合并。
4. 当前任务未通过前，不进入下一张任务卡。

详细 PRD、架构和任务卡将维护在 `docs/` 与 `tasks/` 目录。
