# Data Model: 模組化內容檢舉系統

## Overview

The report module stores one immutable Phase 1 report document per `(reporterUid, targetType, targetKey)`. The client submits a minimal request to `POST /api/reports`; the server builds target identity, resolves the target, generates the target snapshot, and writes the report document to `reports`.

Client preview data is never trusted and is not part of the API payload.

## Entity: Report

Collection: `reports`

Document id: `sha256(reporterUid + ":" + targetType + ":" + targetKey)` as lowercase hex.

| Field | Type | Required | Source | Validation / Notes |
| --- | --- | --- | --- | --- |
| `targetType` | `ReportTargetType` | Yes | Request validated by server | One of `post`, `postComment`, `event`, `eventComment`. |
| `targetKey` | string | Yes | Server | Canonical key from target identity. See TargetIdentity. |
| `targetIdentity` | `TargetIdentity` | Yes | Request validated by server | Stores exact ids needed to locate the target. |
| `reporterUid` | string | Yes | Auth token | Firebase Auth uid from Admin verification only. |
| `reason` | `ReportReason` | Yes | Request | Stable enum key. |
| `details` | string | Yes | Request | Trimmed string, max 500 characters. Empty string allowed except when `reason` is `other`. |
| `status` | `ReportStatus` | Yes | Server | Initial value is `open`. |
| `createdAt` | Firestore Timestamp | Yes | Server | Use Admin/server timestamp helper. |
| `sourcePath` | `SourcePath` | Yes | Request sanitized by server | Same-app relative route only, max 1024 characters; fallback to targetPath when missing, invalid, or over max. |
| `targetSnapshot` | `ReportTargetSnapshot` | Yes | Server target resolver | Minimal server-generated context. |

### Report validation

- Reporter must be authenticated by server-side Firebase Admin Auth.
- Reporter must not be the target author. For comments, target author is the comment author, not the parent post/event author.
- Target must exist and be public/active according to the target domain rules.
- Comment targets must also validate parent post/event public/active state.
- Duplicate report create for the same `(reporterUid, targetType, targetKey)` returns 409 and must not overwrite the existing document.
- Reports are Phase 1 immutable from the client perspective. No client get/list/create/update/delete is allowed.

### Report state transitions

| From | Event | To | Phase |
| --- | --- | --- | --- |
| none | First valid report create | `open` | Phase 1 |
| `open` | Admin review/moderation | out of scope | Not Phase 1 |

Phase 1 does not define user-visible transitions after `open`.

## Entity: TargetIdentity

Target identity is a discriminated object keyed by `targetType`. All ids are trimmed strings and must be non-empty. Ids must not contain `/`, control characters, or URL/script payloads.

| targetType | Required ids | targetKey | Firestore target doc | targetPath |
| --- | --- | --- | --- | --- |
| `post` | `postId` | `posts/{postId}` | `posts/{postId}` | `/posts/{postId}` |
| `postComment` | `postId`, `commentId` | `posts/{postId}/comments/{commentId}` | `posts/{postId}/comments/{commentId}` | `/posts/{postId}?commentId={commentId}` |
| `event` | `eventId` | `events/{eventId}` | `events/{eventId}` | `/events/{eventId}` |
| `eventComment` | `eventId`, `commentId` | `events/{eventId}/comments/{commentId}` | `events/{eventId}/comments/{commentId}` | `/events/{eventId}?commentId={commentId}` |

### TargetIdentity variants

```json
{ "targetType": "post", "postId": "post_123" }
```

```json
{ "targetType": "postComment", "postId": "post_123", "commentId": "comment_456" }
```

```json
{ "targetType": "event", "eventId": "event_123" }
```

```json
{ "targetType": "eventComment", "eventId": "event_123", "commentId": "comment_456" }
```

## Entity: ReportTargetSnapshot

Server-generated minimal snapshot saved inside `Report.targetSnapshot`.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| `authorUid` | string | Yes | Target author's uid. |
| `authorDisplayName` | string | Yes | Target author's display name. Use existing target author field; fallback to `匿名使用者` only when the domain already does so. |
| `title` | string | Conditional | Preserve full title for targets that have a title. Omit or store empty string for comment-only targets without title. |
| `excerpt` | string | Yes | Body/comment excerpt, trimmed and limited to 500 characters. |
| `targetPath` | string | Yes | Server-generated canonical path from TargetIdentity. |
| `createdAt` | Firestore Timestamp or null | Yes | Target creation timestamp when present; null only if legacy target data lacks it. |

### Snapshot mappings

| targetType | authorUid | authorDisplayName | title | excerpt | createdAt |
| --- | --- | --- | --- | --- | --- |
| `post` | `post.authorUid` | `post.authorName` | `post.title` | `post.content` | `post.postAt` |
| `postComment` | `comment.authorUid` | `comment.authorName` | parent `post.title` for context | `comment.comment` | `comment.createdAt` |
| `event` | `event.hostUid` | `event.hostName` | `event.title` | `event.description` | `event.createdAt` |
| `eventComment` | `comment.authorUid` | `comment.authorName` | parent `event.title` for context | `comment.content` | `comment.createdAt` |

### Forbidden snapshot fields

- Image URLs or media URLs, including `authorImgURL`, `authorPhotoURL`, `hostPhotoURL`, `routeImage`, post media, or event route media.
- Full author profiles.
- Reporter display name, photo URL, email, or profile fields.
- Full body/comment text beyond the 500-character excerpt.

## Entity: ReportRequestPayload

Request body for `POST /api/reports`.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| `targetType` | `ReportTargetType` | Yes | One of four supported target types. |
| `target` | object | Yes | Contains ids for the selected targetType. Unknown ids are rejected. |
| `reason` | `ReportReason` | Yes | Required. |
| `details` | string | No | Trimmed. Missing becomes empty string. Max 500 characters. Required after trim when reason is `other`. |
| `sourcePath` | `SourcePath` | No | Sanitized same-app route, max 1024 characters. Missing, invalid, or over max falls back to targetPath. |

### Payload validation

- Reject malformed JSON with 400.
- Reject unsupported `targetType` with 400.
- Reject missing or extra target ids with 400.
- Reject invalid `reason` with 400.
- Reject `details` longer than 500 characters with 400.
- Reject `reason: "other"` when trimmed details is empty with 400.
- Reject client-supplied server-owned fields with 400: `reportId`, `targetKey`, `targetSnapshot`, `reporterUid`, `status`, and `createdAt`.

## Entity: ReportReason

| Key | Label |
| --- | --- |
| `spam` | `垃圾訊息` |
| `harassment` | `騷擾或霸凌` |
| `hate` | `仇恨或歧視` |
| `sexual` | `色情內容` |
| `violence` | `暴力或危險行為` |
| `illegal` | `違法內容` |
| `misinformation` | `不實或誤導` |
| `other` | `其他` |

## Entity: ReportStatus

| Key | Phase | Notes |
| --- | --- | --- |
| `open` | Phase 1 | Only status created by Phase 1. |

Future moderation statuses are out of scope and must not be introduced by Phase 1 tasks.

## Entity: SourcePath

`sourcePath` is contextual metadata from the current route, not proof of target state.

| Rule | Behavior |
| --- | --- |
| Missing or non-string | Use server targetPath. |
| Does not start with `/` | Use server targetPath. |
| Starts with `//` or contains a URL protocol | Use server targetPath. |
| Contains control characters, `<script`, or markup payload | Use server targetPath. |
| Exceeds 1024 characters | Use server targetPath. Do not truncate. |
| Valid app-relative path at or below 1024 characters | Save normalized path and query string. |

## Document shape

```json
{
  "targetType": "postComment",
  "targetKey": "posts/post_123/comments/comment_456",
  "targetIdentity": {
    "targetType": "postComment",
    "postId": "post_123",
    "commentId": "comment_456"
  },
  "reporterUid": "uid_reporter",
  "reason": "harassment",
  "details": "補充說明",
  "status": "open",
  "createdAt": "<server timestamp>",
  "sourcePath": "/posts/post_123?commentId=comment_456",
  "targetSnapshot": {
    "authorUid": "uid_author",
    "authorDisplayName": "留言者",
    "title": "文章標題",
    "excerpt": "留言摘要",
    "targetPath": "/posts/post_123?commentId=comment_456",
    "createdAt": "<target timestamp>"
  }
}
```
