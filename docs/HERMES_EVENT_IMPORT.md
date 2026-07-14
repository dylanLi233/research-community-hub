# Hermes 重要会议与市场事件导入

Hermes 可以把下一周的重要会议、经济数据、政策节点、产业会议和公司事件结构化上传到网站。

网站只做字段校验、幂等 Upsert、审核状态判断和存储，不会自动补充时间、影响或关注点。

## 权限

API Client 需要：

- `events:write`：创建或更新事件
- `imports:read`：查询导入状态和 external_id

```bash
export HERMES_TOKEN='rch_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
export HUB_URL='https://example.com'
```

## 请求文件

保存为 `event.json`：

```json
{
  "external_id": "fed-fomc-2026-07-29",
  "title": "美联储 7 月议息会议",
  "event_date": "2026-07-29",
  "starts_at": "2026-07-29T14:00:00-04:00",
  "ends_at": "2026-07-29T15:00:00-04:00",
  "timezone": "America/New_York",
  "all_day": false,
  "category": "central_bank",
  "importance": "high",
  "region": "美国",
  "summary": "关注政策利率、会后声明和鲍威尔发布会。",
  "impact": "可能影响美元、美债收益率、黄金和全球风险资产。",
  "focus_points": [
    "政策利率是否维持不变",
    "通胀与就业判断是否调整",
    "市场对后续降息路径的定价"
  ],
  "source_name": "Federal Reserve",
  "source_url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  "tags": ["美联储", "利率", "美债"],
  "access_level": "public"
}
```

未知字段会被拒绝。

## 导入

```bash
curl --fail-with-body \
  -X POST "${HUB_URL}/api/v1/import/events" \
  -H "Authorization: Bearer ${HERMES_TOKEN}" \
  -H "Idempotency-Key: event-fed-fomc-2026-07-29-v1" \
  -H "X-Request-Id: 123e4567-e89b-42d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  --data-binary @event.json
```

## 时间字段

- `event_date` 必须是有效的 `YYYY-MM-DD`。
- `timezone` 使用 IANA 时区，例如 `Asia/Shanghai`、`America/New_York`。
- `starts_at` 和 `ends_at` 使用带偏移的 ISO 8601 时间。
- `starts_at` 在 `timezone` 下的本地日期必须等于 `event_date`。
- `ends_at` 必须晚于 `starts_at`。
- 全天事件设置 `all_day=true`，并省略 `starts_at` 和 `ends_at`。

全天事件示例：

```json
{
  "external_id": "china-policy-meeting-2026-07-20",
  "title": "重要政策会议",
  "event_date": "2026-07-20",
  "starts_at": null,
  "ends_at": null,
  "timezone": "Asia/Shanghai",
  "all_day": true,
  "category": "policy",
  "importance": "high",
  "summary": "关注政策定调和重点任务。",
  "focus_points": [],
  "tags": [],
  "access_level": "member"
}
```

## 枚举

`category`：

```text
macro
policy
central_bank
economic_data
industry
company
earnings
market
geopolitics
other
```

`importance`：

```text
high
medium
low
```

`access_level`：

```text
public
member
private
```

## 成功响应

审核模式开启时，创建或更新返回 HTTP `202`：

```json
{
  "request_id": "6fa5b947-35f4-4727-90cd-5adb4eb7fcef",
  "client_request_id": "123e4567-e89b-42d3-a456-426614174000",
  "data": {
    "action": "created",
    "event_id": "44677eca-a293-4d85-aaaf-485198b439e6",
    "external_id": "fed-fomc-2026-07-29",
    "status": "pending_review",
    "event_date": "2026-07-29",
    "url": "/events#event-44677eca-a293-4d85-aaaf-485198b439e6",
    "warnings": []
  }
}
```

审核关闭时，新事件返回 HTTP `201`、`status=published`；更新返回 HTTP `200`。

内容哈希没有变化时：

- HTTP `200`
- `action=unchanged`
- 保留当前状态和更新时间

## 幂等

- 网络重试使用相同 `Idempotency-Key` 和相同 JSON。
- 相同 Key 和相同内容重放第一次响应。
- 相同 Key 但不同内容返回 HTTP `409`、`IDEMPOTENCY_CONFLICT`。
- 更新事件内容时使用新的 Idempotency-Key。
- JSON 字段顺序不同但内容相同，请求哈希保持一致。

## 查询事件

```bash
curl --fail-with-body \
  "${HUB_URL}/api/v1/import/events/fed-fomc-2026-07-29" \
  -H "Authorization: Bearer ${HERMES_TOKEN}"
```

查询导入请求：

```bash
curl --fail-with-body \
  "${HUB_URL}/api/v1/import/status/6fa5b947-35f4-4727-90cd-5adb4eb7fcef" \
  -H "Authorization: Bearer ${HERMES_TOKEN}"
```

## 常见错误

| HTTP | 错误码 | 处理方式 |
|---:|---|---|
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | 添加 Idempotency-Key |
| 400 | `INVALID_JSON` | 修复 JSON |
| 400 | `VALIDATION_FAILED` | 根据 details 修复日期、时间、时区或枚举 |
| 401 | `API_TOKEN_INVALID` | 检查 Token 和 Client 状态 |
| 403 | `SCOPE_DENIED` | 添加 `events:write` 或 `imports:read` |
| 409 | `IDEMPOTENCY_CONFLICT` | 新内容使用新的 Idempotency-Key |
| 409 | `EVENT_EXTERNAL_ID_DELETED` | 使用新的 external_id |
| 413 | `PAYLOAD_TOO_LARGE` | 将 JSON 缩小到 1 MiB 以下 |
| 500 | `INTERNAL_ERROR` | 使用相同 Idempotency-Key 退避重试 |
