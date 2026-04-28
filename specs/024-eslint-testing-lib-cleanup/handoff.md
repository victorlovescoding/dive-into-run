# Handoff Notes — 024 ESLint Testing-Library Cleanup

> **目的**：跨 session / 跨 implementer 的接力簿。記錄已驗事實、踩過的坑、下一步該注意什麼。
> **更新規則**：每個 session 結束前必加一段；不刪舊紀錄（會變得難 trace）；只在事實過時時改原段落並標 `~~舊事實~~ → 新事實 (YYYY-MM-DD)`。

---

## 0. 入門 30 秒（最新狀態給下個接手者讀）

| Field           | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch          | `024-eslint-testing-lib-cleanup`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Worktree path   | `/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 目前 Session    | **Session 9 規劃完成；下一步是執行 Phase 5 repo-wide verification / commit / push / PR（tasks.md T49–T57）。Session 9 從頭到尾不准主 agent 做，只能派 Engineer + Reviewer。**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Working tree    | 本規劃時 fresh `git status --short` 為乾淨，最近 commit 是 `3e987f9 Finish testing-library DOM cleanup`，代表 S8 實作似乎已 commit。舊的 T48「dirty 11 檔」是過時交接狀態；Session 9 T49 必須重新確認 branch / commit / clean tree 後才能進 verification wave。                                                                                                                                                                                                                                                                                                                                 |
| ESLint plugin   | 已裝 (eslint-plugin-testing-library@^7.16.2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Sensors         | `testing-library/prefer-user-event` 維持 `error`（line 399）；`testing-library/no-node-access` 維持 `error`（line 400）。S6 T34 在 §17.5 `ignores` array 加了 `tests/_helpers/notifications/scroll-to-comment-mock.jsx` 一個精確路徑。**注意：用戶 prompt 寫 `eslint.config.mjs:395` 是 line drift（§2.37 + §2.49），實際 `no-node-access` 在 line 400。Commit bridge 改 line 400，不是 line 395。**                                                                                                                                                                                                                                                                                                                          |
| Repo lint state | **0 violation**。T48 fresh `npx eslint src specs tests` exit 0；`testing-library/no-node-access` match count 0。S8 target domains (`tests/integration/posts/` + `tests/integration/toast/` + `tests/integration/strava/`) exit 0；S5/S6/S7 boundary (`tests/integration/notifications/` + `tests/integration/navbar/` + `tests/integration/profile/` + `tests/integration/weather/`) exit 0。                                                                                                                                                                                                                                                                                                            |
| Commit 計畫     | Phase 5 按 tasks.md T49–T57 執行：fresh preflight → ESLint 0 → full browser Vitest → server Vitest → type-check/depcruise/spellcheck → pre-commit gate + commit → push + PR → post-merge worktree sync SOP → closeout。T54–T56 必須獨占；pre-commit 失敗不得 `--no-verify`。                                                                                                                                                                                                                                                                                                      |

接手前必讀：

1. 本檔 §2 **坑清單**（特別是 §2.61–§2.67：zsh/rg、pre-commit、push/PR/sync、server emulator）
2. 本檔 §4 「Session 8（posts + toast + strava）— 完成」與「Session 9 規劃（repo-wide verification + PR）— 完成」
3. 本檔 §5 Session 9 checklist；下一步不是再做 S8 實作，而是照 T49–T57 派 Engineer/Reviewer
4. `tasks.md` Session 9 T49–T57（每個 task 含 Engineer prompt / Acceptance Criteria / Reviewer 驗收指令 / Failure recovery）

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
- **對策**：commit bridge 改的是 line 396 的 `no-node-access`，**不要**改 line 395 的 `prefer-user-event`。修改前 `rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs` 確認 rule name 對應的真正行號，**看 rule name 不看行號數字**。S6 T34 後 ignores 多一行，drift 變成 line 399（`prefer-user-event`）/ line 400（`no-node-access`）。

### 2.38 ⚠️ 坑 38：T30 preflight subagent 的 narrative 字段不可全信，要對照 lint output 數據驗證

- **發生在**：Session 6 T30 preflight。
- **症狀**：T30 subagent 回報的 test name / 描述文字（narrative）與實際 code 不符（hallucinated 部分 it block 名字 / pattern），但 line:col 數字、raw / unique 計數、檔案路徑與 plan 預估完全一致。
- **原因**：subagent 在 lint output 是定量真相、code excerpt 是 paraphrased context；narrative 字段（test name / 描述）是 LLM 從上下文 reconstruct，容易混淆相鄰 it block。
- **對策**：closeout 時以 `npx eslint <files>` 真實 output 與 `rg` line:col 為準；subagent narrative 只當 hint，不可直接 quote 進 handoff / commit message。下次 preflight 也派只讀 subagent 即可，但要求 attach raw lint output 與 code excerpt（不只 reformatted summary）。

### 2.39 ⚠️ 坑 39：S7 ProfileEventList sentinel 沒有 testid / role / label，B 修法不可行 → 必須走 C（加 testid）

- **發生在**：Session 7 規劃 audit。
- **已驗事實**：`src/ui/users/ProfileEventListScreen.jsx:58` sentinel `<div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />` 是 IntersectionObserver target，純視覺/行為元素，沒有 `data-testid` / `role` / `aria-label`；parent `<section aria-label="主辦活動列表">` 雖然可以 within scope，但 sentinel 本身沒語意身份能讓 `getByRole` 抓到。
- **plan §8.2 S7 字眼**：「純測試重構 — sentinel / class-based query → testid 或 within，**不動 component**」。但 audit 顯示「不動 component」與「testid」互斥 — 既有 component 沒 testid，要用 testid 就得加。
- **決策**：S7 為 sentinel `<div>` 加 `data-testid="profile-event-list-sentinel"`（與 S6 NotificationItem unreadDot 加 testid 同 pattern；§2.32）。這仍是 plan §5 修法 C（minimal data-testid），plan §8.2「不動 component」字眼視為 _偏好_ 而非 _硬性禁令_。
- **對策**：T37 spec 要求只加 `data-testid` 一行屬性，不改 className / aria-hidden / ref / 條件 render 邏輯。Reviewer 要驗 minimal change。若未來類似 case（純視覺/行為元素需 testable），照同 pattern 處理。

### 2.40 ⚠️ 坑 40：ProfileHeader XSS 測試 line 183 是冗餘，line 181 已足夠驗 React escape

- **發生在**：Session 7 規劃 audit。
- **已驗事實**：`tests/integration/profile/ProfileHeader.test.jsx:171` `escapes <script> in bio content to prevent XSS` it block 有兩個斷言：
  - line 181: `expect(screen.getByText(maliciousBio)).toBeInTheDocument();`
  - line 183: `expect(document.querySelectorAll('script').length).toBe(0);`（違規）
- **觀察**：line 181 已足以證明 React escape — 若 React 沒 escape，`<script>alert("xss")</script>Hi there` 會被 parse 成真的 `<script>` element + 文字「Hi there」，line 181 的 `getByText(maliciousBio)` 會找不到完整原始字串。所以 line 183 的全域 `<script>` count 是 redundant defence-in-depth。
- **修法決策**：T38 spec 要求改用 `expect(bio).toHaveTextContent(maliciousBio) + expect(bio.tagName).toBe('P')`（其中 `bio = screen.getByTestId('profile-bio')`，profile-bio testid 已存在於 production component），等價於 line 181+183 的安全強度，且不用 `document.querySelectorAll`。
- **不可降級**：不可只刪 line 183、留 line 181 一個斷言（會弱化 it block 的 defence-in-depth；reviewer 要驗 ≥ 2 個有效斷言）。
- **對策**：之後類似全域 DOM scan 安全測試（如「沒有 `<iframe>` 被 inject」「沒有 `<style>` override」），先看 production component 是否有 testid 可 scope；用 `getByTestId(...)` + `toHaveTextContent` / `tagName` 驗等價結果，不要 fallback 到 `document.querySelectorAll`。

### 2.41 ⚠️ 坑 41：favorites chip `closest()` chain 可被 `getByRole('button', { name: /移除.../ })` 取代，跳過 chip container 查詢

- **發生在**：Session 7 規劃 audit。
- **已驗事實**：`tests/integration/weather/favorites.test.jsx:499–504` 用 `chip.closest('[class*="Chip"]') || chip.closest('[class*="chip"]') || chip.parentElement` 找 chip container，再 `within(chipContainer).getByRole('button', { name: /移除/i })` 拿 remove button。
- **觀察**：`src/components/weather/FavoritesBar.jsx:83` remove button 已有 `aria-label="移除${name}收藏"` — 可以直接 `screen.getByRole('button', { name: /移除.*板橋.*收藏/ })` 拿 button，跳過 chip container 整個尋找步驟。
- **規範對齊**：Testing Library 哲學是 query 應對應「使用者實際看到/聽到的 a11y tree」；既有 button aria-label 已是 a11y tree 的一部分，沒理由先繞 chip container 再 within。
- **對策**：T39 spec 要求改成 `screen.findByRole('button', { name: /移除.*板橋.*收藏/ })`，不再用 closest / parentElement。若 fixture 下實際 button label 不含「板橋」字樣（`formatLocationNameShort` 結果差異），Engineer 用實際 label 對齊 regex，不可降級回 closest()。

### 2.42 ⚠️ 坑 42：weather-page skeleton 已有 `aria-label="天氣資料載入中"`，用 `getByLabelText` 即可

- **發生在**：Session 7 規劃 audit。
- **已驗事實**：`src/components/weather/WeatherCardSkeleton.jsx:9` 根 `<div className={styles.weatherCard} aria-busy="true" aria-label="天氣資料載入中">`；`tests/integration/weather/weather-page.test.jsx:396` 用 `document.querySelector('[class*="skeleton"]')` 違規。
- **修法**：B — `expect(screen.getByLabelText('天氣資料載入中')).toBeInTheDocument()`，直接利用 component 現有 affordance。
- **對策**：T40 spec 是本 session 4 個 cleanup 中最簡單的（一行替換、不動 component）。若 vitest fail（label not found），先查 component 是否有條件 render 使 fixture 沒走到 loading 路徑，**不要**降級回 `document.querySelector`。

### 2.43 ⚠️ 坑 43：`bio.tagName` 不算 testing-library `no-node-access` 違規

- **發生在**：Session 7 規劃 T38 設計。
- **背景**：`testing-library/no-node-access` rule 抓的是 DOM **navigation** API（`querySelector` / `querySelectorAll` / `getElementById` / `parentElement` / `parentNode` / `children` / `childNodes` / `firstChild` / `lastChild` / `nextElementSibling` / `previousElementSibling` 等）。Element **property**（如 `tagName` / `id` / `className` / `textContent` / `nodeType`）不在 rule 抓的範圍。
- **延伸**：jest-dom matchers (`toHaveTextContent` / `toHaveAttribute` / `toContainHTML`) 也不算 DOM access — 它們是 assertion adapter，內部讀 property 但不暴露 navigation API 給測試。
- **對策**：S7 / S8 修 `no-node-access` 時若需要驗證 element 屬性（tag、attribute、text content），用 jest-dom matcher 或 directly read property，不要用 navigation API 繞。Reviewer 不要把 `bio.tagName` / `bio.textContent` 誤判成違規。

### 2.44 ⚠️ 坑 44：S7 sentinel 加 testid 是 minimal affordance，與 S6 unreadDot 同 pattern

- **發生在**：Session 7 T37 ProfileEventList sentinel cleanup。
- **背景**：`src/ui/users/ProfileEventListScreen.jsx` 的 IntersectionObserver sentinel `<div>` 原本只有 `ref` / `aria-hidden="true"` / `className`，無 stable affordance。測試端用 `baseElement.querySelector('[aria-hidden="true"]')` 是 `no-node-access` 違規，但 sentinel 不能用 role/label 替代（它**就是**該 hidden 不被 a11y tree 看見的觸發節點）。
- **修法**：C — production 加 `data-testid="profile-event-list-sentinel"` 一個屬性（不動 ref / className / aria-hidden）；測試用 `screen.getByTestId(...)` / `screen.queryByTestId(...)`。與 S6 NotificationItem unreadDot（§2.32：testid + `aria-hidden="true"` 同時存在）完全同 pattern。
- **對策**：S8 若再遇到 sentinel/觀察點/隱藏觸發節點 (`aria-hidden="true"` 又沒有 role/label) 場景，直接走 C，不要試 B（換 role/label）— 該節點對 a11y tree 是刻意隱藏的，給它 role 反而違反 component 設計意圖。

### 2.45 ⚠️ 坑 45：T38 ProfileHeader 的 `tagName === 'P'` 是 React escape 失敗時的二次防線

- **發生在**：Session 7 T38 ProfileHeader XSS test 重構。
- **背景**：原測試 line 183 `document.querySelectorAll('script').length === 0` 是違規 navigation API。改用 `expect(bio).toHaveTextContent(maliciousBio)` + `expect(bio.tagName).toBe('P')` 兩斷言取代。
- **安全等價性論證**：若 React escape 失敗，惡意字串 `<script>...</script>Hi there` 會被 parse 成 DOM `<script>` element + 文字節點；那時 `<p data-testid="profile-bio">` 內部 `textContent` 不會等於原始字串（含被 stripped script 標籤），`toHaveTextContent(maliciousBio)` 會 fail。`tagName === 'P'` 確認 query 抓到的是 `<p>` 元素本身（而非意外被 navigation 走到 `<script>`）。
- **對策**：S8 若有類似 escape / sanitization 測試，**不需要**回到 `querySelectorAll('script')` — `toHaveTextContent` 對「整段含特殊字元的字串」做完全比對已能驗 escape；要驗 element identity 加 `tagName`/`toHaveAttribute`，皆非 `no-node-access` violations（§2.43）。

### 2.46 ⚠️ 坑 46：T39 favorites chip aria-label regex 必須對齊 `formatLocationNameShort` 實際輸出

- **發生在**：Session 7 T39 favorites chip cleanup。
- **背景**：`FavoritesBar.jsx` remove button `aria-label` 由 `formatLocationNameShort('新北市', '板橋區')` 產生 → `新北 · 板橋`，組合後實際 aria-label 是 `移除新北 · 板橋收藏`。若 regex 寫死 `/移除新北市.*板橋區.*收藏/` 或 `/移除板橋收藏/` 都會 fail。
- **修法**：用 `getByRole('button', { name: /移除.*板橋.*收藏/ })` — `.*` 跨 `·` 以及縣市縮寫；移除 unused `within` import。
- **對策**：用 `getByRole({ name })` 配 regex 取代 navigation chain 時，**必先**用 `screen.debug()` 或讀 component formatter 函式對齊 aria-label 實際輸出，不要照 fixture 字串猜。

### 2.47 ⚠️ 坑 47：T40 weather-page skeleton 用既有 `aria-label` 不需加新 affordance

- **發生在**：Session 7 T40 weather-page skeleton cleanup。
- **背景**：`WeatherCardSkeleton.jsx:9` 根 `<div aria-busy="true" aria-label="天氣資料載入中">` 已具 stable a11y affordance；測試用 `document.querySelector('[class*="skeleton"]')` 抓 CSS 模組 hashed class 是雙重不該（既是 navigation 違規，又會 hash 變動 brittle）。
- **修法**：B — `expect(screen.getByLabelText('天氣資料載入中')).toBeInTheDocument()`，全 component-untouched。
- **對策**：S8 若見 `[class*="..."]` 模糊 selector，第一反應是查 component 是否已有 aria-label / role，**不**加新 testid（除非 component 完全沒有 a11y affordance）。

### 2.48 ⚠️ 坑 48：S7 closeout 後 dirty 檔有 7 個（非 5 個），別誤判遺漏

- **發生在**：Session 7 T41 fresh `git status --short` 觀察。
- **背景**：S7 動到 4 個 test 檔 + 1 個 component 檔 = 5 個程式檔，但 dirty 還包含 (a) `eslint.config.mjs`（規劃 commit bridge 後恢復 `error` 留下的修改）+ (b) `specs/024-eslint-testing-lib-cleanup/handoff.md`（T41 本次 closeout 更新）。共 **7 個 dirty 檔**。
- **對策**：S8 closeout 同樣會多出 `eslint.config.mjs` + `handoff.md`；T41-equivalent reviewer 看到 dirty list 比 task 表面動到的檔多 2 個是預期，不是回退或意外。

### 2.49 ⚠️ 坑 49：用戶 prompt `eslint.config.mjs:395` 仍是 line drift（持續），實際 line 400

- **發生在**：Session 8 規劃。
- **背景**：用戶在 prompt 中寫「`eslint.config.mjs:395`：testing-library/no-node-access」要主 agent 暫關。但本檔 §2.37 已記錄類似 drift（當時 line 396）；S6 T34 加 `ignores` 後 `prefer-user-event` 395 → 399、`no-node-access` 396 → 400，**目前實際 line 是 400**。
- **驗證**：`grep -n "'testing-library/" eslint.config.mjs` → `399: 'testing-library/prefer-user-event': 'error',` / `400: 'testing-library/no-node-access': 'error',`。
- **對策**：每次 commit bridge 操作前，主 agent 先 `grep -n "'testing-library/" eslint.config.mjs` 確認當前 line 號；用戶 prompt 寫的 line 號當「指向 `no-node-access` rule」之意，不要當絕對行號改。文件中提到 line 號時也以當下 grep 為準。
- **附帶**：`prefer-user-event` line 號也漂移過（395 → 399），但用戶 prompt 一律指 `no-node-access`，所以 commit bridge 永遠操作 `no-node-access` 那行。

### 2.50 ⚠️ 坑 50：PostCard like button 加 aria-label 會 override visible count "5"，screen reader 用戶聽不到讚數

- **發生在**：Session 8 規劃 T44 audit。
- **背景**：`src/components/PostCard.jsx:315–318` like button 結構：
  ```jsx
  <button type="button" className={likeClassName} onClick={() => onLike?.(post.id)}>
    <HeartIcon filled={post.liked} />
    <span className={styles.metaCount}>{post.likesCount}</span>
  </button>
  ```
  原測試用 `btn.querySelector('svg') && btn.textContent.includes('5')` 找按鈕，違 `no-node-access`。
- **修法**：T44 加 `aria-label="按讚"` + `aria-pressed={post.liked}`（toggle button pattern）；測試用 `getByRole('button', { name: '按讚' })`。
- **取捨**：ARIA 規則 `aria-labelledby > aria-label > visible text content`；加 `aria-label="按讚"` 後 button accessible name = `按讚`（不含 "5"）；視覺用戶仍看得到 visible count，但 screen reader 用戶不再聽到讚數。若用戶覺得不可接受，可改 `aria-label={\`按讚（${post.likesCount} 個讚）\`}`；本 plan 採 simpler 版本（與 PostCard 既有 menu button line 172 `aria-label="更多選項"` pattern 一致）。
- **對策**：S8 / 後續若見 SVG-only 互動 button 加 aria-label，先確認 visible 內容對 screen reader 用戶是否必要（如 count、status）。若必要 → 動態 aria-label；若否 → 簡單 aria-label。

### 2.51 ⚠️ 坑 51：PostFeed feed wrapper layout-only，`<main>` 已被 layout.jsx 佔用，唯一可行修法是 testid C

- **發生在**：Session 8 規劃 T43 audit。
- **背景**：`src/ui/posts/PostsPageScreen.jsx:82` feed wrapper `<div className={styles.feed}>` 是 max-width 置中的 layout-only div；測試 `tests/integration/posts/PostFeed.test.jsx:211–226` 驗它「有 'feed' CSS class」。class hash query (`baseElement.querySelector('[class*="feed"]')`) 違 `no-node-access`。
- **不可行修法**：
  - A 換 `<main>` 或 `role="main"`：Next.js layout.jsx 已包 `<main>`，再加會出現多 main landmark，screen reader 混亂。
  - B 用 `getByRole('heading', { name: '文章河道' }).closest(...)`：仍違 `no-node-access`（closest 是 navigation）。
- **修法 C**：T43 加 `data-testid="post-feed"`；測試用 `screen.getByTestId('post-feed')` + `expect(.className).toMatch(/feed/)` 保留「驗 feed class」原意圖。
- **對策**：S8 若見類似 layout-only wrapper（純 max-width / spacing 容器），預設走 testid C；不嘗試 a11y role（多餘 landmark 反而傷 a11y）。

### 2.52 ⚠️ 坑 52：RunsRouteMap `container.firstChild === null` 與 `queryByTestId('map-container')` 同 it 等價，可直接刪 container 解構 + 補 polyline 斷言

- **發生在**：Session 8 規劃 T45 audit。
- **背景**：`tests/integration/strava/RunsRouteMap.test.jsx:54–60, 63–69` 兩個 null-render it block 各兩個斷言：line 59 `expect(container.firstChild).toBeNull()` + line 60 `expect(screen.queryByTestId('map-container')).not.toBeInTheDocument()`；line 68/69 同 pattern。`RunsRouteMapInner.jsx:36–38` 在 coords 為空時 `return null`。
- **等價性論證**：component `return null` → DOM 樹完全空 → 兩個斷言（`firstChild === null` 與 `queryByTestId` 找不到 map-container）等價。原 firstChild 斷言對「子樹完全空」的覆蓋強度，可用 `queryByTestId('map-container')` + `queryByTestId('polyline')` 兩個負面斷言取代。
- **修法**：T45 純測試，刪 `const { container } = render(...)` 解構（避免 `no-container` 違規），刪 `expect(container.firstChild).toBeNull()` 行，補 `expect(screen.queryByTestId('polyline')).not.toBeInTheDocument()` 斷言。
- **不可行 alternative**：用 `expect(container).toBeEmptyDOMElement()` jest-dom matcher — 仍踩 `no-container` rule（v7 plugin 仍會抓解構）。
- **對策**：S8 / 後續若見「render 後驗子樹完全空」的測試，先看 component 是否 `return null`；若是 → 用 `queryBy*().not.toBeInTheDocument()` 對應每個會 render 的 element 補負面斷言取代 `container.firstChild`。

### 2.53 ⚠️ 坑 53：crud-toast `document.querySelector('form')` 是繞 native form validation，不能換 `userEvent.click(submit)`

- **發生在**：Session 8 規劃 T46 audit。
- **背景**：`tests/integration/toast/crud-toast.test.jsx:265, 287` 兩處 create-event it block：
  ```js
  const form = document.querySelector('form');
  expect(form).not.toBeNull();
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  ```
- **為何 dispatchEvent 不換 userEvent.click**：`EventCreateForm.jsx` 含 required 欄位（hostName / city 等）；`userEvent.click(submitButton)` 會觸發 native form validation 把 submit 擋掉（顯示 invalid 提示），React `onSubmit` 不會跑 → mock toast 不會被呼叫。`form.dispatchEvent(new Event('submit'))` 直接觸發 React `onSubmit` handler 繞過 validation（同 §2.16 ComposeModal cancel + NotificationPanel img error 的 native dispatchEvent 哲學）。
- **修法**：T46 加 `aria-labelledby="event-create-form-title"` 到 form + `id="event-create-form-title"` 到 h2 line 76；測試端 `screen.getByRole('form', { name: '揪團表單' })` 取得 form，仍 `form.dispatchEvent(new Event('submit', ...))` 觸發。
- **EventEditForm 不需動**：crud-toast.test line 296 `update event` it block 沒實際 dispatchEvent submit，line 328 `expect(updateEvent).not.toHaveBeenCalled()` 只驗 mock wiring。
- **對策**：S8 / 後續若見「dispatchEvent submit」測試，先 audit production form 是否有 required 欄位 → 若有，保留 dispatchEvent；只把 form query 從 `document.querySelector` 改為 `getByRole('form', { name })`。

### 2.54 ⚠️ 坑 54：`<form>` element 沒 accessible name 時 implicit role 'form' 不啟用，必須加 aria-label / aria-labelledby

- **發生在**：Session 8 規劃 T46 設計。
- **ARIA spec**：`<form>` element 有 implicit role `form` **僅當** 有 accessible name（aria-label / aria-labelledby / 有 title attribute）。否則 form 沒 role，`screen.getByRole('form')` 會 throw "Unable to find an accessible role 'form'"。
- **修法**：T46 加 `aria-labelledby` 連到既有 h2（重用 visible text，0 新文字、最低成本）。
- **檢查 tip**：reviewer 改完跑 `screen.debug()` 或 `screen.logTestingPlaygroundURL()` 確認 form accessible name 真的被設好；hint：DOM 上看到 `<form aria-labelledby="event-create-form-title">` + `<h2 id="event-create-form-title">揪團表單</h2>` 即正確。
- **對策**：S8 / 後續若用 `getByRole('form', { name })`，**必先**在 production 加 aria-label / aria-labelledby；testing-library plugin v7 不會主動提示這點（只會抓 `no-node-access`），漏加會在 vitest fail。

### 2.55 ⚠️ 坑 55：ToastContainer outer wrapper 加 `role="region"`，不能用 `role="status"` 因 individual Toast 也用 status

- **發生在**：Session 8 規劃 T47 audit。
- **背景**：`src/components/ToastContainer.jsx:18` outer `<div className={styles.container} aria-live="polite" aria-relevant="additions removals">`，個別 `<Toast>` 元件（mock line 15）依 type 走 `role="status"`（success/info）或 `role="alert"`（error）。
- **不可行**：給 outer wrapper 加 `role="status"` → DOM 上會有 multi-status（outer 1 個 + 個別 toast 多個），`screen.getByRole('status')` throw（多 match）；`getAllByRole('status')[0]` 雖能用但脆弱（依賴順序）。
- **修法**：T47 加 `role="region"` + `aria-label="通知列表"`。`region` 是 landmark role，screen reader 宣布「通知列表 region」；不會與 individual Toast 的 status/alert collide。保留 `aria-live="polite"` + `aria-relevant`（不 redundant — `role="region"` 不 implicitly aria-live）。
- **對策**：S8 / 後續若 component 內含 nested live regions（toast list、notification panel），outer wrapper 用 `role="region"` + aria-label 命名而非 `status`；keep individual element 的 `role="status"` 給語意 priority 訊息。

### 2.56 ⚠️ 坑 56：S8 closeout dirty 檔預估 11 個（vs S7 7 個），多出來的 4 個是新動 production component

- **發生在**：Session 8 規劃 T48 預期。
- **背景**（§2.48 延伸）：S8 動 5 個 test 檔（PostFeed / PostDetail / RunsRouteMap / crud-toast / toast-container）+ 4 個 production component（PostsPageScreen / PostCard / EventCreateForm / ToastContainer）= 9 個程式檔，加 `eslint.config.mjs`（commit bridge）+ `handoff.md`（T48 closeout 更新）= **11 個 dirty 檔**。
- **對比 S7 (7 個 dirty)**：S7 只動 1 個 production（ProfileEventListScreen sentinel）；S8 動 4 個 production（多 3 個）。
- **對策**：T48 reviewer 看到 dirty list 11 個是預期，不是回退或意外。若實際少於 11 個 → 主 agent 找漏掉的 task（哪個 production 沒動到？）；若多於 11 個 → 主 agent 找越界 task（誰動到不在 spec 的檔？）。

### 2.57 ⚠️ 坑 57：S8 完成 = repo-wide `npx eslint src specs tests` 首次 exit 0；任何殘留必為非 testing-library rule

- **發生在**：Session 8 T48 closeout 預期。
- **背景**：S1–S7 累積 cleanup，repo-wide `no-node-access` 從 baseline 89（plan §3.1）→ S2 結束 83 → S3 結束 not changed → S4 結束 41 → S5 結束 33 → S6 結束 24（§4 Session 6 完成段）→ S7 結束 7 unique / 12 raw（§0 Repo lint state）→ **S8 目標 0**。其他 6 條 testing-library rule（prefer-screen-queries / render-result-naming-convention / no-container / no-unnecessary-act / prefer-user-event）+ ban-ts-comment 在 S2/S3 結束時已全 0。
- **驗證指令**：
  ```bash
  npx eslint src specs tests > /tmp/s8-t48-repo-wide.txt 2>&1
  echo "exit=$?"  # 預期 0
  rg -c "testing-library/" /tmp/s8-t48-repo-wide.txt  # 預期 0
  ```
- **若殘留**：
  - 殘留 `testing-library/no-node-access` → S8 task 漏處理；T48 Reviewer FAIL，主 agent 找出殘留檔，重派對應 T43–T47 Engineer
  - 殘留其他 testing-library rule → 嚴重 regression（前 sessions 全 PASS 但 S8 task 改壞）；主 agent 找回歸點 + 重派 Engineer revert
  - 殘留非 testing-library rule（如 React `react-hooks/exhaustive-deps`、JSDoc 等）→ 不阻塞 S8 結束，但 escalate 給用戶決定是否本 PR 處理（plan §5 Phase 5 / 開 PR 前的 verification 範疇）
- **對策**：T48 closeout 必驗 repo-wide exit 0；handoff §0 Repo lint state 改寫「**首次** repo-wide 全綠」是本 PR 的關鍵 milestone。

### 2.58 ⚠️ 坑 58：T42 發現磁碟狀態比使用者描述更前進，補 Reviewer PASS 而不是重做

- **發生在**：Session 8 T42 preflight / closeout 前置整理。
- **背景**：前置描述只保證 T42 PASS；實際磁碟狀態已包含 T45/T46 落地修改，但當時缺 Reviewer PASS 紀錄。這不是要重做 T45/T46，也不是要 revert dirty files。
- **對策**：先用 scoped evidence 判斷哪些檔案已是目標狀態，再補對應 scoped Reviewer；不要把已落地且 scoped PASS 的 T45/T46 改動重跑或覆蓋。

### 2.59 ⚠️ 坑 59：T47 Reviewer 初判 FAIL 把累積 dirty worktree 誤當 T47 off-scope

- **發生在**：Session 8 T47 scoped review。
- **背景**：T43–T46 dirty files 已經是已驗收工作；Reviewer 若直接看整個 dirty worktree，會把累積修改誤判成 T47 越界。
- **對策**：T47 review 必須用 scoped diff，只評 `src/components/ToastContainer.jsx` + `tests/integration/toast/toast-container.test.jsx`。已由 T43–T46 Reviewer PASS 的 dirty files 不應算進 T47 off-scope。

### 2.60 ⚠️ 坑 60：ToastContainer outer wrapper 保留 `aria-live`，不改成 `role="status"`

- **發生在**：Session 8 T47 implementation / review。
- **背景**：outer wrapper 加 `role="region"` + `aria-label="通知列表"` 是刻意設計；`aria-live="polite"` / `aria-relevant` 仍保留。若改成 `role="status"`，會和 individual Toast 的 `role="status"` collision，導致 `getByRole('status')` 多重 match。
- **對策**：outer = named region + live attributes；individual Toast 繼續負責 `status` / `alert` 語意。測試抓 outer wrapper 用 `getByRole('region', { name: '通知列表' })`。

### 2.61 ⚠️ 坑 61：zsh 的 `status` 是 read-only 變數，repo-wide wrapper 不能用 `status=$?`

- **發生在**：Session 8 T48 closeout verification。
- **背景**：使用者指定的 wrapper `status=$?` 在 zsh 直接失敗：`zsh:1: read-only variable: status`，因此沒有取得 ESLint 真實 exit code。
- **修法**：改用非保留名變數重跑：
  ```bash
  npx eslint src specs tests > /tmp/s8-t48-repo-wide.txt 2>&1; eslint_status=$?; echo "exit=$eslint_status"; rg -c "testing-library/no-node-access" /tmp/s8-t48-repo-wide.txt; exit $eslint_status
  ```
- **對策**：在 zsh wrapper 裡不要用 `status` 當變數名；用 `eslint_status` / `test_status` 這類明確名稱。

### 2.62 ⚠️ 坑 62：`rg -c` 在 0 match 時不印 0 且 exit 1，需另用 `grep -c` 或顯式處理

- **發生在**：Session 8 T48 closeout verification。
- **背景**：repo-wide ESLint 已 `exit=0`，但 `rg -c "testing-library/no-node-access" /tmp/s8-t48-repo-wide.txt` 在 0 match 時沒有輸出，且 `rg_exit=1`。這容易被誤讀成指令壞掉或漏記 count。
- **驗證**：`grep -c "testing-library/no-node-access" /tmp/s8-t48-repo-wide.txt` 輸出 `0`（grep 在 0 match 時 exit 1，但 count 可讀）。
- **對策**：需要記錄 count 時，0 match 場景用 `grep -c ... || true` 或包成顯式 `if rg -q ...; then rg -c ...; else echo 0; fi`。

### 2.63 ⚠️ 坑 63：Session 9 開工不能信 T48 dirty list，先 fresh preflight

- **發生在**：Session 9 規劃。
- **背景**：handoff §0 原本還寫 T48 closeout 後 dirty 11 檔，但本規劃時 `git status --short` 為乾淨，最近 commit 是 `3e987f9 Finish testing-library DOM cleanup`。代表 S8 實作很可能已 commit，舊 dirty list 已過時。
- **對策**：T49 第一件事固定跑 `git branch --show-current` / `git log -1 --oneline` / `git status --short` / `git diff --name-only`。若不乾淨，不進 verification wave；先回報 dirty list，不要 revert。

### 2.64 ⚠️ 坑 64：Phase 5 失敗不能讓主 agent 修，必須回 Engineer/Reviewer loop

- **發生在**：Session 9 規劃。
- **背景**：使用者明確要求 Session 9 任務從頭到尾不准主 agent 做；主 agent 只能派 Engineer/Reviewer、彙整回報。若 verification fail，主 agent 直接修 code/test 會破壞這個工作模式。
- **對策**：每個 T49–T57 都有 Failure recovery。Reviewer 不通過時列 failing command/log/檔案；主 agent 重派同 Engineer 或 dedicated fix Engineer。涉及 code/test behavior 的修正，先停止並回報用戶，取得確認後才派。

### 2.65 ⚠️ 坑 65：pre-commit 失敗不准 `--no-verify`

- **發生在**：Session 9 T54 規劃。
- **背景**：`.husky/pre-commit` 實際會跑 `npm run lint -- --max-warnings 0`、`npm run type-check`、`npm run depcruise`、`npm run spellcheck`、`npx vitest run --project=browser`。這是 Phase 5 的核心 gate，不是可繞過的形式檢查。
- **對策**：T54 commit 若 pre-commit fail，保留 output 並回到 T50–T53 對應 task 或 dedicated fix Engineer；不得 `git commit --no-verify`，不得暫關 rule 或 broad ignore。

### 2.66 ⚠️ 坑 66：push / PR / post-merge sync 都是獨占任務，不能跟 verification 並行

- **發生在**：Session 9 規劃。
- **背景**：T55 push + PR 會造成 remote/PR 外部副作用；T56 post-merge worktree sync 會對多個 worktree 做 pull/rebase/npm install。這些不能和其他 verification 或 fix agent 同時跑，否則 evidence 與 worktree state 會互相污染。
- **對策**：T54–T56 都設為並行度 1。T55 PR description 必須含 baseline/cleanup summary、repo-wide ESLint 0、browser/server/type-check/depcruise/spellcheck/pre-commit evidence、post-merge npm install/worktree sync SOP。T56 若遇到 dirty worktree/rebase conflict/server env 問題，停止回報，不自動 stash/reset。

### 2.67 ⚠️ 坑 67：server test 需要 emulator / 環境，失敗要分清是環境還是測試

- **發生在**：Session 9 T52 規劃。
- **背景**：Phase 5 Task 5.2 要跑 `npm run test:server`；server project 依賴 Firebase Auth/Firestore emulator 與本地環境。失敗不一定是 S8 cleanup regression，也可能是 emulator/port/credential 問題。
- **對策**：T52 Reviewer 必須回報完整 command、exit code、emulator 啟動狀態與錯誤摘要。若是環境 blocker，不改 package/firebase 設定；PR evidence 要如實標示 blocker 或在修復後補跑。

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

### Session 6（NotificationPanel + notification-click + scroll-to-comment 收尾）— 完成

- **Started**: 2026-04-28
- **Completed**: 2026-04-28
- **狀態**：✅ T30-T35 全綠；`testing-library/no-node-access` 維持 `error`。notifications domain `no-node-access` 全清（10/10 檔）。
- **T30-T35 task 結果**：
  - T30 preflight（read-only subagent）：`NotificationPanel.test.jsx` raw 4 unique 2（line 235:29、245:29），`notification-click.test.jsx` raw 2 unique 2（line 240:18、250:26），`scroll-to-comment.test.jsx` raw 2 unique 1（line 34）。subagent 回報的 test name 與實際 code 不完全相符（詳 §2.38 hallucination 坑），但 line:col / raw / unique 數字與 plan 一致。
  - T31：`src/components/Notifications/NotificationItem.jsx` line 48 unreadDot `<span>` 加 `data-testid="notification-unread-dot"` + `aria-hidden="true"`。
  - T32：`NotificationPanel.test.jsx` 兩個 it block (`should show blue dot` / `should NOT show blue dot`) 改用 `screen.getByTestId / queryByTestId('notification-unread-dot')`，移除 `const { baseElement } = render(...)` 解構。
  - T33：`notification-click.test.jsx` line 240/250 改 `within(panel).getByTestId / queryByTestId(...)`，補 `within` 進 `@testing-library/react` import。
  - T34：新檔 `tests/_helpers/notifications/scroll-to-comment-mock.jsx`（default export `ScrollTestComponent`，包含 `useEffect` 內 `document.getElementById(commentId)`）；test 檔 import helper 並移除原 `useEffect` import；`eslint.config.mjs` §17.5 ignores 加精確路徑 `'tests/_helpers/notifications/scroll-to-comment-mock.jsx'`，rule level 維持 `error`。line drift：`prefer-user-event` 395 → 399、`no-node-access` 396 → 400（ignores 多一行）。
  - T35：closeout verification + handoff 更新；未改 `eslint.config.mjs` / `src/**` / `tests/**`，只改本檔。
- **T35 verification（2026-04-28 fresh run）**:
  - `npx eslint tests/integration/notifications/NotificationPanel.test.jsx tests/integration/notifications/notification-click.test.jsx tests/integration/notifications/scroll-to-comment.test.jsx`: exit 0。
  - `npx eslint tests/integration/notifications/`: exit 0。
  - `npx eslint src/components/Notifications/NotificationItem.jsx tests/_helpers/notifications/scroll-to-comment-mock.jsx`: exit 0。
  - `npx vitest run` 三 target 檔：3 files passed，19 tests passed，1.32s。
  - `rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs`: line 399 = `prefer-user-event: error`、line 400 = `no-node-access: error`。
- **收斂數字**：NotificationPanel raw 4→0；notification-click raw 2→0；scroll-to-comment raw 2→0（透過 helper extraction + 精確路徑 ignore）。
- **Repo-wide lint 殘留**（`npx eslint src specs tests` 24 problems，全為 `no-node-access`，分布為 S7-S8 scope）：
  - profile（S7）：`tests/integration/profile/ProfileEventList.test.jsx`、`ProfileHeader.test.jsx`（共 2 處）
  - weather（S7）：`tests/integration/weather/favorites.test.jsx`、`weather-page.test.jsx`（共 2 處）
  - posts（S8）：`tests/integration/posts/PostDetail.test.jsx`、`PostFeed.test.jsx`（共 2 處）
  - toast（S8）：`tests/integration/toast/crud-toast.test.jsx`、`toast-container.test.jsx`（共 2 處）
  - strava（S8）：`tests/integration/strava/RunsRouteMap.test.jsx`（共 1 處）
- **commit 狀態**：未 `git add` / commit / push。Working tree dirty：`M eslint.config.mjs`、`M tests/integration/notifications/NotificationPaginationStateful.test.jsx`、`M src/components/Notifications/NotificationItem.jsx`、`M tests/integration/notifications/NotificationPanel.test.jsx`、`M tests/integration/notifications/notification-click.test.jsx`、`M tests/integration/notifications/scroll-to-comment.test.jsx`；untracked 新檔 `tests/_helpers/notifications/scroll-to-comment-mock.jsx`。

### Session 7 規劃（profile + weather 純測試重構）— 完成

- **Started**: 2026-04-28
- **狀態**：✅ 規劃完成；⏳ 實作（T36–T41）尚未開始，後續修改都交 subagent。
- **前置事實**（fresh audit 2026-04-28，由 read-only Explore subagent 收集）：
  - ESLint config：`testing-library/prefer-user-event` line 399 `error`、`testing-library/no-node-access` line 400 `error`；ignores array 維持 3 entries（`tests/e2e/**` / `tests/_helpers/e2e-helpers.js` / `tests/_helpers/notifications/scroll-to-comment-mock.jsx`）。
  - S7 scope 5 unique sites：
    - `tests/integration/profile/ProfileEventList.test.jsx` line 241 / 257（兩 it block — `renders sentinel when hasMore is true` / `does not render sentinel when hasMore is false`）：`baseElement.querySelector('[aria-hidden="true"]')`
    - `tests/integration/profile/ProfileHeader.test.jsx` line 183（`escapes <script> in bio content to prevent XSS`）：`document.querySelectorAll('script').length`
    - `tests/integration/weather/favorites.test.jsx` line 501（`should remove chip and call removeFavorite on click`）：`chip.closest('[class*="Chip"]') || chip.closest('[class*="chip"]') || chip.parentElement`（同行 3 col chain，ESLint raw 算 3 但 unique site 1）
    - `tests/integration/weather/weather-page.test.jsx` line 396（`renders loading skeleton when runtime state is loading`）：`document.querySelector('[class*="skeleton"]')`
  - Production component affordance：
    - `src/ui/users/ProfileEventListScreen.jsx:58` sentinel 無 testid / role / label（純 `aria-hidden`）→ T37 必須加 testid
    - `src/app/users/[uid]/ProfileHeader.jsx:79` bio 已有 `data-testid="profile-bio"` → T38 可直接 scope，不動 component
    - `src/components/weather/FavoritesBar.jsx:83` remove button 已有 `aria-label="移除${name}收藏"` → T39 用 `getByRole`，不動 component
    - `src/components/weather/WeatherCardSkeleton.jsx:9` 根 div 已有 `aria-busy + aria-label="天氣資料載入中"` → T40 用 `getByLabelText`，不動 component
  - 邊界檢查：S5/S6（NotificationPanel / notification-click / scroll-to-comment / NavbarDesktop / NavbarMobile）`npx eslint` exit 0；S8 scope 仍 fail（PostDetail 1 unique / PostFeed 1 / RunsRouteMap 2 / crud-toast 2 / toast-container 1 = 7 unique sites / 12 raw messages）。
- **本輪做了什麼**：
  1. 派 Explore subagent 跑 fresh audit，收集 5 unique sites 的 line:col / verbatim source line / it block / 對應 component affordance；同時驗 S5/S6 邊界與 S8 scope 計數。
  2. 依 plan §5 Phase 4.4 / 4.5 與 §8.2 S7 與最新 audit evidence，追加 `tasks.md` Session 7 T36–T41。
  3. 確認 S7 修法：
     - T37 ProfileEventList sentinel：修法 C（加 `data-testid="profile-event-list-sentinel"` 給 sentinel `<div>`，同 §2.39 / §2.32 unreadDot pattern；移除 `baseElement` 解構）。
     - T38 ProfileHeader XSS：修法 B（用既有 `data-testid="profile-bio"` + `toHaveTextContent` + `tagName` 替代全域 `document.querySelectorAll('script')`；§2.40 / §2.43）。
     - T39 favorites chip：修法 B（直接 `getByRole('button', { name: /移除.*板橋.*收藏/ })` 跳過 chip container 查詢；§2.41）。
     - T40 weather-page skeleton：修法 B（`getByLabelText('天氣資料載入中')` 用既有 component aria-label；§2.42）。
  4. 並行設計：T36 preflight 獨占 → T37 + T38 並行 (Wave 1) → T39 + T40 並行 (Wave 2) → T41 closeout 獨占。同時最多 4 subagents（2 Engineer + 2 Reviewer 配對）。
  5. 補本檔 §2.39–§2.43 五個新坑（sentinel 加 testid 必要性、XSS line 183 冗餘、favorites 跳過 closest、skeleton 用 getByLabelText、`tagName` / `textContent` 不算違規）。
  6. 主 agent commit bridge：暫關 `eslint.config.mjs:400` `'testing-library/no-node-access'` `error → off` → commit `tasks.md` / `handoff.md` / `cspell.json`（補 `normalise` / `testname` / `defence`）/ `eslint.config.mjs` → 立即恢復 `error`。**只**改該行 rule level，不動其他 ESLint config / code / tests。
- **待執行**：
  - T36 Session 7 preflight audit（read-only Explore，獨占）
  - T37 ProfileEventList sentinel cleanup（Wave 1，並行 with T38）
  - T38 ProfileHeader XSS test scope cleanup（Wave 1，並行 with T37）
  - T39 favorites chip cleanup（Wave 2，並行 with T40）
  - T40 weather-page skeleton cleanup（Wave 2，並行 with T39）
  - T41 Session 7 closeout + handoff update（獨占）
- **commit 狀態**：本規劃 session commit 包含 `tasks.md` / `handoff.md` / `cspell.json` / `eslint.config.mjs`（commit bridge 後恢復 `error`）。Commit 完成後主 agent 立刻把 `eslint.config.mjs:400` 從 `off` 改回 `error`，下個 session 接手時應只看到 `M eslint.config.mjs` dirty。

### Session 7（profile + weather）— 完成

- **Started / Closed**: 2026-04-28
- **狀態**：✅ T36–T41 全部 PASS；profile + weather domain `no-node-access` 全清為 0；4 個 target 測試檔 27/27 vitest pass。
- **fresh verification（T41 closeout 實測 2026-04-28）**：
  - `npx eslint tests/integration/profile/ tests/integration/weather/` exit **0**（5 unique sites 全清）
  - `npx vitest run tests/integration/profile/ProfileEventList.test.jsx tests/integration/profile/ProfileHeader.test.jsx tests/integration/weather/favorites.test.jsx tests/integration/weather/weather-page.test.jsx` → Test Files **4 passed (4)** / Tests **27 passed (27)**（ProfileEventList 8 + ProfileHeader 6 + favorites 7 + weather-page 6）
  - `rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs` 兩條都 `'error'`（line 399 / 400）
  - `npx eslint tests/integration/notifications/ tests/integration/navbar/` exit **0**（S5/S6 邊界仍綠）
  - Repo-wide `npx eslint src specs tests` exit 1，殘留 `no-node-access` raw **12** / unique **7**，全在 S8 scope：PostDetail line 186 (1 unique) / PostFeed line 224 (1) / RunsRouteMap line 59+68 (2) / crud-toast line 265+287 (2) / toast-container line 65 (1)。每個 raw 出現兩次是 ESLint 對同一 source line 兩次回報的現象（已知，§2.19）。
- **每 task 結果**：
  - T36 Preflight Explore：5 unique 對齊規劃；S5/S6 邊界 0；S8 scope 7 unique。PASS。
  - T37 ProfileEventList sentinel：production `src/ui/users/ProfileEventListScreen.jsx` 加 `data-testid="profile-event-list-sentinel"`（其他屬性不動）；test 兩 it block 改 `screen.getByTestId(...)` / `queryByTestId(...)`，移除 `baseElement` 解構。ESLint 0 / vitest 8/8 pass。Reviewer PASS（§2.44）。
  - T38 ProfileHeader XSS：純測試端，移除 `document.querySelectorAll('script')`；改用既有 `data-testid="profile-bio"` + `toHaveTextContent(maliciousBio)` + `tagName === 'P'`（§2.43 / §2.45）。ESLint 0 / vitest 6/6 pass。Reviewer PASS。
  - T39 favorites chip：純測試端，`closest()` chain 換 `await screen.findByRole('button', { name: /移除.*板橋.*收藏/ })`；regex 對齊 `formatLocationNameShort('新北市', '板橋區')` → `新北 · 板橋` 實際輸出（aria-label = `移除新北 · 板橋收藏`，§2.46）；移除 unused `within` import。ESLint 0 / vitest 7/7 pass。Reviewer PASS。
  - T40 weather-page skeleton：純測試端，`document.querySelector('[class*="skeleton"]')` 換 `screen.getByLabelText('天氣資料載入中')`，使用既有 `WeatherCardSkeleton.jsx` aria-label（§2.47）。ESLint 0 / vitest 6/6 pass。Reviewer PASS。
  - T41 Closeout：fresh verification 全綠；本檔 §0 / §2.44–§2.48 / §4 Session 7 完成段 / §5 改成 S8 checklist。
- **動到的 production**：唯一一處 `src/ui/users/ProfileEventListScreen.jsx`（T37 加 sentinel testid 一行屬性）。T38/T39/T40 component 完全 untouched。
- **新坑紀錄**：§2.44（sentinel testid pattern）/ §2.45（XSS tagName 安全等價論證）/ §2.46（favorites aria-label regex 對齊 formatter）/ §2.47（既有 aria-label 不需新加 testid）/ §2.48（closeout dirty 檔多 2 個是預期）。
- **commit 狀態**：T41 不 commit / push。dirty 檔（共 7 個）由主 agent closeout commit 處理：`eslint.config.mjs` / `src/ui/users/ProfileEventListScreen.jsx` / `tests/integration/profile/ProfileEventList.test.jsx` / `tests/integration/profile/ProfileHeader.test.jsx` / `tests/integration/weather/favorites.test.jsx` / `tests/integration/weather/weather-page.test.jsx` / `specs/024-eslint-testing-lib-cleanup/handoff.md`。

### Session 8 規劃（posts + toast + strava 收尾）— 完成

- **Started**: 2026-04-29（接 Session 7 commit `07182d4`）
- **狀態**：✅ 規劃完成；⏳ 實作（T42–T48）尚未開始，後續修改都交 subagent。
- **前置事實**（fresh audit 2026-04-29，由主 agent 在規劃時直接跑 `npx eslint --format json` + Read 收集）：
  - ESLint config：`testing-library/prefer-user-event` line 399 `error`、`testing-library/no-node-access` line 400 `error`；ignores array 維持 3 entries（`tests/e2e/**` / `tests/_helpers/e2e-helpers.js` / `tests/_helpers/notifications/scroll-to-comment-mock.jsx`）。
  - S8 scope **7 unique sites / 12 raw `no-node-access`**：
    - `tests/integration/posts/PostDetail.test.jsx:186:20`（it `按讚按鈕可點擊`）：`(btn) => btn.querySelector('svg') && btn.textContent.includes('5')`
    - `tests/integration/posts/PostFeed.test.jsx:224:39`（it `wraps the feed in a container with the "feed" CSS class for max-width`）：`baseElement.querySelector('[class*="feed"]')`
    - `tests/integration/strava/RunsRouteMap.test.jsx:59:22 + 68:22`（兩個 null-render it block）：`expect(container.firstChild).toBeNull()` ×2
    - `tests/integration/toast/crud-toast.test.jsx:265:27 + 287:27`（create-event success + error 兩 it block）：`document.querySelector('form')` ×2
    - `tests/integration/toast/toast-container.test.jsx:65:56`（it `has aria-live="polite" on the container`）：`screen.getByTestId('toast-id-1').parentElement`
  - Production component affordance：
    - `src/components/PostCard.jsx:315–318` like button 無 aria-label / role override（§2.50）→ T44 加 `aria-label="按讚"` + `aria-pressed`
    - `src/ui/posts/PostsPageScreen.jsx:82` feed wrapper 無 testid / role（§2.51）→ T43 加 `data-testid="post-feed"`
    - `src/components/RunsRouteMapInner.jsx:36–38` early return null（§2.52）→ T45 純測試，不動 component
    - `src/ui/events/EventCreateForm.jsx:72 + 76` form 無 aria-label，h2 無 id（§2.53 / §2.54）→ T46 加 `aria-labelledby="event-create-form-title"` + h2 `id`
    - `src/components/ToastContainer.jsx:18` outer `<div>` 已有 `aria-live` 但無 role / aria-label（§2.55）→ T47 加 `role="region"` + `aria-label="通知列表"`
    - `src/components/EventEditForm.jsx` 不需動（crud-toast.test 沒實際 dispatchEvent submit）
  - 邊界檢查：S5/S6/S7（`tests/integration/navbar/`、`tests/integration/notifications/`、`tests/integration/profile/`、`tests/integration/weather/`）`npx eslint` exit 0；repo-wide `npx eslint src specs tests` 殘留 12 raw / 7 unique `no-node-access`，**全分布於 S8 scope**（無漂移到其他 domain）。
- **本輪做了什麼**：
  1. 主 agent 跑 fresh audit（`npx eslint --format json` + `node` JSON 解析）+ Read 五個 target 檔 + 對應 production component（PostCard / PostsPageScreen / RunsRouteMapInner / EventCreateForm / EventEditForm / ToastContainer），收集 verbatim source line + line:col + production affordance。
  2. 依 plan §5 Phase 4.2 / 4.6 / 4.7 與 §8.2 S8「🧺 小量收尾雜項」，追加 `tasks.md` Session 8 T42–T48（含 Session 8 Fresh Audit 摘要、Parallelism 表、Task 拆分、DOD、SOP）。
  3. 確認 S8 修法分配：
     - T42 preflight Explore（read-only, sequential gate）
     - T43 PostFeed feed wrapper（修法 C，加 testid，§2.51）
     - T44 PostCard like button（修法 A，加 aria-label + aria-pressed，§2.50）
     - T45 RunsRouteMap null render（純測試重構，刪 container 解構 + 補 polyline 斷言，§2.52）
     - T46 EventCreateForm（修法 A，aria-labelledby + h2 id，§2.53 / §2.54）；EventEditForm 不動
     - T47 ToastContainer（修法 A，role region + aria-label，§2.55）
     - T48 closeout + handoff update（獨占；首次驗 repo-wide `npx eslint src specs tests` exit 0）
  4. 並行設計：T42 preflight 獨佔 → Wave 1 = T43 + T44（posts，並行）→ Wave 2 = T45 + T46（strava + toast，並行）→ Wave 3 = T47（toast-container，獨佔保 dirty 控管）→ T48 closeout 獨佔。同時最多 4 subagents（2 Engineer + 2 Reviewer 配對）。
  5. 補本檔 §2.49–§2.55 七個新坑（line drift 持續、PostCard aria-label 取捨、PostFeed testid 唯一可行、RunsRouteMap null render 等價斷言、crud-toast dispatchEvent 繞 native validation、`<form>` implicit role 啟用條件、ToastContainer region 不採 status）。
  6. 主 agent commit bridge：暫關 `eslint.config.mjs:400` `'testing-library/no-node-access'` `error → off` → commit `tasks.md` / `handoff.md` / `eslint.config.mjs` → 立即恢復 `error`。**只**改該行 rule level，不動其他 ESLint config / code / tests。
- **待執行**：
  - T42 Session 8 preflight audit（read-only Explore，獨占）
  - T43 PostFeed feed wrapper testid + cleanup（Wave 1 並行 with T44）
  - T44 PostCard like button aria-label + cleanup（Wave 1 並行 with T43）
  - T45 RunsRouteMap container/firstChild cleanup — pure test（Wave 2 並行 with T46）
  - T46 crud-toast EventCreateForm aria-labelledby + cleanup（Wave 2 並行 with T45）
  - T47 ToastContainer role + aria-label + cleanup（Wave 3 獨占）
  - T48 Session 8 closeout + handoff update（獨占）
- **commit 狀態**：本規劃 session commit 包含 `tasks.md` / `handoff.md` / `eslint.config.mjs`（commit bridge 後恢復 `error`）。Commit 完成後主 agent 立刻把 `eslint.config.mjs:400` 從 `off` 改回 `error`，下個 session 接手時應只看到 `M eslint.config.mjs` dirty。

### Session 8（posts + toast + strava）— 完成

- **Started / Closed**: 2026-04-29
- **狀態**：✅ T42–T48 完成；Phase 4 全清；repo-wide `npx eslint src specs tests` exit 0 首次達成；`testing-library/no-node-access` count = 0。
- **T42–T48 task 結果**：
  - T42 preflight：前置回報 PASS；scoped evidence 支持 T43/T44，且發現磁碟狀態已含 T45/T46 落地修改（§2.58）。
  - T43 PostFeed feed wrapper：`src/ui/posts/PostsPageScreen.jsx` 加 `data-testid="post-feed"`；`tests/integration/posts/PostFeed.test.jsx` 改用 `screen.getByTestId('post-feed')`。Reviewer PASS（使用者回報）；T48 fresh scoped ESLint exit 0；Vitest `PostFeed.test.jsx` exit 0，9 tests passed。
  - T44 PostCard like button：`src/components/PostCard.jsx` like button 加 `aria-label="按讚"` + `aria-pressed`；`PostDetail.test.jsx` 改 role query；`PostCard.test.jsx` 回歸一起跑。Reviewer PASS（使用者回報）；T48 fresh scoped ESLint exit 0；Vitest `PostDetail.test.jsx` + `PostCard.test.jsx` exit 0，26 tests passed。
  - T45 RunsRouteMap null render：純測試重構，移除 `container.firstChild`，補 `queryByTestId('polyline')` 負面斷言。Reviewer PASS（使用者回報）；T48 fresh scoped ESLint exit 0；Vitest `RunsRouteMap.test.jsx` exit 0，4 tests passed。
  - T46 crud-toast EventCreateForm：`src/ui/events/EventCreateForm.jsx` form 加 `aria-labelledby="event-create-form-title"`，h2 加 matching id；測試保留 native `dispatchEvent`。Reviewer PASS（使用者回報）；T48 fresh scoped ESLint exit 0；Vitest `crud-toast.test.jsx` exit 0，17 tests passed。
  - T47 ToastContainer：`src/components/ToastContainer.jsx` outer wrapper 加 `role="region"` + `aria-label="通知列表"`，保留 `aria-live` / `aria-relevant`；測試改 `getByRole('region', { name: '通知列表' })`。Scoped Reviewer PASS（使用者回報）；T48 fresh scoped ESLint exit 0；Vitest `toast-container.test.jsx` exit 0，4 tests passed。
  - T48 closeout：fresh verification 全綠；本檔 §0 / §2.58–§2.62 / §4 Session 8 完成段 / §5 Phase 5 checklist 已更新；未 `git add` / commit / push。
- **Fresh verification（T48 closeout 實測 2026-04-29）**：
  - `git status --short`: exit 0；T48 更新前 dirty 10 檔（`eslint.config.mjs` + 4 production + 5 test）。更新本檔後預期 dirty 11 檔。
  - `git diff --name-only`: exit 0；T48 更新前列出同 10 檔。
  - `npx eslint tests/integration/posts/ tests/integration/toast/ tests/integration/strava/ --format stylish`: exit 0。
  - `npx eslint tests/integration/notifications/ tests/integration/navbar/ tests/integration/profile/ tests/integration/weather/ --format stylish`: exit 0（S5/S6/S7 boundary 不退）。
  - `rg -n "'testing-library/(prefer-user-event|no-node-access)':" eslint.config.mjs`: exit 0；line 399 / 400 皆 `'error'`。
  - `npx eslint src specs tests > /tmp/s8-t48-repo-wide.txt 2>&1; eslint_status=$?; echo "exit=$eslint_status"; rg -c "testing-library/no-node-access" /tmp/s8-t48-repo-wide.txt; exit $eslint_status`: exit 0，輸出 `exit=0`。原 prompt 的 `status=$?` 在 zsh 失敗（§2.61），已用 `eslint_status` 重跑取得真實 ESLint exit。
  - `grep -c "testing-library/no-node-access" /tmp/s8-t48-repo-wide.txt`: 輸出 `0`（grep 0 match 時 exit 1；§2.62）。
  - `npx vitest run tests/integration/posts/PostFeed.test.jsx tests/integration/posts/PostDetail.test.jsx tests/integration/posts/PostCard.test.jsx tests/integration/strava/RunsRouteMap.test.jsx tests/integration/toast/crud-toast.test.jsx tests/integration/toast/toast-container.test.jsx`: exit 0；Test Files 6 passed / Tests 60 passed。
- **收斂數字**：S8 scope 7 unique / 12 raw `testing-library/no-node-access` → 0；repo-wide `testing-library/no-node-access` → 0；repo-wide ESLint → exit 0。
- **動到的 production component（4）**：`src/ui/posts/PostsPageScreen.jsx`、`src/components/PostCard.jsx`、`src/ui/events/EventCreateForm.jsx`、`src/components/ToastContainer.jsx`。
- **動到的 test 檔（5）**：`tests/integration/posts/PostDetail.test.jsx`、`tests/integration/posts/PostFeed.test.jsx`、`tests/integration/strava/RunsRouteMap.test.jsx`、`tests/integration/toast/crud-toast.test.jsx`、`tests/integration/toast/toast-container.test.jsx`。
- **新坑紀錄**：§2.58（磁碟狀態比描述更前進）/ §2.59（T47 scoped diff）/ §2.60（ToastContainer region + aria-live）/ §2.61（zsh `status` read-only）/ §2.62（`rg -c` 0 match 行為）。
- **Phase 5 開工建議**：先重跑 repo-wide verification（ESLint 0 已達成但需 fresh re-run、full browser Vitest、type-check、pre-commit full gate），再 push branch + 開 PR。PR description 應明列 rule baseline 89 → 0、Session 1–8 scope、repo-wide ESLint exit 0、browser/server/type-check/pre-commit evidence；merge 後按 §5 worktree sync SOP。
- **commit 狀態**：T48 未 `git add` / commit / push。Phase 5 統一處理 dirty worktree。

---

### Session 9 規劃（repo-wide verification + PR）— 完成

- **Started / Closed**: 2026-04-29
- **狀態**：✅ 規劃完成；⏳ T49–T57 尚未執行。下一 session 直接照 `tasks.md` Session 9 派 Engineer/Reviewer。
- **前置事實（本規劃 fresh check）**：
  - `git status --short`: 乾淨。
  - `git log -1 --oneline`: `3e987f9 Finish testing-library DOM cleanup`。
  - `.husky/pre-commit`: 實際命令為 `npm run lint -- --max-warnings 0` → `npm run type-check` → `npm run depcruise` → `npm run spellcheck` → `npx vitest run --project=browser`。
  - `.codex/rules/sensors.md`: commit 前主要依 Husky pre-commit 執行 full lint/type-check/depcruise/spellcheck/browser Vitest；IDE diagnostics 若本 session tool 不可用，Reviewer 需明確標示無法執行。
- **本輪做了什麼**：
  1. 依 plan §5 Phase 5 Task 5.1–5.6 與 §8.2 S9，追加 `tasks.md` Session 9 T49–T57。
  2. 每個 task 都寫入 Engineer prompt、Acceptance Criteria、Reviewer 驗收指令、Failure recovery。
  3. 明確規定 Session 9 從頭到尾不准主 agent 做：主 agent 不跑指令、不改檔、不修 code/test、不 git add/commit/push，只能派 Engineer/Reviewer 與彙整回報。
  4. 並行設計：同時最多 4 subagents（2 Engineer + 2 Reviewer），只適用於 T50–T53 互不寫檔的 verification wave；T54 commit、T55 push/PR、T56 post-merge sync、T57 closeout 全部獨占。Reviewer 必須在同任務 Engineer 完成後跑。
  5. 補本檔 §2.63–§2.67：舊 dirty list 過時、main agent 不修 failure、pre-commit 不准 `--no-verify`、push/PR/sync 獨占、server test emulator/env 坑。
- **新增 task 範圍**：
  - T49 fresh preflight / scope audit（read-only）
  - T50 repo-wide ESLint 0
  - T51 full browser Vitest
  - T52 server Vitest
  - T53 type-check + depcruise + spellcheck
  - T54 pre-commit gate + commit
  - T55 push + PR
  - T56 post-merge worktree sync SOP
  - T57 closeout + handoff update
- **待執行**：T49–T57 全部尚未跑。若任何 verification fail，Reviewer 回報 failing command/log/檔案；主 agent 只重派 Engineer，不自行修。涉及 code/test behavior 的 fix 要先取得用戶確認。
- **commit 狀態**：本規劃 session 只修改 `specs/024-eslint-testing-lib-cleanup/tasks.md` 與 `specs/024-eslint-testing-lib-cleanup/handoff.md`；不 `git add` / commit / push。

## 5. 下個 Session 開工 checklist — Phase 5 repo-wide verification + PR

進 Phase 5 前，先讀本檔 §0、§2.63–§2.67、§4 Session 9 規劃段，然後照 `tasks.md` Session 9 T49–T57 派 subagents。Phase 4 實作已結束，下一 session 不再做 S8 修法。

- [ ] **T49 — fresh preflight / scope audit**：Engineer + Reviewer 確認 branch、latest commit、clean tree、rule level、pre-commit 實際命令。若 dirty 或 commit drift，停止回報。
- [ ] **T50 — repo-wide ESLint 0**：Engineer 跑 `npx eslint src specs tests`；Reviewer 重跑並確認 `testing-library/` count 0。0 match count 用 `grep -c ... || true` 或顯式 fallback。
- [ ] **T51 — full browser Vitest**：Engineer 跑 `npm run test:browser`；Reviewer 重跑並記錄 files/tests pass count。
- [ ] **T52 — server Vitest**：Engineer 跑 `npm run test:server`；Reviewer 區分 test failure vs emulator/environment blocker。
- [ ] **T53 — static gates**：Engineer 跑 `npm run type-check`、`npm run depcruise`、`npm run spellcheck`；Reviewer 分別驗 exit code。
- [ ] **T54 — pre-commit gate + commit（獨占）**：T50–T53 全 PASS 後才派。確認 scope → commit；pre-commit fail 不准 `--no-verify`，回到對應 task/fix Engineer。
- [ ] **T55 — push + PR（獨占）**：PR description 必含 baseline/cleanup summary、ESLint/browser/server/type-check/depcruise/spellcheck/pre-commit evidence、post-merge npm install/worktree sync SOP。
- [ ] **T56 — post-merge sync SOP（獨占，PR merge 後才做）**：main pull + `npm install`，逐一檢查/rebase worktrees；dirty/conflict 停止回報，不自動覆蓋。
- [ ] **T57 — closeout + handoff update（獨占 docs）**：更新 §0 / §2 / §4 / §5；若 T56 未執行，標示 post-merge sync pending。
- [ ] 全程保持：主 agent 不跑指令、不改檔、不修 failure；每個 Engineer 完成後都配 Reviewer，不通過就重派直到 PASS。涉及 code/test behavior 的 fix 先問用戶。
- [ ] 保持 `testing-library/prefer-user-event` / `testing-library/no-node-access` 皆為 `error`；不得為了 commit 或 PR 關 rule、加 broad ignore、或加 eslint-disable。

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
