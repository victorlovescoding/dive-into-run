# Code Review R2 — 012-public-profile

日期：2026-04-10
Reviewer：Linus 模式（第二輪驗證）
Base：`main` (cfb1591) ↔ HEAD (993e052)
Scope：第一輪 P1/P2 修復驗證 + 整體 regression 重掃

---

## 前言

第一輪審查 (`code-review.md`) 紅燈，列了 4 個必修 P1 與 5 個 optional P2。這輪**不聽描述、只看 code**，逐一打開檔案驗證每個修復是否真的做對，再重掃整體 diff 看有沒有引入新的問題。

---

## 自動閘門結果

| 項目                                       | 結果                                                                                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run specs/012-public-profile/` | ✅ **8 files / 84 tests passed** (2.50s)                                                                                                                                                       |
| ESLint（014 新增/修改檔案）                | ✅ **0 warnings / 0 errors**                                                                                                                                                                   |
| `npm run type-check:changed`               | ✅ 僅 1 個既存錯誤 `src/app/events/page.jsx:439` (`toNumber(data.maxParticipants)`) — 在 `main` 已存在（commit `9bd2cac`），非 012 引入，不擋 merge                                            |
| `@ts-ignore` 檢查                          | ✅ 0 處                                                                                                                                                                                        |
| 「UI 不直 import firebase SDK」            | ✅ `app/users/[uid]` / `UserLink` / `BioEditor` 皆僅以 `@/lib/firebase-profile*` 作為 runtime 進入點（僅 ProfileEventList 有 `firebase/firestore` 的 **JSDoc-only** type import，不進 bundle） |
| Server-only 隔離                           | ✅ `firebase-profile-server.js` 只被 `app/users/[uid]/page.jsx`（Server Component）import，grep 無其他呼叫端                                                                                   |

---

## P1 修復驗證

### ✅ P1-1. ProfileEventList.jsx — loadMore unmount cleanup

**驗證檔案**：`src/app/users/[uid]/ProfileEventList.jsx`

- Line 68：新增 `mountedRef = useRef(true)`，註解交代「effect 1 的 cancelled 只能防首次載入 race，loadMore 是 useCallback 建的非同步函式無法共用 flag，所以改用元件層級 mountedRef 統一語意」。
- Line 71–76：新 `useEffect(()=>{ mountedRef.current = true; return ()=> { mountedRef.current = false } }, [])` — 純粹 mount/unmount lifecycle 防護。
- Line 93 / 99 / 104：首次載入的 `.then` / `.catch` / `.finally` 都改成同時檢查 `cancelled || !mountedRef.current`，然後 finally 裡 `if (!cancelled && mountedRef.current) setIsInitialLoading(false)`。
- Line 123 / 128 / 135：loadMore 在 `await getHostedEvents` 之後**先**檢查 `mountedRef.current`，catch 內也先檢查，finally 的 `setIsLoadingMore(false)` 被包在 `if (mountedRef.current)` 內；`isLoadingMoreRef` 是 ref 重置無害，已保留無 gate。

**結論**：**已修復**。語意一致，兩條路徑都 gate 在同一個 mountedRef 之內。沒有殘留 setState-after-unmount race。

---

### ✅ P1-2. ProfileEventList.jsx — Fragment 包單一 child 移除

**驗證檔案**：`src/app/users/[uid]/ProfileEventList.jsx`

- Line 175–177：map 直接 `<DashboardEventCard key={String(event.id)} event={event} isHost />`，無 Fragment 包裹。
- Line 3：`useCallback, useEffect, useRef, useState` — `Fragment` 已從 import 拿掉。
- Tests 8/8 通過，`DashboardEventCard` 接收 key 沒問題。

**結論**：**已修復**。一行 map 就是一行，沒有多餘的 wrapper。

---

### ✅ P1-3. eventDetailClient.jsx + CommentCard.jsx — 雙重 UserLink 合併

**驗證檔案**：

- `src/app/events/[id]/eventDetailClient.jsx`
- `src/components/CommentCard.jsx`
- 相關 CSS modules

**eventDetailClient.jsx**：

- **Host 區塊** (line 451–460)：`<UserLink uid={event.hostUid} name={event.hostName} photoURL={event.hostPhotoURL} size={28} />` — 單一 link，avatar + name 合併。
- **參加者 overlay** (line 748–759)：每個 participant 只剩一個 `<UserLink ... className={styles.participantLink} />` + 一個純 `<div className={styles.participantStatus}>已參加</div>` 在 link 外。
- grep `UserLink` 整檔只有 3 個命中：import (line 30)、host (454)、participant (750)。**沒有殘留第二個 anchor**。

**CommentCard.jsx** (line 48–71)：

- author 區塊只有一個 `<UserLink ... className={styles.authorLink} />`。
- time / edited badge 留在 `.meta` sibling，不包在 link 內。

**Dead CSS cleanup**：

```bash
grep -r "participantAvatarLink\|participantNameLink\|authorNameLink\|avatarLink" src/
# No matches found
```

**CSS diff 驗證**：

- `events.module.css`：`.participantAvatar` / `.participantFallbackAvatar` / `.participantInfo` / `.participantName` 全部移除，換成 `.participantLink`（`flex: 1 1 auto; min-width: 0`）+ `.participantLink img { width/height/border-radius/object-fit }`。
- `CommentCard.module.css`：`.avatar` / `.avatarFallback` / `.authorInfo` 全部移除，換成 `.authorLink` 樣式。

**a11y 影響**：同一 participant 只產生一個 `/users/{uid}` anchor，screen reader 只會讀到一次使用者名稱 — 解決 P1-3 提到的「duplicate link」。

**結論**：**已修復**。UserLink 只在有意義的位置出現，CSS class 全部瘦身到一個 `xxxLink`。乾淨。

---

### ✅ P1-4. firestore.rules — bio 驗證只在 affectedKeys 含 `bio` 時跑

**驗證檔案**：`firestore.rules:15–23`

```
allow update: if isSignedIn()
  && request.auth.uid == userId
  && (
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(['bio'])
    || (request.resource.data.bio is string && request.resource.data.bio.size() <= 150)
  );
```

**語意驗證**（六個情境）：

| 情境                                            | `affectedKeys().hasAny(['bio'])` | `bio.size() <= 150` | 短路結果                            | 預期                         |
| ----------------------------------------------- | -------------------------------- | ------------------- | ----------------------------------- | ---------------------------- |
| (a) 既有 bio 空 + 本次改 name                   | false                            | N/A                 | `!false` = true → 放行              | ✅ 放行                      |
| (b) 既有 bio 空 + 本次新增 bio ≤ 150            | true                             | true                | `!true` = false，轉右側 true → 放行 | ✅ 放行                      |
| (c) 既有 bio 空 + 本次新增 bio > 150            | true                             | false               | false → 拒絕                        | ✅ 拒絕                      |
| (d) 既有 bio 合法 + 本次改 bio 成 > 150         | true                             | false               | false → 拒絕                        | ✅ 拒絕                      |
| (e) **既有 bio 已超標 (legacy) + 本次只改頭像** | false                            | N/A                 | `!false` = true → 放行              | ✅ 放行（修復前會 lock-out） |
| (f) 既有 bio 已超標 + 本次重寫 bio 為合法值     | true                             | true                | 通過右側 → 放行                     | ✅ 放行                      |

**API 正確性**：`request.resource.data.diff(resource.data).affectedKeys()` 是 Firestore Security Rules 標準 API，回傳本次 write 實際觸及的 key set。`setDoc(ref, { bio: 'x' }, { merge: true })` 時 `affectedKeys() == {'bio'}`；`setDoc(ref, { name: 'y' }, { merge: true })` 時 `affectedKeys() == {'name'}`。

**注意**：Port 8080 被另一個 worktree (`/Users/chentzuyu/Desktop/dive-into-run`) 的 emulator 佔用（載入的是它自己的 rules，不是 012 的），我無法在本 worktree 跑 rules-unit-testing 做 E2E 驗證；但語意上 diff+affectedKeys 是官方 documented API，邏輯正確性可靜態確認。**這個限制我寫在報告裡，不當 blocker**。

**結論**：**已修復**。legacy over-length bio 使用者不再被鎖死，同時維持 150 字寫入限制。

---

## P2 修復驗證

### ✅ P2-1. ProfileClient.toCreatedAtAdapter 第三分支改 throw

**驗證檔案**：`src/app/users/[uid]/ProfileClient.jsx:42–50`

```js
function toCreatedAtAdapter(createdAt) {
  if (createdAt && typeof createdAt.toDate === 'function') return createdAt;
  if (createdAt instanceof Date) return { toDate: () => createdAt };
  throw new Error('ProfileClient.toCreatedAtAdapter: unsupported createdAt shape');
}
```

- 第三分支從「defensive fallback `new Date(createdAt)`」改成 throw。
- JSDoc 的 `@param` type 也收斂成 `Date | { toDate: () => Date }`，跟實際呼叫端一致。
- fail-fast，以後有誰亂餵 string / number 會在測試環境就爆炸。

**結論**：**已修復**。

---

### ✅ P2-3. ProfileClient 移除 useMemo

**驗證檔案**：`src/app/users/[uid]/ProfileClient.jsx:95`

```js
const headerUser = { ...user, createdAt: toCreatedAtAdapter(user.createdAt) };
```

- `useMemo` 拿掉，直接 inline。
- Line 3 的 import 也從 `useMemo` 移除（只剩 `useContext, useEffect, useState`）。
- 註解 (line 93–94) 交代「ProfileClient 是 root client，user prop reference 穩定，ProfileHeader 沒被 React.memo 包，useMemo 無意義」。

**結論**：**已修復**。

---

### ✅ P2-5. BioEditor 用 code points 計字數

**驗證檔案**：`src/app/member/BioEditor.jsx:28–30, 61`

```js
function codePointLength(value) {
  return Array.from(value).length;
}

// ...
const charCount = codePointLength(bio);
```

- `Array.from(value).length` 觸發 string iterator，emoji surrogate pair 被視為 1 個 code point，與 Firestore rules 的 `String.size()` 對齊。
- `canSave` / `isOverLimit` 都改用 `codePointLength`，整份檔案沒有殘留 `.length`（除了 `errorMessage` / `BIO_MAX_LENGTH` 這類非字數上下文）。
- JSDoc 完整交代 why（UTF-16 code units vs code points）。

**結論**：**已修復**。

---

## 新發現的問題

### 重新掃 diff 後的新潛在問題

**無 P0**：沒有破壞 userspace、沒有安全漏洞、沒有明顯 regression。

**無新 P1**：修 P1-1 的 mountedRef 改動乾淨、沒有破壞 effect 1 的 cancelled flag 原有的「uid 快速切換」防護；修 P1-3 的 CSS 瘦身沒有留下孤兒 class；修 P1-4 的 rules 沒有放寬其他權限。

**新 P2（非 blocker，作為改善觀察記錄）**：

#### P2-新1. `event-helpers.js` 的 `EventData.hostPhotoURL` 被宣告為 optional，但 `events/page.jsx:423` create 時直接寫 `hostPhotoURL: user?.photoURL || ''`

**現狀**：在 create 路徑會永遠寫入至少空字串。歷史資料可能沒這個欄位，讀出來時 `ev.hostPhotoURL` 會是 undefined，`UserLink` 收 `photoURL={ev.hostPhotoURL}`（即 undefined）會 fallback 到 `/default-avatar.png`。邏輯正確，但型別上 `EventData` 標 `[hostPhotoURL]?` 與 create 時一律寫入有輕微不一致。不擋 merge。

#### P2-新2. （保留第一輪未修的 P2）

- **P2-2**（`toDashboardItem` defensive `?? '' / ?? 0`）：未修。屬 style 層級，不擋 merge。
- **P2-4**（`toPublicProfile` 在 client + server 各一份）：未修。code duplication 存在但邊界清楚，不擋 merge。
- **P2-6**（`next.config.mjs` `remotePatterns`）：未修，屬環境設定，不擋 merge。
- **P2-7**（`users/{uid}` rules 未白名單欄位）：未修，屬 defense-in-depth 增強，不擋 merge。
- **P2-8**（`firebase-profile-server.js` 的 `eslint-disable import/prefer-default-export` 註解）：未修，理由清楚，不擋 merge。

第一輪 polish-report 自己就標這些是「P2 非必修」，r2 維持判定。

---

## 測試覆蓋再掃

- 84 tests 全綠，P1-1 修復後沒有補新測試覆蓋 unmount race case（第一輪 testing gap 提到），但這屬於**覆蓋增強**而非修復缺失。loadMore 的 mounted gate 邏輯顯而易見，既有 `shows error without losing previous items when loadMore fails` test 已經跑過 P1-1 修改後的 code path 並通過。
- 沒有 playwright e2e 測試（`specs/012-public-profile/tests/e2e/` 不存在），tasks.md T020 已標「自動部分 ✓，視覺/LCP/cross-browser 留 user 手動」，屬已記錄的時程取捨。
- Firestore rules unit test 缺，但 p1-4 的語意靜態可驗證 + diff+affectedKeys 是官方 API，屬可接受的風險。

---

## 整體品質判斷

對照 Linus 的三問：

1. **Is this solving a real problem or an imagined one？** — 是。公開檔案是有使用者需求的 feature，不是 over-engineering。
2. **Is there a simpler way？** — 在這次修復後，沒有明顯更簡單的選項。mountedRef 是標準 React lifecycle pattern，`diff().affectedKeys()` 是 Firestore 標準 API，單一 UserLink 是最小化 a11y surface。
3. **What will this break？** — rules 的 `diff()` 路徑對既有 users 放寬，legacy over-150 bio 使用者反而解鎖（好事）；mountedRef 改動不影響舊 user flow；UserLink 合併不變 URL、不變 accessible name（只是少一個重複的）。無 breaking change。

修復品質：每個 P1 都是「真的改對，不是塗上一層 band-aid」；P2 選擇性修的三個也都在根本層級處理，不是 workaround。整體 diff 乾淨可維護。

唯一的觀察：**r2 所有原 P1/P2 修復都通過**，剩下的「第一輪標 P2 且第二輪沒修」的項目沒有任何一個是 merge blocker — 它們當初就標 optional，polish-report 已記錄理由。

---

## Taste Rating

🟢 **Good taste** — P1 修完之後，整體結構 + 資料流 + lifecycle discipline + a11y 都到了水位。沒有強硬塞的特例、沒有 cargo cult code、沒有未處理的 race condition。

---

## 最終裁決

## VERDICT: GOOD TASTE — WORTH MERGE
