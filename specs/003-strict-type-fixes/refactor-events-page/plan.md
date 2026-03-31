# Refactor Events Page Implementation Plan

**Branch**: `003-strict-type-fixes` | **Date**: 2026-02-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-strict-type-fixes/refactor-events-page/spec.md`

## 1. Data Model Changes

- **None**: This refactor does not require changes to the Firestore schema.

## 2. Server-Side Logic (src/lib/)

- **None**: No changes to `firebase-events.js` or `event-helpers.js`. Existing functions will be reused.

## 3. UI Components (src/components/ & src/app/)

### A. `src/components/EventActionButtons.jsx` (New)

- **Purpose**: Encapsulate the complex logic for rendering "Join", "Leave", "Full", and "Host" states.
- **Props Contract (JSDoc)**:
  ```javascript
  /**
   * @typedef {Object} EventActionButtonsProps
   * @property {import('@/lib/event-helpers').EventData} event - The event data object.
   * @property {import('@/lib/firebase-users').User} user - The current logged-in user.
   * @property {(ev: import('@/lib/event-helpers').EventData, e: import('react').MouseEvent) => void} onJoin - Handler for joining.
   * @property {(ev: import('@/lib/event-helpers').EventData, e: import('react').MouseEvent) => void} onLeave - Handler for leaving.
   * @property {boolean} isPending - Whether a join/leave action is in progress.
   * @property {boolean} isCreating - Whether an event creation is in progress (disable actions).
   * @property {boolean} isFormOpen - Whether the form modal is open (disable actions).
   */
  ```
- **Logic**:
  - Check `user` existence -> "Login to join".
  - Check `hostUid` -> Hide buttons if user is host.
  - Check `myJoinedEventIds` (passed via checking logic or prop) -> Show "Leave".
  - Check `remainingSeats` -> Show "Full" if <= 0.
  - Default -> Show "Join".
- **Styles**: Create `EventActionButtons.module.css` and migrate `.submitButton`, `.leaveButton`, `.soldOutButton`, `.buttonSpinner` from `events.module.css`.

### B. `src/app/events/page.jsx` (Refactor)

- **Extract Logic**: Replace the IIFE inside `events.map` with `<EventActionButtons />`.
- **Cleanup State**: Remove unused filter state variables (e.g., `filterPaceMinMin`, `filterHostText`) that trigger ESLint `no-unused-vars`.
- **A11y Fixes**:
  - Remove all `eslint-disable` comments.
  - Fix `jsx-a11y/label-has-associated-control`: Ensure `htmlFor` matches input `id`.
  - Fix `jsx-a11y/no-noninteractive-element-interactions`: Add `role="button"`, `tabIndex="0"`, and `onKeyDown` to the filter overlay backdrop.
- **Documentation**: Add strict JSDoc to `handleSubmit`, `handleJoinClick`, `handleLeaveClick`, `handleToggleCreateRunForm`.

## 4. Quality Assurance & Standards (MANDATORY)

- [ ] **Style Compliance**: Must strictly follow Airbnb Style Guide (no IIFE in JSX, props validation via JSDoc).
- [ ] **JSDoc Contract**: All new and modified functions must have `@param` and `@returns` tags.
- [ ] **Acceptance Gates**:
  - `npx tsc src/app/events/page.jsx src/components/EventActionButtons.jsx --noEmit --allowJs --checkJs --jsx react-jsx --moduleResolution bundler --target esnext --module esnext` (Must be 0 errors).
  - `npx eslint src/app/events/page.jsx src/components/EventActionButtons.jsx` (Must be 0 problems).
  - `grep "@ts-ignore" src/app/events/page.jsx src/components/EventActionButtons.jsx` (Must be empty).
- **Verification**:
  - Run `npx vitest tests/003-strict-type-fixes/refactor-events-page/integration/` (Must PASS).
  - Run `npx playwright test tests/003-strict-type-fixes/refactor-events-page/e2e/` (Must PASS).

## 5. Step-by-Step Implementation Guide

### Step 1: Create Component Structure & Styles (TDD Green)

- **Goal**: Make the Integration Test pass.
- [ ] Create `src/components/EventActionButtons.module.css` and migrate styles.
- [ ] Implement logic in `src/components/EventActionButtons.jsx` to satisfy the test cases (Join/Leave/Full logic).
- [ ] **Verify**: Run Integration Test (`npm test ...`).

### Step 2: Refactor Page Component (Integration)

- **Goal**: Replace legacy code with new component.
- [ ] Import `EventActionButtons` in `page.jsx`.
- [ ] Replace the IIFE block in `page.jsx` with `<EventActionButtons ... />`.
- [ ] Verify functionality manually (dev server) or via E2E check.

### Step 3: Cleanup & A11y Fixes

- **Goal**: Achieve "Zero Lint Errors".
- [ ] Remove `eslint-disable` comments from top of `page.jsx`.
- [ ] Remove unused `filter*` state variables.
- [ ] Fix A11y issues in Filter Overlay (`role`, `onKeyDown`).
- [ ] Fix A11y issues in Form Labels.

### Step 4: Documentation & Final Polish

- **Goal**: Strict JSDoc Compliance.
- [ ] Add JSDoc to all handler functions in `page.jsx`.
- [ ] Run `npx eslint src/app/events/page.jsx src/components/EventActionButtons.jsx`.
- [ ] Run `npx tsc src/app/events/page.jsx src/components/EventActionButtons.jsx --noEmit --allowJs --checkJs --jsx react-jsx --moduleResolution bundler --target esnext --module esnext`.
