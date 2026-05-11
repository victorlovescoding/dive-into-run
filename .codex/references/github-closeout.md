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
