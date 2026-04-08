# Code Review — 007-member-dashboard

日期：2026-04-08（Re-review #2）

---

## Taste Rating

🟢 **Good taste** — 前次 review 的所有 Critical 和 Improvement 項目均已修復。Service layer / hook / UI 的分層乾淨，keyboard navigation 補齊，程式碼簡潔無多餘抽象。

---

## Linus's Three Questions

1. **Is this solving a real problem?** — Yes. 會員 dashboard 是明確的使用者需求，三 tab + infinite scroll 是合理的 UI pattern。
2. **Is there a simpler way?** — 以 Firestore 的限制來說，`fetchMyEvents` 的 dual-query + client-sort、`fetchMyComments` 的 collectionGroup + path-based source detection 已經是最簡做法。`useDashboardTab` 作為通用 hook 消除了三個 tab 的重複邏輯。
3. **What will this break?** — 不影響既有功能。唯一的 security surface 變化是 `collectionGroup('comments')` 的 wildcard read rule（見 I1）。

---

## Verification Results

| Check                                            | Result                                               |
| ------------------------------------------------ | ---------------------------------------------------- |
| `npm run lint`                                   | ✅ 0 errors, 0 warnings                              |
| `npm run type-check` (changed files)             | ✅ 僅 TS6053 from other branches（非本 branch 問題） |
| `npx vitest run specs/007-member-dashboard/`     | ✅ 6 files, 77 tests passed, 0 failed                |
| `grep -r "@ts-ignore" src`                       | ✅ 0 matches                                         |
| `grep -r "console.warn" src/app/member/page.jsx` | ✅ 0 matches（前次 S2 已修復）                       |

---

## Previous Review Fix Status

| Issue                                        | Status       | Verification                                                   |
| -------------------------------------------- | ------------ | -------------------------------------------------------------- |
| C1 — EventCard participant count             | ✅ Resolved  | 需求變更，測試已同步 (`3 人已報名`)                            |
| C2 — retry 缺少 `initializedRef = true`      | ✅ Fixed     | `useDashboardTab.js:138` 已加入                                |
| I1 — retry 缺少 cancelled flag               | ✅ Fixed     | 改用 `mountedRef` pattern（line 137, 144, 149）                |
| I2 — fetchEventsWrapper side effect          | ✅ Fixed     | 已移除 wrapper，改由 `prevResult.hostedIds` 直接取用           |
| I3 — hostedIdsRef prop drilling              | ✅ Fixed     | 已移除 ref，改在 `TabPanel` 從 `prevResult` 按需取值           |
| I4/I5 — ItemList 回傳陣列 + @ts-expect-error | ✅ Fixed     | 改用 `<Fragment key={...}>` pattern，消除所有 suppressions     |
| S1 — FetchResult typedef 過於寬鬆            | ⚪ Unchanged | 仍為 `object[]`/`unknown`，功能無影響                          |
| S2 — console.warn 遺留物                     | ✅ Fixed     | 已移除                                                         |
| T2 — Tab 鍵盤導航未測試/未實作               | ✅ Fixed     | `handleTabKeyDown` 實作 ArrowRight/Left/Home/End，7 個測試覆蓋 |

---

## [CRITICAL ISSUES]

無。

---

## [IMPROVEMENT OPPORTUNITIES]

### I1. Firestore rules — comments wildcard 比 likes 寬鬆

**File**: `firestore.rules:32-34`

```
match /{path=**}/comments/{commentId} {
  allow read: if true;    ← 不需登入
}

match /{path=**}/likes/{uid} {
  allow read: if isSignedIn();    ← 需登入
}
```

`comments` 用 `if true`，`likes` 用 `isSignedIn()`。同為 collectionGroup wildcard rule，安全等級不一致。現有的 `posts/{postId}/comments/{commentId}` 規則要求 `isSignedIn()`，但 wildcard rule 是 additive 的——collectionGroup query 走 wildcard path，繞過了原本的認證要求。

對一個公開社群平台來說，留言本身是公開內容，安全風險低。但建議統一改為 `if isSignedIn()` 以保持一致性。

---

### I2. `titleCache` 就地修改 input 參數

**File**: `src/lib/firebase-member.js:214-221`

```js
const titleCache = prevResult?.titleCache ?? new Map();
// ...
parentResults.forEach((parentSnap) => {
  titleCache.set(snapId, ...);  // ← mutates the caller's Map
});
```

`titleCache` 來自 `prevResult`（概念上是 input），但 function 直接 mutate 它。這在 functional programming 的角度是 side effect。因為 Map 是 reference type 所以功能上正確，但如果未來有人 clone `prevResult` 或在 React strict mode 下 double-invoke，可能會出問題。

建議改為 `new Map(prevResult?.titleCache ?? [])` 做 shallow copy，mutation 只發生在 local copy 上。

---

### I3. `tabIndex` prop 名稱與 HTML `tabindex` attribute 重名

**File**: `src/components/DashboardTabs.jsx:167,192-193`

`ItemList` 的 `tabIndex` prop 意思是「第幾個 tab」，但 React 的 built-in `tabIndex` prop 控制 DOM focus order。對內部元件不是問題，但會在 code review 時造成一瞬間的混淆。

改名為 `tabKind` 或 `activeIndex` 可避免歧義。

---

### I4. `maxParticipants` 在 typedef 中定義但未使用

**File**: `src/lib/firebase-member.js:27`

`MyEventItem` typedef 包含 `maxParticipants` 但 `DashboardEventCard` 從未讀取它（需求已改為只顯示 `{participantsCount} 人已報名`）。Unused type field 不影響功能，但會誤導讀者以為應該使用。

若需求確定不再顯示 `maxParticipants`，可從 typedef 和 `data-model.md` 的 `MyEventItem` 中移除。

---

## [STYLE NOTES]

### S1. `FetchResult` typedef 仍為泛用型別

**File**: `src/hooks/useDashboardTab.js:4-8`

```js
/** @typedef {object} FetchResult
 * @property {object[]} items - 回傳的資料項目。
 * @property {number | null} [nextCursor]
 * @property {import('firebase/firestore').QueryDocumentSnapshot | null} [lastDoc]
 */
```

`items` 是 `object[]`，消費者拿到的是 untyped data。JSDoc generics 在 checkJs 下支援有限，但可以考慮用 union：

```js
@property {(import('@/lib/firebase-member').MyEventItem | import('@/lib/firebase-posts').Post | import('@/lib/firebase-member').MyCommentItem)[]} items
```

至少讓讀者知道可能的型別。功能無影響，但降低了 type-check 的防護力。

沿用前次 review 結論：不改也可以，但標註在此。

---

## [TESTING GAPS]

### T1. DashboardTabs 整合測試 mock 了所有 card components

**File**: `specs/.../DashboardTabs.test.jsx:14-27`

三個 Card component 全被 mock 成簡單 `<div>`。Integration test 的價值在於驗證「接線」是否正確，但 mock 恰好把接線的部分切掉了。

建議至少 1-2 個 test case 用真實 card component（不 mock）來驗證 service response → card render 的端對端流程。

---

### T2. 「剛好整除 pageSize」的 edge case 未測試

**File**: `src/hooks/useDashboardTab.js:103`

當總資料數剛好是 `pageSize` 的倍數時（例如 10 events, pageSize 5），第二頁回傳 5 筆 → `setHasMore(true)` → 觸發第三次 fetch → 回傳 0 筆 → `setHasMore(false)`。

功能上正確（多一次空 fetch），但目前沒有測試覆蓋這條 path。建議加一個 test case 確認這個行為不會造成 infinite loop。

---

## [TASK GAPS]

All 10 tasks (T001–T010) 在 diff 中都有對應的實作。77 tests 全部通過。無 scope creep，無遺漏。

---

## VERDICT

✅ **Ready to merge** — 前次 review 的 8/9 項 issues 均已修復（C1, C2, I1-I5, S2, T2），only S1 (FetchResult typedef) unchanged by design。新發現的 I1-I4、S1、T1-T2 都是 improvement 等級，可留到 follow-up。

---

## KEY INSIGHT

The refactoring from the first review demonstrates "good taste" in action: removing `fetchEventsWrapper` in favor of reading `hostedIds` from `prevResult`, eliminating `hostedIdsRef` prop drilling by extracting it at the point of use, and wrapping items in `<Fragment key={...}>` to eliminate all `@ts-expect-error` suppressions. Each fix simplified the code rather than adding complexity. The `useDashboardTab` hook's `prevResult` pass-through pattern is the architectural linchpin — it lets each service function carry its own side-loaded data (hostedIds, titleCache, allEvents) without the hook needing to know about any of it.
