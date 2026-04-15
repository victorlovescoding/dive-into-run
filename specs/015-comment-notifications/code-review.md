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

**1. ~~[src/lib/firebase-notifications.js] Notification doc literal repeated 5 times~~** ✅ Fixed

Extracted `buildNotificationDoc()` helper (line 40) that returns the base notification object. All 5 call sites now use this helper, eliminating ~60 lines of repetition.

**2. ~~[src/lib/firebase-notifications.js, notifyEventNewComment] Empty batch commit when actor is host with no audience~~** ✅ Fixed

Added `if (notifiedSet.size <= 1) return;` guard (line 300) before `batch.commit()`, consistent with `notifyEventModified`'s guard pattern.

**3. ~~[src/app/posts/[id]/PostDetailClient.jsx, line ~318] Actor object duplication~~** ✅ Fixed

Actor construction extracted to a single `const actor` (line 303) shared by both `notifyPostNewComment` and `notifyPostCommentReply` calls.

---

### [STYLE NOTES]

**4. ~~[specs/.../post-comment-reply.test.jsx] CJS `require('react')` inside `vi.mock`~~** ✅ Fixed

All `require('react')` calls removed; now uses the ESM `await import('react')` pattern consistent with other test files.

**5. [specs/.../comment-notifications.spec.js, line 131] E2E `signOut` type error** ⚪ Pre-existing

`window.testFirebaseHelpers.signOut` is flagged as a type error, but the property IS correctly defined at runtime (`src/lib/firebase-client.js:43`). This is a pre-existing `window.d.ts` type declaration gap shared with `014-notification-system`, not in scope for this feature.

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

✅ **Worth merging** — Core logic is sound, dedup is correctly implemented, service layer isolation is maintained, no `@ts-ignore`, lint and type-check clean. All improvement opportunities (#1–#4) have been addressed. Only #5 (pre-existing type gap) remains as a known issue outside this feature's scope.

## KEY INSIGHT

The `Set`-based priority dedup in `notifyEventNewComment` is the linchpin of this feature — it turns a combinatorial explosion of role × notification type into a simple linear scan. If this data structure were wrong, the whole feature would be a mess of special cases. It's right.
