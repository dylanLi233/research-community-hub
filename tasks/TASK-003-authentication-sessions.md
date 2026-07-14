# TASK-003 — 用户名密码登录与服务端 Session

## 状态

开发中

## 目标

实现适配 Cloudflare Workers 与 D1 的完整基础认证闭环：安全密码哈希、登录限流、服务端 Session、登录/退出、当前会话查询和首次修改密码。

## 范围

- 用户名规范化与登录输入校验
- PBKDF2-HMAC-SHA-256 密码哈希与验证
- 每个密码使用独立随机 Salt
- 数据库仅保存密码哈希，不保存明文或可逆密文
- 随机 Session Token，数据库仅保存 Token Hash
- HttpOnly Cookie
- 登录失败频率限制
- 登录、退出、会话查询、修改密码 API
- 登录页与修改密码页
- 安全 Return URL 校验
- 登录、退出、改密审计日志
- 密码与 Session 单元测试
- `auth_rate_limits` 数据库迁移

## 接口

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `POST /api/auth/change-password`

## 页面

- `/login`
- `/account/password`

## 非范围

- 管理员创建、编辑和续期用户
- 会员有效性判断与会员内容权限
- 自助注册
- 忘记密码与邮件找回
- 短信、微信、OAuth 登录
- 多因素认证
- Hermes API Token 鉴权
- 管理后台

## 安全决策

- 密码哈希：PBKDF2-HMAC-SHA-256，600,000 次迭代，16 字节随机 Salt，32 字节派生结果。
- 密码存储格式包含算法、迭代数、Salt 和 Hash，便于后续升级。
- 密码长度：12–128 个 Unicode 字符，不静默截断。
- 登录不存在的用户时仍执行一次有效密码哈希验证，减少用户枚举侧信道。
- 登录失败统一返回“用户名或密码错误”。
- Session 原始 Token 只进入浏览器 Cookie，数据库保存 SHA-256 Hash。
- Session 默认 30 天过期，不使用 JWT。
- Cookie：HttpOnly、SameSite=Lax、Path=/，生产环境 Secure。
- 改密后撤销原有 Session 并签发新 Session。
- Cookie 鉴权的写操作必须校验同源 `Origin`。

## 验收标准

- [ ] 有效用户可以登录并得到 Session Cookie。
- [ ] 错误用户名、错误密码和禁用账号返回相同 401 文案。
- [ ] 连续失败达到阈值后返回 429 和 `Retry-After`。
- [ ] 数据库中不存在明文密码和原始 Session Token。
- [ ] `GET /api/auth/session` 只返回安全用户字段。
- [ ] 退出后 Session 立即失效，Cookie 被清除。
- [ ] 修改密码要求当前密码正确，并撤销旧 Session。
- [ ] 首次改密后 `must_change_password=false`。
- [ ] Return URL 不能跳转到站外地址。
- [ ] 密码、Token Hash、Cookie 和跳转规则有自动化测试。
- [ ] Migration 可在本地 D1 连续应用两次。
- [ ] Lint、Typecheck、Vitest、Next.js Build、OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/003-authentication-sessions`
- 独立 Draft Pull Request
- 验收通过后合并，再进入 TASK-004
