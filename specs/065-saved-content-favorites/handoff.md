# Saved Content Favorites Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run`
- Branch: `main`
- Specs path: `specs/065-saved-content-favorites/`
- Current phase: `deployed_ready_for_local_sync`
- Active task: none
- Active wave: none
- Current HEAD: `34664f89d2f18ee707079886779348c8b01bcedc`
- Remote head: `origin/main` at `34664f89d2f18ee707079886779348c8b01bcedc`
- Origin main base observed: `55130520c0e1ff9a5222bf3c6c2f41dfd97be3ed`
- Historical branch commits already pushed before this repair:
  - `e7394450f7393481a1bcc418ab6e0726993e240d` Add private content favorites
  - `d6ac09f9a64f694833be097e1a816f3bc2806a5c` Fix event detail landmark
- Workflow/state repair commit:
  - `95be04b582eb7c682d1a098f1cb3fac4aa66ee6a` Harden workflow closeout state
- PR #99 merged into `main`:
  - `34664f89d2f18ee707079886779348c8b01bcedc` Add saved content favorites (#99)
- Latest reviewer decision: T007 `review_passed`; T007 is complete.
- Latest reviewer summary at verification close: T007 test content, branch E2E mapping in `scripts/test-e2e-branch.sh`, and E2E REST auth cleanup passed review. Focused E2E, forced branch E2E mapping, branch tests, audits, workflow checks, lint, type-check, and whitespace checks passed at T007 close.
- Post-T007 permission-denied fallback incident: resolved by recording the incident, preserving the permission-denied-only fallback, and rerunning fresh local verification.
- Rules deploy status: deployed. `firebase deploy --only firestore:rules --project dive-into-run` exited 0, compiled `firestore.rules`, and released rules to `cloud.firestore`.
- CI workflow state incident: GitHub CI run `26150844340` failed `Workflow state check` while local `npm run workflow:check` passed. Root cause was GitHub shallow checkout missing ancestor commit objects needed by the closeout range guard; fix is CI checkout `fetch-depth: 0` plus allowing exactly `.github/workflows/ci.yml` as workflow evidence. Reviewer PASS was recorded for the checkout-depth fix; rerun CI `26151638769` succeeded.
- Latest user authorization for closeout: stage=yes, commit=yes, push=yes, pullRequest=yes, ciWatch=yes, merge=yes, deployFirestoreRules=yes, localMainSync=yes.
- Future authorization boundary: commit=true, push=true, pullRequest=true, ciWatch=true, merge=true, localMainSync=true, deployFirestoreRules=true.
- Last verified commit: `34664f89d2f18ee707079886779348c8b01bcedc`
- Blocked: no
- Blocked reason: none. Firestore rules deploy completed after PR #99 merge; final local `main` sync remains the only closeout action.
- Written spec approved by user on 2026-05-19.
- Planner produced P4 implementation plan and task slices.
- T001 completed after Reviewer PASS and Coordinator state sync.
- T002 completed after Reviewer PASS and Coordinator state sync.
- T003 completed after Reviewer PASS and Coordinator state sync.
- T004 completed after Reviewer PASS and Coordinator state sync.
- T005 completed after Reviewer PASS and Coordinator state sync.
- T006 completed after Reviewer PASS and Coordinator state sync.
- T007 completed after Reviewer PASS and Coordinator state sync.
- Post-T007 permission-denied fallback was implemented after the user report and reviewed. Production Firestore rules were deployed after PR #99 merge.
- Current repair authorization: edit=yes for deploy-evidence workflow state only; product/runtime/test/rules/script/docs outside `specs/065-saved-content-favorites/` remain non-scope.

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `docs/superpowers/task-profiles.md`
4. `docs/superpowers/task-contract.md`
5. `specs/065-saved-content-favorites/handoff.md`
6. `specs/065-saved-content-favorites/spec.md`
7. `specs/065-saved-content-favorites/plan.md`
8. `specs/065-saved-content-favorites/tasks.md`
9. `specs/065-saved-content-favorites/status.json`

## Next Action

Ready for deploy-evidence state PR/merge and final local main sync under the current explicit closeout authorization. Firestore rules deploy evidence is recorded in `status.json.rulesDeployStatus`.

## T007 Review And Verification

- T007 state: `completed`.
- Active task: none. Active wave: none.
- Completed tasks: T001 through T007.
- Test edits, branch E2E mapping, and E2E REST auth cleanup completed and Reviewer passed for:
  - `scripts/test-e2e-branch.sh`
  - `tests/e2e/saved-content-favorites.spec.js`
  - `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`
- Mapping Engineer modified only `is_emulator_spec()` in `scripts/test-e2e-branch.sh` to include `saved-content-favorites.spec.js`; Reviewer `review_passed`.
- Focused E2E first failed because `documentExists()` REST read lacked admin header and got Firestore rules 403; fixed within the authorized E2E test file by adding `Authorization: Bearer owner`; Reviewer `review_passed`.
- Product code edits and package/config edits remain non-scope for future work.
- Current workflow state is verified for closeout. Firestore rules deploy completed after PR #99 merge and is recorded in `status.json.rulesDeployStatus`.

| Command | Exit | Evidence |
| --- | --- | --- |
| `firebase emulators:exec --only auth,firestore,storage --project=demo-test "npx playwright test --config playwright.emulator.config.mjs tests/e2e/saved-content-favorites.spec.js"` | 0 | 3 passed; Reviewer rerun also 3 passed (14.4s). |
| `TEST_E2E_BRANCH_CHANGED_SPECS=tests/e2e/saved-content-favorites.spec.js npm run test:e2e:branch` | 0 | Sandbox first failed with port EPERM; escalated rerun passed. Branch script routed spec to `Emulator specs without feature setup`; Playwright 3 passed (15.0s). |
| `npm run test:e2e:branch` | 0 | Historical normal changed detection run exited 0 with a documented skip before commit and push. Forced branch evidence validated mapping and spec execution. |
| `npm run test:branch` | 0 | Browser Vitest 7 passed / 89 tests; server rules 6 passed / 88 tests. |
| `npm run depcruise` | 0 | No dependency violations found (1540 modules, 3898 dependencies), with existing MODULE_TYPELESS warning only. |
| `bash scripts/audit-mock-boundary.sh` | 0 | 0 findings. |
| `bash scripts/audit-flaky-patterns.sh` | 0 | 0 findings. |
| `npm run audit:use-effect-data-fetching` | 0 | 0 findings. |
| `npm run audit:playwright-official-only` | 0 | 0 findings. |
| `npm run workflow:validate` | 0 | 6 status files valid. |
| `npm run workflow:check` | 0 | 6 status files synced. |
| `git diff --check` | 0 | No output. |
| `npm run lint:changed` | 0 | Existing React-version warning only. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |

## Final Local Verification For Closeout

- Fresh verification ran after the workflow/state repair and before commit `95be04b582eb7c682d1a098f1cb3fac4aa66ee6a`.
- Commit `95be04b582eb7c682d1a098f1cb3fac4aa66ee6a` passed the repo pre-commit gate.
- PR #99 CI follow-up: GitHub CI run `26150844340` failed `Workflow state check`; local `npm run workflow:check` passed. The CI checkout now uses `fetch-depth: 0`, and `scripts/check-superpowers-state.js` treats only `.github/workflows/ci.yml` as additional workflow evidence so this workflow repair is not misclassified as product change in closeout-ish phases.
- PR #99 GitHub checks on head `23b9e0e3a572f61cb2f4834feba6f700ec035ed5`: `CI` run `26151638769` succeeded, including `ci` and `e2e`; `Firestore Rules Gate` run `26151638732` succeeded; `Quality Budgets` run `26151638734` succeeded.
- PR #99 was squash merged to `main` at `34664f89d2f18ee707079886779348c8b01bcedc`.
- Firestore rules deploy: `firebase deploy --only firestore:rules --project dive-into-run` exited 0; `firestore.rules` compiled successfully and was released to `cloud.firestore`.
- Legacy active spec directory `specs/saved-content-favorites/` was removed so the only active saved-content-favorites workflow state is `specs/065-saved-content-favorites/`.

| Command | Exit | Evidence |
| --- | --- | --- |
| `npm run workflow:validate` | 0 | 6 status files valid. |
| `npm run workflow:check` | 0 | 6 status files synced. |
| `npm run workflow:links` | 0 | 41 local-reference files scanned; all local references exist. |
| `git diff --check` | 0 | No output. |
| `npm run lint:changed` | 0 | Existing React-version warning only. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |
| `npm run test:branch` | 0 | Browser Vitest 20 files / 176 tests passed; server rules 6 files / 88 tests passed. |
| `npm run test:server -- tests/server/rules/content-favorites.rules.test.js` | 0 | 30 passed. |
| `npm run depcruise` | 0 | No dependency violations found across 1540 modules and 3899 dependencies; existing MODULE_TYPELESS warning only. |
| `bash scripts/audit-mock-boundary.sh` | 0 | 0 findings. |
| `bash scripts/audit-flaky-patterns.sh` | 0 | 0 findings. |
| `npm run audit:use-effect-data-fetching` | 0 | 0 findings. |
| `npm run audit:playwright-official-only` | 0 | 0 findings. |
| `npm run test:e2e:branch` | 0 | `tests/e2e/saved-content-favorites.spec.js` 3 passed. |
| `git commit -m "Harden workflow closeout state"` | 0 | Created `95be04b582eb7c682d1a098f1cb3fac4aa66ee6a`; pre-commit passed full lint, type-check, depcruise, spellcheck, workflow checks, links, browser Vitest 171 files / 1496 tests, and audits. |

## Post-T007 Permission-Denied Fallback Incident

- User report: after login, `/posts` and `/events` showed console `FirebaseError: Missing or insufficient permissions.`
- Root cause: localhost:3001 connects to production Firestore; after login, background favorite status hydration reads `users/{uid}/favoritePosts|favoriteEvents/{targetId}`. If production rules do not yet include the new favorite subcollection rules, Firestore returns `permission-denied`.
- Fallback: background favorite status hydration treats only `permission-denied` as empty/no-op to avoid console noise and page break. Generic errors still throw/log. User-triggered add/remove favorite failures still rollback and show toast.
- Reviewer decision: `review_passed`; no blocking findings.
- Authorization note: existing state did not contain explicit product-code edit authorization for this follow-up. Do not infer authorization.
- Residual risk: permission-denied fallback remains defensive for stale clients or rule propagation delays; active user write failures still toast.
- Rules deploy status: deployed after PR #99 merge; production deploy evidence is recorded in `status.json.rulesDeployStatus`.
- Changed files:
  - `src/runtime/hooks/usePostsPageRuntimeHelpers.js`
  - `src/runtime/hooks/useEventsPageRuntime.js`
  - `tests/unit/runtime/usePostsPageRuntime.test.jsx`
  - `tests/unit/runtime/useEventsPageRuntime.test.jsx`

| Command | Exit | Evidence |
| --- | --- | --- |
| RED focused unit | 1 | Posts regression expected posts length 2 but got 0; events regression saw `console.error('載入活動收藏狀態失敗:', permission-denied)`. |
| `npx vitest run --project=browser tests/unit/runtime/usePostsPageRuntime.test.jsx tests/unit/runtime/useEventsPageRuntime.test.jsx` | 0 | 2 files / 28 tests passed. |
| `npm run lint:changed` | 0 | Existing React-version warning only. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |
| `git diff --check` | 0 | No output. |

## T006 Review And Verification

- Final T006 Reviewer decision: `review_passed`.
- Reviewer blocking findings: none.
- Previous blockers closed:
  - `loadType` uses memoized `uid`, not `user.uid`.
  - Dependencies are coherent.
  - Mock user includes `photoURL`, `bio`, and `getIdToken`.
- Contract checks:
  - `/member` signed-in `我的收藏` link routes to `/member/favorites`.
  - `/member/favorites` route/page wiring exists.
  - Tabs `收藏文章` and `收藏活動` are covered.
  - Card hrefs are covered for `/posts/:id` and `/events/:id`.
  - Missing target and undo restore are covered.
- Browser evidence:
  - `/member/favorites` desktop/mobile tabs verified with 0 console errors.
  - `/member` live unauth limitation covered by integration test for signed-in link.
  - Empty live data means cards, missing target, remove, and undo are covered by focused tests.
  - Screenshots: `/private/tmp/t006-desktop-member.png`, `/private/tmp/t006-desktop-member-favorites.png`, `/private/tmp/t006-mobile-member.png`, `/private/tmp/t006-mobile-member-favorites.png`.
- Changed files:
  - `src/app/member/favorites/page.jsx`
  - `src/runtime/hooks/useMemberFavoritesRuntime.js`
  - `src/ui/member/MemberFavoritesScreen.jsx`
  - `src/ui/member/MemberFavoritesScreen.module.css`
  - `src/ui/member/MemberPageScreen.jsx`
  - `tests/unit/runtime/useMemberFavoritesRuntime.test.jsx`
  - `tests/integration/member/MemberFavoritesPage.test.jsx`

| Command | Exit | Evidence |
| --- | --- | --- |
| `npx vitest run --project=browser tests/unit/runtime/useMemberFavoritesRuntime.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx` | 0 | 2 files / 10 tests passed. |
| `npm run audit:use-effect-data-fetching` | 0 | 0 findings. |
| `npm run lint:changed` | 0 | Existing React settings warning only. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |
| `git diff --check` | 0 | No output. |
| `git status --short` | 0 | Dirty feature worktree as expected. |

## T005 Review And Verification

- Final T005 Reviewer decision: `review_passed`.
- Reviewer blocking findings: none.
- Reviewer check highlights:
  - Feed bookmark is outside the host menu in `eventCardTopActions`.
  - Detail bookmark is in the title action cluster with share/status/menu.
  - Unauthenticated path returns before writes with exact login toast.
  - Rollback restores prior favorite state.
  - Toast strings match the spec exactly.
  - Mobile detail overlap fix is present.
- Browser evidence:
  - Report: `/private/tmp/dive-favorites-browser-evidence/report.json`.
  - `/events` desktop/mobile: 4 bookmark buttons in row `eventCardTopActions`.
  - `/events/[id]` desktop/mobile: 1 bookmark in row `detailHeaderRight`.
  - No `consoleErrors` or `failedRequests`.
  - Mobile detail has no visible overlap after fix.
  - Unauthenticated `/events` desktop/mobile: login toast visible and `favoriteRequests` empty.
  - Screenshots under `/private/tmp/dive-favorites-browser-evidence/`.
- Changed files:
  - `src/runtime/hooks/useEventsPageRuntime.js`
  - `src/runtime/hooks/useEventDetailRuntime.js`
  - `src/ui/events/EventsPageScreen.jsx`
  - `src/ui/events/EventsListSection.jsx`
  - `src/ui/events/EventsPageScreen.module.css`
  - `src/ui/events/EventDetailScreen.jsx`
  - `src/ui/events/EventDetailScreen.module.css`
  - `tests/unit/runtime/useEventsPageRuntime.test.jsx`
  - `tests/unit/runtime/useEventDetailRuntime.test.jsx`
  - `tests/integration/events/EventFavorites.test.jsx`

| Command | Exit | Evidence |
| --- | --- | --- |
| `npx vitest run --project=browser tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/runtime/useEventDetailRuntime.test.jsx tests/integration/events/EventFavorites.test.jsx` | 0 | 3 files / 25 tests passed. |
| `npm run audit:use-effect-data-fetching` | 0 | 0 findings. |
| `npm run lint:changed` | 0 | Existing React-version warning only. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |
| `git diff --check` | 0 | No whitespace errors. |

## T004 Review And Verification

- Final T004 Reviewer decision: `review_passed`.
- Reviewer blocking findings: none.
- Reviewer check highlights:
  - Feed/detail placement at far-right row edge.
  - Detail bookmark is in the body interaction row below body text.
  - Unauthenticated toast returns before write.
  - Rollback restores prior favorite state.
  - Toast strings match the spec exactly.
- Browser evidence:
  - Report: `/private/tmp/dive-favorites-browser-evidence/report.json`.
  - `/posts` desktop/mobile: 8 bookmark buttons, `rightGapToRow=0`.
  - `/posts/[id]` desktop/mobile: 1 bookmark, `rightGapToRow=0`.
  - Unauthenticated `/posts` desktop/mobile: login toast visible and `favoriteRequests` empty.
  - Screenshots under `/private/tmp/dive-favorites-browser-evidence/`.
- Changed files:
  - `src/runtime/hooks/usePostsPageRuntimeHelpers.js`
  - `src/runtime/hooks/usePostsPageRuntime.js`
  - `src/runtime/hooks/usePostDetailRuntime.js`
  - `src/components/PostCard.jsx`
  - `src/components/PostCard.module.css`
  - `src/ui/posts/PostsPageScreen.jsx`
  - `src/ui/posts/PostDetailScreen.jsx`
  - `tests/unit/runtime/usePostsPageRuntime.test.jsx`
  - `tests/unit/runtime/usePostDetailRuntime.test.jsx`
  - `tests/integration/posts/PostCard.test.jsx`
  - `tests/integration/posts/PostFeed.test.jsx`
  - `tests/integration/posts/PostDetail.test.jsx`

| Command | Exit | Evidence |
| --- | --- | --- |
| `npx vitest run --project=browser tests/unit/runtime/usePostsPageRuntime.test.jsx tests/unit/runtime/usePostDetailRuntime.test.jsx tests/integration/posts/PostCard.test.jsx tests/integration/posts/PostFeed.test.jsx tests/integration/posts/PostDetail.test.jsx` | 0 | 5 files / 68 tests passed. |
| `npm run audit:use-effect-data-fetching` | 0 | 0 findings. |
| `npm run lint:changed` | 0 | Existing React-version warning only. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |
| `git diff --check` | 0 | No whitespace errors. |

## T003 Review And Verification

- Final T003 Reviewer decision: `review_passed`.
- Reviewer blocking findings: none.
- Reviewer check highlights:
  - Native `<button>` with `type="button"`, `aria-label`, `aria-pressed`, `disabled`, and `onClick` in `src/components/BookmarkButton.jsx`.
  - Local inline SVG, no icon dependency, inactive `fill="none"` vs active `fill="currentColor"`.
  - Stable button/icon dimensions in `BookmarkButton.module.css`.
  - Tests cover inactive, active, label, disabled/no-click, enabled click behavior.
- Engineer RED evidence: `npx vitest run --project=browser tests/integration/shared/BookmarkButton.test.jsx`: exit 1; expected failure resolving `@/components/BookmarkButton` because primitive did not exist.
- Residual risks:
  - Branch-wide tests not run; only required T003 verification.
  - Untracked files required direct read during review; closeout must stage precise files later.
  - Route/card integration and browser placement evidence intentionally deferred to later tasks.
- Changed files:
  - `src/components/BookmarkButton.jsx`
  - `src/components/BookmarkButton.module.css`
  - `tests/integration/shared/BookmarkButton.test.jsx`

| Command | Exit | Evidence |
| --- | --- | --- |
| `npx vitest run --project=browser tests/integration/shared/BookmarkButton.test.jsx` | 0 | 1 file / 5 tests passed. |
| `npm run lint:changed` | 0 | Existing React version settings warning only. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |
| `git diff --check` | 0 | No whitespace errors. |

## T002 Review And Verification

- Final T002 Reviewer decision: `review_passed`.
- Reviewer blocking findings: none.
- Reviewer check highlights:
  - Legacy `showToast(message, type)` preserved; optional third arg action in `ToastProvider.jsx` / `ToastProvider.d.ts`.
  - Action renders only when present and is native `<button>` in `Toast.jsx`.
  - Close still calls `onClose(id)`.
  - success/info auto-dismiss remains 3000ms; error does not auto-dismiss.
  - No favorites-specific logic.
  - Tests cover legacy, action render/click, close remove.
- Engineer RED evidence: `npx vitest run --project=browser tests/integration/shared/ToastUndo.test.jsx`: exit 1; expected failure 2 failed / 2 passed, action button `復原` not found while legacy/close tests passed.
- Residual risks:
  - Branch-wide tests not run; only T002 required verification.
  - Untracked test file required direct read during review; closeout must stage precise files later.
- Changed files:
  - `src/runtime/providers/ToastProvider.jsx`
  - `src/runtime/providers/ToastProvider.d.ts`
  - `src/components/Toast.jsx`
  - `src/components/Toast.module.css`
  - `tests/integration/shared/ToastUndo.test.jsx`

| Command | Exit | Evidence |
| --- | --- | --- |
| `npx vitest run --project=browser tests/integration/shared/ToastUndo.test.jsx` | 0 | 1 file / 4 tests passed. |
| `npm run lint:changed` | 0 | Existing React version settings warning only. |
| `npm run type-check:changed` | 0 | No changed-file type errors. |
| `git diff --check` | 0 | No whitespace errors. |

## T001 Review And Verification

- Final T001 Reviewer decision: `review_passed`.
- Reviewer blocking findings: none.
- Reviewer residual risk: no direct test for payload `targetId: ''` against a normal doc id; current rule rejects via doc-id equality plus regex and empty doc ID is not a real matching path, so non-blocking.
- Changed files:
  - `firestore.rules`
  - `src/repo/client/firebase-content-favorites-repo.js`
  - `src/service/content-favorite-service.js`
  - `src/runtime/client/use-cases/content-favorite-use-cases.js`
  - `tests/server/rules/content-favorites.rules.test.js`
  - `tests/unit/service/content-favorite-service.test.js`
  - `tests/unit/runtime/content-favorite-use-cases.test.js`

| Command | Exit | Evidence |
| --- | --- | --- |
| `npm run test:server -- tests/server/rules/content-favorites.rules.test.js` | 0 | 30 passed. |
| `npx vitest run --project=browser tests/unit/service/content-favorite-service.test.js` | 0 | 7 passed. |
| `npx vitest run --project=browser tests/unit/runtime/content-favorite-use-cases.test.js` | 0 | 8 passed. |
| `npm run lint:changed` | 0 | Existing React-version warning only. |
| `npm run type-check:changed` | 0 | Changed-file type-check passed. |
| `git diff --check` | 0 | No whitespace errors. |

## Plan Reviewer Verification

| Command | Exit | Evidence |
| --- | --- | --- |
| `rg -n "AC-T001|add/remove|batch|latest target|doc id mismatch|extra field|favoritePosts|favoriteEvents" specs/065-saved-content-favorites/tasks.md specs/065-saved-content-favorites/status.json` | 0 | Reviewer confirmed T001 acceptance coverage and rules/data terms are synced across `tasks.md` and `status.json`. |
| `node scripts/validate-workflow-state.js specs/065-saved-content-favorites/status.json` | 0 | Reviewer confirmed workflow status schema validation passed. |
| `node scripts/check-superpowers-state.js specs/065-saved-content-favorites/status.json` | 0 | Reviewer confirmed Superpowers state check passed. |
| `git diff --check` | 0 | Reviewer confirmed no whitespace errors. |

## Latest Verification

Verified at: `2026-05-19T22:54:25+08:00`.

| Command | Exit | Evidence |
| --- | --- | --- |
| `node scripts/validate-workflow-state.js specs/065-saved-content-favorites/status.json` | 0 | `status.json: ok`; `WORKFLOW STATE: 1 status file(s) valid` after T007 completion state sync. |
| `node scripts/check-superpowers-state.js specs/065-saved-content-favorites/status.json` | 0 | `status.json: ok`; `sync ok`; `SUPERPOWERS CHECK: 1 status file(s) synced` after T007 completion state sync. |
| `git diff --check` | 0 | No output; no whitespace errors after T007 completion state sync. |

## Closeout Checklist

- [x] `tasks.md` task states match `status.json`.
- [x] Active task and active wave match `status.json`.
- [x] Latest reviewer decision is recorded in `handoff.md` and `tasks.md`; `status.json` records the resulting phase.
- [x] `lastVerification` has one entry per command when verification is recorded.
- [x] Changed files are intentionally in scope.
- [x] Blockers are resolved or explicitly carried forward.

## Blockers

- Current workflow blocker: none. PR #99 merged at `34664f89d2f18ee707079886779348c8b01bcedc`; `lastVerifiedCommit` now points at that main commit.
- Release blocker: none for closeout execution. Firestore rules deploy completed with `firebase deploy --only firestore:rules --project dive-into-run` exit 0.
- Historical T007 verifier blockers were resolved by T007 evidence: E2E spec existed and passed, `npm run depcruise` passed, and `bash scripts/audit-mock-boundary.sh` passed.

## Pitfalls

- Do not treat user message `1` or `好` as authorization for product code edits, package/config edits, commit, push, PR, merge, CI watch, or local main sync.
- T007 is complete. Current closeout authorization includes staging, commit, push, PR, CI watch, merge, deploy, and local main sync; future work must obtain fresh boundary authorization.
- Do not place post-feed bookmark buttons only next to the like and comment group; they must sit at the far right of the bottom interaction row container.
- Do not place event bookmark actions inside the author or host operation menu; they must be independent buttons near the right-side action cluster.
- Do not store target snapshots in favorite documents.
- Do not add a public favorites count, tags, manual sort, notifications, recommendations, or icon dependencies.
- Firestore rules changes require server rules tests.
- Browser evidence is mandatory for UI placement and undo flows.
