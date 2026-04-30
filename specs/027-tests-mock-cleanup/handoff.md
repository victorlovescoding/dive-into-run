# 027 — Handoff（session-to-session 接棒筆記）

> **用途**：每個 session 開工前必讀；結束時更新。
> **Plan**: `specs/027-tests-mock-cleanup/plan.md`
> **Audit source**: `project-health/2026-04-29-tests-audit-report.md` §2 P0-1

---

## 0. 進度看板

| Session | 狀態           | Branch | PR  | Commit | Baseline 變化                                                                                  |
| ------- | -------------- | ------ | --- | ------ | ---------------------------------------------------------------------------------------------- |
| —       | —              | —      | —   | —      | **18.6=47（spec 026 既有）/ 18.7=0 / 18.8=0（spec 027 開始前）**                               |
| S0      | ⏳ Not started | —      | —   | —      | 修 selector bug + 擴規則 → 18.6: 47→55（+8 新加）/ 18.7: 0→14（new）/ 18.8: 0→5（new）         |
| S1      | ⏳ Not started | —      | —   | —      | 18.6: 55 → 50（posts heavy / pilot — 5 檔/10 violations）                                      |
| S2      | ⏳ Not started | —      | —   | —      | 18.6: 50 → 36（posts rest + comments + dashboard + navbar — 14 檔/15 violations）              |
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

---

## 2. Setup pattern reference（S1 pilot 後填）

> S1 完成後把成功的 Option B 改寫骨架抄進這節，S2-S7 直接套用。
> S1 pilot 結束前**留空**，pilot 是發現 pattern 的過程。
> S6 / S7 涉及 unit/lib + unit/api 改寫時可能需要 `firebase-admin/firestore` 額外 mock 樣板 — S6 / S7 結束時補進 §2.5 / §2.6。

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

1. **盤點**：`grep -nE "vi\.mock\(['\"]@/" <file>` 列出所有 internal mock，標記違規（依該 session 對應 batch 的 selector）vs 合規
2. **追溯**：grep 違規 mock 對應的 `vi.fn()` exports 在測試裡如何被 `mockResolvedValue` / `mockReturnValue` — 那是「行為控制點」，改寫後要把控制移到 SDK 層
3. **改寫**：拿掉違規 `vi.mock`，改 mock SDK：
   - 第一+二批（client integration / unit/runtime）→ mock `firebase/firestore`
   - 第三批（unit/lib）→ mock `firebase/firestore`（lib facade 大多走 client SDK）
   - 第四批（unit/api server route）→ mock `firebase-admin/firestore`
   - 散落（unit/service+repo）→ 看實際 import 決定 client 或 admin SDK
4. **跑單檔測試**：`npx vitest run <file>`
5. **跑單檔 lint**：`npx eslint <file>` — 確認規則 fire 但 0 violations
6. **從 baseline 拿掉**：依該檔所在 batch 找對應 ESLint block：
   - `tests/integration/**` → block 18.6 ignores
   - `tests/unit/runtime/**` / `tests/unit/api/**` / `tests/unit/service/**` / `tests/unit/repo/**` → block 18.7 ignores
   - `tests/unit/lib/**` → block 18.8 ignores
   - 該檔同時有 flaky 違規未清 → 加進 18.5 ignores
7. **再跑全 lint**：`npm run lint`
8. **commit**：commit message 含 `Baseline change: <block>: X → X-1 (removed: <file>)`（block 用 `18.6` / `18.7` / `18.8`）

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

> S0 是規則擴展前置，預期可能撞：
>
> - **selector 排除 providers** — esquery 對 negative lookahead `(?!providers)` 支援未驗。若 string-literal selector 失敗，fallback 為「兩條 positive selector」（`@/(lib|repo|service)/` + `@/runtime/(client|server|hooks)/`）；template-literal selector 同理
> - block 18.6/18.7/18.8 的 `files:` glob overlap → flat-config last-write-wins 規則覆蓋（仿 spec 026 block 18.6 的 combined 規則模式）
> - 18.7 涵蓋多目錄（runtime + api + service + repo）— 用 single block + `files: ['tests/unit/{runtime,api,service,repo}/**/*.test.{js,jsx,mjs}']`
> - **8 個新 baseline 檔**（spec 026 selector bug 漏攔的）：PostCard / DashboardCommentCard / DashboardEventCard / DashboardPostCard / Navbar / isActivePath / RunsRouteMap / RunsActivityCard — S0 commit 含這 8 檔加進 18.6 ignores
> - **3 個檔角色變化**：NavbarMobile / NavbarDesktop / BioEditor 原為 flaky-only overlap，selector 擴大後新增 mock-boundary 違規 → 仍在 18.6 ignores 但角色從 flaky-only 變雙重

### S1 坑紀錄

> （S1 完成時填）撞到的、解掉的、留待下個 session 注意的。

### S2 坑紀錄

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
