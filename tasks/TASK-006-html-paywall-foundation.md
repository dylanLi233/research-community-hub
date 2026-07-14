# TASK-006 — HTML 清洗与付费墙服务端裁剪底座

## 状态

已完成

## 目标

建立研报、课程等长文内容共用的安全 HTML 管道，保证 Hermes 或管理员提交的 HTML 在存储前经过确定性清洗，并在服务端按照访客、会员和管理员权限裁剪正文。

## 范围

- 固定 HTML 标签和属性白名单
- 删除脚本、样式、表单、嵌入对象及其危险内容
- 删除事件处理属性、内联样式和未知属性
- 链接协议校验
- 图片仅允许引用站内 `/media/{assetId}`
- `<!-- PAYWALL -->` 精确分隔规则
- `public`、`member`、`private` 内容访问级别
- `none`、`paywall_marker`、`summary_only` 预览模式
- 存储前清洗与字段级错误
- 清洗警告
- 访客、有效会员和管理员的服务端正文裁剪
- XSS、URL、标签、属性、付费墙和裁剪单元测试

## 非范围

- 研报、事件和课程数据表
- Hermes API Token、幂等和导入日志
- 管理后台富文本编辑器
- Markdown 转 HTML
- 图片上传和素材权限
- 文章列表、详情页和 SEO
- AI 内容检查或自动补全

## 业务规则

- 完整正文最大 512 KiB 字符。
- 网站不调用 AI 修改或补全正文。
- `public + none`：全文公开，不允许付费墙标记。
- `private + none`：仅管理员可读，不允许付费墙标记。
- `member + paywall_marker`：必须且只能包含一个 `<!-- PAYWALL -->`，标记前后清洗后都不能为空。
- `member + summary_only`：正文不允许付费墙标记，访客获得空正文，由业务页面单独展示摘要。
- 其他访问级别与预览模式组合均拒绝。
- 正文存储一份完整清洗后 HTML；不维护免费版和会员版两份全文。
- 未授权请求不得获得付费墙后的 HTML。
- 图片 `src` 只允许 `/media/{UUID}`。
- 链接只允许站内相对地址、锚点、HTTP、HTTPS 和 Mailto。
- 所有危险 HTML 的移除都必须可形成机器可读警告；清洗后正文为空则拒绝。

## 验收标准

- [x] Script、Style、Iframe、Object、Embed、Form、SVG 等危险标签及内容被移除。
- [x] `onclick` 等事件属性和 `style` 被移除。
- [x] `javascript:`、`data:`、协议相对 URL 被移除。
- [x] 外链图片和非 `/media/{UUID}` 图片被移除 `src`。
- [x] 允许的标题、段落、列表、引用、表格、图片、链接、代码元素被保留。
- [x] 缺少或重复付费墙标记返回明确错误。
- [x] 非法访问级别与预览模式组合返回明确错误。
- [x] 清洗后空正文返回 `EMPTY_BODY_AFTER_SANITIZE`。
- [x] 访客只获得付费墙之前的清洗后 HTML。
- [x] 有效会员和管理员获得完整会员正文。
- [x] 非管理员无法获得 private 正文。
- [x] `summary_only` 访客获得空正文。
- [x] 自动化测试覆盖主要 XSS、嵌套危险标签和权限裁剪场景。
- [x] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

> 本任务仅交付可复用的内容安全与裁剪底座。研报表、Hermes 导入接口和前台详情页在后续任务接入该模块。

## 分支与 PR

- 分支：`task/006-html-paywall-foundation`
- Pull Request：#7
- 验收通过后转为 Ready 并合并，再进入 TASK-007
