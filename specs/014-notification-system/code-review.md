# Code Review — 014-notification-system

日期：2026-04-14

---

## Taste Rating: 🟡 **Acceptable** — Solid overall architecture. Critical issues (#1 pagination race condition, #2 actorUid security gap, #3 markAsRead coverage) have been fixed in `00be0f6`. Remaining items are improvement/style level.

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

**4. [src/components/Notifications/NotificationItem.jsx, Lines 44-48 + NotificationItem.module.css, Lines 40-54] CSS: `.message` and `.time` are inline `<span>` elements — layout is wrong**

The spec layout:

```
[avatar] [message text    ] [blue dot]
         [relative time   ]
```

The actual render:

```html
<span class="content">
  <span class="message">你所參加的…</span>
  <span class="time">5 分鐘前</span>
</span>
```

Both children are `<span>` (inline). The `margin-top: 2px` on `.time` won't apply to inline non-replaced elements. The time text will appear inline after the message, not below it.

**Fix**: Add `display: flex; flex-direction: column;` to `.content`, or change the children to `<div>` elements (and the parent `.content` from `<span>` to `<div>`).

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

**6. [src/components/Notifications/NotificationBell.jsx, Lines 37-49] Simplification: Filled vs outlined SVG uses the exact same path**

Both branches use the identical `d` attribute — the only difference is `fill="currentColor"` vs `fill="none" stroke`. While technically functional, a bell icon drawn with stroke only looks significantly different from the same path filled. The outlined version will render as a thick-stroked bell (not a true outlined icon with visible interior). Consider using distinct paths or a design system icon set for clearer visual distinction.

---

**7. [src/app/posts/[id]/PostDetailClient.jsx, Lines 160-167] Pragmatism: Event listener cleanup should use `{ once: true }`**

```js
el.addEventListener('animationend', handleAnimationEnd);
```

The handler removes the class and is only needed once. Use `{ once: true }` instead of manually removing inside the handler — simpler, self-documenting, no risk of the listener persisting.

---

**8. [src/components/Notifications/NotificationBell.jsx, Line 19] Accessibility: `aria-label` count doesn't match visual display**

When `unreadCount = 100`, `aria-label` says `"通知，100 則未讀"` but the visual badge shows `"99+"`. Screen readers announce a different number than what sighted users see. Use `displayCount` in the aria-label too:

```js
const ariaLabel = unreadCount > 0 ? `通知，${displayCount} 則未讀` : '通知';
```

---

### [STYLE NOTES] (Minor — but worth noting)

**9. [src/components/Notifications/NotificationPanel.jsx, Lines 105-124] Accessibility: WAI-ARIA tabs pattern is incomplete**

The tab buttons have `role="tab"` + `aria-selected` inside a `role="tablist"`, but:

- No `aria-controls` linking to a `role="tabpanel"` element
- No `role="tabpanel"` elements wrapping the content areas

This won't break screen readers (the region label helps), but it's not a complete tabs pattern. Either remove the ARIA tab roles (use simple buttons) or complete the pattern.

---

**10. [src/components/Notifications/NotificationPanel.jsx] Accessibility: No keyboard support for panel**

- No `Escape` key handler to close the panel
- No focus trap or focus management on open
- Outside click uses `mousedown` only — keyboard users can't close via click-outside equivalent

For a dropdown that overlays content, keyboard accessibility is expected at P1. At minimum, add Escape-to-close.

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

✅ **Worth merging** — Critical issues (#1, #2, #3) have been fixed. The single `Map<id, NotificationItem>` refactor is clean and structurally correct. Remaining items (#4–#10, #12) are improvement/style level and can be addressed in follow-up.

## KEY INSIGHT:

The root cause of the pagination bugs was splitting a single ordered notification list across two independent state arrays (`notifications` + `extraNotifications`) without a reconciliation layer. Fixed by adopting a single `Map<id, NotificationItem>` with a derived sorted array — eliminated issues #1, #3, and the duplicate problem in one structural change.
