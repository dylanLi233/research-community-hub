# TASK-014 — 宏观课程模型与管理员管理

## 状态

已完成

## 目标

建立宏观课程与章节的双层数据模型、管理员 CRUD、发布状态机和安全内容管道，为后续 Hermes 课程导入与前台课程阅读提供稳定底座。

## 数据模型

- `courses`
- `course_chapters`

## 管理员 API

### 课程

- `GET /api/admin/courses`
- `POST /api/admin/courses`
- `GET /api/admin/courses/{id}`
- `PATCH /api/admin/courses/{id}`
- `POST /api/admin/courses/{id}/publish`
- `POST /api/admin/courses/{id}/archive`

### 章节

- `GET /api/admin/courses/{id}/chapters`
- `POST /api/admin/courses/{id}/chapters`
- `GET /api/admin/courses/{id}/chapters/{chapterId}`
- `PATCH /api/admin/courses/{id}/chapters/{chapterId}`
- `POST /api/admin/courses/{id}/chapters/{chapterId}/publish`
- `POST /api/admin/courses/{id}/chapters/{chapterId}/archive`

## 课程字段

- `external_id`：为后续 Hermes 预留
- `title`
- `subtitle`
- `slug`
- `summary`
- `description_html`
- `cover_asset_id`
- `instructor_name`
- `tags`
- `access_level`
- `status`
- `seo_title`
- `seo_description`
- `content_hash`
- 创建者、导入 Client、发布时间和软删除字段

## 章节字段

- `course_id`
- `external_id`：为后续 Hermes 预留
- `title`
- `slug`
- `summary`
- `body_html`
- `access_level`
- `preview_mode`
- `position`
- `estimated_minutes`
- `status`
- `content_hash`
- 创建者、导入 Client、发布时间和软删除字段

## 范围

- D1 Schema、约束、索引和 Drizzle Migration
- 课程与章节管理员 CRUD
- 独立发布与归档动作
- Slug、标签、排序和预计阅读时长校验
- 课程简介和章节正文 HTML 清洗
- 章节付费墙规则
- 封面与正文素材权限校验
- 课程和章节 SHA-256 内容哈希
- 管理员审计日志
- 软删除字段预留
- 字段、状态、哈希和章节排序测试

## 业务规则

- 管理员创建课程与章节时状态固定为 `draft`。
- 课程 slug 全站唯一。
- 章节 slug 在同一课程内唯一。
- 章节 position 必须为 1–9999；同一课程允许临时重复 position，读取时用 position、创建时间、标题稳定排序。
- `estimated_minutes` 可为空，非空时为 1–600。
- 课程简介必须按 `public + none` 规则清洗，不允许付费墙。
- 章节正文复用 TASK-006 的 `public/member/private` 与预览模式组合。
- 课程封面必须是 active public 素材。
- 课程简介中的图片必须为 active public 素材。
- 章节正文素材权限复用研报规则。
- `tags` 最多 10 个，每个最多 30 字符，去重。
- 普通 PATCH 不允许直接修改 status、导入归属、发布时间和审计字段。
- 课程发布不自动发布章节；章节必须单独发布。
- 章节发布前要求所属课程未被归档或删除。
- 课程归档后，前台任务不得展示其章节；不自动改写章节状态。
- 已软删除记录不进入管理列表和普通详情。

## 状态转换

课程与章节均支持：

- `draft -> published`
- `pending_review -> published`
- `rejected -> published`
- `published -> archived`
- `archived -> published`

`pending_review` 与 `rejected` 为 TASK-015 Hermes 审核流程预留。

## 非范围

- Hermes 课程与章节导入
- 前台课程目录和阅读页
- 视频、音频和附件
- 学习进度、测验、收藏和评论
- 批量章节排序
- 课程版本回滚
- 富文本编辑器
- 自助购买与支付

## 验收标准

- [x] courses 与 course_chapters Migration 可应用并重复执行迁移命令。
- [x] 管理员可创建、筛选、读取和编辑课程。
- [x] 管理员可在课程下创建、排序、读取和编辑章节。
- [x] 非管理员、未登录和跨源写请求被拒绝。
- [x] 课程 slug 冲突返回明确错误。
- [x] 同课程章节 slug 冲突返回明确错误。
- [x] 非法标签、position、预计时长和访问模式返回字段级错误。
- [x] 课程简介和章节正文保存前完成安全清洗。
- [x] 课程封面、简介图片与章节图片执行正确素材权限校验。
- [x] API 不返回 R2 Object Key、导入内部字段或密码数据。
- [x] 课程与章节 PATCH 不能直接修改状态。
- [x] 发布与归档写入审计日志。
- [x] 课程发布不自动发布章节。
- [x] 章节发布要求所属课程有效。
- [x] 内容哈希在内容相同时稳定，关键字段变化时改变。
- [x] 自动化测试覆盖字段规范化、状态、哈希和素材权限。
- [x] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

> 本任务完成课程与章节管理底座的代码级、权限边界级、迁移级和 Cloudflare 构建级验收。Hermes 导入将在 TASK-015 接入。

## 分支与 PR

- 分支：`task/014-course-foundation`
- Pull Request：#16
- 验收通过后转为 Ready 并合并，再进入 TASK-015 Hermes 课程导入
