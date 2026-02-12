# Code Review Report: 003-strict-type-fixes

**Reviewer**: AI Assistant (Linus Mode)
**Date**: 2026-02-09
**Target**: `src/lib/firebase-events.js`

## Verdict
🟢 **Good taste** (Passed)

The changes successfully enforce strict type safety without over-engineering or breaking existing logic. The use of JSDoc is pragmatic for this environment.

## Linus-Style Analysis

### Data Structure & Types
**[GOOD]**
- The `@typedef {EventData}` and `@typedef {JoinResult}` definitions are comprehensive and correctly located.
- Explicitly defining `Timestamp` imports prevents the common "is this a Date or a Firestore Timestamp?" confusion.
- **Good Taste**: Centralizing `normalizeEventPayload` is excellent. It treats data ingress as a boundary problem, keeping the database writes clean.

### Complexity & Logic
**[ACCEPTABLE]**
- `queryEvents` mixes Firestore queries (Stage 1) and in-memory filtering (Stage 2).
  - *Critique*: While this scales poorly (O(N) on the client side after fetching), for an MVP with limited event volume, it avoids the nightmare of Firestore Composite Indexes. It is a pragmatic "Worse is Better" choice.
  - *Warning*: If `limit(50)` is hit by 50 events that are all filtered out by distance, the user sees nothing despite valid events existing further down the list. This is a known trade-off of this pattern.

**[GOOD]**
- `joinEvent` / `leaveEvent` transactions correctly handle the `remainingSeats` race condition. The fallback logic (`if (typeof remainingSeats !== 'number')`) for legacy data is robust.

### Safety
**[GOOD]**
- `createEvent` explicitly destructures and excludes `pace` related string fields (`paceText`, etc.) before writing. This "sanitization by whitelist/exclusion" is the only sane way to handle user input.
- `fetchMyJoinedEventsForIds` correctly caps the input array slice to 30 to prevent read explosion.

### Testing & Verification
- The primary requirement was passing `checkJs`.
- **Observation**: The code relies heavily on type casting (e.g., `/** @type {EventData} */(d.data())`). This is necessary in JSDoc Firestore patterns because the SDK returns `DocumentData`.

## Key Insight
The refactoring correctly prioritizes **Type Correctness** in the Service Layer without disrupting the Business Logic. The code is defensive (handling missing fields, sanitizing inputs) and explicit.

---

## Next Steps
1.  **Merge** this branch.
2.  Ensure future changes to this file maintain the `checkJs` standard (add to CI/pre-commit if possible).
