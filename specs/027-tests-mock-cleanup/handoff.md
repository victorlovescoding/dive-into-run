# 027 — Handoff（session-to-session 接棒筆記）

> **用途**：每個 session 開工前必讀；結束時更新。
> **Plan**: `specs/027-tests-mock-cleanup/plan.md`
> **Audit source**: `project-health/2026-04-29-tests-audit-report.md` §2 P0-1

---

## 0. 進度看板

| Session | 狀態           | Branch | PR  | Commit | Baseline (mock-boundary 違規檔)        |
| ------- | -------------- | ------ | --- | ------ | -------------------------------------- |
| —       | —              | —      | —   | —      | **33（spec start）**                   |
| S1      | ⏳ Not started | —      | —   | —      | 33 → 28 (target)                       |
| S2      | ⏳ Not started | —      | —   | —      | 28 → 22 (target)                       |
| S3      | ⏳ Not started | —      | —   | —      | 22 → 13 (target)                       |
| S4      | ⏳ Not started | —      | —   | —      | 13 → 8 (target)                        |
| S5      | ⏳ Not started | —      | —   | —      | 8 → 0 (target，mock-boundary 部分清空) |

> 每完成一個 session：對應 row 狀態 → ✅ Done、寫入 branch / PR / commit hash、更新 baseline 實際數字。

---

## 1. 起步必讀（this session 的 plan 怎麼上手）

### 1.1 Plan 在哪

- `specs/027-tests-mock-cleanup/plan.md` — 完整切分、共通約束、驗證指令
- 開工先讀 plan.md §3 Scope + §4 Strategy + §5 Session 切分（找到自己這 session）+ §6 共通約束

### 1.2 上下文預覽（30 秒）

- 我們在做：把 `eslint.config.mjs` line 513-586（block 18.6）的 mock-boundary `ignores` baseline 從 47 → 14
- 範圍是 `tests/integration/**` 中 `vi.mock('@/(repo|service|runtime)/...')` 共 33 檔 / 77 violations
- 改寫策略：**Option B**（把「mock 自家 use-case」改為 mock `firebase/firestore` SDK 邊界）— 不重建 emulator integration setup

### 1.3 第一刀檢查清單

開工前 10 分鐘確認：

```bash
# 1. 確認 spec 026 已上線（規則 + scripts + workflow）
grep -n "18.6" eslint.config.mjs                    # 應看到 block 標頭
ls scripts/audit-mock-boundary.sh                   # 應存在
ls .github/workflows/firestore-rules-gate.yml       # 應存在
ls .github/pull_request_template.md                 # 應存在

# 2. 看當前 baseline 大小（block 18.6 ignores）
sed -n '513,563p' eslint.config.mjs | grep -cE "^\s*'tests/integration/"
# Spec 027 開始前應為 47，每 session 後遞減

# 3. 看當前 mock 違規規模（block 18.6 規則涵蓋的）
grep -rEn "vi\.mock\(['\"]@/(repo|service|runtime)/" tests/integration --include="*.test.*" | wc -l
# Spec 027 開始前應為 77，每 session 後遞減
```

---

## 2. Setup pattern reference（S1 pilot 後填）

> S1 完成後把成功的 Option B 改寫骨架抄進這節，S2-S5 直接套用。
> S1 pilot 結束前**留空**，pilot 是發現 pattern 的過程。

### 2.1 標準 mock 骨架（Pending — S1 will fill）

```js
// TODO（S1 pilot 後）：填入經驗證的標準頭部
// - vi.hoisted({ mockShowToast, mockAuthContext, ... })
// - vi.mock('next/navigation', ...)
// - vi.mock('@/runtime/providers/AuthProvider', ...)
// - vi.mock('@/runtime/providers/ToastProvider', ...)
// - vi.mock('@/config/client/firebase-client', ...)
// - vi.mock('firebase/firestore', () => ({ ... 完整 export 列表 ... }))
// - 不 mock @/runtime/client/use-cases/*（讓 use-case 真實執行）
```

### 2.2 firebase/firestore mock 完整 export 清單（Pending — S1 will fill）

> 漏一個 export → use-case 真執行時 ReferenceError。S1 跑通後完整清單抄這。
> 起點清單（既有測試已用的）：
> `getDoc, getDocs, addDoc, updateDoc, deleteDoc, runTransaction, query, where, orderBy, limit, startAfter, collection, collectionGroup, doc, serverTimestamp, increment, writeBatch, documentId`
> S1 pilot 跑時若補了任何 export，更新此清單。

### 2.3 Firestore document stub shape（Pending — S1 will fill）

```js
// TODO（S1 pilot 後）：填入 getDoc / getDocs 的 mockResolvedValue 標準形狀
// 例：getDoc.mockResolvedValue({ exists: () => true, data: () => ({...}) })
// 例：getDocs.mockResolvedValue({ docs: [{ id, data: () => ({...}) }], size: N })
```

### 2.4 runTransaction / writeBatch stub 寫法（Pending — S1 will fill）

```js
// TODO（S1 pilot 後）：若 pilot 涵蓋 transaction/batch，填入 stub 模式
```

---

## 3. Per-session 操作 SOP（plan §4.3 再強化）

### 3.1 改寫單檔的標準 8 步

1. **盤點**：`grep -nE "vi\.mock\(['\"]@/" <file>` 列出所有 internal mock，標記違規（`@/{repo,service,runtime}/`）vs 合規
2. **追溯**：grep 違規 mock 對應的 `vi.fn()` exports 在測試裡如何被 `mockResolvedValue` / `mockReturnValue` — 那是「行為控制點」，改寫後要把控制移到 SDK 層
3. **改寫**：拿掉違規 `vi.mock`，改 mock `firebase/firestore`（已存在通常已 mock）；用 `getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({...}) })` 取代 `getPostDetail.mockResolvedValueOnce({...})`
4. **跑單檔測試**：`npx vitest run <file>`
5. **跑單檔 lint**：`npx eslint <file>` — 確認 mock-boundary 規則對該檔 fire 但 0 violations
6. **從 baseline 拿掉**：`eslint.config.mjs` block 18.6 ignores 拿掉該行；該檔同時有 flaky 違規未清 → 加進 18.5 ignores
7. **再跑全 lint**：`npm run lint`
8. **commit**：commit message 含 `Baseline change: mock-boundary: X → X-1 (removed: <file>)`

### 3.2 PR 收尾 checklist

- [ ] 該 session 所有檔都跑過單檔 vitest + 單檔 eslint
- [ ] `npm run lint` 全綠
- [ ] `npm run type-check` 全綠
- [ ] `npm run test:branch` 全綠
- [ ] `npm run test:coverage` 跑一次，數字記在 PR description（理論不下降）
- [ ] `eslint.config.mjs` block 18.6 ignores 數字實際下降，PR description 紀錄 `47 → N` 起訖
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

### S1 坑紀錄

> （S1 完成時填）撞到的、解掉的、留待下個 session 注意的。

### S2 坑紀錄

### S3 坑紀錄

### S4 坑紀錄

### S5 坑紀錄

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

- `feedback_mock_discipline.md` — **S5 完成後**評估是否更新（baseline drain 完成的證據）
- `feedback_test_writing_gotchas.md` — 撞到的具體 SDK stub 坑可考慮新增到此 memory
- `project_harness_mock_audit.md` — D2/E 章節相關，本 spec 完成後可加一句進度
- `feedback_audit_deliverable_only.md` — 本 spec 即「audit deliverable → 行動 spec」的範例，**不要**在本 spec 又自動延伸做 P1+

---

## 9. session 接棒 quick template

> 每結束一個 session，把下面複製到下個 session 的「起步」段：

```
# Session SX 起步

- 上次（S{X-1}）完成：<commit hash> / PR #<n>
- 上次 baseline：<33 → N>，本 session 目標：<N → M>
- 上次 setup pattern 已固化在 §2 — **本 session 直接套**
- 上次撞的坑：<bullet from §5>
- 待解 Cross-cutting questions（§7）：<list>
- Option A 個案累計：<count>，目前已避開
- 你接到的範圍：<plan §5 SX 區塊>
```
