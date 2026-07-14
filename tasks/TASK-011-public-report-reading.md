# TASK-011 — 前台研报列表与会员阅读页

## 状态

开发中

## 目标

把已完成的研报导入、发布、会员和付费墙能力接入前台页面，让访客可以浏览已发布研报和公开试读，有效会员可以读取完整正文。

## 页面

- `/reports`
- `/reports/{slug}`

## 范围

- 已发布研报列表
- 分页、来源和标签展示
- 公开研报全文阅读
- 会员研报公开试读
- `summary_only` 会员研报摘要展示
- 有效会员完整正文
- 管理员完整会员正文预览
- 未登录、会员过期、会员未开始和账号状态提示
- 封面、来源机构、原报告日期、作者、标签和发布时间
- 研报 SEO title 与 description
- 服务端正文裁剪
- 详情页按 Cookie 隔离并禁用公共缓存
- 站点顶部导航和首页研报入口
- 适配桌面与移动端的阅读样式
- 公开可见性、会员受众和泄露边界单元测试

## 非范围

- 前台搜索
- 收藏、评论、点赞和阅读历史
- 自助购买、支付和续费
- PDF 下载
- 原文外链跳转
- 管理员富文本编辑器
- 市场事件和课程页面
- 静态生成和 CDN 全页缓存优化

## 展示规则

- 列表只展示 `status=published`、`deleted_at IS NULL`、`published_at <= now` 的研报。
- `private` 研报不进入前台列表和 `/reports/{slug}`。
- `scheduled_at` 非空且晚于当前时间时不展示。
- public 研报对所有人展示完整正文。
- member + paywall_marker：访客只接收付费墙之前的 HTML。
- member + summary_only：访客只展示 summary，不接收正文 HTML。
- 有效会员和管理员接收完整 member 正文。
- 无会员、inactive、upcoming 和 expired 均不获得会员正文。
- mustChangePassword 用户不获得会员正文，并提示先修改密码。
- 未授权页面的 React/RSC 响应不得包含付费墙之后的 HTML。
- 详情页不得被公共缓存；响应必须按 Cookie 区分。
- SEO description 使用 `seo_description` 或 summary，不读取正文生成。

## UI 规则

- 阅读宽度控制在适合长文的 760–820 px。
- 标题使用衬线字体，正文保持高行距。
- 表格允许横向滚动。
- 图片按容器宽度自适应，保留原始比例。
- 付费墙使用明确但克制的会员提示，不伪装为错误。
- 列表卡片显示 public/member 标识。
- 页面必须提供返回研报列表、登录和修改密码入口。

## 验收标准

- [ ] `/reports` 只展示当前可公开访问的已发布研报。
- [ ] private、draft、pending_review、rejected、archived、deleted 和未来预约内容不展示。
- [ ] public 研报访客可阅读全文。
- [ ] member 研报访客只能看到公开试读或摘要。
- [ ] 有效会员可查看完整 member 正文。
- [ ] 过期、未开始和 inactive 会员无法查看完整正文。
- [ ] 管理员可查看完整 member 正文。
- [ ] mustChangePassword 用户被引导到修改密码。
- [ ] 未授权 HTML 中不存在付费墙后的内容。
- [ ] 页面不展示 R2 Object Key、内容哈希或内部导入字段。
- [ ] SEO metadata 不包含会员正文。
- [ ] 详情页使用 no-store / Cookie 隔离策略。
- [ ] 页面在移动端可阅读，图片和表格不溢出视口。
- [ ] 首页和全站导航可进入研报列表。
- [ ] 自动化测试覆盖公开可见性和受众决策。
- [ ] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/011-public-report-reading`
- Pull Request：待创建
- 验收通过后转为 Ready 并合并，再进入 TASK-012
