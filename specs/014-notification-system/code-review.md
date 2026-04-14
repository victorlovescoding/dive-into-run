# Code Review — 014-notification-system

日期：2026-04-14

---

## Taste Rating: 🟡 **Acceptable** — Solid overall architecture. Critical issues (#1 pagination race condition, #2 actorUid security gap, #3 markAsRead coverage) fixed in `00be0f6`. Improvement/style issues (#4, #6, #7, #8, #9, #10) fixed in `6b933b4`. Remaining: #5 unread pagination not implemented, #12 integration test gap.

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

**5. [src/contexts/NotificationContext.jsx, Lines 210-215] Missing Feature: Unread tab pagination is not implemented despite T022 marking it complete**

```js
const hasMore = useMemo(() => {
  if (activeTab === 'unread') {
    return false; // ← Always false
  }
  return hasMoreAll;
}, [activeTab, hasMoreAll]);
```

`fetchMoreUnreadNotifications` is defined in `firebase-notifications.js` but **never imported** in `NotificationContext.jsx`. The unread tab displays `unreadNotifications.slice(0, 5)` with no way to load more. A user with 50 unread notifications can only see the first 5 in the "unread" tab.

T022 specifies: _「未讀」tab: 先從 Listener 1 資料 client-side slice（每次 5 則），Listener 1 資料用盡（≥ 100 則）後 fallback 呼叫 fetchMoreUnreadNotifications_

This is not implemented.

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

**10. ~~[src/components/Notifications/NotificationPanel.jsx] Accessibility: No keyboard support for panel~~ ✅ Partially fixed in `6b933b4`**

Added Escape-to-close handler (`NotificationPanel.jsx:54-57`). Focus trap and focus management on open are not yet implemented (P2, acceptable for follow-up).

---

### [TESTING GAPS]

**11. ~~No test covers the pagination + new notification race condition (Critical Issue #1)~~ ✅ Fixed in `00be0f6`**

Added regression test `should not lose or duplicate notifications when listener fires after loadMore` in `NotificationPagination.test.jsx` — reproduces the exact race condition scenario and asserts 7 unique notifications with no gaps or duplicates.

**12. Integration tests heavily rely on mocked service layer — acceptable for unit isolation, but the mocks never exercise the real `fetchMoreNotifications`/`loadMore` interaction**

The `NotificationPagination.test.jsx` mocks `fetchMoreNotifications` and injects results directly. This proves the Context logic routes correctly, but doesn't catch the cursor management bugs. An integration test that uses a fake in-memory Firestore would catch issues #1 and #3.

---

### [TASK GAPS]

**[T022] Missing Implementation**: Task marked `[x]` (complete) but unread tab pagination is not implemented. `fetchMoreUnreadNotifications` is never imported or called from `NotificationContext`. The "unread" tab always shows at most 5 items with no loadMore capability.

---

## VERDICT:

✅ **Worth merging** — Critical issues (#1, #2, #3) fixed in `00be0f6`. Improvement/style issues (#4, #6, #7, #8, #9, #10) fixed in `6b933b4`. Remaining: #5 unread tab pagination (not implemented), #10 focus trap (P2), #12 integration test gap — all acceptable for follow-up.

## KEY INSIGHT:

The root cause of the pagination bugs was splitting a single ordered notification list across two independent state arrays (`notifications` + `extraNotifications`) without a reconciliation layer. Fixed by adopting a single `Map<id, NotificationItem>` with a derived sorted array — eliminated issues #1, #3, and the duplicate problem in one structural change.
