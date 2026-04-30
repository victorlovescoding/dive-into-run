# 027 — Handoff（session-to-session 接棒筆記）

> **用途**：每個 session 開工前必讀；結束時更新。
> **Plan**: `specs/027-tests-mock-cleanup/plan.md`
> **Audit source**: `project-health/2026-04-29-tests-audit-report.md` §2 P0-1

---

## 0. 進度看板

| Session | 狀態           | Branch | PR  | Commit | Baseline 變化                                                                                  |
| ------- | -------------- | ------ | --- | ------ | ---------------------------------------------------------------------------------------------- |
| —       | —              | —      | —   | —      | **18.6=47（spec 026 既有）/ 18.7=0 / 18.8=0（spec 027 開始前）**                               |
| S0      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 修 selector bug + 擴規則 → 18.6: 47→55（+8 新加）/ 18.7: 0→14（new）/ 18.8: 0→5（new）         |
| S1      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 18.6: 55 → 50（posts heavy / pilot — 5 檔/10 violations；Option B 全留在本 spec）              |
| S2      | ✅ Done        | 027-tests-mock-cleanup | —   | this commit | 18.6: 50 → 36（posts rest + comments + dashboard + navbar — 14 檔/15 violations；Navbar flaky count 已清） |
| S3      | ⏳ Not started | —      | —   | —      | 18.6: 36 → 27（notifications — 9 檔/32 violations）                                            |
| S4      | ⏳ Not started | —      | —   | —      | 18.6: 27 → 21（events + profile — 6 檔/8 violations）                                          |
| S5      | ⏳ Not started | —      | —   | —      | 18.6: 21 → 11（strava + weather + toast — 10 檔/13 violations；第一批 mock-boundary 部分清空） |
| S6      | ⏳ Not started | —      | —   | —      | 18.8: 5 → 0（unit/lib notification — 5 檔/11 violations）                                      |
| S7      | ⏳ Not started | —      | —   | —      | 18.7: 14 → 0（unit/runtime + api + 散落 — 14 檔/17 violations）                                |

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

### S4 坑紀錄

### S5 坑紀錄

### S6 坑紀錄

> S6 unit/lib notification batch 預期撞：
>
> - lib facade 測試 mock 下游 lib（自家 mock 自家），改寫成 mock SDK 後 lib 真實執行可能依賴環境（如 `serverTimestamp` 真實實作的時序）
> - 5 檔都是 notification domain，與 S3 知識重用

### S7 坑紀錄

> S7 unit/runtime + api + 散落 預期撞：
>
> - unit/api 的 server route 走 `firebase-admin/firestore`，與 client `firebase/firestore` 是兩套 mock 樣板（S6 / S7 結束時補進 §2.5 / §2.6）
> - strava-callback / strava-webhook fetch 邊界 → 高機率 Option A 個案，需 nock

---

## 6. Option A 個案移交記錄（spec 範圍外）

> session 結束時若有檔被判定為 Option A → 從本 spec 移出，這節記錄。
> 格式：`<file> | <session> | <flag 原因> | <移交目標 spec>`

| 檔          | Session | Flag 原因 | 移交目標 |
| ----------- | ------- | --------- | -------- |
| （pending） | —       | —         | —        |

---

## 7. Cross-cutting questions（未解）

> 開工撞到不確定的決策點，記這裡，session 結束前確認解了。
>
> S1 pilot 預期會解的問題：
>
> - Q1: runTransaction stub 用 `mockImplementation(async (db, cb) => cb(...))` 還是用 inline mock？以哪個為標準？
> - Q2: post-use-cases 的 `getLatestComments` 走 query + onSnapshot，stub 能否準確模擬 unsubscribe lifecycle？
> - Q3: 是否需要在 vitest.setup.jsx 加 default `firebase/firestore` mock 抽共用？或每檔自抽？

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
