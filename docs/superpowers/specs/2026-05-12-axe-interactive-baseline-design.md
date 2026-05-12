# axe interactive baseline design

> Date: 2026-05-12
> Status: approved design
> Scope: PR C, event comment interactive axe baseline

## 1. Problem / goal

現有 `axe-interactive-emulator.spec.js` 只掃 authenticated event comment edit dialog，且 `attachAxeReportOnly()` 只 attach raw JSON 與 normalized signatures，不會阻擋 regression。PR C 的目標是把 interactive axe 從純 report-only 升級成「只 fail 新增 normalized violation signature」。

設計採用已 approved 的 `coverage + baseline compare`：

- 補足第一版留言互動狀態 coverage。
- 每個 state 仍輸出 raw axe JSON 與 summary artifact。
- repo 只保存人工審核過的 normalized baseline。
- 既有 signature 繼續 report-only；新增 signature fail test。

## 2. Non-goals

- 不把所有 axe violation 直接變 hard gate。
- 不把 raw axe JSON、Playwright report、`reports/**` 或下載 artifact commit 進 repo。
- 不宣稱 axe 等同完整 WCAG 合規；keyboard trap、流程語意、文案清晰度、實際螢幕閱讀器體驗仍需其他測試或人工 review。
- 第一版不覆蓋 login、join/leave、create event submit。
- 不改 production code、Firebase schema/security rules、package dependency、workflow 或 AGENTS。

## 3. Proposed approach

新增一個 baseline compare helper，沿用現有 axe normalization 概念，但把「報告」和「阻擋新增問題」分開：

1. 每個互動 state 先完成穩定 Playwright flow。
2. 執行 axe，產生 raw axe result。
3. 轉成 stable normalized signature，格式以 `rule id + impact + target` 為核心。
4. 讀取人工維護 baseline。
5. `current signatures - baseline signatures` 若非空，test fail。
6. baseline 內已知 signatures 不 fail，但 summary artifact 必須列出。
7. 無論 pass/fail，仍 attach raw 與 summary artifacts 供 debug。

helper 命名可保留 report-only helper，另新增 compare helper，避免未導入 baseline 的 smoke routes 被誤升 hard gate。

## 4. Coverage states

第一版只覆蓋 event comment 互動 states：

| State label | Required UI state | Evidence source |
| --- | --- | --- |
| `event-comment-empty-submit-disabled` | 已登入進入 `/events/test-event-comments`，留言 textbox 空值，`送出` button disabled | `event-comments.spec.js` empty submit flow |
| `event-comment-create-filled-input` | 已登入進入 event detail，留言 textbox 填入唯一文字，`送出` button enabled；可選擇在 create 後 state 掃描，但 label 必須穩定 | `event-comments.spec.js` create comment flow |
| `event-comment-edit-dialog` | 已登入，開啟既有留言的編輯 dialog，textbox 有值 | current `axe-interactive-emulator.spec.js` |
| `event-comment-delete-confirm-dialog` | 已登入，建立可刪留言或使用可控 fixture，開啟刪除確認 dialog，顯示 `確定刪除留言？` | `event-comments.spec.js` delete confirm flow |

暫緩 states：

- login form empty/invalid/submitted/authenticated landing
- join/leave button state、disabled/loading state、participant list
- create event form submit

## 5. Baseline data shape

Raw axe JSON 只存在 Playwright artifact，不進 repo。repo 只存人工審核後的 normalized signature baseline 與 metadata。

建議 repo baseline shape：

```json
{
  "version": 1,
  "generatedFor": "axe-interactive-emulator",
  "entries": [
    {
      "route": "/events/test-event-comments",
      "state": "event-comment-edit-dialog",
      "ruleId": "aria-required-children",
      "impact": "critical",
      "target": "div[role=\"menu\"]",
      "signature": "aria-required-children|critical|div[role=\"menu\"]",
      "reason": "Known existing finding reviewed before PR C hard-gate rollout.",
      "owner": "quality-gates",
      "expiry": "2026-08-12"
    }
  ]
}
```

Rules:

- `signature` 必須由 helper 以同一個 normalization 產生，避免人工手打格式漂移。
- `route` 與 `state` 是 compare scope，同一 signature 不應跨 state 自動放行。
- `reason` 必須說明為何允許既有 finding 留在 baseline。
- `owner` 必須是可追蹤的 team/person label。
- `expiry` 必須是明確日期，用於後續清理或重新審核。

## 6. Compare behavior

- Existing signature: 若 current signature 存在於同 route/state baseline，test pass；summary artifact 標記為 baseline-known。
- New signature: 若 current signature 不在同 route/state baseline，test fail；error message 列出 state、rule id、impact、target、signature。
- Missing previous signature: 不 fail；summary artifact 標記為 no-longer-observed，方便後續 baseline cleanup。
- Raw artifact: 每次都 attach `axe-<state>-raw.json`。
- Summary artifact: 每次都 attach `axe-<state>-summary.json`，至少包含 URL、route、state、violation count、current signatures、baseline-known signatures、new signatures、no-longer-observed signatures。

## 7. Implementation boundaries / owned files

後續 implementation 的預期 owned files：

- `tests/e2e/quality-gates/quality-gate-helpers.js`
- `tests/e2e/quality-gates/axe-interactive-emulator.spec.js`
- baseline 檔案，建議放在 `tests/e2e/quality-gates/axe-interactive-baseline.json`

Read-only context:

- `tests/e2e/_setup/046-quality-gates-global-setup.js`
- `tests/e2e/event-comments.spec.js`
- `.codex/rules/testing-standards.md`
- `.codex/rules/e2e-commands.md`

Forbidden scope:

- production code
- non-quality-gate E2E files
- package scripts or dependencies
- GitHub workflow files
- AGENTS / workflow policy docs
- project-health local backlog files

Stop instead of widening scope if the existing seeded emulator state cannot support the required comment interaction without production or setup changes.

## 8. Verification plan

每個 command 必須分開跑，不用 `&&` 或 `;`。

```bash
git status --short
```

```bash
npm run lint:changed
```

```bash
npm run type-check:changed
```

```bash
CI=1 firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=046-quality-gates npm run test:e2e:emulator -- tests/e2e/quality-gates/axe-interactive-emulator.spec.js"
```

```bash
git diff --check
```

For this design-doc-only slice, required local verification is limited to:

```bash
git status --short
```

```bash
git diff -- docs/superpowers/specs/2026-05-12-axe-interactive-baseline-design.md
```

```bash
git diff --check
```

## 9. Risks / stop conditions

Risks:

- Axe target selectors can change with small DOM shifts, causing noisy signatures.
- Dynamic comment content can produce unstable targets if flows choose non-deterministic elements.
- Baseline can become a permanent allowlist if `reason`, `owner`, and `expiry` are weak.
- Failing only new signatures does not detect all accessibility regressions.
- Raw artifact retention depends on Playwright/GitHub artifact settings, not repo history.

Stop conditions:

- Required state needs production code or fixture setup changes outside the approved owned files.
- Normalized signature format cannot stay stable across repeated local runs.
- Baseline entry lacks route/state, reason, owner, or expiry.
- New dependency, package script change, workflow change, schema/rules change, or broader E2E refactor becomes necessary.
- Emulator test fails for a non-axe reason that points to unrelated pre-existing instability.

## 10. Subagent workflow / closeout plan

1. Engineer implementation subagent receives a narrow task contract with the owned files above.
2. Engineer updates helper, interactive spec, and baseline only; it reports changed files, exact verification commands, exit codes, and diff summary.
3. Reviewer subagent inspects the task-local diff against this design and reruns or validates the targeted verification.
4. Main agent stages concrete files only after Reviewer pass.
5. Main agent creates an atomic commit without `Co-Authored-By`.
6. Main agent pushes the feature branch and opens a PR.
7. PR waits for required `ci` and `e2e` checks to pass.
8. Main agent merges on GitHub only after green required checks and authorization.
9. Main agent fast-forwards local `main` to `origin/main` only as the final authorized closeout step.
