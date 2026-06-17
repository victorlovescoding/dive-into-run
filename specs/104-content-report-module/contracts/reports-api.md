# Contract: Reports API

## Endpoint

`POST /api/reports`

Creates one content report for the authenticated reporter and target. This is the only Phase 1 report creation entry point.

## Authentication

Required header:

```http
Authorization: Bearer <Firebase ID token>
```

The server verifies the token with Firebase Admin Auth. The client must not send `reporterUid`; reporter identity always comes from the verified token.

## Request body

```json
{
  "targetType": "post",
  "target": {
    "postId": "post_123"
  },
  "reason": "spam",
  "details": "",
  "sourcePath": "/posts/post_123"
}
```

### Common fields

| Field | Required | Notes |
| --- | --- | --- |
| `targetType` | Yes | `post`, `postComment`, `event`, or `eventComment`. |
| `target` | Yes | Target ids for the chosen targetType only. |
| `reason` | Yes | One of the stable reason keys in `data-model.md`. |
| `details` | No | Trimmed string. Max 500 characters. Required when reason is `other`. |
| `sourcePath` | No | Client route context. Server accepts only safe same-app relative paths up to 1024 characters; missing, invalid, or over-limit values fall back to the server-generated targetPath without truncation. |

### Payload variants

#### post

```json
{
  "targetType": "post",
  "target": { "postId": "post_123" },
  "reason": "spam",
  "details": "",
  "sourcePath": "/posts/post_123"
}
```

#### postComment

```json
{
  "targetType": "postComment",
  "target": {
    "postId": "post_123",
    "commentId": "comment_456"
  },
  "reason": "harassment",
  "details": "補充說明",
  "sourcePath": "/posts/post_123?commentId=comment_456"
}
```

#### event

```json
{
  "targetType": "event",
  "target": { "eventId": "event_123" },
  "reason": "misinformation",
  "details": "",
  "sourcePath": "/events/event_123"
}
```

#### eventComment

```json
{
  "targetType": "eventComment",
  "target": {
    "eventId": "event_123",
    "commentId": "comment_456"
  },
  "reason": "other",
  "details": "其他檢舉原因",
  "sourcePath": "/events/event_123?commentId=comment_456"
}
```

Phase 1 UI sends only `post` and `postComment`. Server/API tests still cover all four variants.

## Successful response

Status: `201 Created`

```json
{
  "ok": true,
  "reportId": "sha256_hex_doc_id",
  "status": "open",
  "message": "已收到你的檢舉，我們會進行審查。"
}
```

The reported content remains visible according to its existing visibility rules. Creating a report does not soft-delete, hide, pin, notify, or moderate content.

## Error responses

All errors return JSON:

```json
{
  "ok": false,
  "code": "duplicate_report",
  "message": "你已經檢舉過這則內容。"
}
```

| Status | Code | When | User-facing message |
| --- | --- | --- | --- |
| 400 | `invalid_request` | Malformed JSON, invalid targetType, missing/extra ids, invalid reason, details too long, `other` without details, or client-supplied server-owned fields. | `檢舉送出失敗，請稍後再試。` or a more specific form validation message before submit. |
| 401 | `unauthenticated` | Missing, malformed, expired, or invalid bearer token. | `檢舉送出失敗，請稍後再試。` |
| 403 | `self_report_forbidden` | Reporter uid equals target author uid. | `不能檢舉自己的內容。` |
| 404 | `target_unavailable` | Target or parent target does not exist, is not public-visible, is account-deletion hidden, or is soft-deleted. | `檢舉送出失敗，請稍後再試。` |
| 409 | `duplicate_report` | Same reporter already created a report for the same targetType/targetKey. | `你已經檢舉過這則內容。` |
| 500 | `internal_error` | Unexpected server failure. | `檢舉送出失敗，請稍後再試。` |

## Document shape

The server writes one document to `reports/{reportId}`:

```json
{
  "targetType": "post",
  "targetKey": "posts/post_123",
  "targetIdentity": {
    "targetType": "post",
    "postId": "post_123"
  },
  "reporterUid": "uid_reporter",
  "reason": "spam",
  "details": "",
  "status": "open",
  "createdAt": "<server timestamp>",
  "sourcePath": "/posts/post_123",
  "targetSnapshot": {
    "authorUid": "uid_author",
    "authorDisplayName": "作者名稱",
    "title": "完整文章標題",
    "excerpt": "最多 500 字的文章內容摘要",
    "targetPath": "/posts/post_123",
    "createdAt": "<target timestamp>"
  }
}
```

The server rejects client-supplied server-owned fields with 400: `reportId`, `targetKey`, `targetSnapshot`, `reporterUid`, `status`, and `createdAt`.

## Target resolution contract

| targetType | Server checks |
| --- | --- |
| `post` | `posts/{postId}` exists, is public-visible, not `accountDeletionHidden`, not soft-deleted, and author is not reporter. |
| `postComment` | Parent `posts/{postId}` passes post checks except self-report is checked against comment author; `comments/{commentId}` exists, is visible, not soft-deleted, and comment author is not reporter. |
| `event` | `events/{eventId}` exists, is public-visible, not `accountDeletionHidden`, not soft-deleted, and host/author is not reporter. |
| `eventComment` | Parent `events/{eventId}` passes event checks except self-report is checked against comment author; `comments/{commentId}` exists, is visible, not soft-deleted, and comment author is not reporter. |

## Firestore rules contract

Clients have no direct report access.

```text
match /reports/{reportId} {
  allow read, list, get, create, update, delete: if false;
}
```

Implementation may use equivalent Firestore rules syntax, but tests must prove:

- unauthenticated clients cannot read/list/create/update/delete reports.
- authenticated reporters cannot read/list/create/update/delete reports.
- authenticated non-reporters cannot read/list/create/update/delete reports.
- Server/Admin code remains the only write path.

## Client trust boundary

- Client chooses target ids, reason, details, and current route only.
- Client preview is display-only and must not be sent as snapshot authority.
- Server computes `targetKey`, `reportId`, `targetPath`, `targetSnapshot`, `reporterUid`, `status`, and `createdAt`.
- Client must not precheck whether a report exists and must not query report history.
- Duplicate state is revealed only by a second submit returning 409.

## Phase 1 UI contract

Expose report actions only for authenticated non-authors:

- `post`: `檢舉文章` on `/posts`, `/posts/search`, and `/posts/[id]`.
- `postComment`: `檢舉留言` on `/posts/[id]` normal comments and notification `?commentId=` target comment block.

Do not expose `event` or `eventComment` report entries in Phase 1 UI.
