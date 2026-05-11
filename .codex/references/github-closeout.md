# GitHub Closeout

> Last-Verified: 2026-05-11

This is the current Git/PR/CI closeout SOP for this repo.

## Rules

- Never commit or push directly on `main`.
- `main` is protected. All changes enter through PR + required checks.
- Commit messages must not include `Co-Authored-By`.
- In multi-worktree flows, use `git -C <absolute-path> ...`; do not rely on
  implicit `cd` state across commands.
- Push feature branches with `git push -u origin HEAD`.
- Required checks are `ci` and `e2e`; both must be completed and successful.
- Merge on GitHub after required checks pass.
- After merge, prune and fast-forward local `main`.

## Standard Flow

```bash
git -C /Users/chentzuyu/Desktop/dive-into-run switch main
git -C /Users/chentzuyu/Desktop/dive-into-run pull --ff-only origin main
git -C /Users/chentzuyu/Desktop/dive-into-run switch -c <type>/<description>

# edit, verify, stage, commit
git -C /Users/chentzuyu/Desktop/dive-into-run push -u origin HEAD
```

Open the PR, then wait until both required checks are complete and green:

- `ci`
- `e2e`

Merge on GitHub only after both checks are successful. Do not use a local
feature-branch merge into `main` as the default closeout path.

After the GitHub merge:

```bash
git -C /Users/chentzuyu/Desktop/dive-into-run fetch --prune
git -C /Users/chentzuyu/Desktop/dive-into-run switch main
git -C /Users/chentzuyu/Desktop/dive-into-run pull --ff-only origin main
```

For other worktrees, inspect `git worktree list` and rebase each non-main
worktree intentionally with `git -C <path> rebase main` when appropriate.

## Failure Path Runbook

Push rejected:

1. Run `git -C <path> status --short --branch` and confirm the branch.
2. Run `git -C <path> fetch origin`.
3. If the remote branch moved for expected upstream PR work, rebase with
   `git -C <path> rebase origin/<branch>` and rerun changed-surface
   verification.
4. Stop and ask if the rejection implies force push, unknown remote commits,
   protected branch rules, or credentials/permission changes.

PR check `ci` failed:

1. Open the failing job logs and identify the first failing command.
2. Reproduce locally with the closest command from `.codex/rules/sensors.md`.
3. Fix only owned scope, rerun the failed gate and changed-surface gates, then
   push the same PR branch.
4. Stop and ask if the failure points to a flawed plan, unrelated existing
   breakage, missing secret, external service outage, or required scope
   expansion.

PR check `e2e` failed:

1. Inspect the trace/log and classify as product regression, test bug, or
   likely flake.
2. For likely flake, rerun the failed job once using the GitHub UI or approved
   Actions command and record the run ID.
3. For reproducible failure, run the focused Playwright/emulator command
   locally, fix owned scope, rerun `npm run audit:playwright-official-only` and
   the focused E2E gate, then push.
4. Stop and ask after a second failure with the same symptom, any auth/data
   dependency uncertainty, or when fixing requires non-owned files.

Merge conflict or stale branch:

1. Fetch `origin/main` and inspect conflicts before editing.
2. Rebase the feature branch onto `origin/main` only when conflicts are inside
   owned files and the resolution is mechanical.
3. Rerun all changed-surface verification because the head SHA changed.
4. Stop and ask when conflicts touch non-owned files, lockfiles, generated
   artifacts, schema/security/rules, or the resolution changes behavior beyond
   the approved task.

Local fast-forward fail after GitHub merge:

1. Run `git -C <main-path> status --short --branch`.
2. If local `main` has no local commits and the tree is clean, run
   `git -C <main-path> fetch --prune` then
   `git -C <main-path> pull --ff-only origin main`.
3. Stop and ask before stashing, resetting, deleting, or overwriting local
   changes, or when local `main` contains commits not on `origin/main`.
