# Research: 活動分享 + Open Graph

**Feature**: 011-event-share-og | **Date**: 2026-04-10

---

## R-001: Next.js 15 generateMetadata 搭配 Firebase Client SDK（Server-side）

**Decision**: 在 `page.jsx`（Server Component）中直接 import 並呼叫既有的 `fetchEventById` / `getPostDetail`。

**Rationale**:

- Firebase Client SDK（`firebase/firestore`）在 Node.js 環境可正常執行 `getDoc` 等讀取操作
- `firebase-client.js` 使用 `NEXT_PUBLIC_*` 環境變數，server/client 皆可存取
- `getAuth()` / `GoogleAuthProvider()` 在 server 端初始化不會報錯（無 browser API 依賴）
- `generateMetadata()` 只需讀取操作，不涉及 auth state
- 避免重複 data fetching 邏輯，符合 DRY 和 MVP 思維

**Alternatives considered**:

- Firebase Admin SDK（`firebase-admin.js`）：已存在但專用於 Route Handlers（Strava sync），需額外寫 admin 版本的 fetch 函式，增加維護成本
- REST API route + fetch：需新增 API endpoint，over-engineering

---

## R-002: Web Share API 瀏覽器支援與 Fallback 策略

**Decision**: 使用 `navigator.share()` 為主，`navigator.clipboard.writeText()` 為 fallback。

**Rationale**:

- Web Share API 支援：iOS Safari 12.2+、Android Chrome 61+、Desktop Chrome 89+、Edge 93+
- Desktop Firefox / 部分桌面瀏覽器不支援 → fallback 必要
- 偵測方式：`typeof navigator !== 'undefined' && navigator.share`（簡單、可靠）
- Clipboard API：所有現代瀏覽器皆支援（Chrome 66+、Firefox 63+、Safari 13.1+、Edge 79+）
- 離線狀態：`navigator.share()` 和 `navigator.clipboard` 不需網路連線，本身就能使用

**Alternatives considered**:

- 只用 clipboard：放棄原生分享面板體驗，mobile 使用者體驗差
- 第三方分享 library：over-engineering，增加 bundle size

---

## R-003: OG Image 規格與品牌圖片

**Decision**: 放置靜態品牌圖片 `public/og-default.png`（1200x630px），所有分享共用。

**Rationale**:

- Facebook 建議：1200x630px，比例 1.91:1
- LINE：支援同規格，最小 200x200px
- X (Twitter)：`summary_large_image` 建議 1200x628px（幾乎相同）
- 檔案大小限制：Facebook < 8MB、LINE < 1MB → 建議控制在 200KB 以下
- 目前 repo 無品牌 logo → 初期建立簡單的 placeholder 圖片，後續替換

**Alternatives considered**:

- 動態 OG 圖片生成（per-event）：Out of Scope（spec 明確排除）
- SVG 作為 OG image：社群平台不支援 SVG

---

## R-004: Next.js Metadata API 用法

**Decision**: 使用 `generateMetadata()` async function + root layout 的 `metadataBase`。

**Rationale**:

- Next.js 15 App Router 的 `generateMetadata()` 完整支援 `openGraph` 和 `twitter` 物件
- `metadataBase` 設在 root layout，自動將相對路徑解析為絕對 URL
- Next.js 自動處理 `<meta>` tag 生成，不需手動操作 `<head>`
- 頁面層級 metadata 會與 layout 層級合併（deep merge），不會衝突

**結構**:

```js
// src/app/layout.jsx
export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Dive Into Run',
  description: 'Dive Into Run 跑步社群平台',
  openGraph: { siteName: 'Dive Into Run', type: 'website' },
};

// src/app/events/[id]/page.jsx
export async function generateMetadata({ params }) { ... }
```

**Alternatives considered**:

- 手動在 `<Head>` 中寫 `<meta>` tags：Next.js App Router 不支援 `next/head`，且 `generateMetadata` 是官方推薦做法
- Middleware 注入 metadata：不適用於動態內容

---

## R-005: 特殊字元處理

**Decision**: 使用 Next.js Metadata API 的自動 HTML escaping，額外在 helper 中做 text normalization。

**Rationale**:

- Next.js `generateMetadata()` 回傳的值會自動進行 HTML entity escaping
- 不需手動處理 `&quot;`、`&amp;` 等
- 需要自行處理的部分：
  - 文章內容去除 HTML/Markdown 標記（用於 `og:description`）
  - 截斷至 80 字後加 `…`
  - Emoji 保留（OG 支援 Unicode）

**Alternatives considered**:

- 手動 escapeHtml：Next.js 已處理，重複工作
