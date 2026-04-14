# Code Review — 014-notification-system

日期：2026-04-14

---

## Taste Rating: 🟡 **Acceptable** — Solid overall architecture, but a real data consistency bug in the pagination model and a security gap in Firestore rules undermine an otherwise well-structured feature.

---

## Linus-Style Analysis

### [CRITICAL ISSUES] (Must fix — these break fundamental principles)

**1. [src/contexts/NotificationContext.jsx, Lines 203-208] Data Structure: `notifications` + `extraNotifications` merge creates gaps and duplicates**

The fundamental data structure decision — splitting real-time listener data (`notifications`, latest 5) and paginated data (`extraNotifications`) into two separate state arrays merged via spread — is **wrong**. It creates a concurrency bug:

```
Scenario: User loads more notifications, then a new notification arrives.

1. Listener has [n5, n4, n3, n2, n1], lastDoc = n1
2. User clicks loadMore → fetches [n0] starting after n1
   extraNotifications = [n0], lastDoc = n0
3. New notification n6 arrives → listener fires
   notifications = [n6, n5, n4, n3, n2], lastDoc = n2
4. Display: [...notifications, ...extraNotifications] = [n6, n5, n4, n3, n2, n0]
   → n1 IS MISSING — it fell out of the listener window and was never in extraNotifications
```

Furthermore, `lastDoc` is now n2 (overwritten by the listener). If the user calls `loadMore` again, it fetches starting after n2 — which returns [n1, n0, ...], causing **n0 to appear twice**.

This is a textbook example of what happens when you split a single ordered dataset across two independent state containers without a deduplication/merge strategy.

**Fix**: Either (a) maintain a single `Map<id, Notification>` that both the listener and pagination write into, with a sorted derived array, or (b) stop updating `lastDoc` from the listener once `hasLoadedMore` is true, and accept the listener window as frozen for display purposes.

---

**2. [firestore.rules, Lines 63-68] Security: `actorUid` not validated against `request.auth.uid` — notification impersonation possible**

The create rule validates `recipientUid != request.auth.uid` and `type` whitelist, but does NOT validate:

```
request.resource.data.actorUid == request.auth.uid
```

A malicious client can create a notification with any `actorUid`, `actorName`, `actorPhotoURL` — effectively impersonating another user. The recipient would see a notification saying "Alice modified the event" when it was actually sent by Eve.

This is a **real privilege escalation risk**, not theoretical. Any authenticated user can send forged notifications to any other user via the Firestore REST API or a modified client.

**Fix**: Add `&& request.resource.data.actorUid == request.auth.uid` to the create rule.

---

**3. [src/contexts/NotificationContext.jsx, Lines 185-201] Data Structure: `markAsRead` optimistic update doesn't cover `extraNotifications`**

```js
setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
setUnreadNotifications((prev) => prev.filter((n) => n.id !== notificationId));
```

This updates `notifications` (listener top 5) and `unreadNotifications`, but not `extraNotifications`. If the user scrolls down, loads more notifications, and clicks an unread item from the paginated section — the blue dot won't disappear until the next onSnapshot round-trip. This violates the spec requirement: 「點擊後 blue dot 立即消失（樂觀更新，不等 onSnapshot 回寫）」.

**Fix**: Add `setExtraNotifications((prev) => prev.map(...))` with the same read:true logic.

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

**11. No test covers the pagination + new notification race condition (Critical Issue #1)**

All pagination tests mock the service layer and never simulate a listener update arriving between loadMore calls. The critical data consistency bug is completely untested. A test should:

1. Setup initial 5 notifications via listener
2. Call loadMore → append extra notifications
3. Simulate a new notification arriving (trigger listener callback with shifted window)
4. Assert no items are missing and no duplicates exist

**12. Integration tests heavily rely on mocked service layer — acceptable for unit isolation, but the mocks never exercise the real `fetchMoreNotifications`/`loadMore` interaction**

The `NotificationPagination.test.jsx` mocks `fetchMoreNotifications` and injects results directly. This proves the Context logic routes correctly, but doesn't catch the cursor management bugs. An integration test that uses a fake in-memory Firestore would catch issues #1 and #3.

---

### [TASK GAPS]

**[T022] Missing Implementation**: Task marked `[x]` (complete) but unread tab pagination is not implemented. `fetchMoreUnreadNotifications` is never imported or called from `NotificationContext`. The "unread" tab always shows at most 5 items with no loadMore capability.

---

## VERDICT:

❌ **Needs rework** — The pagination data model (Critical Issue #1) creates user-visible data loss. The Firestore security gap (Critical Issue #2) allows notification impersonation. Both must be addressed before merge.

Issues #3 (markAsRead for paginated items) and #4 (CSS layout) are also high-confidence bugs that will be visible to users immediately.

## KEY INSIGHT:

The root cause of the pagination bugs is splitting a single ordered notification list across two independent state arrays (`notifications` + `extraNotifications`) without a reconciliation layer. This is the kind of "bad data structure" problem Linus warns about — the code complexity isn't in the logic, it's in the data model. A single `Map<id, NotificationItem>` with a derived sorted array would eliminate issues #1, #3, and the potential duplicate problem in one structural fix.
