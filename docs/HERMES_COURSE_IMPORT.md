# Hermes 课程与章节导入接口

Hermes 可以先导入课程，再按课程 `external_id` 逐章导入内容。网站只执行严格校验、HTML 清洗、素材权限校验、审核状态判断和存储，不会补字段、改写正文或调用 AI 修复内容。

## 前置权限

API Client 需要：

- `courses:write`：创建或更新课程、章节
- `imports:read`：按 external_id 查询结果和读取导入状态

所有写请求必须包含：

```text
Authorization: Bearer rch_live_xxx
Idempotency-Key: 可打印且不含空格的唯一键
Content-Type: application/json
```

`X-Request-Id` 可选；提供时必须是 UUID。

## 一、导入课程

保存为 `course.json`：

```json
{
  "external_id": "macro-basics-v1",
  "title": "看懂宏观经济",
  "subtitle": "从增长、通胀到资产价格",
  "slug": "macro-economics-basics",
  "summary": "用 18 个章节建立宏观经济与市场分析的基础框架。",
  "description_html": "<h2>课程介绍</h2><p>这门课程从基础概念开始，逐步连接经济数据、政策和资产价格。</p>",
  "cover_asset_id": null,
  "instructor_name": "研究编辑部",
  "tags": ["宏观经济", "投资基础"],
  "access_level": "member",
  "seo": {
    "title": "看懂宏观经济基础课程",
    "description": "面向投资者的宏观经济基础课程。"
  }
}
```

执行：

```bash
curl --fail-with-body \
  -X POST "https://example.com/api/v1/import/courses" \
  -H "Authorization: Bearer ${HERMES_TOKEN}" \
  -H "Idempotency-Key: course-macro-basics-v1-rev-1" \
  -H "X-Request-Id: 123e4567-e89b-42d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  --data-binary @course.json
```

### 课程成功响应

审核开启时返回 HTTP `202`：

```json
{
  "request_id": "0f4e7c02-7e77-4ab6-92de-7395ee35b949",
  "client_request_id": "123e4567-e89b-42d3-a456-426614174000",
  "data": {
    "action": "created",
    "course_id": "51f93af0-e5e8-4ca0-bd24-93a6cd858c50",
    "external_id": "macro-basics-v1",
    "status": "pending_review",
    "url": "/courses/macro-economics-basics",
    "warnings": []
  }
}
```

审核关闭时：

- 首次创建：HTTP `201`，状态 `published`
- 内容更新：HTTP `200`，状态 `published`
- 内容哈希未变化：HTTP `200`，`action=unchanged`，保留原状态和时间戳

## 二、导入章节

课程必须已经通过同一个 API Client 导入。路径中的 `macro-basics-v1` 是父课程的 `external_id`。

保存为 `chapter-01.json`：

```json
{
  "external_id": "macro-basics-chapter-01",
  "title": "第一章：宏观经济到底在研究什么",
  "slug": "what-is-macroeconomics",
  "summary": "理解总量经济、经济周期和资产价格之间的基本关系。",
  "body_html": "<h2>宏观经济的研究对象</h2><p>公开试读内容。</p><!-- PAYWALL --><h2>完整课程</h2><p>会员章节正文。</p>",
  "access_level": "member",
  "preview_mode": "paywall_marker",
  "position": 1,
  "estimated_minutes": 15
}
```

执行：

```bash
curl --fail-with-body \
  -X POST "https://example.com/api/v1/import/courses/macro-basics-v1/chapters" \
  -H "Authorization: Bearer ${HERMES_TOKEN}" \
  -H "Idempotency-Key: chapter-macro-basics-01-rev-1" \
  -H "Content-Type: application/json" \
  --data-binary @chapter-01.json
```

### 章节成功响应

```json
{
  "request_id": "20e90376-6481-46ca-b707-bdd109c38ce2",
  "data": {
    "action": "created",
    "course_id": "51f93af0-e5e8-4ca0-bd24-93a6cd858c50",
    "course_external_id": "macro-basics-v1",
    "chapter_id": "752163a9-6d80-4761-b1ed-03accce32313",
    "external_id": "macro-basics-chapter-01",
    "status": "pending_review",
    "url": "/courses/macro-economics-basics/what-is-macroeconomics",
    "warnings": []
  }
}
```

## 三、查询导入结果

### 查询课程

```bash
curl --fail-with-body \
  "https://example.com/api/v1/import/courses/macro-basics-v1" \
  -H "Authorization: Bearer ${HERMES_TOKEN}"
```

### 查询章节

```bash
curl --fail-with-body \
  "https://example.com/api/v1/import/courses/macro-basics-v1/chapters/macro-basics-chapter-01" \
  -H "Authorization: Bearer ${HERMES_TOKEN}"
```

### 查询导入请求

```bash
curl --fail-with-body \
  "https://example.com/api/v1/import/status/20e90376-6481-46ca-b707-bdd109c38ce2" \
  -H "Authorization: Bearer ${HERMES_TOKEN}"
```

查询 Token 需要 `imports:read`。API Client 只能读取自己导入的课程、章节和请求记录。

## 父课程规则

- 网站不会自动创建缺失的父课程。
- 章节只能导入到当前 API Client 自己创建的课程。
- 父课程可以处于 `draft`、`pending_review` 或 `published`。
- 父课程已归档或软删除时，章节导入被拒绝。
- 课程更新不会自动修改已有章节状态。

## HTML 与素材规则

- 课程 `description_html` 按公开 HTML 清洗，不允许 `<!-- PAYWALL -->`。
- 课程封面和课程简介图片必须是 active public 素材。
- 章节正文复用研报付费墙规则。
- `member + paywall_marker` 必须且只能包含一个 `<!-- PAYWALL -->`。
- 付费墙前的图片必须为 public；会员部分可使用 public 或 member 素材。
- 网站不会接受外链图片、Data URL、SVG、脚本或事件属性。

## 幂等和重试

- 相同 Client、相同 Idempotency-Key、相同请求内容：重放第一次保存的响应和 HTTP 状态。
- 相同 Client、相同 Idempotency-Key、不同请求内容：HTTP `409`，`IDEMPOTENCY_CONFLICT`。
- JSON 字段顺序变化不影响稳定请求哈希。
- 章节请求哈希包含父课程 external_id，不能把同一章节请求错误重放到另一门课程。
- 修改课程或章节内容时必须使用新的 Idempotency-Key。
- `retryable=true` 时可使用相同 Key 退避重试；`retryable=false` 时应修复请求并使用新 Key。

## 常见错误

| HTTP | 错误码 | 含义 |
|---:|---|---|
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | 缺少 Idempotency-Key |
| 400 | `INVALID_JSON` | JSON 格式错误 |
| 400 | `VALIDATION_FAILED` | 字段或严格 Schema 校验失败 |
| 401 | `API_TOKEN_INVALID` | Token、到期时间或 Client 状态无效 |
| 403 | `SCOPE_DENIED` | 缺少 courses:write 或 imports:read |
| 404 | `COURSE_NOT_FOUND` | 父课程不存在或不属于当前 Client |
| 409 | `IDEMPOTENCY_CONFLICT` | 同一 Key 对应了不同请求 |
| 409 | `COURSE_SLUG_CONFLICT` | 课程 Slug 被占用 |
| 409 | `CHAPTER_SLUG_CONFLICT` | 同课程章节 Slug 被占用 |
| 409 | `COURSE_ARCHIVED` | 父课程已归档 |
| 409 | `COURSE_EXTERNAL_ID_DELETED` | 课程 external_id 已被软删除记录占用 |
| 409 | `CHAPTER_EXTERNAL_ID_DELETED` | 章节 external_id 已被软删除记录占用 |
| 422 | `PAYWALL_MARKER_REQUIRED` | 会员试读章节缺少付费墙标记 |
| 422 | `COURSE_ASSET_VALIDATION_FAILED` | 课程或章节素材不存在、已删除或权限不匹配 |
| 500 | `INTERNAL_ERROR` | 可按 retryable 字段决定是否重试 |
