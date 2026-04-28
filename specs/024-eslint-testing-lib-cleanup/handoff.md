# Handoff Notes — 024 ESLint Testing-Library Cleanup

> **Live handoff**：只放目前狀態、下一步、最後驗證、下一個 session 會踩到的風險。
> **完整歷史**：已歸檔到 `specs/024-eslint-testing-lib-cleanup/handoff-archive.md`。
> **更新規則**：不要在本檔 append 長篇 session log；舊脈絡、詳細 reviewer evidence、歷史坑請歸檔。

---

## 0. Current State

| Field | Value |
| --- | --- |
| Branch | `024-eslint-testing-lib-cleanup` |
| Worktree path | `/Users/chentzuyu/Desktop/dive-into-run-024-eslint-testing-lib-cleanup` |
| Last confirmed HEAD before this docs cleanup | `c0c3336 Document Session 9 closeout` |
| Local docs cleanup | `handoff.md` reduced to live handoff; original full text copied to `handoff-archive.md`. Commit/push is pending user instruction. |
| Main objective | Push the closeout/docs commits, create PR, wait for merge, then run T56 post-merge sync. |
| Completed | T49-T54 passed/no-op; T55 partially completed because branch push succeeded but PR was not created; T57 closeout commit existed before this cleanup. |
| Blocked | T56 post-merge sync is blocked until PR is merged. Do not run it before merge. |
| Sensors | `testing-library/prefer-user-event` and `testing-library/no-node-access` must stay `error`; repo-wide Testing Library lint count was 0 at closeout. |
| Line drift | User prompts may mention `eslint.config.mjs:395`; check the rule name, not the line number. `no-node-access` was last documented around line 400. |

Next session must treat this file as a guide, not a live sensor. Always run fresh `git status` / `git log` before acting.

---

## 1. Next Session Checklist

1. Read order:
   - `AGENTS.md`
   - this live `handoff.md`
   - `specs/024-eslint-testing-lib-cleanup/tasks.md` Session 9 T49-T57 if task-level detail is needed
   - `handoff-archive.md` only when historical context is needed

2. Fresh local state check:

   ```bash
   git branch --show-current
   git log -1 --oneline
   git status --short
   git diff --name-only
   ```

3. If this docs cleanup is still uncommitted, decide with the user whether to commit it before pushing/PR.

4. Push the closeout/docs commits to `origin/024-eslint-testing-lib-cleanup`.

5. Create PR. PR description should include:
   - baseline and cleanup summary
   - T49-T54 verification evidence
   - T55 partial recovery note
   - T56 post-merge sync pending note

6. Wait for PR merge. Do not run post-merge sync before merge.

7. After merge, run T56 post-merge sync:
   - pull main
   - run `npm install` if lockfile/package state requires it
   - check/rebase other worktrees one by one
   - stop and report dirty worktrees or conflicts; do not auto-stash/reset

---

## 2. Must-Read Risks

| Risk | Why it matters | Action |
| --- | --- | --- |
| zsh `status` is read-only | `status=$?` fails before capturing the real exit code | use names like `eslint_status` / `test_status` |
| `rg -c` with 0 matches exits 1 and may print nothing | 0 Testing Library violations can look like a broken command | use `grep -c ... || true` or explicit `if rg -q` handling |
| Phase 5 failures must go through Engineer/Reviewer loop | User required main agent not to directly fix Phase 5 failures | route failures back to subagents; ask user before behavior/code fixes |
| Pre-commit failure must not be bypassed | `--no-verify` would invalidate the quality gate | diagnose the failing gate; never use `git commit --no-verify` |
| Push / PR / post-merge sync are exclusive tasks | They mutate remote or multiple worktrees | run with parallelism 1; do not overlap with verification/fix agents |
| Server tests need Firebase emulators | Failure may be environment, not cleanup regression | record command, exit code, emulator state, and error summary |
| T49 can be blocked by docs-only dirty files | Planning/handoff docs can make clean-tree preflight fail | separate docs diff from code/test diff; confirm scope before commit |
| T54 can be no-op | Relevant commits may already exist and tree may be clean | do not create empty commits just to satisfy a task label |
| PR before T57/docs cleanup misses closeout docs | PR diff/description can omit latest handoff state | push closeout/docs commits before creating PR |
| T55 partial push is recoverable | Branch was pushed but PR was not created | continue from current branch; do not redo T49-T54 or merge main manually |

---

## 3. Final Evidence

| Task | Status | Evidence |
| --- | --- | --- |
| T49 preflight | PASS after docs-planning commit | branch `024-eslint-testing-lib-cleanup`, clean tree, rules stayed `error` |
| T50 repo-wide ESLint | PASS | `npx eslint src specs tests` exit 0; `testing-library/` count 0; only existing React version warning |
| T51 browser Vitest | PASS | `npm run test:browser` exit 0; 121 files / 1108 tests passed; non-failing jsdom `window.scrollTo` message observed |
| T52 server Vitest | PASS | `npm run test:server` exit 0; 2 files / 26 tests passed; Firebase Auth/Firestore emulators started/shut down cleanly |
| T53 type/deps/spell | PASS | `npm run type-check` exit 0; `npm run depcruise` exit 0 with 0 dependency violations; `npm run spellcheck` exit 0 with 353 files / 0 issues |
| T54 commit gate | PASS/NOOP | no staged/unstaged diff at that time; existing commits `3e987f9 Finish testing-library DOM cleanup` and `7192fb8 Document Session 9 workflow` covered the work |
| T55 push/PR | PARTIAL | branch push to `origin/024-eslint-testing-lib-cleanup` succeeded; PR was not created |
| T56 post-merge sync | NOT RUN | blocked until PR merge |
| T57 closeout | LOCAL DONE before this cleanup | closeout commit existed as `c0c3336 Document Session 9 closeout`; this later docs cleanup still needs its own commit/push decision |

Full historical command output and session narrative are in `handoff-archive.md`.

---

## 4. Pattern Index

These are the durable design/testing lessons worth keeping visible. Full details are archived.

| Pattern | One-line rule |
| --- | --- |
| fake timers + `userEvent` | create the click promise, advance timers, then await the promise; do not fall back to low-level event helpers |
| native `img` error | dispatch native `error`, then `waitFor` React state/fallback rendering |
| raw grep vs executable usage | grep can hit guideline comments; distinguish comments from actual callsites |
| current lint beats old line numbers | line numbers drift after edits; reviewers must use fresh ESLint output |
| unique lint sites | `no-node-access` may duplicate raw problem counts; judge by unique line/column and target range |
| minimal test affordance | add `data-testid` only when semantic queries are not available or would be misleading |
| visual-only marker | pair test hooks like unread dots with `aria-hidden="true"` when the marker is visual-only |
| body scroll lock | `document.body.style.overflow` assertions are allowed when they verify page-level side effect state |
| layout-only wrappers | do not force landmark roles like `main` when layout already owns the landmark |
| like button label | do not override visible count semantics with an aria-label that hides the count from screen readers |
| unnamed form | implicit `role="form"` is not exposed without an accessible name; add `aria-label` / `aria-labelledby` when needed |
| toast container | outer wrapper uses `role="region"`; individual toasts keep `role="status"`; preserve `aria-live` |
| form validation tests | direct `document.querySelector('form')` can be intentional when testing native validation bypass paths |
| map empty render | `queryByTestId('map-container')` plus a positive polyline assertion is clearer than `container.firstChild` |
| baseElement escape hatch | `baseElement.querySelector(...)` is acceptable only for documented layout/DOM surfaces where Testing Library queries cannot express the target |

---

## 5. Archive Map

`handoff-archive.md` is the full pre-cleanup handoff. It contains:

- original §1 verified facts and package/config line notes
- original §2.1-§2.71 pitfall details
- original §3 baseline audit
- original §4 Session 1-9 planning/execution logs
- original environment/glossary notes

Use archive for archaeology, not as the next-session entrypoint.

---

## 6. Environment

| Item | Last documented value |
| --- | --- |
| Node | `v22.22.0` |
| npm | `10.9.4` |
| OS | darwin 24.3.0 |
| ESLint | flat config, package version in `package.json` |
| Husky | package version in `package.json` |
