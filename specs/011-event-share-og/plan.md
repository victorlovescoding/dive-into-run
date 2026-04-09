# Implementation Plan: 活動分享 + Open Graph

**Branch**: `011-event-share-og` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-event-share-og/spec.md`

## Summary

為活動與文章詳情頁加入 Open Graph / Twitter Card metadata 和分享按鈕。技術核心：Next.js 15 `generateMetadata()` 動態產生 OG tags + 靜態品牌圖片，搭配 Web Share API（mobile）+ Clipboard API fallback（desktop）的共用分享按鈕元件。不新增 Firestore schema，僅讀取既有 event/post 資料。

## Technical Context

**Language/Version**: JavaScript (ES6+), JSDoc `checkJs: true`
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+ (Firestore client SDK)
**Storage**: Firestore — 使用既有 `events`、`posts` collections（不修改 schema）
**Testing**: Vitest (Unit/Integration), Playwright (E2E)
**Target Platform**: Web (Mobile + Desktop browsers)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: 分享按鈕互動 < 2 秒（SC-003）；metadata 不增加 client bundle
**Constraints**: OG metadata 必須 server-side 產生（社群平台 crawler 不執行 JS）
**Scale/Scope**: 2 頁面修改 + 1 共用元件 + 1 helper module + 1 layout 修改

## Constitution Check

### Pre-Design Gate

| Principle             | Status | Notes                                                                                   |
| --------------------- | ------ | --------------------------------------------------------------------------------------- |
| I. SDD/TDD            | ✅     | spec.md 完成 → plan → tasks → RED-GREEN-REFACTOR                                        |
| II. Service Layer     | ✅     | 使用既有 `firebase-events.js` / `firebase-posts.js`；新增 `og-helpers.js` 在 `src/lib/` |
| III. UX Consistency   | ✅     | 正體中文、使用既有 toast 系統（009-global-toast）                                       |
| IV. Performance       | ✅     | metadata 在 server-side 產生，零 client 效能影響                                        |
| V. MVP 思維           | ✅     | 靜態品牌圖片、無動態 OG 圖片生成、最少新檔案                                            |
| VI. Modern Standards  | ✅     | JSDoc、const、解構、CSS Modules、無 `var`                                               |
| VII. Security         | ✅     | 無機密處理、OG description 特殊字元由 Next.js 自動 escape                               |
| VIII. Agent Protocol  | ✅     | 修改前確認、資訊誠實                                                                    |
| IX. Coding Iron Rules | ✅     | No logic in JSX（ShareButton 邏輯抽至 handler）、meaningful JSDoc                       |

### Post-Design Gate

| Principle             | Status | Notes                                                                                       |
| --------------------- | ------ | ------------------------------------------------------------------------------------------- |
| I. SDD/TDD            | ✅     | data-model / contracts 完成，可進入 task 生成                                               |
| II. Service Layer     | ✅     | `og-helpers.js` 純 helper（無 Firebase 依賴）；`generateMetadata` 透過 service layer 取資料 |
| III. UX Consistency   | ✅     | ShareButton 通用元件、toast 回饋一致                                                        |
| V. MVP 思維           | ✅     | 6 個新/修改檔案，無多餘抽象                                                                 |
| IX. Coding Iron Rules | ✅     | ShareButton 的分享邏輯在 handler function，JSX 只負責 render                                |

## Project Structure

### Documentation (this feature)

```text
specs/011-event-share-og/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 — 技術決策與替代方案
├── data-model.md        # Phase 1 — 資料模型（無 schema 變更）
├── quickstart.md        # Phase 1 — 開發與測試指南
├── contracts/
│   └── og-metadata.md   # Phase 1 — OG/Twitter Card 結構契約
└── tasks.md             # Phase 2 — /speckit.tasks 產出
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.jsx                    # [修改] 加入 metadataBase + 全站 OG 預設
│   ├── events/[id]/
│   │   └── page.jsx                  # [修改] 加入 generateMetadata()
│   └── posts/[id]/
│       └── page.jsx                  # [修改] 加入 generateMetadata()
├── components/
│   ├── ShareButton.jsx               # [新建] 共用分享按鈕（Web Share + Clipboard fallback）
│   └── ShareButton.module.css        # [新建] 分享按鈕樣式
└── lib/
    └── og-helpers.js                 # [新建] OG description 格式化 helpers

public/
└── og-default.png                    # [新建] 品牌預設 OG 圖片 (1200×630px placeholder)

specs/011-event-share-og/tests/
├── unit/
│   └── og-helpers.test.js            # og-helpers 純函式測試
└── integration/
    └── ShareButton.test.jsx          # ShareButton 元件整合測試
```

**Structure Decision**: Next.js App Router 單一專案架構。新增 3 個檔案（helper + component + CSS）、修改 3 個既有檔案（layout + 2 page）、1 張圖片。符合 MVP 最小化原則。

## Design Decisions

### D-001: Server-side metadata 取資料方式

在 `generateMetadata()`（Server Component）中直接呼叫既有的 `fetchEventById` / `getPostDetail`。Firebase Client SDK 的 `getDoc` 在 Node.js 環境可正常執行讀取操作。

→ 詳見 [research.md](./research.md) R-001

### D-002: ShareButton 架構

單一共用元件，接受 `title` + `url` props。內部邏輯：

```
handleShare():
  1. if (navigator.share) → navigator.share({ title, url })
  2. else → navigator.clipboard.writeText(url) → showToast('已複製連結')
  3. catch → showToast('分享失敗', 'error')
```

元件使用 `useToast()` hook 取得 toast 函式。Props 由父層（eventDetailClient / PostDetailClient）傳入。

### D-003: metadataBase 設定

在 `src/app/layout.jsx` 加入 `metadataBase`，讓 OG image 和 URL 的相對路徑自動解析為絕對 URL：

```js
metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
```

需在 `.env` 加入 `NEXT_PUBLIC_SITE_URL`（部署環境設定）。

### D-004: og-helpers.js 函式設計

| Function                         | 輸入                       | 輸出                            | 用途                |
| -------------------------------- | -------------------------- | ------------------------------- | ------------------- |
| `buildEventOgDescription(event)` | `{ time, city, district }` | `「2026/04/15 · 台北市大安區」` | 活動 OG description |
| `buildPostOgDescription(post)`   | `{ title, content }`       | `「標題 — 前80字…」`            | 文章 OG description |
| `stripMarkup(text)`              | HTML/Markdown 文字         | 純文字                          | 內部 helper         |
| `truncate(text, maxLen)`         | 文字, 長度上限             | 截斷文字                        | 內部 helper         |

### D-005: ShareButton 放置位置

- **活動頁**（`eventDetailClient.jsx`）：標題區右側，與標題同行
- **文章頁**（`PostDetailClient.jsx`）：標題區右側，與標題同行
- 純 icon button（share icon），無文字，`aria-label="分享"`，hover 顯示 tooltip

## Complexity Tracking

> 無 Constitution 違規，不需記錄。

## File Change Summary

| 檔案                                        | 操作 | 說明                              |
| ------------------------------------------- | ---- | --------------------------------- |
| `src/app/layout.jsx`                        | 修改 | 加入 `metadataBase`、全站 OG 預設 |
| `src/app/events/[id]/page.jsx`              | 修改 | 加入 `generateMetadata()`         |
| `src/app/posts/[id]/page.jsx`               | 修改 | 加入 `generateMetadata()`         |
| `src/lib/og-helpers.js`                     | 新建 | OG description 格式化函式         |
| `src/components/ShareButton.jsx`            | 新建 | 共用分享按鈕元件                  |
| `src/components/ShareButton.module.css`     | 新建 | 分享按鈕樣式                      |
| `public/og-default.png`                     | 新建 | 品牌預設 OG 圖片 placeholder      |
| `src/app/events/[id]/eventDetailClient.jsx` | 修改 | 嵌入 ShareButton                  |
| `src/app/posts/[id]/PostDetailClient.jsx`   | 修改 | 嵌入 ShareButton                  |
