# Implementation Plan: Member Activity Dashboard

**Branch**: `007-member-dashboard` | **Date**: 2026-04-07 | **Spec**: `specs/007-member-dashboard/spec.md`

## Summary

在會員頁面個人資訊下方新增三 Tab 活動紀錄區塊（我的活動 / 我的文章 / 我的留言），每個 Tab 初始 5 筆、IntersectionObserver infinite scroll。需新增 service layer（`firebase-member.js`）、通用 paginated tab hook（`useDashboardTab.js`）、Tab 容器與三種卡片元件。

## Technical Context

**Language/Version**: JavaScript (ES6+), JSDoc `checkJs: true`
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+ (Firestore client SDK)
**Storage**: Firestore — `events`, `posts`, `posts/{postId}/comments` collections
**Testing**: Vitest (unit/integration, jsdom), Playwright (E2E)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Tab 切換 < 200ms, 首次載入 < 2s, infinite scroll 載入 < 2s
**Constraints**: 每次 5 筆分頁, CSS Modules styling, 服務層隔離

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle        | Status | Notes                                                                     |
| ---------------- | ------ | ------------------------------------------------------------------------- |
| I. SDD/TDD       | PASS   | Spec 已完成，implementation 前會先寫測試                                  |
| II. 服務層隔離   | PASS   | 所有 Firestore 查詢封裝在 `firebase-member.js`，UI 不 import Firebase SDK |
| III. UX 一致性   | PASS   | IntersectionObserver + Firestore cursor，正體中文                         |
| IV. 效能併發     | PASS   | 無共享資源寫入，純讀取操作                                                |
| V. MVP 思維      | PASS   | 最小元件數，不做篩選/排序/計數等額外功能                                  |
| VI. 編碼標準     | PASS   | JSDoc、CSS Modules、const/解構、分號                                      |
| VII. 安全        | PASS   | 無新 secret 引入                                                          |
| VIII. 代理人協議 | PASS   | 修改前確認                                                                |
| IX. 鐵律         | PASS   | No logic in JSX、No eslint-disable、Meaningful JSDoc                      |

## Project Structure

### Documentation

```text
specs/007-member-dashboard/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
└── tasks.md             # Phase 2 (by /speckit.tasks)
```

### Source Code

```text
src/
├── lib/
│   └── firebase-member.js          # NEW: 三個 Tab 的 Firestore 查詢
├── hooks/
│   └── useDashboardTab.js          # NEW: 通用 paginated tab hook
├── components/
│   ├── DashboardTabs.jsx           # NEW: Tab 容器 + tab bar
│   ├── DashboardTabs.module.css
│   ├── DashboardEventCard.jsx      # NEW: Tab 1 活動卡片
│   ├── DashboardEventCard.module.css
│   ├── DashboardPostCard.jsx       # NEW: Tab 2 文章卡片
│   ├── DashboardPostCard.module.css
│   ├── DashboardCommentCard.jsx    # NEW: Tab 3 留言卡片
│   └── DashboardCommentCard.module.css
└── app/
    └── member/
        └── page.jsx                # MODIFY: 掛載 DashboardTabs

firestore.rules                     # MODIFY: 加 collectionGroup('comments') rule
firestore.indexes.json              # MODIFY: 加 composite indexes

specs/007-member-dashboard/tests/
├── unit/
│   └── firebase-member.test.js
└── integration/
    ├── DashboardTabs.test.jsx
    └── useDashboardTab.test.jsx
```

---

## Architecture

### Data Flow

```
MemberPage (page.jsx)
  └── DashboardTabs ({ uid })
        ├── Tab bar (role="tablist")
        ├── Panel 0: 我的活動 ── useDashboardTab(fetchMyEvents)
        │     └── DashboardEventCard × N
        ├── Panel 1: 我的文章 ── useDashboardTab(fetchMyPosts)
        │     └── DashboardPostCard × N
        └── Panel 2: 我的留言 ── useDashboardTab(fetchMyComments)
              └── DashboardCommentCard × N
```

### Tab 切換策略

三個 panel 同時 mount，非 active 的用 CSS `display: none` 隱藏。好處：

- 保留 DOM state（scroll position、已載入資料）
- `display: none` 的 sentinel 不會觸發 IntersectionObserver
- 簡單，不需手動管 scroll position

每個 `useDashboardTab` 接收 `isActive` 參數，控制：

- 首次變為 active 時才觸發 initial fetch（lazy load）
- IntersectionObserver 僅在 active 時連接

---

## Service Layer: `src/lib/firebase-member.js`

### 關鍵發現

- Events 的主辦者欄位實際是 `hostUid`（firestore.rules 驗證），typedef 寫 `hostId` 是 legacy 誤導
- Post comments 的文字欄位是 `comment`（不是 `content`），頭像欄位是 `authorImgURL`（不是 `authorPhotoURL`）
- `collectionGroup('comments')` 會同時撈到 event comments 和 post comments，兩種都保留並以 badge 區分來源
- Event comments 欄位：文字 `content`、頭像 `authorPhotoURL`；Post comments 欄位：文字 `comment`、頭像 `authorImgURL` — 兩套命名不同，需統一處理

### Function 1: `fetchMyEventIds(uid)`

```js
/**
 * 取得使用者參加 + 主辦的所有活動 ID。
 * @param {string} uid - 使用者 ID。
 * @returns {Promise<{ participantIds: string[], hostedIds: string[] }>}
 */
```

**策略**：兩個平行查詢

1. `collectionGroup('participants').where('uid', '==', uid)` → 取 `eventId` 欄位
2. `collection('events').where('hostUid', '==', uid)` → 取 doc.id

回傳去重後的 ID 集合。一般使用者參加活動數量在數十到低百量級，一次撈完可接受。

### Function 2: `fetchMyEvents(uid, options)`

```js
/**
 * 分頁取得使用者的活動列表，依活動時間由新到舊。
 * @param {string} uid - 使用者 ID。
 * @param {{ cursor?: number, pageSize?: number }} [options] - cursor 為 array offset。
 * @returns {Promise<{ items: MyEventItem[], nextCursor: number | null, hostedIds: Set<string> }>}
 */
```

**策略**（解決 union query 挑戰）：

1. 首次呼叫（cursor === undefined）：呼叫 `fetchMyEventIds(uid)` 取得所有 event IDs
2. 對所有 IDs 批次 `getDoc()` 取得完整 event data
3. 按 `time` desc 排序，存入 hook state
4. 依 cursor（array offset）切片，每次回傳 `pageSize` 筆
5. `nextCursor` = offset + pageSize，超過總數則 null

hostedIds 作為 Set 回傳，供 UI 判斷「主辦」badge。

### Function 3: `fetchMyPosts(uid, options)`

```js
/**
 * 分頁取得使用者發表的文章。
 * @param {string} uid - 使用者 ID。
 * @param {{ afterDoc?: QueryDocumentSnapshot | null, pageSize?: number }} [options]
 * @returns {Promise<{ items: Post[], lastDoc: QueryDocumentSnapshot | null }>}
 */
```

**策略**：標準 Firestore cursor pagination

- `collection('posts').where('authorUid', '==', uid).orderBy('postAt', 'desc').limit(pageSize)`
- 後續頁用 `startAfter(afterDoc)`
- 需要 composite index: `(authorUid ASC, postAt DESC)`

### Function 4: `fetchMyComments(uid, options)`

```js
/**
 * 分頁取得使用者在文章與活動下的所有留言。
 * @param {string} uid - 使用者 ID。
 * @param {{ afterDoc?: QueryDocumentSnapshot | null, pageSize?: number, titleCache?: Map<string, string> }} [options]
 * @returns {Promise<{ items: MyCommentItem[], lastDoc: QueryDocumentSnapshot | null }>}
 */
```

**策略**：

1. `collectionGroup('comments').where('authorUid', '==', uid).orderBy('createdAt', 'desc').limit(pageSize)`
   - 不需多撈，兩種留言都保留
2. 判斷來源：`doc.ref.parent.parent.parent.id` — `'posts'` 為文章留言，`'events'` 為活動留言
3. 統一欄位：文字讀 post → `comment` / event → `content`；來源類型存為 `source: 'post' | 'event'`
4. 從每筆 comment 提取 parentId（`doc.ref.parent.parent.id`）
5. 批次 `getDoc()` 取 parent title — post 取 `title`、event 取 `title`（已在 `titleCache` 中的跳過）
6. 需要 composite index: collectionGroup `comments` `(authorUid ASC, createdAt DESC)`
7. 需要 firestore.rules: `match /{path=**}/comments/{commentId} { allow read: if true; }`

---

## Custom Hook: `src/hooks/useDashboardTab.js`

```js
/**
 * @typedef {object} UseDashboardTabReturn
 * @property {any[]} items - 目前載入的項目。
 * @property {boolean} isLoading - 初始載入中。
 * @property {boolean} isLoadingMore - 載入更多中。
 * @property {boolean} hasMore - 是否還有更多。
 * @property {string | null} error - 初始載入錯誤訊息。
 * @property {() => void} retry - 重試初始載入。
 * @property {string | null} loadMoreError - 載入更多錯誤訊息。
 * @property {() => void} retryLoadMore - 重試載入更多。
 * @property {import('react').RefObject<HTMLDivElement | null>} sentinelRef - 哨兵 ref。
 */

/**
 * 管理單一 dashboard tab 的分頁資料。
 * @param {string | null} uid - 使用者 ID。
 * @param {Function} fetchFn - 服務層 fetch 函式。
 * @param {number} pageSize - 每頁筆數。
 * @param {boolean} isActive - 此 tab 是否 active。
 * @returns {UseDashboardTabReturn}
 */
```

**設計要點**（參考 `src/hooks/useComments.js` pattern）：

- Hook 順序: State → Refs (sentinelRef) → Effects (initial fetch, IntersectionObserver) → Handlers (retry)
- 首次 active 時才 fetch（lazy）、`cancelled` flag 防止 stale update
- IntersectionObserver: `rootMargin: '0px 0px 300px 0px'`，只在 `isActive && hasMore` 時連接
- cursor 型別彈性：Tab 1 用 number offset，Tab 2/3 用 Firestore DocumentSnapshot — hook 只負責傳遞，不關心型別
- 分離 `error`（初始載入）與 `loadMoreError`（載入更多），各有 retry

---

## UI Components

### `DashboardTabs.jsx`

- Props: `{ uid }`
- 管理 `activeTab` state (0, 1, 2)
- 建立 3 個 `useDashboardTab` hook 實例
- Tab bar: `role="tablist"`，每個 tab `role="tab"` + `aria-selected`
- Panel: `role="tabpanel"` + `aria-labelledby`
- 每個 panel 含: loading → error+retry → empty state → item list → sentinel → end hint

### `DashboardEventCard.jsx`

- Props: `{ event, isHost }`
- 顯示: title (Link to `/events/{id}`), datetime (用 `formatDateTime`), location, participants/max
- Badges: `isHost` → 「主辦」, `event.time > now` → 「即將到來」 / 「已結束」
- 複用 `formatDateTime` from `src/lib/event-helpers.js`

### `DashboardPostCard.jsx`

- Props: `{ post }`
- 顯示: title (Link to `/posts/{id}`), postAt, likesCount, commentsCount

### `DashboardCommentCard.jsx`

- Props: `{ comment }`（comment 物件已含 `source`, `parentId`, `parentTitle`, `text` 等正規化欄位）
- 顯示: 來源 badge（「文章」/「活動」）, parentTitle (Link to `/posts/{parentId}` 或 `/events/{parentId}`), comment text (`line-clamp: 2`), createdAt

### CSS 風格

沿用現有 codebase 慣例:

- 白底卡片 + 圓角 (8-12px) + subtle shadow
- 文字: `#202124` (primary), `#5f6368` (secondary)
- 邊框: `#e0e3e7`
- Badge: 小字 pill shape
- Responsive: `@media (max-width: 767px)`
- Empty state: 置中灰字
- Error: `#fce8e6` 背景 + `#c5221f` 文字
- End hint: dashed border

---

## Firestore Changes

### Security Rules

新增 collectionGroup('comments') 全域讀取規則（post comments 和 event comments 的 scoped rules 已允許 `read: if true`，此規則不擴大權限，僅啟用 collectionGroup 查詢路徑）:

```
// collectionGroup('comments') — member dashboard "我的留言" 查詢
match /{path=**}/comments/{commentId} {
  allow read: if true;
}
```

### Composite Indexes

新增至 `firestore.indexes.json`:

```json
{
  "collectionGroup": "participants",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "uid", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "comments",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "authorUid", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "posts",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "authorUid", "order": "ASCENDING" },
    { "fieldPath": "postAt", "order": "DESCENDING" }
  ]
}
```

---

## Known Challenges & Mitigations

| Challenge                                              | Mitigation                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Tab 1 union query 無法直接 Firestore 分頁              | 先撈全部 event IDs + docs → client-side sort → array offset 分頁。使用者量級可接受  |
| `collectionGroup('comments')` 混合 event/post comments | 兩種都保留，用 `doc.ref.parent.parent.parent.id` 判斷來源，badge 標示               |
| Event/post comments 欄位命名不同                       | service 層正規化：text 統一讀、source 標示來源，UI 不需知道底層差異                 |
| Comment 無 parentId 欄位                               | 從 doc path 提取 `doc.ref.parent.parent.id`                                         |
| 跨頁重複撈 parent title                                | hook 維護 `titleCache: Map<string, string>` 跨頁共用（post + event 共用同一 cache） |
| Tab 切換時 async 回傳 stale data                       | `cancelled` flag pattern（同 `useComments.js`）                                     |

---

## Verification

1. `npm run type-check` — 無 JSDoc/type 錯誤
2. `npm run lint` — 無 ESLint 警告
3. `npx vitest run specs/007-member-dashboard/` — 所有測試通過
4. `npm run dev` → 登入 → 會員頁面 → 確認三個 Tab 切換正常、資料正確、infinite scroll 運作
5. 手動測試 edge cases: 空資料 Tab、Tab 切換中途載入、全部載完提示
