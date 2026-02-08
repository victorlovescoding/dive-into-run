# Feature Specification: Strict Type Fixes

status: completed
**Feature Branch**: `003-strict-type-fixes`
**Created**: 2026-02-08
**Status**: Draft
**Input**: User description: "請參考 @prd/003-strict-type-fixes/tsc-errors.md 進行符合checkJs規範的重構 這裡面有所有需要改的錯誤 並且開一個叫做003-strict-type-fixes的分支 並且參考和@src/lib/firebase-events.js 有關連的檔案以利重構 然後我希望之後再修改程式碼的時候絕對不可以改動程式碼的邏輯 必須要維持功能"

## Clarifications

### Session 2026-02-08

- Q: Where should the new JSDoc type definitions be placed? → A: Inline in `src/lib/firebase-events.js` (Option A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Type Safety (Priority: P1)

As a developer, I want the `src/lib/firebase-events.js` file to pass TypeScript `checkJs` validation without errors, so that I can ensure type safety and prevent future regressions.

**Why this priority**: High. Type errors obscure actual bugs and hinder the use of IDE intelligence/refactoring tools.

**Independent Test**: Can be verified by running the `tsc` command on the specific file.

**Acceptance Scenarios**:

1. **Given** the current codebase with 16 known TypeScript errors in `firebase-events.js`, **When** I run `npx tsc src/lib/firebase-events.js --allowJs --checkJs --noEmit ...`, **Then** the output should show 0 errors.
2. **Given** the refactored code, **When** I run the application or existing tests, **Then** the behavior should be identical to the previous version (no logic changes).

### Edge Cases

- **Dynamic Data**: How does the system handle properties that might be missing in Firestore documents (e.g., optional `distanceKm`)?
  - *Resolution*: JSDoc types must correctly reflect optional fields (e.g., `number|undefined`) and code must handle them safely (which it currently seems to do via `|| 0`, but types need to match).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST resolve the module import error for `@/lib/firebase-client` in JSDoc/TypeScript context.
- **FR-002**: System MUST resolve type mismatches for Firestore `QueryConstraint` objects (where, orderBy, limit) when added to the `constraints` array.
- **FR-003**: System MUST define a comprehensive JSDoc type for the `Event` object that includes all accessed properties (`city`, `district`, `remainingSeats`, `maxParticipants`, `participantsCount`, `distanceKm`). **These definitions MUST be placed inline within `src/lib/firebase-events.js` using `@typedef`.**
- **FR-004**: System MUST ensure the `status` field in return objects matches the specific string union types expected by the function signature (e.g., `"full" | "already_joined" | "joined"`), rather than generic `string`.
- **FR-005**: The refactoring MUST NOT alter any runtime logic or control flow. Changes are limited to JSDoc comments, type definitions (`@typedef`), and necessary type assertions (e.g., `/** @type {...} */`).

### Key Entities

- **Event**: A Firestore document representing a running event, containing fields like `time`, `city`, `district`, `maxParticipants`, etc.
- **JoinResult**: The result object returned from join/leave operations, containing `ok` (boolean) and `status` (specific string enum).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The target module `src/lib/firebase-events.js` achieves 100% compliance with strict type checking standards (0 errors reported).
- **SC-002**: The logic structure of the code remains identical to the pre-refactor state, verified by code review and AST comparison if necessary.