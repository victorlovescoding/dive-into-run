status: verified
status: implementation_completed
status: kanban_synced

# Tasks for Strict Type Fixes

## 1. Type Refactoring

- [ ] Task 1: Fix Module Import Error (FR-001)
  - Description: Resolve `tsc` error TS2307 by changing `@/lib/firebase-client` to relative import `./firebase-client` in `src/lib/firebase-events.js`.
  - Acceptance: `tsc` command no longer reports TS2307.

- [ ] Task 2: Define Data Types & Fix "Property does not exist" Errors (FR-003)
  - Description:
    1. Add JSDoc typedefs for `EventData` at the top of `src/lib/firebase-events.js`.
    2. Use `@type {EventData[]}` and casting to fix TS2339 errors in `queryEvents` (properties: `city`, `district`, `distanceKm`, `remainingSeats`, `maxParticipants`, `participantsCount`).
  - Acceptance: `tsc` command no longer reports TS2339 errors.

- [ ] Task 3: Fix Firestore Query Constraints Type Mismatches (FR-002)
  - Description:
    1. In `queryEvents`, separate the base collection reference from query constraints.
    2. Initialize `const constraints = []` with type `@type {QueryConstraint[]}`.
    3. Construct query using `query(eventsRef, ...constraints)`.
  - Acceptance: `tsc` command no longer reports TS2345 and TS2556 errors.

- [ ] Task 4: Fix Return Type Mismatches (FR-004)
  - Description:
    1. Add JSDoc typedefs for `JoinResult` and `LeaveResult`.
    2. Ensure `joinEvent` and `leaveEvent` transaction blocks explicitly return types matching the typedefs (e.g., cast return objects or annotate the transaction callback).
  - Acceptance: `tsc` command no longer reports TS2322 errors.

## 2. Verification (MANDATORY)

- [ ] Task 5: Final Verification & Linting
  - Description:
    1. Run `npm run lint` and fix any new style issues (Airbnb/Next.js/JSDoc).
    2. Run `npx tsc src/lib/firebase-events.js --allowJs --checkJs --noEmit --target esnext --moduleResolution node --esModuleInterop` and ensure **0 errors**.
    3. Run `npx vitest run tests/003-strict-type-fixes` and ensure **all tests pass**.
  - Acceptance: All commands exit with code 0.
