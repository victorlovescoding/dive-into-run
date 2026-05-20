# Saved Content Favorites Implementation Plan

**For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. The task board in `specs/065-saved-content-favorites/tasks.md` uses checkbox-compatible task sections for tracking.

**Goal:** Build private saved-content favorites for posts and events, with member favorites management, bookmark controls on all required cards and detail views, owner-only Firestore rules, and regression coverage.

**Architecture:** Favorite documents live under `users/{uid}/favoritePosts/{postId}` and `users/{uid}/favoriteEvents/{eventId}` with only `targetId` and `createdAt`. Data access stays in `src/repo/client`, shape and validation stay in `src/service`, product use-cases stay in `src/runtime/client/use-cases`, runtime hooks orchestrate auth, optimistic UI, toast, and target hydration, while UI files stay render-only.

**Tech Stack:** Next.js 15 App Router, React 19, JavaScript with JSDoc `checkJs`, Firebase Firestore v9 client SDK, Firebase rules-unit-testing, Vitest browser and server projects, Playwright Chromium E2E, CSS Modules.

---

## Current Authorization

- Planning artifact edits are authorized for this Planner pass.
- Implementation is not authorized: edit=no, commit=no, push=no, PR=no, merge=no, local main sync=no.
- Engineers must not modify production code, tests, rules, package files, or workflow state until the plan artifacts pass Reviewer review and the user explicitly grants the next boundary.
- Planned commit checkpoints in `tasks.md` are future intent only. They are not commands and are not currently authorized.

## Product Decisions Locked By Spec

- Favorites are private and visible only to the signed-in owner.
- Favorite documents use the target id as the document id.
- Favorite documents store only `targetId` and `createdAt`; no target title, summary, author, event, tag, count, notification, recommendation, or sort metadata is stored.
- `/member` has a visible signed-in entry labeled `我的收藏` that links to `/member/favorites`.
- `/member/favorites` has two tabs: `收藏文章` and `收藏活動`, sorted by favorite `createdAt` descending.
- The favorites page reads latest `posts/{postId}` and `events/{eventId}` documents by id and keeps missing targets visible as `內容已不存在` with remove support.
- Favorites page removal is optimistic and has toast undo. Undo restores the favorite document.
- Bookmark controls are independent buttons with aria label and pressed state.
- Bookmark icon is IG-style outline when inactive and filled when active, implemented locally without adding an icon dependency.
- Required placements:
  - Post feed: far right edge of the bottom interaction row container.
  - Post detail: far right of the interaction row below body text.
  - Event feed: top-right action cluster near but separate from the three-dot menu.
  - Event detail: title-area top-right action cluster near share, status, and menu.

## Architecture And Data Flow

1. User clicks a bookmark button in a post feed card, post detail, event feed card, or event detail header.
2. Runtime handler checks `user.uid`.
3. If unauthenticated, no Firestore call runs and `showToast('請先登入才能收藏', 'info')` is emitted.
4. If authenticated, runtime updates local favorite state optimistically.
5. Use-case writes or deletes the owner-scoped favorite doc through `firebase-content-favorites-repo`.
6. Add writes `targetId` and `createdAt: serverTimestamp()` to the owner subcollection using target id as document id.
7. Remove deletes the owner favorite doc.
8. Success emits `已加入收藏` or `已取消收藏`; failure emits the required failure toast and restores the previous UI state.
9. Feed runtimes keep favorite id sets separate from the target item data so list, filter, and pagination logic can stay focused on posts or events.
10. Member favorites runtime loads favorite docs sorted newest first, resolves target documents by id, preserves favorite order, and represents missing targets with a null target.
11. Favorites page cards link to `/posts/[id]` or `/events/[id]`. Missing-target cards do not link and expose remove.
12. Favorites page remove deletes optimistically from local lists and calls toast undo. Undo re-creates the same favorite doc with a fresh `createdAt`, which is acceptable because the spec requires newest favorite sorting and no historical restore timestamp.

## Files And Responsibilities

| Path | Action | Responsibility |
| --- | --- | --- |
| `src/repo/client/firebase-content-favorites-repo.js` | Create | Firestore-only adapter for favorite post and event subcollections, including set, delete, owner list query, batch id lookup, and target doc lookup. |
| `src/service/content-favorite-service.js` | Create | Favorite type constants, collection names, target collection names, payload validation, favorite doc normalization, and missing-target item shaping. |
| `src/runtime/client/use-cases/content-favorite-use-cases.js` | Create | Product-facing favorite use-cases for add, remove, batch status lookup, favorites page loading, and no snapshot persistence. |
| `firestore.rules` | Modify | Owner-only read, create, delete for `favoritePosts` and `favoriteEvents`; reject update; enforce doc id and payload shape. |
| `tests/server/rules/content-favorites.rules.test.js` | Create | Rules tests for owner read/create/delete, cross-user denial, update denial, invalid payload denial, and target id doc id matching. |
| `tests/unit/service/content-favorite-service.test.js` | Create | Service tests for payload creation, collection mapping, favorite sorting assumptions, and missing target shaping. |
| `tests/unit/runtime/content-favorite-use-cases.test.js` | Create | Use-case tests with Firebase SDK boundary mocks proving paths, payload shape, batch status, and latest target resolution. |
| `src/runtime/providers/ToastProvider.jsx` | Modify | Add optional toast action support for undo without changing existing call sites. |
| `src/runtime/providers/ToastProvider.d.ts` | Modify | Keep the public toast type contract aligned with optional action support. |
| `src/components/Toast.jsx` | Modify | Render an optional action button and keep close behavior accessible. |
| `src/components/Toast.module.css` | Modify | Style the toast action button without breaking current success, info, and error variants. |
| `tests/integration/shared/ToastUndo.test.jsx` | Create | Integration coverage for action rendering, action click, auto-dismiss compatibility, and legacy `showToast(message, type)` compatibility. |
| `src/components/BookmarkButton.jsx` | Create | Reusable accessible bookmark button with local outline and filled SVG states. |
| `src/components/BookmarkButton.module.css` | Create | Stable icon-button sizing, focus ring, inactive and active visual states. |
| `tests/integration/shared/BookmarkButton.test.jsx` | Create | Integration coverage for aria label, pressed state, filled and outline icon state, disabled state, and click callback. |
| `src/runtime/hooks/usePostsPageRuntimeHelpers.js` | Modify | Add favorite id hydration support while preserving liked and author flags. |
| `src/runtime/hooks/usePostsPageRuntime.js` | Modify | Load favorite ids for visible posts, expose favorite toggle handler, perform optimistic rollback, and emit required toasts. |
| `src/runtime/hooks/usePostDetailRuntime.js` | Modify | Load and toggle the current post favorite state independently of like and comment state. |
| `src/components/PostCard.jsx` | Modify | Accept bookmark state and handler, render bookmark at far right of `metaBar`, and keep author menu behavior unchanged. |
| `src/components/PostCard.module.css` | Modify | Convert `metaBar` to a full-width interaction row with left meta group and right bookmark slot. |
| `src/ui/posts/PostsPageScreen.jsx` | Modify | Pass post favorite state and toggle handler into each `PostCard`. |
| `src/ui/posts/PostDetailScreen.jsx` | Modify | Pass detail favorite state and toggle handler into the detail `PostCard`. |
| `tests/unit/runtime/usePostsPageRuntime.test.jsx` | Modify | Cover favorite hydration, unauthenticated toast, add success, add failure rollback, remove success, and remove failure rollback. |
| `tests/unit/runtime/usePostDetailRuntime.test.jsx` | Modify | Cover detail favorite load, toggle, and rollback behavior. |
| `tests/integration/posts/PostCard.test.jsx` | Modify | Cover bookmark accessibility and placement contract inside the meta row. |
| `tests/integration/posts/PostFeed.test.jsx` | Modify | Cover feed bookmark rendering and click behavior through the page composition. |
| `tests/integration/posts/PostDetail.test.jsx` | Modify | Cover detail bookmark rendering and click behavior. |
| `src/runtime/hooks/useEventsPageRuntime.js` | Modify | Maintain favorite event id set for current events, refresh after list changes, expose event favorite toggle handler, and emit required toasts. |
| `src/runtime/hooks/useEventDetailRuntime.js` | Modify | Load and toggle favorite state for the current event detail. |
| `src/ui/events/EventsPageScreen.jsx` | Modify | Pass favorite id set and toggle handler from runtime to `EventsListSection`. |
| `src/ui/events/EventsListSection.jsx` | Modify | Render bookmark in the top-right action cluster near but separate from the event menu. |
| `src/ui/events/EventsPageScreen.module.css` | Modify | Add stable top-right action cluster layout for bookmark and menu without moving join or leave buttons. |
| `src/ui/events/EventDetailScreen.jsx` | Modify | Render bookmark in the detail header right action cluster near share, status, and menu. |
| `src/ui/events/EventDetailScreen.module.css` | Modify | Add spacing and stable sizing for the event detail bookmark action. |
| `tests/unit/runtime/useEventsPageRuntime.test.jsx` | Modify | Cover favorite event id refresh, unauthenticated toast, add and remove success, rollback failures, and filter or pagination preservation. |
| `tests/unit/runtime/useEventDetailRuntime.test.jsx` | Modify | Cover detail favorite load, toggle, and rollback behavior. |
| `tests/integration/events/EventFavorites.test.jsx` | Create | Cover event feed and event detail bookmark rendering, accessibility, and separation from the host menu. |
| `src/app/member/favorites/page.jsx` | Create | Thin App Router entry that calls member favorites runtime and renders the screen. |
| `src/runtime/hooks/useMemberFavoritesRuntime.js` | Create | Favorites page runtime for tabs, loading, missing target handling, optimistic remove, and undo restore. |
| `src/ui/member/MemberFavoritesScreen.jsx` | Create | Render-only member favorites page with tabs, linked cards, missing-target cards, remove buttons, and empty states. |
| `src/ui/member/MemberFavoritesScreen.module.css` | Create | Favorites page tab, card, action, and missing-target styling. |
| `src/ui/member/MemberPageScreen.jsx` | Modify | Add a visible signed-in entry labeled `我的收藏` linking to `/member/favorites` without changing dashboard tab responsibilities. |
| `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx` | Create | Cover tab data loading, newest favorite order, missing targets, optimistic remove, undo restore, and rollback failures. |
| `tests/integration/member/MemberFavoritesPage.test.jsx` | Create | Cover `/member/favorites` tab UI, links to detail pages, missing-target remove, and undo action through ToastProvider. |
| `tests/e2e/saved-content-favorites.spec.js` | Create | Browser-level saved favorites journey across post feed, post detail, event feed, event detail, and member favorites page. |

## Task Slices

| Task | Wave | Depends On | Summary | Parallel Rule |
| --- | --- | --- | --- | --- |
| T001 | wave-1 | Plan review PASS and implementation authorization | Firestore data foundation, use-cases, rules, and rules tests. | Serialized because rules and data contract are shared and security-sensitive. |
| T002 | wave-2 | T001 may run before or after, but plan review and implementation authorization are required | Toast undo action support. | Serialized because ToastProvider is shared app infrastructure. |
| T003 | wave-3 | T002 | Shared BookmarkButton primitive. | Serialized so post and event UI share one accessible control. |
| T004 | wave-4 | T001, T003 | Post feed and post detail favorites integration. | May run parallel with T005 only after Coordinator confirms owned files remain disjoint. Default serial. |
| T005 | wave-4 | T001, T003 | Event feed and event detail favorites integration. | May run parallel with T004 only after Coordinator confirms owned files remain disjoint. Default serial. |
| T006 | wave-5 | T001, T002 | Member favorites page and `/member` entry. | Serialized after shared data and toast contracts are stable. |
| T007 | wave-6 | T004, T005, T006 | E2E coverage and final integration gate. | Serialized final verification slice. |

Dependency graph:

- Plan Reviewer PASS and explicit implementation edit authorization are prerequisites for every task.
- T001 must complete before T004, T005, and T006.
- T002 must complete before T003 and T006.
- T003 must complete before T004 and T005.
- T004 and T005 have disjoint owned files and can be parallel only if separate Engineer and Reviewer lanes are assigned.
- T006 starts after T001 and T002; it does not require T004 or T005 unless the Coordinator wants one full UI integration lane at a time.
- T007 starts after T004, T005, and T006 pass review.

## Testing Strategy

Required test approach:

- Use RED then GREEN for every task. The Engineer first adds failing tests for the task behavior, runs the focused command and records the failure signal, then implements the minimum code inside owned files.
- Unit tests cover service normalization, use-case contracts, runtime optimistic state, rollback, and toast decisions.
- Integration tests cover accessible UI, render composition, card placement, tabs, links, missing-target state, and toast undo rendering.
- Server rules tests cover owner-only permissions and rejected updates.
- E2E covers a signed-in user journey and unauthenticated guard for bookmark actions.
- Browser evidence is required for every UI task and must include desktop and mobile screenshots plus console and network checks.
- The final integration gate runs branch-level Vitest, E2E branch routing, lint, type-check, dependency cruise, useEffect fetch audit, mock boundary audit, flaky audit, Playwright audit, workflow validation, and diff whitespace validation.

Focused verification commands by slice:

| Slice | Command | Expected Signal |
| --- | --- |
| T001 | `npm run test:server -- tests/server/rules/content-favorites.rules.test.js` | Exit 0, all content favorite rules tests pass. |
| T001 | `npx vitest run --project=browser tests/unit/service/content-favorite-service.test.js` | Exit 0, service contract tests pass. |
| T001 | `npx vitest run --project=browser tests/unit/runtime/content-favorite-use-cases.test.js` | Exit 0, use-case tests pass. |
| T001 | `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| T001 | `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| T001 | `git diff --check` | Exit 0, no whitespace errors. |
| T002 | `npx vitest run --project=browser tests/integration/shared/ToastUndo.test.jsx` | Exit 0, toast undo integration tests pass. |
| T002 | `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| T002 | `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| T002 | `git diff --check` | Exit 0, no whitespace errors. |
| T003 | `npx vitest run --project=browser tests/integration/shared/BookmarkButton.test.jsx` | Exit 0, bookmark button tests pass. |
| T003 | `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| T003 | `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| T003 | `git diff --check` | Exit 0, no whitespace errors. |
| T004 | `npx vitest run --project=browser tests/unit/runtime/usePostsPageRuntime.test.jsx tests/unit/runtime/usePostDetailRuntime.test.jsx tests/integration/posts/PostCard.test.jsx tests/integration/posts/PostFeed.test.jsx tests/integration/posts/PostDetail.test.jsx` | Exit 0, post favorite unit and integration tests pass. |
| T004 | `npm run audit:use-effect-data-fetching` | Exit 0, no UI data-fetch or hook dependency suppression violations. |
| T004 | `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| T004 | `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| T004 | `git diff --check` | Exit 0, no whitespace errors. |
| T005 | `npx vitest run --project=browser tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/runtime/useEventDetailRuntime.test.jsx tests/integration/events/EventFavorites.test.jsx` | Exit 0, event favorite unit and integration tests pass. |
| T005 | `npm run audit:use-effect-data-fetching` | Exit 0, no UI data-fetch or hook dependency suppression violations. |
| T005 | `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| T005 | `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| T005 | `git diff --check` | Exit 0, no whitespace errors. |
| T006 | `npx vitest run --project=browser tests/unit/runtime/useMemberFavoritesRuntime.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx` | Exit 0, member favorites unit and integration tests pass. |
| T006 | `npm run audit:use-effect-data-fetching` | Exit 0, no UI data-fetch or hook dependency suppression violations. |
| T006 | `npm run lint:changed` | Exit 0, no lint errors or warnings for changed files. |
| T006 | `npm run type-check:changed` | Exit 0, no changed-file type errors. |
| T006 | `git diff --check` | Exit 0, no whitespace errors. |
| T007 | `npx playwright test --config playwright.emulator.config.mjs tests/e2e/saved-content-favorites.spec.js` | Exit 0, saved favorites E2E passes. |
| T007 | `npm run test:branch` | Exit 0, branch Vitest gate passes. |
| T007 | `npm run test:e2e:branch` | Exit 0 or documented skip when no changed E2E spec is routed. |
| T007 | `npm run depcruise` | Exit 0, dependency direction passes. |
| T007 | `bash scripts/audit-mock-boundary.sh` | Exit 0, no forbidden internal mocks. |
| T007 | `bash scripts/audit-flaky-patterns.sh` | Exit 0, no flaky test patterns. |
| T007 | `npm run audit:use-effect-data-fetching` | Exit 0, no UI data-fetch or hook dependency suppression violations. |
| T007 | `npm run audit:playwright-official-only` | Exit 0, E2E official-only audit passes. |
| T007 | `npm run workflow:validate` | Exit 0, workflow status files are valid. |
| T007 | `npm run workflow:check` | Exit 0, workflow state is synced. |
| T007 | `git diff --check` | Exit 0, no whitespace errors. |

Browser and visual evidence is not part of the command matrix. It is a separate required evidence artifact for T004, T005, T006, and T007.

## Browser And Visual Evidence Expectations

Post UI evidence:

- `/posts`, desktop 1280 by 800 and mobile 390 by 844.
- Verify every visible post card has a bookmark button.
- Verify the post feed bookmark is at the far right of the bottom interaction row container, with like and comment controls grouped on the left.
- Verify unauthenticated click shows `請先登入才能收藏` and no failed network write appears.
- Signed-in path must show outline before add, filled after add, and rollback on forced failure when test instrumentation supports it.
- `/posts/[id]`, desktop and mobile, verify bookmark appears far right in the interaction row below body text.

Event UI evidence:

- `/events`, desktop 1280 by 800 and mobile 390 by 844.
- Verify every event card has bookmark in the top-right action cluster near but separate from the three-dot host menu.
- Verify bookmark is visible for non-host users even when the host menu is absent.
- `/events/[id]`, desktop and mobile, verify bookmark appears in the title-area right action cluster near share, status, and menu.

Member favorites evidence:

- `/member`, desktop and mobile, verify the visible entry label is exactly `我的收藏` and routes to `/member/favorites`.
- `/member/favorites`, desktop and mobile, verify tabs `收藏文章` and `收藏活動`, newest favorite first, detail links, missing-target text `內容已不存在`, remove, and undo.
- Every browser evidence report must include target URL, route or journey, viewport, tool, screenshot artifact path, console errors or warnings, failed network requests, expected signal, actual signal, and residual risk.

## Risks And Stop Conditions

- Stop if implementing favorites requires storing target snapshots or public counts. That violates the approved spec.
- Stop if a Firestore rules change cannot reject update or cannot enforce owner-only access.
- Stop if the favorite document shape needs fields beyond `targetId` and `createdAt`.
- Stop if ToastProvider action support would break existing `showToast(message, type)` call sites.
- Stop if implementation needs a new icon dependency.
- Stop if a task must touch files outside its owned files.
- Stop if UI placement cannot be verified with Browser evidence.
- Stop if an implementation task requires package changes, migration, data deletion, secrets, or any closeout boundary not authorized by the user.
- Stop if `tasks.md`, `status.json`, and `handoff.md` drift before dispatch or closeout.
- Stop after the second Reviewer rejection for the same task unless the Reviewer names a narrow mechanical fix inside the same owned files.

## Final Integration Gate

The final gate runs only after T001 through T006 have `review_passed` and Coordinator state sync. T007 owns the E2E spec and verifies the integrated feature. No commit, push, PR, merge, CI watch, or local main sync is authorized by this plan.
