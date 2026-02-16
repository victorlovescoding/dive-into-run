# Feature Specification: Refactor Events Page for Strict Standards

**Feature Branch**: `003-strict-type-fixes` (No new branch created per request)
**Created**: 2026-02-16
**Status**: Draft
**Input**: User description: "我要建立一個 Spec。 目標是重構 src/app/events/page.jsx 以符合專案的 GEMINI.md Strict Standards。 主要需求： 1. Extract Component: 將 page.jsx 中的複雜按鈕邏輯 (IIFE) 抽離至獨立元件 src/components/EventActionButtons.jsx。 2. Strict Compliance: 移除所有 eslint-disable (A11y)，修復相關 HTML 結構 (如 label, role)。 3. Clean Code: 清理所有 MVP 遺留的 Unused Variables (Filter State)。 4. Documentation: 為所有函式補上 Meaningful JSDoc。重點在於確保重構後的代碼可讀性與規範合規性。"

## Clarifications

### Session 2026-02-16
- Q: Scope of Filter State Cleanup? → A: Strict Linter Only. Remove only variables that trigger "no-unused-vars" (e.g., `filterHostText`, `filterRegStart` if unused). Keep working filters. Existing functionality must not break.
- Q: Rendering Strategy for `EventActionButtons`? → A: Parent Control. Parent checks conditions (e.g., `user` exists) and renders component conditionally. Component always returns markup.
- Q: Type Safety Strategy? → A: Strict JSDoc. All props must have `@typedef` and `@param` definitions. Use `import('react').ReactElement` return types. No `any`.
- Q: Structure of `EventActionButtons` Component? → A: Function Component. Standard React functional component.
- Q: Styling Strategy for New Component? → A: New CSS Module. Create `EventActionButtons.module.css` and migrate relevant styles.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extract Event Action Buttons (Priority: P1)

As a developer, I want the event action buttons logic extracted to a separate component so that `page.jsx` is more readable, maintainable, and adheres to the Single Responsibility Principle.

**Why this priority**: The current implementation uses a complex IIFE inside the JSX return statement, which is a violation of clean code practices and makes the component hard to read and test.

**Independent Test**: Can be verified by rendering the new `EventActionButtons` component in isolation with various props (mocked user, event data) and ensuring it renders the correct buttons (Join/Leave/Full/Login required).

**Acceptance Scenarios**:

1. **Given** a user is not logged in, **When** the component renders, **Then** it should display a "Login to join" hint or nothing (depending on current behavior).
2. **Given** a user is logged in and is the host, **When** the component renders, **Then** it should not display Join/Leave buttons.
3. **Given** a user is logged in and not the host, **When** the event is full and user not joined, **Then** it should display "Full".
4. **Given** a user is logged in and has joined, **When** the component renders, **Then** it should display "Leave Event" button.
5. **Given** a user is logged in and has not joined (and not full), **When** the component renders, **Then** it should display "Join Event" button.

---

### User Story 2 - Strict Compliance & A11y Fixes (Priority: P1)

As a developer, I want all ESLint disable comments removed and A11y issues fixed so that the codebase meets strict project standards and is accessible.

**Why this priority**: High priority to ensure code quality and accessibility compliance as per project mandates.

**Independent Test**: Run `npm run lint` on the refactored files.

**Acceptance Scenarios**:

1. **Given** the refactored `page.jsx`, **When** I run `npm run lint`, **Then** it should pass with zero errors and zero warnings.
2. **Given** the new `EventActionButtons.jsx`, **When** I run `npm run lint`, **Then** it should pass with zero errors and zero warnings.
3. **Given** interactive elements (like custom buttons or divs with click handlers), **When** inspected, **Then** they should have appropriate `role`, `tabIndex`, and `onKeyDown` handlers.

---

### User Story 3 - Clean Code & Documentation (Priority: P2)

As a developer, I want unused MVP variables removed and all functions documented with JSDoc so that the code is clean, efficient, and self-documenting.

**Why this priority**: Improves maintainability and reduces technical debt.

**Independent Test**: Code review and static analysis.

**Acceptance Scenarios**:

1. **Given** `page.jsx`, **When** inspected, **Then** it should not contain unused variables related to incomplete filter features (e.g., `filterHostText`).
2. **Given** any function in `page.jsx` or `EventActionButtons.jsx`, **When** inspected, **Then** it should have a valid JSDoc block explaining its purpose, parameters, and return value.

### Edge Cases

- **Network Failure**: When a user clicks Join/Leave and the network fails, the button should revert to its previous state and an error message should be displayed (handled by existing logic, but refactor must preserve this).
- **Data Loading**: When user data is still loading (auth state undefined), the buttons should not flicker or show incorrect state.
- **Malformed Data**: If event data is missing required fields (e.g. `hostUid`), the component should render nothing or a safe fallback instead of crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST implement `src/components/EventActionButtons.jsx` as a standard React **Function Component** to handle the rendering logic for event actions (Join, Leave, Full, Host view).
- **FR-002**: `EventActionButtons.jsx` MUST accept necessary props: `event`, `user`, `onJoin`, `onLeave`, `isPending`, `isCreating`, `isFormOpen`.
- **FR-003**: `src/app/events/page.jsx` MUST be refactored to use `EventActionButtons` instead of inline IIFE. The parent component (`page.jsx`) MUST be responsible for the high-level conditional rendering (e.g., checking if user exists), while `EventActionButtons` handles the specific button state (Join/Leave/Full).
- **FR-004**: `src/app/events/page.jsx` MUST have all `eslint-disable` comments removed, specifically `jsx-a11y/label-has-associated-control`, `jsx-a11y/control-has-associated-label`, and `jsx-a11y/no-noninteractive-element-interactions`.
- **FR-005**: All form labels MUST have a correct `htmlFor` attribute matching the input `id`.
- **FR-006**: All non-interactive elements with click handlers (e.g., custom backdrops/overlays) MUST have `role="button"` (or appropriate role), `tabIndex`, and `onKeyDown` handlers.
- **FR-007**: Unused state variables for the filter feature (e.g., `filterHostText`, `filterRegStart`, `filterRegEnd`, `filterDistanceMin`, `filterDistanceMax`, `filterPaceMinMin`, `filterPaceMinSec`, `filterPaceMaxMin`, `filterPaceMaxSec`, `filterMaxParticipantsMin`, `filterMaxParticipantsMax`, `filterRunType`) MUST be removed ONLY if they trigger "no-unused-vars" errors and are not part of any currently active logic. Existing working filters MUST be preserved.
- **FR-008**: All exported components and helper functions MUST have strict JSDoc comments (`@param`, `@returns` with specific types). Props interfaces (e.g., `EventActionButtonsProps`) MUST be defined via `@typedef` and applied. Return types MUST be explicit (e.g., `@returns {import('react').ReactElement}`).
- **FR-009**: Create `src/components/EventActionButtons.module.css` and migrate relevant styles (e.g. `.submitButton`, `.leaveButton`, `.soldOutButton`) from `events.module.css` to this new module. The component MUST import and use these styles directly.

### Key Entities

- **EventActionButtons**: New component for event actions.
- **EventData**: Existing entity, passed as prop.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm run lint` passes with 0 errors and 0 warnings for `src/app/events/page.jsx` and `src/components/EventActionButtons.jsx`.
- **SC-002**: `src/app/events/page.jsx` contains NO `eslint-disable` directives.
- **SC-003**: All functions in the target files have JSDoc.
- **SC-004**: The application builds successfully (`npm run build` - or at least compile check).
- **SC-005**: User can still Join and Leave events successfully (Functional Parity).
