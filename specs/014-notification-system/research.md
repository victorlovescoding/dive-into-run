# Research: 通知系統 (Notification System)

**Branch**: `014-notification-system` | **Date**: 2026-04-13

---

## R1: Notification Collection 設計 — 頂層 vs 子集合

### Decision: 頂層 `notifications` collection

### Rationale

| 面向                  | 頂層 `notifications`                                                                   | 子集合 `users/{uid}/notifications`                                 |
| --------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 寫入                  | `addDoc(collection(db, 'notifications'), {...})` — 所有通知同一 collection，batch 簡單 | 每個收件者不同路徑 `collection(db, 'users', uid, 'notifications')` |
| 讀取                  | 需要 `where('recipientUid', '==', uid)` + composite index                              | 不需 where clause，天然隔離                                        |
| Security Rules        | `recipientUid == request.auth.uid` 驗證                                                | `uid == request.auth.uid` 路徑驗證                                 |
| 與現有 pattern 一致性 | ✅ 現有 events、posts、users 皆為頂層                                                  | 現有子集合用於 participants、comments — 隸屬實體                   |
| Batch 建立            | 所有 `addDoc` 指向同一 collection — writeBatch 簡潔                                    | 每個收件者不同 subcollection path，略繁瑣但可行                    |

**選擇頂層的關鍵理由**：

1. **一致性**：專案所有主要 entity（events, posts, users）均為頂層 collection
2. **Batch 寫入簡潔**：一次活動編輯可能需通知數十位參加者，頂層 collection 的 batch 最直覺
3. **未來擴展**：頂層 collection 允許跨使用者查詢（admin、analytics），子集合不行
4. **Composite index 成本低**：Firestore 自動管理，`recipientUid + createdAt` 是標準 pattern

### Alternatives Considered

- **子集合 `users/{uid}/notifications`**：天然隔離、不需 composite index，但 batch 寫入多路徑略繁瑣，且與主要 entity 用頂層 collection 的慣例不一致。適合大規模系統，MVP 不需要。

---

## R2: 即時未讀計數策略

### Decision: 專用 `onSnapshot` 監聽未讀通知（limit 100）

### Rationale

| 方案                                             | 優點                                      | 缺點                                                                      |
| ------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------- |
| A. `onSnapshot` 監聽 `read == false, limit(100)` | 即時、準確、簡單                          | 下載最多 100 份文件（~50KB）                                              |
| B. User doc 上反正規化 `unreadNotificationCount` | 零額外監聽（AuthContext 已監聽 user doc） | 需修改 user doc security rules 允許他人更新計數，增加 race condition 風險 |
| C. `getCountFromServer()` 定期輪詢               | 不下載文件內容                            | 非即時，不符 FR-021                                                       |

**選擇方案 A 的關鍵理由**：

1. **即時性**：FR-021 要求「未讀數量即時更新，使用者無需重新載入頁面」
2. **無需修改現有 security rules**：user doc rules 保持不變，不用開放 `unreadNotificationCount` 給其他使用者更新
3. **複用性**：此監聽器的資料可同時供「未讀」分頁顯示，一石二鳥
4. **規模適中**：社群跑步 app，多數使用者未讀通知 < 20 則；limit 100 已覆蓋「99+」顯示需求（FR-006）
5. **差量傳輸**：首次載入後，onSnapshot 僅傳輸變更文件，後續成本極低

---

## R3: 監聽器架構（Listener Architecture）

### Decision: 雙監聽器 + 按需分頁

**Listener 1 — 未讀監聽器**（使用者登入後始終啟動）：

```
onSnapshot(
  query(notifications,
    where('recipientUid', '==', uid),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(100)
  ),
  callback
)
```

- 提供：未讀計數（badge）、「未讀」分頁資料
- 即時更新：新通知到達時自動加入、標記已讀後自動移除

**Listener 2 — 最新通知監聽器**（使用者登入後始終啟動）：

```
onSnapshot(
  query(notifications,
    where('recipientUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE)     // PAGE_SIZE = 5
  ),
  callback
)
```

- 提供：「全部」分頁資料（最新 5 則）、新通知偵測（toast 觸發源）
- 即時更新：新通知到達時推入頂端、面板開啟時內容即時刷新

**按需分頁**（`getDocs`）：

- 「全部」載入更多：`startAfter(lastDoc)` 接續 Listener 2 的尾端
- 「未讀」載入更多：`startAfter(lastDoc)` 接續 Listener 1 的尾端（僅當 unread > 100 時才需要）

### Rationale

- 兩個監聽器各司其職，邏輯清晰
- 總初始載入：最多 105 份文件（100 + 5），後續僅差量
- 避免單一巨大監聽器的複雜性
- 分頁用 `getDocs`（靜態），避免為舊通知開啟額外即時監聽

---

## R4: Toast 偵測 — 區分新通知 vs 既存通知

### Decision: `onSnapshot` docChanges + `isInitialLoad` 旗標

### Approach

```js
let isInitialLoad = true;

onSnapshot(query, (snapshot) => {
  if (isInitialLoad) {
    isInitialLoad = false;
    return; // 忽略首次載入的既存通知
  }

  const newNotifications = snapshot.docChanges().filter((change) => change.type === 'added');

  // 若面板關閉，逐則 enqueue toast
  newNotifications.forEach((change) => {
    enqueueToast(change.doc.data().message);
  });
});
```

### Toast 佇列行為（spec edge case）

- 同一時間只顯示一則 toast（不堆疊）
- 後一則等前一則消失（~5 秒）後再顯示
- 面板已開啟時不顯示 toast（FR-030）
- 頁面載入的既存未讀不觸發 toast（FR-031）

### Implementation

- 使用獨立的 notification toast 機制（不復用現有 ToastContext）
- 原因：現有 ToastContext 允許同時顯示 5 則、route change 清除全部；通知 toast 要求排隊顯示、不可點擊
- NotificationContext 內部管理 toast 佇列 + 計時器

---

## R5: 分頁模式 — 首次按鈕 + 後續無限滾動

### Decision: 「查看先前通知」按鈕 → IntersectionObserver 無限滾動

### Approach

1. **初始載入**：Listener 2 提供最新 5 則通知
2. **首次擴展**：底部「查看先前通知」按鈕，點擊後 `getDocs` 載入第 6-10 則
3. **後續滾動**：按鈕消失，改用 IntersectionObserver 偵測滾動接近底部，自動載入下一批 5 則
4. **終止條件**：回傳文件數 < PAGE_SIZE 時，設 `hasMore = false`，不再觸發載入

### 與 Constitution 一致

- Principle III：「無限捲動必須使用 IntersectionObserver 搭配 Firestore 游標」
- 使用 `startAfter(lastDoc)` 作為 Firestore cursor

### 「未讀」分頁的特殊處理

- Listener 1 已有最多 100 則未讀通知
- 「未讀」分頁初始顯示前 5 則（從 Listener 1 資料切片）
- 載入更多：從 Listener 1 資料繼續取（client-side slice），超過 100 則時才需 getDocs
- 標記已讀後，該通知從「未讀」分頁即時消失（Listener 1 自動更新）

---

## R6: 通知建立觸發點與模式

### Decision: Service layer 函式 + UI 層編排

### 觸發點分析

| 事件       | 現有函式               | 通知建立時機         | 收件者                     |
| ---------- | ---------------------- | -------------------- | -------------------------- |
| 活動被修改 | `updateEvent()`        | 成功後               | 所有參加者（排除修改者）   |
| 活動被取消 | `deleteEvent()`        | 刪除前（先擷取資料） | 所有參加者（排除刪除者）   |
| 文章新留言 | `addComment()` (posts) | 成功後               | 文章作者（排除留言者自己） |

### 設計原則

**不修改現有 service layer 函式**。新增 `firebase-notifications.js` 提供獨立的通知建立函式，由 UI 層編排呼叫順序：

```js
// 活動修改（UI 層）
await updateEvent(eventId, fields);
await notifyEventModified(eventId, eventTitle, actor);

// 活動取消（UI 層）— 注意順序：擷取 → 通知 → 刪除
const participants = await fetchParticipants(eventId);
await notifyEventCancelled(eventId, eventTitle, participants, actor);
await deleteEvent(eventId);

// 文章留言（UI 層）
const { id: commentId } = await addComment(postId, { user, comment });
await notifyPostNewComment(postId, postTitle, postAuthorUid, commentId, actor);
```

### 活動取消的順序考量

Spec 明確指出：「通知必須在刪除前建立，擷取活動標題與參加者名單後再執行刪除」

順序：擷取資料 → 建立通知 → 刪除活動

- 若刪除失敗：通知已建立但活動仍存在 — 可接受（使用者重試刪除即可，通知內容仍正確）
- 若通知建立失敗：活動未被刪除 — 安全（使用者重試整個流程）

### Batch 寫入

- 活動通知：一次 `writeBatch` 建立所有參加者的通知（Firestore batch 上限 500，足夠）
- 文章留言通知：單一 `addDoc`（只通知作者一人）

---

## R7: Scroll-to-Comment（留言定位與高亮）

### Decision: URL query param `?commentId=xxx` + scrollIntoView + CSS animation

### Approach

1. **通知點擊**：導航至 `/posts/[id]?commentId=xxx`
2. **文章詳文頁偵測**：`useSearchParams()` 取得 `commentId`
3. **留言載入後**：以 `document.getElementById(commentId)` 定位元素，呼叫 `scrollIntoView({ behavior: 'smooth', block: 'center' })`
4. **高亮效果**：加入 CSS class 觸發背景色漸變動畫（2-3 秒後淡出）

### CSS Animation

```css
.commentHighlight {
  animation: highlightFade 3s ease-out;
}

@keyframes highlightFade {
  0% {
    background-color: var(--highlight-color);
  }
  100% {
    background-color: transparent;
  }
}
```

### Edge Cases

- 留言尚未載入（在後續分頁中）：需先載入足夠留言直到目標出現，或使用 `getCommentById` 確認存在後捲動
- 留言已刪除：`getElementById` 回傳 null，不捲動、不高亮（靜默處理）

---

## R8: Bell Icon 在 Navbar 的位置

### Decision: Desktop — desktopLinks 與 UserMenu 之間；Mobile — hamburger 旁邊（header 固定可見）

### 分析

Spec：「鈴鐺固定在 header（hamburger 按鈕旁邊，隨時可見）」

現有 Navbar 結構：

```
<nav>
  <Link>Brand</Link>
  <button>Hamburger (mobile)</button>
  <ul>DesktopLinks (desktop)</ul>
  <UserMenu />
</nav>
```

### 配置

```
Desktop: [Brand] [Links...] [Bell] [UserMenu]
Mobile:  [Brand] [Hamburger] [Bell] [UserMenu]
```

- Bell 始終在 nav bar 內，不進入 MobileDrawer
- 通知面板以 dropdown 方式從 Bell 下方展開
- 手機版面板寬度接近全螢幕（FR-024）

---

## R9: 相對時間格式化

### Decision: 純函式 `formatRelativeTime(timestamp)` 放在 `notification-helpers.js`

### Spec 規則

| 條件     | 顯示          |
| -------- | ------------- |
| ≤ 1 分鐘 | 「剛剛」      |
| ≤ 1 小時 | 「xx 分鐘前」 |
| ≤ 1 天   | 「x 小時前」  |
| ≤ 1 週   | 「x 天前」    |
| > 1 週   | 日期如「4/6」 |

### Implementation

純函式，接收 Firestore Timestamp 或 Date，回傳中文字串。不依賴任何外部 i18n 庫。

---

## R10: Firestore Security Rules 變更

### Decision: 新增 `notifications` collection rules，不修改 `users` collection rules

### 規則設計

```
match /notifications/{notificationId} {
  // 任何登入者可建立通知（但 recipientUid 不能是自己）
  allow create: if isSignedIn()
    && request.resource.data.recipientUid is string
    && request.resource.data.recipientUid != request.auth.uid
    && request.resource.data.type in ['event_modified', 'event_cancelled', 'post_new_comment']
    && request.resource.data.read == false;

  // 只有接收者可讀取
  allow read: if isSignedIn()
    && resource.data.recipientUid == request.auth.uid;

  // 只有接收者可更新 read 欄位
  allow update: if isSignedIn()
    && resource.data.recipientUid == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);

  allow delete: if false;
}
```

### 關鍵設計

- `recipientUid != request.auth.uid`：防止自己給自己建通知
- `read == false` on create：新通知必須是未讀狀態
- `affectedKeys().hasOnly(['read'])`：只允許更新 read 欄位，防止竄改通知內容
- 不允許刪除：通知為永久記錄（90 天後可由背景任務清理）

### Composite Indexes 需求

1. `recipientUid ASC` + `createdAt DESC` — 「全部」分頁查詢
2. `recipientUid ASC` + `read ASC` + `createdAt DESC` — 「未讀」分頁 / 未讀計數查詢
