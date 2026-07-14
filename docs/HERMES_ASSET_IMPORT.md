# Hermes 素材上传接口

Hermes 应先上传研报封面和正文图片，再把返回的 `/media/{asset_id}` 写入研报 `body_html` 或 `cover_asset_id`。

网站只接受 JPEG、PNG 和 WebP，不会压缩、裁剪、转换或自动修复图片。

## 前置条件

API Client 需要：

- `assets:write`：上传图片
- `imports:read`：查询上传结果

```bash
export HERMES_TOKEN='rch_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
export HUB_URL='https://example.com'
```

## 上传图片

```bash
curl --fail-with-body \
  -X POST "${HUB_URL}/api/v1/import/assets" \
  -H "Authorization: Bearer ${HERMES_TOKEN}" \
  -H "Idempotency-Key: asset-gs-ai-capex-chart-01-v1" \
  -H "X-Request-Id: 123e4567-e89b-42d3-a456-426614174000" \
  -F "external_id=gs-ai-capex-chart-01" \
  -F "access_level=member" \
  -F "alt_text=全球 AI 资本开支趋势图" \
  -F "file=@./charts/ai-capex.webp;type=image/webp"
```

字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `external_id` | 是 | 同一个 API Client 内唯一，1–200 字符 |
| `access_level` | 是 | `public`、`member` 或 `private` |
| `alt_text` | 否 | 图片说明，最多 500 字符 |
| `file` | 是 | JPEG、PNG 或 WebP，最大 10 MiB |

`external_id` 只允许字母、数字、点、下划线、冒号和连字符。

## 创建响应

HTTP `201`：

```json
{
  "request_id": "6fa5b947-35f4-4727-90cd-5adb4eb7fcef",
  "client_request_id": "123e4567-e89b-42d3-a456-426614174000",
  "data": {
    "action": "created",
    "asset_id": "44677eca-a293-4d85-aaaf-485198b439e6",
    "external_id": "gs-ai-capex-chart-01",
    "access_level": "member",
    "mime_type": "image/webp",
    "size_bytes": 281742,
    "sha256": "b93f...64-hex-characters",
    "url": "/media/44677eca-a293-4d85-aaaf-485198b439e6",
    "warnings": []
  }
}
```

在研报 HTML 中使用：

```html
<figure>
  <img src="/media/44677eca-a293-4d85-aaaf-485198b439e6" alt="全球 AI 资本开支趋势图" loading="lazy">
  <figcaption>全球 AI 资本开支趋势图</figcaption>
</figure>
```

## 重复上传

相同 `external_id`、相同图片 SHA-256、相同 `access_level` 和相同 `alt_text`：

- HTTP `200`
- `action=unchanged`
- 返回原 `asset_id`
- 不会再次写入 R2

文件名和 Multipart boundary 不参与有效请求哈希，因此同一文件以不同本地文件名重试仍可正确识别。

## 不可变 external_id

相同 `external_id` 但图片内容或关键元数据不同：

```json
{
  "error": {
    "code": "ASSET_EXTERNAL_ID_CONFLICT",
    "message": "该 external_id 已绑定不同的素材内容或元数据",
    "retryable": false
  }
}
```

请使用新的 `external_id`，例如：

```text
gs-ai-capex-chart-01-v2
```

网站不会覆盖旧 R2 Object，避免已经发布的研报图片被静默替换。

已删除素材的 external_id 也不能复用，错误码为 `ASSET_EXTERNAL_ID_DELETED`。

## Idempotency-Key

- 每一次逻辑上传使用一个唯一 Key。
- 网络重试时继续使用原 Key 和相同文件、元数据。
- 相同 Key、相同有效内容会重放第一次响应。
- 相同 Key、不同内容返回 HTTP `409`、`IDEMPOTENCY_CONFLICT`。
- 要上传新版本时，external_id 和 Idempotency-Key 都应更新。

## 查询素材

```bash
curl --fail-with-body \
  "${HUB_URL}/api/v1/import/assets/gs-ai-capex-chart-01" \
  -H "Authorization: Bearer ${HERMES_TOKEN}"
```

Token 需要 `imports:read`。API Client 只能查询自己上传的素材。

通用请求状态查询：

```bash
curl --fail-with-body \
  "${HUB_URL}/api/v1/import/status/6fa5b947-35f4-4727-90cd-5adb4eb7fcef" \
  -H "Authorization: Bearer ${HERMES_TOKEN}"
```

## 访问级别与研报正文

- 封面素材必须为 `public`。
- public 研报正文只能引用 public 素材。
- member 研报付费墙之前只能引用 public 素材。
- member 研报付费墙之后可引用 public 或 member 素材。
- private 研报可引用任意 active 素材。

研报导入接口会再次验证这些规则。

## 常见错误

| HTTP | 错误码 | 处理方式 |
|---:|---|---|
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | 添加 Idempotency-Key |
| 400 | `INVALID_MULTIPART_BODY` | 使用 `curl -F` 发送 Multipart |
| 400 | `VALIDATION_FAILED` | 修复 external_id、access_level 或 file |
| 400 | `EMPTY_FILE` | 上传非空图片 |
| 400 | `ASSET_MIME_MISMATCH` | 修正声明 MIME 或文件内容 |
| 401 | `API_TOKEN_INVALID` | 检查 Token、Client 状态和到期时间 |
| 403 | `SCOPE_DENIED` | 添加 `assets:write` 或 `imports:read` |
| 409 | `IDEMPOTENCY_CONFLICT` | 新内容使用新 Idempotency-Key |
| 409 | `ASSET_EXTERNAL_ID_CONFLICT` | 使用新的 external_id |
| 409 | `ASSET_EXTERNAL_ID_DELETED` | 使用新的 external_id |
| 413 | `ASSET_TOO_LARGE` | 文件缩小到 10 MiB 以下 |
| 413 | `PAYLOAD_TOO_LARGE` | Multipart 总请求缩小到 10.5 MiB 以下 |
| 415 | `UNSUPPORTED_ASSET_TYPE` | 转换为 JPEG、PNG 或 WebP |
| 500 | `INTERNAL_ERROR` | 使用相同 Idempotency-Key 退避重试 |
