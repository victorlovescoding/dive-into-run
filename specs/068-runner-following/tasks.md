# Runner Following Tasks

## Guard

- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-068-runner-following`
- Branch: `068-runner-following`
- Profile: P4
- Authorization boundary: edit=yes, commit=yes, push=yes, pullRequest=yes, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=yes.
- Main agent is control plane only. Repo-changing implementation goes Engineer-first and Reviewer-checked.
- Same-wave tasks require completely disjoint owned files. This plan uses serial waves only.
- Firestore rules deploy was completed for project `dive-into-run`, target
  `firestore:rules`, with rules file `firestore.rules`; do not imply
  hosting/functions/storage deploy.
- If this file, `status.json`, and `handoff.md` disagree, reconcile before dispatch.
- Each verification evidence entry is one command. Do not combine commands with shell chains.

## Dependency Graph

```text
T001 completed
T002 completed planner reviewer gate
T003 completed plan revision reviewer gate
T101 completed
T201 completed, depends on T101
T202 completed attempt 2, depends on T201; Reviewer PASS recorded; unblocks T401
T251 completed attempt 2, depends on T201
T301 completed, depends on T251
T401 completed, depends on T301 and T202 completed; Reviewer PASS recorded
T501 completed, depends on T401; Integration Reviewer PASS recorded
T601 completed, depends on T501 and recovery closeout blocker report; Reviewer PASS recorded
T602 completed attempt 3, depends on T501 and recovery closeout blocker report; attempts 1 and 2 Reviewer REJECT recorded; attempt 3 Reviewer PASS recorded
T603 blocked/ready, depends on T602 completed after attempt 3 Reviewer PASS; state-only commit cf8a509 pushed, draft PR 104 created, Firestore rules deployed, CI fix commit 8005a31 resolved the page export build failure, and E2E mapping commit 804d614 is verified local HEAD; next release steps are push, GitHub CI rerun/watch authorization, merge authorization, and local main sync authorization
```

## Waves

| Wave | Tasks | Parallelism |
| --- | --- | --- |
| `wave-spec` | T001 | Completed historical gate. |
| `wave-planner-review` | T002, T003 | T002 is completed; T003 is the current single Reviewer gate for this plan revision. |
| `wave-foundation` | T101 | Serialized because it owns shared rules, repo, service, and notifications. |
| `wave-profile` | T201 | Serialized because it creates shared follow UI used by later event surfaces. |
| `wave-profile-fix` | T202 | Completed production serialization and mapper rework discovered by T401; includes one coordinated T401 lint unblocker; Reviewer passed. |
| `wave-member` | T251 | Serialized because it touches member route/runtime/UI files and consumes shared follow behavior. |
| `wave-events` | T301 | Serialized because it consumes shared follow state and touches event runtime/UI. |
| `wave-e2e` | T401 | Serialized because it may touch Playwright config and emulator setup; completed after Reviewer PASS. |
| `wave-integration` | T501 | Final integration gate completed after Integration Reviewer PASS. |
| `wave-closeout-blockers` | T601, T602 | T601 completed after Reviewer PASS. T602 completed attempt 3 after Reviewer PASS; keep it separate because it touches global workflow tooling. |
| `wave-closeout-continuation` | T603 | Blocked/ready after E2E mapping commit 804d614: prior state-only commit cf8a509 was pushed, draft PR 104 was created, Firestore rules were deployed, and CI fix commit 8005a31 resolved the page export build failure. E2E mapping commit is local ahead 1 and awaits push plus GitHub CI rerun/watch authorization; merge and local main sync are not authorized/performed. |

## Tasks

### T001 - Spec Artifact Reviewer Gate

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-spec`
- **Engineer**: Spec Artifact Engineer
- **Reviewer**: Spec Artifact Reviewer
- **Dependencies**: Spec artifacts seeded.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Seed and review the durable Superpowers workflow artifacts for runner following.

Non-scope:

- No production code, executable tests, Firestore rules changes, package changes, commits, pushes, pull requests, CI watch, merge, local main sync, or rules deploy.

Owned files:

- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/plan.md`
- `specs/068-runner-following/tasks.md`
- `specs/068-runner-following/handoff.md`
- `specs/068-runner-following/status.json`

Read-only context:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-profiles.md`
- `docs/superpowers/task-contract.md`
- `docs/superpowers/status.schema.json`

Acceptance criteria:

- Product decisions are recorded in `spec.md`.
- Authorization and release boundary are explicit.
- `status.json`, this file, and `handoff.md` agree.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `git diff --check` | exit 0; no whitespace errors |
| `node -e "JSON.parse(require('fs').readFileSync('specs/068-runner-following/status.json','utf8'))"` | exit 0; status.json parsed successfully |

Browser evidence requirement:

- Not applicable.

Reviewer PASS criteria:

- Diff touched only owned files.
- Verification passed.
- Rules deploy state was required, not changed, and not deployed.

Reviewer REJECT criteria:

- Any non-owned file changed.
- Verification failed or was stale.
- Artifacts contradicted the approved product scope or authorization boundary.

Evidence:

- Engineer report: spec artifact seed completed.
- Reviewer report: `review_passed` at `2026-05-21T23:16:42+08:00`.
- Command output summary: recorded in prior completed state.
- Changed files summary: recorded in prior completed state.

### T002 - Planner Implementation Plan Reviewer Gate

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-planner-review`
- **Engineer**: Planner
- **Reviewer**: Planner Reviewer
- **Dependencies**: T001 completed; user approved spec and authorized edit=true only on 2026-05-21.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Update `spec.md` authorization for approved implementation edits.
- Replace `plan.md` with the implementation plan under `specs/068-runner-following/`.
- Replace this file with a full task board following `docs/superpowers/task-contract.md`.
- Update `status.json` schemaVersion 3 with tasks mirroring this file.
- Update `handoff.md` to planning complete pending Planner Reviewer check.

Non-scope:

- No production code.
- No executable tests.
- No Firestore rules changes.
- No package, script, config, lockfile, deployment, commit, push, pull request, CI watch, merge, local main sync, or rules deploy.
- No product scope beyond approved `spec.md`.

Owned files:

- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/plan.md`
- `specs/068-runner-following/tasks.md`
- `specs/068-runner-following/handoff.md`
- `specs/068-runner-following/status.json`

Read-only context:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-profiles.md`
- `docs/superpowers/task-contract.md`
- `docs/superpowers/status.schema.json`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `.codex/rules/testing-standards.md`
- `.codex/rules/e2e-commands.md`
- `.codex/rules/sensors.md`
- `.codex/references/quality-gates.md`
- `.codex/references/review-standards.md`
- `.codex/references/testing-handbook.md`
- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/plan.md`
- `specs/068-runner-following/tasks.md`
- `specs/068-runner-following/handoff.md`
- `specs/068-runner-following/status.json`
- `firestore.rules`
- `playwright.emulator.config.mjs`
- `package.json`
- Scoped source and test files cited in `plan.md`.

Engineer instructions:

- Include member/dashboard `我的追蹤跑友` following management as a separate serialized implementation slice because user confirmed it is v1 scope.
- Keep rules deploy status required and not deployed.
- Set only T002 as active and requiring Reviewer check; leave implementation tasks blocked by T002.
- Keep future implementation tasks serial unless owned files are fully disjoint.

Acceptance criteria:

- AC-T002.1: `spec.md` records approval by user on 2026-05-21 and one-time edit=true authorization only.
- AC-T002.2: `plan.md` includes architecture, exact files and responsibilities, data flow, testing strategy, risk analysis, stop conditions, and final integration gate.
- AC-T002.3: This file includes dependency graph, waves, member following management slice, owned files, read-only context, acceptance criteria, exact verification commands, browser evidence requirements, Reviewer PASS/REJECT criteria, and evidence slots.
- AC-T002.4: `status.json` is schemaVersion 3 and mirrors this task board.
- AC-T002.5: `handoff.md` says planning is complete and Planner Reviewer check is required before Engineer dispatch.
- AC-T002.6: `rulesDeployStatus.state` remains `required`, with `required=true`, `changed=false`, no evidence, and `deployedCommit=null`.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `git diff --check` | exit 0; no whitespace errors |
| `node -e "JSON.parse(require('fs').readFileSync('specs/068-runner-following/status.json','utf8'))"` | exit 0; status.json parsed successfully |
| `rg -n "TBD|TODO|<[^>]+>|placeholder|待定|稍後" specs/068-runner-following` | exit 0 only when matches are the required verification command self-references; no product or workflow filler text |

Browser evidence requirement:

- Not applicable.

Reviewer PASS criteria:

- Diff touches only T002 owned files.
- Verification commands pass with expected signal.
- `plan.md`, this file, `status.json`, and `handoff.md` agree on current state.
- Implementation tasks are dependency-ordered and no same-wave owned files overlap.
- Member/dashboard `我的追蹤跑友` is included as v1 scope in its own serialized task slice.
- Rules deploy claims remain required, not changed, and not deployed.

Reviewer REJECT criteria:

- Any non-owned file changed.
- Any verification command fails without a legitimate documented no-match signal.
- Task states drift across `tasks.md`, `status.json`, and `handoff.md`.
- Plan authorizes commit, push, PR, CI watch, merge, local main sync, or rules deploy.
- Plan contradicts product scope in `spec.md`.

Evidence:

- Engineer report: Planner updated five workflow artifacts and ran required checks.
- Reviewer report: `review_passed` at `2026-05-21T23:56:58+08:00`; no findings.
- Command output summary:
  - `git diff --check`: pending Reviewer validation.
  - `node -e "JSON.parse(require('fs').readFileSync('specs/068-runner-following/status.json','utf8'))"`: pending Reviewer validation.
  - `rg -n "TBD|TODO|<[^>]+>|placeholder|待定|稍後" specs/068-runner-following`: pending Reviewer validation.
- Changed files summary:
  - `specs/068-runner-following/spec.md`: authorization and member following scope corrected.
  - `specs/068-runner-following/plan.md`: implementation plan.
  - `specs/068-runner-following/tasks.md`: task board.
  - `specs/068-runner-following/handoff.md`: next-session state.
  - `specs/068-runner-following/status.json`: schemaVersion 3 task mirror.

### T003 - Following Count Plan Revision Reviewer Gate

- **State**: `completed`
- **Attempt**: 2
- **Wave**: `wave-planner-review`
- **Engineer**: Planner / workflow-doc Engineer
- **Reviewer**: Planner Reviewer
- **Dependencies**: T101 attempt 2 blocker recorded; user approved deriving `followingCount` from `users/{uid}/following`.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Revise the workflow artifacts so v1 no longer requires client-maintained
  `users/{uid}.followingCount`.
- Preserve user-facing public follower/following counts and lists.
- Return T101 to attempt 3 with a corrected foundation contract.

Non-scope:

- No production code.
- No executable tests outside `specs/068-runner-following/`.
- No Firestore rules/source/test implementation edits.
- No package, config, lockfile, deployment, commit, push, pull request, CI
  watch, merge, local main sync, or rules deploy.
- No product scope changes beyond the approved following-count derivation.

Owned files:

- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/plan.md`
- `specs/068-runner-following/tasks.md`
- `specs/068-runner-following/handoff.md`
- `specs/068-runner-following/status.json`

Read-only context:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-profiles.md`
- `docs/superpowers/task-contract.md`
- `docs/superpowers/status.schema.json`
- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/plan.md`
- `specs/068-runner-following/tasks.md`
- `specs/068-runner-following/handoff.md`
- `specs/068-runner-following/status.json`

Engineer instructions:

- Update `spec.md` so `followersCount` may stay denormalized on
  `users/{uid}`, but following count is derived from
  `users/{uid}/following` and is not a client-writable
  `users/{uid}.followingCount` field in v1.
- Update `plan.md` data flow so follow/unfollow transactions write mirrored
  docs and only target `users/{targetUid}.followersCount`; following count is
  obtained from the following list, aggregate, or read model.
- Update T101 so attempt 3 expects standalone `followingCount` user-doc writes
  to be denied or removed, repo/use-cases to derive following count, and no
  client write to `users/{viewerUid}.followingCount`.
- Keep T201, T251, and T301 user-facing compatible while noting they consume
  derived following counts/lists where needed.
- Keep `rulesDeployStatus` required, changed=true, evidence empty, and not
  deployed.

Acceptance criteria:

- AC-T003.1: User-facing follower/following counts and lists remain in scope.
- AC-T003.2: `users/{uid}.followingCount` is no longer required or allowed as
  a client-maintained v1 field.
- AC-T003.3: T101 has corrected implementation and verification instructions
  for attempt 3, but is not ready until T003 Reviewer PASS and coordinator
  sync.
- AC-T003.4: Current next action is Planner Reviewer check for T003 attempt 2,
  then T101 attempt 3 dispatch only after T003 is synced to completed.
- AC-T003.5: No production code, executable tests, rules, config, lockfile, or
  package files are edited by this revision.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `git diff --check` | exit 0; no whitespace errors |
| `node -e "JSON.parse(require('fs').readFileSync('specs/068-runner-following/status.json','utf8'))"` | exit 0; status.json parsed successfully |
| `npm run workflow:validate` | exit 0; status files valid |
| `npm run workflow:check` | exit 0; status files synced |

Browser evidence requirement:

- Not applicable.

Reviewer PASS criteria:

- Diff touches only the five owned workflow artifact files.
- `spec.md`, `plan.md`, this file, `status.json`, and `handoff.md` agree that
  following count is derived and not client-written to `users/{uid}`.
- T101 attempt 3 instructions require denial/removal of standalone
  `followingCount` updates and no client write to
  `users/{viewerUid}.followingCount`.
- T201, T251, and T301 retain user-facing public counts/lists and member/event
  behavior while consuming derived following count/list data.
- `rulesDeployStatus` remains required, changed=true, not deployed, and
  `deployFirestoreRules=false`.
- Verification commands pass with expected signals.

Reviewer REJECT criteria:

- Any non-owned file changed.
- Any artifact still requires client-maintained `users/{uid}.followingCount`.
- T101 remains blocked by the old `followingCount` plan flaw.
- Workflow state drifts across `tasks.md`, `status.json`, and `handoff.md`.
- Verification is missing, stale, or fails.

Evidence:

- Engineer report: Plan revision completed for derived following count and
  submitted for Planner Reviewer check. Attempt 2 fixes the workflow state
  drift from T003 attempt 1 by keeping T101 non-ready until T003 Reviewer PASS
  and coordinator sync.
- Reviewer report: T003 attempt 1 `review_rejected`: T101 was marked ready
  before T003 Reviewer PASS, and T101 dependencies only named T002 instead of
  the T003 review gate. Product/count revision accepted.
- Reviewer report: T003 attempt 2 `review_passed` at
  `2026-05-22T01:51:00+08:00`; previous gate issue fixed, T101 dependency now
  includes T003, product/count revision remains correct, and workflow state is
  synced.
- Command output summary:
  - `git diff --check`: exit 0; no whitespace errors.
  - `node -e "JSON.parse(require('fs').readFileSync('specs/068-runner-following/status.json','utf8'))"`: exit 0; status.json parsed successfully.
  - `npm run workflow:validate`: exit 0; seven status files valid.
  - `npm run workflow:check`: exit 0; seven status files synced.
- Changed files summary:
  - `specs/068-runner-following/spec.md`: data model corrected to derive following count.
  - `specs/068-runner-following/plan.md`: data flow, tests, and risks corrected.
  - `specs/068-runner-following/tasks.md`: T003 added and T101 attempt 3 contract corrected.
  - `specs/068-runner-following/handoff.md`: next action updated.
  - `specs/068-runner-following/status.json`: schemaVersion 3 mirror updated.

### T101 - Data, Rules, Service, And Notification Foundation

- **State**: `completed`
- **Attempt**: 4
- **Wave**: `wave-foundation`
- **Engineer**: Foundation Engineer
- **Reviewer**: Foundation Reviewer
- **Dependencies**: T002 `completed`; T003 `review_passed` and coordinator-synced to `completed`.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Implement follow graph Firestore rules, repo transaction API, service normalization, runtime use-cases, target `followersCount` updates, derived following-count reads, and follow notification type/routing.
- Add focused tests for rules, service, runtime use-cases, and notification link behavior.

Non-scope:

- No profile UI, event UI, E2E, config, package, lockfile, migration, or rules deploy.
- No private account, follow request, block, discovery, or feed behavior.

Owned files:

- `firestore.rules`
- `src/repo/client/firebase-follow-repo.js`
- `src/service/follow-service.js`
- `src/runtime/client/use-cases/follow-use-cases.js`
- `src/service/notification-service.js`
- `src/runtime/client/use-cases/notification-use-cases.js`
- `src/lib/notification-helpers.js`
- `tests/server/rules/users.rules.test.js`
- `tests/server/rules/notifications.rules.test.js`
- `tests/unit/service/follow-service.test.js`
- `tests/unit/runtime/follow-use-cases.test.js`
- `tests/unit/lib/notification-helpers.test.js`

Read-only context:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-contract.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/testing-standards.md`
- `.codex/references/quality-gates.md`
- `.codex/references/testing-handbook.md`
- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/plan.md`
- `src/repo/client/firebase-content-favorites-repo.js`
- `src/runtime/client/use-cases/content-favorite-use-cases.js`
- `src/repo/client/firebase-notifications-repo.js`
- `tests/server/rules/_helpers/rules-test-env.js`

Engineer instructions:

- RED: keep or add failing tests for public follow list reads, unauthenticated write denial, self-follow denial, mirrored doc writes, target `followersCount` increments/decrements, denial of standalone `users/{viewerUid}.followingCount` writes, idempotent repeated follow, unfollow/refollow notification behavior, and `runner_followed` notification link.
- GREEN: implement the smallest foundation code to pass those tests.
- Use transaction semantics for mirrored docs and target `followersCount`.
- Do not write `users/{viewerUid}.followingCount` from the client transaction,
  repo, service, or runtime use-case. Derive following count from
  `users/{viewerUid}/following` via list size, aggregate, or read model.
- Add `runner_followed` notification type without weakening existing notification rules.
- Keep `rulesDeployStatus` changed state for workflow updates out of this task; coordinator records workflow state after review.

Acceptance criteria:

- Authenticated non-self user can follow and unfollow.
- Unauthenticated users can read public followers/following lists and cannot write.
- Self-follow is denied by rules and use-case validation.
- Mirrored docs and target public `followersCount` update consistently.
- Viewer following count is derived from `users/{viewerUid}/following`; no
  client write to `users/{viewerUid}.followingCount` remains.
- Repeated follow while already following is idempotent and creates no duplicate notification.
- Unfollow then refollow creates a new notification.
- `runner_followed` notification text is exactly `X 已開始追蹤你。`.
- Notification click routing opens `/users/{actorUid}`.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js` | RED includes standalone `followingCount` write denial before fix, then GREEN exit 0 |
| `npx vitest run --project=browser tests/unit/service/follow-service.test.js tests/unit/runtime/follow-use-cases.test.js tests/unit/lib/notification-helpers.test.js` | GREEN exit 0 after repo/use-cases remove client `followingCount` writes and expose derived following count |
| `npm run lint:changed` | exit 0 |
| `npm run type-check:changed` | exit 0 |

Browser evidence requirement:

- Not applicable.

Reviewer PASS criteria:

- Diff touches only owned files.
- RED failures are valid and GREEN commands pass.
- Rules do not permit unauthenticated writes or self-follow.
- Rules deny standalone or client-maintained `users/{uid}.followingCount`
  writes.
- Follow repo/use-case writes mirrored docs and only target
  `users/{targetUid}.followersCount`.
- Notification allowlist adds only the required follow type.
- No package or lockfile changes.

Reviewer REJECT criteria:

- Client code still writes `users/{viewerUid}.followingCount`.
- Rules still allow standalone or client-maintained `users/{uid}.followingCount`.
- Target `followersCount` or mirrored writes can happen without the paired
  mirror path.
- Repeated follow can create duplicate notification.
- Rules allow non-owner follow writes, self-follow, or broad user document updates.
- Tests mock internal layers contrary to repo test policy.
- Verification is missing or stale.

Evidence:

- Engineer report: `BLOCKED` at `2026-05-22T01:32:05+08:00`.
  Attempt 2 added the bounded standalone `followingCount` exploit regression.
  The regression is valid RED: updating `users/viewer` with
  `{ followingCount: 1 }` succeeded even though it must fail. Engineer
  determined Firestore rules cannot safely prove a paired
  `users/{viewer}/following/{targetUid}` write from the `users/{viewer}` rule
  path because there is no concrete `targetUid` and rules cannot scan for any
  changed subcollection document.
- Dispatch: Foundation Engineer dispatched at `2026-05-21T23:58:49+08:00`.
- Engineer completion: `DONE_WITH_CONCERNS` at `2026-05-22T00:19:39+08:00`.
  Firestore rules, follow repo/service/use-cases, notification type/routing,
  and focused tests were implemented. Residual concern: Firestore rules bound
  count updates and paired target follower docs, but cannot fully infer target
  UID from a standalone user-doc following-count update without extra schema;
  repo transaction is the consistency source.
- Reviewer report: empty until review.
- Reviewer report: `review_rejected` at `2026-05-22T00:27:19+08:00`.
  Blocking security/data integrity issue: `firestore.rules` allows an
  authenticated user to update their own `followingCount` by +1/-1 without a
  paired `users/{uid}/following/{targetUid}` write. Required fix: make
  standalone `followingCount` drift impossible and add a server rules regression
  for `users/viewer` `{ followingCount: 1 }` without mirror docs.
- Reviewer report: T101 attempt 3 `review_rejected` at
  `2026-05-22T02:06:13+08:00`. Blocking rules issue: `firestore.rules` still
  allowed an authenticated user to create their own `users/{uid}` document with
  arbitrary `followingCount` and `followersCount` values. Required fix: add a
  server rules regression for create-path count injection and deny client
  creation of count fields unless they are absent or server-safe zero values
  according to the existing user document contract.
- Reviewer report: T101 attempt 4 `review_passed` at
  `2026-05-22T02:15:12+08:00`. Previous create-path count injection was fixed;
  rules reject `followersCount` / `followingCount` on user create, standalone
  count writes are denied, follow/unfollow remains paired with mirror docs and
  target `followersCount`, and client/runtime no longer writes viewer
  `followingCount`.
- Command output summary:
  - RED `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`: exit 1; new rules assertions failed as expected.
  - RED `npx vitest run --project=browser tests/unit/service/follow-service.test.js tests/unit/runtime/follow-use-cases.test.js tests/unit/lib/notification-helpers.test.js`: exit 1; follow stubs and notification route/message failed as expected.
  - RED `npm run test:server -- tests/server/rules/users.rules.test.js`: exit 1; count mutation assertion exposed weak path.
  - GREEN `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`: exit 0; 30 passed.
  - GREEN `npx vitest run --project=browser tests/unit/service/follow-service.test.js tests/unit/runtime/follow-use-cases.test.js tests/unit/lib/notification-helpers.test.js`: exit 0; 26 passed.
  - `npm run lint:changed`: exit 0.
  - `npm run type-check:changed`: exit 0.
  - `git diff --check`: exit 0.
  - Attempt 2 RED `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`: exit 1; new bounded standalone `followingCount` regression failed because the write currently succeeds.
  - Attempt 2 `npx vitest run --project=browser tests/unit/service/follow-service.test.js tests/unit/runtime/follow-use-cases.test.js tests/unit/lib/notification-helpers.test.js`: exit 0; 26 passed.
  - Attempt 2 `npm run lint:changed`: exit 0.
  - Attempt 2 `npm run type-check:changed`: exit 0.
  - Attempt 2 `git diff --check`: exit 0.
  - Attempt 3 RED `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`: exit 1; standalone `{ followingCount: 1 }` regression failed because the write still succeeded before the fix.
  - Attempt 3 GREEN `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`: exit 0; 30 passed.
  - Attempt 3 GREEN `npx vitest run --project=browser tests/unit/service/follow-service.test.js tests/unit/runtime/follow-use-cases.test.js tests/unit/lib/notification-helpers.test.js`: exit 0; 28 passed.
  - Attempt 3 `npm run lint:changed`: exit 0.
  - Attempt 3 `npm run type-check:changed`: exit 0.
  - Attempt 3 `git diff --check`: exit 0.
  - Reviewer attempt 3 `git diff --check`: exit 0.
  - Reviewer attempt 3 `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`: exit 0; 30 passed.
  - Reviewer attempt 3 `npx vitest run --project=browser tests/unit/service/follow-service.test.js tests/unit/runtime/follow-use-cases.test.js tests/unit/lib/notification-helpers.test.js`: exit 0; 28 passed.
  - Reviewer attempt 3 `npm run lint:changed`: exit 0.
  - Reviewer attempt 3 `npm run type-check:changed`: exit 0.
  - Attempt 4 RED `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`: exit 1; creating `users/{uid}` with `followingCount` / `followersCount` 999 incorrectly succeeded.
  - Attempt 4 GREEN `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`: exit 0; 31 passed.
  - Attempt 4 `npx vitest run --project=browser tests/unit/service/follow-service.test.js tests/unit/runtime/follow-use-cases.test.js tests/unit/lib/notification-helpers.test.js`: exit 0; 28 passed.
  - Attempt 4 `npm run lint:changed`: exit 0.
  - Attempt 4 `npm run type-check:changed`: exit 0.
  - Attempt 4 `git diff --check`: exit 0.
  - Reviewer attempt 4 `git diff --check`: exit 0.
  - Reviewer attempt 4 `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`: exit 0; 31 passed.
  - Reviewer attempt 4 `npx vitest run --project=browser tests/unit/service/follow-service.test.js tests/unit/runtime/follow-use-cases.test.js tests/unit/lib/notification-helpers.test.js`: exit 0; 28 passed.
  - Reviewer attempt 4 `npm run lint:changed`: exit 0.
  - Reviewer attempt 4 `npm run type-check:changed`: exit 0.
- Changed files summary:
  - `firestore.rules`: public follow-list reads, authenticated mirrored follow writes, count constraints, `runner_followed` notification allowlist.
  - `src/repo/client/firebase-follow-repo.js`: follow/unfollow transaction API.
  - `src/service/follow-service.js`: follow data normalization and validation.
  - `src/runtime/client/use-cases/follow-use-cases.js`: follow use-cases and notification-on-transition behavior.
  - `src/service/notification-service.js`: `runner_followed` notification type/message support.
  - `src/runtime/client/use-cases/notification-use-cases.js`: follow notification creation helper.
  - `src/lib/notification-helpers.js`: route `runner_followed` notifications to follower profiles.
  - `tests/server/rules/users.rules.test.js`: follow graph/count security rules coverage.
  - `tests/server/rules/notifications.rules.test.js`: `runner_followed` notification rules coverage.
  - `tests/unit/service/follow-service.test.js`: follow service contract coverage.
  - `tests/unit/runtime/follow-use-cases.test.js`: use-case idempotency, notification, and validation coverage.
  - `tests/unit/lib/notification-helpers.test.js`: follower profile notification route coverage.
  - Reviewer rejection:
    - `firestore.rules`: `isValidFollowingCountUpdate` allowed standalone
      bounded count drift.
    - `tests/server/rules/users.rules.test.js`: missing exploit regression for
      bounded standalone `followingCount` update.
  - Attempt 2 dispatch: Foundation Engineer re-dispatched at
    `2026-05-22T00:28:49+08:00` to add the exploit regression and make
    standalone `followingCount` drift impossible, or report BLOCKED if the
    approved client/rules data model cannot express a safe fix.
  - Attempt 2 blocker:
    - `tests/server/rules/users.rules.test.js`: added the bounded standalone
      `followingCount` exploit regression.
    - Plan flaw: client-maintained `users/{uid}.followingCount` is not
      safely enforceable under Firestore Rules with the approved mirrored
      subcollection model.
    - User approved resolving this by deriving following count from
      `users/{uid}/following` instead of storing client-written
      `followingCount` on `users/{uid}`.
  - Attempt 3 plan revision:
    - T101 must not be dispatched or marked ready until T003 Planner Reviewer
      PASS is coordinator-synced to completed.
    - Foundation Engineer must remove client-maintained
      `users/{viewerUid}.followingCount`, keep standalone `followingCount`
      denial coverage, and derive following count from
      `users/{viewerUid}/following`.
  - Attempt 3 dispatch: Foundation Engineer re-dispatched at
    `2026-05-22T01:53:15+08:00` after T003 Planner Reviewer PASS and
    coordinator sync.
  - Engineer completion: `DONE` at `2026-05-22T02:01:04+08:00`.
    Attempt 3 removed client-maintained `users/{uid}.followingCount`, kept the
    standalone `followingCount` exploit regression, updated the transaction to
    write mirrored docs plus only target `followersCount`, and added runtime
    support for derived following count from `users/{uid}/following`.
  - Attempt 3 implementation:
    - `firestore.rules`: removed client-maintained `followingCount` rule path;
      follow/unfollow validates mirrored docs and target `followersCount`.
    - `src/repo/client/firebase-follow-repo.js`: transaction no longer updates
      viewer user doc and exposes derived following-count support.
    - `src/runtime/client/use-cases/follow-use-cases.js`: exposes/consumes
      derived following count and preserves idempotent notification behavior.
    - Focused tests updated for standalone `followingCount` denial and derived
      count behavior.
  - Reviewer attempt 3 rejection:
    - `firestore.rules`: user create path still allowed arbitrary
      `followingCount` / `followersCount` injection.
    - `tests/server/rules/users.rules.test.js`: missing create-path count
      injection regression.
  - Attempt 4 dispatch: Foundation Engineer re-dispatched at
    `2026-05-22T02:08:00+08:00` to add create-path count injection RED
    coverage and tighten user create rules.
  - Engineer completion: `DONE` at `2026-05-22T02:10:48+08:00`.
    Attempt 4 added the create-path count injection regression and tightened
    user create rules so `followersCount` and `followingCount` are rejected in
    client create payloads while preserving existing profile fields.
  - Attempt 4 implementation:
    - `tests/server/rules/users.rules.test.js`: added count-injection create
      regression.
    - `firestore.rules`: added `isValidUserCreate(userId)` so client-created
      user docs may keep existing profile fields but reject `followersCount`
      and `followingCount`.
  - Reviewer attempt 4 PASS:
    - T101 foundation accepted.
    - Firestore rules still require later deploy authorization/evidence.
    - Following count is now derived from `users/{uid}/following`; later UI
      slices must consume that path consistently.

### T201 - Profile Follow Runtime And UI

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-profile`
- **Engineer**: Profile Engineer
- **Reviewer**: Profile Reviewer
- **Dependencies**: T101 `completed`.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Add profile follow/unfollow controls, clickable public counts, followers/following modal lists, optimistic pending state, and rollback toast.
- Add shared `FollowButton` used later by event surfaces.

Non-scope:

- No event host follow controls.
- No member following route or member/dashboard page edits; T251 owns `我的追蹤跑友`.
- No follow buttons inside modal rows, participants, comments, or posts.
- No rules, repo foundation, E2E config, package, lockfile, or rules deploy.

Owned files:

- `src/components/FollowButton.jsx`
- `src/components/FollowButton.module.css`
- `src/runtime/hooks/useProfileRuntime.js`
- `src/app/users/[uid]/ProfileClient.jsx`
- `src/app/users/[uid]/ProfileStats.jsx`
- `src/app/users/[uid]/FollowListModal.jsx`
- `src/app/users/[uid]/PublicProfile.module.css`
- `src/ui/users/ProfileScreen.jsx`
- `tests/unit/runtime/useProfileRuntime.test.jsx`
- `tests/integration/profile/ProfileClient.test.jsx`
- `tests/integration/profile/ProfileStats.test.jsx`
- `tests/integration/profile/ProfileHeader.test.jsx`

Read-only context:

- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/plan.md`
- `src/runtime/client/use-cases/follow-use-cases.js`
- `src/app/users/[uid]/ProfileHeader.jsx`
- `src/app/users/[uid]/ProfileEventList.jsx`
- `src/ui/users/ProfileScreen.jsx`
- `src/components/UserLink.jsx`
- `tests/_helpers/profile-fixtures.js`

Engineer instructions:

- RED: add tests for signed-out no button with visible counts/lists, signed-in non-self follow and unfollow, self profile hidden button, pending disabled label, rollback toast, and modal rows linking to profiles without inline follow buttons.
- GREEN: implement profile runtime state and render-only UI using `follow-use-cases`.
- Read follower count from public profile data and following count from the
  derived following-list count/read model exposed by T101; do not depend on
  `users/{uid}.followingCount`.
- Keep UI/component effects free of data fetching; external synchronization belongs in runtime hook effects.
- Use accessible buttons for counts and modal close controls.

Acceptance criteria:

- Signed-out visitors see followers/following counts and modal lists, but no follow button.
- Following count display uses derived `users/{uid}/following` data while
  preserving the same user-facing count behavior.
- Signed-in non-self viewers can follow and unfollow from profile pages.
- Self profile hides follow controls.
- Pending state disables the follow button and communicates operation state.
- Failed follow/unfollow rolls back optimistic state and shows toast.
- Follower/following modal rows link to `/users/{uid}` and contain no follow buttons.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npx vitest run --project=browser tests/unit/runtime/useProfileRuntime.test.jsx tests/integration/profile/ProfileClient.test.jsx tests/integration/profile/ProfileStats.test.jsx tests/integration/profile/ProfileHeader.test.jsx` | RED before implementation; exit nonzero for new assertions, then GREEN exit 0 |
| `npm run audit:use-effect-data-fetching` | exit 0 |
| `npm run lint:changed` | exit 0 |
| `npm run type-check:changed` | exit 0 |

Browser evidence requirement:

- Target URLs: `/users/target-runner`, `/users/viewer-runner`.
- Viewports: desktop 1440 by 900 and mobile 390 by 844.
- Journeys: signed-out profile count modal, signed-in non-self follow/unfollow, self-profile hidden follow control.
- Record console errors/warnings, failed network requests, screenshot artifact paths, and expected versus actual UI signal.

Reviewer PASS criteria:

- Diff touches only owned files.
- Profile UI satisfies signed-out, signed-in, self, pending, rollback, and modal-row restrictions.
- Shared `FollowButton` is render-only and has no data-fetch effect.
- Browser evidence is complete.
- Verification commands pass.

Reviewer REJECT criteria:

- Follow button appears for signed-out users, self profile, or modal rows.
- Optimistic rollback is absent or count state can drift visibly after failure.
- UI imports repo/service/Firebase directly instead of using runtime.
- Browser evidence is missing for meaningful UI changes.

Evidence:

- Engineer report:
  - Profile Engineer dispatched at `2026-05-22T02:19:20+08:00`.
  - Profile Engineer reported `engineer_done` at `2026-05-22T03:02:04+08:00`.
  - Root cause for browser evidence failure: follow write succeeded, but the followed-state UI label was `取消追蹤` while evidence expected exact `追蹤中`.
  - Fix kept to T201-owned files: profile runtime now uses exact `追蹤中` for followed and follow-pending states; tests were updated for that contract.
  - Browser evidence was rerun successfully after emulator state reset.
- Reviewer report:
  - Profile Reviewer reported `review_passed` at `2026-05-22T03:10:44+08:00`.
  - Diff checked: T201 owned files only; T101 and workflow diffs ignored per scope.
  - Findings: none blocking.
  - Residual risk: no dedicated failed-unfollow rollback test; source path is shared and inspected.
  - Residual risk: `followingCount` may briefly show `0` before async derived count resolves because loading state is not surfaced.
- Command output summary:
  - RED `npx vitest run --project=browser tests/unit/runtime/useProfileRuntime.test.jsx tests/integration/profile/ProfileClient.test.jsx tests/integration/profile/ProfileStats.test.jsx tests/integration/profile/ProfileHeader.test.jsx`: exit 1 before implementation with 11 expected new assertion failures.
  - GREEN `npx vitest run --project=browser tests/unit/runtime/useProfileRuntime.test.jsx tests/integration/profile/ProfileClient.test.jsx tests/integration/profile/ProfileStats.test.jsx tests/integration/profile/ProfileHeader.test.jsx`: exit 0, 4 files / 35 tests passed.
  - `npm run audit:use-effect-data-fetching`: exit 0.
  - `npm run lint:changed`: exit 0, React version warning only.
  - `npm run type-check:changed`: exit 0.
  - `/private/tmp/t201-profile-evidence.mjs`: exit 0 after UI-label fix and emulator follow-state reset.
  - Reviewer `npx vitest run --project=browser tests/unit/runtime/useProfileRuntime.test.jsx tests/integration/profile/ProfileClient.test.jsx tests/integration/profile/ProfileStats.test.jsx tests/integration/profile/ProfileHeader.test.jsx`: exit 0, 4 files / 35 tests passed.
  - Reviewer `npm run audit:use-effect-data-fetching`: exit 0.
  - Reviewer `npm run lint:changed`: exit 0, React version warning only.
  - Reviewer `npm run type-check:changed`: exit 0.
  - Reviewer `node /private/tmp/t201-profile-evidence.mjs`: sandbox attempt exit 1 due Chromium MachPort permission; escalated rerun exit 0 with expected emulator warnings and aborted Firestore long-poll requests.
- Browser evidence summary:
  - `/private/tmp/t201-profile-browser-evidence-emulator/signed-out-target-desktop.png`
  - `/private/tmp/t201-profile-browser-evidence-emulator/signed-out-following-modal-desktop.png`
  - `/private/tmp/t201-profile-browser-evidence-emulator/signed-in-target-before-follow-desktop.png`
  - `/private/tmp/t201-profile-browser-evidence-emulator/signed-in-target-after-follow-desktop.png`
  - `/private/tmp/t201-profile-browser-evidence-emulator/signed-in-target-after-unfollow-desktop.png`
  - `/private/tmp/t201-profile-browser-evidence-emulator/signed-in-self-hidden-follow-desktop.png`
  - `/private/tmp/t201-profile-browser-evidence-emulator/signed-out-target-mobile.png`
  - Console/network residual: expected emulator warnings plus aborted Firestore long-poll requests during browser close.
- Changed files summary:
  - `src/components/FollowButton.jsx` and `.module.css`: shared render-only follow button.
  - `src/runtime/hooks/useProfileRuntime.js`: profile follow state, derived following count, modal list state, optimistic follow/unfollow with rollback toast.
  - `src/app/users/[uid]/ProfileClient.jsx`, `ProfileStats.jsx`, `FollowListModal.jsx`, `PublicProfile.module.css`: profile follow UI, clickable counts, modal rows with profile links only.
  - `src/ui/users/ProfileScreen.jsx`: render-only follow control integration.
  - `tests/unit/runtime/useProfileRuntime.test.jsx`, `tests/integration/profile/ProfileClient.test.jsx`, `tests/integration/profile/ProfileStats.test.jsx`: profile follow behavior coverage.

### T202 - Profile Page Count Serialization Fix

- **State**: `completed`
- **Attempt**: 2
- **Wave**: `wave-profile-fix`
- **Engineer**: Profile Serialization Engineer
- **Reviewer**: Profile Serialization Reviewer
- **Dependencies**: T201 `completed`; T401 production blocker recorded.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Fix the full Firestore -> service mapper -> profile page -> client
  serialization path so Firestore `users/{uid}.followersCount` reaches
  `PublicProfile`, `ProfileClient`, and `useProfileRuntime` initial profile
  data.
- Preserve the attempt 1 page serializer regression coverage and add focused
  service mapper coverage for mapping Firestore `followersCount` into
  `PublicProfile`.
- Coordinate one narrow T401 lint unblocker in
  `tests/e2e/runner-following.spec.js` for the existing `no-empty-pattern`
  failure only.

Non-scope:

- No E2E seed, Playwright config, or Playwright behavior edits; T401 owns
  those. The only allowed E2E-file change is the lint-only
  `no-empty-pattern` cleanup in `tests/e2e/runner-following.spec.js`.
- No broad profile UI redesign, event/member follow changes, notification
  changes, Firestore rules changes, package changes, lockfile changes, deploy,
  commit, push, pull request, CI watch, merge, or local main sync.
- Do not reintroduce or depend on `users/{uid}.followingCount`; following count
  remains derived from `users/{uid}/following`.

Owned files:

- `src/service/profile-mapper.js`
- `src/app/users/[uid]/page.jsx`
- `tests/unit/service/profile-mapper.test.js`
- `tests/integration/profile/ProfilePage.test.jsx`
- `tests/e2e/runner-following.spec.js`

Read-only context:

- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/plan.md`
- `specs/068-runner-following/tasks.md`
- `src/app/users/[uid]/ProfileClient.jsx`
- `src/runtime/hooks/useProfileRuntime.js`
- `tests/integration/profile/ProfileClient.test.jsx`
- `tests/integration/profile/ProfileStats.test.jsx`
- `tests/_helpers/profile-fixtures.js`
- `tests/e2e/_setup/068-runner-following-global-setup.js`

Engineer instructions:

- Treat attempt 1 as blocked/rework, not complete: the page serializer
  regression passed, but the full service mapper path is still incomplete and
  `npm run lint:changed` is blocked by a T401-owned lint error.
- RED/GREEN a focused service mapper regression proving Firestore
  `followersCount` maps into `PublicProfile`. Use
  `tests/unit/service/profile-mapper.test.js` as the new focused test file
  because no existing mapper test file is present.
- Keep the attempt 1 page serializer regression and preserve numeric
  `profile.followersCount` through `serializeProfile()`.
- Keep `followingCount` out of serialized user-doc data and preserve the
  derived following-count read model from T101/T201.
- If the page helper is not directly testable, expose the smallest pure export
  from `src/app/users/[uid]/page.jsx` needed for this regression while keeping
  route behavior unchanged.
- In `tests/e2e/runner-following.spec.js`, fix only the
  `no-empty-pattern` lint violation at the existing T401 line; do not change
  Playwright assertions, setup assumptions, or E2E behavior.
- After T202 passes Reviewer, coordinator may return T401 to `ready` for E2E
  rerun.

Acceptance criteria:

- Firestore `followersCount` maps into `PublicProfile` through
  `src/service/profile-mapper.js`.
- Seeded target user data with `followersCount: 1` can reach profile runtime
  initial state and render as `1 位追蹤者`, not normalized to `0`.
- Public profile following count remains derived from the following list/read
  model and does not rely on `users/{uid}.followingCount`.
- Regression coverage fails before the serialization fix and passes after.
- `npm run lint:changed` is unblocked without changing T401 E2E behavior.
- Diff touches only the expanded T202 owned files.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npx vitest run --project=browser tests/unit/service/profile-mapper.test.js tests/integration/profile/ProfilePage.test.jsx tests/integration/profile/ProfileClient.test.jsx` | RED before mapper implementation for missing `followersCount`; GREEN exit 0 after fix |
| `npm run lint:changed` | exit 0 |
| `npm run type-check:changed` | exit 0 |
| `git diff --check` | exit 0 |

Browser evidence requirement:

- Not applicable. T401 owns full E2E/browser evidence after this production fix.

Reviewer PASS criteria:

- Diff touches only the expanded T202 owned files.
- Service mapper regression proves Firestore `followersCount` maps into
  `PublicProfile`.
- Regression coverage proves `followersCount` survives profile page
  serialization into initial profile data.
- No path reads or writes `users/{uid}.followingCount`.
- `tests/e2e/runner-following.spec.js` change is lint-only and does not alter
  E2E assertions or behavior.
- Verification commands pass.

Reviewer REJECT criteria:

- The fix changes E2E seed/config/behavior, event/member surfaces, rules, repo,
  unrelated services, or unrelated profile UI files.
- `followingCount` is reintroduced as serialized user-doc data.
- Regression coverage does not fail before the fix or does not cover the
  service mapper and profile page serialization paths.
- Verification is missing or stale.

Evidence:

- Dispatch: T202 attempt 2 Profile Serialization Rework Engineer dispatched at
  `2026-05-22T07:31:40+08:00`.
- Engineer report: T202 attempt 2 Profile Serialization Rework Engineer DONE
  in the target worktree. Mapper now includes optional numeric
  `followersCount` in `PublicProfile`; `followingCount` remains omitted.
  Attempt 1 page serialization is preserved so numeric `followersCount`
  crosses RSC serialization and `followingCount` is not serialized. The only
  E2E file change is lint-only cleanup from
  `test.afterEach(({}, testInfo) => ...)` to
  `test.afterEach((_, testInfo) => ...)`; no E2E assertions or behavior
  changed.
- Reviewer report: T202 attempt 2 Profile Serialization Reviewer
  `review_passed` at `2026-05-22T07:48:24+08:00`; findings: none blocking.
  Diff checked:
  - `src/service/profile-mapper.js`: numeric-only `followersCount` mapped; no
    `followingCount`.
  - `src/app/users/[uid]/page.jsx`: numeric-only `followersCount` serialized
    and passed to `ProfileClient`.
  - `tests/unit/service/profile-mapper.test.js`: maps numeric count, omits
    `followingCount`.
  - `tests/integration/profile/ProfilePage.test.jsx`: preserves
    `followersCount`, omits `followingCount`.
  - `tests/e2e/runner-following.spec.js`:
    `afterEach((_, testInfo) => ...)` lint cleanup.
  Commands: `npx vitest run --project=browser tests/unit/service/profile-mapper.test.js tests/integration/profile/ProfilePage.test.jsx tests/integration/profile/ProfileClient.test.jsx`
  exit 0 with 3 files / 15 tests passed; `npm run lint:changed` exit 0;
  `npm run type-check:changed` exit 0; `git diff --check` exit 0.
  Residual/incident: non-T202 dirty files ignored per scope;
  `tests/e2e/runner-following.spec.js` is untracked as a T401 file, so git
  cannot prove pre/post T202 delta directly, but current line 145 matches the
  lint cleanup; accidental main-workspace untracked
  `/Users/chentzuyu/Desktop/dive-into-run/tests/unit/service/profile-mapper.test.js`
  remains open and was not cleaned up.
- Command output summary:
  - `npx vitest run --project=browser tests/integration/profile/ProfilePage.test.jsx`: exit 1 in RED; serialized profile missing `followersCount: 1`.
  - `npx vitest run --project=browser tests/integration/profile/ProfilePage.test.jsx`: exit 0 in GREEN; 1 passed.
  - `npx vitest run --project=browser tests/integration/profile/ProfilePage.test.jsx tests/integration/profile/ProfileClient.test.jsx`: exit 0; 13 passed.
  - `npm run type-check:changed`: exit 0.
  - `git diff --check`: exit 0.
  - `npm run lint:changed`: exit 1 due `tests/e2e/runner-following.spec.js:145` `no-empty-pattern`.
  - `npx vitest run --project=browser tests/unit/service/profile-mapper.test.js tests/integration/profile/ProfilePage.test.jsx tests/integration/profile/ProfileClient.test.jsx`: exit 1 in RED; mapper result missed `followersCount: 12` in profile-mapper test.
  - `npx vitest run --project=browser tests/unit/service/profile-mapper.test.js tests/integration/profile/ProfilePage.test.jsx tests/integration/profile/ProfileClient.test.jsx`: exit 0 in GREEN; 3 files / 15 tests passed.
  - `npm run lint:changed`: exit 0.
  - `npm run type-check:changed`: exit 0.
  - `git diff --check`: exit 0.
- Changed files summary:
  - Attempt 1 changed `src/app/users/[uid]/page.jsx` to preserve numeric
    `profile.followersCount` in `serializeProfile()`.
  - Attempt 1 changed `tests/integration/profile/ProfilePage.test.jsx` to
    cover page serialization and exported `serializeProfile()` only for the
    focused regression.
  - Attempt 2 changed `src/service/profile-mapper.js` to map numeric
    Firestore `followersCount` into `PublicProfile`.
  - Attempt 2 changed `tests/unit/service/profile-mapper.test.js` for the
    mapper regression.
  - Attempt 2 changed `tests/e2e/runner-following.spec.js` only for the
    lint-only `test.afterEach((_, testInfo) => ...)` cleanup.
- Residual/incident:
  - Engineer accidentally created an untracked copy at
    `/Users/chentzuyu/Desktop/dive-into-run/tests/unit/service/profile-mapper.test.js`
    before correcting to the target worktree. Deletion was blocked by the
    local safety hook. Cleanup requires explicit user approval or separate
    cleanup authorization; do not clean it now.

### T251 - Member Following Management Surface

- **State**: `completed`
- **Attempt**: 2
- **Wave**: `wave-member`
- **Engineer**: Member Following Engineer
- **Reviewer**: Member Following Reviewer
- **Dependencies**: T201 `completed`.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Add a signed-in member/dashboard surface for the viewer's own following list labeled `我的追蹤跑友`.
- Add followed runner rows with avatar/name links to public profiles.
- Add row-level unfollow only if it stays consistent with the current member favorites remove/undo list-management pattern.
- Add member page entry link for signed-in users.

Non-scope:

- No public profile modal changes.
- No event host follow controls.
- No inline follow-back, recommendations, discovery, private accounts, follow requests, or following feed.
- No rules, E2E config, package, lockfile, or rules deploy.

Owned files:

- `src/app/member/page.jsx`
- `src/app/member/following/page.jsx`
- `src/runtime/hooks/useMemberFollowingRuntime.js`
- `src/ui/member/MemberPageScreen.jsx`
- `src/ui/member/MemberFollowingScreen.jsx`
- `src/ui/member/MemberFollowingScreen.module.css`
- `tests/unit/runtime/useMemberFollowingRuntime.test.jsx`
- `tests/integration/member/MemberFollowingPage.test.jsx`
- `tests/integration/member/MemberFavoritesPage.test.jsx`

Read-only context:

- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/plan.md`
- `src/app/member/favorites/page.jsx`
- `src/runtime/hooks/useMemberFavoritesRuntime.js`
- `src/ui/member/MemberFavoritesScreen.jsx`
- `src/ui/member/MemberFavoritesScreen.module.css`
- `src/runtime/client/use-cases/follow-use-cases.js`
- `src/components/UserLink.jsx`
- `tests/integration/member/MemberFavoritesPage.test.jsx`

Engineer instructions:

- RED: add tests that member page exposes a signed-in `我的追蹤跑友` entry link, signed-out users do not see or cannot use that member surface, the following page lists followed runners with avatar/name profile links, and row-level unfollow removes a runner optimistically with rollback toast on failure.
- GREEN: implement a thin `/member/following` route, runtime hook, and render-only screen following the current member favorites page pattern.
- Attempt 2 fix: move the member dashboard `我的追蹤跑友` entry out of `src/app/member/page.jsx` and render it beside `我的收藏` in `src/ui/member/MemberPageScreen.jsx`; keep the app route/page layer composition-only.
- Consume the viewer's following list and derived count from T101; do not read
  or write `users/{viewerUid}.followingCount`.
- Prefer the existing member favorites remove/undo ergonomics for unfollow if the follow use-case supports restoring via follow; otherwise provide unfollow with rollback on failure and no undo.
- Keep the public follower/following modal row behavior unchanged: modal rows link only and do not contain follow/unfollow controls.

Acceptance criteria:

- Signed-in users can open `我的追蹤跑友` from the member area.
- The member dashboard entry is rendered by `src/ui/member/MemberPageScreen.jsx`
  beside `我的收藏`, not directly by `src/app/member/page.jsx`.
- Signed-out users cannot access the member following management surface.
- The member following list shows followed runner rows with avatar/name links to `/users/{uid}`.
- Row-level unfollow is available only when implemented consistently with member list management patterns and uses the same follow use-case path.
- Unfollow failure restores the row and shows an error toast.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx` | RED before implementation; exit nonzero for new assertions, then GREEN exit 0 |
| `npm run audit:use-effect-data-fetching` | exit 0 |
| `npm run lint:changed` | exit 0 |
| `npm run type-check:changed` | exit 0 |

Browser evidence requirement:

- Target URLs: `/member`, `/member/following`.
- Viewports: desktop 1440 by 900 and mobile 390 by 844.
- Journeys: signed-in entry link, following list profile links, unfollow row action, signed-out access guard.
- Record console errors/warnings, failed network requests, screenshot artifact paths, and expected versus actual UI signal.

Reviewer PASS criteria:

- Diff touches only owned files.
- Member following route follows current member favorites route/runtime/screen separation.
- The member dashboard entry lives in `src/ui/member/MemberPageScreen.jsx`
  beside `我的收藏`, while `src/app/member/page.jsx` remains composition-only.
- Signed-out access is guarded.
- Runner rows link to profiles and do not add follow-back or discovery behavior.
- Unfollow action uses shared follow use-cases and has rollback/error handling.
- Browser evidence is complete.
- Verification commands pass.

Reviewer REJECT criteria:

- Member route is accessible as a management surface to signed-out users.
- `我的追蹤跑友` remains directly implemented in `src/app/member/page.jsx`
  instead of the render-only member screen.
- Rows add inline follow-back, recommendations, or non-v1 social graph actions.
- UI imports repo/service/Firebase directly instead of using runtime/use-cases.
- Unfollow can leave stale UI on failure.
- Browser evidence is missing for meaningful UI changes.

Evidence:

- Engineer report: T251 attempt 1 `DONE` at `2026-05-22T03:51:07+08:00`.
  Member following management implementation completed inside the T251 owned
  files. The member page exposes the signed-in `我的追蹤跑友` entry, the
  `/member/following` route/runtime/UI list followed runners with profile
  links, signed-out access is guarded, and row-level unfollow uses the shared
  follow use-case path with rollback/error handling.
- Dispatch: Member Following Engineer dispatched at `2026-05-22T03:12:51+08:00`.
- Browser evidence report: `DONE`.
- Reviewer report: T251 attempt 1 `review_rejected` at
  `2026-05-22T04:00:50+08:00`. Finding: `src/app/member/page.jsx` currently
  puts the `我的追蹤跑友` UI link directly in the route/composition layer.
  Existing member management pattern keeps UI links in the render-only screen;
  `src/ui/member/MemberPageScreen.jsx` owns `我的收藏`. Fix expectation for
  attempt 2: move the following entry beside `我的收藏` in
  `src/ui/member/MemberPageScreen.jsx` and keep `src/app/member/page.jsx`
  composition-only.
- Engineer report: T251 attempt 2 Fix Engineer `DONE`, recorded by workflow
  sync at `2026-05-22T04:09:52+08:00`. Changed file:
  `src/ui/member/MemberPageScreen.jsx`. The `/member/following`
  `我的追蹤跑友` entry moved to render-only
  `src/ui/member/MemberPageScreen.jsx` beside `我的收藏`;
  `src/app/member/page.jsx` is back to a thin route and the final diff has no
  route-level UI link. Signed-out users still do not see member management
  links.
- Reviewer report: T251 attempt 2 `review_passed` at
  `2026-05-22T04:18:11+08:00`; no findings. Diff checked:
  `src/app/member/page.jsx` remains thin route/composition only with no
  route-level `我的追蹤跑友` UI link, and
  `src/ui/member/MemberPageScreen.jsx` renders `我的追蹤跑友` beside
  `我的收藏`. Acceptance checked: signed-in entry, signed-out guard, profile
  links, shared `unfollowRunner` path, optimistic remove, rollback, and error
  toast are all present.
- Reviewer residual risk:
  - Browser evidence was validated, not rerun.
  - Branch is behind `origin/main` by 3 commits and worktree contains
    T101/T201 diffs; ignored per scope.
  - Browser evidence still has emulator/LCP warnings and aborted
    long-poll/RSC requests, but no HTTP errors.
- Command output summary:
  - RED `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx`: exit 1; failures covered missing `我的追蹤跑友` member entry, following screen heading/guard/rows, runtime state/unfollow behavior.
  - GREEN `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx`: exit 0; 3 files / 12 tests passed.
  - `npm run audit:use-effect-data-fetching`: exit 0; 0 findings.
  - `npm run lint:changed`: exit 0.
  - `npm run type-check:changed`: exit 0.
  - Reviewer `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx`: exit 0; 3 files / 12 tests passed.
  - Reviewer `npm run audit:use-effect-data-fetching`: exit 0; 0 findings.
  - Reviewer `npm run lint:changed`: exit 0; React eslint settings warning only.
  - Reviewer `npm run type-check:changed`: exit 0.
  - Reviewer browser evidence JSON/screenshots validation via `jq`/`file`: exit 0.
  - Browser `git status --short --branch`: exit 0.
  - Browser sandbox localhost curl probes 3001/8080/9099/9199: exit 7; escalated probes verified services.
  - Browser Firebase emulator start attempt: exit 1 because emulator ports were already occupied.
  - Browser auth sign-in probe: exit 0; HTTP 200; uid `796E9eCnaA6Hd4qTAKuE9RHDTDA5`.
  - Browser Playwright evidence script first run: exit 1 due temp-script locator strictness against Next route announcer.
  - Browser corrected temp script rerun: exit 0.
  - Attempt 2 `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx`: exit 0; 3 files / 12 tests passed.
  - Attempt 2 `npm run audit:use-effect-data-fetching`: exit 0; 0 findings.
  - Attempt 2 `npm run lint:changed`: exit 0; React version warning only.
  - Attempt 2 `npm run type-check:changed`: exit 0.
  - Attempt 2 browser evidence sandbox run: exit 1; localhost fetch blocked.
  - Attempt 2 browser evidence escalated rerun: exit 0; DONE.
  - Reviewer attempt 2 `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx`: exit 0; 3 files / 12 tests passed.
  - Reviewer attempt 2 `npm run audit:use-effect-data-fetching`: exit 0; 0 findings.
  - Reviewer attempt 2 `npm run lint:changed`: exit 0; React version warning only.
  - Reviewer attempt 2 `npm run type-check:changed`: exit 0.
  - Reviewer attempt 2 `jq . /private/tmp/t251-member-following-browser-evidence-attempt2/t251-browser-evidence-results.json`: exit 0; status DONE, expected desktop/mobile signals present, no HTTP errors.
  - Reviewer attempt 2 `sips -g pixelWidth -g pixelHeight /private/tmp/t251-member-following-browser-evidence-attempt2/*.png`: exit 0; 8 screenshots with expected desktop/mobile dimensions.
- Browser expected versus actual:
  - `/member` signed-in: `我的追蹤跑友` link present with href `/member/following` on desktop and mobile.
  - Link navigation landed on `/member/following`.
  - `/member/following` signed-in: heading `我的追蹤跑友` visible on desktop and mobile.
  - Rows showed seeded `t251-runner-a` and `t251-runner-b`; links were `/users/t251-runner-a` and `/users/t251-runner-b`.
  - Unfollow changed rows from 2 to 1; `T251 Runner Alpha` disappeared after action.
  - Signed-out direct `/member/following`: guard `請先登入以管理追蹤跑友`; management rows 0, unfollow buttons 0.
- Browser evidence artifacts:
  - `/private/tmp/t251-member-following-browser-evidence/t251-browser-evidence-results.json`
  - `/private/tmp/t251-member-following-browser-evidence/signed-out-member-following-desktop-1440x900.png`
  - `/private/tmp/t251-member-following-browser-evidence/signed-in-member-desktop-1440x900.png`
  - `/private/tmp/t251-member-following-browser-evidence/signed-in-member-following-before-unfollow-desktop-1440x900.png`
  - `/private/tmp/t251-member-following-browser-evidence/signed-in-member-following-after-unfollow-desktop-1440x900.png`
  - `/private/tmp/t251-member-following-browser-evidence/signed-out-member-following-mobile-390x844.png`
  - `/private/tmp/t251-member-following-browser-evidence/signed-in-member-mobile-390x844.png`
  - `/private/tmp/t251-member-following-browser-evidence/signed-in-member-following-before-unfollow-mobile-390x844.png`
  - `/private/tmp/t251-member-following-browser-evidence/signed-in-member-following-after-unfollow-mobile-390x844.png`
- Browser residual:
  - Console warnings: `Connecting to Firebase Emulators...`; Next image LCP warning for `/default-avatar.png`.
  - Failed requests: Firestore Listen/channel `net::ERR_ABORTED`; `/member/following?_rsc=zzibr` `net::ERR_ABORTED`.
  - HTTP >=400 responses: 0.
  - Browser evidence subagent edited, staged, committed, and pushed no repo files.
- Attempt 2 browser evidence:
  - Result JSON: `/private/tmp/t251-member-following-browser-evidence-attempt2/t251-browser-evidence-results.json`.
  - Screenshots dir: `/private/tmp/t251-member-following-browser-evidence-attempt2/`.
  - Signals: `memberEntryLinkHref: /member/following`, signed-out guard text,
    desktop/mobile rows before/after unfollow.
  - Residual: local emulator and Next image LCP warnings plus aborted
    long-poll/RSC requests; no HTTP errors.
- Changed files summary:
  - `src/app/member/page.jsx`: attempt 1 had the signed-in member entry link
    for `我的追蹤跑友`; attempt 2 final diff has no route-level UI link and the
    file is back to a thin route.
  - `src/app/member/following/page.jsx`: thin member following route.
  - `src/runtime/hooks/useMemberFollowingRuntime.js`: member following runtime state and unfollow behavior.
  - `src/ui/member/MemberPageScreen.jsx`: attempt 2 owns the member dashboard
    `我的追蹤跑友` entry beside `我的收藏`.
  - `src/ui/member/MemberFollowingScreen.jsx`: render-only following management screen.
  - `src/ui/member/MemberFollowingScreen.module.css`: following screen styles.
  - `tests/unit/runtime/useMemberFollowingRuntime.test.jsx`: runtime state/unfollow coverage.
  - `tests/integration/member/MemberFollowingPage.test.jsx`: route/screen guard, rows, links, and unfollow coverage.
  - `tests/integration/member/MemberFavoritesPage.test.jsx`: member entry coverage.
  - Reviewer rejection: `src/app/member/page.jsx` currently owns UI link
    placement that belongs in `src/ui/member/MemberPageScreen.jsx`.
  - Reviewer PASS: attempt 2 checked `src/app/member/page.jsx` stayed
    route/composition-only and `src/ui/member/MemberPageScreen.jsx` owns the
    member dashboard `我的追蹤跑友` entry beside `我的收藏`.

### T301 - Event Host Follow Entrypoints

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-events`
- **Engineer**: Events Engineer
- **Reviewer**: Events Reviewer
- **Dependencies**: T251 `completed`.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Add follow/unfollow controls beside event list host and event detail host for signed-in non-self users.
- Preserve no follow controls in event comments and participants list rows.

Non-scope:

- No profile modal changes.
- No post poster follow buttons.
- No member following management changes.
- No rules, E2E config, package, lockfile, or rules deploy.

Owned files:

- `src/runtime/hooks/useEventsPageRuntime.js`
- `src/ui/events/EventsListSection.jsx`
- `src/ui/events/EventsPageScreen.module.css`
- `src/runtime/hooks/useEventDetailRuntime.js`
- `src/ui/events/EventDetailScreen.jsx`
- `src/ui/events/EventDetailScreen.module.css`
- `tests/unit/runtime/useEventsPageRuntime.test.jsx`
- `tests/unit/runtime/useEventDetailRuntime.test.jsx`
- `tests/integration/events/EventHostFollow.test.jsx`
- `tests/integration/events/ParticipantsModal.test.jsx`

Read-only context:

- `specs/068-runner-following/spec.md`
- `src/components/FollowButton.jsx`
- `src/runtime/client/use-cases/follow-use-cases.js`
- `src/components/UserLink.jsx`
- `src/components/CommentSection.jsx`
- `src/ui/events/ParticipantsModal.jsx`
- `tests/integration/events/EventsPage.test.jsx`
- `tests/integration/events/EventDetailClient-delete-race.test.jsx`

Engineer instructions:

- RED: add tests for signed-in non-self host follow/unfollow on event list and detail, signed-out hidden controls, self-hosted hidden controls, participants rows profile links only, and comments remaining without follow controls.
- GREEN: batch follow-status reads for visible hosts on events page and single host state on event detail.
- Consume follow state and any count/list metadata through T101 follow
  use-cases; do not depend on `users/{uid}.followingCount`.
- Reuse `FollowButton` and `follow-use-cases`; do not duplicate follow transaction logic.
- Keep host `UserLink` intact so participants and hosts remain navigable to profile pages.

Acceptance criteria:

- Event list host row exposes follow/unfollow only for signed-in non-self users.
- Event detail host row exposes follow/unfollow only for signed-in non-self users.
- Self-hosted event surfaces hide the follow button.
- Signed-out event surfaces hide follow buttons.
- Participants modal rows still link to profiles and contain no follow buttons.
- Comments remain free of follow controls.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npx vitest run --project=browser tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/runtime/useEventDetailRuntime.test.jsx tests/integration/events/EventHostFollow.test.jsx tests/integration/events/ParticipantsModal.test.jsx` | RED before implementation; exit nonzero for new assertions, then GREEN exit 0 |
| `npm run audit:use-effect-data-fetching` | exit 0 |
| `npm run lint:changed` | exit 0 |
| `npm run type-check:changed` | exit 0 |

Browser evidence requirement:

- Target URLs: `/events`, `/events/runner-following-event`.
- Viewports: desktop 1440 by 900 and mobile 390 by 844.
- Journeys: signed-out hidden host follow controls, signed-in non-self follow/unfollow from list, signed-in non-self follow/unfollow from detail, self-hosted hidden control, participants modal no follow buttons.
- Record console errors/warnings, failed network requests, screenshot artifact paths, and expected versus actual UI signal.

Reviewer PASS criteria:

- Diff touches only owned files.
- Event UI uses shared follow runtime/use-case path.
- Forbidden surfaces stay free of follow buttons.
- Browser evidence is complete.
- Verification commands pass.

Reviewer REJECT criteria:

- Follow button appears for signed-out users, self-hosted events, participants rows, comments, or posts.
- Event page causes duplicate per-card writes or duplicated mutation logic outside follow use-cases.
- Browser evidence is missing.
- Verification is missing or stale.

Evidence:

- Dispatch: Events Engineer dispatched at `2026-05-22T04:24:35+08:00`.
- Engineer report: `DONE`. Previous T301 partial diff existed; replacement engineer worked with it and did not revert it. Clean RED was unavailable because the replacement inherited a partial diff where tests and implementation already existed; no reverse revert was performed. Forbidden surfaces stayed out of scope: participants/comments have no follow buttons, and posts were untouched. Engineer changed no workflow files and performed no staging, commit, push, or PR.
- Reviewer report: Events Reviewer `review_passed` at
  `2026-05-22T06:42:20+08:00`; findings: none. Diff checked T301 owned files
  only, including new `tests/integration/events/EventHostFollow.test.jsx`;
  shared read-only verification covered `src/components/FollowButton.jsx` and
  `src/runtime/client/use-cases/follow-use-cases.js`; no post files matched in
  the changed file list. Browser evidence JSON, screenshots, and logs were
  inspected; no app HTTP 4xx/5xx found. Screenshot sample matched list,
  detail, participants, and signed-out coverage.
- Reviewer residual risk:
  - Browser flow was validated from existing evidence, not rerun.
  - Explorer subagent could not start because thread limit was reached, so
    review was completed by the Reviewer directly.
- Command output summary:
  - RED evidence: clean RED unavailable because replacement inherited partial diff where tests and implementation already existed; no reverse revert was performed.
  - `npx vitest run --project=browser tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/runtime/useEventDetailRuntime.test.jsx tests/integration/events/EventHostFollow.test.jsx tests/integration/events/ParticipantsModal.test.jsx`: exit 0, 4 files / 38 tests passed.
  - `npm run audit:use-effect-data-fetching`: exit 0.
  - `npm run lint:changed`: exit 0, existing React settings warning.
  - `npm run type-check:changed`: exit 0.
  - Reviewer `npx vitest run --project=browser tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/runtime/useEventDetailRuntime.test.jsx tests/integration/events/EventHostFollow.test.jsx tests/integration/events/ParticipantsModal.test.jsx`: exit 0, 4 files / 38 tests passed.
  - Reviewer `npm run audit:use-effect-data-fetching`: exit 0.
  - Reviewer `npm run lint:changed`: exit 0, existing React settings warning only.
  - Reviewer `npm run type-check:changed`: exit 0.
  - Reviewer `git diff --check -- <T301 files>`: exit 0.
  - Browser evidence JSON: `/private/tmp/t301-event-host-follow-browser-evidence/browser-evidence.json`.
  - Browser screenshots: `/private/tmp/t301-event-host-follow-browser-evidence/*.png`.
  - Browser coverage: desktop 1440x900 and mobile 390x844 for `/events` signed-out hidden controls, signed-in non-self list follow/unfollow, signed-in non-self detail follow/unfollow, self-hosted hidden control, participants profile links only with no follow buttons, and comments profile link with no follow buttons.
  - Browser residual: console warnings only `Connecting to Firebase Emulators...`; no app HTTP 4xx/5xx observed in Next logs; Playwright recorded Firestore emulator Listen/Write `net::ERR_ABORTED` during page navigation/context close, while assertions still passed.
- Changed files summary:
  - `src/runtime/hooks/useEventsPageRuntime.js`
  - `src/ui/events/EventsListSection.jsx`
  - `src/ui/events/EventsPageScreen.module.css`
  - `src/runtime/hooks/useEventDetailRuntime.js`
  - `src/ui/events/EventDetailScreen.jsx`
  - `src/ui/events/EventDetailScreen.module.css`
  - `tests/unit/runtime/useEventsPageRuntime.test.jsx`
  - `tests/unit/runtime/useEventDetailRuntime.test.jsx`
  - `tests/integration/events/ParticipantsModal.test.jsx`
  - `tests/integration/events/EventHostFollow.test.jsx` (new/untracked)

### T401 - E2E, Emulator Seed, And Browser Evidence

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-e2e`
- **Engineer**: E2E Engineer
- **Reviewer**: E2E Reviewer
- **Dependencies**: T301 `completed`; T202 `completed` after Reviewer PASS and coordinator sync.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Add runner-following emulator seed and Playwright E2E flow.
- Add Playwright feature mapping if the new seed uses `E2E_FEATURE=068-runner-following`.
- Capture browser evidence for profile, member following, and event journeys after implementation.

Non-scope:

- No production implementation beyond fixing issues exposed by E2E without coordinator approval.
- No package, lockfile, rules deploy, commit, push, pull request, CI watch, merge, or local main sync.

Owned files:

- `tests/e2e/_setup/068-runner-following-global-setup.js`
- `tests/e2e/runner-following.spec.js`
- `playwright.emulator.config.mjs`

Read-only context:

- `specs/068-runner-following/spec.md`
- `.codex/rules/e2e-commands.md`
- `.codex/references/testing-handbook.md`
- `tests/e2e/_setup/014-notification-system-global-setup.js`
- `tests/e2e/notification-flow.spec.js`
- `tests/_helpers/e2e-helpers.js`

Engineer instructions:

- RED: write E2E assertions for signed-out profile count/list reads with no follow button, signed-in profile follow/unfollow, member `我的追蹤跑友` list and unfollow, event list host follow, event detail host follow, follow notification navigation to follower profile, and no forbidden follow controls.
- GREEN: implement seed/config only inside owned files; if production behavior fails, report blocker instead of editing production files from this task.
- T401 Reviewer PASS recorded; T501 is ready for final integration gate
  dispatch.
- Use Playwright role/text locators and web-first assertions.
- Do not use fixed sleeps or `page.waitForTimeout`.

Acceptance criteria:

- E2E seed creates viewer, target, host/event data, member following data, follow graph state, and notification state needed for deterministic tests.
- `E2E_FEATURE=068-runner-following npm run test:e2e:emulator` selects the new setup and spec.
- Playwright tests cover the critical journeys and forbidden surfaces from `spec.md`.
- Browser evidence records manual UI inspection signals for profile, event list, and event detail.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npm run audit:playwright-official-only` | exit 0 |
| `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"` | RED before implementation if UI not ready; GREEN exit 0 after dependencies complete |
| `git diff --check` | exit 0 |

Browser evidence requirement:

- Tool: Codex in-app Browser or Chrome plugin.
- Target URLs: `/users/target-runner`, `/member/following`, `/events`, `/events/runner-following-event`.
- Viewports: desktop 1440 by 900 and mobile 390 by 844.
- Required record: console cleared before interaction, before and after snapshots, actions performed, console errors/warnings, failed network requests, screenshot artifact paths, expected versus actual UI signal, and residual risk.

Reviewer PASS criteria:

- Diff touches only owned files.
- E2E uses official Playwright imports and no fixed sleeps.
- Feature mapping is narrow to `068-runner-following`.
- Browser evidence and E2E command support the claims.

Reviewer REJECT criteria:

- E2E is flaky by construction, uses fixed sleeps, or depends on unseeded state.
- Config change affects unrelated E2E features.
- Browser evidence is missing.
- Engineer edited production files from this E2E task.

Evidence:

- Engineer report:
  - T401 E2E Engineer dispatched at `2026-05-22T06:47:35+08:00`.
  - T401 E2E Engineer reported DONE after rerun.
  - Changed T401 owned file this resume round:
    `tests/e2e/runner-following.spec.js`.
  - Existing T401 owned files from earlier:
    `tests/e2e/_setup/068-runner-following-global-setup.js`,
    `tests/e2e/runner-following.spec.js`, and
    `playwright.emulator.config.mjs`.
  - Change summary: fixed Playwright hook fixture parameter; avoided
    `waitForText` / route announcer strict locator collision; fixed
    participants dialog locator because the actual dialog exists but has no
    accessible name.
  - E2E coverage passed: signed-out profile counts/list no follow button,
    signed-in profile follow/unfollow, member `我的追蹤跑友` list/unfollow,
    event list/detail host follow, follow notification navigation, and
    forbidden controls absent.
  - Evidence:
    `/private/tmp/t401-runner-following-e2e-evidence/browser-evidence.json`,
    `/private/tmp/t401-runner-following-e2e-evidence/*.png`, and
    `test-results/.last-run.json` shows passed.
  - Process cleanup: no manual kill; Firebase emulators shutdown via
    `emulators:exec`.
  - Residual risk: Next multiple lockfiles warning; browser evidence has common
    emulator/navigation `net::ERR_ABORTED`; `httpErrors` / `appHttpErrors`
    empty.
  - No stage, commit, push, or PR.
- Reviewer report:
  - T401 E2E Reviewer `review_passed` at `2026-05-22T08:10:16+08:00`;
    findings: none.
  - Diff checked:
    `tests/e2e/_setup/068-runner-following-global-setup.js`,
    `tests/e2e/runner-following.spec.js`, and
    `playwright.emulator.config.mjs`.
  - Commands: `npm run audit:playwright-official-only` exit 0 with
    0 findings;
    `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"`
    exit 0 with 4 passed; `git diff --check` exit 0.
  - Evidence:
    `/private/tmp/t401-runner-following-e2e-evidence/browser-evidence.json`
    status DONE, failure null, 13 signals, `appHttpErrors` empty;
    13 PNG screenshots present, with sampled profile, notification, member
    following, event list/detail/participants coverage;
    `test-results/.last-run.json` status passed.
  - Residual risk: Next multiple lockfiles warning remains; browser evidence
    has Firestore channel/RSC navigation `net::ERR_ABORTED` but HTTP errors are
    empty and E2E is green; event list self-host follow control check is
    whole-page button count, not scoped card, which is acceptable but weaker.
  - Previous blocker evidence remains recorded: Workflow State Engineer
    recorded T401 as `blocked` at `2026-05-22T07:07:53+08:00`, then resolved
    the blocker at `2026-05-22T07:48:24+08:00` after T202 `review_passed` and
    coordinator sync.
- Command output summary:
  - `npm run audit:playwright-official-only`: exit 0.
  - `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"`: exit 0; 4 passed.
  - `git diff --check`: exit 0.
  - Reviewer `npm run audit:playwright-official-only`: exit 0; 0 findings.
  - Reviewer `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"`:
    exit 0; 4 passed.
  - Reviewer `git diff --check`: exit 0.
  - Browser evidence:
    `/private/tmp/t401-runner-following-e2e-evidence/browser-evidence.json` and
    `/private/tmp/t401-runner-following-e2e-evidence/*.png`.
  - Browser evidence JSON status DONE, failure null, 13 signals, and
    `appHttpErrors` empty.
  - 13 PNG screenshots present; sampled profile, notification, member
    following, event list/detail/participants.
  - `test-results/.last-run.json` status passed.
- Changed files summary:
  - This resume round changed T401 owned file:
    `tests/e2e/runner-following.spec.js`.
  - Existing T401 owned files from earlier:
    `tests/e2e/_setup/068-runner-following-global-setup.js`,
    `tests/e2e/runner-following.spec.js`, and
    `playwright.emulator.config.mjs`.

### T501 - Final Integration Gate

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-integration`
- **Engineer**: Verifier
- **Reviewer**: Integration Reviewer
- **Dependencies**: T401 `completed`.
- **Authorization boundary**: edit=yes, commit=yes, push=yes, pullRequest=yes, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=yes.

Scope:

- Verify all reviewed implementation slices together.
- Confirm workflow state sync and release boundary.
- Record final evidence in workflow state files if Main dispatches a state-sync edit.

Non-scope:

- No production feature work unless a previous task is reopened.
- No CI watch, merge, local main sync, package, lockfile, dependency, migration,
  non-Firestore deploy, or guessed Firebase project.

Owned files:

- `specs/068-runner-following/tasks.md`
- `specs/068-runner-following/handoff.md`
- `specs/068-runner-following/status.json`

Read-only context:

- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/plan.md`
- `git status --short --branch`
- Reviewed Engineer and Reviewer reports for T101, T201, T202, T251, T301, and T401.

Engineer instructions:

- Run final commands as one command per evidence entry.
- Verify no workflow state drift.
- Keep rules deploy status explicit: required, not deployed unless separately authorized and evidenced.
- Stop if any implementation task lacks Reviewer PASS.

Acceptance criteria:

- All implementation tasks are `completed` after `review_passed`.
- Final verification commands pass.
- Browser evidence exists for all UI surfaces.
- `rulesDeployStatus` accurately reflects rules release state and does not imply deploy.
- Authorization boundary reflects the 2026-05-22 user-approved release tail:
  commit/push/PR and Firestore-rules deploy are authorized; CI watch, merge,
  and local main sync are not.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `git diff --check` | exit 0 |
| `npm run workflow:validate` | exit 0 |
| `npm run workflow:check` | exit 0 |
| `npm run lint:changed` | exit 0 |
| `npm run type-check:changed` | exit 0 |
| `npm run test:branch` | exit 0 |
| `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js` | exit 0 |
| `npm run audit:use-effect-data-fetching` | exit 0 |
| `npm run audit:playwright-official-only` | exit 0 |
| `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"` | exit 0 |

Browser evidence requirement:

- Validate T201, T251, T301, and T401 browser evidence records exist and are tied to the final implemented diff.

Reviewer PASS criteria:

- All dependencies completed and reviewed.
- Final commands pass.
- Workflow state files agree.
- Rules deploy status is honest and release risk is explicit.

Reviewer REJECT criteria:

- Any task is missing Reviewer PASS.
- Any final command fails.
- Browser evidence is missing for UI changes.
- Workflow state drift exists.
- Summary implies deployed rules or deployed product behavior without deploy evidence.

Evidence:

- Engineer report:
  - T501 Final Integration Verifier retry reported `engineer_done` at
    `2026-05-22T08:30:01+08:00`.
  - All required final integration commands passed after the T401 lint fix.
  - Browser evidence artifact directories for T201, T251 attempt 2, T301, and
    T401 exist.
  - No product code, package, lockfile, dependency, migration, CI watch, merge,
    local main sync, or rules deploy action was performed during T501.
- Reviewer report:
  - Integration Reviewer returned `review_passed` at
    `2026-05-22T08:40:51+08:00`; findings: none blocking.
  - Evidence checked: `status.json` had T501 active and `engineer_done`;
    T101, T201, T202, T251, T301, and T401 were all completed with
    `review_passed`; this file recorded T501 final evidence and all final
    verification rows exit 0; `handoff.md` had T501 pending Integration
    Reviewer plus explicit rules deploy and open incident boundaries; browser
    evidence dirs existed for T201, T251, T301, and T401.
  - Residual risks at T501 review time: Firestore/storage rules deploy was
    required but not authorized or deployed; the main-workspace untracked file
    incident remained open; branch `068-runner-following` was behind
    `origin/main` by 13; no commit, push, PR, CI watch, merge, local main sync,
    rules deploy, staging, or deploy was authorized or performed. The
    2026-05-22 release-tail authorization later expanded commit/push/PR and
    Firestore-rules deploy only, and the accidental-file incident was resolved.
- Command output summary:
  - `git diff --check`: exit 0.
  - `npm run workflow:validate`: exit 0; seven status files valid.
  - `npm run workflow:check`: exit 0; seven status files synced.
  - `npm run lint:changed`: exit 0; changed-file lint passed.
  - `npm run type-check:changed`: exit 0; no type errors in changed files.
  - `npm run test:branch`: exit 0; browser vitest 8 files / 81 tests passed;
    server vitest 6 files / 96 tests passed.
  - `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js`:
    exit 0; 2 files / 31 tests passed.
  - `npm run audit:use-effect-data-fetching`: exit 0; 0 findings.
  - `npm run audit:playwright-official-only`: exit 0; 0 findings.
  - `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"`:
    exit 0; 4 passed.
  - `ls /private/tmp/t201-profile-browser-evidence-emulator /private/tmp/t251-member-following-browser-evidence-attempt2 /private/tmp/t301-event-host-follow-browser-evidence /private/tmp/t401-runner-following-e2e-evidence`:
    exit 0; browser evidence artifact directories exist.
  - Integration Reviewer `git diff --check`: exit 0.
  - Integration Reviewer `npm run workflow:validate`: exit 0.
  - Integration Reviewer `npm run workflow:check`: exit 0.
  - Integration Reviewer `ls -d /private/tmp/t201-profile-browser-evidence-emulator /private/tmp/t251-member-following-browser-evidence-attempt2 /private/tmp/t301-event-host-follow-browser-evidence /private/tmp/t401-runner-following-e2e-evidence`:
    exit 0; browser evidence directories exist.
  - Integration Reviewer `git rev-list --left-right --count HEAD...origin/main`:
    exit 0; output `0 13`.
  - Integration Reviewer `git diff --name-only --cached`: exit 0; empty.
  - Integration Reviewer `git status --short --branch`: exit 0; branch behind
    `origin/main` by 13 with dirty/untracked worktree as expected.
- Changed files summary:
  - Workflow state only:
    `specs/068-runner-following/tasks.md`,
    `specs/068-runner-following/handoff.md`, and
    `specs/068-runner-following/status.json` record T501 completed state and
    Integration Reviewer PASS evidence.

### T601 - E2E Navigation Assertion Restore/Review

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-closeout-blockers`
- **Engineer**: E2E Navigation Fix Engineer
- **Reviewer**: E2E Navigation Reviewer
- **Dependencies**: T501 completed; Recovery Release Manager reported closeout blocked by dirty post-commit E2E diff.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Keep the lint-compliant Playwright hook fix in `tests/e2e/runner-following.spec.js`.
- Restore or strengthen the event detail navigation assertion so the test proves navigation to `/events/runner-following-event`, not only that a link had the right `href` before click and existing page text was visible after click.
- Rerun the focused E2E/audit/lint/diff commands needed to prove the assertion remains deterministic.

Non-scope:

- No production implementation changes.
- No workflow checker/tooling changes.
- No package, lockfile, rules deploy, commit, push, pull request, CI watch, merge, or local main sync.
- Do not weaken E2E coverage or replace URL/navigation proof with only text visibility.

Owned files:

- `tests/e2e/runner-following.spec.js`

Read-only context:

- `specs/068-runner-following/spec.md`
- `specs/068-runner-following/tasks.md`
- `specs/068-runner-following/handoff.md`
- `.codex/rules/e2e-commands.md`
- `.codex/references/testing-handbook.md`
- `tests/e2e/_setup/068-runner-following-global-setup.js`
- `playwright.emulator.config.mjs`

Engineer instructions:

- Start from the current dirty diff in `tests/e2e/runner-following.spec.js`.
- Preserve the lint-safe hook parameter cleanup.
- Replace the weak event link click/assertion sequence with a real post-click navigation assertion for `/events/runner-following-event`, using Playwright web-first assertions.
- If the stronger assertion is flaky, report the root cause and stop instead of hiding it.

Acceptance criteria:

- The E2E test proves the event link click navigates to `/events/runner-following-event`.
- The dirty diff in `tests/e2e/runner-following.spec.js` is reviewed as intentional or corrected.
- No non-owned file is edited by T601.
- T601 can be completed after Reviewer PASS is recorded.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npm run audit:playwright-official-only` | exit 0 |
| `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"` | exit 0; runner-following E2E passes |
| `npm run lint:changed` | exit 0 |
| `git diff --check` | exit 0 |

Browser evidence requirement:

- Not required unless the Engineer changes covered behavior beyond the assertion; use existing T401 browser evidence as read-only context only.

Reviewer PASS criteria:

- Diff touches only `tests/e2e/runner-following.spec.js`.
- The event detail click has a post-click URL/navigation assertion for `/events/runner-following-event`.
- Commands pass and do not rely on fixed sleeps.
- Reviewer agrees that the hook lint cleanup is behavior-neutral.

Reviewer REJECT criteria:

- Navigation proof remains only `href` plus text visibility.
- Any non-owned file changes.
- Any verification command fails without a documented blocker.
- E2E coverage is weakened or made order/flakiness-prone.

Evidence:

- Engineer report: DONE. Strengthened the navigation assertion in `tests/e2e/runner-following.spec.js` around line 338 with `await expect(page).toHaveURL(/\/events\/runner-following-event(?:[?#]|$)/);`, while keeping the href contract and lint-compliant fixture alias.
- Reviewer report: `review_passed` at `2026-05-22T12:37:10+08:00`. Diff strengthens assertion only, has no `waitForTimeout` or fixed sleeps, `git diff --check` exit 0, `npm run audit:playwright-official-only` exit 0, `npm run lint:changed` exit 0, and E2E emulator evidence is adequate.
- Command output summary:
  - `npm run audit:playwright-official-only`: exit 0.
  - `npm run lint:changed`: exit 0.
  - `git diff --check`: exit 0.
  - `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"`: exit 0; 4 passed.
- Changed files summary:
  - `tests/e2e/runner-following.spec.js`: post-click URL assertion now proves navigation to `/events/runner-following-event`; href contract and lint-compliant fixture alias are retained.

### T602 - Workflow Checker Compatibility Review/Fix

- **State**: `completed`
- **Attempt**: 3
- **Wave**: `wave-closeout-blockers`
- **Engineer**: Workflow Checker Engineer
- **Reviewer**: Workflow Checker Reviewer
- **Dependencies**: T501 completed; Recovery Release Manager reported dirty checker makes `npm run workflow:check` pass while HEAD checker fails on unrelated historical statuses; T602 attempts 1 and 2 `review_rejected`; attempt 3 `review_passed`.
- **Authorization boundary**: edit=yes, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

Scope:

- Decide whether the current dirty `scripts/check-superpowers-state.js` change is needed and valid for unrelated historical status files.
- If valid, add or validate behavior without weakening current branch spec sync and record precise evidence.
- If not valid, use Engineer-owned cleanup to remove the dirty checker change and report the remaining global workflow-check blocker.

Non-scope:

- No production feature implementation changes.
- No E2E assertion changes; T601 owns `tests/e2e/runner-following.spec.js`.
- No package, lockfile, rules deploy, commit, push, pull request, CI watch, merge, or local main sync.
- Do not silently include global tooling behavior in release without Reviewer PASS.

Owned files:

- `scripts/check-superpowers-state.js`
- `specs/068-runner-following/tasks.md`
- `specs/068-runner-following/handoff.md`
- `specs/068-runner-following/status.json`

Read-only context:

- `docs/superpowers/workflow.md`
- `docs/superpowers/task-profiles.md`
- `docs/superpowers/status.schema.json`
- `scripts/validate-workflow-state.js`
- Historical status files that currently fail HEAD checker, including `homepage-landing` and `weather-taiwan-md-map` status files.

Engineer instructions:

- Treat this as global workflow tooling, not as part of runner-following product implementation.
- Remove or constrain the `status.worktree === cwd` detached fallback; do not
  accept same-worktree status by itself or OR it with stronger HEAD/branch
  evidence.
- Preserve strict rulesDeployStatus checks for active detached status only when
  stronger evidence exists, such as `status.branch` matching a local branch at
  HEAD or `status.currentHead` matching the current HEAD.
- Preserve false-positive avoidance for non-current historical statuses such as
  `homepage-landing`, `weather-taiwan-md-map`, and stale same-worktree
  historical status with mismatched branch/head.
- Add or prove temp probes for named current invalid failing, named non-current
  invalid passing, detached current invalid failing, detached non-current
  different-worktree passing, and detached non-current same-worktree historical
  passing.
- Record evidence in workflow state only after the implementation diff is reviewed.

Acceptance criteria:

- Active detached rulesDeployStatus enforcement requires stronger branch/head
  evidence and does not rely on `status.worktree === cwd` alone.
- Non-current historical status files still avoid false-positive rulesDeployStatus
  failures when current branch rules files are touched, including stale
  same-worktree historical status with mismatched branch/head.
- Temp probes prove named current invalid fails, named non-current invalid
  passes, detached current invalid fails, detached non-current different-worktree
  passes, and detached non-current same-worktree historical passes.
- No T601-owned E2E file is edited.
- Closeout continuation becomes ready after T602 attempt 3 Reviewer PASS is recorded and coordinator-synced.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `npm run workflow:validate` | exit 0 |
| `npm run workflow:check` | exit 0; active runner-following status stays enforced while unrelated historical statuses do not false-positive |
| `node scripts/check-superpowers-state.js specs/068-runner-following/status.json` | exit 0 for active runner-following status with valid rulesDeployStatus |
| `node --check scripts/check-superpowers-state.js` | exit 0 |
| `temp invalid named current rulesDeployStatus probe` | exit 1; current named branch status rejects invalid rulesDeployStatus when rules files are touched |
| `temp invalid named non-current rulesDeployStatus probe` | exit 0; non-current historical status avoids false-positive rulesDeployStatus enforcement |
| `temp invalid detached current rulesDeployStatus probe` | exit 1; detached current status rejects invalid rulesDeployStatus with stronger branch/head evidence |
| `temp invalid detached non-current different-worktree rulesDeployStatus probe` | exit 0; detached historical status with different worktree avoids false-positive rulesDeployStatus enforcement |
| `temp invalid detached non-current same-worktree rulesDeployStatus probe` | exit 0; stale same-worktree historical status with mismatched branch/head avoids false-positive rulesDeployStatus enforcement |
| `git diff --check` | exit 0 |

Browser evidence requirement:

- Not applicable.

Reviewer PASS criteria:

- Diff touches only T602 owned files.
- Reviewer agrees the checker behavior does not accept `status.worktree === cwd`
  by itself as active status evidence.
- Reviewer agrees active detached enforcement requires stronger branch/head
  evidence while stale same-worktree historical status passes.
- Workflow-state evidence is precise about named current, named non-current,
  detached current, detached non-current different-worktree, and detached
  non-current same-worktree probes.
- Workflow-state evidence remains truthful that T603 is blocked until T602
  attempt 3 PASS.

Reviewer REJECT criteria:

- The change hides active branch or active `status.branch` rules-deploy requirements.
- Detached HEAD or worktree-like execution can skip rulesDeployStatus enforcement
  for a truly active feature status.
- Same-worktree historical status with mismatched branch/head fails only because
  `status.worktree === cwd` was treated as active evidence.
- The change is included only to make closeout pass without a workflow-policy rationale.
- Any non-owned file changes.
- Verification is missing or ambiguous.

Evidence:

- Engineer report: attempt 1 DONE kept the branch-scoped checker change, but
  Reviewer rejected it because active-branch rulesDeployStatus enforcement can
  be skipped when `git branch --show-current` is empty in detached HEAD.
- Engineer report: attempt 2 DONE constrained detached active detection, but
  Reviewer rejected it because the detached fallback still accepted
  `status.worktree === cwd` by itself and ORed it with stronger branch/head
  evidence.
- Engineer report: attempt 3 DONE changed only
  `scripts/check-superpowers-state.js`.
- Reviewer report: T602 attempt 1 `review_rejected` recorded at
  `2026-05-22T13:00:19+08:00`. Blocking finding:
  `scripts/check-superpowers-state.js` uses `git branch --show-current`; when
  detached HEAD this is empty, so rulesDeployStatus enforcement is skipped when
  current branch is empty. A temp detached-HEAD probe proved an active
  `068-runner-following` status with invalid rulesDeployStatus exited 0 while
  `firestore.rules` was touched, weakening active-branch enforcement outside
  named-branch checkouts. Non-blocking: intended local named-branch behavior
  works; current-branch invalid temp status exits 1 and non-current invalid temp
  status exits 0. Attempt 2 expectation: robustly identify active
  branch/status.branch in detached HEAD/worktree scenarios while preserving
  non-current historical false-positive avoidance, and prove current invalid
  fails, non-current invalid passes, detached active invalid fails.
- Reviewer report: T602 attempt 2 `review_rejected` recorded at
  `2026-05-22T13:21:38+08:00`. Blocking finding:
  detached fallback is overbroad. `scripts/check-superpowers-state.js` accepts
  `status.worktree === cwd` by itself and ORs it with stronger HEAD/branch
  evidence. In a detached temp clone, historical status with
  `branch="historical-branch"`, mismatched `currentHead`, no local branch at
  HEAD, but stale/same `worktree` failed with rules errors. This is a
  non-current historical false-positive. Attempt 3 expectation: remove or
  constrain `status.worktree === cwd` fallback; active detached enforcement
  should require stronger evidence such as status branch/local branch at
  HEAD/currentHead match, while historical same-worktree mismatched branch/head
  passes.
- Reviewer report: T602 attempt 3 `review_passed` recorded at
  `2026-05-22T13:38:29+08:00`; no findings.
- Command output summary:
  - Reviewer notification `npm run workflow:validate`: exit 0.
  - Reviewer notification `npm run workflow:check`: exit 0 under the named-branch checkout before the detached-HEAD weakness was exposed.
  - Reviewer notification `node scripts/check-superpowers-state.js specs/068-runner-following/status.json`: exit 0 for valid active runner-following status.
  - Reviewer notification `temp invalid current-branch rulesDeployStatus probe`: exit 1; named current branch enforcement works.
  - Reviewer notification `temp invalid non-current rulesDeployStatus probe`: exit 0; non-current historical status false-positive avoidance works.
  - Reviewer notification `temp invalid detached-HEAD active rulesDeployStatus probe`: exit 0; BUG, expected exit 1 because active `status.branch` enforcement was skipped when `git branch --show-current` was empty.
  - Reviewer notification `git diff --check`: exit 0.
  - Attempt 2 Reviewer notification `npm run workflow:validate`: exit 0.
  - Attempt 2 Reviewer notification `npm run workflow:check`: exit 0.
  - Attempt 2 Reviewer notification `node scripts/check-superpowers-state.js specs/068-runner-following/status.json`: exit 0.
  - Attempt 2 Reviewer notification `git diff --check`: exit 0.
  - Attempt 2 Reviewer notification `temp invalid named current rulesDeployStatus probe`: exit 1 as expected.
  - Attempt 2 Reviewer notification `temp invalid named non-current rulesDeployStatus probe`: exit 0.
  - Attempt 2 Reviewer notification `temp invalid detached current rulesDeployStatus probe`: exit 1 as expected.
  - Attempt 2 Reviewer notification `temp invalid detached non-current different-worktree rulesDeployStatus probe`: exit 0.
  - Attempt 2 Reviewer notification `temp invalid detached non-current same-worktree rulesDeployStatus probe`: exit 1; BUG, expected exit 0 because stale same-worktree historical status must not be treated as active.
  - Attempt 3 Reviewer PASS `node --check scripts/check-superpowers-state.js`: exit 0.
  - Attempt 3 Reviewer PASS `npm run workflow:validate`: exit 0; `WORKFLOW STATE: 9 status file(s) valid`.
  - Attempt 3 Reviewer PASS `npm run workflow:check`: exit 0; `SUPERPOWERS CHECK: 9 status file(s) synced`.
  - Attempt 3 Reviewer PASS `node scripts/check-superpowers-state.js specs/068-runner-following/status.json`: exit 0; `SUPERPOWERS CHECK: 1 status file(s) synced`.
  - Attempt 3 Reviewer PASS `/private/tmp` named/current invalid rulesDeployStatus probe: exit 1.
  - Attempt 3 Reviewer PASS `/private/tmp` named/non-current historical invalid rulesDeployStatus probe: exit 0.
  - Attempt 3 Reviewer PASS `/private/tmp` detached current/active invalid rulesDeployStatus probe: exit 1.
  - Attempt 3 Reviewer PASS `/private/tmp` detached non-current different-worktree invalid rulesDeployStatus probe: exit 0.
  - Attempt 3 Reviewer PASS `/private/tmp` detached non-current same-worktree invalid rulesDeployStatus probe: exit 0.
  - Attempt 3 Reviewer PASS `git diff --check`: exit 0.
- Changed files summary:
  - `scripts/check-superpowers-state.js`: T602 attempt 3 Engineer DONE changed
    only this implementation file.
  - `specs/068-runner-following/tasks.md`,
    `specs/068-runner-following/handoff.md`, and
    `specs/068-runner-following/status.json`: workflow state sync marks T602
    completed/review_passed and unblocks T603.

### T603 - Closeout Continuation After T601/T602

- **State**: `blocked`
- **Attempt**: 1
- **Wave**: `wave-closeout-continuation`
- **Engineer**: Release Manager
- **Reviewer**: Release Reviewer
- **Dependencies**: T601 completed after Reviewer PASS; T602 completed after attempt 3 Reviewer PASS and coordinator sync.
- **Authorization boundary**: edit=yes, commit=yes, push=yes, pullRequest=yes, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=yes.

Scope:

- Continue release closeout only after T601 and T602 are reviewed.
- Record closeout commit `e09ce15daea61b7e316873422c96107806b0c4e5`, CI fix
  commit `8005a316126d79d75072ee8f55042f41887b33cd`, and E2E mapping commit
  `804d614e14ff9b49951b3fbbffa395efe412df2e` as verified local commits so
  workflow state no longer treats their files as post-verified drift.
- Recheck accidental main-workspace file cleanup state and record whether any incident remains.
- Preserve prior push, draft PR, and Firestore rules deploy evidence; record
  that E2E mapping commit `804d614` still awaits push and CI rerun.
- Update workflow state with exact closeout evidence.

Non-scope:

- No new feature implementation.
- No unreviewed E2E/tooling diff.
- No CI watch, merge, local main sync, worktree deletion, non-Firestore deploy,
  package, lockfile, dependency, migration, push, staging, commit, or guessed
  Firebase project in this state sync.

Owned files:

- `specs/068-runner-following/tasks.md`
- `specs/068-runner-following/handoff.md`
- `specs/068-runner-following/status.json`

Read-only context:

- `git status --short --branch`
- `git diff --name-only`
- T601 and T602 Engineer/Reviewer evidence.
- `specs/068-runner-following/tasks.md`
- `specs/068-runner-following/handoff.md`
- `specs/068-runner-following/status.json`

Engineer instructions:

- T601 and T602 are completed with Reviewer PASS; closeout commit
  `e09ce15daea61b7e316873422c96107806b0c4e5` exists and is the latest
  verified local closeout commit.
- Release Manager continuation committed and pushed state-only commit
  `cf8a5095ea91df97e0644dd40d2ea59e838c99ec` (`Record runner following
  closeout state`).
- CI fix commit `8005a316126d79d75072ee8f55042f41887b33cd` (`Fix profile
  serialization export`) resolved the GitHub Actions build failure caused by
  `page.jsx` exporting invalid `serializeProfile`.
- E2E mapping commit `804d614e14ff9b49951b3fbbffa395efe412df2e` (`Map runner
  following E2E setup`) is local HEAD and resolves the workflow check drift
  caused by `scripts/run-all-e2e.sh` lacking setup feature mapping for
  `068-runner-following`.
- Branch `068-runner-following` was pushed to `origin/068-runner-following`;
  final pushed status was `## 068-runner-following...origin/068-runner-following`.
- After E2E mapping commit `804d614`, branch is ahead of
  `origin/068-runner-following` by 1; push and GitHub CI rerun/watch
  authorization are the next release steps.
- Draft PR 104 was created at
  <https://github.com/victorlovescoding/dive-into-run/pull/104> with title
  `Add runner following` and draft=true.
- Firestore rules were deployed with
  `firebase deploy --only firestore:rules --project dive-into-run`; project
  `dive-into-run`, target `firestore:rules`, rules file `firestore.rules`;
  rules compiled and released to `cloud.firestore`.
- CI watch, merge, and local main sync were not authorized and were not
  performed.

Acceptance criteria:

- T601 and T602 are reviewed and completed after Reviewer PASS.
- No unreviewed dirty source/test diff remains after E2E mapping commit
  `804d614`.
- Branch relation and current head are freshly recorded.
- `lastVerifiedCommit` and `phaseCommits` account for closeout commit
  `e09ce15daea61b7e316873422c96107806b0c4e5`, CI fix commit
  `8005a316126d79d75072ee8f55042f41887b33cd`, and E2E mapping commit
  `804d614e14ff9b49951b3fbbffa395efe412df2e`.
- Commit, push, draft PR creation, and Firestore rules deploy each have
  explicit evidence and stayed inside authorization.
- E2E mapping commit `804d614` is not claimed as pushed, CI-green, merged, or
  local-main-synced.
- T603 remains blocked/ready for push, CI rerun, merge authorization, and local
  main sync authorization.

Verification commands and expected signal:

| Command | Expected signal |
| --- | --- |
| `git status --short --branch` | branch state and dirty/staged state are explicit |
| `git log -1 --format=%H%x20%s` | HEAD is `804d614e14ff9b49951b3fbbffa395efe412df2e Map runner following E2E setup` |
| `git rev-parse origin/068-runner-following` | remote tracking branch remains at `9188cabfe011319831ff50cbc872d6e6be939c5a` |
| `git rev-list --left-right --count HEAD...origin/068-runner-following` | output `1 0`; local branch is ahead one commit and not behind remote |
| `git diff --check` | exit 0 |
| `npm run workflow:validate` | exit 0 |
| `npm run workflow:check` | exit 0 |
| `node scripts/check-superpowers-state.js specs/068-runner-following/status.json` | exit 0 |

Latest run:

- `git status --short --branch`: exit 0; branch is
  `## 068-runner-following...origin/068-runner-following [ahead 1]` with only
  `status.json`, `tasks.md`, and `handoff.md` modified.
- `git log -1 --format=%H%x20%s`: exit 0;
  `804d614e14ff9b49951b3fbbffa395efe412df2e Map runner following E2E setup`.
- `git rev-parse origin/068-runner-following`: exit 0;
  `9188cabfe011319831ff50cbc872d6e6be939c5a`.
- `git rev-list --left-right --count HEAD...origin/068-runner-following`:
  exit 0; `1 0`, so local HEAD is ahead one commit and not behind remote.
- `npm run workflow:validate`: exit 0; `WORKFLOW STATE: 9 status file(s) valid`.
- `npm run workflow:check`: exit 0; `SUPERPOWERS CHECK: 9 status file(s) synced`.
- `node scripts/check-superpowers-state.js specs/068-runner-following/status.json`:
  exit 0; `SUPERPOWERS CHECK: 1 status file(s) synced`.
- `git diff --check`: exit 0; no whitespace errors.

Browser evidence requirement:

- Not applicable unless T601 changes user-visible E2E evidence requirements.

Reviewer PASS criteria:

- Closeout actions only use reviewed diffs.
- Explicit-file staging is used.
- PR/rules-deploy state is truthful and does not imply CI green, merge, or
  local main sync.
- E2E mapping commit `804d614` remains blocked/ready for push and CI rerun.

Reviewer REJECT criteria:

- Any unreviewed implementation/tooling diff is staged or committed.
- Workflow state drifts.
- Rules deploy, PR, push, CI green, merge, or local sync claims exceed evidence
  or authorization.

Evidence:

- Engineer report: BLOCKED/READY. Release Manager previously committed and
  pushed state-only commit `cf8a5095ea91df97e0644dd40d2ea59e838c99ec`,
  created draft PR 104, and deployed Firestore rules. CI fix commit
  `8005a316126d79d75072ee8f55042f41887b33cd` (`Fix profile serialization
  export`) resolved the invalid page module `serializeProfile` export build
  failure. E2E mapping commit
  `804d614e14ff9b49951b3fbbffa395efe412df2e` (`Map runner following E2E
  setup`) is now verified local HEAD and resolves
  `scripts/run-all-e2e.sh` missing setup feature mapping for
  `068-runner-following`. The E2E mapping commit is not pushed in this state
  sync; next release steps are push, GitHub CI rerun/watch authorization,
  merge authorization, and local main sync authorization.
- Reviewer report: CI fix Reviewer passed before this workflow state sync.
  This sync records state only; no push, new GitHub CI green, merge, local main
  sync, hosting/functions/storage deploy, or rules-backed production behavior
  beyond prior Firestore rules release is claimed.
- Command output summary:
  - Release Manager closeout commit
    `e09ce15daea61b7e316873422c96107806b0c4e5` included
    `scripts/check-superpowers-state.js`,
    `specs/068-runner-following/handoff.md`,
    `specs/068-runner-following/status.json`,
    `specs/068-runner-following/tasks.md`, and
    `tests/e2e/runner-following.spec.js`.
  - Post-commit `npm run workflow:check` failed because `status.json` still
    pointed `lastVerifiedCommit` at
    `37dda22eeb9f664add8cf926cde0a5b9de6291ff`, leaving
    `tests/e2e/runner-following.spec.js` in the `lastVerifiedCommit..HEAD`
    range.
  - Release Manager state-only commit
    `cf8a5095ea91df97e0644dd40d2ea59e838c99ec` (`Record runner following
    closeout state`) was pushed to `origin/068-runner-following`.
  - GitHub Actions failed because `src/app/users/[uid]/page.jsx` exported
    invalid `serializeProfile` from a page module.
  - CI fix commit `8005a316126d79d75072ee8f55042f41887b33cd` moved the helper
    out of the page module; Engineer evidence before commit: `npm run build`
    RED reproduced the original failure, then `npm run build` exit 0,
    `npm run test:branch` exit 0, `npm run lint:changed` exit 0,
    `npm run type-check:changed` exit 0, and `git diff --check` exit 0 after
    the fix.
  - Post-CI-fix commit evidence: `npm run build` exit 0,
    `npm run workflow:validate` exit 0, `npm run workflow:check` exit 1 due
    `lastVerifiedCommit` drift on the three CI fix files, and
    `git diff --check` exit 0.
  - E2E mapping commit `804d614e14ff9b49951b3fbbffa395efe412df2e` added
    `scripts/run-all-e2e.sh` mapping for `068-runner-following` to
    `tests/e2e/_setup/068-runner-following-global-setup.js` and
    `tests/e2e/runner-following.spec.js`.
  - Post-E2E-mapping commit evidence: `bash -n scripts/run-all-e2e.sh` exit
    0, `bash scripts/run-all-e2e.sh --list` exit 0 with
    `068-runner-following` mapped to the runner-following setup/spec files,
    `npm run workflow:validate` exit 0, `npm run workflow:check` exit 1 due
    `lastVerifiedCommit` drift on `scripts/run-all-e2e.sh`, and
    `git diff --check` exit 0.
  - Draft PR 104 created:
    <https://github.com/victorlovescoding/dive-into-run/pull/104>; title
    `Add runner following`; draft=true.
  - Firestore rules deploy command succeeded:
    `firebase deploy --only firestore:rules --project dive-into-run`; project
    `dive-into-run`; target `firestore:rules`; rules file `firestore.rules`;
    rules compiled and released to `cloud.firestore`.
- Changed files summary:
  - Workflow state only: `status.json`, `tasks.md`, and `handoff.md` now
    account for pushed state-only commit
    `cf8a5095ea91df97e0644dd40d2ea59e838c99ec`, draft PR 104, deployed
    Firestore rules, local CI fix commit
    `8005a316126d79d75072ee8f55042f41887b33cd`, and local E2E mapping commit
    `804d614e14ff9b49951b3fbbffa395efe412df2e` awaiting push/CI rerun.
