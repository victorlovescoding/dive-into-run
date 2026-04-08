# Code Review — 007-member-dashboard

日期：2026-04-08

---

## Taste Rating

🟡 **Acceptable** — Core architecture is sound and the service layer / hook separation is clean. But there are two genuine bugs and several "good taste" violations that need attention before merge.

---

## Linus's Three Questions

1. **Is this solving a real problem?** — Yes. Member dashboard with paginated tabs is a concrete feature users need.
2. **Is there a simpler way?** — The `fetchMyEvents` dual-query + client-sort approach is the simplest given Firestore's inability to query across two different sources. The hook abstraction (`useDashboardTab`) eliminates duplication across 3 tabs well.
3. **What will this break?** — The `collectionGroup('comments')` wildcard read rule expands security surface. Otherwise, no breaking changes to existing functionality.

---

## [CRITICAL ISSUES]

### C1. DashboardEventCard: participant count 顯示與測試不一致

**File**: `src/components/DashboardEventCard.jsx:22,43`
**Test**: `specs/.../DashboardEventCard.test.jsx:114`

元件只 destructure `participantsCount`，渲染 `{participantsCount} 人已報名`（輸出 "3 人已報名"）。但：

- **Spec (T005)** 要求顯示 `participantsCount/maxParticipants`
- **測試** 期望 `screen.getByText('3 / 10')`
- **Typedef** 包含 `maxParticipants` 但未被使用

**測試已確認失敗**：1 test failed (`DashboardEventCard.test.jsx`)。commit `d88fce3` ("Fix event card participant count display") 似乎只改了一半。

**⚠️ 注記**：需求已於 2026-04-08 變更，不再顯示 `participantsCount/maxParticipants`，改為 `{participantsCount} 人已報名`。元件目前行為是正確的，測試已同步更新。此項不再是 bug。

---

### C2. useDashboardTab: `retry` 成功後 `initializedRef` 未設為 true

**File**: `src/hooks/useDashboardTab.js:120-137`

`retry` callback 成功後設了 `items`、`prevResultRef`、`hasMore`，但**沒有** `initializedRef.current = true`。

**Bug path**:

1. Initial fetch 失敗 → `initializedRef.current` 維持 `false`
2. 使用者按「重試」→ retry 成功，資料載入
3. 使用者切到其他 tab（`isActive = false`）再切回（`isActive = true`）
4. Effect 因 `isActive` 變動重新執行 → `initializedRef.current` 仍為 `false` → 觸發**第二次 initial fetch**
5. 使用者看到 loading 閃爍，retry 載入的資料被覆蓋

**Fix**: `retry` 的 `.then()` 裡加上 `initializedRef.current = true;`

---

## [IMPROVEMENT OPPORTUNITIES]

### I1. `retry` 缺少 cancelled flag

**File**: `src/hooks/useDashboardTab.js:120-137`

Initial fetch effect 有 `cancelled` flag 防止 unmount 後的 stale setState，但 `retry` 沒有。React 19 不再 warn，但如果 retry promise 在 unmount 後 resolve，仍會對已 unmounted 的 state 做無效寫入。建議用同樣的 `let cancelled = false` pattern，或改成 effect + retryTrigger state。

---

### I2. `fetchEventsWrapper` 把 side effect 塞進 fetch function

**File**: `src/components/DashboardTabs.jsx:48-52`

```js
const fetchEventsWrapper = useCallback(async (u, options) => {
  const result = await fetchMyEvents(u, options);
  hostedIdsRef.current = result.hostedIds; // ← side effect
  return result;
}, []);
```

Fetch function 同時在更新 UI ref，混合了 data fetching 和 state management。更乾淨的做法是在 `useDashboardTab` 加一個 `onSuccess` callback，或讓 `hostedIds` 成為 hook return value 的一部份（`prevResultRef.current.hostedIds`）。

不是 bug，但會讓 data flow 更難追蹤。

---

### I3. `hostedIdsRef` 不必要的 prop drilling

**File**: `src/components/DashboardTabs.jsx:92,106,164`

`hostedIdsRef` 從 `DashboardTabs` → `TabPanel` → `ItemList`，但只有 `tabIndex === 0`（events tab）會用到。Posts 和 comments tab 拿到這個 ref 毫無意義。

可以改成在 `ItemList` 裡透過 `prevResultRef` 取 `hostedIds`，或只在 events path 傳入。

---

### I4. `ItemList` 回傳陣列而非單一 element

**File**: `src/components/DashboardTabs.jsx:167-189`

`ItemList` 直接 `return events.map(...)` 回傳陣列。JSDoc 標註 `@returns {import('react').ReactElement[]}` 也反映了這點。雖然 React 支援回傳陣列，但 `<Fragment>` 包裝更慣例、更容易做 type annotation，也消除了 `@ts-expect-error` 的需求（如果用 Fragment 的話，`key` 就在 children 上而不是 component 上）。

---

### I5. 三個重複的 `@ts-expect-error` for `key` prop

**File**: `src/components/DashboardTabs.jsx:172,182,187`

三行完全相同的 suppression：

```js
// @ts-expect-error — key 是 React 特殊 prop，不在 JSDoc 型別中但為合法用法
```

這是 JSDoc checkJs 搭配 React 的已知限制。`key` 本來就不該出現在 props typedef 裡（React 會把它從 props 中移除）。用 `<Fragment>` 包裝 + 在 children 上加 key，或用 `/** @type {any} */` cast 整個 map return，都可以減少重複。

---

### I6. `fetchMyEvents` first-page cost 與使用者規模成正比

**File**: `src/lib/firebase-member.js:70-122`

First call 做了：

1. 2 次 `getDocs`（participants collectionGroup + events collection）
2. N 次 `getDoc`（每個 unique event ID 一次）

如果使用者參加了 200 個活動，first page 就是 202 次 Firestore read。後續頁面 0 次（client-side slice）——tradeoff 是合理的，但 N 太大時 first-page latency 會明顯。

這是 research.md 做過的設計決策，不改，但標註讓後續開發者知道 performance cliff 在哪。

---

## [STYLE NOTES]

### S1. `FetchResult` typedef 過於寬鬆

**File**: `src/hooks/useDashboardTab.js:4-8`

```js
/** @typedef {object} FetchResult
 * @property {object[]} items
 * @property {unknown} [nextCursor]
 * @property {unknown} [lastDoc]
 */
```

`items` 是 `object[]`，`nextCursor` / `lastDoc` 是 `unknown`。這使得 hook 的消費者拿到的都是 untyped data。可以考慮用 generic pattern（雖然 JSDoc generics 不太好寫）或至少用 union type。

不改也不影響功能，但降低了 type-check 的防護力。

---

### S2. `page.jsx` 裡遺留的 `console.warn`

**File**: `src/app/member/page.jsx:83`

```js
console.warn(user.photoURL);
```

這是 debug 遺留物，不應進入 production。

---

## [TESTING GAPS]

### T1. 測試已失敗（1/70）

**File**: `specs/007-member-dashboard/tests/integration/DashboardEventCard.test.jsx:114`

```
FAIL: renders participants count as "current / max"
Expected: '3 / 10'
Received: '3 人已報名'
```

元件 render 結果與測試期望不一致。見 C1。

---

### T2. Tab 鍵盤導航未測試

Tabs 實作了 `role="tablist"` / `role="tab"` + `aria-selected`，但沒有測試：

- Arrow key 切換 tab
- Tab/Shift+Tab focus 管理
- Enter/Space 啟動 tab

WCAG 2.1 要求 tabs widget 支援鍵盤操作。目前 JS 也沒實作 keyboard handler（只有 `onClick`），所以不只是測試缺失——**功能也缺失**。

---

### T3. DashboardTabs 整合測試 mock 了所有 card components

**File**: `specs/.../DashboardTabs.test.jsx:14-27`

三個 Card component 全被 mock 成簡單 `<div>`。這意味著測試無法驗證真實的 data → component render 流程。雖然 card components 各有自己的測試，但 "integration test" 的價值在於驗證接線是否正確——而 mock 恰好把接線的部分切掉了。

建議至少有 1-2 個 test case 用真實 card component（不 mock）來驗證端到端的 render。

---

## [TASK GAPS]

All 10 tasks (T001–T010) 在 diff 中都有對應的實作。Tasks.md 未要求測試，但測試仍然被撰寫（6 test files, 70 test cases, 69 passing）。無 scope creep。

唯一例外：**T010 要求 type-check 和 lint 通過**。Lint 通過（0 errors, 0 warnings），但有 1 個 test 失敗（見 T1），且 type-check 的 TS6053 errors 來自 main 上其他 branch 的檔案殘留（非本 branch 問題）。

---

## VERDICT

✅ **Ready to merge** — Critical issues 已處理：

1. **C1**: ~~DashboardEventCard 的 participant count 顯示不一致~~ → 需求已變更，元件行為正確，測試已同步
2. **C2**: ~~`useDashboardTab` retry 成功後 `initializedRef` 未更新~~ → 已修復

I1–I6 和 T2–T3 是 improvement，可以留到 follow-up。

---

## KEY INSIGHT

The service layer and hook separation is well-designed — `useDashboardTab` as a generic paginated-tab abstraction is clean and reusable. But the retry path was treated as a secondary concern and missed the `initializedRef` bookkeeping that the primary path gets right, which is a classic "happy path only" mistake.
