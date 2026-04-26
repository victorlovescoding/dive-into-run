---
paths:
  - 'specs/**'
  - '**/*.test.*'
  - '**/*.spec.*'
---

# Testing Standards (Kent C. Dodds / Testing Trophy)

> 完整測試手冊 → `.claude/references/testing-handbook.md`

- **Integration (60%)** / **Unit (20%)** / **E2E (20%)**
- Test location（Phase 1-3 並存期）:
  - 新增測試: `tests/{unit/<layer>,integration/<domain>,e2e}/<name>.test.js`
  - 既有測試: `specs/<feature>/tests/[unit|integration|e2e]/` 仍接受，由 Phase 1-3 統一遷出
    - `<feature>` 對應 git 分支名稱（e.g. `003-strict-type-fixes`）
- Test results: `tests/test-results/[unit|integration|e2e]/`（legacy: `specs/<feature>/test-results/`）
- Unit tests: AAA pattern, F.I.R.S.T principles, 100% isolated (mock Firebase with `vi.mock`)
- Integration tests: **must** use `@testing-library/user-event` (`userEvent.setup()`). Never `fireEvent`. Use `screen.getByRole` over `container.querySelector`
- E2E tests: `page.getByRole`/`page.getByText` for locators. No `page.waitForTimeout()`
- Assertions: `@testing-library/jest-dom` matchers
