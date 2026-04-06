# Code Review — 006-strava-running-records

日期：2026-04-06

---

## Automated Checks

| Check                     | Result                                                                         |
| ------------------------- | ------------------------------------------------------------------------------ |
| ESLint                    | 0 warnings, 0 errors                                                           |
| @ts-ignore                | None found                                                                     |
| Type-check (branch files) | 1 error — `RunsRouteMap.test.jsx:20` named import from default-export module   |
| Tests                     | 7 failed / 125 passed (3 files failed / 15 passed)                             |
| eslint-disable (new code) | 3 — all justified (`no-await-in-loop` x2 batch deletes, `no-alert` x1 confirm) |

---

## Taste Rating

🟡 **Acceptable** — Data flow is clean and separation of concerns is well-thought-out. Server routes handle secrets, hooks manage state, components stay dumb. But there are real null-safety crashes, a silent data loss bug in sync pagination, and inconsistent auth patterns that smell like "it works on my machine" engineering.

---

## Linus-Style Analysis

### Three Questions

1. **Is this solving a real problem?** Yes. Strava integration is a concrete user-facing feature. No over-engineering, no theoretical frameworks.
2. **Is there a simpler way?** Mostly no — the OAuth + Firestore + realtime listener architecture is the straightforward path. A few places have unnecessary complexity (dual auth patterns, redundant admin init logic).
3. **What will this break?** The `auth.currentUser` null access **will** crash in production when timing is unlucky. The sync pagination gap **will** silently lose data for active runners.

---

### [CRITICAL ISSUES] — Must fix

**1. [src/app/api/strava/sync/route.js, Line 21-24] Data Integrity: `tokenData` null dereference**

```js
const tokenDoc = await adminDb.collection('stravaTokens').doc(uid).get();
const tokenData = tokenDoc.data();
// ← tokenData is undefined if doc doesn't exist
if (tokenData.lastSyncAt) { // 💥 TypeError
```

`tokenDoc.data()` returns `undefined` when the document doesn't exist. Any user who hits `/api/strava/sync` after their token doc was deleted (e.g. race condition with disconnect) gets an unhandled 500. This is not a theoretical edge case — it's a state machine transition that **will** happen.

**Fix:** Guard with `if (!tokenDoc.exists)` and return 401 before accessing `.data()`.

---

**2. [src/app/runs/page.jsx, Line 53] Breaking Change: `auth.currentUser` null crash**

```js
const token = await auth.currentUser.getIdToken();
```

Tests confirm this crashes: `TypeError: Cannot read properties of undefined (reading 'getIdToken')`. The `handleDisconnect` function uses `auth.currentUser` (from firebase-client import) instead of `user` (from AuthContext). When the auth module's internal state and the React context are out of sync — which happens during auth state transitions — this throws.

This also exists in `src/app/runs/callback/page.jsx:62`:

```js
const idToken = await auth.currentUser.getIdToken();
```

**Fix:** Use `user.getIdToken()` from AuthContext consistently. You already have `user` in scope via `useContext(AuthContext)`. Don't reach into the Firebase SDK's internal singleton when you have a perfectly good React state holding the same object.

---

**3. [src/lib/firebase-admin.js, Line 53] Data Loss: Sync only fetches first 100 activities**

```js
const url = `https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=100`;
const response = await fetch(url, { ... });
```

Strava returns at most `per_page` results. For active runners, 100 activities in a 2-month window is entirely possible (multiple runs per day during training blocks). The remaining activities are **silently dropped**. No error, no warning, no indication to the user that their data is incomplete. This is the kind of bug that erodes trust because the user can't tell something is wrong.

**Fix:** Paginate with `page` parameter until results < `per_page`. The Strava API supports `page=1,2,3...`. Batch Firestore writes per page (each page has <=100 docs + 2 updates = 102 ops, well under the 500 batch limit).

---

### [IMPROVEMENT OPPORTUNITIES] — Should fix

**4. [src/hooks/useStravaSync.js, Line 66] Silent Failure: `undefined` Bearer token**

```js
const token = await auth.currentUser?.getIdToken();
const res = await fetch('/api/strava/sync', {
  headers: { Authorization: `Bearer ${token}` },
});
```

Optional chaining means `token` can be `undefined`. You'd send `Authorization: Bearer undefined` — which the server correctly rejects as 401, but the user sees a generic "同步失敗" with no clue that their auth state is broken. At least three different auth token patterns across the codebase:

| File                   | Pattern                          | Null-safe?     |
| ---------------------- | -------------------------------- | -------------- |
| `runs/page.jsx:53`     | `auth.currentUser.getIdToken()`  | No — crashes   |
| `callback/page.jsx:62` | `auth.currentUser.getIdToken()`  | No — crashes   |
| `useStravaSync.js:66`  | `auth.currentUser?.getIdToken()` | Fails silently |

**Fix:** Pick one pattern: `user.getIdToken()` from AuthContext, guard once at the call site with an early return if `!user`.

---

**5. [src/hooks/useStravaActivities.js, Line 55] Unnecessary Firestore Read: `hasMore` false positive**

```js
setHasMore(result.lastDoc !== null);
```

If a query returns exactly `pageSize` items and that happens to be the last batch, `lastDoc` is non-null → `hasMore` is `true` → IntersectionObserver fires `loadMore()` → fetches 0 items → finally sets `hasMore` to `false`. This is one unnecessary Firestore read per user per session. Not catastrophic, but it's sloppy.

**Fix:** `setHasMore(result.activities.length === pageSize)` — if fewer than `pageSize` results come back, you know you're at the end.

---

**6. [src/app/runs/page.jsx, Line 54-56] No error feedback on disconnect failure**

```js
await fetch('/api/strava/disconnect', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
// ← response.ok not checked, user gets no feedback
```

Disconnect can fail (network error, server 500, auth expired). User clicks "取消連結", sees "取消連結中..." → it finishes → nothing visually changes because the connection listener still shows connected. Silent failure with no feedback.

**Fix:** Check `response.ok`, show error state on failure (same pattern as sync error).

---

**7. [src/app/api/strava/disconnect/route.js, Line 26-44] Non-atomic disconnect operations**

Sequential operations: delete token (L26) → update connection (L29) → batch delete activities (L32-45). If the process crashes after deleting the token but before updating the connection, the user appears "connected" but has no token — sync will crash, disconnect will return 400 (no token doc to check).

Not a common scenario in a serverless environment, but the operations _could_ be partially batched. At minimum, the token delete and connection update should be in the same batch.

**Fix:** Batch the token delete + connection update together. Activity deletion can remain separate (it's already batched internally).

---

**8. [src/lib/firebase-admin.js, Line 4-8] Confusing Admin SDK init**

```js
credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : admin.credential.applicationDefault(),
```

`GOOGLE_APPLICATION_CREDENTIALS` is the standard env var consumed _automatically_ by `applicationDefault()`. Using it with `cert()` is redundant — ADC already reads that path. The conditional logic suggests the author doesn't understand the difference. `cert()` is for when you have a JSON object or explicit path that ISN'T in the standard env var.

**Fix:** Just use `admin.credential.applicationDefault()` unconditionally (or `cert()` with a separate env var name if explicit path control is needed).

---

### [TESTING GAPS]

**9. [specs/006-strava-running-records/tests/integration/RunsRouteMap.test.jsx, Line 20] Import error breaks all 4 tests**

```js
import { RunsRouteMapInner } from '@/components/RunsRouteMap';
// TS2614: Module has no exported member 'RunsRouteMapInner'
```

`RunsRouteMap.jsx` only has a default export (the `dynamic()` wrapper). `RunsRouteMapInner` is a separate file. All 4 map tests fail with `Element type is invalid`.

**Fix:** Either import `RunsRouteMapInner` from `@/components/RunsRouteMapInner` (to test the inner component directly) or import the default from `@/components/RunsRouteMap`.

---

**10. [specs/006-strava-running-records/tests/integration/RunsPage.test.jsx] Disconnect tests expose production bug**

The `handleDisconnect` test mocks `auth` as `{}` but the real code calls `auth.currentUser.getIdToken()`. The test catches a real bug (issue #2 above) but the test itself is set up in a way that passes for the wrong reason — the mock user object has `getIdToken` but it's on the `connectedUser` object, not on `auth.currentUser`:

```js
const connectedUser = {
  uid: 'u1',
  getIdToken: vi.fn().mockResolvedValue('mock-token-123'),
};
// But page.jsx does: auth.currentUser.getIdToken()  ← auth is mocked as {}
```

The test expectation `expect(connectedUser.getIdToken).toHaveBeenCalled()` passes vacuously because the test throws before reaching that assertion. The unhandled rejection confirms the code is broken.

**Fix:** Fix the source code (issue #2), then the tests will pass naturally.

---

### [STYLE NOTES]

**11. [src/components/RunsRouteMapInner.jsx, Line 37] Empty div fallback**

```jsx
if (coords.length === 0) {
  return <div />;
}
```

An empty `<div>` is technically correct but semantically meaningless. `return null` is the React convention for "render nothing".

---

### [TASK GAPS]

All 26 tasks (T001–T026) have corresponding implementation in the diff. No missing tasks, no scope creep.

---

## VERDICT

❌ **Needs rework** — Three critical issues must be addressed:

1. **`tokenData` null dereference** — server crash on missing token doc
2. **`auth.currentUser` null access** — confirmed client crash (test evidence)
3. **Sync pagination missing** — silent data loss for active runners

Issues #1 and #2 are quick fixes (null guards + consistent auth pattern). Issue #3 requires a pagination loop in `syncStravaActivities` but the change is isolated to one function.

## KEY INSIGHT

The data structures and separation of concerns are solid — server handles secrets, hooks manage state, components stay presentational. The problems are all at the **boundary glue**: null checks at the seams between Firebase SDK and React state, and incomplete API pagination. Fix the plumbing and this is a clean merge.
