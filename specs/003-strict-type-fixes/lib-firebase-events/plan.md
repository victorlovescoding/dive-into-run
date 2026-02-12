# Strict Type Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all TypeScript errors in `src/lib/firebase-events.js` to ensure strict type safety (0 errors with `checkJs: true`) without altering runtime logic.

**Architecture:** Use JSDoc annotations `@typedef`, `@type`, and `@param` to enforce types. Fix specific `firebase/firestore` SDK type mismatches by importing correct types or casting.

**Tech Stack:** JavaScript (ESNext), JSDoc, TypeScript (for type checking), Firebase SDK v9.

---

## 1. JSDoc Definitions (src/lib/firebase-events.js)

We will define these types at the top of the file to satisfy FR-003 and strict type checking.

```javascript
/**
 * @typedef {import('firebase/firestore').Timestamp} Timestamp
 * @typedef {import('firebase/firestore').DocumentData} DocumentData
 * @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot
 * @typedef {import('firebase/firestore').DocumentReference} DocumentReference
 * @typedef {import('firebase/firestore').CollectionReference} CollectionReference
 * @typedef {import('firebase/firestore').QueryConstraint} QueryConstraint
 * @typedef {import('firebase/firestore').QueryFieldFilterConstraint} QueryFieldFilterConstraint
 * @typedef {import('firebase/firestore').QueryOrderByConstraint} QueryOrderByConstraint
 * @typedef {import('firebase/firestore').QueryLimitConstraint} QueryLimitConstraint
 */

/**
 * @typedef {Object} EventData
 * @property {string} [id]
 * @property {string} city
 * @property {string} district
 * @property {Timestamp} time
 * @property {Timestamp} registrationDeadline
 * @property {number} distanceKm
 * @property {number} maxParticipants
 * @property {number} [participantsCount]
 * @property {number} [remainingSeats]
 * @property {number} paceSec
 * @property {Timestamp} [createdAt]
 * @property {string} [hostId]
 * @property {string} [title]
 * @property {string} [location]
 * @property {string} [description]
 * @property {string} [routeImage]
 */

/**
 * @typedef {Object} JoinResult
 * @property {boolean} ok
 * @property {'joined'|'already_joined'|'full'} status
 */

/**
 * @typedef {Object} LeaveResult
 * @property {boolean} ok
 * @property {'left'|'not_joined'} status
 */
```

## 2. Implementation Tasks

### Task 1: Fix Module Import Error (FR-001)

**Files:**
- Modify: `src/lib/firebase-events.js`

**Step 1: Verify current error**
Run: `npx tsc src/lib/firebase-events.js --allowJs --checkJs --noEmit --target esnext --moduleResolution node --esModuleInterop`
Expected: Error TS2307 for `@/lib/firebase-client`

**Step 2: Add JSDoc for module or fix alias**
Since `tsc` running on a single file doesn't respect `jsconfig.json` paths automatically without full project context or configuration, but we are running a specific command.
We will try to use a relative import OR suppress the error if it's purely a build-tool artifact, but ideally, we should make it compatible.
Actually, the best fix for `tsc` single file check with aliases is hard. However, for the purpose of this task (passing `checkJs` in general workflow), we can assume the environment supports it.
BUT, the error log shows it fails.
Strategy: We will change the import to relative path `../lib/firebase-client` (which is same dir so `./firebase-client`) OR ensure `tsconfig/jsconfig` is picked up.
Wait, `src/lib/firebase-events.js` is in `src/lib`. `firebase-client` is in `src/lib`.
So `@/lib/firebase-client` resolves to `src/lib/firebase-client`.
Relative import: `./firebase-client`.

**Step 3: Apply Fix**
Change:
```javascript
import { db } from '@/lib/firebase-client';
```
To:
```javascript
import { db } from './firebase-client';
```

**Step 4: Verify**
Run tsc command.
Expected: TS2307 gone.

**Step 5: Commit**
`git add src/lib/firebase-events.js && git commit -m "fix(types): resolve firebase-client import path for tsc"`

### Task 2: Define Data Types & Fix "Property does not exist" Errors (FR-003)

**Files:**
- Modify: `src/lib/firebase-events.js`

**Step 1: Verify current errors**
Run tsc command.
Expected: TS2339 errors for `city`, `district`, `distanceKm`, `remainingSeats`, `maxParticipants`, `participantsCount`.

**Step 2: Add JSDoc Typedefs**
Add the `EventData` typedef (as defined in Architecture section) at the top of the file.
Annotate `results` in `queryEvents` and `joinEvent` data retrieval.

**Step 3: Apply Fixes**
In `queryEvents`:
```javascript
/** @type {EventData[]} */
let results = snap.docs.map((d) => ({ id: d.id, .../** @type {EventData} */(d.data()) }));
```
(Or cast the `data()` result)

**Step 4: Verify**
Run tsc command.
Expected: TS2339 errors gone.

**Step 5: Commit**
`git add src/lib/firebase-events.js && git commit -m "fix(types): add EventData typedef and casting"`

### Task 3: Fix Firestore Query Constraints Type Mismatches (FR-002)

**Files:**
- Modify: `src/lib/firebase-events.js`

**Step 1: Verify current errors**
Run tsc command.
Expected: TS2345 errors for `constraints.push(...)` and TS2556 for `query(...constraints)`.

**Step 2: Apply Fixes**
The issue is that `constraints` array is initialized as `[collection(db, 'events')]`.
TypeScript infers `constraints` as `CollectionReference[]`.
But we push `QueryConstraint` (where, orderBy, limit) into it.
The `query` function takes `(query, ...constraints)`.
We need to separate the base query (collection) from the additional constraints.

Refactor `queryEvents`:
```javascript
const eventsRef = collection(db, 'events');
/** @type {QueryConstraint[]} */
const constraints = [];

// ... push constraints ...

const q = query(eventsRef, ...constraints);
```

**Step 3: Verify**
Run tsc command.
Expected: TS2345 and TS2556 errors gone.

**Step 4: Commit**
`git add src/lib/firebase-events.js && git commit -m "fix(types): separate collection ref from query constraints"`

### Task 4: Fix Return Type Mismatches (FR-004)

**Files:**
- Modify: `src/lib/firebase-events.js`

**Step 1: Verify current errors**
Run tsc command.
Expected: TS2322 errors for `joinEvent` and `leaveEvent` return values.

**Step 2: Apply Fixes**
Explicitly cast the return objects or use the defined typedefs.

For `joinEvent`:
```javascript
/** @type {JoinResult} */
const result = await runTransaction(db, async (tx) => {
  // ...
  return { ok: true, status: 'already_joined' }; // TS should now infer correctly against the JSDoc of joinEvent return or we might need explicit cast inside if strict.
});
```
Actually, the error is likely because the inferred return type of the async function inside `runTransaction` is generic object, but `joinEvent` JSDoc says specific union string.
We need to ensure the return statements inside `runTransaction` match the expected type.
We can add `@returns {Promise<JoinResult>}` to the callback or cast the return values.

**Step 3: Verify**
Run tsc command.
Expected: 0 errors remaining.

**Step 4: Commit**
`git add src/lib/firebase-events.js && git commit -m "fix(types): ensure strict return types for transactions"`

### Task 5: Final Validation

**Files:**
- Test: `tests/003-strict-type-fixes/unit/firebase-events.test.js`

**Step 1: Run Linter**
Run: `npm run lint`
Expected: PASS (no new lint errors).

**Step 2: Run Tests**
Run: `npx vitest run tests/003-strict-type-fixes`
Expected: PASS (Green).

**Step 3: Run TSC Final Check**
Run: `npx tsc src/lib/firebase-events.js --allowJs --checkJs --noEmit --target esnext --moduleResolution node --esModuleInterop`
Expected: Output empty (0 errors).

---

## 4. Quality Assurance & Standards (MANDATORY)

- [ ] **Style Guide**: Code matches Airbnb style (e.g., `const` over `let`, proper indentation).
- [ ] **JSDoc**: All exported functions have JSDoc. Internal logic uses `@type` where inference fails.
- [ ] **Verification**: `npm run lint` passes. `tsc` check passes. Unit tests pass.

## 5. Execution Options

1. **Subagent-Driven**: Fast iteration, best for this kind of focused refactor.
2. **Parallel Session**: Not necessary for single-file refactor.
