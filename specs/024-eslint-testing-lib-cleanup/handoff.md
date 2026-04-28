# Handoff Notes — 024 ESLint Testing-Library Cleanup

> **目的**：跨 session / 跨 implementer 的接力簿。記錄已驗事實、踩過的坑、下一步該注意什麼。
> **更新規則**：每個 session 結束前必加一段；不刪舊紀錄（會變得難 trace）；只在事實過時時改原段落並標 `~~舊事實~~ → 新事實 (YYYY-MM-DD)`。

---

## 0. 入門 30 秒（最新狀態給下個接手者讀）

| Field           | Value                                                                                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch          | `024-eslint-testing-lib-cleanup`                                                                                                                                                                                                                                                                      |
| Worktree path   | `/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`                                                                                                                                                                                                                               |
| 目前 Session    | **Session 6 規劃完成；下一 session 接 S6 execution（T30 preflight → T31 affordance → T32/T33/T34 並行 → T35 closeout）**                                                                                                                                                                              |
| Working tree    | S6 規劃 commit 完成後，主 agent 把 `eslint.config.mjs` line 396 `'testing-library/no-node-access'` 從 `off` 恢復成 `error`（commit bridge）。下一 session 接手前 fresh `git status --short` 預期只看到 `M eslint.config.mjs`。接手仍以 fresh `git status --short` 為準，不要沿用舊 dirty list。       |
| ESLint plugin   | 已裝 (eslint-plugin-testing-library@^7.16.2)                                                                                                                                                                                                                                                          |
| Sensors         | `testing-library/prefer-user-event` 維持 `error`（line 395）；`testing-library/no-node-access` 規劃 commit 期間短暫 `off`、commit 後立即恢復 `error`（line 396）。用戶 prompt 寫 `eslint.config.mjs:395` 但實際 `no-node-access` 在 line 396，line 395 是 `prefer-user-event` — 詳 §2.37 line drift。 |
| Repo lint state | S5 target lint 已通過。S6 baseline：`NotificationPanel.test.jsx` raw 4 / 2 unique unreadDot、`notification-click.test.jsx` raw 2 / 2 unique unreadDot、`scroll-to-comment.test.jsx` raw 2 / 1 unique mock-internal `getElementById`。repo-wide lint 仍可能因 S6-S8 domain fail，不可寫成全綠。        |
| Commit 計畫     | S6 規劃 commit 由主 agent 在 commit bridge 內完成（暫關 `no-node-access` → commit `tasks.md` / `handoff.md` / `eslint.config.mjs` → 立即恢復 `error`）。S6 execution（T30-T35）所有 task 都不 commit / push，與前面 sessions 同 pattern。                                                             |

接手前必讀：

1. 本檔 §2 **坑清單**（特別是 §2.28–§2.37：S5 closeout dirty attribution / tee pipe / line drift / S6 boundary、以及 S6 規劃新增的 §2.32–§2.37：unreadDot 雙屬性、scroll-to-comment helper、`baseElement` 移除、`within(panel)` 模式、helper ignore 不是 escape hatch、line 395 vs 396 drift）
2. 本檔 §4 「Session 5（NavbarDesktop + NotificationBell SVG）— 完成」+「Session 6 規劃 — 完成」兩段
3. 本檔 §5 S6 execution checklist；S6 只接 NotificationPanel unreadDot + notification-click + scroll-to-comment，不回頭改 S5 scope；S7 之後再處理 profile / weather / posts / toast / strava

---

## 1. 已驗事實（避免重做 verify 工作）

### 1.1 `eslint.config.mjs` 結構（2026-04-28 實測）

| 內容                                                                                   | 行號         |
| -------------------------------------------------------------------------------------- | ------------ |
| 檔案總行數                                                                             | 411          |
| Import 區塊                                                                            | line 1–17    |
| `__filename = fileURLToPath(...)` 宣告                                                 | line 19      |
| §9 type-aware linting block 開頭 (`// 9. Type-aware linting...`)                       | line 242     |
| §9 `plugins: { '@typescript-eslint': tsPlugin }` 行                                    | line 254     |
| §9 `'@typescript-eslint/no-deprecated': 'error'` 行（**T2 插入點之上**）               | line 256     |
| §9 block 結尾 `},`                                                                     | line 258     |
| §17 (no-restricted-disable) block                                                      | line 358–367 |
| §18 (測試檔嚴格規範) 開頭 (`// 18. 針對測試檔案的嚴格規範`) **T2 Change 3 插入點之前** | line 369     |
| §19 (file size limits)                                                                 | line 403     |

> Plan §4.2 寫的「line 254-257」「line 369 前」**全部與實測一致**。Engineer 不需要再 verify。

### 1.2 套件安裝狀態（2026-04-28 實測）

| 套件                               | 狀態                            |
| ---------------------------------- | ------------------------------- |
| `eslint-plugin-testing-library`    | 已裝 (^7.16.2, devDep)          |
| `@testing-library/user-event`      | 已裝 (^14.6.1, devDep)          |
| `@testing-library/react`           | 已裝（用作 testing 主庫）       |
| `@typescript-eslint/eslint-plugin` | 已裝（line 11 import 已 wired） |

### 1.3 NavbarMobile 重大 hotspot（plan Appendix A）

```bash
grep -c "document.getElementById('mobile-drawer')" tests/integration/navbar/NavbarMobile.test.jsx
# 預期 ≥ 17
```

T4 audit 完後在 §3 baseline audit 章節記錄實際數字。如果 < 17 → Appendix A grep regex 漏抓，更新 plan。

---

## 2. 坑清單（從 plan §5 + §6 + Session 2/3/4/5 萃取，先警告再執行）

### 2.1 ⚠️ 坑 1：T2 commit 後 `npm run lint` 會 fail repo-wide

- **原因**：T2 改完 config，`eslint-plugin-testing-library` rule 全開，立刻會抓 ~303 處先存在違規。
- **症狀**：之後在 worktree 內任何 `git commit` 都會被 husky pre-commit gate 擋下（lint step fail）。
- **2026-04-28 更新**：下列原策略已被 §2.13 取代；Session 1/2 可先 commit，因為只暫關未輪到且目前仍會擋 gate 的兩條 rule。
- **對策**：
  - ~~**Session 1–8 全部不 commit**。所有改動累積在 working tree，Session 9 才 commit。~~ → 已被 2026-04-28 增量 commit gate 決策取代，詳 §2.13。
  - 若中途必須切 branch / 暫離 → `git stash push -m "WIP: 024 cleanup after S<N>"`，回來 `git stash pop`。
  - 本 024 cleanup 執行期明確禁止 `git commit --no-verify`；不要用 bypass commit 切 task 邊界。

### 2.2 ⚠️ 坑 2：T3 sanity 檔 不能漏刪

- **原因**：sanity 檔故意違反全部三條 rule 給 ESLint 抓，**不能 commit、不能進 git**。
- **症狀**：忘記刪 → 之後任何 lint 都會抓到這檔的 4 條 violation，混淆 baseline audit (T4) 數字、且 git status 會看到。
- **對策**：T3 Engineer 完成後**自己** `rm`；T3 Reviewer **再驗** `ls tests/_sanity-eslint.test.jsx` 不存在。雙保險。

### 2.3 ⚠️ 坑 3：T4 audit 數字「過低」也是警訊

- **原因**：plan §5 Task 1.4 對齊基準寫得從嚴：
  - 實測 < grep snapshot → grep regex 有錯（不阻塞）
  - 實測 > §3.1 估算 +20% → escalate 給用戶
  - **漏掉的情境**：實測 ≪ §3.1 估算（差 50% 以上） → 可能 sensor 沒真的 fire（T2 順序錯 / config block 沒進到第 18 條之前 / spread 寫錯）
- **對策**：T4 Reviewer 收到「異常低」也要 escalate，不能只看「異常高」。下界線：
  - `prefer-screen-queries` ≥ 100（187 的 ~50%）
  - `no-node-access` ≥ 43（Appendix A 下限）
  - `prefer-user-event` 必須 = 8（grep 已 100% 確認）

### 2.4 ⚠️ 坑 4：testing-library config 必須在 §18 **之前**（plan §4.2 註解）

- **原因**：§18 已 override `jsdoc/require-jsdoc`、`no-console` 等規則。若 testing-library config 放在 §18 **之後**，會反向覆蓋 §18 的設定，把測試檔的既有 override 弄掉。
- **症狀**：測試檔的 `no-console` / `jsdoc` 行為突然改變、或測試 lint 突然多一堆無關 violation。
- **對策**：T2 Change 3 必須插在 line 369 (`// 18.`) 之前；T2 Reviewer 用 `grep -n` 對照行號順序。

### 2.5 ⚠️ 坑 5：T3 sanity content 不夠完整（plan §5 Task 1.3 的版本只能觸發 3/4 條 rule）

- **原因**：plan 給的 sanity content 用 `document.createElement('div')` 自建 container，但 `testing-library/no-container` 只會對 `render()` 解構出的 `container` 屬性 fire，因此原版 sanity 觸發不了 `no-container`。
- **症狀**：sanity 跑 ESLint 只有 3 條 rule fire（`ban-ts-comment` / `no-node-access` / `prefer-user-event`），錯誤地讓人以為 T2 config 沒啟用 `no-container`。
- **對策**：T3 sanity 必須加上 render 解構分支，最終 sanity 內容應為（兩個 `it` block）：

  ```jsx
  // @ts-ignore
  import { fireEvent, render } from '@testing-library/react';

  describe('sanity', () => {
    it('should trigger ban-ts-comment / no-node-access / prefer-user-event', () => {
      const container = document.createElement('div');
      const x = container.querySelector('.foo');
      fireEvent.click(x);
    });

    it('should trigger no-container via render destructure', () => {
      const { container } = render(<div />);
      const node = container.querySelector('.bar');
      return node;
    });
  });
  ```

- **延伸**：plan §5 Task 1.3 的 sanity content 可以視為過時，未來重做 sanity 應參考 handoff.md 此處的版本。

### 2.6 ⚠️ 坑 6：`prefer-user-event` baseline drift — 預期 8，實測 7

- **原因**：plan §3.1 寫「`prefer-user-event` 必 = 8（grep 已 100% 確認）」，但 T4 跑 `npx eslint src specs tests` 實測只抓到 7。Sensor 本身正確 fire（T3 已驗），這是 plan grep 估算與 ESLint 實際偵測之間的方法論誤差，不是 config bug。
- **實際 7 個違規檔案分佈**：
  - `tests/integration/posts/PostCard.test.jsx` — 5 處
  - `tests/integration/notifications/NotificationToast.test.jsx` — 1 處（line 141）
  - `tests/integration/notifications/NotificationPaginationStateful.test.jsx` — 1 處（line 419，緊鄰 line 416 的 `no-unnecessary-act`）
- **決策**：主 agent 接受 7 為新 baseline。Session 2+ 清理時範圍 = 7，不要找第 8 處。
- **延伸觀察**：`NotificationPaginationStateful.test.jsx` 的 line 416 + 419 同時觸發 `no-unnecessary-act` 與 `prefer-user-event`，疑似 `act(() => fireEvent.click(...))` 樣式，未來修這 1 處可能同時消 2 個違規。

### 2.7 ⚠️ 坑 7：執行細節（subagent 易踩）

- **`rm` 絕對路徑被 hook 攔截**：T3 Engineer 用 `/Users/.../tests/_sanity-eslint.test.jsx` 絕對路徑刪檔被 hook 擋，改用相對路徑 `rm tests/_sanity-eslint.test.jsx` 才成功（前提：cwd 在 repo root）。
- **Write 必須先 Read**：對已存在檔案直接 Write 會被 Edit/Write 工具規則擋下，須先 Read 再 Write。標準 Claude Code 約束，提醒未來 Engineer。
- **eslint.config.mjs 章節編號斷層**：檔案內 §15 直接跳到 §18（無 §16/§17 區段），是檔案原本就有的結構。新加的 testing-library block 命名為 §17.5 以順利塞進 §18 之前。

### 2.8 ⚠️ 坑 8：`prefer-screen-queries` **沒有 autofix**（plan §5 line 272 錯誤假設）

- **plan 的錯誤假設**：plan §5 Task 2.1 line 272 寫「經驗：`prefer-screen-queries` 大部分（>90%）autofix 可解」。
- **實測（Session 2 T5）**：跑 `npx eslint tests --fix --rule '{"testing-library/prefer-screen-queries": "error"}'` 改了 **0 個檔**；`--fix-dry-run --format json` 統計 `fixable: 0, unfixable: 187`。
- **根本原因**：`testing-library/eslint-plugin-testing-library` 的 `prefer-screen-queries` rule **不是 fixable rule**（官方 docs 未列 autofix flag）。Plan 的假設是錯的。
- **影響**：
  - Phase 2 「機械批次 1-2 hr」嚴重低估，因為 87% (187/216) 的 Phase 2 違規來自這條 rule、且全要人工
  - T5 task spec 原本依賴「autofix → grep 漏網」兩步，現在改為「全手工 grep + Edit 修復」一步
- **修正後策略**（已落地進 tasks.md T5 v2）：
  1. `grep -rln 'const \{ [^}]*By' tests/` 找出有 destructured query 的檔
  2. 逐檔 Edit：`const { getByX } = render(...)` → `render(...)`，後續 callsite `getByX(...)` → `screen.getByX(...)`
  3. 處理 `getByX(container, ...)` 形式：依 context 改 `within(container).getByX(...)` 或 `screen.getByX(...)`
  4. 跑 vitest 確認沒改壞
- **教訓**：plan 寫的「autofix 可解」之類經驗值要在 T1 sanity check 階段就驗證，不要拖到 T5 才發現。後續類似 plugin（`eslint-plugin-jest-dom`、`eslint-plugin-jsx-a11y` 等）若用 autofix 假設，先用 `--fix-dry-run --format json` 確認 fixable 數。

### 2.9 ⚠️ 坑 9：Dirty files 不能直接歸因給最後一個 task

- **發生在**：Session 2 T8/T9 review + T10 handoff。
- **原因**：Phase 1 起就刻意不在中途 commit；T5-T9 改動全部累積在同一個 working tree。本任務明確禁止 `git commit --no-verify`，所以不能用 bypass commit 把每個 task 切開。
- **症狀**：`git status --short` 會同時看到 Session 1 config/package/doc 改動與 T5-T9 多個 test 檔改動。T8/T9 reviewer 若只看 dirty file list，容易把既有 dirty files 錯歸因給當前 task。
- **對策**：review 要依 rule evidence + diff context 判斷 scope，不用 dirty file list 單獨歸因。T8 實際 no-container diff 包含 `NavbarDesktop.test.jsx`、`NotificationPanel.test.jsx`、`scroll-to-comment.test.jsx`、`PostFeed.test.jsx`、`ProfileEventList.test.jsx`；其他 dirty files 不應自動算成 T8。

### 2.10 ⚠️ 坑 10：T8 `baseElement.querySelector(...)` 是刻意策略，不是倒退

- **發生在**：Session 2 T8。
- **原因**：有些測試目標是無語意節點、布局節點或 `aria-hidden` DOM；硬改成 `screen` / role query 會扭曲測試語意。
- **策略**：用 `baseElement.querySelector(...)` 可以消 `testing-library/no-container`，但仍可能保留 `testing-library/no-node-access`。
- **對策**：這不是 T8 regression。Phase 4 處理 `no-node-access` 時再決定是否要改測試設計、補語意 affordance，或保留少數 DOM access 的例外路線。

### 2.11 ⚠️ 坑 11：T9 移除 unnecessary act 時，每個 user interaction 都要 await

- **發生在**：Session 2 T9。
- **原因**：把 `await act(async () => { fireEvent.click(...) })` 改成 `user.click(...)` 時，如果少 `await` 或沿用舊 query reference，會弱化 timing，甚至讓狀態更新 race。
- **正確做法**：改成 sequential `await user.click(...)`；每次 click 後依畫面狀態重新 query 需要的節點。T9 本輪同時移除 `fireEvent` import，並順手把 `NotificationPaginationStateful.test.jsx` line 419 的 `prefer-user-event` 消掉，讓全 repo `prefer-user-event` 從 7 降到 6。

### 2.12 ⚠️ 坑 12：T9/T10 fallback 測試不能用 19 次 `user.click` 硬推狀態

- **發生在**：Session 2 T10 refresh 前的 blocker 修復。
- **根因**：`NotificationPaginationStateful.test.jsx` fallback test 用大量 sequential `user.click` 推 pagination 狀態；完整 `npm run test:browser` 中 19 次 click 會拖到 15000ms timeout。
- **修法**：新增 `NotificationContextProbe`，從真實 provider context 呼叫 `loadMore()` 直接推到 capacity，再用 button 觸發 server fallback 分支。
- **對策**：不要退回 `fireEvent` 來繞過 timing；保留 `userEvent` 驗證使用者觸發 fallback 的最後一步，狀態準備交給真實 provider context。

### 2.13 ⚠️ 坑 13：增量 commit gate 策略（2026-04-28 決策）

- **決策**：不是「不相關就關」。只有「不相關且目前會擋 Session 1/2 commit gate」才暫關。
- **Session 1/2 commit 時曾暫關兩條**：
  - `testing-library/no-node-access`: 83 baseline violations，Phase 4 尚未輪到
  - `testing-library/prefer-user-event`: 6 baseline violations，Session 3 尚未輪到
- **2026-04-28 Session 3 開工前更新**：`testing-library/prefer-user-event` 已恢復 `error`，只剩 `testing-library/no-node-access` 繼續暫關。
- **保留 error 的已完成 rules**：`@typescript-eslint/ban-ts-comment`、`testing-library/prefer-screen-queries`、`testing-library/render-result-naming-convention`、`testing-library/no-container`、`testing-library/no-unnecessary-act`。
- **保留 flat/react 預設 rules**：其他不相關但目前不報錯的 `testingLibrary.configs['flat/react'].rules` 繼續留著，不主動關。
- **恢復點**：`testing-library/prefer-user-event` 已先恢復 `error`，Session 3 清完後只需確認維持 error；Phase 4 清完 `no-node-access` 後，把 `testing-library/no-node-access` 改回 `error`。

### 2.14 ⚠️ 坑 14：Session 3 `prefer-user-event` count 與 `fireEvent` reference count 不同

- **最新現況**：Session 2 已提交在 `a74ca72` 後，`testing-library/prefer-user-event` 已為 Session 3 恢復 `error`；實測目前會報 **6 errors**：`PostCard.test.jsx` 5 + `NotificationToast.test.jsx` 1。
- **同時仍有 8 個可執行 `fireEvent` 用法**：
  - `PostCard.test.jsx`：5 `fireEvent.click`
  - `NotificationToast.test.jsx`：1 `fireEvent.click`
  - `ComposeModal.test.jsx`：1 generic `fireEvent(dialog, cancelEvent)`
  - `NotificationPanel.test.jsx`：1 `fireEvent.error(img)`
- **raw grep 注意**：`grep -rn "fireEvent" tests/integration/` 目前也會列出 import/comment 行；Session 3 目標是最後 raw grep 0 references。
- **2026-04-28 文件規劃補充**：基本檢查時 raw grep 另外命中多個非目標檔的 comment-only guideline（例如 `NEVER fireEvent`）。這些不是 8 個 event migration callsite；T11 必須重新列出並交主 agent 做 scope decision，不能讓 Engineer 直接偷改未授權檔。
- **原因**：`prefer-user-event` rule 只報應改成 `userEvent` 的使用者互動 click；`ComposeModal` 的 `<dialog>` cancel event 與 `NotificationPanel` 的 img error 屬於 DOM-event-only hygiene / plan 目標，應改 native `dispatchEvent`，不一定被 `prefer-user-event` 報出。
- **處理策略**：Session 3 不只清 6 個 lint errors，也要清 8 個可執行 `fireEvent` 用法。若仍要求 `grep -rn "fireEvent" tests/integration/` 到 0，必須在 T11 先處理 comment-only hits 的 scope decision。不要因為 ComposeModal / NotificationPanel 沒被 rule 報錯就跳過。
- **T16 gate**：清完後確認 `testing-library/prefer-user-event` 維持 `error`，保留 `testing-library/no-node-access` `off`；repo-wide lint 預期只剩 `no-node-access` 83 errors。

### 2.15 ⚠️ 坑 15：T13 fake timers + `userEvent.click` 會 deadlock

- **發生在**：Session 3 T13 `NotificationToast.test.jsx`。
- **根因**：fake timers 環境中直接 `await user.click(...)` 可能卡住；`user-event` 內部排程需要 timer flush，測試若先 await click 會等不到後續 advancement。
- **修法**：建立 `clickPromise = user.click(...)`，再 `await vi.advanceTimersByTimeAsync(0)` flush micro/timer queue，最後 `await clickPromise`。
- **對策**：Phase 4 若碰到 fake timers + user interactions，照這個 sequencing，不要退回 low-level event helper。

### 2.16 ⚠️ 坑 16：T15 native img error 需要 async + `waitFor` flush

- **發生在**：Session 3 T15 `NotificationPanel.test.jsx`。
- **根因**：改成 native `img.dispatchEvent(new Event('error'))` 後，React state update / fallback image render 不是同步可斷言；直接 assert 容易 race。
- **修法**：用 async test flow 並搭配 `waitFor(...)` 等 fallback state flush。
- **對策**：Phase 4 若把 DOM event 改成 native dispatch，斷言要跟 React update boundary 對齊。

### 2.17 ⚠️ 坑 17：T16 raw grep 0 會被 comment-only guideline 擋

- **發生在**：Session 3 T16 closeout。
- **根因**：`grep -rn "fireEvent" tests/integration/` 不只抓 executable usage，也抓檔頭 guideline 註解，例如 `NEVER fireEvent`。
- **修法**：只改註解文字成不含 literal 的等價 guideline（例如 `NEVER low-level event helpers`），不得改測試邏輯。
- **本輪實測**：7 個 comment-only 檔案已改寫；`grep -rn "fireEvent" tests/integration/` exit 1 且無輸出。

### 2.18 ⚠️ 坑 18：MobileDrawer dialog a11y 已存在，不要重複加

- **發生在**：Session 4 planning preflight。
- **已驗事實**：`src/components/Navbar/MobileDrawer.jsx` 目前已有 `id="mobile-drawer"`、`role="dialog"`、`aria-modal="true"`、`aria-label="導覽選單"`。
- **風險**：plan §8.2 原本把 S4 描述成「MobileDrawer 加 `role="dialog"` / a11y label」的重型 component refactor；這已經過時。若 Engineer 盲目再加 role/label，可能改壞既有語意或造成測試重複查詢。
- **對策**：Session 4 不應要求「加 dialog」。主要工作是改 `NavbarMobile.test.jsx` 的查詢方式：`screen.getByRole('dialog', { name: '導覽選單' })`、`within(drawer)`、jest-dom matcher。必要 component affordance 只限 overlay / hamburger line 的穩定 test hooks。

### 2.19 ⚠️ 坑 19：`no-node-access` raw count 會 duplicated，進度看 unique line:col / target range

- **發生在**：Session 4 planning preflight。
- **已驗事實**：`npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish` 目前 exit 1，顯示 raw 42 個 `testing-library/no-node-access` errors，但實際是 22 個 unique `line:column` sites。
- **根因**：同一 callsite 可能因 rule traversal 對同 loc 重複報錯；raw problem count 不是獨立修點數。
- **對策**：Reviewer 驗收 T19-T22 時要用 unique `line:column` / target range 判斷進度，不要只看 raw problem count。每個 task 的 reviewer report 必須列 remaining unique sites。

### 2.20 ⚠️ 坑 20：`no-node-access` 打開後 repo-wide lint 會因剩餘 domain fail，S4 不要關 rule 或跨 scope 修

- **發生在**：前置 config Engineer 已把 `testing-library/no-node-access` 改回 `error` 且 Reviewer PASS 後。
- **影響**：Session 3 的「repo-wide lint exit 0」已不再成立。S4 完成後，`NavbarMobile.test.jsx` 應該 0 `no-node-access`，但 repo-wide lint 仍可能因 S5-S8 domain（NavbarDesktop、notifications、posts/profile/weather/toast/strava 等）失敗。
- **對策**：S4 closeout 不要求 repo-wide lint 全綠，只要求：
  - `npx eslint tests/integration/navbar/NavbarMobile.test.jsx` exit 0
  - `npx eslint src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx tests/integration/navbar/NavbarMobile.test.jsx` exit 0
  - `npx vitest run tests/integration/navbar/NavbarMobile.test.jsx` pass
- **禁止**：不要把 rule 關回 `off`、不要加 eslint disable、不要為了 commit/gate 偷修 S5-S8 domain。

### 2.21 ⚠️ 坑 21：T18 test affordance 是實際必要，不是多餘測試噪音

- **發生在**：Session 4 T18。
- **已驗事實**：為了清掉 NavbarMobile 的 DOM traversal，`Navbar.jsx` 的 hamburger line 需要穩定 hook（`data-testid="hamburger-line"` + `aria-hidden="true"`），`MobileDrawer.jsx` 的 overlay 也需要 `data-testid="mobile-drawer-overlay"`。
- **原因**：hamburger line / overlay 本身不是適合用 role/name 查詢的互動目標；硬用 `children` / `querySelector` 會重新觸發 `testing-library/no-node-access`。
- **對策**：後續 reviewer 不要把這兩個 affordance 當成可刪的「test-only noise」。若 S5 需要類似 affordance，先證明語意查詢不可用，再補最小穩定 hook。

### 2.22 ⚠️ 坑 22：T19-T22 後 line number drift，reviewer 要看 current lint unique sites

- **發生在**：Session 4 T19-T22 分段 cleanup。
- **原因**：每輪把 DOM traversal 改成 helper / Testing Library query 後，`NavbarMobile.test.jsx` 行號會漂移；沿用 T17 的原始行號會誤判已修區塊還有問題。
- **對策**：Reviewer 要以 fresh `npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish` 的 current output、unique `line:column`、test name / target range 為準，不要死背 planning preflight 的原行號。

### 2.23 ⚠️ 坑 23：`document.body.style.overflow` 是允許的非 `no-node-access` target

- **發生在**：Session 4 T22 closeout review。
- **已驗事實**：`document.body.style.overflow` 不屬於本輪要清的 Testing Library DOM traversal 目標；它用來驗 body scroll-lock state，不是用 Testing Library result 去取 node。
- **對策**：不要為了「看起來像 document access」把它誤清或改成脆弱替代寫法。除非 fresh lint 實際報 `testing-library/no-node-access` 或測試需求改變，S5 不應碰這類 body style assertion。

### 2.24 ⚠️ 坑 24：S5 的 `NotificationPanel` 描述已過時，unreadDot 留給 S6

- **發生在**：Session 5 planning preflight。
- **已驗事實**：`npx eslint tests/integration/notifications/NotificationBell.test.jsx tests/integration/notifications/NotificationPanel.test.jsx --format stylish` 實測 `NotificationBell.test.jsx` 只有 `bell.querySelector('svg')`；`NotificationPanel.test.jsx` 命中的是 `baseElement.querySelector('[class*="unreadDot"]')` 兩個 unique sites。
- **差異**：plan §8.2 寫「NotificationBell/NotificationPanel SVG」，但 current code/lint 沒有 NotificationPanel SVG 修點。`NotificationPanel` unreadDot 是 plan §8.2 S6 的 testid 類型。
- **對策**：S5 只做 `NotificationBell` SVG；不要因 plan 舊字眼去改 `NotificationPanel.test.jsx` / `NotificationItem.jsx`。S6 再處理 unreadDot。

### 2.25 ⚠️ 坑 25：NavbarDesktop S5 實測是 5 unique sites，不是 plan 舊估 3 處

- **發生在**：Session 5 planning preflight。
- **已驗事實**：`NavbarDesktop.test.jsx` fresh lint raw 7 / 5 unique `line:col`：
  - `159:36` skeleton class query（duplicated raw）
  - `210:29` fallback SVG query（duplicated raw）
  - `327:23`, `342:23`, `357:23` 三個 `document.activeElement`
- **對策**：S5 task 要包含 dropdown focus cleanup，不能只做 skeleton/SVG。Reviewer 看 unique line:col 與 test name，不看 raw count 當修點數。

### 2.26 ⚠️ 坑 26：S5 commit bridge 只暫關 `no-node-access`，commit 後必須恢復 `error`

- **發生在**：Session 5 planning closeout。
- **原因**：規劃文件需要先 commit，但 repo-wide lint 仍有 S5-S8 `no-node-access` baseline violations；為了讓 pre-commit gate 過，會短暫把 `testing-library/no-node-access` 改成 `off`。
- **Line drift**：使用者提到 `eslint.config.mjs:395`，但 current file 實測 line 395 是 `prefer-user-event`；`no-node-access` 在 line 396。修改時要看 rule name，不要只看行號。
- **對策**：
  - 暫關只改 `'testing-library/no-node-access': 'error'` → `'off'`。
  - Commit S5 planning docs 時不要把暫關狀態當成長期策略。
  - Commit 後立刻改回 `'testing-library/no-node-access': 'error'`，讓下一 session 直接用 sensor 做 S5。
  - 不得同時改 comments、其他 ESLint rules、或任何既有 S4 成果。

### 2.27 ⚠️ 坑 27：`handoff.md` 的 dirty list 會漂移，接手一定 fresh `git status`

- **發生在**：Session 5 planning preflight。
- **已驗事實**：只讀 subagent 看到當下 `git status --short` 只有 `M eslint.config.mjs`，而本檔 §0 仍記著 S4 當時多檔 dirty list。
- **對策**：任何新 session 接手都要先跑 `git status --short` / `git diff --name-only`，不要把舊 handoff 的 dirty list 當真相。handoff 記錄是交接脈絡，不是工作樹 current-state sensor。

### 2.28 ⚠️ 坑 28：parallel dirty files 不能直接歸因單一 task

- **發生在**：Session 5 closeout。
- **已驗事實**：T29 開始時 fresh `git status --short` 同時包含 `eslint.config.mjs`、`UserMenu.jsx`、`NotificationBell.jsx`、`NavbarDesktop.test.jsx`、`NotificationBell.test.jsx`。這些是既有 S5 code changes + config bridge，T29 只能新增本檔 diff。
- **對策**：closeout / reviewer 不要看到 dirty file 就倒推是最後一個 task 改壞。用 `git diff --name-only` + task write scope 判斷；T29 的唯一允許新增修改是 `specs/024-eslint-testing-lib-cleanup/handoff.md`。

### 2.29 ⚠️ 坑 29：`tee` pipeline exit code 會誤導 boundary check

- **發生在**：Session 5 T29 boundary check。
- **已驗事實**：`NotificationPanel.test.jsx` 應該維持 fail 給 S6；若直接看 `cmd | tee file` 的 pipeline exit，在某些 shell/設定下可能只看到 `tee` exit 0。
- **對策**：boundary check 用 `zsh -o pipefail -c 'npx eslint ... 2>&1 | tee /tmp/s5-panel-boundary.txt'`，或另跑無 `tee` raw ESLint。T29 兩種方式都確認 exit 1，raw 4 / 2 unique。

### 2.30 ⚠️ 坑 30：T26/T27 edits 後 line number drift，reviewer 要看 current output

- **發生在**：Session 5 T26/T27。
- **已驗事實**：NavbarDesktop 原始 preflight sites 是 raw 7 / 5 unique，但 T26/T27 修改 auth UI 與 focus assertions 後，行號不再能用 planning snapshot 判斷是否清完。
- **對策**：Reviewer 以 fresh `npx eslint tests/integration/navbar/NavbarDesktop.test.jsx --format stylish` 的 current output 為準；T29 已驗 target file exit 0，不再用舊 line 159/210/327/342/357 當現況。

### 2.31 ⚠️ 坑 31：NotificationPanel 仍是 S6 boundary，不是 S5 leftover

- **發生在**：Session 5 T29 boundary check。
- **已驗事實**：`NotificationBell.test.jsx` 已 exit 0；`NotificationPanel.test.jsx` 仍在 line 235:29、245:29 各重複報 `testing-library/no-node-access`，總 raw 4 / 2 unique unreadDot sites。
- **對策**：handoff / closeout 不可寫成 notifications domain 全清。S6 要處理 `NotificationPanel.test.jsx` unreadDot、`notification-click.test.jsx` unreadDot、`scroll-to-comment.test.jsx`。

### 2.32 ⚠️ 坑 32：unreadDot 同時加 `data-testid` + `aria-hidden="true"` 是刻意設計

- **發生在**：Session 6 規劃 T31 affordance design。
- **背景**：`src/components/Notifications/NotificationItem.jsx` line 48 的 `<span className={styles.unreadDot} />` 是純視覺 indicator（藍點），對 a11y tree 應透明；但測試需要穩定的 query hook。
- **設計**：T31 要求同時加 `data-testid="notification-unread-dot"` + `aria-hidden="true"`。兩個屬性是不同軸：
  - `data-testid` 是 testing-library / Playwright 的測試 hook，screen reader 不會看到
  - `aria-hidden="true"` 抑制 a11y tree 對該節點的曝光，避免 screen reader 朗讀「無語意視覺 dot」造成噪音
- **對策**：Reviewer 不要因為「test hook 暴露給測試 = a11y 曝光」就 FAIL — 兩條軸不衝突。若日後類似 case（純視覺 indicator 需 testable）就照這個 pattern。

### 2.33 ⚠️ 坑 33：scroll-to-comment.test.jsx line 34 違規不在測試端，是 mock component 內

- **發生在**：Session 6 規劃 audit。
- **已驗事實**：`tests/integration/notifications/scroll-to-comment.test.jsx` line 34 的 `const el = document.getElementById(commentId);` 出現在檔內 `ScrollTestComponent` mock 的 `useEffect`（line 21–55），不是測試斷言端 query。Mock 模擬的對象是 `src/components/CommentSection.jsx` line 75 的 production scroll 行為。
- **修法分析**：
  - 修法 A（改 component a11y）→ 不適用：違規在 test-internal mock，不是被測 production component
  - 修法 B（within）→ 不適用：違規不是 query 而是 effect 內 DOM lookup
  - 修法 C（data-testid）→ 不適用：違規是 effect 內 `getElementById`，不是測試端 query
- **採用解法**：把 `ScrollTestComponent` 抽到 `tests/_helpers/notifications/scroll-to-comment-mock.jsx`，並在 `eslint.config.mjs` §17.5 testing-library block 的 `ignores` array 加上該精確路徑（precedent：`tests/_helpers/e2e-helpers.js` 已是 ignored helper）。
- **對策**：日後若碰到「test code 內模擬 production effect 行為」的 testing-library 違規，先看是否能在 production 抽出 utility 直接測；不行就抽 helper + 檔案層級 ignore。**不可**改 rule level 為 `off` / `warn`。

### 2.34 ⚠️ 坑 34：T32 NotificationPanel.test.jsx 順手移除 `baseElement` 解構

- **發生在**：Session 6 規劃 T32 設計。
- **背景**：原 code `const { baseElement } = render(...)` + `baseElement.querySelector('[class*="unreadDot"]')` 同時觸發 `no-node-access`；`baseElement` 雖不被 `no-container` 抓（rule 只看 `container`），但語意上多餘。
- **設計**：T32 要求改成 `render(...)` 不解構 + `screen.queryByTestId(...)`，順手清掉 `baseElement` 解構，避免日後其他 reviewer 誤判 `baseElement` 是合法替代品。
- **對策**：S6 後若要動 `NotificationPanel.test.jsx`，不要把 `baseElement` / `container` 解構塞回去。

### 2.35 ⚠️ 坑 35：T33 notification-click.test.jsx 用 `within(panel)` 不是 `panel.queryByTestId`

- **發生在**：Session 6 規劃 T33 設計。
- **背景**：原 code 用 `screen.getByRole('region', { name: '通知面板' })` 取 `panel`，再 `panel.querySelector('[class*="unreadDot"]')`。改用 testid 後不能寫 `panel.queryByTestId(...)`（panel 是 DOM Element，沒有 `queryByTestId` method），必須用 testing-library 的 `within(panel).queryByTestId(...)`。
- **設計**：T33 要求 import `within`（若未 import）並改寫兩處：「在場」用 `within(panel).getByTestId`、「不在場」用 `within(reopenedPanel).queryByTestId`。
- **對策**：之後類似 case（已從 `screen.getByRole` 拿到一個 scope element，再要 query 內部）一律用 `within(scope).getByX`，不要 `scope.queryByX`（後者是 DOM API，會失敗）。

### 2.36 ⚠️ 坑 36：T34 在 ignores 加 helper 路徑不是「打開 escape hatch」

- **發生在**：Session 6 規劃 T34 設計。
- **背景**：plan §2 寫「`prefer-user-event` 不設 `allowedMethods`，rule 直接 `error`」、「`no-node-access` 撞牆**不**退到 Path B」；可能誤解成「testing-library config block 不能加任何 ignores」。
- **已驗事實**：`eslint.config.mjs` §17.5 已有 `ignores: ['tests/e2e/**', 'tests/_helpers/e2e-helpers.js']`，這是檔案層級 scope（哪些檔不被 testing-library plugin lint），與 rule level escape hatch（把 rule 設成 `warn` / `off`）是不同層次。
- **設計**：T34 在現有 ignores 增加 `'tests/_helpers/notifications/scroll-to-comment-mock.jsx'` 一個精確路徑，不改 rule level、不加 broad glob（如 `tests/_helpers/**`）。Helper 仍受其他 ESLint rule（jsdoc / a11y / import / type-aware）覆蓋。
- **對策**：Reviewer 驗 T34 時要看：(a) `'testing-library/no-node-access': 'error'` 仍在；(b) ignores 多的是精確路徑而非 broad glob；(c) helper 自身 lint exit 0；(d) 其他 ignores 沒被改。任一不符 FAIL。

### 2.37 ⚠️ 坑 37：用戶 prompt `eslint.config.mjs:395` 是 line drift，實際 line 396

- **發生在**：Session 6 規劃 commit bridge 設計。
- **已驗事實**：`rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs` 顯示 line 395 是 `'testing-library/prefer-user-event': 'error'`、line 396 才是 `'testing-library/no-node-access': 'error'`。S5 §2.26 已記過同一 drift（用戶當時也說 395，實際 396）。
- **原因**：Session 4 前置 config Engineer 把兩條 rule 都恢復 `error` 時排序為 `prefer-user-event` 在前、`no-node-access` 在後；不同瀏覽 / format 工具呈現的行號可能差 1。
- **對策**：commit bridge 改的是 line 396 的 `no-node-access`，**不要**改 line 395 的 `prefer-user-event`。修改前 `rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs` 確認 rule name 對應的真正行號，**看 rule name 不看行號數字**。

---

## 3. Baseline Audit (Phase 1 Task 1.4)

> Session 1 T4 完成時填入。下面是空 template。

### 3.1 Run metadata

- 執行時間：`2026-04-28T15:26:49+08:00`
- 命令：`npx eslint src specs tests 2>&1 | tee /tmp/eslint-baseline.txt`
- 結果：`✖ 303 problems (303 errors, 0 warnings)`

### 3.2 Per-rule violation counts

| Rule                                              | 預期 (plan §3.1 / Appendix A 下限) | 實測 | Status                                 |
| ------------------------------------------------- | ---------------------------------- | ---- | -------------------------------------- |
| `testing-library/prefer-screen-queries`           | ~187 (容差 ≤ 225, ≥ 100)           | 187  | ✅ in tolerance                        |
| `testing-library/no-node-access`                  | ~89 (容差 ≤ 107, ≥ 43)             | 89   | ✅ in tolerance                        |
| `testing-library/render-result-naming-convention` | ~10 (容差 ≤ 12)                    | 10   | ✅ in tolerance                        |
| `testing-library/no-container`                    | ~9 (容差 ≤ 11, ≥ 7)                | 9    | ✅ in tolerance                        |
| `testing-library/prefer-user-event`               | 8 (必 = 8)                         | 7    | 🟡 accepted（baseline drift, 詳 §2.6） |
| `testing-library/no-unnecessary-act`              | 1 (容差 ≤ 2)                       | 1    | ✅ in tolerance                        |
| `@typescript-eslint/ban-ts-comment`               | 0                                  | 0    | ✅ in tolerance                        |

### 3.3 重大 hotspot 確認

| Hotspot                                                               | 預期數 | 實測 | Status                                                     |
| --------------------------------------------------------------------- | ------ | ---- | ---------------------------------------------------------- |
| `tests/integration/navbar/NavbarMobile.test.jsx` mobile-drawer        | ≥ 17   | 17   | ✅ 符合 Appendix A 下限                                    |
| `tests/integration/posts/PostCard.test.jsx` fireEvent.click           | 5      | 5    | ✅（grep 含 import 行回傳 6，扣掉 import 後實際呼叫 5 次） |
| `tests/integration/notifications/NotificationToast.test.jsx` line 141 | 1      | 1    | ✅ ESLint 抓到 line 141 `prefer-user-event` 1 次           |

### 3.4 與 plan §3.1 差距摘要

- `prefer-screen-queries` 實測 187 / 預期 ~187 / ✅ in tolerance（精確命中估算值）
- `no-node-access` 實測 89 / 預期 ~89 / ✅ in tolerance（精確命中估算值，遠高於 Appendix A 下限 43）
- `render-result-naming-convention` 實測 10 / 預期 ~10 / ✅ in tolerance
- `no-container` 實測 9 / 預期 ~9 / ✅ in tolerance（高於 Appendix A 下限 7）
- `prefer-user-event` 實測 7 / 預期 必 = 8 / 🟡 accepted as new baseline — Plan §3.1 grep 估算 8 與 ESLint 實測 7 之間有 1 個的方法論誤差。詳 §2.6。Session 2+ 清理範圍 = 7（PostCard 5 + NotificationToast 1 + NotificationPaginationStateful 1）。
- `no-unnecessary-act` 實測 1 / 預期 ~1 / ✅ in tolerance（位於 NotificationPaginationStateful.test.jsx line 416）
- `ban-ts-comment` 實測 0 / 預期 0 / ✅ in tolerance（codebase 已乾淨，無 `@ts-ignore` 殘留）
- 全部 problem 總數：303（與 plan §0 預估 ~303 一致）

---

## 4. Session 完成紀錄

> 每個 session 結束時 append 一個小節。

### Session 1（Phase 1）— 完成

- **Started**: 2026-04-28
- **狀態**：✅ 完成（T1-T4 全綠，無 escalate 阻塞）
- **預期完成 deliverables**：
  - [x] `tasks.md` 寫完
  - [x] `handoff.md` 寫完（含本次 §2.5/§2.6/§2.7 坑追加）
  - [x] T1: plugin 安裝 + lockfile 同步（`eslint-plugin-testing-library@^7.16.2`）
  - [x] T2: eslint.config.mjs 三處改動完成（import + ban-ts-comment + §17.5 testing-library block）
  - [x] T3: sanity check 4 條 rule 全 fire（含 `no-container` 用 render 解構驗證，§2.5 已記）
  - [x] T4: baseline audit 填入 §3（303 problems, 7/7 rules counted；prefer-user-event 7 vs 預期 8 → 接受為新 baseline，§2.6 / §3.4 已標 🟡 accepted）
- **未完成 / blocker**：無。可進 Session 2。
- **本次 subagent 用量**：8 次 Agent 呼叫（T1×2 + T2×2 + T3×2 + T4×2，無重派）+ 1 次 SendMessage（T3 Engineer 擴充 sanity 驗證 no-container）。Plan §0 估算 first-pass 全綠 = 8 次，實際剛好命中。
- **commit 狀態**：未 commit（歷史原因：當時依 plan 設計 Session 9 才一起 commit/push；此策略已被 2026-04-28 §2.13 取代）

### Session 2 規劃 + escalation 處理（Phase 2 task spec 重寫）— 完成

> **重要**：本段不是 Session 2「實作完成」紀錄，而是「**規劃 + escalation 處理**」紀錄。Session 2 實作（執行 T5–T10）尚未開始，由下一 session 接手。

- **Started**: 2026-04-28（接 Session 1）
- **狀態**：✅ 規劃完成 + escalation 處理完成；⏳ 實作（T5-T10）未開工
- **本次 conversation 做了什麼**：
  1. 規劃 Session 2 task 拆分（T5-T10）並寫進 `tasks.md`（並行度 = 1、every task 含 Engineer + Reviewer SOP、總 subagent 數估 12 次）
  2. 派出 T5 Engineer（general-purpose）按 plan §5 Task 2.1 跑 `npx eslint tests --fix --rule '{...prefer-screen-queries: "error"}'`
  3. **T5 Engineer escalate 重大發現**：plan §5 line 272 假設「prefer-screen-queries autofix >90% 可解」**完全錯誤** — 實測 autofix 改 0 處，dry-run JSON 顯示 `fixable: 0, unfixable: 187`。`testing-library/eslint-plugin-testing-library` 的 prefer-screen-queries rule **不是 fixable rule**（官方 docs 未列 autofix flag）
  4. 主 agent 接收 escalation、處理：
     - 寫入 §2.8 坑（autofix 假設失效 + 修正後策略）
     - 重寫 `tasks.md` T5 spec：autofix 路線 → 全手工 destructured query pattern（187 → ≤ 50；分批接續策略）
     - 重寫 `tasks.md` T6 spec：原「漏網之魚」→ 改為「scoped query pattern + T5 漏網收尾」（殘留 → 0）
     - 更新 Session 2 Goal：1-2 hr → **2.5-3.5 hr**（反映全手工成本）
     - 補 `cspell.json` 加 "callsite" 一詞（規劃文件用到）
- **未完成 / blocker**：無。task spec 已備好，下一 session 可直接按本檔 §0 + §2.8 + tasks.md 接手執行 T5-T10。
- **本次 subagent 用量**：1 次 Agent 呼叫（T5 Engineer 試跑 autofix → escalate）。Reviewer 沒派（escalation 取消後續驗收）。
- **commit 狀態**：未 commit（與 Session 1 同 working tree state，新增 cspell.json + tasks.md modified）
- **下一 session 接手前提醒**：
  - **不要**重跑 `npx eslint tests --fix --rule '{...prefer-screen-queries: "error"}'`（已驗證無效、會浪費 Engineer 時間）
  - 直接按 tasks.md T5 流程做 destructured query 全手工修
  - 心理預期：Session 2 實際工時 ~2.5-3.5 hr，比 plan §8.2 原估 1-2 hr 多 ~1.5 hr

### Session 2（Phase 2）— 完成

- **Started**: 2026-04-28
- **Completed**: 2026-04-28
- **狀態**：✅ Session 2 完成（T5-T10 全綠）。Phase 2 四條目標 rule 全清光；T10 一度發現 browser timeout，後續已用 `NotificationContextProbe` 修復並由本輪 refresh 重新驗證通過。
- **T5-T10 task 結果**：
  - T5/T6 `testing-library/prefer-screen-queries`: 187 → 0（T10 audit 未再出現）
  - T7 `testing-library/render-result-naming-convention`: 10 → 0（T10 audit 未再出現）
  - T8 `testing-library/no-container`: 9 → 0（T8 reviewer PASS；T10 audit 未再出現）
  - T9 `testing-library/no-unnecessary-act`: 1 → 0（T9 reviewer PASS；T10 audit 未再出現）
  - T9 bonus `testing-library/prefer-user-event`: 7 → 6（`NotificationPaginationStateful.test.jsx` line 419 一併消掉）
  - T10 audit：`testing-library/no-node-access` 83、`testing-library/prefer-user-event` 6、`@typescript-eslint/ban-ts-comment` 0；總計 89 errors
- **T8 reviewer evidence 摘要**：
  - PASS：`testing-library/no-container = 0`
  - PASS：`testing-library/no-node-access = 83 <= 89`
  - 先前 reviewer 曾看到 `npm run test:browser` exit 0，`121 passed / 1108 passed`
  - no-container 相關 diff：`NavbarDesktop.test.jsx`、`NotificationPanel.test.jsx`、`scroll-to-comment.test.jsx`、`PostFeed.test.jsx`、`ProfileEventList.test.jsx`
  - Review note：無語意/布局/`aria-hidden` 節點用 `baseElement.querySelector(...)` 消 `no-container` 是刻意策略；Phase 4 仍要處理 DOM access
- **T9 reviewer evidence 摘要**：
  - PASS：全 repo `testing-library/no-unnecessary-act = 0`
  - PASS：`testing-library/prefer-user-event = 6`
  - PASS：單檔 ESLint exit 0；單檔 Vitest exit 0，`1 passed / 5 passed`
  - Diff 合理：移除 `fireEvent` import；`await act(async () => { fireEvent.click(...) })` 改為 sequential `await user.click(...)`；每次 click 都 `await` 且重新 query
- **T9/T10 blocker fix evidence**:
  - Historical note：T10 原 fresh browser run 曾在 `NotificationPaginationStateful.test.jsx` fallback test timeout at 15000ms；同一 suite rerun 仍 timeout。
  - 後續修法：`NotificationPaginationStateful.test.jsx` 新增 `NotificationContextProbe`，用真實 provider context `loadMore()` 推到 capacity，再以 button 觸發 server fallback；避免退回 `fireEvent`。
  - 上一輪修復回報：該單檔與 full browser suite 已 exit 0；本輪 T10 refresh 再跑 full browser suite 亦 exit 0。
- **T10 verification refresh（2026-04-28 fresh run）**:
  - `git status --short`: dirty，含 Session 1 + T5-T9 + handoff 累積 modified files；本輪未 `git add` / commit，且只修改 `handoff.md`
  - `npx eslint src specs tests > /tmp/t10-refresh-audit.txt 2>&1`: `eslint_exit:1`，`✖ 89 problems (89 errors, 0 warnings)`；這是 Phase 3/4 殘留，不是 Phase 2 四條目標 rule
  - Per-rule counts：`testing-library/no-node-access` 83、`testing-library/prefer-user-event` 6；`prefer-screen-queries` / `render-result-naming-convention` / `no-container` / `no-unnecessary-act` 全 0；`@typescript-eslint/ban-ts-comment` 0
  - `npm run test:browser > /tmp/t10-refresh-browser.txt 2>&1`: `browser_exit:0`，`121 passed / 121 files`，`1108 passed / 1108 tests`
  - `npm run test:server > /tmp/t10-refresh-server.txt 2>&1`: sandbox 內 `server_exit:2`，Firebase emulator localhost port listen `EPERM`
  - `npm run test:server > /tmp/t10-refresh-server.txt 2>&1` sandbox 外重跑：`server_exit:0`，`2 passed / 2 files`，`26 passed / 26 tests`
- **本次 subagent 用量**：本 session 至少 4 次本輪接續（T8 reviewer + T9 engineer + T9 reviewer + T10 engineer）；T5-T7 由前序 agents 完成，未在本輪重算。
- **commit 狀態**：未 commit；不可用 `git commit --no-verify` 繞過。2026-04-28 §2.13 已暫關未輪到且會擋 gate 的兩條 rule，Session 1/2 可先正常 commit。
- **下一步**：Session 3 可直接接手 Phase 3 `prefer-user-event` 6 處清理；不要把 dirty files 直接歸因給 Session 3。

### Session 3 規劃 — 完成

- **Started**: 2026-04-28
- **狀態**：✅ 規劃完成；⏳ 實作尚未開始
- **本輪做了什麼**：
  1. 依 plan §5 Phase 3、§8.2 S3、§8.4、§9 追加 `tasks.md` Session 3 T11-T16。
  2. 明確修正交接口徑：`prefer-user-event` 是 6 errors，但 `fireEvent` cleanup 是 8 個可執行用法，最後 raw grep 必須 0；ComposeModal / NotificationPanel 是 hygiene + plan 目標，不是 rule-reported error。
  3. 設計保守並行：共享 worktree 下最多同時 2 個 Engineer subagents；每個 Engineer task 完成後配 1 個 Reviewer task；T11/T16 獨占，repo-wide verification / config / handoff 收尾不與 writer 並行。
  4. 明確約束：主 agent 不下場改測試或 config，所有後續修改交 subagent；本輪只更新 `tasks.md` / `handoff.md`，不 commit / git add / push。
- **待執行**：
  - T11 Preflight audit
  - T12 PostCard 5x click migration
  - T13 NotificationToast fake-timer click migration
  - T14 ComposeModal `<dialog>` cancel native dispatchEvent
  - T15 NotificationPanel img error native dispatchEvent
  - T16 Rule restore + session closeout
- **commit 狀態**：未 commit；本輪文件工程只留下 `tasks.md` / `handoff.md` modified。

### Session 3（Phase 3）— 完成

- **Started**: 2026-04-28
- **Completed**: 2026-04-28
- **狀態**：✅ Session 3 完成（T11-T16 全部收斂）。`testing-library/prefer-user-event` 維持 `error`，`testing-library/no-node-access` 保持 `off` 給 Phase 4。
- **T11-T16 task 結果**：
  - T11 preflight 找到 8 個 executable usage + 7 個 comment-only guideline hits；主 agent scope decision 允許 T16 只改註解。
  - T12 `PostCard.test.jsx` 5 個 click migration 完成，reviewer PASS。
  - T13 `NotificationToast.test.jsx` fake-timer click migration 完成，reviewer PASS；新增 §2.15 deadlock 坑。
  - T14 `ComposeModal.test.jsx` `<dialog>` cancel 改 native dispatchEvent，reviewer PASS。
  - T15 `NotificationPanel.test.jsx` img error 改 native dispatchEvent，reviewer PASS；新增 §2.16 async flush 坑。
  - T16 只改 7 個 comment-only guideline 檔案，沒有改測試邏輯；新增 §2.17 raw grep 坑。
- **T16 verification（2026-04-28T19:09:55+08:00 fresh run）**:
  - `rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs`: line 395 `prefer-user-event: error`、line 396 `no-node-access: off`
  - `grep -rn "fireEvent" tests/integration/`: exit 1，無輸出（raw grep 0）
  - `npx eslint src specs tests 2>&1 | tee /tmp/session3-final-lint.txt`: `lint_exit:0`；輸出只有 React version warning；`testing-library/prefer-user-event` count 0，`testing-library/no-node-access` count 0 because config is `off`
  - `npm run test:browser`: exit 0，`121 passed / 121 files`，`1108 passed / 1108 tests`
  - `npm run test:server`: exit 0，`2 passed / 2 files`，`26 passed / 26 tests`
- **本次 subagent 並行**：T12/T13、T14/T15 以最多 2 個 Engineer 並行，之後各配 reviewer；T16 closeout 獨占驗證與 handoff 更新。
- **commit 狀態**：本段隨 Session 3 commit 納入；不使用 `git commit --no-verify`；不 push。若接手時看到 staged/dirty，先用 `git status --short` / `git log --oneline -5` 釐清實際狀態；不要 revert T12-T15 reviewer 已 PASS 的測試改動。

### Session 4 規劃 — 完成

- **Started**: 2026-04-28
- **狀態**：✅ 規劃完成；⏳ 實作尚未開始，後續修改都交 subagent。
- **前置事實**：
  - 前置 config Engineer 已把 `testing-library/no-node-access` 改為 `error`，Reviewer PASS；本規劃 session 不改 `eslint.config.mjs`。
  - `MobileDrawer.jsx` 已有 `role="dialog"`、`aria-modal="true"`、`aria-label="導覽選單"`；S4 不再規劃「加 dialog」，改為測試查詢方式 cleanup。
  - `NavbarMobile.test.jsx` target lint 目前 raw 42 `no-node-access` errors / 22 unique line:col sites；Reviewer 應看 unique site 與 target range。
- **本輪做了什麼**：
  1. 依 plan §8.2 Session 4 與最新 preflight 事實，追加 `tasks.md` Session 4 T17-T23。
  2. 明確收斂 S4 scope：只做 `tests/integration/navbar/NavbarMobile.test.jsx`，以及必要 affordance 的 `src/components/Navbar/Navbar.jsx` / `src/components/Navbar/MobileDrawer.jsx`。
  3. 明確排除 S5+：不要碰 NavbarDesktop、notifications、posts、profile、weather、toast、strava。
  4. 設定 writer concurrency = 1；同時最多 2 個 subagents 僅限「1 Engineer + 1 Reviewer」驗收配對；不得同時開兩個 Engineer 寫同一檔。
  5. 明確 Reviewer FAIL 流程：主 agent 只能重派 Engineer/subagent 修改，不可自己修。
- **待執行**：
  - T17 Session 4 preflight audit（只讀）
  - T18 Minimal component affordances
  - T19 `NavbarMobile.test.jsx` T005/T006 drawer panel cleanup
  - T20 `NavbarMobile.test.jsx` auth section cleanup
  - T21 `NavbarMobile.test.jsx` state management cleanup
  - T22 `NavbarMobile.test.jsx` accessibility/focus cleanup
  - T23 Session 4 closeout + handoff update
- **commit 狀態**：本規劃 session 不 `git add` / commit / push；只留下 `tasks.md` / `handoff.md` 文件修改。

### Session 4（Phase 4.1 NavbarMobile）— 完成

- **Started**: 2026-04-28
- **Completed**: 2026-04-28
- **狀態**：✅ Session 4 完成（T17-T23）。`testing-library/no-node-access` 維持 `error`；S4 只收斂 NavbarMobile + 必要 Navbar mobile affordance。
- **T17-T23 task 結果**：
  - T17 preflight：`NavbarMobile.test.jsx` raw 42 `testing-library/no-node-access` errors / 22 unique line:col sites；`MobileDrawer.jsx` dialog a11y 已存在。
  - T18：`Navbar.jsx` hamburger lines 加 `data-testid` / `aria-hidden`；`MobileDrawer.jsx` overlay 加 `data-testid`；component lint + target Vitest pass。
  - T19：drawer panel / hamburger / overlay range PASS。
  - T20：auth block PASS。
  - T21：state management block PASS。
  - T22：accessibility / focus block PASS；`npx eslint tests/integration/navbar/NavbarMobile.test.jsx --format stylish` exit 0，`testing-library/no-node-access` 0；target Vitest 23/23 pass。
  - T23：closeout fresh verification + handoff update；未改 `src/**`、`tests/**`、`eslint.config.mjs`、package files。
- **T23 verification（2026-04-28T20:18:23+08:00 fresh run）**:
  - `npx eslint tests/integration/navbar/NavbarMobile.test.jsx`: exit 0；輸出只有 React version warning。
  - `npx eslint src/components/Navbar/Navbar.jsx src/components/Navbar/MobileDrawer.jsx tests/integration/navbar/NavbarMobile.test.jsx`: exit 0；輸出只有 React version warning。
  - `rg -n "'testing-library/no-node-access': 'error'" eslint.config.mjs`: exit 0；line 396 仍是 `error`。
  - `npx vitest run tests/integration/navbar/NavbarMobile.test.jsx`: exit 0；1 file passed，23 tests passed。
  - `npx vitest run tests/integration/navbar`: exit 0；4 files passed，49 tests passed。
- **收斂數字**：`NavbarMobile.test.jsx` raw 42 / 22 unique `no-node-access` sites → 0。
- **剩餘範圍**：repo-wide lint 未在 T23 跑；S5-S8 domain 仍可能 fail。下一 session 只接 S5（NavbarDesktop + notifications），不要把 S6-S8 domain 混進來。
- **commit 狀態**：未 `git add` / commit / push。

### Session 5 規劃（NavbarDesktop + NotificationBell SVG）— 完成

- **Started**: 2026-04-28
- **狀態**：✅ 規劃完成；⏳ 實作尚未開始，後續修改都交 subagent。
- **前置事實**：
  - `eslint.config.mjs` 執行時 `testing-library/no-node-access` 必須為 `error`；本次 planning commit 會短暫改 `off` 讓 commit gate 過，commit 後再恢復 `error`。
  - `NavbarDesktop.test.jsx` fresh lint raw 7 / 5 unique `no-node-access` sites：skeleton、fallback SVG、三個 focus assertion。
  - `NotificationBell.test.jsx` fresh lint raw 2 / 1 unique `no-node-access` site：`bell.querySelector('svg')`。
  - `NotificationPanel.test.jsx` fresh lint raw 4 / 2 unique unreadDot sites，這是 S6，不是 S5。
- **本輪做了什麼**：
  1. 派兩個只讀 subagent 分別 audit NavbarDesktop 與 notifications S5/S6 邊界。
  2. 依 plan §8.2 S5 與 current lint evidence，追加 `tasks.md` Session 5 T24-T29。
  3. 明確收斂 S5 scope：`UserMenu.jsx` / `NavbarDesktop.test.jsx` / `NotificationBell.jsx` / `NotificationBell.test.jsx`。
  4. 明確排除 S6：不碰 `NotificationPanel.test.jsx` / `NotificationItem.jsx` / `notification-click.test.jsx` / `scroll-to-comment.test.jsx`。
  5. 設定同時最多 4 個 subagents：2 Engineer writer + 2 paired Reviewer；實際 writer 最多 2 且檔案不重疊。
  6. 明確 Reviewer FAIL 流程：主 agent 只能重派 Engineer/subagent 修改，不自行修。
- **待執行**：
  - T24 Session 5 preflight audit + scope reconciliation
  - T25 UserMenu minimal affordance for NavbarDesktop
  - T26 NavbarDesktop auth UI no-node-access cleanup
  - T27 NavbarDesktop dropdown focus no-node-access cleanup
  - T28 NotificationBell SVG a11y no-node-access cleanup
  - T29 Session 5 closeout + handoff update
- **commit 狀態**：本規劃 session 會 commit `tasks.md` / `handoff.md`。`eslint.config.mjs` 的 `no-node-access` 只短暫關閉給 commit gate，commit 後恢復 `error`，下一 session 接手時應只看到 `eslint.config.mjs` dirty。

### Session 5（NavbarDesktop + NotificationBell SVG）— 完成

- **Started**: 2026-04-28
- **Completed**: 2026-04-28
- **狀態**：✅ Session 5 完成（T24-T29）。`testing-library/no-node-access` 維持 `error`；S5 只收斂 NavbarDesktop + NotificationBell SVG，S6 boundary 保留。
- **T24-T29 task 結果**：
  - T24 preflight：`NavbarDesktop.test.jsx` raw 7 / 5 unique `no-node-access` sites；`NotificationBell.test.jsx` raw 2 / 1 unique；`NotificationPanel.test.jsx` raw 4 / 2 unique unreadDot sites 標為 S6。
  - T25：`UserMenu.jsx` minimal affordance 完成，供 NavbarDesktop skeleton / fallback SVG 查詢使用。
  - T26：NavbarDesktop auth UI cleanup 完成，原 skeleton / fallback SVG targets 清掉。
  - T27：NavbarDesktop dropdown focus cleanup 完成，focus assertions 不再用 direct Node access。
  - T28：`NotificationBell.jsx` / `NotificationBell.test.jsx` SVG a11y cleanup 完成。
  - T29：closeout verification + handoff update；未改 `eslint.config.mjs`、`src/**`、`tests/**`，只改本檔。
- **T29 verification（2026-04-28 fresh run）**:
  - `npx eslint tests/integration/navbar/NavbarDesktop.test.jsx tests/integration/notifications/NotificationBell.test.jsx`: exit 0；輸出只有 React version warning。
  - `npx eslint src/components/Navbar/UserMenu.jsx src/components/Notifications/NotificationBell.jsx tests/integration/navbar/NavbarDesktop.test.jsx tests/integration/notifications/NotificationBell.test.jsx`: exit 0；輸出只有 React version warning。
  - `npx vitest run tests/integration/navbar/NavbarDesktop.test.jsx tests/integration/notifications/NotificationBell.test.jsx`: exit 0；2 files passed，28 tests passed。
  - `npx vitest run tests/integration/navbar tests/integration/notifications/NotificationBell.test.jsx`: exit 0；5 files passed，60 tests passed。
  - `zsh -o pipefail -c 'npx eslint tests/integration/notifications/NotificationPanel.test.jsx --format stylish 2>&1 | tee /tmp/s5-panel-boundary.txt'`: exit 1；raw 4 / 2 unique unreadDot `no-node-access`，保留給 S6。
  - `npx eslint tests/integration/notifications/NotificationPanel.test.jsx --format stylish`: exit 1；確認不是被 `tee` pipeline exit code 誤導。
  - `rg -n "'testing-library/no-node-access': 'error'" eslint.config.mjs`: exit 0；line 396 仍是 `error`。
- **收斂數字**：`NavbarDesktop.test.jsx` raw 7 / 5 unique → 0；`NotificationBell.test.jsx` raw 2 / 1 unique → 0。
- **S6 剩餘範圍**：`NotificationPanel.test.jsx` unreadDot（目前 line 235:29、245:29 duplicated raw 4 / 2 unique）、`notification-click.test.jsx` unreadDot、`scroll-to-comment.test.jsx`。
- **commit 狀態**：未 `git add` / commit / push。

### Session 6 規劃（NotificationPanel + notification-click + scroll-to-comment）— 完成

- **Started**: 2026-04-28
- **狀態**：✅ 規劃完成；⏳ 實作尚未開始，後續修改都交 subagent。
- **前置事實**（fresh audit 2026-04-28）：
  - ESLint config：`testing-library/prefer-user-event` line 395 `error`、`testing-library/no-node-access` line 396 `error`。用戶 prompt 寫 `eslint.config.mjs:395` 是 line drift（詳 §2.37）。
  - `NotificationPanel.test.jsx` raw 4 / 2 unique unreadDot sites（line 235:29、245:29），對應 `should show blue dot` / `should NOT show blue dot` 兩 it block；pattern `const { baseElement } = render(...)` + `baseElement.querySelector('[class*="unreadDot"]')`。
  - `notification-click.test.jsx` raw 2 / 2 unique unreadDot sites（line 240:18、250:26），同一 it block (`should immediately hide blue dot after click (optimistic update)`)；pattern `panel.querySelector(...)` / `reopenedPanel.querySelector(...)`，panel 由 `screen.getByRole('region', { name: '通知面板' })` 取得。
  - `scroll-to-comment.test.jsx` raw 2 / 1 unique site（line 34:27 `document.getElementById(commentId)`），位於檔內 `ScrollTestComponent` mock 的 `useEffect`（line 21–55），不是測試端 query。模擬對象 `src/components/CommentSection.jsx` line 75。
  - `src/components/Notifications/NotificationItem.jsx` line 48 unreadDot 是純視覺 indicator（無 testid / id / role / aria-label）。
  - notifications domain 邊界：`NotificationBell` / `NotificationPagination` / `NotificationPaginationStateful` / `NotificationTabs` / `NotificationToast` / `notification-error` / `notification-triggers` 七檔已乾淨；只剩 S6 三檔。
- **本輪做了什麼**：
  1. 派 Explore subagent 跑 fresh audit，收集三 target 檔的 raw / unique / line:col / test name / 違規 code，並 dump 對應 component source。
  2. 依 plan §8.2 S6 與最新 audit evidence，追加 `tasks.md` Session 6 T30-T35。
  3. 確認 S6 修法：unreadDot 走修法 C（`NotificationItem.jsx` 加 `data-testid="notification-unread-dot"` + `aria-hidden="true"`，測試改用 `screen.queryByTestId` / `within(panel).queryByTestId`）；scroll-to-comment 走 helper extraction（抽到 `tests/_helpers/notifications/scroll-to-comment-mock.jsx` + 在 `eslint.config.mjs` §17.5 ignores 加精確路徑，與 `tests/_helpers/e2e-helpers.js` 同 pattern）。
  4. 並行設計：T30 preflight 獨占 → T31 affordance 獨占（T32/T33 依賴）→ T32 + T33 + T34 中任兩個並行（最多 2 Engineer + 2 Reviewer = 4 subagents）→ T35 closeout 獨占。
  5. 補本檔 §2.32–§2.37 六個新坑：unreadDot 雙屬性、scroll-to-comment helper 修法、`baseElement` 移除、`within(panel)` 模式、helper ignore 不是 escape hatch、line 395 vs 396 drift。
  6. 主 agent commit bridge：暫關 `eslint.config.mjs:396` `'testing-library/no-node-access'` `error → off` → commit `tasks.md` / `handoff.md` / `eslint.config.mjs` / `cspell.json` → 立即恢復 `error`。**只**改該行 rule level，不動其他 ESLint config / code / tests。
- **待執行**：
  - T30 Session 6 preflight audit（read-only, sequential）
  - T31 NotificationItem unreadDot affordance（sequential gate）
  - T32 NotificationPanel.test.jsx unreadDot cleanup（並行 with T33/T34）
  - T33 notification-click.test.jsx unreadDot cleanup（並行 with T32/T34）
  - T34 scroll-to-comment mock helper extraction（並行 with T32/T33）
  - T35 Session 6 closeout + handoff update（獨占）
- **commit 狀態**：本規劃 session commit 包含 `tasks.md` / `handoff.md` / `eslint.config.mjs`（commit bridge 後恢復 `error`）/ `cspell.json`（補 `affordances` / `eperm`）。Commit 完成後主 agent 立刻把 `eslint.config.mjs:396` 從 `off` 改回 `error`，下個 session 接手時應只看到 `M eslint.config.mjs` dirty。

---

## 5. 下個 Session 開工 checklist

進 Session 6 execution（T30-T35）前：

- [ ] 讀本檔 §0、§2.28–§2.37、§4「Session 5（NavbarDesktop + NotificationBell SVG）— 完成」+「Session 6 規劃 — 完成」。
- [ ] 讀 `tasks.md` Session 6 段（T30-T35）；spec 已完整，不需另行規劃，直接派 Engineer。
- [ ] 先跑 `git status --short` / `git diff --name-only`；應只看到 `M eslint.config.mjs`（commit bridge 後恢復 `error`）。不要把 parallel dirty files 直接歸因給 S6。
- [ ] 確認 `testing-library/no-node-access` 是 `error`：`rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs` 兩條都應 `error`；若 `no-node-access` 是 `off`，停下回報，**不在 sensor 關閉時做 S6**。
- [ ] S6 scope 只接 `NotificationPanel.test.jsx` unreadDot、`notification-click.test.jsx` unreadDot、`scroll-to-comment.test.jsx`，以及 `NotificationItem.jsx` 最小 affordance + `tests/_helpers/notifications/scroll-to-comment-mock.jsx` 新檔 + `eslint.config.mjs` ignores 一個精確路徑。
- [ ] 不回頭改 S5 scope：`NavbarDesktop.test.jsx` / `UserMenu.jsx` / `NotificationBell.test.jsx` / `NotificationBell.jsx` 除非 fresh lint/test 證明被 S6 改動直接打壞。
- [ ] T34 改 `eslint.config.mjs` 只能在 §17.5 testing-library block 的 `ignores` array 加 `'tests/_helpers/notifications/scroll-to-comment-mock.jsx'` 一個精確路徑；不可加 `tests/_helpers/**` broad glob、不可改 rule level、不可動其他 ignores。
- [ ] Boundary / audit 指令若用 `tee`，必須用 `zsh -o pipefail -c '...'` 或另跑 raw command 確認 exit code（§2.29）。
- [ ] T30 preflight 重新跑 current lint，列 raw count + unique line:col；不要沿用本檔行號當唯一真相（§2.30）。
- [ ] repo-wide lint 不是 S6 開工前提；除非真的跑過且通過，不得聲稱 repo-wide 全綠。S7-S8 domain（profile / weather / posts / toast / strava）仍會 fail。
- [ ] T35 不 git add / commit / push；T31-T34 也不 commit（與前 sessions 同 pattern）。

---

## 6. 環境細節（debug 用）

- **Node 版本**：`v22.22.0`
- **npm 版本**：`10.9.4`
- **OS**：darwin 24.3.0
- **Husky 版本**：見 package.json devDependencies
- **ESLint 版本**：見 package.json（flat config 表示 ≥ v9）

---

## 7. Glossary（避免術語誤會）

| 詞                  | 意思                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- |
| sensor              | ESLint rule 在 pre-commit gate 觸發時的「自動防線」。Plan 用此詞代指我們新加的三條 rule。 |
| Path A              | 一次清光所有 violation，rule 直接 `'error'`。本 PR 採取此路。                             |
| Path B              | 過渡期把暫時無法修的設成 `'warn'` + escape hatch。**本 PR 明確不退到 Path B**。           |
| `flat/react` config | `eslint-plugin-testing-library` v7 提供的 flat-config 預設 ruleset。                      |
| sanity check        | 故意寫違規 code 確認 rule 真的會 fire 的最小驗證流程（T3）。                              |
| escalate            | 主 agent 不自行決策，把問題狀況回報用戶、暫停。                                           |
