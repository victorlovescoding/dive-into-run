# Runner Following Handoff

## Current State

- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-068-runner-following`
- Branch: `068-runner-following`
- Profile: P4
- Current phase: Authorization expanded pending commit.
- Active task: none.
- Active task state: none; all planned tasks are completed.
- Active wave: none.
- Latest reviewer decision: T501 `review_passed` at
  `2026-05-22T08:40:51+08:00`; findings: none blocking. Evidence checked:
  T501 was active and `engineer_done`, T101/T201/T202/T251/T301/T401 were all
  completed with `review_passed`, final verification rows were exit 0,
  handoff release boundaries were explicit, and browser evidence dirs existed
  for T201/T251/T301/T401. Reviewer commands passed:
  `git diff --check`, `npm run workflow:validate`,
  `npm run workflow:check`,
  `ls -d /private/tmp/t201-profile-browser-evidence-emulator /private/tmp/t251-member-following-browser-evidence-attempt2 /private/tmp/t301-event-host-follow-browser-evidence /private/tmp/t401-runner-following-e2e-evidence`,
  `git rev-list --left-right --count HEAD...origin/main` output `0 13`,
  `git diff --name-only --cached` empty, and
  `git status --short --branch` showed branch behind `origin/main` by 13 with
  dirty/untracked worktree as expected.
- Latest engineer decision: T401 E2E Engineer DONE. This resume round changed
  `tests/e2e/runner-following.spec.js`. Existing T401 owned files are
  `tests/e2e/_setup/068-runner-following-global-setup.js`,
  `tests/e2e/runner-following.spec.js`, and
  `playwright.emulator.config.mjs`. Fixes: Playwright hook fixture parameter,
  `waitForText` / route announcer strict locator collision, and participants
  dialog locator for an unnamed dialog.
- Latest engineer decision: T501 Final Integration Verifier retry reported
  `engineer_done` at `2026-05-22T08:30:01+08:00`; all required final
  verification commands passed. T501 is completed after Integration Reviewer
  PASS.
- Latest blocker decision: none for T501; prior `INC-T501-lint-no-void` is
  resolved by the T401 lint fix and this retry's `npm run lint:changed` exit 0.
- Completed tasks: T001, T002, T003, T101, T201, T202, T251, T301, T401, T501.
- Ready implementation task: none.
- In-progress implementation task: none.
- Engineer-done task pending review: none.
- Blocked task: none.
- Blocked reason: none.
- Incidents:
  - `INC-T401-profile-serialization-followers-count` resolved by T202
    Reviewer PASS and coordinator sync; retained as blocker evidence after
    T401 E2E rerun and Reviewer PASS.
  - `INC-T202-main-workspace-untracked-profile-mapper-test` resolved during
    authorized closeout cleanup. The file was verified untracked in the main
    workspace, `diff -q` matched the feature worktree test file, and
    `git clean -f -- tests/unit/service/profile-mapper.test.js` removed only
    that exact path. Follow-up status showed no remaining entry for the file.
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
  - commit: `7ad004ee405b8485adeb9ca7ae5f19cd77cddb54`
  - capturedAt: `2026-05-22T11:38:27+08:00`
- Remote head:
  - remote: `origin`
  - branch: `main`
  - commit: `d77bcbab497e749dcb37fd282636e2d9b855f61e`
  - capturedAt: `2026-05-22T08:40:51+08:00`
- Last verified commit: null.
- Phase commits: none.
- Rules deploy status: required; required=true, changed=true, evidence empty, deployedCommit=null.
- Branch relation: `068-runner-following` is behind `origin/main` by 13 commits
  (`git rev-list --left-right --count HEAD...origin/main` -> `0 13`).
- Do not imply deployed rules or rules-backed production behavior.

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

Proceed within the authorized boundary: explicit-file staging, commit, fetch
and rebase onto `origin/main` if needed, rerun closeout verification, push,
create a draft PR, and deploy only Firestore rules if the Firebase project and
auth are unambiguous. Do not watch CI, merge, sync local `main`, delete the
worktree, or deploy any non-Firestore target.

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
```

## Latest Verification

| Command | Exit | Evidence |
| --- | --- | --- |
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
