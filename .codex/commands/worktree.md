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

Worktree 名稱格式統一為 `NNN-description`（與 `specs/` 資料夾對齊）。**不要問使用者、不要等確認**，自動算好直接往下一步走。

1. **算下一個 `NNN`**（每次都要重新掃，不要憑記憶猜）：
   - 掃 `specs/`：執行 `ls specs/`，過濾符合 `^[0-9]{3}-` 的資料夾，取最大數字 → `specs_max`。
   - 掃現有 worktree：執行 `git worktree list`，解析每一行的 branch 名稱，過濾符合 `^[0-9]{3}-` 的，取最大數字 → `worktree_max`。
   - `next_num = max(specs_max, worktree_max) + 1`，zero-pad 到 3 碼（例如 `13` → `"013"`）。
   - **為什麼要同時看 worktree**：有些 feature branch（例如 `013-foo`）還在開發、還沒 merge 回 main、還沒建 `specs/` 資料夾，只看 `specs/` 會拿到過時數字，導致新 worktree 撞號。

2. **決定 description 部分**（description 為 1-3 個單字的 kebab-case，例如 `calendar-filter`、`event-share-og`）：
   - `$ARGUMENTS` 已經符合 `^[0-9]{3}-` → 整個當名字用，略過編號計算（使用者明確指定）。
   - `$ARGUMENTS` 以 `chore/`、`fix/`、`hotfix/` 開頭 → 整個當名字用，略過編號（不走 feature 編號慣例）。
   - `$ARGUMENTS` 是 kebab-case 名稱 → 當 description。
   - `$ARGUMENTS` 是自然語言描述 → 根據描述生成 kebab-case description。
   - `$ARGUMENTS` 完全空但對話中有明顯任務脈絡 → 從脈絡抽 description，不用問。
   - `$ARGUMENTS` 完全空且對話也沒脈絡 → 這是**唯一**允許問的情況，問一次：「worktree 要做什麼？」

3. **組合最終名稱** `<NNN>-<description>`（例如 `013-calendar-filter`），告知使用者後**直接進 Step 2，不要等確認**。

### Step 2: Determine base branch

- **預設從 `main` 開，不要問使用者**。
- 只有使用者在 `$ARGUMENTS` 明確指定其他 base branch（例如 "based on 012-public-profile"）時才用別的。

### Step 3: Create worktree

- Run: `git worktree add ../dive-into-run-<name> -b <name> <base-branch>`
- The worktree path should be at `../dive-into-run-<name>` (sibling to current repo).
- If the command fails (e.g. branch already exists), report the error and ask how to proceed.

### Step 4: Copy `.env`

- Run: `cp .env ../dive-into-run-<name>/.env`
- Confirm success.

### Step 5: Open editor

- **預設開 VS Code**：執行 `code ../dive-into-run-<name>`，不要問使用者。
- 只有使用者在 `$ARGUMENTS` 明確指定 Antigravity（例如出現 "antigravity" 字樣）才改用 `antigravity ../dive-into-run-<name>`。
- 如果 command 失敗，回報並繼續。

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

- **不要等確認**：name、base branch、editor 都走預設值，除非使用者在 `$ARGUMENTS` 或對話中明確 override，否則直接一路跑完 Step 1 → Step 7。
- 預設值：name 自動算 `NNN-description`、base branch 為 `main`、editor 為 VS Code。
- 唯一允許停下來問的例外：`$ARGUMENTS` 完全空 **且** 對話中沒有可抽取的任務脈絡，問一次「worktree 要做什麼？」即可。
- Keep all output concise.
