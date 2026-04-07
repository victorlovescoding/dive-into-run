# Research: Member Activity Dashboard

**Branch**: `007-member-dashboard` | **Date**: 2026-04-07

## Research Task 1: "My Events" Union Query Strategy

**Context**: 需要查詢使用者參加的活動（participants 子集合）與主辦的活動（hostUid 欄位），兩者取聯集。Firestore 不支援跨 collection union query。

**Decision**: Upfront ID collection + client-side sort + array offset pagination

**Rationale**:

- 一般使用者參加的活動數量在數十到低百量級，一次撈完 ID 可接受
- 避免維護額外的 denormalized collection（如 `userEvents/{uid}/events`），減少寫入複雜度與 schema migration
- 避免 server-side API route，保持純 client-side Firestore 查詢架構一致性

**Alternatives considered**:

1. ~~Denormalized `userEvents` collection~~: 需 migration + 每次 join/leave/create event 都要同步更新，增加 transaction 複雜度。YAGNI for MVP。
2. ~~Server-side API route 做 merge~~: 打破 client-side Firestore pattern，增加 API latency。
3. ~~Dual cursor merge sort~~: 極度複雜，需維護兩個 cursor 的交錯排序邏輯，pagination edge cases 多。
4. ~~Firestore `in` query with batched IDs~~: `documentId()` with `in` 限制 10 items，需多次 chunked query + client merge，不比 `getDoc()` 簡單。

---

## Research Task 2: collectionGroup('comments') Cross-collection Filtering

**Context**: `collectionGroup('comments')` 會同時匹配 `posts/{postId}/comments` 和 `events/{eventId}/comments`。「我的留言」只要 post comments。

**Decision**: Client-side path filtering — `doc.ref.parent.parent.parent.id === 'posts'`

**Rationale**:

- Firestore 沒有 native 方式限制 collectionGroup 只查特定 parent collection
- Path-based filtering 簡單直覺，zero migration
- 多撈 2x（`limit(pageSize * 2)`）補償過濾掉的 event comments，一般使用者的 event comments 佔比低

**Alternatives considered**:

1. ~~Rename subcollection~~（如 `postComments` vs `eventComments`）: 需 migration，breaking change。
2. ~~Add `parentType` field to all comments~~: 需 migration + 修改現有 `addComment` functions。
3. ~~Server-side filter~~: 打破 client-side pattern。

---

## Research Task 3: Post Title Enrichment for Comments

**Context**: Post comment docs 不含 `postId` 或 parent post title。需要在「我的留言」Tab 顯示所屬文章標題。

**Decision**: Extract postId from document path + batch getDoc + cross-page title cache

**Rationale**:

- `doc.ref.parent.parent.id` 是 Firestore SDK 的標準 API，不需 schema 變更
- 每頁最多 5 筆 comments → 最多 5 次 `getDoc()`（通常更少，因為多筆留言可能在同一篇文章）
- `titleCache: Map<string, string>` 在 hook 層級跨頁共用，避免重複撈取

**Alternatives considered**:

1. ~~Denormalize title into comment doc~~: 需 migration + 文章改標題時要更新所有 comments。
2. ~~Single batch query~~: Firestore 無 `getMultipleDocs()` API，`where('id', 'in', ids)` 在 top-level collection 可用但 comments 是 subcollection。

---

## Research Task 4: Firestore Security Rules for collectionGroup('comments')

**Context**: 現有 rules 沒有 `match /{path=**}/comments/{commentId}`，collectionGroup query 會被拒絕。

**Decision**: 添加 `allow read: if true` 的 wildcard rule

**Rationale**:

- Post comments（line 39）和 event comments（line 139）的 scoped rules 已經 `allow read: if true`
- Wildcard rule 不擴大實質權限，僅啟用 collectionGroup 查詢路徑
- 與現有 `participants` 和 `likes` 的 collectionGroup 規則模式一致

---

## Research Task 5: Tab State Management Pattern

**Context**: 三個 Tab 需要獨立的 state（data, cursor, loading, error），切換時保留已載入資料。

**Decision**: CSS `display: none` toggle + 3 parallel hook instances

**Rationale**:

- 三個 panel 同時 mount，用 CSS 控制可見性，天然保留 DOM state
- `display: none` 的 IntersectionObserver sentinel 不會觸發 intersection（browser spec）
- 比 conditional rendering + manual scroll position 管理更簡單
- 每個 hook 有 `isActive` flag 控制 lazy init 和 observer 連接

**Alternatives considered**:

1. ~~Conditional rendering (`{activeTab === 0 && ...}`)~~: unmount 後 state 消失，需用 useRef 或 context 保存。
2. ~~Single shared hook with tab switch reset~~: 違反 state independence 需求。
3. ~~React Portal per tab~~: 過度設計。
