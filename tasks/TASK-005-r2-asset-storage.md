# TASK-005 — R2 素材存储与安全上传

## 状态

生成数据库迁移中

## 目标

建立统一的图片素材存储层，让管理员和后续 Hermes 导入接口可以复用相同的文件校验、R2 存储、D1 元数据和公开读取能力。

## 范围

- Cloudflare R2 `ASSETS_BUCKET` Binding
- D1 `assets` 素材表
- 图片内容签名校验，不只信任扩展名和请求 MIME
- 支持 JPEG、PNG、WebP
- 默认禁止 SVG、GIF 和其他文件类型
- 单文件最大 10 MB
- 读取图片宽高
- SHA-256 内容哈希
- 不可预测且不使用原文件名的 R2 Object Key
- 管理员素材列表、上传和删除 API
- 公开素材读取路由
- 数据库写入失败时回滚已上传的 R2 Object
- 删除素材时同时删除 R2 Object，并保留 D1 软删除记录
- 管理后台素材列表和上传页面
- 上传、删除和失败回滚审计日志
- 图片签名、尺寸解析、文件名与限制自动化测试
- CI 在 Schema 变化时提供可下载的生成 Migration Artifact

## API 与路由

- `GET /api/admin/assets`
- `POST /api/admin/assets`
- `DELETE /api/admin/assets/{id}`
- `GET /assets/{id}`

## 页面

- `/admin/assets`

## 非范围

- Hermes Bearer Token 鉴权与 Hermes 上传接口
- 图片裁剪、压缩、格式转换和缩略图生成
- 视频、音频、PDF 或任意附件上传
- 外链图片抓取
- 私有签名 URL
- 素材与研报正文的引用关系
- CDN 图片变换服务

## 安全与业务规则

- 仅管理员可通过后台上传和删除素材。
- 上传写接口要求同源 `Origin`。
- 服务端检查文件大小、真实文件签名、图片尺寸和允许的 MIME。
- R2 Key 格式为 `assets/YYYY/MM/{uuid}.{ext}`。
- 原文件名只作为元数据保存，不参与存储路径。
- 文件名最多 255 字符，Alt 文本最多 300 字符。
- 图片宽高必须大于 0，且任一边不得超过 20,000 像素。
- D1 插入失败后必须删除刚写入的 R2 Object。
- 已删除素材公开路由返回 404。
- 公开读取响应包含正确 `Content-Type`、`ETag` 与长期缓存头。
- 管理接口不得返回 R2 内部凭证或不可公开的绑定信息。

## 验收标准

- [ ] 本地和 OpenNext 构建可识别 `ASSETS_BUCKET` R2 Binding。
- [ ] 合法 JPEG、PNG、WebP 可以上传并写入 D1。
- [ ] 扩展名与实际内容不一致时按真实内容判断。
- [ ] SVG、GIF、空文件、超大文件和损坏图片被拒绝。
- [ ] D1 只保存元数据，图片字节只保存在 R2。
- [ ] R2 Key 不包含用户原文件名或路径片段。
- [ ] 数据库失败时不存在孤儿 R2 Object。
- [ ] 管理员可以分页查看素材并删除。
- [ ] 删除后素材公开 URL 返回 404。
- [ ] 非管理员无法上传或删除。
- [ ] 素材响应包含正确 MIME、ETag 和缓存头。
- [ ] 关键操作写入审计日志。
- [ ] Lint、Typecheck、Vitest、Migration、D1、Next.js Build 和 OpenNext Build 全部通过。

## 分支与 PR

- 分支：`task/005-r2-asset-storage`
- Pull Request：#6
- 验收通过后合并，再进入 TASK-006
