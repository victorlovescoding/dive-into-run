# Code Review — 015-comment-notifications

日期：2026-04-15

---

## Taste Rating

🟢 **Good taste** — The `Set`-based dedup in `notifyEventNewComment` is the right data structure choice: a single pass with priority ordering eliminates all edge cases without conditional branches. The callback chain (`useCommentMutations` → `onSuccess` → `onCommentAdded` → parent handler) keeps each layer doing exactly one thing.

---

## Linus-Style Analysis

### [CRITICAL ISSUES]

None.

---

### [IMPROVEMENT OPPORTUNITIES]

**1. [src/lib/firebase-notifications.js] Notification doc literal repeated 5 times**

The same 12-field object structure appears in `notifyPostCommentReply` and 3 times inside `notifyEventNewComment`. With the existing functions, that's 5 total instances across the file. Only `recipientUid`, `type`, `message`, `entityType`, `entityId`, and `entityTitle` vary.

A `buildNotificationDoc(type, entityType, entityId, entityTitle, commentId, message, actor)` helper returning the base object would eliminate ~60 lines of repetition and make future type additions a one-liner. This isn't blocking — the code works — but it's the difference between "works" and "good taste".

**2. [src/lib/firebase-notifications.js, notifyEventNewComment] Empty batch commit when actor is host with no audience**

When `actor.uid === hostUid` AND participants are empty AND no past commenters, the function creates a `writeBatch`, adds nothing to it, then calls `batch.commit()`. This is a no-op but still issues a network call. Add an early return or guard:

```js
// After all priority blocks, before commit:
if (notifiedSet.size <= 1) return; // only actor in set, nothing to commit
```

Or track a counter. The existing `notifyEventModified` does this properly with its `if (recipients.length === 0) return` guard.

**3. [src/app/posts/[id]/PostDetailClient.jsx, line ~318] Actor object duplication**

The actor construction `{ uid: user.uid, name: user.name || '', photoURL: user.photoURL || '' }` appears twice in `submitCommentHandler` (once for `notifyPostNewComment`, once for `notifyPostCommentReply`). Extract to a const above both calls.

---

### [STYLE NOTES]

**4. [specs/.../post-comment-reply.test.jsx] CJS `require('react')` inside `vi.mock`**

Lines 1040, 1061, 1081 use `require('react')` in an ESM test file. This works because Vitest transforms it, but the `async () => { const { createContext } = await import('react'); }` pattern used in `event-comment-notification.test.jsx` is cleaner and consistent with ESM.

**5. [specs/.../comment-notifications.spec.js, line 131] E2E `signOut` type error**

`window.testFirebaseHelpers.signOut` doesn't exist on the current type. This is a pre-existing issue (same error in `014-notification-system`), not introduced here, but flagged for awareness.

---

### [TESTING GAPS]

**6. Unit tests for `notifyPostCommentReply` and `notifyEventNewComment` are solid** — they verify dedup, exclusion, edge cases, and batch operation counts. The 50-participant scenario confirms scaling behavior. These will catch real regressions.

**7. Integration tests verify the trigger chain but are mock-heavy** — `PostDetailClient` integration test mocks 8 modules to render one component. This is pragmatically necessary given the deep dependency tree, and the tests DO verify the correct call signatures (args matter, not just "was called"). Acceptable.

**8. E2E test seeds data via REST rather than triggering real comment flow** — This means the notification _creation_ logic isn't E2E-tested; only the UI display and navigation flow are. The unit/integration layers cover creation thoroughly, so this is acceptable layering, but worth noting.

---

### [TASK GAPS]

All 17 tasks (T001-T017) marked `[x]` have corresponding implementations in the diff:

| Task | File(s) in diff                                         | Status |
| ---- | ------------------------------------------------------- | ------ |
| T001 | firestore.rules                                         | ✓      |
| T002 | notification-helpers.test.js                            | ✓      |
| T003 | fetch-distinct-comment-authors.test.js                  | ✓      |
| T004 | notification-helpers.js                                 | ✓      |
| T005 | firebase-notifications.js (fetchDistinctCommentAuthors) | ✓      |
| T006 | notify-post-comment-reply.test.js                       | ✓      |
| T007 | post-comment-reply.test.jsx                             | ✓      |
| T008 | firebase-notifications.js (notifyPostCommentReply)      | ✓      |
| T009 | PostDetailClient.jsx                                    | ✓      |
| T010 | notify-event-new-comment.test.js                        | ✓      |
| T011 | event-comment-notification.test.jsx                     | ✓      |
| T012 | firebase-notifications.js (notifyEventNewComment)       | ✓      |
| T013 | useCommentMutations.js + CommentSection.jsx             | ✓      |
| T014 | eventDetailClient.jsx                                   | ✓      |
| T015 | CommentSection.jsx (scroll-to-comment)                  | ✓      |
| T016 | comment-notifications.spec.js                           | ✓      |
| T017 | type-check + lint pass                                  | ✓      |

No scope creep detected. No tasks marked complete without implementation.

---

## VERDICT

✅ **Worth merging** — Core logic is sound, dedup is correctly implemented, service layer isolation is maintained, no `@ts-ignore`, lint and type-check clean. The notification doc repetition (item #1) and empty batch commit (item #2) are real improvements worth making but don't block merge.

## KEY INSIGHT

The `Set`-based priority dedup in `notifyEventNewComment` is the linchpin of this feature — it turns a combinatorial explosion of role × notification type into a simple linear scan. If this data structure were wrong, the whole feature would be a mess of special cases. It's right.
