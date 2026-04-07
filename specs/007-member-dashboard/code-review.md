# Code Review — 007-member-dashboard

日期：2026-04-07

---

## Taste Rating: 🟡 Acceptable — Works but has one critical data flow bug

整體架構乾淨：service layer → generic hook → card components → container。關注點分離得宜，JSDoc 完整，測試覆蓋率好（69 tests, all green）。但有一個會造成無窮迴圈的分頁 bug 必須修。

---

## Linus-Style Analysis

### [CRITICAL ISSUES]

**1. [src/lib/firebase-member.js, Line 76] Data Structure: `fetchMyEvents` 後續分頁 `nextCursor === null` 造成無窮迴圈**

當活動總數恰好是 `pageSize` 的整數倍時（例如 10 筆, pageSize 5），會觸發無窮迴圈：

```
Call 1 (initial): allEvents=[10], items=[0..4], nextCursor=5
Call 2 (loadMore): start=5, items=[5..9], nextEnd=10, 10 < 10 → false → nextCursor=null
  → Hook: items.length=5 >= 5 → hasMore=true ← 問題在這
Call 3 (loadMore): prevResult.nextCursor=null, start = null ?? 0 = 0
  → items = allEvents.slice(0, 5) → 重複回傳第一頁！→ 無窮迴圈
```

`line 76: const start = prevResult.nextCursor ?? 0;` — 當 `nextCursor` 是 `null` 時，`??` 把 start 重設為 0，re-slice 整個陣列。Hook 的 `hasMore` 靠 `items.length >= pageSize` 判斷，所以永遠不會停。

**修法**（二選一）：

```js
// Option A: 在 subsequent-call branch 開頭加 guard
if (prevResult?.allEvents) {
  if (prevResult.nextCursor === null) {
    return {
      items: [],
      nextCursor: null,
      hostedIds: prevResult.hostedIds ?? new Set(),
      allEvents: prevResult.allEvents,
    };
  }
  // ...rest
}

// Option B: 讓 hook 同時檢查 cursor
setHasMore(result.items.length >= pageSize && result.nextCursor !== null);
// 但這對 posts/comments (用 lastDoc) 也得適用，較侵入
```

Option A 比較乾淨，改動最小。

---

**2. [src/hooks/useDashboardTab.js, Lines 45-71] Missing `cancelled` flag — 規格要求但未實作**

T004 spec 明確要求：

> `cancelled` flag pattern to prevent stale updates (reference `src/hooks/useComments.js`)

但 initial fetch effect 的 cleanup 只有 `return undefined;`（line 70）。React 19 不會因 unmounted setState 報錯，所以測試會通過，但：

- 如果 `uid` 或 `fetchFn` 在 fetch in-flight 時變了，useEffect 重跑（因為 deps 變了），但 `initializedRef.current` 已是 `true`，所以新的 effect 直接 return。舊的 promise resolve 後仍然寫入 state → **stale data**。
- useDashboardTab.test.jsx #11 註解說 "cancelled flag worked" 但實際上是 React 19 靜默丟棄 setState。

**修法**：

```js
useEffect(() => {
  if (!uid || !isActive || initializedRef.current) return undefined;
  initializedRef.current = true;
  let cancelled = false;

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFn(uid, { prevResult: null, pageSize });
      if (cancelled) return;
      setItems(result.items);
      prevResultRef.current = result;
      setHasMore(result.items.length >= pageSize);
    } catch (err) {
      if (cancelled) return;
      console.error('[DashboardTab] initial load failed:', err);
      setError('載入失敗');
    } finally {
      if (!cancelled) setIsLoading(false);
    }
  }

  load();
  return () => {
    cancelled = true;
  };
}, [uid, isActive, fetchFn, pageSize]);
```

---

### [IMPROVEMENT OPPORTUNITIES]

**3. [src/lib/firebase-member.js, Line 80] Simplification: `hostedIds` 每次後續呼叫都重算**

Subsequent-call branch 每次都 `new Set(cachedEvents.filter(...).map(...))` 重建 hostedIds。明明第一次呼叫時已經算好了。應該把 hostedIds 也存在回傳結果裡讓後續呼叫直接傳遞：

```js
// 第一次呼叫時
const hostedIds = new Set(hostedIdsList);
return { items, nextCursor, hostedIds, allEvents };

// 後續呼叫時直接重用
if (prevResult?.allEvents) {
  // ...
  return { items, nextCursor, hostedIds: prevResult.hostedIds, allEvents: cachedEvents };
}
```

---

**4. [src/components/DashboardTabs.jsx, Lines 167-191] Good Taste: `Fragment` wrapping 多餘**

```jsx
return events.map((event) => (
  <Fragment key={event.id}>
    <DashboardEventCard event={event} isHost={...} />
  </Fragment>
));
```

`Fragment` 在這裡沒有任何作用，key 可以直接放在 component 上：

```jsx
return events.map((event) => (
  <DashboardEventCard key={event.id} event={event} isHost={...} />
));
```

三個 tab 的 mapping 都有這個問題。

---

**5. [src/components/DashboardTabs.jsx, Line 142] UI: 卡片之間沒有間距**

TabPanel 的 list wrapper 是一個裸的 `<div>`，卡片之間沒有 gap 或 margin。卡片會緊貼在一起。

```css
/* DashboardTabs.module.css — 加一個 class */
.cardList {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

---

**6. [src/hooks/useDashboardTab.js, Lines 4-6] Type Safety: `FetchResult` typedef 過於寬鬆**

```js
/** @typedef {object} FetchResult
 * @property {object[]} items - 回傳的資料項目。
 */
```

`items: object[]` 丟失了所有具體型別資訊。`prevResultRef` 被型別化為 `FetchResult | null`，意味著 `nextCursor`、`hostedIds`、`lastDoc`、`titleCache` 等欄位全部是 implicit any。既然 hook 是 generic 的不綁定具體型別，至少用一個 generic-like pattern：

```js
/**
 * @typedef {object} FetchResult
 * @property {object[]} items - 回傳的資料項目。
 * @property {unknown} [nextCursor] - 下一頁 cursor（由 service layer 決定型別）。
 * @property {unknown} [lastDoc] - Firestore cursor document。
 */
```

---

**7. [src/hooks/useDashboardTab.js, Lines 113-130] Pragmatism: `retry` 和 initial fetch 邏輯重複**

`retry` callback 複製了 `load()` 的完整 fetch → setState 流程。如果有人改了 initial fetch 的邏輯忘了改 retry，兩邊就會 diverge。

可以考慮重置 `initializedRef.current = false` 然後觸發 re-render（例如 increment 一個 counter state），讓 effect 自然重跑。但這需要小心避免 double-fetch。當前做法可以接受，只是維護成本較高。

---

### [STYLE NOTES]

**8. [src/lib/firebase-member.js, Line 108] Dead code: `const start = 0;`**

```js
const start = 0;
const items = allEvents.slice(start, start + pageSize);
```

`start` 永遠是 0，直接 `allEvents.slice(0, pageSize)` 即可。

---

**9. [src/components/DashboardEventCard.module.css, Line 61] Unused CSS class `.metaRow`**

定義了 `.metaRow` 但 `DashboardEventCard.jsx` 沒有使用。

---

### [TESTING GAPS]

**10. [specs/007-member-dashboard/tests/unit/firebase-member.test.js] Missing: 無窮迴圈 scenario 未測**

沒有測試 `total events = n * pageSize` 的場景（Critical Issue #1 的 trigger condition）。補一個 test case：

```js
it('should return empty items when nextCursor is null on subsequent call', async () => {
  // Arrange — prevResult with nextCursor: null (all data consumed)
  const allEvents = Array.from({ length: 10 }, (_, i) => ({
    id: `e${i}`,
    title: `E${i}`,
    time: { seconds: (10 - i) * 100, toMillis: () => (10 - i) * 100000 },
    location: 'L',
    city: 'C',
    participantsCount: 1,
    maxParticipants: 10,
    hostUid: 'h',
  }));
  const { fetchMyEvents } = await import('@/lib/firebase-member');
  const result = await fetchMyEvents('u1', {
    prevResult: { nextCursor: null, allEvents, hostedIds: new Set() },
    pageSize: 5,
  });
  expect(result.items).toEqual([]); // ← 目前會 FAIL，回傳第一頁
  expect(result.nextCursor).toBeNull();
});
```

---

**11. [specs/007-member-dashboard/tests/integration/useDashboardTab.test.jsx, Line 368] Misleading: 測試註解聲稱 cancelled flag 但實際上沒有**

```js
// If we get here without error, cancelled flag worked
expect(result.current.items).toEqual([]);
```

這個 assertion 能通過是因為 React 19 靜默丟棄 unmounted setState，不是因為 cancelled flag（因為根本沒實作）。註解應修正或刪除。

---

### [TASK GAPS]

**12. [T004] Incomplete: `cancelled` flag pattern 未實作**

Task spec 明確要求 `cancelled flag pattern to prevent stale updates (reference src/hooks/useComments.js)`。`useDashboardTab.js` 沒有實作此 pattern。測試 #11 表面通過但測的不是 cancelled flag。

---

## VERDICT

❌ **Needs rework** — Critical Issue #1（無窮迴圈）必須在 merge 前修復。

修完 #1 + #2 後，其他 improvement opportunities 可以視情況處理。整體架構設計合理，改動量不大就能修好。

## KEY INSIGHT

分頁策略在 events tab 用了「全量 fetch + client-side slice」的 pattern（不同於 posts/comments 的 Firestore cursor），但 `nextCursor === null` 的終止條件沒有正確處理，導致恰好整除 pageSize 時無窮迴圈。兩種分頁策略混用時，hook 的 `hasMore` 判斷邏輯無法同時正確覆蓋兩種 cursor 語意（number cursor vs DocumentSnapshot cursor），需要在 service layer 就統一「沒有更多 → items 為空」的語意。
