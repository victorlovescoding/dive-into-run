# Quality Gates Reference

> Last-Verified: 2026-06-05
> Agent-only. Current gate posture.

## Active Local Gates

Pre-commit currently runs:

1. `npm run lint -- --max-warnings 0`
2. `npm run type-check`
3. `npm run depcruise`
4. `npm run spellcheck`

## Active CI Gates

The `ci` job includes a compatibility no-op step for doc freshness, then lint,
type-check, dependency cruiser, spellcheck, and build.

## Dangerous Command Guard

`block-dangerous-commands.js` still prevents bypass patterns such as
`git commit --no-verify`, broad `git add`, force pushes, reset/clean/restore,
and similar destructive commands.
