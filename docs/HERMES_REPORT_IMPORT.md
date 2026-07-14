# Hermes 研报导入接口

本文档描述 Hermes 如何通过 `curl` 创建或更新研报。网站只做确定性校验、存储、审核状态判断和展示，不会补字段、改写正文或调用 AI 修复内容。

## 前置条件

管理员需要先在后台创建 API Client，并为其分配：

- `reports:write`：创建或更新研报
- `imports:read`：查询导入请求和研报状态

创建 Token 后，明文 Token 只返回一次。示例：

```text
rch_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 请求文件

保存为 `report.json`：

```json
{
  "external_id": "hermes-gs-2026-07-10-ai-capex",
  "title": "高盛：全球 AI 资本开支进入第二阶段",
  "subtitle": "云厂商投资重心正在从训练转向推理",
  "slug": "goldman-ai-capex-second-stage",
  "summary": "本报告讨论全球 AI 基础设施资本开支的变化。",
  "body_html": "<h2>核心结论</h2><p>公开试读内容。</p><!-- PAYWALL --><h2>完整分析</h2><p>会员正文。</p>",
  "access_level": "member",
  "preview_mode": "paywall_marker",
  "source": {
    "institution": "Goldman Sachs",
    "report_date": "2026-07-10"
  },
  "author_name": "研究编辑部",
  "cover_asset_id": null,
  "tags": ["AI", "算力", "美股"],
  "seo": {
    "title": "高盛 AI 资本开支研报精读",
    "description": "高盛最新 AI 基础设施投资观点的中文精读。"
  }
}
```

字段名必须与示例一致。未知字段会被拒绝。

## 创建或更新研报

```bash
curl --fail-with-body \
  -X POST "https://example.com/api/v1/import/reports" \
  -H "Authorization: Bearer ${HERMES_TOKEN}" \
  -H "Idempotency-Key: report-hermes-gs-2026-07-10-ai-capex-v1" \
  -H "X-Request-Id: 123e4567-e89b-42d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  --data-binary @report.json
```

`Idempotency-Key` 必填。Hermes 重试同一次请求时必须继续使用相同 Key 和相同 JSON 内容。

`X-Request-Id` 可选，用于 Hermes 自己关联日志；提供时必须为 UUID。网站会另外生成自己的 `request_id`。

## 成功响应

### 创建且审核开启

HTTP `202`：

```json
{
  "request_id": "0f4e7c02-7e77-4ab6-92de-7395ee35b949",
  "client_request_id": "123e4567-e89b-42d3-a456-426614174000",
  "data": {
    "action": "created",
    "report_id": "51f93af0-e5e8-4ca0-bd24-93a6cd858c50",
    "external_id": "hermes-gs-2026-07-10-ai-capex",
    "status": "pending_review",
    "url": "/reports/goldman-ai-capex-second-stage",
    "warnings": []
  }
}
```

### 创建且审核关闭

HTTP `201`，`status` 为 `published`。

### 更新

HTTP `202` 或 `200`，`action` 为 `updated`。是否进入审核由当前 `review_mode` 决定。

### 内容未变化

HTTP `200`，`action` 为 `unchanged`。网站保留研报当前状态和更新时间。

## 幂等行为

- 相同 API Client、相同 `Idempotency-Key`、相同请求内容：返回第一次保存的完整响应和 HTTP 状态。
- 相同 API Client、相同 `Idempotency-Key`、不同请求内容：HTTP `409`，错误码 `IDEMPOTENCY_CONFLICT`。
- JSON 对象字段顺序不同，但内容完全一致时，请求哈希相同。
- 校验失败也会保存并重放，避免重复无效处理。

修改文章内容时，应使用新的 `Idempotency-Key`。

## 查询导入请求

```bash
curl --fail-with-body \
  "https://example.com/api/v1/import/status/0f4e7c02-7e77-4ab6-92de-7395ee35b949" \
  -H "Authorization: Bearer ${HERMES_TOKEN}"
```

Token 需要 `imports:read`。API Client 只能查询自己创建的导入记录。

## 按 external_id 查询研报

```bash
curl --fail-with-body \
  "https://example.com/api/v1/import/reports/hermes-gs-2026-07-10-ai-capex" \
  -H "Authorization: Bearer ${HERMES_TOKEN}"
```

## 标准错误

```json
{
  "request_id": "0f4e7c02-7e77-4ab6-92de-7395ee35b949",
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "提交内容未通过校验",
    "retryable": false,
    "details": [
      {
        "field": "source.institution",
        "code": "TOO_SMALL",
        "message": "Too small: expected string to have >=1 characters"
      }
    ]
  }
}
```

常见错误：

| HTTP | 错误码 | 处理方式 |
|---:|---|---|
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | 添加 Idempotency-Key |
| 400 | `INVALID_IDEMPOTENCY_KEY` | 使用 1–200 个无空格可打印 ASCII 字符 |
| 400 | `INVALID_JSON` | 修复 JSON |
| 400 | `VALIDATION_FAILED` | 根据 details 修复字段 |
| 401 | `API_TOKEN_INVALID` | 检查 Token、到期时间和 Client 状态 |
| 403 | `SCOPE_DENIED` | 为 Client 添加所需 Scope |
| 409 | `IDEMPOTENCY_CONFLICT` | 新内容使用新的 Idempotency-Key |
| 409 | `SLUG_CONFLICT` | 使用未被其他研报占用的 Slug |
| 413 | `PAYLOAD_TOO_LARGE` | 将 JSON 请求体缩小到 1 MiB 以下 |
| 422 | `PAYWALL_MARKER_REQUIRED` | 添加唯一的 `<!-- PAYWALL -->` |
| 422 | `REPORT_ASSET_VALIDATION_FAILED` | 先上传素材并修正素材访问级别 |
| 500 | `INTERNAL_ERROR` | 按退避策略使用相同 Idempotency-Key 重试 |

`retryable=false` 时，Hermes 应修改请求后使用新的 Idempotency-Key。`retryable=true` 时，可以对同一请求使用相同 Idempotency-Key 退避重试。
