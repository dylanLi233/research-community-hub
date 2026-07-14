# TASK-007 — 研报领域模型与管理员 CRUD

## 状态

开发中

## 目标

建立研报内容的数据库模型、管理员管理 API 和状态机，把 R2 素材底座与 HTML/付费墙安全管道正式接入研报业务。

## 范围

- D1 `research_reports` 表、约束、索引和 Drizzle Migration
- 研报创建、列表、详情和编辑 API
- 显式发布与归档操作
- 标题、Slug、摘要、来源、日期、标签、SEO 等字段校验
- 正文 HTML 清洗、付费墙规则和清洗警告
- 正文与封面素材引用校验
- `draft`、`pending_review`、`published`、`rejected`、`archived` 状态模型
- 内容 SHA-256 哈希
- 管理员操作审计日志
- 软删除字段预留
- 研报字段、素材权限和状态转换单元测试

## API

- `GET /api/admin/reports`
- `POST /api/admin/reports`
- `GET /api/admin/reports/{id}`
- `PATCH /api/admin/reports/{id}`
- `POST /api/admin/reports/{id}/publish`
- `POST /api/admin/reports/{id}/archive`

## 非范围

- Hermes API Token、导入、幂等和自动发布
- 全局审核模式配置
- 前台研报列表和详情页
- 站内搜索和 SEO 页面输出
- 富文本编辑器
- 研报删除、批量管理和版本回滚
- 原始英文 PDF 上传或下载
- AI 内容生成、补全或修复

## 数据规则

- `slug` 全站唯一，只允许小写字母、数字和连字符。
- 管理员创建研报时状态固定为 `draft`。
- 正文必须通过 TASK-006 内容安全管道后才能保存。
- 网站只保存一份清洗后的完整正文。
- `tags` 最多 10 个，每个最多 30 字符，去除重复。
- `source_report_date` 使用严格的 `YYYY-MM-DD` 日期格式。
- 封面素材必须存在、处于 active 状态并且为 public。
- 正文中的图片只允许 `/media/{UUID}`。
- public 研报的所有正文图片必须为 public。
- member + paywall_marker：公开试读段图片必须为 public；会员段可以为 public 或 member。
- member + summary_only：正文图片可以为 public 或 member。
- private 研报可以引用任意 active 素材。
- 正文不得引用 deleted 或不存在的素材。
- 创建和更新后计算稳定的内容哈希。
- 发布和归档必须使用显式操作接口，不允许普通 PATCH 直接改变状态。
- 已软删除记录不出现在管理列表和普通详情查询中。

## 状态转换

- `draft -> published`
- `pending_review -> published`
- `rejected -> published`
- `published -> archived`
- `archived -> published`

V1 管理员手工创建研报默认直接从 draft 发布。`pending_review` 和 `rejected` 为后续 Hermes 审核流程预留。

## 验收标准

- [ ] `research_reports` Migration 可在空数据库应用并可重复执行迁移命令。
- [ ] 管理员可以创建、分页筛选、读取和编辑研报。
- [ ] 非管理员、未登录或跨源写请求被拒绝。
- [ ] Slug 冲突返回 `SLUG_CONFLICT`。
- [ ] 非法日期、标签、访问级别和预览模式返回字段级错误。
- [ ] 正文清洗错误和警告能够传递给管理员 API。
- [ ] 封面和正文素材引用按访问级别执行校验。
- [ ] API 不返回 R2 Object Key。
- [ ] PATCH 不能直接修改状态、导入来源或审计字段。
- [ ] 发布接口写入 `published_at` 并记录审计日志。
- [ ] 归档接口清除前台发布状态并记录审计日志。
- [ ] 内容哈希在内容无变化时保持稳定，在关键字段变化后改变。
- [ ] 自动化测试覆盖字段规范化、媒体提取、素材权限和状态转换。
- [ ] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/007-research-report-admin`
- Pull Request：待创建
- 验收通过后转为 Ready 并合并，再进入 TASK-008
