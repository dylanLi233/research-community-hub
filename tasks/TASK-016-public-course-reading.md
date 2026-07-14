# TASK-016 — 前台课程目录与章节会员阅读

## 状态

开发中

## 目标

把已发布课程和章节接入前台，形成课程列表、课程介绍与章节目录、章节长文阅读页。访客可了解课程并阅读公开章节或会员试读，有效会员与管理员可查看完整会员章节。

## 页面

- `/courses`
- `/courses/{courseSlug}`
- `/courses/{courseSlug}/{chapterSlug}`

## 范围

- 已发布课程列表与分页
- 课程封面、简介、讲师、标签、章节数量和总预计时长
- 已发布章节目录，按 position、创建时间、标题稳定排序
- public 章节全文
- member + paywall_marker 公开试读
- member + summary_only 仅摘要
- 有效会员和管理员完整会员章节
- private 课程与 private 章节完全隐藏
- 未登录、会员过期、未开始、inactive 和初始密码提示
- 上一章、下一章和课程目录导航
- 课程与章节 SEO metadata
- 服务端正文裁剪和泄露边界测试
- no-store 与 Cookie 缓存隔离
- 首页与公共导航入口
- 桌面双栏阅读与移动端单栏布局

## 展示规则

- 课程只展示 `status=published`、`published_at <= now`、`deleted_at IS NULL`、`access_level != private`。
- 章节必须属于可见课程，并且自身为 `status=published`、`published_at <= now`、`deleted_at IS NULL`、`access_level != private`。
- 课程 access_level 为 member 时，课程介绍和章节目录仍可公开展示，用于说明会员权益；章节正文权限由章节 access_level 与 preview_mode 决定。
- 课程 description_html 已按公开 HTML 清洗，可对所有访客展示。
- public 章节对所有人显示全文。
- member + paywall_marker：访客只接收付费墙之前的 HTML。
- member + summary_only：访客只接收章节摘要，不接收正文 HTML。
- 有效会员和管理员接收完整 member 章节正文。
- mustChangePassword 用户按访客处理，并提示先修改初始密码。
- 章节页面的上一章、下一章只在可见且已发布章节中计算。
- 未授权页面的 HTML、React Server Component 数据和 metadata 不得包含会员正文。
- 页面响应必须 `private, no-store` 并 `Vary: Cookie`。

## UI 规则

- 课程列表使用封面卡片；无封面时显示克制的文字占位。
- 课程详情页包含课程介绍和清晰的章节目录。
- 章节目录显示序号、标题、访问级别和预计阅读时长。
- 章节阅读页桌面端使用正文 + 课程目录双栏，正文宽度控制在 760–820 px。
- 移动端目录移到正文下方，不横向挤压正文。
- HTML 表格允许横向滚动，图片自适应容器宽度。
- 付费墙提示与研报页面保持一致的会员语言，不伪装成错误。

## 非范围

- 学习进度、已读状态和继续学习
- 测验、作业、证书、评论和收藏
- 视频、音频播放器与附件下载
- 自助购买、支付和续费
- 站内搜索
- 静态生成和全页 CDN 缓存

## 验收标准

- [ ] `/courses` 只展示可公开访问的已发布课程。
- [ ] private、未发布、归档、删除和未来发布时间课程不展示。
- [ ] 课程详情只列出可见的已发布章节。
- [ ] private、未发布、归档、删除和未来发布时间章节不展示。
- [ ] public 章节访客可阅读全文。
- [ ] member 章节访客只能看到公开试读或摘要。
- [ ] 有效会员和管理员可查看完整 member 章节。
- [ ] 过期、未开始和 inactive 会员无法查看完整正文。
- [ ] mustChangePassword 用户被引导修改密码。
- [ ] 未授权页面数据不包含付费墙后的内容。
- [ ] 上一章、下一章按可见章节顺序正确计算。
- [ ] SEO metadata 不包含会员正文。
- [ ] 页面不展示内容哈希、external_id、API Client 或 R2 Object Key。
- [ ] 首页与公共导航可进入课程列表。
- [ ] 页面在桌面和移动端可阅读。
- [ ] 页面使用 no-store / Cookie 隔离策略。
- [ ] 自动化测试覆盖课程/章节可见性、受众裁剪、排序和泄露边界。
- [ ] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/016-public-course-reading`
- Pull Request：待创建
- 验收通过后转为 Ready 并合并，再进入部署验收
