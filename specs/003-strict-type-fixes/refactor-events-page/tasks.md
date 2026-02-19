# Tasks: Refactor Events Page

**Feature**: Refactor Events Page for Strict Standards (Branch: `003-strict-type-fixes`)
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## Phase 1: Setup & Foundations
*Goal: Prepare the environment and test structures for refactoring.*

- [ ] T001 [P] Create `src/components/EventActionButtons.module.css` and migrate button styles (`.submitButton`, `.leaveButton`, `.soldOutButton`) from `src/app/events/events.module.css`
- [ ] T002 [P] Create test file `tests/003-strict-type-fixes/refactor-events-page/integration/EventActionButtons.test.jsx` with boilerplate code

## Phase 2: User Story 1 - Extract Event Action Buttons
*Goal: Extract complex button logic into a separate, testable component.*

- [ ] T003 [US1] Implement integration test cases in `tests/003-strict-type-fixes/refactor-events-page/integration/EventActionButtons.test.jsx` covering Join, Leave, Full, and Login-required scenarios
- [ ] T004 [US1] Create `src/components/EventActionButtons.jsx` with strict JSDoc `@typedef` for props and basic functional component scaffold
- [ ] T005 [US1] Implement rendering logic in `src/components/EventActionButtons.jsx` to satisfy test cases (consuming `EventActionButtons.module.css`)
- [ ] T006 [US1] Refactor `src/app/events/page.jsx` to import `EventActionButtons` and replace the inline IIFE logic with `<EventActionButtons />`

## Phase 3: User Story 2 - Strict Compliance & A11y Fixes
*Goal: Ensure the page meets strict A11y standards and has zero ESLint disables.*

- [ ] T007 [US2] Fix A11y issues in `src/app/events/page.jsx`: match `label htmlFor` with input `id`, and add `role="button"`, `tabIndex="0"`, `onKeyDown` to non-interactive click elements (Filter Overlay)
- [ ] T008 [US2] Remove all `eslint-disable` comments (specifically `jsx-a11y/*`) from `src/app/events/page.jsx` and verify no lint errors remain in that file

## Phase 4: User Story 3 - Clean Code & Documentation
*Goal: Remove technical debt and enforce strict JSDoc documentation.*

- [ ] T009 [US3] Remove unused filter state variables (e.g., `filterHostText`, `filterRegStart`, etc.) that trigger `no-unused-vars` in `src/app/events/page.jsx`
- [ ] T010 [US3] Add strict JSDoc (`@param`, `@returns`) to all remaining functions in `src/app/events/page.jsx` (handlers, render helpers)

## Phase 5: Final Polish & Verification
*Goal: Verify strict compliance and ensure no regressions.*

- [ ] T011 Run verification on modified files ONLY: `npx eslint src/app/events/page.jsx src/components/EventActionButtons.jsx` && `npx tsc src/app/events/page.jsx src/components/EventActionButtons.jsx --noEmit --allowJs --checkJs --jsx react-jsx --moduleResolution bundler --target esnext --module esnext` && `grep "@ts-ignore" src/app/events/page.jsx src/components/EventActionButtons.jsx`
- [ ] T012 Run E2E tests `tests/003-strict-type-fixes/refactor-events-page/e2e/` to verify functional parity (Join/Leave flows)

## Dependencies
1. **US1 (Extract)**: Must be completed first to isolate the button logic.
2. **US2 (Compliance)**: Depends on US1 completion so we are fixing the *new* page structure. T007 (Fix) must precede T008 (Remove Disables).
3. **US3 (Clean Code)**: Safe to run last. T009 (Cleanup) prevents documenting dead code in T010.

## Implementation Strategy
- **MVP**: Complete Phase 2 (US1) to ensure the core refactor works and integration tests pass.
- **Incremental**: Fix A11y issues (Phase 3) before removing the "ignore" flags.
- **Verification**: Run `npm run type-check` frequently, especially after adding JSDoc in Phase 4.
