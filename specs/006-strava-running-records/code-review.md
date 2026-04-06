# Code Review — 006-strava-running-records

日期：2026-04-06

---

## Taste Rating: 🟡 **Acceptable** — Works, ships the feature, but has real design issues worth addressing before this calcifies

The overall architecture — server route handlers ↔ Admin SDK ↔ client hooks ↔ UI components — is sound. Data flows in one direction, security rules are correct, the separation between server-only tokens and client-readable connections is the right call. But there are several spots where the code adds unnecessary complexity, makes questionable data structure decisions, or silently swallows failures in ways that will bite you in production.

---

## Linus's Three Questions

1. **Is this solving a real problem?** Yes. Strava OAuth + activity sync + display is a concrete, well-scoped feature.
2. **Is there a simpler way?** In places, yes. Some hooks carry more state than needed, the `useStravaConnection` uid-change detection is over-engineered, and `syncStravaActivities` buries important failure modes.
3. **What will this break?** Nothing existing — this is additive. The `AuthContext` change is the only touch point, and it's backwards-compatible.

---

## [CRITICAL ISSUES]

### 1. `syncStravaActivities` skips `lastSyncAt` update when zero new activities are synced

**[src/lib/firebase-admin.js, Line 104–112]**

```js
if (totalSynced > 0) {
  // updates lastSyncAt
}
```

If the user has been active on Strava but only logged cycling/swimming (filtered out), `totalSynced === 0` and `lastSyncAt` never advances. Next sync fetches the exact same window again. And again. Forever. This is a **data structure bug** — the sync cursor should always advance regardless of whether filtered results were found, because the Strava API _did_ return data, you just filtered it.

**Fix**: Always update `lastSyncAt` after a successful API fetch, not conditionally on `totalSynced > 0`.

### 2. `syncStravaActivities` unbounded batch size

**[src/lib/firebase-admin.js, Line 72–93]**

Each page can return up to 100 activities. If all 100 are runs, you write 100 docs in one batch. Firestore batch limit is 500 operations, so this _works_, but the code has zero awareness of this limit. If the data model evolves to write sub-documents or the page size is increased, this silently breaks. The `disconnect/route.js` correctly respects the 500-doc limit — inconsistency in the same codebase.

**Fix**: Either add a comment documenting the assumption (`PER_PAGE=100 < FIRESTORE_BATCH_LIMIT=500`), or chunk `runActivities` into batches of 500 defensively.

### 3. Callback route uses `STRAVA_CLIENT_ID` (server env) but ConnectGuide uses `NEXT_PUBLIC_STRAVA_CLIENT_ID` (public env)

**[src/app/api/strava/callback/route.js, Line 24]** vs **[src/components/RunsConnectGuide.jsx, Line 4]**

The OAuth token exchange in the callback route reads `process.env.STRAVA_CLIENT_ID`, but the client-side ConnectGuide reads `process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID`. If these are set to different values (or one is missing), OAuth will silently fail with a cryptic Strava error. This is a **data consistency bug** — the same logical value has two names.

**Fix**: Use `NEXT_PUBLIC_STRAVA_CLIENT_ID` everywhere (it's not a secret — it's in the OAuth URL visible to users), or document that both must be identical.

### 4. `useStravaSync` returns `false` before `finally` resets state when user is null

**[src/hooks/useStravaSync.js, Line 62–63]**

```js
isSyncingRef.current = true;
setIsSyncing(true);
// ...
if (!user) return false;
```

When `user` is null, you return `false` but `isSyncing` remains `true` and `isSyncingRef.current` remains `true` — the sync button is permanently disabled. The `finally` block never runs because you returned early before the `try`.

**Fix**: Move the `!user` guard before setting syncing state, or restructure so the `try`/`finally` wraps the full function body.

---

## [IMPROVEMENT OPPORTUNITIES]

### 5. `useStravaConnection` uid-change-during-render hack

**[src/hooks/useStravaConnection.js, Lines 61–66]**

```js
if (prevUidRef.current !== uid) {
  prevUidRef.current = uid;
  setConnection(null);
  setIsLoading(!!uid);
  setError(null);
}
```

Calling `setState` during render (outside of a `useEffect`) is a React anti-pattern that only works by accident in concurrent mode. The `useEffect` on `[uid]` already handles cleanup. This block is solving an imaginary problem (a single-frame flash of stale data) with a fragile hack.

**Fix**: Remove the render-phase setState block entirely. The `useEffect` cleanup + re-subscribe handles uid changes correctly.

### 6. `useStravaActivities` has 7 independent `useState` calls — too many moving parts

**[src/hooks/useStravaActivities.js, Lines 42–53]**

Seven pieces of state that must stay in sync: `activities`, `isLoading`, `error`, `cursor`, `hasMore`, `isLoadingMore`, `refreshCounter`. This is a classic case where `useReducer` would eliminate an entire class of impossible-state bugs (e.g., `isLoading=true` + `error=non-null` + `activities=non-empty`).

**Not blocking**, but this is exactly the kind of state management that gets subtly broken when someone adds a feature later.

### 7. `loadMore` silently swallows errors

**[src/hooks/useStravaActivities.js, Lines 89–91]**

```js
} catch {
  // loadMore error — silently handled
}
```

"Silently handled" is a funny way to spell "silently broken." If pagination fails, the user sees nothing — no error, no retry, just... nothing more loads. At minimum, set an error state so the UI can show "載入更多失敗".

### 8. `RunsLoginGuide` directly imports `firebase/auth` and `firebase-client`

**[src/components/RunsLoginGuide.jsx, Lines 3–4]**

Every other component in this feature accesses auth through `AuthContext`. This one bypasses the pattern entirely, importing `signInWithPopup`, `auth`, and `provider` directly. If the auth provider changes (or you need to test this component), you can't mock the context — you have to mock the Firebase module.

**Fix**: Either use a login callback from AuthContext, or accept an `onLogin` prop so the parent controls the auth flow.

### 9. Hardcoded colors in CSS Modules

**[Multiple .module.css files]**

`#fc4c02`, `#dc2626`, `#374151`, `#e5e7eb` — these are hardcoded in multiple CSS files. Other parts of the project use CSS variables (`var(--foreground, #111)`, `var(--primary, #2563eb)`). The new Strava files are inconsistent: `RunsLoginGuide.module.css` uses CSS variables, but `callback.module.css` and `RunsActivityCard.module.css` hardcode everything.

This isn't blocking, but it means a theme change touches 8+ files instead of 1.

### 10. `TWO_MONTHS_SECONDS` is wrong

**[src/app/api/strava/callback/route.js, Line 6]**

```js
const TWO_MONTHS_SECONDS = 60 * 24 * 3600;
```

That's 60 days × 86400 = 5,184,000 seconds. A "two months" constant should be ~61 days (avg month = 30.44 days). The value is `60 * 24 * 3600` which reads as "60 × 24 hours" = 60 days. The naming is misleading — call it `SIXTY_DAYS_SEC` or actually compute 2 months. The same constant appears in `sync/route.js` as `TWO_MONTHS_SEC`. Two different names for the same value in two files.

**Fix**: Extract to a shared constant with an honest name.

### 11. `handleDisconnect` is not wrapped in `useCallback`

**[src/app/runs/page.jsx, Line 50]**

`handleSync` is correctly memoized with `useCallback`, but `handleDisconnect` is a raw `async function` that creates a new reference every render. The disconnect button re-renders unnecessarily. Minor, but inconsistent.

---

## [STYLE NOTES]

### 12. `eslint-disable` comments for `no-await-in-loop`

**[src/app/api/strava/disconnect/route.js, Lines 41–43]** and **[src/lib/firebase-admin.js, Lines 56–65]**

The eslint-disable comments are justified (sequential batch deletes, sequential pagination) — these are legitimate uses. No issue here.

### 13. `RunsRouteMap.jsx` JSDoc says it "returns" a ReactElement but actually returns a dynamically loaded component

**[src/components/RunsRouteMap.jsx, Lines 3–7]**

The JSDoc describes it as a function component, but it's actually a `dynamic()` wrapper. The JSDoc is slightly misleading. Minor.

---

## [TESTING GAPS]

### 14. No error-path test for `syncStravaActivities` pagination

The unit tests for `syncStravaActivities` test single-page success and filtering, but don't test: (a) what happens when page 2 of the Strava API returns a non-ok response, or (b) what happens when the batch commit fails mid-pagination. These are real production failure modes.

### 15. `loadMore` error handling is untested

Since `loadMore` silently swallows errors (#7), there's no test verifying what the user sees when pagination fails. The "silently handled" comment is the test equivalent of `// TODO`.

### 16. No integration test for the disconnect → activities-cleared flow

There's a unit test for the disconnect route, but no integration test verifying that after disconnect, the `useStravaConnection` listener fires, the UI switches to `RunsConnectGuide`, and the activities list is cleared. This is the most complex state transition in the feature.

---

## [TASK GAPS]

All 26 tasks (T001–T026) are marked `[x]` complete, and the diff contains corresponding implementations for each:

- **T001–T004** (Setup): Dependencies installed, helpers created, nav link added ✅
- **T005–T008** (Foundation): Service layer, route handlers, security rules ✅
- **T009–T018** (US1–US3 + Integration): Hooks, components, pages ✅
- **T019–T020** (US4 Disconnect): Route handler + UI ✅
- **T021–T022** (US5 Pagination): Cursor-based pagination + sentinel ✅
- **T023–T026** (Polish): Lint/type-check clean, index, token revocation, sync error handling ✅

No scope creep detected — the diff maps cleanly to the task list.

---

## VERDICT

✅ **Worth merging** — with fixes for #1 (lastSyncAt never advances) and #4 (sync permanently disabled on null user). The rest are improvements worth tracking but not blocking.

## KEY INSIGHT

The `syncStravaActivities` cursor logic (#1) is the most dangerous issue — it creates an invisible performance regression where the same Strava API window is re-fetched on every sync, burning rate limit budget and returning stale results, all while appearing to "work" because no errors are thrown.
