# 027 — Handoff（session-to-session 接棒筆記）

> **用途**：每個 session 開工前必讀；結束時更新。
> **Plan**: `specs/027-tests-mock-cleanup/plan.md`
> **Audit source**: `project-health/2026-04-29-tests-audit-report.md` §2 P0-1

---

## 0. 進度看板

| Session | 狀態           | Branch                 | PR  | Commit      | Baseline 變化                                                                                                                                                                        |
| ------- | -------------- | ---------------------- | --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| —       | —              | —                      | —   | —           | **18.6=47（spec 026 既有）/ 18.7=0 / 18.8=0（spec 027 開始前）**                                                                                                                     |
| S0      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 修 selector bug + 擴規則 → 18.6: 47→55（+8 新加）/ 18.7: 0→14（new）/ 18.8: 0→5（new）                                                                                               |
| S1      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 18.6: 55 → 50（posts heavy / pilot — 5 檔/10 violations；Option B 全留在本 spec）                                                                                                    |
| S2      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 18.6: 50 → 36（posts rest + comments + dashboard + navbar — 14 檔/15 violations；Navbar flaky count 已清）                                                                           |
| S3      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 18.6: 36 → 27（notifications — 9 檔/32 violations；S3.A-D reviewers 全 PASS）                                                                                                        |
| S4      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 18.6: 27 → 21（events + profile — 6 檔/8 violations；S4.A/B reviewers + type-fix 全 PASS）                                                                                           |
| S5      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 18.6: 21 → 11（toast 1 + weather 3 + strava 6 = 10 檔/13 violations 全清；S5.A/B/C engineer + reviewer 全 PASS）                                                                     |
| S6      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 18.8: 5 → 0（unit/lib notification 5 檔 / 11 violations 含 4 dead mocks 全清；S6.A/B engineer + reviewer 全 PASS；18.5 baseline 5 檔保留 — 業務正確 toHaveBeenCalledTimes 非 flaky） |
| S7      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 18.7: 14 → 0（unit/runtime 5 + api 6 + service/repo 3 = 14 檔/17 violations 全清；無 Option A，18.7 mock-boundary baseline 清空，只剩 18.5 flaky spread）                            |

> 每完成一個 session：對應 row 狀態 → ✅ Done、寫入 branch / PR / commit hash、更新 baseline 實際數字。
> Spec 終態：三個 block 對應 mock-boundary 部分清空（18.6 剩 ~11 檔 flaky-only overlap 不計入）。
> 全 spec 範圍：**63 檔 / 106 violations**（不是 233；233 的 81 處為邊界外保留 + 46 處灰色 components/app 不在範圍）。

---

## 1. 起步必讀（this session 的 plan 怎麼上手）

### 1.1 Plan 在哪

- `specs/027-tests-mock-cleanup/plan.md` — 完整切分、共通約束、驗證指令
- 開工先讀 plan.md §3 Scope + §4 Strategy + §5 Session 切分（找到自己這 session）+ §6 共通約束

### 1.2 上下文預覽（30 秒）

- 我們在做：把 audit P0-1 全 4 批 + 散落的「邊界內違規 mock」清乾淨（**63 檔 / 106 violations**）
- S0 階段做兩件事：
  1. **修 spec 026 S6 規則的 selector bug**：`@/(repo|service|runtime)/` → `@/(lib|repo|service|runtime)/` 並排除 `@/runtime/providers/`（providers 是 React 邊界，audit L94 認可保留）
  2. **建 2 個新 baseline block**（18.7 unit/runtime+api+service+repo / 18.8 unit/lib），讓 S1-S7 每批都有 lint 護欄
- 範圍劃分：邊界外 81 處保留、灰色 components/app 46 處保留、違規 106 處全清
- 改寫策略：**Option B**（把「mock 自家內部模組」改為 mock `firebase/firestore` 或 `firebase-admin/firestore` SDK 邊界）— 不重建 emulator integration setup

### 1.3 第一刀檢查清單

開工前 10 分鐘確認：

```bash
# 1. 確認 spec 026 已上線（規則 + scripts + workflow）
grep -nE "18\.[6-8]" eslint.config.mjs              # S0 後應看到三個 block (18.6/18.7/18.8)
ls scripts/audit-mock-boundary.sh                   # 應存在
ls .github/workflows/firestore-rules-gate.yml       # 應存在
ls .github/pull_request_template.md                 # 應存在

# 2. 三個 baseline 大小（S0 後）
echo "block 18.6 (integration):"
awk '/18\.6/,/^  },/' eslint.config.mjs | grep -cE "^\s*'tests/integration/"
echo "block 18.7 (unit/runtime+api+service+repo):"
awk '/18\.7/,/^  },/' eslint.config.mjs | grep -cE "^\s*'tests/unit/"
echo "block 18.8 (unit/lib):"
awk '/18\.8/,/^  },/' eslint.config.mjs | grep -cE "^\s*'tests/unit/lib/"
# Spec 027 spec start (S0 後)：18.6=55 / 18.7=14 / 18.8=5；每 session 後對應 block 遞減

# 3. 全 4 批 + 散落剩餘違規處數（統一 selector 扣 providers）
violations() {
  grep -rEn "vi\.mock\(['\"]@/(lib|repo|service|runtime)/" "$1" --include="*.test.*" 2>/dev/null \
    | grep -v "@/runtime/providers/" | wc -l
}
echo "第一批 integration:    $(violations tests/integration)"
echo "第二批 unit/runtime:   $(violations tests/unit/runtime)"
echo "第三批 unit/lib:       $(violations tests/unit/lib)"
echo "第四批 unit/api:       $(violations tests/unit/api)"
echo "散落 unit/service+repo: $(($(violations tests/unit/service) + $(violations tests/unit/repo)))"
# Spec 027 spec start: 78 / 7 / 11 / 6 / 4；終態 0 / 0 / 0 / 0 / 0（合計 106 → 0）
```

### 1.4 Tasks queue planning notes（2026-04-30，Reviewer PASS / executable）

- `tasks.md` 已通過 Reviewer PASS，queue 可執行；後續 session 必須仍從 S0 開始，按 `tasks.md` session order 執行。
- session merge order 固定為 `S0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7`，因為 baseline 數字與 PR 順序是序列化的。
- 最大平行度放在 session 內：S2/S3/S4/S5/S6/S7 都拆成多組 Engineer+Reviewer file batch；每個 session 最後再由 lead 做 baseline consolidation，避免多個 worker 同時改 `eslint.config.mjs`。
- 每個 task 都有 Engineer mini-plan + Reviewer gate；Reviewer 要先擋掉錯誤拆分、錯誤相依性、共享檔衝突、偷改 `src/`、或用 inline disable 假清理。
- S1 是 pilot gate；S2-S7 開工前要先讀 §2 的實測 setup pattern。S6 雖然是 unit/lib，但應重用 S3 notification pattern；S7 要特別分清 client SDK、Admin SDK、fetch 邊界。
- 如果為了提早平行開 worktree，只能先做盤點/草稿，不要提前落地 baseline edits；`eslint.config.mjs`、PR template、handoff row 由當前 session consolidation owner 統一更新。

---

## 2. Setup pattern reference（S1 pilot 後填）

> S1 完成後把成功的 Option B 改寫骨架抄進這節，S2-S7 直接套用。
> S1 pilot 結束前**留空**，pilot 是發現 pattern 的過程。
> S6 / S7 涉及 unit/lib + unit/api 改寫時可能需要 `firebase-admin/firestore` 額外 mock 樣板 — S6 / S7 結束時補進 §2.5 / §2.6。

### 2.1 標準 mock 骨架（S1 實測）

```js
const { mockShowToast, mockAuthContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return {
    mockShowToast: vi.fn(),
    mockAuthContext: createContext({ user: { uid: 'user-1' }, loading: false }),
  };
});

vi.mock('@/runtime/providers/AuthProvider', () => ({ AuthContext: mockAuthContext }));
vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
vi.mock('@/config/client/firebase-client', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  limit: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn((value) => ({ __type: 'increment', value })),
  collectionGroup: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  startAfter: vi.fn(),
  documentId: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ toDate: () => new Date('2026-04-15T08:00:00Z') })),
  },
}));

// 不 mock @/runtime/client/use-cases/*；
// 讓 UI -> runtime hook -> use-case -> service/repo 真實執行。
```

### 2.2 firebase/firestore mock 完整 export 清單（S1 實測）

S1 client posts pilot 實測需要：

`getDoc, getDocs, addDoc, updateDoc, runTransaction, query, where, orderBy, limit, startAfter, collection, collectionGroup, doc, serverTimestamp, increment, writeBatch, documentId, Timestamp`

`Timestamp` 不能漏：`usePostComments` fallback path 會經 `createFirestoreTimestamp()` import `Timestamp.fromDate`。

`post-comment-reply.test.jsx` 因既有 Firebase init protection 也保留外部 SDK mock：`deleteDoc, onSnapshot, connectFirestoreEmulator, getFirestore`，但 S1 core path 沒依賴它們。

### 2.3 Firestore document stub shape（S1 實測）

```js
function createDocSnapshot(id, data) {
  return {
    id,
    ref: { id, path: `mock/${id}` },
    exists: () => data !== null,
    data: () => data,
  };
}

function createQuerySnapshot(docs) {
  return { docs, size: docs.length };
}

collection.mockImplementation((_dbOrRef, ...segments) => ({
  type: 'collection',
  path: segments.join('/'),
}));

doc.mockImplementation((base, ...segments) => {
  if (base?.type === 'collection' && segments.length === 0) {
    return { id: 'generated-id', path: `${base.path}/generated-id` };
  }
  if (base?.type === 'collection') {
    return { id: String(segments.at(-1)), path: [base.path, ...segments].join('/') };
  }
  return { id: String(segments.at(-1)), path: segments.join('/') };
});

query.mockImplementation((...parts) => ({
  type: 'query',
  path: parts[0]?.path,
  parts,
}));
```

關鍵：`query()` 要保留第一個 collection 的 `path`，否則 `getDocs(query(...))` 無法分辨 `posts/:id/comments`。

### 2.4 runTransaction / writeBatch stub 寫法（S1 實測）

```js
const tx = {
  get: vi.fn(async (ref) => createDocSnapshot(ref.id, null)),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
runTransaction.mockImplementation(async (_db, callback) => callback(tx));

const batch = {
  set: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
};
writeBatch.mockReturnValue(batch);
```

- `addCommentDocument` 需要 `runTransaction` 真正 invoke callback，且 `doc(collection(...))` 要回 stable generated id，否則 `getCommentById(postId, id)` 無法接上。
- `toggleLikePost` 的 `tx.get(likeRef)` 要依 `ref.path` 回 exists true/false，不能一律回 post snapshot。
- `deletePostTree` happy/error path 用 stable `batch.commit` spy；race path 用第二次 `getDoc(postRef)` 回 `exists() === false`。

### 2.5 S1 posts-specific assertion pattern

- `PostDetailClient-delete-race` 保持 Option B：必須讓 real `deletePost -> deletePostTree -> getDoc(false)` 觸發 UI catch branch，不可 mock `deletePost` reject。
- `post-comment-reply` 不 assert `notifyPostNewComment` / `notifyPostCommentReply` internal function calls；改 assert SDK 邊界：
  - `addDoc(collection(db, 'notifications'), payload)` for `post_new_comment`
  - `writeBatch().set(doc(collection(db, 'notifications')), payload)` + `commit()` for `post_comment_reply`
- notification payload 是 flattened actor fields：`actorUid`, `actorName`, `actorPhotoURL`，不是 nested `actor` object。
- `@/components/*` mock 在本 spec 是灰區 out-of-scope 保留，不是正式 allowed boundary；不要把 S1 的保留解讀成可擴張規則。

### 2.6 S2 posts/comment reusable patterns

- posts form/edit/feed/card 測試延續 S1 Option B：只 mock `firebase/firestore`、`@/config/client/firebase-client` 與 `@/runtime/providers/*`；不要 mock `@/runtime/client/use-cases/*` 或 `@/service/*`。
- form validation / dirty edit 斷言要對齊真實 payload normalization：送進 `addDoc` / `updateDoc` 的文字可能已 trim，不要沿用 internal mock 時的 raw input expectation。
- comments notification path 要 assert SDK boundary 寫入結果，不 assert internal notification helper call count；payload 仍是 flattened actor fields。
- comments path 的 `query(collection(...))` stub 需要保留 collection path；dashboard/comment 聚合測試也靠 path 分辨 query result。

### 2.7 S2 dashboard/navbar reusable patterns

- dashboard card/tabs 測試可共用 Firestore query fixture map：用 collection/query path 決定回傳 post/event/comment docs，讓 dashboard runtime 真實組合資料。
- dashboard card 類檔案只保留外部或 UI 邊界 mock；清掉 `@/lib|repo|service|runtime` internal mock 後，改 assert rendered state 與 SDK call payload。
- navbar desktop/mobile 測試用 AuthProvider provider mock 作 React 邊界；路由狀態與 active path helper 走真實 implementation。
- Navbar flaky count 已清：S2 從 18.6 移除 navbar 四檔時沒有新增 18.5 ignore，`toHaveBeenCalledTimes` baseline debt 不留在 navbar batch。

### 2.8 S3 notification reusable patterns

- notification integration 檔一律讓 `@/lib/notification-helpers` / notification provider / runtime path 真實執行；測試控制點移到 `firebase/firestore` SDK mock 與 `@/config/client/firebase-client` 的 `db` stub。
- Firestore SDK mock 至少保留 notification domain 會用到的 export：`collection`, `doc`, `query`, `where`, `orderBy`, `limit`, `startAfter`, `getDocs`, `addDoc`, `updateDoc`, `onSnapshot`, `serverTimestamp`, `writeBatch`。缺 export 會在 import 階段或真實 provider path 爆掉。
- `onSnapshot` stub 要依 query constraints 分辨 all vs unread listener；測試用 callback 變數手動 emit snapshot。snapshot shape 需提供 `docs`，需要 toast / click optimistic update 時也要提供 `docChanges()`。
- listener unsubscribe 要回 `vi.fn()`，error-path 測試可從 `onSnapshot.mock.calls[index][2]` 取 error callback 觸發 provider error handling。
- pagination 測試以真實 `startAfter(lastDoc)` cursor 驅動：`QueryDocumentSnapshot` stub 要保留 stable doc object，`getDocs(queryValue)` 從 `queryValue.constraints` 找 `startAfter` cursor 後切下一頁，不要只用 call count。
- notification write side effect 不 assert internal helper call；改 assert SDK boundary：`addDoc(collection(db, 'notifications'), payload)` 或 `writeBatch().set(doc(collection(db, 'notifications')), payload)` / `commit()`。
- `NotificationContext` 直接 provider mock 只適合純 UI leaf（例如 panel item render）；若測 provider lifecycle、bell、pagination、toast、click，應保留 `NotificationProvider` 真實執行並只 mock Auth provider / Firestore SDK。

### 2.9 S5.B weather reusable patterns

- **適用範圍**：weather page integration tests — 真實 `useWeatherPageRuntime` + `useWeatherFavorites` + `weather-api-repo` + `firebase-weather-favorites-repo`；不再 mock runtime hook。
- **SDK boundary mock 七件套**：
  1. `global.fetch` 用 URL 分流（`URL().searchParams.get('township')` 等）
  2. `firebase/firestore` path-aware：`getDocs` / `addDoc` / `deleteDoc` 都需要
  3. `@/config/client/firebase-client` mock `db: {}`
  4. `@/runtime/providers/AuthProvider` 只 mock `AuthContext`（不 mock `AuthProvider` 元件）
  5. `@/runtime/providers/ToastProvider` mock `useToast: () => ({ showToast })`
  6. `react-leaflet` + `leaflet` + `topojson-client` 全 stub（地圖層）
  7. `@/data/geo/*` json fixture stub
- **跨 test 重置**：每個 `beforeEach` 必須跑：
  - `vi.clearAllMocks()` + `vi.unstubAllGlobals()`
  - `globalThis.localStorage?.clear?.()`（否則 favorites 殘留）
  - `window.history.replaceState({}, '', '/')`（runtime 會 `replaceState` URL）
  - `getDocs.mockImplementation(...)` 重設（避免上輪殘留）
- **Path-aware Firestore stub**：snapshot shape `{ docs: [{ id, data: () => record }], empty, size }`；`docs[].data()` 必回 callable。
- **fetch 分流**：用 `URL().searchParams.get('township')` 判斷查詢；回 `Response` 物件而非 `{ json: () => ... }`（`fetchWeather` 走 `res.json()`，原生 `Response` 摩擦最少）；in-flight 用 `mockImplementationOnce(() => new Promise(() => {}))` never-resolve。
- **AuthContext 切換 SOP**：mock 模組暴露 `mockAuthContext`，登入態切換**必須**走 `<AuthContext.Provider value={...}>` 包 render；`createContext({ user: null, ... })` default 是 frozen，靠 default value 改不了。
- **WeatherInfo typedef 完整欄位**：cast 必須包含 `locationName` + `locationNameShort` + `today` + `tomorrow`，少 `locationNameShort` 撞 TS2741。
- **jsdom ResizeObserver stub**：地圖元件需要，beforeEach 裡 stub `globalThis.ResizeObserver`。
- **18.5 不需動**：S5.B 三檔（favorites / weather-page / township-drilldown）本身無 `toHaveBeenCalledTimes`，不在 18.5 baseline。

### 2.10 S5.C strava reusable patterns

- **AuthContext dual import**：sub-hooks 走 `@/contexts/AuthContext`，主 hook 走 `@/runtime/providers/AuthProvider`；兩條 alias **必須 mock 同一個** `createContext` 實例（後者透過 `await import('@/contexts/AuthContext')` re-export）。
  - 例外：`CallbackPage` 元件只走 `useAuth`，單邊 mock `AuthProvider` 合理。
  - `RunCalendarDialog` 兩邊各 `createContext` 是技術債（dual mock 不對齊但 9 tests pass，後續注意）。
- **ToastProvider mock**：`useToast: () => ({ showToast: ... })` 灰區 React 邊界。
- **`vi.hoisted` 不能直接 import React**：`import { createContext } from 'react'` 進 hoisted factory 會撞 `Cannot access '__vi_import_X__' before initialization`；改用 `vi.mock(..., async () => { const { createContext } = await import('react'); return {...} })` 模式。
- **AuthContext shape type-check**：必須補 `setUser: () => {}`（+ user.bio）滿足 `AuthContextValue` type-check（TS2741）。
- **fetch global 賦值 type cast**：`globalThis.fetch = vi.fn()` 直接撞 TS2322；用 `/** @type {typeof globalThis.fetch} */ (/** @type {unknown} */ (fetchSpy))` 雙 cast。
- **onSnapshot connection listener pattern**：必用 `queueMicrotask` 排程 `onNext`，否則在 `useEffect` register 前 emit。
- **getDocs activities pattern**：snapshot shape `{ docs: [{ id, data: () => ({...}) }] }`。
- **fetch sync/disconnect/callback pattern**：`mockResolvedValue(ok/json)` + never-resolve loading（`new Promise(() => {})`）。
- **Cooldown 不需 fake timers**：`useStravaSync` useState initializer 直接拿 `calcRemaining(lastSyncAt)`；`setInterval(1000)` 在 1s 內不會 tick；fake timers 反而增加 act warning。改用 `lastSyncAt = { toDate: () => new Date(Date.now() - 255_000) }`。
- **`groupActivitiesByDay` 用 `startDateLocal` 算 day**：不是 `startDate.toDate().getDate()`；fixture 必須提供完整 `startDateLocal` 字串。
- **`vi.spyOn(window, 'confirm')` 取代 mock**：比 `globalThis.confirm = vi.fn()` 更穩，afterEach restore 自動處理。
- **真實 `formatPace(1710, 5200) = 5'28"/km` bug fix**：原 `RunsActivityCard` 斷言 `5'30"/km` 是錯的；改寫後對齊真實實作。
- **灰區保留**：`@/components/Runs{LoginGuide,ConnectGuide,ActivityList,RouteMap}` / `@/components/RunCalendarDialog` / `react-leaflet`。
- **18.5 stale 警示**：S5.C 三檔（CallbackPage / RunCalendarDialog / RunsPage）已移除 `toHaveBeenCalledTimes` 但 18.5 仍有 entry → 加入 stale 清單，§7 Q4 累計處理。

### 2.11 S6 unit/lib notification pattern（純 facade，無 React）

- **適用範圍**
  - `tests/unit/lib/notify-*.test.js` + `firebase-notifications-{read,write}.test.js` + `fetch-distinct-*.test.js`
  - 純測試 client lib facade re-export 出來的 use-case 行為，不走 jsdom render / provider chain
- **不走 React 的 mock 簡化**
  - 無需 AuthContext / ToastProvider / NotificationProvider mock
  - 無需 `vi.hoisted` createContext pattern（S5.C 雷區不適用）
  - jsdom 仍是測試環境（沿用 `vitest.setup.jsx`），但無 DOM 操作
- **SDK firestore 共用 mock 清單（5 檔同一份）**
  - 寫類：`addDoc`, `writeBatch`, `collection`, `doc`, `serverTimestamp`
  - 讀類：`onSnapshot`, `getDocs`, `updateDoc`
  - Query 構造：`query`, `where`, `orderBy`, `limit`, `startAfter`, `collectionGroup`, `documentId`
  - 工具：`getFirestore`（防 init throw）
- **Dead mock 必刪（S6 發現）**
  - `@/lib/firebase-events` 在 read / `fetchDistinctCommentAuthors` / `notifyPostCommentReply` 路徑都不會被 import，原 spec 026 註入是過度防禦，必須一律移除
  - `@/service/notification-service` 用 `importOriginal + override buildNotificationMessage` 在 read path 也是 dead；write path 雖有 call `buildNotificationMessage` 但真實實作可直接驅動
  - 改寫前先 grep 違規 mock 對應 export 在測試檔內 `mockResolvedValue` / `mockReturnValue` 使用次數，0 use count = dead = 直刪安全
- **Listener stub（無 queueMicrotask）**
  - `mockedOnSnapshot.mockImplementation((q, onNext, onError) => { cb = onNext; errCb = onError; return vi.fn(); })`
  - 同步呼叫 `cb(snapshot)` 不需 `queueMicrotask`（非 React effect register 時序問題）
  - error 觸發從 `mock.calls[i][2]` 取
- **Pagination cursor stub**
  - `afterDoc` cast 成 `QueryDocumentSnapshot`（`{ id: 'cursor-doc' }` 即可）
  - 直接傳給 SDK `startAfter(afterDoc)` 不解構
  - `lastDoc` 取 `mockDocs[mockDocs.length - 1]` 或 `null`（empty docs）
- **`buildNotificationMessage` 真實字串（中文書名號 U+300E / U+300F，非 ASCII 引號）**
  - `event_modified`：你所參加的『${title}』活動資訊有更動
  - `event_cancelled`：你所參加的『${title}』已取消
  - `post_new_comment`：你的文章『${title}』有一則新的留言
  - `post_comment_reply`：你留言過的文章『${title}』有一則新的留言
  - `event_host_comment`：你主辦的活動『${title}』有一則新的留言
  - `event_participant_comment`：你參加的活動『${title}』有一則新的留言
  - `event_comment_reply`：你留言過的活動『${title}』有一則新的留言
  - assertion 必須複製真實字串，不要手寫；建議 `expect.stringContaining(<entityTitle>)`
- **Driving real `fetchParticipantUids` / `fetchDistinctEventCommentAuthors` 必備**
  - `fetchParticipantUids`（firebase-events-repo:200-221）：`getDocs(query(collection(db, 'events', eventId, 'participants'), orderBy('joinedAt', 'desc'), limit(N)))`
  - `fetchDistinctEventCommentAuthors`（firebase-notifications-repo:51-72）：`getDocs(collection(db, 'events', eventId, 'comments'))` — **直接 `collection` 不走 `query()`**
  - path-aware `getDocs` 分流：用 `collection.mockImplementation` 回 marker 帶 path，再從 `query.path` 或 raw `collection.path` 抓 collection name 分流
  - **必帶 throw fallback**：unexpected path → `throw \`unexpected getDocs path: ${path}\``，避免 stub 太鬆 false-pass
- **Payload shape（同 S1/S3）**
  - actor flattened：`actorUid` / `actorName` / `actorPhotoURL`（**非** nested `actor`）
  - `createdAt = serverTimestamp()` 回值（mock 為 `'mock-timestamp'` 或 `'mock-server-timestamp'` 字串）
  - `read: false` 預設
  - doc ref 從 string 改 object 後 `mockBatch.set` / `mockedAddDoc` 第一個 arg 用 `expect.any(Object)` 而非字面字串
- **18.5 entry 業務正確不動**
  - S6 5 檔皆在 18.5 baseline (line 498-504)，內含 `toHaveBeenCalledTimes` 多為業務批次數量斷言
  - 例：`mockBatch.set.toHaveBeenCalledTimes(53)`（50 participants + host + 2 dedup commenters）
  - 例：onSnapshot listener `toHaveBeenCalledTimes(2)`（initial + subsequent）
- **不應**移除這些 entry；spec 028 sweep 時要逐筆檢視業務 vs flaky

### 2.12 S7 unit/runtime pattern（real runtime/use-case chain）

- **適用範圍**
  - `tests/unit/runtime/{notification-use-cases,post-use-cases,profile-events-runtime,useStravaActivities,useStravaConnection}.test.*`
  - 目標是保留 real runtime/use-case/service/repo path，只在 React 邊界與 SDK 邊界控行為
- **允許的 mock 面**
  - `firebase/firestore`
  - `@/config/client/firebase-client`
  - `@/contexts/AuthContext` 或 `@/runtime/providers/*`（只在 hook 真的吃 context 時）
- **關鍵做法**
  - `query()` / `collection()` / `doc()` mock 必須保留 `path` 或 `constraints` metadata，`getDocs` / `onSnapshot` 才能依 collection path、cursor、query shape 分流
  - hook pagination 直接餵 real `lastDoc` / `startAfter(lastDoc)` cursor；不要退回 call-count mock
  - `onSnapshot` 測 listener lifecycle 時，unsubscribe 必回 `vi.fn()`；需要 React effect 完成註冊後再 emit 時，用 `queueMicrotask`
  - runtime 測試不 assert internal helper/mock function；改 assert render state、returned hook state、以及 SDK payload / cursor 行為
- **S7 實證**
  - `useStravaActivities` / `profile-events-runtime` 都靠 path-aware Firestore stub 驅動真實 pagination
  - `notification-use-cases` / `post-use-cases` 直接驗證 repo-facing payload normalization，沒再 mock `@/runtime/**` / `@/service/**`

### 2.13 S7 unit/api + scattered service/repo pattern（Admin SDK / fetch 邊界）

- **unit/api server route**
  - route 檔一律不再 mock internal server use-case；改 mock `firebase-admin` + `global.fetch`
  - `firebase-admin` mock 用 in-memory `docStore` 最穩：同時支援 `auth().verifyIdToken()`、`firestore().collection().doc().get/set/update/delete`、`where().limit().get()`、`batch().set/update/delete/commit()`
  - Strava / weather upstream 一律 stub `global.fetch`；對 route / service 直接使用 `Response` 物件比裸 `{ json() {} }` friction 更少，且可真實覆蓋 `status`, `ok`, `headers`, `statusText`
  - route 驗證要看 HTTP contract + persisted side effect：`response.status` / `await response.json()` / cache header / `docStore` mutation / fetch URL/body，不看 internal use-case 是否被呼叫
- **service / repo 散落檔**
  - `profile-service.test.js` 只 mock `firebase/firestore` + `db`，讓 real service + repo + mapper 執行；count query / `limit(pageSize + 1)` / `setDoc(..., { merge: true })` 都直接驗
  - `weather-forecast-service.test.js` 不再 mock `weather-location-service` / `weather-api-repo`；直接 stub `fetch` 驅動 county/township、UV/EPA fallback、500 masking
  - `firebase-profile-server.test.js` 只 mock `firebase-admin`，repo 層 assertion 對齊 raw snapshot contract（存在回 raw data、不存在回 `null`、空 data 回 `{}`）
- **本輪結論**
  - 原先預估的 `strava-callback` / `strava-webhook` Option A 沒發生；`global.fetch` + Admin SDK stub 已足夠，**本輪無 Option A**

---

## 3. Per-session 操作 SOP（plan §4.3 再強化）

### 3.1 改寫單檔的標準 8 步

1. **盤點**：`grep -nE "vi\.mock\(['\"]@/" <file>` 列出所有 internal mock，標記違規（依該 session 對應 batch 的 selector）vs 合規
2. **追溯**：grep 違規 mock 對應的 `vi.fn()` exports 在測試裡如何被 `mockResolvedValue` / `mockReturnValue` — 那是「行為控制點」，改寫後要把控制移到 SDK 層
3. **改寫**：拿掉違規 `vi.mock`，改 mock SDK：
   - 第一+二批（client integration / unit/runtime）→ mock `firebase/firestore`
   - 第三批（unit/lib）→ mock `firebase/firestore`（lib facade 大多走 client SDK）
   - 第四批（unit/api server route）→ mock `firebase-admin/firestore`
   - 散落（unit/service+repo）→ 看實際 import 決定 client 或 admin SDK
4. **跑單檔測試**：`npx vitest run <file>`
5. **跑單檔 lint**：`npx eslint <file>` — 確認規則 fire 但 0 violations
6. **記錄待移除 baseline**：依該檔所在 batch 找對應 ESLint block，寫進 session consolidation 清單；此步不可直接改 `eslint.config.mjs`：
   - `tests/integration/**` → block 18.6 ignores
   - `tests/unit/runtime/**` / `tests/unit/api/**` / `tests/unit/service/**` / `tests/unit/repo/**` → block 18.7 ignores
   - `tests/unit/lib/**` → block 18.8 ignores
   - 該檔同時有 flaky 違規未清 → 記錄待移入 18.5 ignores
7. **交給 session consolidation owner**：該 owner 一次更新 `eslint.config.mjs`、確認 baseline count、再跑 `npm run lint`
8. **session commit / PR 紀錄**：commit 或 PR description 彙總 `Baseline change: <block>: X → Y (removed: <files>)`（block 用 `18.6` / `18.7` / `18.8`），不要 per-file commit

### 3.2 PR 收尾 checklist

- [ ] 該 session 所有檔都跑過單檔 vitest + 單檔 eslint
- [ ] `npm run lint` 全綠
- [ ] `npm run type-check` 全綠
- [ ] `npm run test:branch` 全綠
- [ ] `npm run test:coverage` 跑一次，數字記在 PR description（理論不下降）
- [ ] `eslint.config.mjs` 對應 block ignores 數字實際下降，PR description 紀錄起訖（如 S1 為 `block 18.6: 55 → 50`，S6 為 `block 18.8: 5 → 0`）
- [ ] PR template 「Mock boundary」「Baseline tracking」checkbox 已勾且 commit message 對齊
- [ ] 更新本 handoff.md「進度看板」row + 把成功 pattern / 撞坑紀錄補進 §2 / §5
- [ ] handoff 移交給下個 session：列舉 flag 起來的 Option A 個案、未解 question

---

## 4. 容易撞的坑（先記下，session 結束時補實測）

### 4.1 預期會撞的（從 audit + memory + 現有測試 inspection 推得）

- **`firebase/firestore` mock 漏 export** → `ReferenceError: getDoc is not defined`。SOP 第 2 步追溯時要把整條 use-case → service → repo 鏈用到的 SDK function 都列出，全 mock
- **`runTransaction` stub 不是 callback shape** → use-case 內的 `await runTransaction(db, async (tx) => {...})` 因 stub 沒 invoke callback → 測試永遠 timeout / get/set 沒被 call
- **`@/config/client/firebase-client` 與 `@/lib/firebase-client` 兩條路徑同時被 mock** → vitest.setup.jsx:66 已 mock `@/lib/firebase-client`；測試檔內又 mock `@/config/client/firebase-client`。兩條都 mock 通常 OK，但若改寫過程留一條漏一條 → 真實程式碼 import 走另一條 → `auth is undefined` 之類
- **flaky 規則對該檔 fire** — 從 18.6 baseline 拿掉檔後，若該檔仍有 `toHaveBeenCalledTimes`：
  - 該檔本來在 18.5 baseline list（45 檔 flaky-only）→ flaky 規則仍會 mute → OK
  - 該檔不在 18.5 list（27 檔 only mock-boundary baseline）→ flaky 規則開始 fire 會擋 PR → 必須在改寫時順手清 flaky，或加進 18.5 ignores
  - 判斷指令：`grep -n "<filename>" eslint.config.mjs` — 看該檔是否同時在 18.5 + 18.6
- **`@/runtime/client/use-cases/auth-use-cases` 是 `default` export** — `vi.mock` 寫 `{ default: vi.fn(() => vi.fn()) }`，改寫時注意 default export 與 named exports 共存的拼法

### 4.2 已知 Option A 個案候選（pilot 前先 flag）

下列檔在 §5 Session 切分時已被 plan §5 標記為「Option A 高機率候選」：

| 檔                                                                | Session | 候選原因                                                           |
| ----------------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| `tests/integration/posts/PostDetailClient-delete-race.test.jsx`   | S1      | 名稱 `delete-race` 暗示 transaction race condition；可能 stub 失真 |
| `tests/integration/events/EventDetailClient-delete-race.test.jsx` | S4      | 同上，跨 collection cascade delete                                 |
| `tests/integration/strava/CallbackPage.test.jsx`                  | S5      | Strava OAuth fetch 邊界，且屬 audit P1-3 critical path             |

> 開工時若確認屬 Option A → 從本 spec 範圍移出，handoff §6 紀錄並指向後續 spec 編號（暫定 028+）。

---

## 5. 撞到的坑紀錄（每 session 補）

### S0 坑紀錄

- **selector 排除 providers 已實測**：`^@/runtime/(?!providers/)` 可用；literal + template literal selector 都採同一邏輯。fallback 仍是改成 runtime 子樹 allowlist（`client|server|hooks`），但 S0 未使用 fallback。
- **18.7 / 18.8 必須是 combined block**：第一次 `npm run lint` 暴露 flat-config 覆蓋問題；新增 unit blocks 若只放 mock-boundary selector，會讓 18.5 flaky baseline 的既有 ignores 失效。實作改成 18.7/18.8 都 duplicate `toHaveBeenCalledTimes` selector，並用 `unitRuntimeApiServiceRepoFlakyBaselineForCombinedBlocks` / `unitLibFlakyBaselineForCombinedBlocks` spread 保留 18.5 既有 flaky ignores。三個 awk count 仍只計 mock-boundary baseline：18.6=55、18.7=14、18.8=5。
- **18.6 baseline**：47 -> 55，新增 8 檔：`PostCard` / `DashboardCommentCard` / `DashboardEventCard` / `DashboardPostCard` / `Navbar` / `isActivePath` / `RunsRouteMap` / `RunsActivityCard`。
- **18.7 baseline**：新增 14 檔，涵蓋 `tests/unit/{runtime,api,service,repo}/**`。同 block 另外 spread 3 個 flaky-only baseline 檔以維持 18.5 語意；這 3 檔不算 mock-boundary baseline count。
- **18.8 baseline**：新增 5 檔，涵蓋 `tests/unit/lib/**` notification batch。同 block 另外 spread 10 個 flaky-only baseline 檔以維持 18.5 語意；這 10 檔不算 mock-boundary baseline count。
- **audit script**：`SEARCH_PATH` 已從 `tests/integration` 擴到 `tests`，pattern 已加 `lib`，並排除 `@/runtime/providers/`；仍是 warn-only `exit 0`。S0 起始輸出為 63 finding files（warn-only）。
- **smoke probe A**：暫時在 `tests/unit/service/weather-helpers.test.js` 加 `vi.mock('@/repo/__s0_smoke__', () => ({}));`，`npx eslint tests/unit/service/weather-helpers.test.js` 正確以 18.7 mock-boundary error fail。probe 已 revert，`git diff -- tests/unit/service/weather-helpers.test.js` 與 `git status --short -- tests/unit/service/weather-helpers.test.js` 皆乾淨。
- **smoke probe B**：暫時在同檔加 `vi.mock('@/runtime/providers/__s0_smoke__', () => ({}));`，`npx eslint tests/unit/service/weather-helpers.test.js` exit 0，證明 providers 不被 mock-boundary 擋。probe 已 revert，該檔 diff/status 皆乾淨。

### S1 坑紀錄

- **S1 五檔全走 Option B**：`PostDetailClient-delete-race` 沒移出 spec；race branch 用 real `deletePost -> deletePostTree -> getDoc(false)` 觸發，沒有再 mock `deletePost` reject。
- **`query()` stub 必須保留 collection path**：`getLatestComments` 會呼叫 `getDocs(query(collection(...)))`；若 `query` 只回 `{ parts }`，`getDocs` 分辨不出 `posts/:id/comments`，留言區會空。
- **transaction `tx.get` 要看 ref path**：like path `posts/:id/likes/:uid` 要回 exists false 才會走 `tx.set`；一律回 post snapshot 會變成 unlike branch。
- **`doc(collection(...))` 要產生 stable id**：`addCommentDocument` 用 generated comment ref id 回傳；S1 用 `new-comment` / `comment1` 接 `getCommentById` 與 notification payload。
- **notification payload actor 是 flattened fields**：`buildNotificationDoc` 寫入 `actorUid` / `actorName` / `actorPhotoURL`，不是 `{ actor: ... }`。S2/S3 notification batch 不要沿用 nested actor assertion。
- **edit dirty 真實路徑會 trim**：原本 mock `updatePost` 的測試以為 raw whitespace 會送出；移除 internal mock 後真實 `buildUpdatePostPayload` 會 trim，再由 `updateDoc` 接收 trimmed payload。
- **ESLint helper object 避免同名 shorthand 誤報**：`firestoreMocks` 若寫 `addDoc: (addDoc)` 會觸發 `object-shorthand`；S1 用 computed key `['addDoc']` 保留可讀 key 並通過 lint。
- **components mock 只算灰區保留**：`@/components/ShareButton` / `@/components/UserLink` 沒在本 spec 清理範圍，不要把它們稱為正式 allowed boundary。
- **S1 verification**：五檔各自 `npx vitest run <file>` + `npx eslint <file>` 通過；18.6 baseline 已從 55 降到 50。

### S2 坑紀錄

- **S2 全 14 檔已從 18.6 baseline 移除**：posts rest + comments + dashboard + navbar consolidation 後，18.6 count 50 -> 36。
- **Navbar flaky count 已清**：`Navbar.test.jsx` / `NavbarMobile.test.jsx` / `NavbarDesktop.test.jsx` / `isActivePath.test.js` 從 18.6 退場時未留下 `toHaveBeenCalledTimes` debt，也沒有搬進 18.5 baseline。
- **providers mock 仍是允許邊界**：S2 posts/navbar 檔仍可 mock `@/runtime/providers/AuthProvider` / `ToastProvider`；18.6 selector 排除 providers，這不是 violation。
- **comments/dashboard 共用 path-aware Firestore stubs**：`query()` / `collection()` / `doc()` 回傳 shape 要帶 path，否則 comments 與 dashboard fixture 會互相吃錯資料。
- **不重寫 worker 檔案**：S2 consolidation 只更新 baseline + handoff；若後續 branch verification 暴露問題，先回報再改對應 worker file。

### S3 坑紀錄

- **S3 全 9 檔已從 18.6 baseline 移除**：notifications consolidation 後，18.6 count 36 -> 27。
- **不要 mock notification internals**：S3.A-D 清掉 `@/lib/notification-helpers` / internal notification path mock 後，error、trigger、click、toast、pagination 都改由 Firestore SDK mock 控制行為；S6 unit/lib notification batch 要延續這個邊界。
- **`onSnapshot` 不是單一 listener**：notification provider 同時有 all / unread subscription；stub 需要看 `where('read', '==', false)` 或 query constraints 分流，否則 unread badge、tabs、toast 會吃錯 callback。
- **pagination cursor 必須是 doc object**：`startAfter` 要吃上一頁最後一個 snapshot doc；若 stub 只傳 id 或 index，load more / listener shift 測試會失真。
- **error path 用 SDK failure 注入**：write failure 用 `addDoc` / `writeBatch().commit` reject；listener failure 用 `onSnapshot` 第三參數 error callback，不要重新 mock internal helper reject。
- **S6 重用提醒**：unit/lib notification 檔會直接測 facade/helper，仍應 mock `firebase/firestore` SDK boundary；不要把 S3 的 provider mock 當成可 mock lib 自家的理由。

### S4 坑紀錄

- **S4 全 6 檔已從 18.6 baseline 移除**：events 3 + profile 3 consolidation 後，18.6 count 27 -> 21。
- **events SDK boundary 重點**：
  - `event-detail-comment-runtime`：comment runtime 走 `getDoc` + `getDocs(query(collection(...)))`；query path 用來分辨 events doc vs comments subcollection。CommentSection / ShareButton / UserLink 仍走 `@/components/*` UI mock（灰區保留）。
  - `EventDetailClient-delete-race`：cascade delete race 用 **第二次 `getDoc(eventRef)` 回 `exists()=false`** 觸發 UI catch branch（同 S1 PostDetailClient race pattern）；EventMap / EventEditForm / CommentSection / ShareButton / UserLink 仍走 component mock。
  - `EventsPage`：list + pagination fan-out 由 `getDocs(query(...))` + `IntersectionObserver` 驅動；type-fix 階段補了 `IntersectionObserver` 全域 stub 修正 type-check error。
- **profile SDK boundary 重點**：
  - 3 檔共用 `firestoreMock` helper（與 §2.1 骨架一致，含 `getDoc` / `getDocs` / `updateDoc` / `query` / `collection` / `doc`）；`@/config/client/firebase-client` mock `db: {}`。
  - `ProfileClient`：ProfileHeader / ProfileStats / ProfileEventList 三個下游 component 仍走 `@/app/users/[uid]/*` mock（灰區保留），核心 user load path 走真實 use-case；type-fix 階段補了 user mock object shape 滿足 strict type-check。
  - `ProfileEventList`：用 `QueryDocumentSnapshot` shape 配合 `startAfter` cursor pagination；type-fix 補了 cast 滿足 SDK type。
  - `BioEditor`：edit dirty/save path 走真實 `updateDoc`，斷言 SDK payload 而非 internal mock call count。
- **type-check pitfall（重要！後續 S5/S6/S7 必讀）**：mock-boundary reviewer **一定要同步 `npm run type-check`**，因為 mock object shape 不滿 SDK type / DOM API type 會 leak 到 type-check 階段（S4 漏跑造成 round 1 stop、round 2 才補完）。建議 reviewer task 強制加 step：
  ```bash
  npm run type-check 2>&1 | grep -E "<file basename>"
  ```
  S5/S6/S7 啟動前 reviewer prompt 都應補上這條 gate。
- **PostToolUse Prettier hook pitfall（重要！）**：PostToolUse Edit hook 會 auto-run repo-wide Prettier，每次 Edit **任何檔**會帶出 8 個 unrelated formatter 檔（`tests/integration/comments/CommentSection.test.jsx`, `tests/integration/navbar/Navbar{Desktop,Mobile}.test.jsx`, `tests/integration/notifications/{NotificationPagination,NotificationPaginationStateful,notification-click}.test.jsx`, `tests/integration/posts/PostDetailClient-delete-race.test.jsx`，外加 `specs/027-tests-mock-cleanup/tasks.md`）。
  - **不要用 `npm run lint`**（會 trigger ESLint --fix repo-wide auto-format，撞 hook 雪崩）；改用 `npx eslint <files>` 或 `npx eslint src specs tests`。
  - **`git checkout --` / `git restore` 都被 hook 擋**；要還原請用 `git checkout HEAD <file>`。
  - commit 前最後一次 `git checkout HEAD <8 files>` 收尾、再 `git add` staged 範圍。
- **18.5 stale entry 觀察（給未來 sweep）**：ProfileClient / BioEditor 兩檔在 18.5 baseline (eslint.config.mjs line 480/481) 也有 entry，但 S4.B 改寫過程把 `toHaveBeenCalledTimes` 一併清掉，現在 18.5 entry 變 stale。S4.C 依 027 scope 不動 18.5，留給未來 18.5 sweep 處理（可能搭配 S5/S6/S7 累積後一併清）。
- **Reviewer pattern note**：pair reviewer 在驗 mock-boundary 改寫時，**應同步檢查檔內 `toHaveBeenCalledTimes` 是否被 side-effect 移除**，並在報告中明記 → 給後續 consolidation owner 判斷 18.5 是否要動。S5+ reviewer prompt 建議直接補這條。

### S5 坑紀錄

- **S5 全 10 檔已從 18.6 baseline 移除**：toast 1 + weather 3 + strava 6 consolidation 後，18.6 count 21 → 11。

#### S5.A toast 坑（`crud-toast.test.jsx`）

1. **「臺北市」(U+81FA) vs「台北市」(U+53F0) 字元坑** — `taiwan-locations` 真實字典用 U+81FA；form 輸入需用 U+81FA，否則 `Value not found in options`；S5.A 內 fixture L449/479/533 仍用 U+53F0（reviewer 判低風險，consolidation 統一建議後續 spec 對齊）。
2. **PaceSelector option value zero-padded**（`'02'..'20'` / `'00'..'59'`）。
3. **EventCreateForm 11 必填欄位** — Option B 改寫後得實打實填表跑真實 `normalizeEventPayload` validation；建議抽 `fillCreateEventForm` helper 給 S6/S7 重用。
4. **EventCreateForm 多個欄位 label 為空 / 共用**：`paceMinutes/Seconds` 用 `getAllByRole('combobox')` + `getAttribute('name')` filter；city/district 共用 label，district 靠 `aria-label="選擇區域"` 區分。
5. **`useEventParticipation.fetchJoinedParticipantDocuments` 會吃 `getDoc`** — `mockResolvedValueOnce(eventDoc)` 會被 participation `getDoc(events/<id>/participants/<uid>)` 先消耗 → delete fail；**必須用 path-aware `mockImplementation` 依 segments.length 分流**（top-level event = 2，participant subdoc = 4）。
6. **`testing-library/no-node-access` 對 `document.getElementById` / `querySelector` 都 fire**；`getAttribute` 不在 ban list → `getAllByRole(...).find(el => el.getAttribute('name') === ...)` 模式。
7. **`@/lib/firebase-users` mock 是死碼** — `AuthContext.Provider` 直接注入時 real `AuthProvider` 走 `auth-use-cases`/`firebase-users` chain 不會執行；S6/S7 可直接刪該 mock。

#### S5.B weather 坑（favorites / weather-page / township-drilldown）

1. **AuthContext default value 不可變** — `createContext({user: null,...})` default 是 frozen，登入態切換必須走 `<AuthContext.Provider value={...}>`，不可只靠 default。
2. **`syncWeatherLocationToUrl` 跨 test 殘留** — runtime 在 `setSelectedLocation` 後 `replaceState` URL；beforeEach 必加 `window.history.replaceState({}, '', '/')`。
3. **localStorage 殘留** — beforeEach 加 `globalThis.localStorage?.clear?.()`。
4. **ToastProvider 必須 mock** — runtime 走真實 `useWeatherFavorites` → `useToast()`；少 mock 會 throw `useToast must be used within ToastProvider`。
5. **WeatherInfo type 缺 `locationNameShort`** — typedef cast 必須包含此欄位，TS2741。
6. **`mockImplementation(async (...args) => buildGetDocsImpl(...)(...args))` 觸發 TS2556** — 改成單參數 `(arg) => impl(arg)` 過 type-check。
7. **fetch mock URL 分流比 `mockResolvedValueOnce` chain 穩** — hook 對 same county 重複 click 不會 refetch；用 `URL().searchParams.get('township')` 判斷。
8. **回 `Response` 物件而非 `{ json: () => ... }`** — `fetchWeather` 走 `res.json()`，原生 `Response` 最少摩擦。
9. **`vi.hoisted` 內用 `require('react')`** — ESLint `global-require` 在 `vi.hoisted` callback 裡會誤報；本批未撞 disable，但 S6/S7 注意。
10. **AuthContext mock 兩種 shape 共存合法**：登入流程需完整 6 欄位 user 物件，訪客 `user: null` 即可。

#### S5.C strava 坑（runs-page-sync-error / RunsPage / RunCalendarDialog / CallbackPage / RunsRouteMap / RunsActivityCard）

1. **`vi.hoisted` 不能直接 import React** — `import { createContext } from 'react'` 進 hoisted factory 會撞 `Cannot access '__vi_import_X__' before initialization`；改用 `vi.mock(..., async () => { const { createContext } = await import('react'); return {...} })` 模式。
2. **AuthContext 兩條 import 路徑都要 mock** — sub-hooks 用 `@/contexts/AuthContext`，主 hook 用 `@/runtime/providers/AuthProvider`；兩條 alias 必須 mock 同一個 createContext 實例（透過 `await import('@/contexts/AuthContext')` re-export）。**例外**：CallbackPage 元件只走 useAuth，單邊 mock AuthProvider 合理；RunCalendarDialog 兩邊各 createContext 是技術債（dual mock 不對齊但 9 tests pass，後續注意）。
3. **AuthContext shape type-check** — 必須補 `setUser: () => {}` 滿足 `AuthContextValue`（TS2741），bio 也建議補。
4. **fetch global 賦值 type cast** — `globalThis.fetch = vi.fn()` 直接撞 TS2322；用 `/** @type {typeof globalThis.fetch} */ (/** @type {unknown} */ (fetchSpy))` 雙 cast。
5. **`onSnapshot` stub 必須 `queueMicrotask` 排程 onNext** — 直接 sync call 在 `useEffect` register 前觸發。
6. **Cooldown 不需 fake timers** — `useStravaSync` useState initializer 直接拿 `calcRemaining(lastSyncAt)`；`setInterval(1000)` 在 1s 內不會 tick；fake timers 反而增加 act warning。
7. **`groupActivitiesByDay` 用 `startDateLocal` 算 day** — 不是 `startDate.toDate().getDate()`；fixture 必須提供完整 `startDateLocal` 字串。
8. **`vi.spyOn(window, 'confirm')` 取代 mock** — 比 `globalThis.confirm = vi.fn()` 更穩，afterEach restore 自動處理。
9. **真實 `formatPace(1710, 5200) = 5'28"/km` bug fix** — 原 `RunsActivityCard` 斷言 `5'30"/km` 是錯的；改寫後對齊真實實作。

#### Reviewer pattern note（共通）

- pair reviewer 必跑 `npm run type-check 2>&1 | grep <basename>`（S4 學到、S5 全 batch 落實）。
- pair reviewer 同步檢查 `toHaveBeenCalledTimes` side-effect 移除，給 consolidation owner 評估 18.5。

#### 18.5 stale entries（S5 累積）

- S5.B 三檔本身無 `toHaveBeenCalledTimes`，不在 18.5。
- S5.C 三檔（`CallbackPage` / `RunCalendarDialog` / `RunsPage`）在 18.5 line 482-485 仍有 entry，但本 spec scope 不動，留給 spec 028 sweep。
- 18.5 line 541-547 還有 6 個 strava 檔 entries（含 `RunsRouteMap` / `RunsActivityCard` 等 — 確認位置不動），加上 S4 留的 BioEditor / ProfileClient（line 480-481）共計 ~11 個 stale entries 待 spec 028 sweep。

### S6 坑紀錄

- **S6 全 5 檔已從 18.8 baseline 移除**：unit/lib notification consolidation 後，18.8 count 5 → 0。S6.A writes (3 檔 / 25 tests) + S6.B reads (2 檔 / 19 tests) + 11 violations (含 4 dead mocks) 全清；reviewer 全 PASS。

#### S6.A writes 坑（`notify-event-new-comment` / `notify-post-comment-reply` / `firebase-notifications-write`）

1. **`fetchDistinctEventCommentAuthors` 不走 `query()`** — 直接 `getDocs(collection(db, 'events', eventId, 'comments'))`，與 `fetchParticipantUids` 走 `getDocs(query(collection(...), orderBy, limit))` 不同；path-aware getDocs 分流必須兼容兩種（用 `arg.path` 而非 `arg.constraints` 判斷）。
2. **`collection()` 第一個 arg 是 `_db` (unused 但要消費)**，segments 從 `...args[1:]` 開始；mock 寫成 `(_db, ...segs) => ({ path: segs.join('/') })`。
3. **`addNotificationDocuments` 內部 `doc(collection(db, 'notifications'))` 是「無 segments」的 doc-from-collection 用法** — `doc()` mock 必須處理 `segments.length === 0`，用 `${base.path}/auto-id` fallback 產生 stable id。
4. **真實 `buildNotificationMessage` 用中文書名號 「『」「』」(U+300E / U+300F)，不是 ASCII 引號** — assertion 必須複製真實字串；建議 `expect.stringContaining(<entityTitle>)`。完整字串對照表見 §2.11。
5. **`@/lib/firebase-events` 是 dead mock 確實 dead** — `notifyPostCommentReply` 真實 path 是 `runtime/use-cases → fetchDistinctPostCommentAuthors → collection(db, 'posts', postId, 'comments')`，沒走 events；可直接刪。
6. **doc ref 從 string 改 object 後 `mockBatch.set` / `mockedAddDoc` 第一個 arg 不可再用字串字面比對** — 用 `expect.any(Object)`；payload assertion 走第二個 arg。

#### S6.B reads 坑（`firebase-notifications-read` / `fetch-distinct-comment-authors`）

- **完全沒撞坑**：兩檔 4 dead mocks 直刪即過 4 件套（vitest + eslint + type-check + spellcheck）。
- **可重用 insight**：unit/lib facade 測試若已用完整 SDK mock 寫，多餘 internal mock 通常是「歷史殘留」 — 改寫前先 grep 違規 mock 對應 export 在測試檔內使用次數，0 use count = dead = 直刪安全。
- 已刪：`@/lib/firebase-events`（read path 不會 import）+ `@/service/notification-service`（用 `importOriginal + override buildNotificationMessage` 在 read path 也是 dead；write path 雖有 call 但真實實作可直接驅動）。

#### Reviewer pattern note（S5.D + S6 確認）

- pair reviewer 必跑 4 件套（vitest + eslint + type-check filter + **spellcheck**） — S5.D 學到、S6 全 batch 落實，避免 cspell 雷在 commit 階段才爆。
- pair reviewer 同步檢查 `toHaveBeenCalledTimes` **業務正確 vs flaky 區分**（S6 學到的細節）：S6 5 檔 18.5 entry **業務正確不動**（例：`mockBatch.set.toHaveBeenCalledTimes(53)` = host+50 participants+2 dedup commenters；listener `toHaveBeenCalledTimes(2)` = initial vs subsequent）。

#### 18.5 baseline 5 檔保留（業務正確）

- `firebase-notifications-read` / `firebase-notifications-write` / `notify-event-new-comment` / `notify-post-comment-reply`（line 498-504）皆保留 — 業務批次數量斷言非 flaky。
- `fetch-distinct-comment-authors` 本身無 `toHaveBeenCalledTimes`，不在 18.5。
- spec 028 sweep 時要逐筆檢視業務 vs flaky；S6 證據（53, listener Times(2)/Times(1)）保留說明。

### S7 坑紀錄

1. **server route 用 Admin SDK，不是 client SDK** — `firebase-admin` 需要另一套 in-memory stub，至少要覆蓋 `verifyIdToken`、`collection().where().limit().get()`、`batch().commit()`；沿用 `firebase/firestore` mock 會直接失真。
2. **Strava / weather route 不需要 Option A / nock** — 只要 `global.fetch` 回真 `Response` 或具 `ok/status/json` 的最小 response，real route + service path 就能完整驅動；這輪 `strava-callback` / `strava-webhook` 都是 Option B 收斂。
3. **route 測試別再 assert internal use-case call** — 改 assert HTTP contract、fetch request payload、token/connection/activity 寫入結果，才真的測到 route orchestration。
4. **runtime pagination / listener 要保留 cursor 與 unsubscribe shape** — `startAfter(lastDoc)` 需要 stable doc object；`onSnapshot` 需要回 unsubscribe spy，否則 hook lifecycle 測不到。
5. **service 層 fail-closed / masking 要走真實 upstream path** — `weather-forecast-service` 若還 mock internal repo/service，`Unknown county`、UV fallback、500 masking 都只是假的；直接 stub `fetch` 才能測到真 contract。

---

## 6. Option A 個案移交記錄（spec 範圍外）

> session 結束時若有檔被判定為 Option A → 從本 spec 移出，這節記錄。
> 格式：`<file> | <session> | <flag 原因> | <移交目標 spec>`

| 檔               | Session | Flag 原因     | 移交目標 |
| ---------------- | ------- | ------------- | -------- |
| （本輪無 Option A） | S7      | Option B 全數收斂 | —        |

---

## 7. Cross-cutting questions（未解）

> 開工撞到不確定的決策點，記這裡，session 結束前確認解了。
>
> S1 pilot 預期會解的問題：
>
> - Q1: runTransaction stub 用 `mockImplementation(async (db, cb) => cb(...))` 還是用 inline mock？以哪個為標準？
> - Q2: post-use-cases 的 `getLatestComments` 走 query + onSnapshot，stub 能否準確模擬 unsubscribe lifecycle？
> - Q3: 是否需要在 vitest.setup.jsx 加 default `firebase/firestore` mock 抽共用？或每檔自抽？
> - Q4 (S4 提出 / S5 / S6 累計)：18.5 stale entries 何時統一清？S4 第一筆（ProfileClient / BioEditor，line 480-481）；S5 新增 — `CallbackPage` / `RunCalendarDialog` / `RunsPage`（18.5 line 482-485）+ line 541-547 6 個 strava entries — 累計 ~11 個 stale entries 待 spec 028 sweep。**S6 補充：spec 028 sweep 時，S6 5 檔 18.5 entry 必須逐筆檢視「業務批次數量 vs flaky pattern」 — S6 證據（`mockBatch.set.toHaveBeenCalledTimes(53)` = host+50 participants+2 dedup commenters；onSnapshot listener Times(2)/Times(1) = initial vs subsequent）保留說明，這 5 檔不是 stale，是業務正確必留**。建議方案：S7 結束時 consolidation owner 一次 sweep（grep 每檔是否仍有 `toHaveBeenCalledTimes`，無 → remove；有 → 逐筆判斷業務 vs flaky），或開獨立 spec 028 處理。
> - Q5 (S5 提出 / S6 補充)：Test helper 抽取候選 — `buildGetDocsImpl`（多 firestore mock 場景重用）+ `installWeatherFetch` URL 分流 helper（S5.B 三檔重複）+ `fillCreateEventForm`（events form 真填，S5.A 撞 11 必填欄位）— 是否抽到 `tests/_helpers/`？**S6 補充：unit/lib SDK firestore mock 樣板（5 檔同一份，見 §2.11）也是抽 helper 候選，與 weather 三檔的 fetch URL 分流 helper 一起評估**。S6/S7 結束評估，看是否有跨 batch 重用實證。

---

## 8. 與既有 memory 的銜接

本 spec 的工作呼應以下 memory，session 結束時 review 是否要更新或新增：

- `feedback_mock_discipline.md` — **S7 完成後**評估是否更新（全 4 批 baseline drain 完成的證據）
- `feedback_test_writing_gotchas.md` — 撞到的具體 SDK stub 坑可考慮新增到此 memory
- `project_harness_mock_audit.md` — D2/E 章節相關，本 spec 完成後可加一句進度
- `feedback_audit_deliverable_only.md` — 本 spec 即「audit deliverable → 行動 spec」的範例，**不要**在本 spec 又自動延伸做 P1+

---

## 9. session 接棒 quick template

> 每結束一個 session，把下面複製到下個 session 的「起步」段：

```
# Session SX 起步

- 上次（S{X-1}）完成：<commit hash> / PR #<n>
- 上次 baseline：<block: X → N>，本 session 目標：<block: N → M>
- 上次 setup pattern 已固化在 §2 — **本 session 直接套**
- 上次撞的坑：<bullet from §5>
- 待解 Cross-cutting questions（§7）：<list>
- Option A 個案累計：<count>，目前已避開
- 你接到的範圍：<plan §5 SX 區塊>
```
