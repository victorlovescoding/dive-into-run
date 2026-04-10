# Data Model: 活動分享 + Open Graph

**Feature**: 011-event-share-og | **Date**: 2026-04-10

---

## Schema Changes

**無新增 Firestore collection 或欄位。** 本功能僅讀取既有資料產生 metadata。

---

## Existing Entities（讀取用）

### Event（`events` collection）

| Field      | Type      | 用途                | 對應 OG 欄位          |
| ---------- | --------- | ------------------- | --------------------- |
| `title`    | string    | 活動標題            | `og:title`            |
| `city`     | string    | 縣市（e.g. 台北市） | `og:description` 組合 |
| `district` | string    | 區域（e.g. 大安區） | `og:description` 組合 |
| `time`     | Timestamp | 活動時間            | `og:description` 組合 |

**OG description 格式**: `「{YYYY/MM/DD} · {city}{district}」`
例：「2026/04/15 · 台北市大安區」

### Post（`posts` collection）

| Field     | Type   | 用途                             | 對應 OG 欄位                       |
| --------- | ------ | -------------------------------- | ---------------------------------- |
| `title`   | string | 文章標題                         | `og:title`、`og:description` 前綴  |
| `content` | string | 文章內容（可能含 HTML/Markdown） | `og:description`（純文字前 80 字） |

**OG description 格式**: `「{title} — {前80字純文字}…」`

- 去除 HTML tags 和 Markdown 標記
- 超過 80 字加 `…`，不超過不加

---

## Metadata Entities（runtime 產生，不存 DB）

### EventOgMetadata

```
{
  title: string          // = event.title
  description: string    // = 格式化後的日期 + 地點
  image: string          // = '/og-default.png'（相對路徑，metadataBase 自動解析）
  url: string            // = '/events/{id}'
}
```

### PostOgMetadata

```
{
  title: string          // = post.title
  description: string    // = 標題 + 純文字摘要
  image: string          // = '/og-default.png'
  url: string            // = '/posts/{id}'
}
```

### FallbackMetadata（Event/Post 不存在時）

```
{
  title: 'Dive Into Run'
  description: 'Dive Into Run 跑步社群平台'
  image: '/og-default.png'
  url: '/events/{id}' or '/posts/{id}'
}
```

---

## Data Flow

```
Firestore (events/posts)
       │
       ▼
generateMetadata() ← fetchEventById / getPostDetail（Server Component）
       │
       ▼
Next.js Metadata API → <meta> tags in <head>
       │
       ▼
Social Platform Crawler → 預覽卡片
```

---

## Validation Rules

- `title`: 不可為空（fallback 到平台名稱）
- `description`: 特殊字元由 Next.js 自動 escape
- `image`: 固定路徑，不需驗證
- `content`（文章）: 去除 HTML/Markdown → 純文字截斷
