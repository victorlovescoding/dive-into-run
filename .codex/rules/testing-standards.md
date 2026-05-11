---
paths:
  - 'tests/**'
  - 'tests/server/**'
  - '**/*.test.*'
  - '**/*.spec.*'
---

# Testing Standards (Kent C. Dodds / Testing Trophy)

> 完整測試手冊 → `.codex/references/testing-handbook.md`

## Before writing tests

- Read `.codex/references/testing-handbook.md` before adding non-trivial tests.
- Check import boundaries through `.codex/references/quality-gates.md` Test Bucket Rules; the current executable policy still lives at legacy implementation location `specs/021-layered-dependency-architecture/test-buckets/policy.js` until migrated.
- Do not mock internal layers: no `vi.mock('@/lib/**')`, `@/repo/**`, `@/service/**`, or `@/runtime/**` except explicit provider boundaries.
- Do not add flaky patterns: no `toHaveBeenCalledTimes`, fixed `setTimeout` sleeps, `await new Promise(...setTimeout...)`, or `page.waitForTimeout()`. Exact call-count/order assertions are only acceptable when they are the behavior contract and should stay out of dense `waitFor` callbacks.
- Blocking gates: `scripts/audit-mock-boundary.sh`, `scripts/audit-flaky-patterns.sh`, `npm run audit:playwright-official-only`.

- **Integration (60%)** / **Unit (20%)** / **E2E (20%)**
- Test structure:
  - Unit: `tests/unit/<layer>/`
  - Integration: `tests/integration/<domain>/`
  - E2E: `tests/e2e/`
  - Server: `tests/server/<suite>/`
- Shared helpers: `tests/_helpers/`
- Test results: `tests/test-results/[unit|integration|e2e]/`
- Server Vitest tests run from `tests/server/<suite>/...`; existing suites include `tests/server/g8-server-coverage/unit/*.test.js` and `tests/server/rules/*.rules.test.js`.
- Unit tests: AAA pattern, F.I.R.S.T principles, isolated through external-boundary mocks only (for example Firebase SDK with `vi.mock`)
- Testing Library tests must await async queries/events/user interactions, never await sync queries/events, prefer `screen`, avoid `container` and node access, keep `waitFor` free of side effects/multiple assertions/snapshots, and use `userEvent.setup()`. Never `fireEvent`.
- Vitest official gates block focused, disabled, or commented-out tests; require valid assertions (`expect`, `assert`, or rules-test `assertSucceeds`/`assertFails` only under `tests/server/rules/**`); and block identical titles or standalone `expect`.
- Integration tests: use role/label-first queries through `screen` and `@testing-library/user-event`.
- E2E tests: `page.getByRole`/`page.getByText` for locators. No `page.waitForTimeout()`
- Playwright E2E official-only audit blocks `.only`, fixed sleeps, imports of Playwright APIs outside `@playwright/test`, and non-relative/non-builtin helper imports. Prefer locators and web-first assertions; reviewers check preference cases that AST cannot reliably enforce.
- Assertions: `@testing-library/jest-dom` matchers
