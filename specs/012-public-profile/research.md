# Research: 使用者公開檔案頁面 (Public Profile)

**Feature Branch**: `012-public-profile`
**Date**: 2026-04-10

---

## R-001: 統計數據查詢策略

### 問題

公開檔案需顯示三項統計：開團數、參團數、累計跑步公里數。這些數據散落在不同 collection，需決定查詢策略。

### Decision: Client-side 聚合查詢（即時計算）

每次載入公開檔案時，分別查詢並在 client 端計算：

- **開團數**: `events` collection `where('hostUid', '==', uid)` 的 `size`
- **參團數**: `collectionGroup('participants')` `where('uid', '==', uid)` 的 `size`（既有 `fetchMyEventIds` 已使用此模式）
- **累計公里數**: `stravaActivities` `where('uid', '==', uid)` 的 `distanceMeters` 加總 / 1000

### Rationale

- MVP 階段使用者數量小，即時聚合足以應付
- 避免引入 Cloud Functions 或 denormalized counter 的額外複雜度
- 既有 `firebase-member.js` 已使用相同的 `collectionGroup('participants')` 查詢模式
- 未來若效能不足，可加 `profileStats` subcollection 做 denormalized cache

### Alternatives Considered

1. **Firestore Cloud Functions trigger** — 事件變更時更新 counter document。過度設計，MVP 不需要
2. **Server-side aggregation (Route Handler)** — 增加 API 層複雜度，公開頁面不需要 auth，直接 client query 更簡單

---

## R-002: 累計公里數查詢效能

### 問題

`stravaActivities` 可能有大量文件，全部讀取來算 sum 成本高。

### Decision: 使用 Firestore `count()` + 自訂聚合

- 先查 `stravaConnections/{uid}` 確認是否有連結 Strava
- 若有連結，查詢 `stravaActivities` where `uid == targetUid`，用 `getAggregateFromServer` 取 count
- 對於距離加總，Firestore v9 `getAggregateFromServer` 支援 `sum('distanceMeters')`（Firebase JS SDK v10.5+）
- 退路方案：若 SDK 版本不支援 sum，改用分頁讀取 `distanceMeters` 欄位做 client-side sum

### Rationale

- `getAggregateFromServer({ totalDistance: sum('distanceMeters') })` 是最高效方案，只讀一次不下載 document
- 需確認專案 Firebase SDK 版本是否支援

### Alternatives Considered

1. **全量讀取** — 下載所有 activity documents 再加總。浪費頻寬，活動多時 UX 差
2. **Denormalized counter** — 在 user document 存 `totalKm` 欄位。需 Cloud Functions 維護，過度設計

---

## R-003: generateMetadata 實作方式

### 問題

Spec 要求 SEO / Open Graph meta tags（og:title, og:description, og:image）。專案目前無 `generateMetadata` 範例。

### Decision: 在 `page.jsx` (Server Component) 使用 Next.js `generateMetadata`

```js
export async function generateMetadata({ params }) {
  const { uid } = await params;
  const user = await getUserProfile(uid); // server-side fetch
  return {
    title: `${user?.name ?? '使用者'} — Dive into Run`,
    description: user?.bio || `${user?.name} 的跑步檔案`,
    openGraph: {
      title: `${user?.name ?? '使用者'} — Dive into Run`,
      description: user?.bio || `${user?.name} 的跑步檔案`,
      images: user?.photoURL ? [{ url: user.photoURL }] : [],
    },
  };
}
```

### Rationale

- Next.js 15 App Router 原生支援 `generateMetadata` async function
- Server Component 可直接存取 Firestore（透過 Firebase Admin 或 client SDK with server context）
- 但本專案使用 client SDK（無 Admin SDK），需在 server component 中使用 Firestore client SDK
- 注意：Firestore client SDK 在 server component 可用（初始化一次），但需確保 `firebase-client.js` 在 server 端可 import

### Alternatives Considered

1. **靜態 metadata** — 不做動態 OG tags。不符合 spec 要求
2. **Route Handler API** — 額外複雜度，不需要

---

## R-004: Bio 編輯方式與存儲

### 問題

Bio 是新增欄位，需決定 UI 位置、儲存方式、驗證方式。

### Decision: 在會員頁面新增 Bio 編輯區塊

- **儲存**: `users/{uid}` document 新增 `bio: string` 欄位
- **更新**: `setDoc(docRef, { bio }, { merge: true })` — 與現有 `updateUserName` 模式一致
- **驗證**: client-side 字數限制 150 字 + Firestore Security Rules（server-side 防護）
- **UI**: 在會員頁面的個人資料區塊下方新增 textarea + 字數計數 + 儲存按鈕
- **XSS 防護**: React 自動轉義 JSX 中的字串輸出，無需額外處理

### Rationale

- 現有 `watchUserProfile` 已使用 `onSnapshot` 監聽 `users/{uid}`，新增 `bio` 欄位會自動同步到 AuthContext
- 不需要獨立的 API endpoint

### Alternatives Considered

1. **獨立 bio collection** — 過度設計，bio 就是 user profile 的一部分
2. **Modal 編輯** — spec 沒有要求 modal，直接 inline 編輯更簡單

---

## R-005: UserLink 共用元件設計

### 問題

全站多處顯示使用者名稱/頭像，需統一為可點擊連結。影響範圍大，需設計可複用元件。

### Decision: 建立 `UserLink` 共用元件

```jsx
/**
 * 可點擊的使用者名稱/頭像連結。
 * @param {object} props
 * @param {string} props.uid - 使用者 UID。
 * @param {string} props.name - 顯示名稱。
 * @param {string} [props.photoURL] - 頭像 URL。
 * @param {number} [props.size] - 頭像大小 (px)，預設 36。
 * @param {boolean} [props.showAvatar] - 是否顯示頭像，預設 true。
 * @param {boolean} [props.showName] - 是否顯示名稱，預設 true。
 * @param {string} [props.className] - 額外 CSS class。
 */
function UserLink({ uid, name, photoURL, size, showAvatar, showName, className }) {}
```

### 需修改的元件

| 元件                 | 檔案                                        | 修改點                                 |
| -------------------- | ------------------------------------------- | -------------------------------------- |
| CommentCard          | `src/components/CommentCard.jsx`            | 作者名稱 + 頭像 → UserLink             |
| EventDetail          | `src/app/events/[id]/eventDetailClient.jsx` | 主揪名稱 + 頭像、參與者名稱 → UserLink |
| PostDetail           | `src/app/posts/[id]/PostDetailClient.jsx`   | 作者名稱 → UserLink                    |
| EventCard (活動列表) | `src/app/events/page.jsx`                   | 主揪名稱 → UserLink                    |
| PostCard (文章列表)  | `src/app/posts/page.jsx`                    | 作者名稱 → UserLink                    |

### Rationale

- 單一元件統一處理頭像 fallback、連結格式、a11y（role、aria-label）
- 減少各元件重複實作相同的 avatar + link 邏輯
- 修改時只需改 UserLink 一處

---

## R-006: 主辦活動列表分頁

### 問題

公開檔案需顯示使用者主辦的活動列表，按時間倒序，每次 5 筆，支援「載入更多」。

### Decision: Firestore cursor-based 分頁 + IntersectionObserver

- 查詢: `events` collection `where('hostUid', '==', uid)`, `orderBy('time', 'desc')`, `limit(5)`, `startAfter(lastDoc)`
- UI: 使用 IntersectionObserver 搭配 sentinel element，觸發載入更多
- 複用既有 EventCard 元件顯示每筆活動

### Rationale

- 與專案既有的 `useDashboardTab` hook 和 `useComments` 的 IntersectionObserver 模式一致
- Firestore cursor-based 分頁是 Constitution Principle III 的要求
- EventCard 已有完整的活動資訊顯示，直接複用

---

## R-007: Server Component vs Client Component 分界

### 問題

公開檔案頁面需要 `generateMetadata`（Server Component），但也需要互動功能（Client Component）。

### Decision: 混合架構

- `page.jsx` — **Server Component**: `generateMetadata` + 基本 user data fetch + render `<ProfileClient>`
- `ProfileClient.jsx` — **Client Component** (`'use client'`): 統計數據、活動列表、互動邏輯
- `ProfileHeader.jsx` — **Client Component**: 頭像 + 名稱 + 簡介 + 加入日期 + 自己檔案提示
- `ProfileStats.jsx` — **Client Component**: 統計數據展示
- `ProfileEventList.jsx` — **Client Component**: 活動列表 + infinite scroll

### Rationale

- `generateMetadata` 只能在 Server Component 中使用
- 統計數據、互動功能需要 client-side state management
- 拆分子元件符合 Constitution Principle IX（No logic in JSX）

### Server-side data fetching 注意事項

- `page.jsx` 需要在 server 端讀取 `users/{uid}` document
- 專案使用 Firestore client SDK（非 Admin SDK），在 Server Component 中需確保 firebase-client.js 在 server 端可初始化
- 如不可行，page.jsx 只做 metadata + params 傳遞，所有 data fetch 移至 ProfileClient
