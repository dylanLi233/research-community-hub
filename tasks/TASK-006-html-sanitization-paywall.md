# TASK-006 — HTML 安全清洗与付费墙裁剪

## 状态

开发中

## 目标

建立所有研报、课程和事件富文本共用的安全处理层：只允许明确的 HTML 白名单，验证 `<!-- PAYWALL -->` 规则，并在服务端根据用户权限返回可见正文。

## 范围

- Workers 兼容的 HTML 解析、清洗和序列化
- 允许的正文标签与属性白名单
- 删除脚本、样式、表单、iframe、object、embed 和内联事件
- 禁止 `javascript:`、`data:` 等危险 URL
- 图片仅允许引用站内 `/assets/{uuid}` 路径
- 外部链接自动补充安全 `rel` 属性
- `<!-- PAYWALL -->` 精确数量校验
- `public`、`member`、`private` 三种访问级别
- `paywall_marker`、`summary_only` 两种预览模式
- 内容清洗警告与机器可读错误
- 服务端访客、普通账号、有效会员和管理员正文投影
- 有意义正文判定，拒绝清洗后为空的内容
- 单元测试覆盖 XSS、URL、图片、表格、付费墙和权限泄露

## 非范围

- 研报、课程和事件数据库表
- Hermes 导入 API
- 后台富文本编辑器
- Markdown 转 HTML
- 图片上传和素材管理
- 文章页面设计
- 搜索索引

## 内容规则

### 允许标签

- 标题：`h2`–`h6`
- 文本：`p`、`strong`、`em`、`del`、`br`、`hr`
- 列表：`ul`、`ol`、`li`
- 引用与代码：`blockquote`、`code`、`pre`
- 表格：`table`、`thead`、`tbody`、`tfoot`、`tr`、`th`、`td`
- 媒体：`figure`、`figcaption`、`img`
- 链接：`a`

### 属性

- `a`：`href`、`title`
- `img`：`src`、`alt`、`title`、`width`、`height`
- `th`/`td`：`colspan`、`rowspan`
- 其他标签默认不保留任意属性、`class`、`id` 或 `style`

### 访问级别

- `public`：全文公开，不允许付费墙标记。
- `member + paywall_marker`：正文必须且只能有一个 `<!-- PAYWALL -->`，标记前后都必须有有效内容。
- `member + summary_only`：正文不得包含付费墙标记；访客正文为空，只能使用独立摘要。
- `private`：仅管理员预览，正文不得出现在普通前台响应。

### 权限投影

- 访客、普通账号、过期会员：只得到公开试读，或 `summary_only` 时得到空正文。
- 有效会员：得到完整会员正文。
- 管理员：可得到完整正文用于预览。
- 未授权响应中不得携带隐藏正文、原始正文或可还原会员内容的字段。

## 验收标准

- [ ] `<script>`、内联事件和危险 URL 被删除。
- [ ] 未知标签被移除，但安全文本内容可以保留。
- [ ] 外链图片、Data URL 和非素材路径图片被移除。
- [ ] 站内素材图片保留，危险属性被删除。
- [ ] 外部链接只能使用 HTTP/HTTPS，并自动带安全 `rel`。
- [ ] `public` 内容含付费墙标记时被拒绝。
- [ ] `member + paywall_marker` 缺失或多标记时返回机器可读错误。
- [ ] 清洗后标记前或标记后无有效内容时被拒绝。
- [ ] `summary_only` 不向访客返回任何正文。
- [ ] 过期会员与未登录访客的结果完全不包含会员正文。
- [ ] 管理员和有效会员可以获得完整正文。
- [ ] 清洗发生变更时返回警告，不静默声称原文完全保留。
- [ ] Lint、Typecheck、Vitest、Migration 零漂移、D1、Next.js Build 和 OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/006-html-sanitization-paywall`
- 独立 Draft Pull Request
- 验收通过后合并，再进入 TASK-007
