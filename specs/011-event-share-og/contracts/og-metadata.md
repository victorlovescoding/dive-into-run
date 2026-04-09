# OG Metadata Contract

**Feature**: 011-event-share-og | **Date**: 2026-04-10

本文件定義社群平台 crawler 消費的 Open Graph / Twitter Card metadata 結構。

---

## Event Detail Page (`/events/{id}`)

### 正常情況（Event 存在）

```html
<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Dive Into Run" />
<meta property="og:title" content="{event.title}" />
<meta property="og:description" content="「{YYYY/MM/DD} · {city}{district}」" />
<meta property="og:image" content="{metadataBase}/og-default.png" />
<meta property="og:url" content="{metadataBase}/events/{id}" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{event.title}" />
<meta name="twitter:description" content="「{YYYY/MM/DD} · {city}{district}」" />
<meta name="twitter:image" content="{metadataBase}/og-default.png" />
```

### Fallback（Event 不存在）

```html
<meta property="og:title" content="Dive Into Run" />
<meta property="og:description" content="Dive Into Run 跑步社群平台" />
<meta property="og:image" content="{metadataBase}/og-default.png" />
<meta property="og:url" content="{metadataBase}/events/{id}" />
```

---

## Post Detail Page (`/posts/{id}`)

### 正常情況（Post 存在）

```html
<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Dive Into Run" />
<meta property="og:title" content="{post.title}" />
<meta property="og:description" content="「{post.title} — {前80字純文字}…」" />
<meta property="og:image" content="{metadataBase}/og-default.png" />
<meta property="og:url" content="{metadataBase}/posts/{id}" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{post.title}" />
<meta name="twitter:description" content="「{post.title} — {前80字純文字}…」" />
<meta name="twitter:image" content="{metadataBase}/og-default.png" />
```

### Fallback（Post 不存在）

```html
<meta property="og:title" content="Dive Into Run" />
<meta property="og:description" content="Dive Into Run 跑步社群平台" />
<meta property="og:image" content="{metadataBase}/og-default.png" />
<meta property="og:url" content="{metadataBase}/posts/{id}" />
```

---

## Description 產生規則

### Event

```
格式：「{YYYY/MM/DD} · {city}{district}」
範例：「2026/04/15 · 台北市大安區」

- 日期格式固定 YYYY/MM/DD
- city 和 district 之間無空格
- 若 city 或 district 為空，省略該部分
```

### Post

```
格式：「{title} — {plainTextExcerpt}…」
範例：「我的跑步心得 — 今天第一次跑完半馬，沿途風景很美，經過河濱公園的時候看到很多人在散步…」

- 去除 HTML tags（<p>, <br>, <strong> 等）
- 去除 Markdown 標記（#, **, *, >, - 等）
- 取前 80 個字元
- 超過 80 字加「…」
- 不超過 80 字不加「…」
```

---

## Image 規格

| 屬性     | 值                                       |
| -------- | ---------------------------------------- |
| 路徑     | `/og-default.png`                        |
| 尺寸     | 1200 x 630 px                            |
| 格式     | PNG                                      |
| 檔案大小 | < 200KB（建議）                          |
| 備註     | 初期為 placeholder，後續替換為正式品牌圖 |
