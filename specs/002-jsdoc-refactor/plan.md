# [JSDoc Refactor] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `src/lib/firebase-events.js` to ensure zero ESLint warnings, fix variable shadowing/unused variables, and add complete JSDoc documentation, without altering runtime behavior.

**Architecture:** Pure refactoring of a Service Layer module. No architectural changes.

**Tech Stack:** JavaScript (ES6+), JSDoc, ESLint, Firebase Firestore SDK.

---

## 1. Data Model Changes

None.

## 2. Server-Side Logic (src/lib/firebase-events.js)

The following functions will be refactored to add JSDoc and fix linting issues:

- [ ] `normalizeEventPayload(raw)`
  - **Refactor**: Fix `no-unused-vars` by renaming unused destructured variables (e.g., `_planRoute`).
  - **JSDoc**:
    ```javascript
    /**
     * Normalizes the raw event payload from the UI form.
     * @param {Object} raw - The raw form data.
     * @param {string} raw.time - Event time string (datetime-local).
     * @param {string} raw.registrationDeadline - Registration deadline string.
     * @param {string|number} raw.distanceKm - Distance in km.
     * @param {string|number} [raw.maxParticipants] - Max participants.
     * @param {string|number} raw.paceMinutes - Pace minutes part.
     * @param {string|number} raw.paceSeconds - Pace seconds part.
     * @param {Object} [raw.rest] - Other properties.
     * @returns {Object} Normalized payload with Firestore Timestamps and calculated numbers.
     */
    ```

- [ ] `createEvent(raw, extra)`
  - **Refactor**: Fix `no-unused-vars` in `extra` destructuring.
  - **JSDoc**:
    ```javascript
    /**
     * Creates a new event in Firestore.
     * @param {Object} raw - Raw form data from UI.
     * @param {Object} [extra={}] - Extra fields (e.g., hostId, pace info).
     * @returns {Promise<import('firebase/firestore').DocumentReference>} The created document reference.
     */
    ```

- [ ] `fetchLatestEvents(limitCount)`
  - **Refactor**: Rename local `doc` variable to `snapshot` to avoid shadowing `import { doc }`.
  - **JSDoc**:
    ```javascript
    /**
     * Fetches the latest events ordered by creation time.
     * @param {number} [limitCount=10] - Number of events to fetch.
     * @returns {Promise<{events: Array<Object>, lastDoc: import('firebase/firestore').QueryDocumentSnapshot|null}>}
     */
    ```

- [ ] `queryEvents(filters)`
  - **JSDoc**:
    ```javascript
    /**
     * Queries events based on multiple filters (mixed Firestore & in-memory).
     * @param {Object} [filters={}] - Filter criteria.
     * @param {string} [filters.city] - City name.
     * @param {string} [filters.district] - District name.
     * @param {string|Date} [filters.startTime] - Filter events after this time.
     * @param {string|Date} [filters.endTime] - Filter events before this time.
     * @param {number|string} [filters.minDistance] - Minimum distance.
     * @param {number|string} [filters.maxDistance] - Maximum distance.
     * @param {boolean} [filters.hasSeatsOnly] - If true, only return events with remaining seats.
     * @returns {Promise<Array<Object>>} Filtered list of events.
     */
    ```

- [ ] `fetchEventById(eventId)`
  - **JSDoc**:
    ```javascript
    /**
     * Fetches a single event by ID.
     * @param {string} eventId - The event ID.
     * @returns {Promise<Object|null>} The event data with ID, or null if not found.
     */
    ```

- [ ] `fetchNextEvents(afterDoc, limitCount)`
  - **Refactor**: Rename local `doc` variable to `snapshot`.
  - **JSDoc**:
    ```javascript
    /**
     * Fetches the next page of events.
     * @param {import('firebase/firestore').QueryDocumentSnapshot} afterDoc - The last document from previous page.
     * @param {number} [limitCount=10] - Number of events to fetch.
     * @returns {Promise<{events: Array<Object>, lastDoc: import('firebase/firestore').QueryDocumentSnapshot|null}>}
     */
    ```

- [ ] `joinEvent(eventId, user)`
  - **JSDoc**:
    ```javascript
    /**
     * Joins an event for a user.
     * @param {string} eventId - Event ID.
     * @param {Object} user - User object.
     * @param {string} user.uid - User UID.
     * @param {string} [user.name] - User name.
     * @param {string} [user.photoURL] - User photo URL.
     * @returns {Promise<{ok: boolean, status: string}>} Result of join operation.
     */
    ```

- [ ] `leaveEvent(eventId, user)`
  - **JSDoc**:
    ```javascript
    /**
     * Leaves an event for a user.
     * @param {string} eventId - Event ID.
     * @param {Object} user - User object.
     * @param {string} user.uid - User UID.
     * @returns {Promise<{ok: boolean, status: string}>} Result of leave operation.
     */
    ```

- [ ] `fetchParticipants(eventId, limitCount)`
  - **JSDoc**:
    ```javascript
    /**
     * Fetches participants for an event.
     * @param {string} eventId - Event ID.
     * @param {number} [limitCount=50] - Max participants to return.
     * @returns {Promise<Array<Object>>} List of participants.
     */
    ```

- [ ] `fetchMyJoinedEventsForIds(uid, eventIds)`
  - **JSDoc**:
    ```javascript
    /**
     * Checks which events in a list the user has joined.
     * @param {string} uid - User UID.
     * @param {Array<string>} eventIds - List of event IDs to check.
     * @returns {Promise<Set<string>>} Set of joined event IDs.
     */
    ```

## 3. UI Components

None.

## 4. 品質保證與規範 (MANDATORY)

- [ ] **風格規範**: 遵循憲法 Principle VI (Airbnb Style)。
- [ ] **JSDoc 契約**: 已在「技術細節」區塊預先定義所有函數的參數與型別。
- [ ] **驗收門檻**:
  - `npm run lint` 必須完全通過 (0 errors, 0 warnings in target file)。
  - `vitest run tests/002-jsdoc-refactor/unit/firebase-events.test.js` 必須全部通過 (Regression Test)。

## 5. Step-by-Step Implementation Guide

1.  **Refactor `normalizeEventPayload` & `createEvent`**:
    - Address `no-unused-vars` by renaming unused destructured variables (prefix with `_`).
    - Add JSDoc blocks.
    - Run lint to verify.

2.  **Refactor `fetchLatestEvents` & `fetchNextEvents`**:
    - Rename local `doc` to `snapshot`.
    - Add JSDoc blocks.
    - Run lint to verify.

3.  **Add JSDoc to remaining functions**:
    - `queryEvents`, `fetchEventById`, `joinEvent`, `leaveEvent`, `fetchParticipants`, `fetchMyJoinedEventsForIds`.
    - Ensure types match `import('firebase/firestore')` types where appropriate.

4.  **Final Verification**:
    - Run `npx eslint src/lib/firebase-events.js` (Must be clean).
    - Run `npm test` (Must pass).
