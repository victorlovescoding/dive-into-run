# Quality Gates Reference

> Last-Verified: 2026-05-24
> Agent-only. Current gate posture during the testless reset.

## Active Local Gates

Pre-commit currently runs:

1. `npm run lint -- --max-warnings 0`
2. `npm run type-check`
3. `npm run depcruise`
4. `npm run spellcheck`
5. `npm run workflow:check`
6. `npm run workflow:links`
7. `npm run audit:use-effect-data-fetching`

Test-related gates are disabled:

- browser/server Vitest
- coverage
- branch test routing
- Playwright E2E
- mock-boundary audit
- flaky-pattern audit
- Playwright official-only audit
- Firestore rules test workflow

## Active CI Gates

The `ci` job keeps non-test gates: doc freshness, workflow checks, lint,
useEffect data-fetch audit, type-check, dependency cruiser, spellcheck, and
build.

The `e2e` job name remains present for branch protection compatibility, but it
only reports that the E2E gate is disabled.

The Firestore Rules Gate workflow remains present, but its test execution is
disabled during the testless reset.

## Dangerous Command Guard

`block-dangerous-commands.js` still prevents bypass patterns such as
`git commit --no-verify`, broad `git add`, force pushes, reset/clean/restore,
and similar destructive commands.
