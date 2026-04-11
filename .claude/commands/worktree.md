---
description: Create a git worktree with env setup, editor launch, and npm install.
---

## User Input

```text
$ARGUMENTS
```

## Workflow

You are an interactive worktree setup assistant. Follow these steps in order. Respond in Traditional Chinese. Be terse.

### Step 1: Determine worktree name

Worktree 名稱格式統一為 `NNN-description`（與 `specs/` 資料夾對齊）。

1. **算下一個 `NNN`**（每次都要重新掃，不要憑記憶猜）：
   - 掃 `specs/`：執行 `ls specs/`，過濾符合 `^[0-9]{3}-` 的資料夾，取最大數字 → `specs_max`。
   - 掃現有 worktree：執行 `git worktree list`，解析每一行的 branch 名稱，過濾符合 `^[0-9]{3}-` 的，取最大數字 → `worktree_max`。
   - `next_num = max(specs_max, worktree_max) + 1`，zero-pad 到 3 碼（例如 `13` → `"013"`）。
   - **為什麼要同時看 worktree**：有些 feature branch（例如 `013-foo`）還在開發、還沒 merge 回 main、還沒建 `specs/` 資料夾，只看 `specs/` 會拿到過時數字，導致新 worktree 撞號。

2. **決定 description 部分**：
   - `$ARGUMENTS` 已經符合 `^[0-9]{3}-` → 整個當名字用，略過編號計算（使用者明確指定）。
   - `$ARGUMENTS` 以 `chore/`、`fix/`、`hotfix/` 開頭 → 整個當名字用，略過編號（不走 feature 編號慣例）。
   - `$ARGUMENTS` 是 kebab-case 名稱 → 當 description。
   - `$ARGUMENTS` 是自然語言描述 → 根據描述生成一段短的 kebab-case description（例如 `calendar-filter`）。
   - `$ARGUMENTS` 完全空 → 問使用者：「worktree 要做什麼？描述一下我幫你取名。」並等回答。

3. **組合最終名稱** `<NNN>-<description>`（例如 `013-calendar-filter`），回報給使用者並等待確認才進 Step 2。

### Step 2: Determine base branch

- Default base branch: `main`
- Ask the user: "要從哪個 branch 開？（預設 main）" and wait for confirmation.
- If user says "main", "yes", or just confirms, use `main`.

### Step 3: Create worktree

- Run: `git worktree add ../dive-into-run-<name> -b <name> <base-branch>`
- The worktree path should be at `../dive-into-run-<name>` (sibling to current repo).
- If the command fails (e.g. branch already exists), report the error and ask how to proceed.

### Step 4: Copy `.env`

- Run: `cp .env ../dive-into-run-<name>/.env`
- Confirm success.

### Step 5: Open editor

- Ask the user: "要開 VS Code 還是 Antigravity？"
- Wait for answer.
- VS Code: run `code ../dive-into-run-<name>`
- Antigravity: run `antigravity ../dive-into-run-<name>`
- If the command fails, report and continue.

### Step 6: Install dependencies

- Run `cd ../dive-into-run-<name> && npm install` in the background.
- Tell the user npm install is running and they can start working.

### Step 7: Summary

Print a summary:

```
Worktree: ../dive-into-run-<name>
Branch: <name> (based on <base-branch>)
Editor: <chosen editor>
npm install: running...
```

## Rules

- Always wait for user confirmation at decision points (name, base branch, editor).
- Do NOT proceed past a decision point without user input.
- Keep all output concise.
