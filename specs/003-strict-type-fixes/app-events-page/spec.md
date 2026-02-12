# Specification: Strict Type and Lint Fixes for App Events Page

**Target File**: `src/app/events/page.js`
**Feature Branch**: `003-strict-type-fixes` (Current)
**Related PRD**: `prd/003-strict-type-fixes/app-events-page/error-report.md`

## 1. Overview

This specification details the refactoring required to bring `src/app/events/page.js` into full compliance with the project's strict type checking (`tsc -p tsconfig.check.json`) and linting (`eslint`) standards. The goal is to resolve all reported errors and warnings without altering the existing business logic or functionality.

## 2. Success Criteria

1.  **Type Check Pass**: `npm run type-check` returns zero errors for `src/app/events/page.js`.
2.  **Lint Pass**: `npm run lint -- --file src/app/events/page.js` returns zero errors and zero warnings.
3.  **No `@ts-ignore`**: The file must not contain any `// @ts-ignore` comments.
4.  **Functional Parity**: The page behaves exactly as before (manual verification).

## 3. Implementation Details

### 3.1. JSDoc Type Definitions

To support strict `checkJs`, we will define the following JSDoc types at the top of the file or above relevant functions.

#### 3.1.1. Internal Types
Define `typedef` for data structures used in the component:

```javascript
/**
 * @typedef {Object} RoutePoint
 * @property {number} lat
 * @property {number} lng
 */

/**
 * @typedef {Object} RouteBBox
 * @property {number} minLat
 * @property {number} minLng
 * @property {number} maxLat
 * @property {number} maxLng
 */

/**
 * @typedef {Object} RoutePayload
 * @property {string} polyline
 * @property {number} pointsCount
 * @property {RouteBBox} bbox
 */

/**
 * @typedef {Object} FirestoreTimestamp
 * @property {function(): Date} toDate
 */

/**
 * @typedef {Object} EventData
 * @property {string} id
 * @property {string} title
 * @property {string|FirestoreTimestamp} time
 * @property {string|FirestoreTimestamp} registrationDeadline
 * @property {string} city
 * @property {string} district
 * @property {string} meetPlace
 * @property {number} distanceKm
 * @property {number} paceSec
 * @property {string} [pace]
 * @property {number} maxParticipants
 * @property {number} [participantsCount]
 * @property {number} [remainingSeats]
 * @property {string} hostUid
 * @property {string} hostName
 * @property {RoutePayload} [route]
 * @property {RoutePoint[]} [routeCoordinates]
 */

/**
 * @typedef {Object} UserPayload
 * @property {string} uid
 * @property {string} name
 * @property {string} photoURL
 */
```

### 3.2. Function Annotations & Logic Refactoring

Refactor helper functions and component logic to satisfy Lint and Type checks.

#### 3.2.1. Helper Functions
Add full JSDoc for:

*   `buildRoutePayload`
    *   **Param**: `routeCoordinates` (`RoutePoint[] | null`)
    *   **Returns**: `RoutePayload | null`
*   `formatDateTime`
    *   **Param**: `value` (`string | FirestoreTimestamp | null | undefined`)
    *   **Returns**: `string`
*   `formatPace`
    *   **Param**: `paceSec` (`number | string`)
    *   **Param**: `fallbackText` (`string`) [Optional, default '']
    *   **Returns**: `string`
*   `chunkArray`
    *   **Param**: `arr` (`any[]`)
    *   **Param**: `size` (`number`)
    *   **Returns**: `any[][]` (Use generic template if possible `@template T`)
*   `toNumber`
    *   **Param**: `v` (`any`)
    *   **Returns**: `number`
*   `getRemainingSeats`
    *   **Param**: `ev` (`EventData`)
    *   **Returns**: `number`
*   `buildUserPayload`
    *   **Param**: `user` (`User`) (From AuthContext)
    *   **Returns**: `UserPayload | null`

#### 3.2.2. ESLint Violations Fixes

1.  **`no-restricted-syntax` & `no-await-in-loop`**:
    *   **Location**: `useEffect` checking joined events membership.
    *   **Fix**: The loop iterates over `batches`. Since these are Firestore queries, we want to avoid firing them all at once if the list is huge, but `Promise.all` is generally acceptable for a few batches.
    *   **Strategy**: Convert the `for...of` loop to a standard `for (let i = 0; i < batches.length; i++)` loop. This satisfies `no-restricted-syntax` (which targets iterators). For `no-await-in-loop`, since specific sequential execution is desired for batching (to prevent rate limits), we will add `// eslint-disable-next-line no-await-in-loop` with a comment explaining that sequential batching is intentional.

2.  **`consistent-return`**:
    *   **Location**: Arrow functions in `map` or `useEffect`.
    *   **Fix**: Ensure all code paths return a value or use implicit return block `{ ... return value; }` properly. For side-effect functions (void), ensure they don't return inside `if` blocks randomly.

3.  **`no-shadow`**:
    *   **Location**: `e` variable reused in nested scopes (e.g., `try/catch` block inside a click handler).
    *   **Fix**: Rename inner error variables to `err` or `error`.

4.  **`no-nested-ternary`**:
    *   **Location**: `handleJoinClick` / Render logic.
    *   **Fix**: Refactor nested ternaries into separate `if/else` blocks or helper functions (e.g., `renderJoinButton`).

5.  **`jsx-a11y/*`**:
    *   **Location**: Form labels, non-interactive elements with click handlers.
    *   **Fix**:
        *   Add `htmlFor` to labels matching input `id`.
        *   Add `role="button"` and `tabIndex={0}` to non-button elements that behave like buttons (if any).
        *   Add `onKeyDown` handlers for accessibility where `onClick` is present on non-native buttons.
        *   Ensure `aria-label` is present where text content is missing.

6.  **`max-len`**:
    *   **Fix**: Break long lines (119 chars) to under 100 chars.

7.  **`no-console`**:
    *   **Fix**: Use `// eslint-disable-next-line no-console` for legitimate `console.error` in catch blocks (standard error reporting). Remove `console.log` if it's just debug noise.

### 3.3. CSS Module Type Fix
*   **Error**: `Cannot find module './events.module.css'`.
*   **Fix**: Add a `src/types/css.d.ts` type declaration file.
*   **Strategy**: Create a TypeScript declaration file that tells `tsc` how to handle `.module.css` imports. This is the standard approach for Next.js projects, even those using JS + JSDoc. The `.d.ts` file is an **environment declaration**, not application TypeScript code.
*   **File**: `src/types/css.d.ts`
    ```typescript
    declare module '*.module.css' {
      const classes: { readonly [key: string]: string };
      export default classes;
    }
    ```

## 4. Testing Plan

### 4.1. Static Analysis
Run the following commands locally to verify fixes:
```bash
npm run type-check
npm run lint -- --file src/app/events/page.js
grep -r "@ts-ignore" src/app/events/page.js
```

### 4.2. Manual Verification
1.  **Load Page**: Verify the event list loads.
2.  **Filter**: Open filter, apply filters (e.g., City), verify results update.
3.  **Create**: Open "Create Run" form, fill details, submit. Verify event appears.
4.  **Interaction**: Click "Join" and "Leave" on an event (if logged in). Verify status updates.
