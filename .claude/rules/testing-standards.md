---
paths:
  - 'specs/**'
  - '**/*.test.*'
  - '**/*.spec.*'
---

# Testing Standards (Kent C. Dodds / Testing Trophy)

> 完整測試手冊 → `.claude/references/testing-handbook.md`

- **Integration (60%)** / **Unit (20%)** / **E2E (20%)**
- Test structure: `specs/<feature>/tests/[unit|integration|e2e]/`
- Test results: `specs/<feature>/test-results/[unit|integration|e2e]/`
  - `<feature>` 對應 git 分支名稱（e.g. `003-strict-type-fixes`）
- Unit tests: AAA pattern, F.I.R.S.T principles, 100% isolated (mock Firebase with `vi.mock`)
- Integration tests: **must** use `@testing-library/user-event` (`userEvent.setup()`). Never `fireEvent`. Use `screen.getByRole` over `container.querySelector`
- E2E tests: `page.getByRole`/`page.getByText` for locators. No `page.waitForTimeout()`
- Assertions: `@testing-library/jest-dom` matchers
