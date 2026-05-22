# Runner Following Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox syntax in `tasks.md`; this plan is the technical source for architecture and boundaries.

**Goal:** Build v1 Instagram-like one-way runner following across public profiles, event organizer/host surfaces, and a signed-in member following-management page, with public counts/lists, optimistic follow/unfollow, security rules, and follow notifications.

**Architecture:** Follow relationships live as mirrored user subcollection documents under `users/{viewerUid}/following/{targetUid}` and `users/{targetUid}/followers/{viewerUid}`. The data foundation is implemented first because Firestore rules, repository transactions, the target-side denormalized `followersCount`, derived following-count reads, and notification type/routing are shared by every UI surface. UI work then consumes a single runtime follow controller so profile, member, and event screens share state semantics without duplicating mutation code.

**Tech Stack:** Next.js 15 App Router, React 19, JavaScript with JSDoc `checkJs`, Firebase v9 client SDK, Firestore security rules, Vitest browser/jsdom, Firebase emulator server rules tests, Playwright Chromium E2E.

---

## Scope Check

- Approved scope includes public profile follower/following counts and modal lists, profile follow/unfollow buttons, event list host follow/unfollow, event detail host follow/unfollow, member/dashboard `我的追蹤跑友` following list management for the signed-in user, public unauthenticated reads, authenticated writes only, self-follow guard, optimistic rollback toast, and follow notifications.
- Approved scope excludes private accounts, follow requests, blocks, discovery, following feed, inline notification follow-back, post poster follow buttons, comments follow buttons, participant-row follow buttons, and modal-row follow buttons.
- Member following management should follow the existing member favorites pattern: a signed-in-only member route, runtime hook, render-only screen, rows linking to target details, and a row-level remove action when useful. For following rows, an unfollow action is in scope because it matches the current member favorites list-management pattern.

## Architecture Boundaries

- Keep App Router entries thin. `src/app/**` may compose route-local client components but must not own Firestore logic.
- Firestore access belongs in `src/repo/client/**`.
- Business normalization and pure decisions belong in `src/service/**`.
- Runtime use-cases and hooks belong in `src/runtime/**`.
- Render-only reusable UI belongs in `src/components/**` or `src/ui/**`; it must not fetch in effects.
- Follow notification route support needs the existing notification link helper used by notification UI.
- No new dependency or `package-lock.json` change is planned.
- Firestore rules change is required during implementation, but deploy remains unauthorized and must stay recorded as required/not deployed until a separate release authorization and deploy evidence exist.

## Files And Responsibilities

| File | Responsibility |
| --- | --- |
| `firestore.rules` | Public read rules for follow lists, authenticated owner-only follow writes, self-follow denial, target `followersCount` update constraints, explicit denial of client-written `followingCount`, and notification type allowlist expansion. |
| `src/repo/client/firebase-follow-repo.js` | Firestore follow transaction, mirrored document writes/deletes, target `followersCount` writes, public follow list reads, derived following-count reads, follow-state reads, and batched status checks for visible hosts. |
| `src/service/follow-service.js` | Pure follow payload builders, actor/target validation, list item normalization, optimistic target follower-count transitions, derived following-count normalization, and idempotent result normalization. |
| `src/runtime/client/use-cases/follow-use-cases.js` | Runtime API for follow/unfollow/list/status using repo and service, plus notification creation only on not-following to following transition. |
| `src/service/notification-service.js` | Add `runner_followed` type support and exact message builder `X 已開始追蹤你。`. |
| `src/runtime/client/use-cases/notification-use-cases.js` | Add follow notification use-case that writes actor profile as notification actor and profile destination metadata. |
| `src/lib/notification-helpers.js` | Route `runner_followed` notification clicks to `/users/{actorUid}`. |
| `src/service/profile-mapper.js` | Map Firestore public profile payloads, including `followersCount`, into `PublicProfile` before page serialization. |
| `src/components/FollowButton.jsx` | Shared render-only follow/unfollow button with pending, following, hidden, and disabled states. |
| `src/components/FollowButton.module.css` | Shared button styling consistent with existing compact controls. |
| `src/app/users/[uid]/page.jsx` | Public profile server entry and serialization; passes `followersCount` from `users/{uid}` into `ProfileClient` while keeping following count derived from `users/{uid}/following`. |
| `src/runtime/hooks/useProfileRuntime.js` | Profile-level follow state, optimistic mutations, follower/following modal state, public list loading, count updates, and self/signed-out visibility rules. |
| `src/app/users/[uid]/ProfileClient.jsx` | Compose profile header, follow controls, stats, modals, and event list from runtime state. |
| `src/app/users/[uid]/ProfileStats.jsx` | Render existing activity stats plus clickable follower/following counts that open modals. |
| `src/app/users/[uid]/FollowListModal.jsx` | Route-local public follower/following modal with profile links and no inline follow buttons. |
| `src/app/users/[uid]/PublicProfile.module.css` | Profile follow button, stats button, and modal styles. |
| `src/ui/users/ProfileScreen.jsx` | Profile page layout slots for follow controls and modal while preserving self banner behavior. |
| `src/app/member/page.jsx` | Add member entry link to `我的追蹤跑友` for signed-in users, consistent with the current `我的收藏` entry. |
| `src/app/member/following/page.jsx` | Thin member following route entry that composes runtime and screen. |
| `src/runtime/hooks/useMemberFollowingRuntime.js` | Signed-in member following list runtime, list loading, optimistic unfollow, rollback toast, and signed-out guard state. |
| `src/ui/member/MemberFollowingScreen.jsx` | Render-only `我的追蹤跑友` page with followed runner rows, avatar/name profile links, loading/empty/error states, and optional unfollow action. |
| `src/ui/member/MemberFollowingScreen.module.css` | Member following page layout and row styles, aligned with member favorites list conventions. |
| `src/runtime/hooks/useEventsPageRuntime.js` | Batch-load follow state for visible event hosts and expose host follow mutation handlers for event list cards. |
| `src/ui/events/EventsListSection.jsx` | Render follow/unfollow beside event list host `UserLink` only for signed-in non-self hosts. |
| `src/ui/events/EventsPageScreen.module.css` | Event list host row follow-control styling. |
| `src/runtime/hooks/useEventDetailRuntime.js` | Load and mutate follow state for the event detail host. |
| `src/ui/events/EventDetailScreen.jsx` | Render follow/unfollow beside event detail host `UserLink` only for signed-in non-self hosts. |
| `src/ui/events/EventDetailScreen.module.css` | Event detail host row follow-control styling. |
| `tests/server/rules/users.rules.test.js` | Follow subcollection read/write rules, self-follow denial, unauthenticated public reads, authenticated write constraints, target `followersCount` constraints, and denial of standalone `users/{uid}.followingCount` writes. |
| `tests/server/rules/notifications.rules.test.js` | `runner_followed` notification type create/read/update rule coverage. |
| `tests/unit/service/follow-service.test.js` | Pure follow validation, payload, normalization, optimistic target follower-count tests, and derived following-count tests. |
| `tests/unit/runtime/follow-use-cases.test.js` | Follow/unfollow idempotency, mirrored writes, target `followersCount` updates, absence of client-written `followingCount`, derived following-count reads, and notification duplicate behavior. |
| `tests/unit/lib/notification-helpers.test.js` | Follow notification link routing to follower profile. |
| `tests/unit/service/profile-mapper.test.js` | Focused regression that Firestore `followersCount` maps into `PublicProfile` before the profile page passes initial data to the client. |
| `tests/unit/runtime/useProfileRuntime.test.jsx` | Profile follow state, signed-out/self visibility, optimistic rollback, modal loading, and count update hook tests. |
| `tests/integration/profile/ProfilePage.test.jsx` | Focused public profile page serialization regression for preserving `followersCount` into `ProfileClient` initial data. |
| `tests/integration/profile/ProfileClient.test.jsx` | Thin profile route composition for follow controls, count buttons, modal rows, and no signed-out controls. |
| `tests/integration/profile/ProfileStats.test.jsx` | Clickable follower/following count behavior and existing activity stats regression coverage. |
| `tests/unit/runtime/useMemberFollowingRuntime.test.jsx` | Member following runtime loading, signed-out guard, optimistic unfollow, and rollback tests. |
| `tests/integration/member/MemberFollowingPage.test.jsx` | Member page entry link, signed-in following list rows, profile links, unfollow action, empty/error states, and signed-out access guard. |
| `tests/integration/events/EventHostFollow.test.jsx` | Event list/detail host follow controls and no controls for self-host or signed-out users. |
| `tests/integration/events/ParticipantsModal.test.jsx` | Regression that participant rows link to profile and contain no follow buttons. |
| `tests/e2e/_setup/068-runner-following-global-setup.js` | Emulator seed for signed-out profile reads, viewer/target users, hosted event, member following rows, follow graph, and notification assertions. |
| `tests/e2e/runner-following.spec.js` | Critical browser flows for signed-out lists, signed-in follow/unfollow from profile/event/member surfaces, notification navigation, and no forbidden follow buttons. |
| `playwright.emulator.config.mjs` | Add `068-runner-following` E2E feature mapping only if the E2E setup file is created. |

## Data Flow

1. Public profile server entry reads `users/{uid}` as it does today, maps the
   Firestore payload through `src/service/profile-mapper.js`, and passes
   serialized profile data, including `followersCount`, to `ProfileClient`.
   `followingCount` remains derived from `users/{uid}/following`.
2. `useProfileRuntime` calls follow use-cases to fetch current follow state, public `followersCount` from `users/{uid}`, the following count derived from `users/{uid}/following`, and paged public `followers` or `following` rows when a count opens a modal.
3. Follow action validates `viewerUid !== targetUid`, runs a Firestore transaction that checks whether `users/{viewerUid}/following/{targetUid}` already exists, writes both mirrored docs only when absent, increments only `users/{targetUid}.followersCount` on state transition, and returns whether notification should be created. It must not write `users/{viewerUid}.followingCount`.
4. Unfollow action runs a transaction that deletes both mirrored docs only when currently following and decrements only `users/{targetUid}.followersCount` with a zero floor. It must not write `users/{viewerUid}.followingCount`.
5. On follow state transition only, runtime creates a `runner_followed` notification with message `X 已開始追蹤你。`, actor fields from the follower, recipient as the target, and link routing to `/users/{actorUid}`.
6. Member following runtime requires a signed-in viewer, lists `users/{viewerUid}/following`, derives the viewer's following count from that list or an aggregate/read model, resolves each target runner row from the public user payload stored on the follow document or from public user reads, and can call the same unfollow use-case for row-level removal.
7. Event list runtime batches follow-state reads for visible host UIDs and shares the same follow mutation path as profiles. Event detail runtime loads one host state.
8. Signed-out UI never renders follow buttons. Self-profile and self-hosted event surfaces hide follow buttons. Participants, follower/following modal rows, comments, and post poster surfaces only link to profiles.

## Testing Strategy

- Follow data/rules use TDD with server rules tests plus browser Vitest unit tests before implementation. T101 attempt 3 must keep the standalone `users/{viewer}.followingCount` exploit regression and make the standalone write denied or removed from the client contract.
- UI slices use integration tests around route/client boundaries and runtime hooks, with user-visible assertions via roles/text and `userEvent`.
- E2E validates the cross-route browser journey on Firebase emulators after the implementation slices pass focused tests.
- Browser evidence is mandatory for UI tasks. Use the Codex in-app Browser or Chrome plugin, record target URL, viewport, actions, before/after screenshots, console errors/warnings, failed network requests, and expected versus actual UI signal.
- Workflow state changes use `git diff --check`, JSON parse, `npm run workflow:validate`, and `npm run workflow:check`.

## Task Graph

```text
T001 completed spec artifact gate
T002 completed planner reviewer gate
T003 plan revision reviewer gate depends on T101 blocker decision
T101 data/rules/service foundation attempt 3 depends on T003 reviewer pass
T201 profile runtime and UI depends on T101
T202 profile page count serialization and mapper rework depends on T201; blocks T401
T251 member following management depends on T201
T301 event host follow entrypoints depends on T251
T401 E2E and browser evidence depends on T301 and T202
T501 final integration gate depends on T401
```

## Serial And Parallel Waves

- `wave-spec`: T001 completed.
- `wave-planner-review`: T002 completed and T003 current plan revision Reviewer gate.
- `wave-foundation`: T101 only because it owns shared rules, repo, service, runtime use-case, and notification contract.
- `wave-profile`: T201 only because it owns shared `FollowButton` and profile runtime consumed by member and event work.
- `wave-profile-fix`: T202 only because T401 exposed a production profile
  count path bug; E2E must wait for the mapper plus page serialization fix.
  T202 attempt 2 also owns one coordinated lint-only cleanup in
  `tests/e2e/runner-following.spec.js` to unblock the changed-file lint gate
  without changing T401 E2E behavior.
- `wave-member`: T251 only because it touches member route/runtime/UI files and consumes the shared follow foundation.
- `wave-events`: T301 only because it depends on the shared follow button and runtime semantics.
- `wave-e2e`: T401 only because it may touch Playwright config and E2E setup; currently blocked by T202.
- `wave-integration`: T501 only.
- Same-wave parallelism is intentionally unused. The feature crosses Firestore rules, shared notification helpers, profile runtime, event runtime, UI, E2E config, and workflow state; conservative serialization reduces conflict and review ambiguity.

## Risk Analysis

- Rules risk: public reads for follow lists must not allow unauthenticated writes, self-follow, broad user document updates, or standalone client-written `followingCount`. Mitigation: server rules tests cover signed-out read, signed-out write denial, self-follow denial, mirrored path constraints, target `followersCount` constraints, and standalone `followingCount` denial.
- Consistency risk: mirrored docs and target follower counts can drift if writes are not transactional. Mitigation: one transaction controls mirrored writes and target `followersCount` for follow/unfollow; viewer following count is derived from `users/{viewerUid}/following` rather than written as a separate user-doc field.
- Duplicate notification risk: repeated follow while already following must be idempotent. Mitigation: transaction result reports `created=false` for already-following and runtime only notifies when `created=true`.
- UI scope risk: adding follow buttons to comments, participants, modal rows, or post posters violates v1. Mitigation: integration and E2E regressions assert absence on forbidden surfaces.
- Member access risk: a member following page is signed-in-only while public profile modal lists remain public. Mitigation: member integration tests cover signed-out access guard and signed-in `我的追蹤跑友` list rows.
- Future private-account risk: naming should not encode a public-only dead end. Mitigation: use neutral `followers` and `following` collections with status-ready payload shape, not request-specific names.
- Release risk: Firestore rules must be deployed after merge before rules-backed behavior is true in production. Mitigation: keep `rulesDeployStatus.state=required`, `changed=true`, evidence empty, and never claim deploy without deploy authorization and evidence.

## Stop Conditions

- Stop if an Engineer needs files outside that task-owned write set.
- Stop if a new dependency or `package-lock.json` change appears.
- Stop if a data migration, backfill, destructive operation, secret, or irreversible action is required.
- Stop if Firestore/storage rules deploy is requested or implied while `deployFirestoreRules=false`.
- Stop if `tasks.md`, `status.json`, and `handoff.md` drift.
- Stop after the second Reviewer rejection for the same task unless the fix is narrow, mechanical, and inside the same owned files.
- Stop on unrelated failing gates that block evidence interpretation.

## Final Integration Gate

Before any completion claim after implementation:

1. Confirm all implementation tasks reached `review_passed` and coordinator synced them to `completed`.
2. Run one command per evidence entry:
   - `git diff --check`
   - `npm run workflow:validate`
   - `npm run workflow:check`
   - `npm run lint:changed`
   - `npm run type-check:changed`
   - `npm run test:branch`
   - `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`
   - `npm run audit:use-effect-data-fetching`
   - `npm run audit:playwright-official-only`
   - `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"`
3. Verify browser evidence exists for profile, member following, event list, and event detail UI.
4. Verify `rulesDeployStatus` remains required and not deployed unless a separate deploy authorization and evidence are recorded.
5. Do not commit, push, open PR, watch CI, merge, sync local `main`, or deploy rules unless the user expands the authorization boundary.
