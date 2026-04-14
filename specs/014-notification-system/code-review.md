# Code Review — 014-notification-system

日期：2026-04-14

---

## Taste Rating: 🟢 **Good taste** — All critical and improvement issues resolved. Unread pagination two-phase design is structurally sound. Focus trap + focus restore is complete. Stateful cursor tests close the testing gap.

---

## Linus-Style Analysis

### [CRITICAL ISSUES] (Must fix — these break fundamental principles)

**1. ~~[src/contexts/NotificationContext.jsx, Lines 203-208] Data Structure: `notifications` + `extraNotifications` merge creates gaps and duplicates~~ ✅ Fixed in `00be0f6`**

Replaced `notifications[]` + `extraNotifications[]` with a single `notificationsMap` (`Map<id, NotificationItem>`). Listener and pagination both merge via `Map.set()`, eliminating gaps and duplicates. Cursor split into `listenerCursor` / `paginationCursor` prevents cursor overwrite. Regression test added (`should not lose or duplicate notifications when listener fires after loadMore`).

---

**2. ~~[firestore.rules, Lines 63-68] Security: `actorUid` not validated against `request.auth.uid` — notification impersonation possible~~ ✅ Fixed in `00be0f6`**

Added `&& request.resource.data.actorUid == request.auth.uid` to the create rule (`firestore.rules:218`).

---

**3. ~~[src/contexts/NotificationContext.jsx, Lines 185-201] Data Structure: `markAsRead` optimistic update doesn't cover `extraNotifications`~~ ✅ Fixed in `00be0f6`**

Single `notificationsMap` refactor (Issue #1) eliminated this problem — `markAsRead` now updates the Map via `Map.get()` + `Map.set()`, covering all notifications regardless of source.

---

### [IMPROVEMENT OPPORTUNITIES] (Should fix — violates good taste)

**4. ~~[src/components/Notifications/NotificationItem.jsx, Lines 44-48 + NotificationItem.module.css, Lines 40-54] CSS: `.message` and `.time` are inline `<span>` elements — layout is wrong~~ ✅ Fixed in `6b933b4`**

Added `display: flex; flex-direction: column;` to `.content` (`NotificationItem.module.css:43-44`). Message and time now stack vertically as intended.

---

**5. ~~[src/contexts/NotificationContext.jsx, Lines 210-215] Missing Feature: Unread tab pagination is not implemented despite T022 marking it complete~~ ✅ Fixed in `be287f4`**

Implemented two-phase unread pagination matching T022 spec:

- **Phase 1** (`NotificationContext.jsx:298-302`): Client-side slice expansion — `unreadDisplayCount` increments by 5 per loadMore, `displayedNotifications` returns `unreadNotifications.slice(0, unreadDisplayCount)` + deduped `extraUnreadNotifications`.
- **Phase 2** (`NotificationContext.jsx:303-316`): Server fallback — when listener data exhausted (≥100 items), calls `fetchMoreUnreadNotifications(uid, cursor, 5)`, appends to `extraUnreadNotifications`.
- `hasMore` (`NotificationContext.jsx:273-286`): Correctly returns true when client-side slice has more, or when listener at capacity and server not exhausted.
- `watchUnreadNotifications` (`firebase-notifications.js:210-213`): Now passes `lastDoc` (last snapshot doc) as second parameter to `onNext` callback for cursor tracking.
- `markAsRead` (`NotificationContext.jsx:248`): Also filters `extraUnreadNotifications` for optimistic update coverage.

Data structure is clean — `extraUnreadNotifications[]` stores server-fetched items, deduped via `Set` against listener slice in `displayedNotifications`.

---

**6. ~~[src/components/Notifications/NotificationBell.jsx, Lines 37-49] Simplification: Filled vs outlined SVG uses the exact same path~~ ✅ Fixed in `6b933b4`**

Replaced with two distinct Material Design bell paths (`NotificationBell.jsx:39-42`): filled (solid) for open state, outlined (with inner cutout) for closed state. Both use `fill="currentColor"` — outline effect achieved through path geometry rather than stroke.

---

**7. ~~[src/app/posts/[id]/PostDetailClient.jsx, Lines 160-167] Pragmatism: Event listener cleanup should use `{ once: true }`~~ ✅ Fixed in `6b933b4`**

Added `{ once: true }` to `addEventListener('animationend', ...)` (`PostDetailClient.jsx:167`).

---

**8. ~~[src/components/Notifications/NotificationBell.jsx, Line 19] Accessibility: `aria-label` count doesn't match visual display~~ ✅ Fixed in `6b933b4`**

`aria-label` now uses `displayCount` instead of `unreadCount` (`NotificationBell.jsx:19`), ensuring screen readers announce the same value (`99+`) as the visual badge.

---

### [STYLE NOTES] (Minor — but worth noting)

**9. ~~[src/components/Notifications/NotificationPanel.jsx, Lines 105-124] Accessibility: WAI-ARIA tabs pattern is incomplete~~ ✅ Fixed in `6b933b4`**

Completed WAI-ARIA tabs pattern (`NotificationPanel.jsx:118-141`): tab buttons now have `id` and `aria-controls="notification-tabpanel"`; content area wrapped in `<div role="tabpanel" id="notification-tabpanel" aria-labelledby="notification-tab-{activeTab}">`.

---

**10. ~~[src/components/Notifications/NotificationPanel.jsx] Accessibility: No keyboard support for panel~~ ✅ Fixed in `be287f4`**

Full keyboard + focus management implemented:

- **Focus trap** (`NotificationPanel.jsx:80-99`): Tab key cycles through focusable elements inside panel; Shift+Tab wraps from first to last.
- **Escape to close** (`NotificationPanel.jsx:75-78`): Closes panel on Escape key.
- **Focus on open** (`NotificationPanel.jsx:37-43`): First `[role="tab"]` receives focus when panel opens.
- **Focus restore on close** (`NotificationContext.jsx:228-229`): `bellButtonRef.current?.focus()` returns focus to bell button.
- **Bell ref** (`NotificationBell.jsx:23`): `ref={bellButtonRef}` passed from Context.

---

### [TESTING GAPS]

**11. ~~No test covers the pagination + new notification race condition (Critical Issue #1)~~ ✅ Fixed in `00be0f6`**

Added regression test `should not lose or duplicate notifications when listener fires after loadMore` in `NotificationPagination.test.jsx` — reproduces the exact race condition scenario and asserts 7 unique notifications with no gaps or duplicates.

**12. ~~Integration tests heavily rely on mocked service layer — acceptable for unit isolation, but the mocks never exercise the real `fetchMoreNotifications`/`loadMore` interaction~~ ✅ Fixed in `be287f4`**

Added `NotificationPaginationStateful.test.jsx` (440 lines, 5 tests) with **stateful cursor mocks** that simulate Firestore cursor behavior:

- `should traverse all pages without gaps or duplicates` — 13 notifications across 3 pages, verifies all present in correct order.
- `should chain cursors correctly across multiple fetchMore calls` — asserts exact cursor values (`{ _index, id }`) passed to each `fetchMoreNotifications` call.
- `should merge correctly when listener fires new data after loadMore` — listener shifts window after pagination, verifies 9 unique items with no duplicates.
- `should paginate unread tab via client-side slice (Phase 1)` — 8 unread items, verifies client-side expansion with zero server calls.
- `should fallback to server fetch when listener at capacity (Phase 2)` — 100 listener items + 3 server extras, verifies `fetchMoreUnreadNotifications` called after Phase 1 exhausted.

The mocks now exercise the full cursor management pipeline in `NotificationContext`, closing the coverage gap between unit isolation and real Firestore behavior.

---

### [MINOR ISSUES IN FIX COMMIT]

**13. ~~[NotificationPaginationStateful.test.jsx, Line 398] Type Error: `pointerEventsCheck: false` should be `0`~~ ✅ Fixed (uncommitted)**

Changed `pointerEventsCheck: false` to `pointerEventsCheck: 0`. TS2322 resolved — `npm run type-check` no longer reports this error.

---

### [TASK GAPS]

**[T022] ~~Missing Implementation~~ ✅ Fixed**: Unread tab pagination now implemented — two-phase approach (client-side slice + server fallback) matches T022 spec exactly.

---

## VERDICT:

✅ **Worth merging** — All 13 issues resolved. No remaining issues. ESLint 0 errors, type-check clean for changed files.

## KEY INSIGHT:

The unread pagination two-phase design is the right call: Phase 1 (client-side slice of listener's 100-item cache) is zero-cost, Phase 2 (server fetch) only fires when the listener limit is hit. Combined with the `Map<id, NotificationItem>` data structure from the earlier fix, the notification system now handles all pagination/dedup/cursor scenarios correctly.
