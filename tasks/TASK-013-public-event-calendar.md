# TASK-013 — 前台重要会议与事件时间表

## 状态

已完成

## 目标

把已发布的结构化市场事件接入前台，形成可按周切换的“重要会议与事件时间表”，包含日期、时间、分类、重要性、影响判断和重点观察列，并按会员权限裁剪受限字段。

## 页面

- `/events`
- `/events?week=YYYY-MM-DD`

## 范围

- 当前周和指定周事件查询
- 上一周、下一周和回到本周导航
- 周一至周日日期范围
- 日期、时间、事件、分类、重要性、影响和重点观察列
- 桌面表格和移动端卡片布局
- public 事件完整展示
- member 事件基础信息公开、影响与重点观察仅有效会员和管理员可见
- private 事件完全不进入前台
- 未登录、过期、未开始、inactive 和初始密码用户提示
- 来源名称与安全来源链接
- 标签展示
- 事件分类与重要性中文映射
- no-store 与 Cookie 缓存隔离
- 首页和公共导航入口
- 可见性、周范围和字段裁剪单元测试

## 非范围

- 单独事件详情页
- 月视图和拖拽日历
- ICS 订阅
- 邮件发送与 Markdown 导出
- 事件提醒
- 搜索与筛选面板
- 用户时区切换
- 股票和行业关联

## 展示规则

- 只查询 `status=published`、`deleted_at IS NULL`、`published_at <= now` 的事件。
- private 事件不展示。
- `week` 参数必须是有效 `YYYY-MM-DD`；系统将其归一到所在周周一。
- 未提供 week 时使用 `Asia/Shanghai` 当前日期所在周。
- 页面固定展示周一至周日。
- all_day 事件显示“全天”。
- 有 starts_at 时按事件自身 timezone 显示本地时间。
- public 事件对所有人展示 summary、impact 和 focus_points。
- member 事件对访客展示标题、日期、时间、分类、重要性和 summary；impact 与 focus_points 不进入访客页面数据。
- 有效会员和管理员可查看 member 事件全部字段。
- mustChangePassword 用户按访客处理并提示先修改密码。
- 来源链接只使用已验证的 HTTP/HTTPS source_url。
- 页面响应必须 `private, no-store` 并 `Vary: Cookie`。

## UI 规则

- 表头列：日期时间｜事件｜分类｜重要性｜影响判断｜重点观察。
- high 重要性使用醒目标识，但避免大面积警示红色。
- 同一天多个事件按 starts_at、重要性和标题排序。
- 没有事件的周显示空状态和前后周导航。
- 移动端改为事件卡片，不横向压缩六列表格。
- 会员受限字段使用统一会员提示，不渲染被隐藏文本。

## 验收标准

- [x] `/events` 默认展示当前周周一至周日。
- [x] week 参数可切换到任意周并归一到周一。
- [x] 仅展示当前周内可公开访问的 published 事件。
- [x] private、未发布和 deleted 事件不展示。
- [x] public 事件访客可查看全部字段。
- [x] member 事件访客看不到 impact 和 focus_points 内容。
- [x] 有效会员与管理员可查看 member 事件全部字段。
- [x] 过期、未开始和 inactive 会员无法查看受限字段。
- [x] mustChangePassword 用户得到修改密码提示。
- [x] 页面数据与 HTML 不包含被裁剪的会员字段。
- [x] 时间按事件 timezone 正确显示，全天事件显示“全天”。
- [x] 桌面表格和移动端卡片均可阅读。
- [x] 首页和公共导航可进入事件页面。
- [x] 页面使用 no-store / Cookie 隔离策略。
- [x] 自动化测试覆盖周范围、时间格式和会员字段裁剪。
- [x] Lint、Typecheck、Vitest、Migration 零漂移、两次 D1 Migration、Next.js Build 和 OpenNext Build 全部通过。

> 本任务完成代码级、权限边界级和 Cloudflare 构建级验收。真实访客、会员和过期会员账号的浏览器 E2E 将在部署验收任务执行。

## 分支与 PR

- 分支：`task/013-public-event-calendar`
- Pull Request：#15
- 验收通过后转为 Ready 并合并，再进入 TASK-014
