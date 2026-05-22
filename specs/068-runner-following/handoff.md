# Runner Following Handoff

## Current State

- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-068-runner-following`
- Branch: `068-runner-following`
- Profile: P4
- Current phase: closeout-e2e-mapping-committed-awaiting-push-ci-rerun-merge-sync.
- Active task: T603.
- Active task state: blocked/ready. T603 previously completed push, draft PR,
  and Firestore rules deploy through the earlier authorized boundary; CI fix
  commit `8005a316126d79d75072ee8f55042f41887b33cd` resolved the page export
  build failure, and E2E mapping commit
  `804d614e14ff9b49951b3fbbffa395efe412df2e` is now verified local HEAD and
  awaits push plus GitHub CI rerun/watch authorization.
- Active wave: `wave-closeout-continuation`.
- Latest reviewer decision: T602 attempt 3 `review_passed` recorded at
  `2026-05-22T13:38:29+08:00`; no findings. T602 attempt 3 Engineer DONE
  changed only `scripts/check-superpowers-state.js`. Reviewer evidence:
  `node --check scripts/check-superpowers-state.js` exit 0,
  `npm run workflow:validate` exit 0 with
  `WORKFLOW STATE: 9 status file(s) valid`, `npm run workflow:check` exit 0
  with `SUPERPOWERS CHECK: 9 status file(s) synced`, and
  `node scripts/check-superpowers-state.js specs/068-runner-following/status.json`
  exit 0 with `SUPERPOWERS CHECK: 1 status file(s) synced`. `/private/tmp`
  probes passed expected signals: named/current invalid failed exit 1,
  named/non-current historical passed exit 0, detached current/active invalid
  failed exit 1, detached non-current different-worktree passed exit 0, and
  detached non-current same-worktree passed exit 0. T601 `review_passed` at
  `2026-05-22T12:37:10+08:00`; T601 strengthened the event-detail navigation
  assertion in `tests/e2e/runner-following.spec.js` and remains limited to the
  E2E test file.
- Latest closeout recovery finding: HEAD is
  `e09ce15daea61b7e316873422c96107806b0c4e5` (`Finish runner following
  closeout`); `git rev-list --left-right --count HEAD...origin/main` reports
  `2 0`, so the branch is ahead 2 and not behind local `origin/main`. There
  was no rebase/merge in progress and nothing staged before this
  workflow-state-only update. Post-commit `npm run workflow:check` failed
  because `lastVerifiedCommit` still pointed at
  `37dda22eeb9f664add8cf926cde0a5b9de6291ff`, leaving
  `tests/e2e/runner-following.spec.js` in the `lastVerifiedCommit..HEAD`
  range; this state sync accounts for `e09ce15`.
- Latest engineer decision: T602 Workflow Checker Engineer attempt 3 DONE.
- Latest closeout decision: T603 is blocked/ready after local E2E mapping
  commit `804d614e14ff9b49951b3fbbffa395efe412df2e` (`Map runner following E2E
  setup`). The mapping fix resolves the workflow check drift caused by
  `scripts/run-all-e2e.sh` lacking setup feature mapping for
  `068-runner-following`; `bash scripts/run-all-e2e.sh --list` maps it to
  `tests/e2e/_setup/068-runner-following-global-setup.js` and
  `tests/e2e/runner-following.spec.js`. Earlier CI fix commit
  `8005a316126d79d75072ee8f55042f41887b33cd` (`Fix profile serialization
  export`) resolved the GitHub Actions build failure caused by
  `src/app/users/[uid]/page.jsx` exporting invalid `serializeProfile`.
  Mapping commit evidence before this state sync: `bash -n
  scripts/run-all-e2e.sh` exit 0, `bash scripts/run-all-e2e.sh --list` exit 0,
  `npm run workflow:validate` exit 0, `npm run workflow:check` exit 1 due
  `lastVerifiedCommit` drift on `scripts/run-all-e2e.sh`, and
  `git diff --check` exit 0. The E2E mapping commit is not pushed in this
  state sync.
- Previous closeout decision: T603 completed after Release Manager state-only
  commit `cf8a5095ea91df97e0644dd40d2ea59e838c99ec` (`Record runner following
  closeout state`) was pushed to `origin/068-runner-following`; draft PR 104
  was created at <https://github.com/victorlovescoding/dive-into-run/pull/104>
  with title `Add runner following` and draft=true; Firestore rules were
  deployed with `firebase deploy --only firestore:rules --project dive-into-run`.
  CI watch, merge, and local main sync were not authorized and were not
  performed.
- Completed tasks: T001, T002, T003, T101, T201, T202, T251, T301, T401, T501, T601, T602.
- Ready implementation task: none.
- In-progress implementation task: none.
- Engineer-done task pending review: none.
- Blocked task: T603.
- Blocked reason: E2E mapping commit `804d614` is verified local HEAD and
  awaits push plus GitHub CI rerun/watch authorization. Merge and local main
  sync remain unperformed because they were not authorized in this state sync.
- Incidents:
  - `INC-T401-profile-serialization-followers-count` resolved by T202
    Reviewer PASS and coordinator sync; retained as blocker evidence after
    T401 E2E rerun and Reviewer PASS.
  - `INC-T202-main-workspace-untracked-profile-mapper-test` resolved during
    authorized closeout cleanup. Recovery rechecked
    `/Users/chentzuyu/Desktop/dive-into-run/tests/unit/service/profile-mapper.test.js`:
    `git -C /Users/chentzuyu/Desktop/dive-into-run status --short -- tests/unit/service/profile-mapper.test.js`
    returned no entry and `test -e` exited 1, so the accidental file is still
    absent.
  - `INC-T501-lint-no-void` resolved. T401 lint fix removed the `no-void`
    blocker; this T501 retry reran `npm run lint:changed` with exit 0 and
    completed after Integration Reviewer PASS.

## Authorization Boundary

- User approved spec and authorized implementation edits on 2026-05-21 with message `spec approved，開始實作`.
- User authorized the remaining closeout tasks on 2026-05-22: cleanup the
  accidental main-workspace file, handle branch behind `origin/main`,
  commit/push/create PR, and deploy Firestore rules if the project and auth are
  unambiguous.
- edit: true.
- commit: true.
- push: true.
- pullRequest: true.
- ciWatch: false.
- merge: false.
- localMainSync: false.
- deployFirestoreRules: true.
- Firestore/storage rules deploy remains limited to Firestore rules only; do
  not guess a Firebase project.

## Head And Release State

- Current head:
  - branch: `068-runner-following`
  - commit: `804d614e14ff9b49951b3fbbffa395efe412df2e`
  - capturedAt: `2026-05-22T15:21:14+08:00`
- Remote head:
  - remote: `origin`
  - branch: `068-runner-following`
  - commit: `9188cabfe011319831ff50cbc872d6e6be939c5a`
  - capturedAt: `2026-05-22T15:21:14+08:00`
- Last verified commit: `804d614e14ff9b49951b3fbbffa395efe412df2e` for the
  local E2E mapping commit. It is not pushed in this state sync.
- Phase commits: `closeout_commit` ->
  `e09ce15daea61b7e316873422c96107806b0c4e5` (`Finish runner following
  closeout`), committed at `2026-05-22T13:46:49+08:00`; `closeout_state_push_pr_rules_deploy` ->
  `cf8a5095ea91df97e0644dd40d2ea59e838c99ec` (`Record runner following
  closeout state`), pushed to `origin/068-runner-following`; `ci_fix_commit` ->
  `8005a316126d79d75072ee8f55042f41887b33cd` (`Fix profile serialization
  export`), previously local-only before the mapping fix; `e2e_mapping_commit` ->
  `804d614e14ff9b49951b3fbbffa395efe412df2e` (`Map runner following E2E
  setup`), local ahead 1 and not pushed.
- Rules deploy status: deployed; required=true, changed=true,
  deployedCommit=`cf8a5095ea91df97e0644dd40d2ea59e838c99ec`; evidence command
  `firebase deploy --only firestore:rules --project dive-into-run` succeeded
  for project `dive-into-run`, target `firestore:rules`, rules file
  `firestore.rules`, released to `cloud.firestore`.
- Branch relation: `## 068-runner-following...origin/068-runner-following [ahead 1]`.
- Do not imply CI green, merge, local main sync, hosting/functions/storage
  deploy, or rules-backed production behavior beyond the Firestore rules
  release evidence above.

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `docs/superpowers/task-profiles.md`
4. `docs/superpowers/task-contract.md`
5. `specs/068-runner-following/handoff.md`
6. `specs/068-runner-following/tasks.md`
7. `specs/068-runner-following/status.json`
8. `specs/068-runner-following/spec.md`
9. `specs/068-runner-following/plan.md`

## Next Action

No further action is authorized in this state sync. Next human/dispatcher
decision is whether to push E2E mapping commit `804d614`, watch/rerun CI, mark
the draft PR ready if appropriate, merge, and local main sync. Do not claim CI
green, merge, local main sync, hosting/functions/storage deploy, or worktree
deletion.

## Task Graph Summary

```text
T001 completed
T002 completed
T003 completed
T101 completed
T201 completed, depends on T101
T202 completed attempt 2, depends on T201; Reviewer PASS recorded; unblocks T401
T251 completed attempt 2, depends on T201
T301 completed, depends on T251
T401 completed, depends on T301 and T202 completed; Reviewer PASS recorded
T501 completed, depends on T401; Integration Reviewer PASS recorded
T601 completed; owns tests/e2e/runner-following.spec.js; Reviewer PASS recorded
T602 completed attempt 3; attempts 1 and 2 Reviewer REJECT recorded; attempt 3 Reviewer PASS recorded
T603 blocked/ready after local E2E mapping commit 804d614; state-only commit cf8a509 was pushed, draft PR 104 was created, Firestore rules were deployed earlier, and CI fix commit 8005a31 resolved the page export build failure; E2E mapping commit awaits push and GitHub CI rerun/watch authorization; merge and local main sync were not authorized/performed
```

## Latest Verification

| Command | Exit | Evidence |
| --- | --- | --- |
| `git status --short --branch` | 0 | E2E mapping workflow sync: branch is `## 068-runner-following...origin/068-runner-following [ahead 1]` with only `status.json`, `tasks.md`, and `handoff.md` modified. |
| `git log -1 --format=%H%x20%s` | 0 | E2E mapping workflow sync: HEAD is `804d614e14ff9b49951b3fbbffa395efe412df2e Map runner following E2E setup`. |
| `git rev-parse origin/068-runner-following` | 0 | E2E mapping workflow sync: remote tracking branch remains `9188cabfe011319831ff50cbc872d6e6be939c5a`. |
| `git rev-list --left-right --count HEAD...origin/068-runner-following` | 0 | E2E mapping workflow sync: output `1 0`; local branch is ahead one commit and not behind remote. |
| `npm run workflow:validate` | 0 | E2E mapping workflow sync: `WORKFLOW STATE: 9 status file(s) valid`. |
| `npm run workflow:check` | 0 | E2E mapping workflow sync: `SUPERPOWERS CHECK: 9 status file(s) synced`. |
| `node scripts/check-superpowers-state.js specs/068-runner-following/status.json` | 0 | E2E mapping workflow sync: `SUPERPOWERS CHECK: 1 status file(s) synced`. |
| `git diff --check` | 0 | E2E mapping workflow sync: no whitespace errors. |
| `git status --short --branch` | 0 | CI fix workflow sync: branch is `## 068-runner-following...origin/068-runner-following [ahead 1]` with only `status.json`, `tasks.md`, and `handoff.md` modified. |
| `npm run workflow:validate` | 0 | CI fix workflow sync: `WORKFLOW STATE: 9 status file(s) valid`. |
| `npm run workflow:check` | 0 | CI fix workflow sync: `SUPERPOWERS CHECK: 9 status file(s) synced`. |
| `node scripts/check-superpowers-state.js specs/068-runner-following/status.json` | 0 | CI fix workflow sync: `SUPERPOWERS CHECK: 1 status file(s) synced`. |
| `git diff --check` | 0 | CI fix workflow sync: no whitespace errors. |
| `git status --short --branch` | 0 | T603 state sync: branch is `## 068-runner-following...origin/068-runner-following` with only workflow state files modified. |
| `npm run workflow:validate` | 0 | T603 state sync: `WORKFLOW STATE: 9 status file(s) valid`. |
| `npm run workflow:check` | 0 | T603 state sync: `SUPERPOWERS CHECK: 9 status file(s) synced`. |
| `node scripts/check-superpowers-state.js specs/068-runner-following/status.json` | 0 | T603 state sync: `SUPERPOWERS CHECK: 1 status file(s) synced`. |
| `git diff --check` | 0 | T603 state sync: no whitespace errors. |
| `node --check scripts/check-superpowers-state.js` | 0 | T602 attempt 3 Reviewer PASS: syntax check passed. |
| `npm run workflow:validate` | 0 | T602 attempt 3 Reviewer PASS: `WORKFLOW STATE: 9 status file(s) valid`. |
| `npm run workflow:check` | 0 | T602 attempt 3 Reviewer PASS: `SUPERPOWERS CHECK: 9 status file(s) synced`. |
| `node scripts/check-superpowers-state.js specs/068-runner-following/status.json` | 0 | T602 attempt 3 Reviewer PASS: `SUPERPOWERS CHECK: 1 status file(s) synced`. |
| `temp invalid named current rulesDeployStatus probe` | 1 | T602 attempt 3 Reviewer PASS: `/private/tmp` named/current invalid failed as expected. |
| `temp invalid named non-current rulesDeployStatus probe` | 0 | T602 attempt 3 Reviewer PASS: `/private/tmp` named/non-current historical passed. |
| `temp invalid detached current rulesDeployStatus probe` | 1 | T602 attempt 3 Reviewer PASS: `/private/tmp` detached current/active invalid failed as expected. |
| `temp invalid detached non-current different-worktree rulesDeployStatus probe` | 0 | T602 attempt 3 Reviewer PASS: `/private/tmp` detached non-current different-worktree passed. |
| `temp invalid detached non-current same-worktree rulesDeployStatus probe` | 0 | T602 attempt 3 Reviewer PASS: `/private/tmp` detached non-current same-worktree passed. |
| `git diff --check` | 0 | T602 attempt 3 Reviewer PASS: no whitespace errors. |
| `npm run workflow:validate` | 0 | T602 attempt 2 Reviewer REJECT notification: workflow validation passed. |
| `npm run workflow:check` | 0 | T602 attempt 2 Reviewer REJECT notification: workflow check passed before stale same-worktree historical false-positive was identified. |
| `node scripts/check-superpowers-state.js specs/068-runner-following/status.json` | 0 | T602 attempt 2 Reviewer REJECT notification: active runner-following status passed. |
| `git diff --check` | 0 | T602 attempt 2 Reviewer REJECT notification: no whitespace errors. |
| `temp invalid named current rulesDeployStatus probe` | 1 | T602 attempt 2 Reviewer REJECT notification: named current invalid failed as expected. |
| `temp invalid named non-current rulesDeployStatus probe` | 0 | T602 attempt 2 Reviewer REJECT notification: named non-current invalid passed. |
| `temp invalid detached current rulesDeployStatus probe` | 1 | T602 attempt 2 Reviewer REJECT notification: detached current invalid failed as expected. |
| `temp invalid detached non-current different-worktree rulesDeployStatus probe` | 0 | T602 attempt 2 Reviewer REJECT notification: detached non-current different-worktree invalid passed. |
| `temp invalid detached non-current same-worktree rulesDeployStatus probe` | 1 | T602 attempt 2 Reviewer REJECT notification: BUG, detached non-current same-worktree historical status failed with rules errors; expected exit 0. |
| `npm run workflow:validate` | 0 | T602 Reviewer REJECT notification: workflow validation passed before detached-HEAD weakness was identified. |
| `npm run workflow:check` | 0 | T602 Reviewer REJECT notification: named-branch workflow check passed, but detached-HEAD active enforcement was later shown weak. |
| `node scripts/check-superpowers-state.js specs/068-runner-following/status.json` | 0 | T602 Reviewer REJECT notification: valid active runner-following status passed. |
| `temp invalid current-branch rulesDeployStatus probe` | 1 | T602 Reviewer REJECT notification: named current-branch invalid status failed as intended. |
| `temp invalid non-current rulesDeployStatus probe` | 0 | T602 Reviewer REJECT notification: non-current historical invalid status passed as intended to avoid false positives. |
| `temp invalid detached-HEAD active rulesDeployStatus probe` | 0 | T602 Reviewer REJECT notification: BUG, detached active runner-following invalid status exited 0 while `firestore.rules` was touched; expected exit 1. |
| `git diff --check` | 0 | T602 Reviewer REJECT notification: no whitespace errors. |
| `npm run workflow:validate` | 0 | T602 Engineer: 9 status files valid. |
| `npm run workflow:check` | 0 | T602 Engineer: 9 status files synced with branch-scoped rulesDeployStatus enforcement. |
| `node scripts/check-superpowers-state.js specs/068-runner-following/status.json` | 0 | T602 Engineer: active runner-following status synced. |
| `node scripts/check-superpowers-state.js specs/homepage-landing/status.json` | 0 | T602 Engineer: unrelated historical status tolerated on non-current branch. |
| `node scripts/check-superpowers-state.js specs/weather-taiwan-md-map/status.json` | 0 | T602 Engineer: unrelated historical status tolerated on non-current branch. |
| `HEAD checker workflow check` | 1 | T602 Engineer: old checker fails only on unrelated `homepage-landing` / `weather-taiwan-md-map` rulesDeployStatus errors. |
| `temp invalid current-branch rulesDeployStatus probe` | 1 | T602 Engineer: current branch status still rejects invalid `rulesDeployStatus` when rules files are touched. |
| `git diff --check` | 0 | T602 Engineer: no whitespace errors. |
| `npm run audit:playwright-official-only` | 0 | T601 Engineer/Reviewer: Playwright official import audit passed. |
| `npm run lint:changed` | 0 | T601 Engineer/Reviewer: changed-file lint passed after keeping the fixture alias cleanup. |
| `git diff --check` | 0 | T601 Engineer/Reviewer: no whitespace errors. |
| `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"` | 0 | T601 Engineer/Reviewer: runner-following E2E emulator run passed 4 tests. |
| `node -e "JSON.parse(require('fs').readFileSync('specs/068-runner-following/status.json','utf8'))"` | 0 | Workflow State Engineer post-edit: `status.json` parsed successfully. |
| `git diff --check` | 0 | Workflow State Engineer post-edit: no whitespace errors. |
| `npm run workflow:validate` | 0 | Workflow State Engineer post-edit: 9 status files valid. |
| `npm run workflow:check` | 0 | Workflow State Engineer post-edit with current dirty checker: 9 status files synced. |
| `git rev-parse HEAD` | 0 | Recovery state check: `37dda22eeb9f664add8cf926cde0a5b9de6291ff`. |
| `git rev-list --left-right --count HEAD...origin/main` | 0 | Recovery state check: output `1 0`; branch ahead 1, not behind local `origin/main`. |
| `git diff -- tests/e2e/runner-following.spec.js` | 0 | Recovery state check: dirty E2E diff changed post-click URL assertion to `href` plus click plus existing text; T601 must review/fix. |
| `git diff -- scripts/check-superpowers-state.js` | 0 | Recovery state check: dirty checker scopes rulesDeployStatus errors to current branch; T602 must review/fix. |
| `git -C /Users/chentzuyu/Desktop/dive-into-run status --short -- tests/unit/service/profile-mapper.test.js` | 0 | Recovery state check: no entry for accidental main-workspace file. |
| `test -e /Users/chentzuyu/Desktop/dive-into-run/tests/unit/service/profile-mapper.test.js` | 1 | Recovery state check: accidental main-workspace file is absent. |
| `npm run workflow:validate` | 0 | Recovery verification before this state update: workflow files valid. |
| `npm run workflow:check` | 0 | Recovery verification with current dirty checker: workflow files synced. |
| `git diff --check` | 0 | Recovery verification before this state update: no whitespace errors. |
| `HEAD checker workflow check` | 1 | Recovery verification: HEAD checker fails on unrelated `homepage-landing` / `weather-taiwan-md-map` rulesDeployStatus errors, confirming dirty checker affects result. |
| `git diff --check` | 0 | Integration Reviewer PASS: no whitespace errors. |
| `npm run workflow:validate` | 0 | Integration Reviewer PASS: workflow state valid. |
| `npm run workflow:check` | 0 | Integration Reviewer PASS: workflow state synced. |
| `ls -d /private/tmp/t201-profile-browser-evidence-emulator /private/tmp/t251-member-following-browser-evidence-attempt2 /private/tmp/t301-event-host-follow-browser-evidence /private/tmp/t401-runner-following-e2e-evidence` | 0 | Integration Reviewer PASS: T201, T251 attempt 2, T301, and T401 browser evidence directories exist. |
| `git rev-list --left-right --count HEAD...origin/main` | 0 | Integration Reviewer PASS: output `0 13`; branch behind `origin/main` by 13. |
| `git diff --name-only --cached` | 0 | Integration Reviewer PASS: empty; nothing staged. |
| `git status --short --branch` | 0 | Integration Reviewer PASS: branch behind `origin/main` by 13; dirty/untracked worktree as expected. |
| `git diff --check` | 0 | T501 final integration retry: no whitespace errors. |
| `npm run workflow:validate` | 0 | T501 final integration retry: seven status files valid. |
| `npm run workflow:check` | 0 | T501 final integration retry: seven status files synced. |
| `npm run lint:changed` | 0 | T501 final integration retry: changed-file lint passed. |
| `npm run type-check:changed` | 0 | T501 final integration retry: no type errors in changed files. |
| `npm run test:branch` | 0 | T501 final integration retry: browser vitest 8 files / 81 tests passed; server vitest 6 files / 96 tests passed. |
| `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js` | 0 | T501 final integration retry: 2 files / 31 tests passed. |
| `npm run audit:use-effect-data-fetching` | 0 | T501 final integration retry: 0 findings. |
| `npm run audit:playwright-official-only` | 0 | T501 final integration retry: 0 findings. |
| `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"` | 0 | T501 final integration retry: Playwright emulator E2E 4 passed. |
| `ls /private/tmp/t201-profile-browser-evidence-emulator /private/tmp/t251-member-following-browser-evidence-attempt2 /private/tmp/t301-event-host-follow-browser-evidence /private/tmp/t401-runner-following-e2e-evidence` | 0 | T501 final integration retry: T201, T251 attempt 2, T301, and T401 browser evidence artifact directories exist. |
| `npx vitest run --project=browser tests/unit/service/profile-mapper.test.js tests/integration/profile/ProfilePage.test.jsx tests/integration/profile/ProfileClient.test.jsx` | 1 | T202 attempt 2 RED: mapper result missed `followersCount: 12` in profile-mapper test. |
| `npx vitest run --project=browser tests/unit/service/profile-mapper.test.js tests/integration/profile/ProfilePage.test.jsx tests/integration/profile/ProfileClient.test.jsx` | 0 | T202 attempt 2 GREEN: 3 files / 15 tests passed. |
| `npm run lint:changed` | 0 | T202 attempt 2 changed-file lint passed. |
| `npm run type-check:changed` | 0 | T202 attempt 2 changed-file type-check passed. |
| `git diff --check` | 0 | T202 attempt 2 no whitespace errors. |
| `node -e "JSON.parse(require('fs').readFileSync('specs/068-runner-following/status.json','utf8'))"` | 0 | T202 workflow rework update: `status.json` parsed after setting T202 ready attempt 2. |
| `git diff --check` | 0 | T202 workflow rework update: no whitespace errors. |
| `npm run workflow:validate` | 0 | T202 workflow rework update: seven status files valid. |
| `npm run workflow:check` | 0 | T202 workflow rework update: seven status files synced. |
| `git diff --check` | 0 | No whitespace errors. |
| `node -e "JSON.parse(require('fs').readFileSync('specs/068-runner-following/status.json','utf8'))"` | 0 | status.json parsed successfully. |
| `npm run workflow:validate` | 0 | Seven status files valid. |
| `npm run workflow:check` | 0 | Seven status files synced. |
| `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js` | 1 then 0 | Attempt 3 RED showed standalone `followingCount` exploit still succeeded before fix; GREEN passed 30 tests after fix. |
| `npx vitest run --project=browser tests/unit/service/follow-service.test.js tests/unit/runtime/follow-use-cases.test.js tests/unit/lib/notification-helpers.test.js` | 0 | Attempt 3 passed 28 tests. |
| `npm run lint:changed` | 0 | Attempt 3 changed-file lint passed. |
| `npm run type-check:changed` | 0 | Attempt 3 changed-file type-check passed. |
| `git diff --check` | 0 | Attempt 3 no whitespace errors. |
| `npm run test:server -- tests/server/rules/users.rules.test.js tests/server/rules/notifications.rules.test.js` | 1 then 0 | Attempt 4 RED showed create-path count injection succeeded before fix; GREEN passed 31 tests after fix. |
| `npx vitest run --project=browser tests/unit/service/follow-service.test.js tests/unit/runtime/follow-use-cases.test.js tests/unit/lib/notification-helpers.test.js` | 0 | Attempt 4 passed 28 tests. |
| `npm run lint:changed` | 0 | Attempt 4 changed-file lint passed. |
| `npm run type-check:changed` | 0 | Attempt 4 changed-file type-check passed. |
| `git diff --check` | 0 | Attempt 4 no whitespace errors. |
| `npx vitest run --project=browser tests/unit/runtime/useProfileRuntime.test.jsx tests/integration/profile/ProfileClient.test.jsx tests/integration/profile/ProfileStats.test.jsx tests/integration/profile/ProfileHeader.test.jsx` | 0 | T201 Profile Engineer GREEN after UI-label fix: 4 files / 35 tests passed. |
| `npm run audit:use-effect-data-fetching` | 0 | T201 Profile Engineer audit passed. |
| `npm run lint:changed` | 0 | T201 Profile Engineer changed-file lint passed; React version warning only. |
| `npm run type-check:changed` | 0 | T201 Profile Engineer changed-file type-check passed. |
| `/private/tmp/t201-profile-evidence.mjs` | 0 | T201 browser evidence passed after UI-label fix and emulator follow-state reset. Screenshots in `/private/tmp/t201-profile-browser-evidence-emulator/`. |
| `npx vitest run --project=browser tests/unit/runtime/useProfileRuntime.test.jsx tests/integration/profile/ProfileClient.test.jsx tests/integration/profile/ProfileStats.test.jsx tests/integration/profile/ProfileHeader.test.jsx` | 0 | T201 Profile Reviewer: 4 files / 35 tests passed. |
| `npm run audit:use-effect-data-fetching` | 0 | T201 Profile Reviewer audit passed. |
| `npm run lint:changed` | 0 | T201 Profile Reviewer changed-file lint passed; React version warning only. |
| `npm run type-check:changed` | 0 | T201 Profile Reviewer changed-file type-check passed. |
| `node /private/tmp/t201-profile-evidence.mjs` | 0 | T201 Profile Reviewer escalated browser evidence rerun passed; sandbox attempt had failed with Chromium MachPort permission. |
| `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx` | 1 | T251 RED failures covered missing `我的追蹤跑友` member entry, following screen heading/guard/rows, runtime state/unfollow behavior. |
| `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx` | 0 | T251 GREEN passed 3 files / 12 tests. |
| `npm run audit:use-effect-data-fetching` | 0 | T251 audit passed with 0 findings. |
| `npm run lint:changed` | 0 | T251 changed-file lint passed. |
| `npm run type-check:changed` | 0 | T251 changed-file type-check passed. |
| `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx` | 0 | T251 Reviewer: 3 files / 12 tests passed. |
| `npm run audit:use-effect-data-fetching` | 0 | T251 Reviewer audit passed with 0 findings. |
| `npm run lint:changed` | 0 | T251 Reviewer changed-file lint passed; React eslint settings warning only. |
| `npm run type-check:changed` | 0 | T251 Reviewer changed-file type-check passed. |
| `browser evidence JSON/screenshots validation via jq/file` | 0 | T251 Reviewer validated JSON and screenshot artifacts. |
| `git status --short --branch` | 0 | Browser evidence preflight captured branch/dirty state. |
| `sandbox localhost curl probes 3001/8080/9099/9199` | 7 | Sandbox probes failed; escalated probes verified required services. |
| `Firebase emulator start attempt` | 1 | Ports already occupied, so existing emulator services were used. |
| `Auth sign-in probe` | 0 | HTTP 200 for uid `796E9eCnaA6Hd4qTAKuE9RHDTDA5`. |
| `Playwright evidence script first run` | 1 | Temp-script locator strictness hit Next route announcer. |
| `Corrected Playwright evidence script rerun` | 0 | Browser evidence completed successfully. |
| `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx` | 0 | T251 attempt 2 Fix Engineer: 3 files / 12 tests passed. |
| `npm run audit:use-effect-data-fetching` | 0 | T251 attempt 2 Fix Engineer: 0 findings. |
| `npm run lint:changed` | 0 | T251 attempt 2 Fix Engineer: changed-file lint passed; React version warning only. |
| `npm run type-check:changed` | 0 | T251 attempt 2 Fix Engineer: changed-file type-check passed. |
| `T251 attempt 2 browser evidence sandbox run` | 1 | Localhost fetch blocked. |
| `T251 attempt 2 browser evidence escalated rerun` | 0 | DONE; result JSON at `/private/tmp/t251-member-following-browser-evidence-attempt2/t251-browser-evidence-results.json`, screenshots in `/private/tmp/t251-member-following-browser-evidence-attempt2/`. |
| `npx vitest run --project=browser tests/unit/runtime/useMemberFollowingRuntime.test.jsx tests/integration/member/MemberFollowingPage.test.jsx tests/integration/member/MemberFavoritesPage.test.jsx` | 0 | T251 attempt 2 Reviewer: 3 files / 12 tests passed. |
| `npm run audit:use-effect-data-fetching` | 0 | T251 attempt 2 Reviewer: 0 findings. |
| `npm run lint:changed` | 0 | T251 attempt 2 Reviewer: changed-file lint passed; React version warning only. |
| `npm run type-check:changed` | 0 | T251 attempt 2 Reviewer: changed-file type-check passed. |
| `jq . /private/tmp/t251-member-following-browser-evidence-attempt2/t251-browser-evidence-results.json` | 0 | T251 attempt 2 Reviewer: status DONE, expected desktop/mobile signals present, no HTTP errors. |
| `sips -g pixelWidth -g pixelHeight /private/tmp/t251-member-following-browser-evidence-attempt2/*.png` | 0 | T251 attempt 2 Reviewer: 8 screenshots with expected desktop/mobile dimensions. |
| `npx vitest run --project=browser tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/runtime/useEventDetailRuntime.test.jsx tests/integration/events/EventHostFollow.test.jsx tests/integration/events/ParticipantsModal.test.jsx` | 0 | T301 Events Engineer GREEN: 4 files / 38 tests passed. Clean RED unavailable because the replacement inherited partial diff with tests and implementation already present; no reverse revert was performed. |
| `npm run audit:use-effect-data-fetching` | 0 | T301 Events Engineer audit passed. |
| `npm run lint:changed` | 0 | T301 Events Engineer changed-file lint passed; existing React settings warning only. |
| `npm run type-check:changed` | 0 | T301 Events Engineer changed-file type-check passed. |
| `npx vitest run --project=browser tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/runtime/useEventDetailRuntime.test.jsx tests/integration/events/EventHostFollow.test.jsx tests/integration/events/ParticipantsModal.test.jsx` | 0 | T301 Events Reviewer: 4 files / 38 tests passed. |
| `npm run audit:use-effect-data-fetching` | 0 | T301 Events Reviewer audit passed. |
| `npm run lint:changed` | 0 | T301 Events Reviewer changed-file lint passed; existing React settings warning only. |
| `npm run type-check:changed` | 0 | T301 Events Reviewer changed-file type-check passed. |
| `git diff --check -- <T301 files>` | 0 | T301 Events Reviewer checked T301 owned files; no whitespace errors. |
| `browser evidence JSON/screenshots/logs inspection` | 0 | T301 Events Reviewer inspected existing evidence; no app HTTP 4xx/5xx found and screenshots matched list/detail/participants/signed-out coverage. |
| `npm run audit:playwright-official-only` | 0 | T401 Verification Debugger: Playwright import audit passed. |
| `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"` | 1 | T401 Verification Debugger reached UI assertion at `tests/e2e/runner-following.spec.js:179`; expected `1 位追蹤者`, actual profile page snapshot showed `0 位追蹤者`, `1 位追蹤中`; `1 failed, 3 did not run`. |
| `git diff --check` | 0 | T401 Verification Debugger: no whitespace errors. |
| `npm run audit:playwright-official-only` | 0 | T401 E2E Engineer DONE: Playwright official import audit passed. |
| `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"` | 0 | T401 E2E Engineer DONE: 4 passed. |
| `git diff --check` | 0 | T401 E2E Engineer DONE: no whitespace errors. |
| `npm run audit:playwright-official-only` | 0 | T401 Reviewer PASS: 0 findings. |
| `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"` | 0 | T401 Reviewer PASS: 4 passed. |
| `git diff --check` | 0 | T401 Reviewer PASS: no whitespace errors. |
| `npx vitest run --project=browser tests/integration/profile/ProfilePage.test.jsx` | 1 then 0 | T202 attempt 1 RED showed serialized profile missing `followersCount: 1`; GREEN passed 1 test after page serializer fix. |
| `npx vitest run --project=browser tests/integration/profile/ProfilePage.test.jsx tests/integration/profile/ProfileClient.test.jsx` | 0 | T202 attempt 1 focused profile integration checks passed 13 tests. |
| `npm run type-check:changed` | 0 | T202 attempt 1 changed-file type-check passed. |
| `git diff --check` | 0 | T202 attempt 1 no whitespace errors. |
| `npm run lint:changed` | 1 | T202 attempt 1 blocked by non-owned T401 file `tests/e2e/runner-following.spec.js:145` `no-empty-pattern`. |

T401 blocker evidence:

- T401 E2E Engineer created/changed only:
  `tests/e2e/_setup/068-runner-following-global-setup.js`,
  `tests/e2e/runner-following.spec.js`, and
  `playwright.emulator.config.mjs`.
- Verification Debugger changed no T401, production, test, or workflow files
  and performed no stage, commit, or push.
- Root cause claim from T401: seed gave target `followersCount: 1`, but the
  profile page count path dropped it before `ProfileClient`, so
  `useProfileRuntime()` received undefined and normalized followers to 0.
- T202 attempt 1 narrowed that to two remaining rework items: page
  `serializeProfile()` now preserves numeric `followersCount`, but
  `src/service/profile-mapper.js` still needs to map Firestore
  `followersCount` into `PublicProfile`, and `npm run lint:changed` is still
  blocked by the T401-owned `no-empty-pattern` lint error.
- Process cleanup evidence: initial occupied ports were 9099 PID 27217 `node`,
  9199 PID 27217 `node`, 8080 PID 27522 `java`, and 3000 no listener. Both
  process cwd values were this worktree; PID 27522 was the Firestore emulator
  jar. Cleanup killed only PID 27217 with escalation; PID 27522 stopped with
  its parent. After E2E, 9099/8080/9199/3000 had no listener.

T201 browser evidence includes signed-out desktop/mobile, signed-out following
modal, signed-in follow/unfollow, and signed-in self-profile hidden follow
control. Console/network residual was expected emulator warnings plus aborted
Firestore long-poll requests during browser close.
Reviewer residual risk: no dedicated failed-unfollow rollback test, though the
source path is shared and inspected; derived following count may briefly show
`0` before async count resolves.

T251 browser evidence artifacts:

- `/private/tmp/t251-member-following-browser-evidence/t251-browser-evidence-results.json`
- `/private/tmp/t251-member-following-browser-evidence/signed-out-member-following-desktop-1440x900.png`
- `/private/tmp/t251-member-following-browser-evidence/signed-in-member-desktop-1440x900.png`
- `/private/tmp/t251-member-following-browser-evidence/signed-in-member-following-before-unfollow-desktop-1440x900.png`
- `/private/tmp/t251-member-following-browser-evidence/signed-in-member-following-after-unfollow-desktop-1440x900.png`
- `/private/tmp/t251-member-following-browser-evidence/signed-out-member-following-mobile-390x844.png`
- `/private/tmp/t251-member-following-browser-evidence/signed-in-member-mobile-390x844.png`
- `/private/tmp/t251-member-following-browser-evidence/signed-in-member-following-before-unfollow-mobile-390x844.png`
- `/private/tmp/t251-member-following-browser-evidence/signed-in-member-following-after-unfollow-mobile-390x844.png`

T251 attempt 2 browser evidence artifacts:

- `/private/tmp/t251-member-following-browser-evidence-attempt2/t251-browser-evidence-results.json`
- Screenshots dir: `/private/tmp/t251-member-following-browser-evidence-attempt2/`

T251 browser expected versus actual:

- `/member` signed-in: `我的追蹤跑友` link present with href `/member/following` on desktop/mobile; navigation landed on `/member/following`.
- `/member/following` signed-in: heading `我的追蹤跑友` visible on desktop/mobile; rows included `t251-runner-a` and `t251-runner-b` linking to `/users/t251-runner-a` and `/users/t251-runner-b`.
- Unfollow changed rows from 2 to 1; `T251 Runner Alpha` disappeared after action.
- Signed-out direct `/member/following`: guard `請先登入以管理追蹤跑友`; management rows 0, unfollow buttons 0.
- Browser residual: console warnings were emulator connection and Next image LCP for `/default-avatar.png`; failed requests were Firestore Listen/channel `net::ERR_ABORTED` and `/member/following?_rsc=zzibr` `net::ERR_ABORTED`; HTTP >=400 responses: 0.
- Browser evidence subagent edited, staged, committed, and pushed no repo files.

T251 Reviewer rejection:

- `src/app/member/page.jsx` currently puts the `我的追蹤跑友` UI link directly
  in the route/composition layer.
- Existing member management pattern keeps UI links in the render-only screen;
  `src/ui/member/MemberPageScreen.jsx` owns `我的收藏`.
- Attempt 2 fix expectation: move the following entry beside `我的收藏` in
  `src/ui/member/MemberPageScreen.jsx`.
- Residual: no functional failures for guard, profile links, shared unfollow
  path, optimistic remove, rollback, or toast.

T251 attempt 2 Fix Engineer result:

- Changed file: `src/ui/member/MemberPageScreen.jsx`.
- `/member/following` 的 `我的追蹤跑友` entry 已移到 render-only
  `MemberPageScreen`，緊鄰既有 `我的收藏`。
- `src/app/member/page.jsx` 回到 thin route；final diff 中已無 route-level
  UI link。
- Signed-out 仍不會看到 member management links。
- Browser signals: `memberEntryLinkHref: /member/following`, signed-out guard
  text, desktop/mobile rows before/after unfollow。
- Browser residual: local emulator / Next image LCP warnings and aborted
  long-poll/RSC requests; no HTTP errors.

T251 attempt 2 Reviewer PASS:

- Decision: `review_passed` at `2026-05-22T04:18:11+08:00`; findings: none.
- Acceptance checked: signed-in entry, signed-out guard, profile links, shared
  `unfollowRunner` path, optimistic remove, rollback, and error toast are all
  present.
- Residual risk: browser evidence was validated, not rerun; branch is behind
  `origin/main` by 3 commits and worktree contains T101/T201 diffs, ignored
  per scope; browser evidence still has emulator/LCP warnings and aborted
  long-poll/RSC requests, but no HTTP errors.

T301 Events Engineer result:

- State: `completed`; T301 Events Reviewer passed.
- Changed files:
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
- Forbidden surfaces: participants/comments no follow buttons; posts untouched.
- Browser evidence JSON:
  `/private/tmp/t301-event-host-follow-browser-evidence/browser-evidence.json`
- Browser screenshots:
  `/private/tmp/t301-event-host-follow-browser-evidence/*.png`
- Browser coverage: desktop 1440x900 and mobile 390x844 for `/events`
  signed-out hidden controls, signed-in non-self list follow/unfollow,
  signed-in non-self detail follow/unfollow, self-hosted hidden control,
  participants profile links only with no follow buttons, and comments profile
  link with no follow buttons.
- Browser residual: console warnings only `Connecting to Firebase Emulators...`;
  no app HTTP 4xx/5xx observed in Next logs. Playwright recorded Firestore
  emulator Listen/Write `net::ERR_ABORTED` during page navigation/context
  close, while assertions still passed.
- Engineer changed no workflow files and performed no staging, commit, push, or
  PR.

T301 Events Reviewer PASS:

- Decision: `review_passed` at `2026-05-22T06:42:20+08:00`; findings: none.
- Diff checked: T301 owned files only, including new
  `tests/integration/events/EventHostFollow.test.jsx`; shared read-only
  verification covered `src/components/FollowButton.jsx` and
  `src/runtime/client/use-cases/follow-use-cases.js`; no post files matched in
  the changed file list.
- Commands: event host/follow Vitest suite exit 0 with 4 files / 38 tests
  passed; `npm run audit:use-effect-data-fetching` exit 0;
  `npm run lint:changed` exit 0 with existing React settings warning only;
  `npm run type-check:changed` exit 0; `git diff --check -- <T301 files>`
  exit 0.
- Browser evidence JSON/screenshots/logs inspected; no app HTTP 4xx/5xx found.
  Screenshot sample matched list/detail/participants/signed-out coverage.
- Residual risk: browser flow was validated from existing evidence, not rerun.
  Explorer subagent could not start because thread limit was reached, so review
  was completed by the Reviewer directly.

T202 attempt 2 Profile Serialization Reviewer result:

- State: `completed`; Reviewer PASS recorded at
  `2026-05-22T07:48:24+08:00`.
- Diff checked:
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
- Commands: focused profile Vitest command exit 0 with 3 files / 15 tests
  passed; `npm run lint:changed` exit 0; `npm run type-check:changed` exit 0;
  `git diff --check` exit 0.
- Residual: non-T202 dirty files ignored per scope;
  `tests/e2e/runner-following.spec.js` is untracked as a T401 file, so git
  cannot prove pre/post T202 delta directly; current line 145 matches lint
  cleanup.
- Changed target worktree files:
  - `src/service/profile-mapper.js`
  - `tests/unit/service/profile-mapper.test.js`
  - `tests/e2e/runner-following.spec.js`
  - preserved attempt 1 files: `src/app/users/[uid]/page.jsx`,
    `tests/integration/profile/ProfilePage.test.jsx`
- Fix summary:
  - Mapper now includes optional `followersCount` in `PublicProfile` and maps
    it only when Firestore data is a number.
  - `followingCount` remains omitted.
  - Page serialization attempt 1 path preserved: numeric `followersCount`
    crosses RSC serialization; `followingCount` is not serialized.
  - E2E lint-only cleanup changed `test.afterEach(({}, testInfo) => ...)` to
    `test.afterEach((_, testInfo) => ...)`; no E2E assertions or behavior
    changed.
- Residual incident: accidental untracked copy remains at
  `/Users/chentzuyu/Desktop/dive-into-run/tests/unit/service/profile-mapper.test.js`;
  cleanup needs explicit user approval or separate cleanup authorization.

T401 E2E Engineer DONE:

- State: `completed`; T401 Reviewer PASS recorded.
- Changed T401 owned file this resume round:
  `tests/e2e/runner-following.spec.js`.
- Existing T401 owned files from earlier:
  `tests/e2e/_setup/068-runner-following-global-setup.js`,
  `tests/e2e/runner-following.spec.js`, and
  `playwright.emulator.config.mjs`.
- Change summary:
  - Fixed Playwright hook fixture parameter.
  - Avoided `waitForText` / route announcer strict locator collision.
  - Fixed participants dialog locator because actual dialog exists but has no
    accessible name.
- Verification:
  - `npm run audit:playwright-official-only`: exit 0.
  - `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"`:
    exit 0, 4 passed.
  - `git diff --check`: exit 0.
- E2E coverage passed: signed-out profile counts/list no follow button,
  signed-in profile follow/unfollow, member `我的追蹤跑友` list/unfollow,
  event list/detail host follow, follow notification navigation, and forbidden
  controls absent.
- Evidence:
  - `/private/tmp/t401-runner-following-e2e-evidence/browser-evidence.json`
  - `/private/tmp/t401-runner-following-e2e-evidence/*.png`
  - `test-results/.last-run.json` shows passed.
- Process cleanup: no manual kill; Firebase emulators shutdown via
  `emulators:exec`.
- Residual risk: Next multiple lockfiles warning; browser evidence has common
  emulator/navigation `net::ERR_ABORTED`; `httpErrors` / `appHttpErrors`
  empty.
- No stage, commit, push, or PR.

T401 E2E Reviewer PASS:

- Decision: `review_passed` at `2026-05-22T08:10:16+08:00`.
- Findings: none.
- Diff checked:
  `tests/e2e/_setup/068-runner-following-global-setup.js`,
  `tests/e2e/runner-following.spec.js`, and
  `playwright.emulator.config.mjs`.
- Commands:
  - `npm run audit:playwright-official-only`: exit 0, 0 findings.
  - `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=068-runner-following npm run test:e2e:emulator"`:
    exit 0, 4 passed.
  - `git diff --check`: exit 0.
- Evidence:
  `/private/tmp/t401-runner-following-e2e-evidence/browser-evidence.json`
  DONE, failure null, 13 signals, `appHttpErrors` empty; 13 PNG screenshots
  present with sampled profile, notification, member following, event
  list/detail/participants; `test-results/.last-run.json` status passed.
- Residual risk: Next multiple lockfiles warning remains; browser evidence has
  Firestore channel/RSC navigation `net::ERR_ABORTED` but HTTP errors are empty
  and E2E is green; event list self-host follow control check is whole-page
  button count, not scoped card, acceptable but weaker.

## Stop Conditions

- Stop if CI watch, merge, local main sync, worktree deletion, or any
  non-Firestore deploy is requested without an explicit matching authorization
  boundary.
- Stop if a new dependency, package lockfile change, data migration, secret,
  destructive operation, or irreversible action appears.
- Stop if Firestore rules deploy cannot identify a single project or Firebase
  auth does not work.
- Stop if `tasks.md`, `status.json`, and this handoff drift.
- Stop if rules-backed production behavior is claimed without deploy evidence.

## Pitfalls

- The current approved v1 scope includes public follower/following modal lists and a signed-in member/dashboard `我的追蹤跑友` following management page.
- The member following page should follow existing member favorites list-management patterns; row-level unfollow is acceptable when implemented through shared follow use-cases with rollback/error handling.
- Event comments, event participant list rows, follower/following modal rows, post list posters, and post detail posters must not get follow buttons.
- Public list reads include unauthenticated visitors; writes do not.
- Public profile and member surfaces must consume derived following count/list
  data; no UI/runtime path should depend on `users/{uid}.followingCount`.
- Public profile page serialization must preserve `users/{uid}.followersCount`
  into `ProfileClient`; otherwise E2E seed data renders `0 位追蹤者` despite a
  target seed of `followersCount: 1`.
- Follow notification text must stay exactly `X 已開始追蹤你。`.
- Unfollow then refollow notifies again; repeated follow while already following is idempotent and does not duplicate notification.
