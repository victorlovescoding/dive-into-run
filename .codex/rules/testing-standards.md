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
- Check import boundaries against `specs/021-layered-dependency-architecture/test-buckets/policy.js`.
- Do not mock internal layers: no `vi.mock('@/lib/**')`, `@/repo/**`, `@/service/**`, or `@/runtime/**` except explicit provider boundaries.
- Do not add flaky patterns: no `toHaveBeenCalledTimes`, fixed `setTimeout` sleeps, `await new Promise(...setTimeout...)`, or `page.waitForTimeout()`.
- Blocking gates: `scripts/audit-mock-boundary.sh` and `scripts/audit-flaky-patterns.sh`.

- **Integration (60%)** / **Unit (20%)** / **E2E (20%)**
- Test structure:
  - Unit: `tests/unit/<layer>/`
  - Integration: `tests/integration/<domain>/`
  - E2E: `tests/e2e/`
  - Server: `tests/server/<suite>/`
- Shared helpers: `tests/_helpers/`
- Test results: `tests/test-results/[unit|integration|e2e]/`
- Server Vitest tests run from `tests/server/**`; g8 server coverage tests live in `tests/server/g8-server-coverage/`.
- Unit tests: AAA pattern, F.I.R.S.T principles, isolated through external-boundary mocks only (for example Firebase SDK with `vi.mock`)
- Integration tests: **must** use `@testing-library/user-event` (`userEvent.setup()`). Never `fireEvent`. Use `screen.getByRole` over `container.querySelector`
- E2E tests: `page.getByRole`/`page.getByText` for locators. No `page.waitForTimeout()`
- Assertions: `@testing-library/jest-dom` matchers
