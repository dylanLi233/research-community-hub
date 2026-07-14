# TASK-003 — 用户名密码登录与服务端 Session

## 状态

验收中

## 目标

实现适配 Cloudflare Workers 与 D1 的完整基础认证闭环：安全密码哈希、登录限流、服务端 Session、登录/退出、当前会话查询、首次修改密码和首个管理员初始化。

## 范围

- 用户名规范化与登录输入校验
- PBKDF2-HMAC-SHA-256 密码哈希与验证
- 每个密码使用独立随机 Salt
- 数据库仅保存密码哈希，不保存明文或可逆密文
- 随机 Session Token，数据库仅保存 Token Hash
- HttpOnly Cookie
- 登录失败频率限制
- 登录、退出、会话查询、修改密码 API
- 仅空数据库可调用的一次性管理员 Bootstrap API
- 登录页与修改密码页
- 安全 Return URL 校验
- Cookie 写接口同源校验
- 登录、退出、改密和初始化管理员审计日志
- 密码、Token、限流和跳转规则单元测试
- `auth_rate_limits` 数据库迁移

## 接口

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `POST /api/auth/change-password`
- `POST /api/setup/admin`

## 页面

- `/login`
- `/account/password`

## 非范围

- 管理员创建、编辑和续期其他用户
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
- 登录限流只保存用户名和来源 IP 组合的哈希，不保存原始 IP。
- 首管理员接口必须配置 Cloudflare Secret，并在数据库出现任意用户后永久关闭。

## 验收标准

- [x] 有效用户登录流程创建服务端 Session，并返回 HttpOnly Session Cookie。
- [x] 错误用户名、错误密码和禁用账号使用相同 401 错误文案。
- [x] 连续失败达到阈值后返回 429 和 `Retry-After`。
- [x] 数据库中只保存密码哈希和 Session Token Hash。
- [x] `GET /api/auth/session` 只返回安全用户字段。
- [x] 退出会撤销 Session 并清除 Cookie。
- [x] 修改密码要求当前密码正确，并撤销旧 Session。
- [x] 首次改密后设置 `must_change_password=false`。
- [x] Return URL 不能跳转到站外地址。
- [x] 密码、Token、限流和跳转规则有自动化测试。
- [x] 首管理员 Bootstrap 只允许空数据库并使用 Secret 鉴权。
- [x] Migration 已由 Drizzle 生成，可在本地 D1 连续应用两次。
- [ ] 最终只读 CI 的 Lint、Typecheck、Vitest、Next.js Build、OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/003-authentication-sessions`
- Pull Request：#3
- 最终 CI 通过后转为 Ready 并合并，再进入 TASK-004
