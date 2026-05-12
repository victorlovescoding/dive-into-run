# Gap D4 Baseline Retirement Design

> Last-Verified: 2026-05-12

## Context

Gap D/D4 already has an MVP gate, but the repo still carries a D4 baseline:
14 lint violations across 10 files remain allowed through `eslint.config.mjs`
ignores. The next implementation pass should retire that baseline instead of
normalizing it as permanent policy.

## Success Criteria

- Clear the current 14-violation / 10-file D4 baseline.
- Remove the D4 baseline ignores from `eslint.config.mjs`.
- Update `project-health/2026-04-24-openai-harness-gap-analysis.md` so its D4
  status, counts, and remaining work are accurate after the baseline is gone.
- Reviewer confirms there are zero remaining D4 baseline violations and no
  remaining baseline ignores.

## Scope

- Fix only the files represented by the current D4 baseline.
- Remove only the D4 baseline ignore entries needed to enforce the retired
  baseline.
- Update only the project-health D4 analysis needed to match the resulting
  state.
- Preserve the existing MVP gate shape.

## Non-Scope

- No stronger lint rules.
- No custom full JSX policy.
- No unrelated refactors, source cleanup, dependency changes, package changes,
  specs changes, or broader project-health rewrites.
- No behavioral product changes beyond the minimum edits needed to satisfy the
  existing D4 gate.

## Approved Approach

Use a one-shot baseline retirement. Engineers remove the current D4 violations
in coordinated slices, then delete the matching baseline ignores and update the
health doc. The work should not add stricter rules or create a custom full JSX
policy; success is the existing gate enforcing zero known D4 baseline debt.

## Agent Slicing

1. Nav/shared components
   - Owned files: `MobileDrawer`, `Navbar`, `PostCard`.
   - Goal: clear D4 violations in shared navigation and card UI.

2. Dialog/editor components
   - Owned files: `CommentHistoryModal`, `EventRouteEditor`,
     `RunCalendarDialog`, `FavoritesBar`.
   - Goal: clear D4 violations in dialog, editor, and compact control UI.

3. Events UI plus gate/doc
   - Owned files: `EventsListSection`, `PaceSelector`, `ParticipantsModal`,
     `eslint.config.mjs`,
     `project-health/2026-04-24-openai-harness-gap-analysis.md`.
   - Goal: clear remaining events UI violations, remove D4 baseline ignores,
     and update the project-health analysis.

## Verification

Run each command as fresh evidence:

- `npx eslint src --no-error-on-unmatched-pattern`
- `npm run lint:changed`
- `npm run type-check:changed`
- `git diff --check`

Reviewer must also confirm:

- the 14-violation / 10-file D4 baseline is now zero;
- `eslint.config.mjs` has no remaining D4 baseline ignores;
- the project-health update accurately describes the retired baseline.

## Closeout

Use the existing worktree and keep implementation Engineer-owned. Each slice
needs Reviewer confirmation before closeout. After reviewed implementation and
fresh verification, commit the feature branch, push it, open a PR, wait for
required `ci` and `e2e` to pass, merge on GitHub, then fast-forward local
`main` only after the merge is complete.

## Known Risk

The `gh` CLI token may be invalid. If that blocks PR, CI, or merge operations,
use the GitHub connector if available. Block closeout if neither `gh` nor the
GitHub connector can perform the required GitHub operation.
