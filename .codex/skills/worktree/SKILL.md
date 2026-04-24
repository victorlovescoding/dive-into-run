---
name: worktree
description: Create or set up a git worktree for this repo when the user asks to open a new worktree, start work in an isolated branch, or prepare a parallel workspace. Computes the next NNN-description name, creates the worktree, copies .env, opens the editor, and starts npm install.
---

# Worktree

Use this skill when the user wants a new git worktree for this repository.

## What this skill does

It automates the repo's preferred worktree flow:

1. Resolve the target worktree name.
2. Create the worktree from the requested base branch or `main`.
3. Copy `.env` into the new worktree.
4. Open the new worktree in the requested editor or VS Code by default.
5. Start `npm install` in the background.

## Inputs

- Primary input: the user's requested description or branch name.
- Optional overrides:
  - base branch, if the user explicitly asks for one
  - editor, if the user explicitly asks for `antigravity`

## Naming rules

- Preferred feature name format: `NNN-description`
- If the input already starts with `NNN-`, use it as-is.
- If the input starts with `chore/`, `fix/`, or `hotfix/`, use it as-is.
- Otherwise, convert the input into kebab-case and prefix it with the next available 3-digit number.
- To compute the next number, scan both:
  - `specs/` directories matching `^[0-9]{3}-`
  - existing git worktree branch names matching `^[0-9]{3}-`

## Execution

Run this script from the repo root:

```bash
bash .codex/skills/worktree/scripts/create_worktree.sh "<input>" "<base-branch>" "<editor>"
```

Defaults:

- base branch: `main`
- editor: `code`

## Required behavior

- Respond in Traditional Chinese and keep output terse.
- Do not ask for confirmation for naming, base branch, or editor unless the request gives no usable description at all.
- If the user gives no usable description and there is no task context to infer from, ask one question: `worktree 要做什麼？`
- The target path must be `../dive-into-run-<name>`.
- Because this writes outside the current repo root and may launch a GUI app, request escalated execution before running the script.
- If worktree creation fails, report the exact failure and stop.
- If editor launch fails, report it but do not treat it as fatal.
- If `.env` is missing, report that clearly but continue.

## Output format

After the script succeeds, report:

```text
Worktree: ../dive-into-run-<name>
Branch: <name> (based on <base-branch>)
Editor: <chosen editor>
npm install: running...
```
