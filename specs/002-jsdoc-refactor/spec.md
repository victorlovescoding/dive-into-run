# Feature Specification: JSDoc Refactor for Firebase Events

**Feature Branch**: `002-jsdoc-refactor`  
**Created**: 2026-02-07  
**Status**: Completed  
**Input**: User description: "我想針對@src/lib/firebase-events.js 進行符合現有coding style和JSDoc規則的重構 請參考@prd/002-jsdoc-refactor/firebase-events-issues.md 這裡面有所有需要改的錯誤 並且參考和@src/lib/firebase-events.js 有關連的檔案以利撰寫JSDoc 分支名稱請叫做「002-jsdoc-refactor」"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Code Quality & Compliance (Priority: P1)

As a developer, I want `src/lib/firebase-events.js` to be free of linting errors and warnings, and to have complete JSDoc documentation, so that I can maintain the code easily and get correct type hints in my IDE.

**Why this priority**: High. The project has a zero-warning policy (Goal), and this file currently has 50 issues.

**Independent Test**:

1. Run `npx eslint src/lib/firebase-events.js`.
2. Verify output shows **0 problems**.

**Acceptance Scenarios**:

1. **Given** the current codebase, **When** I run `npx eslint src/lib/firebase-events.js`, **Then** it should return no errors or warnings.
2. **Given** any exported function in `firebase-events.js`, **When** I hover over it in VS Code, **Then** I should see a description, parameter types, and return type.

### Edge Cases

- **Destructuring Removal**: When fixing `no-unused-vars`, ensure that variables extracted to be _excluded_ from the `...rest` object are still extracted (renamed to `_var` if needed), so they don't accidentally leak into the payload.
- **Variable Shadowing**: When renaming the shadowed `doc` variable, ensure the logic inside the `.map()` function remains correct and refers to the document snapshot, not the imported `doc` function.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-000**: **Zero Functional Changes**. The refactoring MUST NOT alter the runtime behavior, logic, or data flow of the application. The goal is purely static analysis compliance and documentation.
- **FR-001**: **Fix Variable Shadowing**. Rename the local `doc` variable in `fetchLatestEvents` and `fetchNextEvents` to `snapshot` or `d` to avoid shadowing the imported `doc` function from `firebase/firestore`.
- **FR-002**: **Fix Unused Variables**. Resolve `no-unused-vars` warnings for `planRoute`, `pace`, `paceText`, `paceMinutes`, `paceSeconds`, `_paceSec`.
  - _Constraint_: If these variables are destructured to _remove_ them from a spread object (e.g., `const { a, ...rest } = obj`), they MUST still be destructured. Rename them to `_variableName` to signal intent to ESLint.
- **FR-003**: **Add Missing JSDoc**. Add complete JSDoc comments to all exported functions (`normalizeEventPayload`, `createEvent`, `fetchLatestEvents`, `queryEvents`, `fetchEventById`, `fetchNextEvents`, `joinEvent`, `leaveEvent`, `fetchParticipants`, `fetchMyJoinedEventsForIds`).
  - **FR-003.1**: Must include `@description` (or simple description text).
  - **FR-003.2**: Must include `@param {Type} name description` for all parameters.
  - **FR-003.3**: Must include `@returns {Type} description` for all return values.
- **FR-004**: **Type Accuracy**. Ensure JSDoc types accurately reflect the code logic and Firestore data structures.
  - `limitCount` should be `number`.
  - `eventId` should be `string`.
  - `user` should be `{ uid: string, [key: string]: any }`.
  - Firestore Timestamps should be denoted as `Timestamp`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `npx eslint src/lib/firebase-events.js` executes with exit code 0 and reports 0 problems.
- **SC-002**: All 10 exported functions have JSDoc comments covering all parameters and return values.
