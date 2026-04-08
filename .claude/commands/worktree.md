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

- If `$ARGUMENTS` contains a worktree name (non-empty), use it directly.
- If `$ARGUMENTS` is empty or only contains a task description:
  - If it's a task description, suggest a short kebab-case name based on it (e.g. `calendar-filter`).
  - If completely empty, ask the user: "worktree 要叫什麼名字？描述一下任務我幫你取也行。"
  - Wait for user confirmation before proceeding.

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
