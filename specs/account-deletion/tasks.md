# Account Deletion Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/account-deletion/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`, this file, and `status.json` before dispatching work.
- Command evidence is one command per entry. Do not combine commands with shell chain operators.
- Final summaries must not imply deployed Firestore/storage rules, deployed Functions, or deployed product behavior.
- Workflow drift was found on 2026-05-27 and reconciled without Reviewer PASS.

## Current State

- Active task: none; T001-T007 are completed after Reviewer PASS.
- T006 attempt 1 Reviewer decision: `review_rejected` at 2026-05-27T18:04:39Z.
- T006 attempt 2 Reviewer decision: `review_passed` at 2026-05-27T18:14:25Z.
- `completedTasks`: T001, T002, T003, T004, T005, T006, T007.
- T007 attempt 1 resolved both blockers: the earlier `tests/unit/config` lint blocker was resolved by moving the test to `tests/server/firestore`, and the focused server Vitest blocker was resolved by using the server/firestore setup contract with emulator env variables.
- T007 attempt 1 Reviewer decision: `review_rejected` only because workflow state incorrectly recorded `commit=false` despite user commit authorization; no implementation defect was reported. Attempt 2 Reviewer decision: `review_passed`; no findings.
- T007 Firestore index deploy: `firebase deploy --only firestore:indexes --project dive-into-run` exited 0 at 2026-05-28T11:49:32Z; Firebase CLI reported indexes in `firestore.indexes.json` deployed successfully for the `(default)` database. No rules/functions deploy was run.
- T001-T005 are completed by integrated Reviewer PASS over the full account deletion dirty diff after T006 attempt 2.

## Task Summary

| Task | State | Reviewer decision | Notes |
| ---- | ----- | ----------------- | ----- |
| T001 | `completed` | `review_passed` | Covered by integrated Reviewer PASS after T006 attempt 2. |
| T002 | `completed` | `review_passed` | Covered by integrated Reviewer PASS after T006 attempt 2. |
| T003 | `completed` | `review_passed` | Covered by integrated Reviewer PASS after T006 attempt 2. |
| T004 | `completed` | `review_passed` | Covered by integrated Reviewer PASS after T006 attempt 2. |
| T005 | `completed` | `review_passed` | Covered by integrated Reviewer PASS after T006 attempt 2. |
| T006 | `completed` | `review_passed` | Attempt 1 rejected; attempt 2 fixed both rejection defects and passed Reviewer. |
| T007 | `completed` | `review_passed` | Local index config/test fix reviewed; focused server Vitest passes with required emulator env; auth boundary corrected; Firebase index deploy completed during release closeout. |

## T007 - Firestore Comments Author Index Follow-up

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-7`
- **Engineer**: Codex Engineer
- **Reviewer**: Codex Reviewer; attempt 2 `review_passed` with no findings.
- **Authorization boundary**: edit=yes, commit=yes, push=yes, pullRequest=yes, ciWatch=yes, merge=yes, localMainSync=yes, Firebase deploy authorization=yes for `firestore:indexes` only; no rules/functions deploy was run.
- **Index deploy status**: deployed. `firebase deploy --only firestore:indexes --project dive-into-run` exited 0 at 2026-05-28T11:49:32Z and reported the `(default)` database indexes deployed successfully.

Scope:

- Fix the Firestore missing-index root cause for `adminDb.collectionGroup('comments').where('authorUid', '==', uid)`.
- Add the `comments.authorUid` single-field collection-group ASC field override to `firestore.indexes.json`.
- Add a focused Vitest static regression test at `tests/server/firestore/firestore-indexes.test.js` that parses `firestore.indexes.json` as JSON and asserts the exact field override.
- Record the production incident/root cause, T007 authorization boundary, blocker history, and index deploy evidence.

Non-scope:

- No API route error handling, OAuth/provider selection, frontend UI/toast, account deletion repo query-shape, rules, functions, migration, retention/finalizer behavior, dependency, push, PR, CI watch, merge, local main sync, or Firebase deploy changes.
- Do not modify unrelated untracked `specs/account-deletion-index-error/*` scratch files.

Production incident/root cause:

- Manual Chrome flow selected `Crawler Mr. / mrcrawler987@gmail.com` twice after pressing `重新驗證並刪除`.
- App returned to `/member`, did not enter the pending deletion gate, and console showed `Error: Account deletion request failed`.
- Next dev terminal showed `FirebaseError: [code=failed-precondition]: The query requires a COLLECTION_GROUP_ASC index for collection comments and field authorUid` plus `POST /api/account/deletion 500`.
- Backend query needing the index: `adminDb.collectionGroup('comments').where('authorUid', '==', uid)`.

Attempt 1 evidence:

- Added `firestore.indexes.json` field override: `collectionGroup=comments`, `fieldPath=authorUid`, index `{ order: ASCENDING, queryScope: COLLECTION_GROUP }`.
- Preserved existing composite indexes and existing field overrides, including `comments.deletedPurgeAt`.
- Initially added `tests/unit/config/firestore-indexes.test.js`; it used `JSON.parse` and `toContainEqual`, not string grep.
- Continued attempt 1 by moving the test to `tests/server/firestore/firestore-indexes.test.js`, resolving the TypeScript ESLint project-service scope blocker without touching `tsconfig.json` or `eslint.config.mjs`.
- Added JSDoc required by the lint rules.
- Preserved the history that `npx vitest run tests/server/firestore/firestore-indexes.test.js` without env failed because `vitest.setup.server.js` requires Firebase Emulator env before importing tests.
- Accepted verification uses the server/firestore setup contract: set `FIRESTORE_EMULATOR_HOST=localhost:8080` and `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` on the focused Vitest command.
- Installed local `node_modules` with `npm install` because this worktree initially lacked Vitest dependencies; lockfile was not changed.
- Reviewer attempt 1 rejected only because workflow state recorded `commit=false` despite user commit authorization. This continuation corrects the boundary to `commit=yes`; no commit was performed by this Engineer.

Verification commands and observed signal:

| Command | Observed signal |
| ------- | --------------- |
| `npx vitest run tests/unit/config/firestore-indexes.test.js` before index change | exit 1; expected RED assertion: `fieldOverrides` lacked `comments.authorUid` and only showed existing overrides. |
| `npx vitest run tests/unit/config/firestore-indexes.test.js` after index change | exit 0; 1 test passed. |
| `node --check tests/server/firestore/firestore-indexes.test.js` | exit 0. |
| `npx vitest run tests/server/firestore/firestore-indexes.test.js` without env | historical exit 1; `vitest.setup.server.js` requires `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` before importing tests. |
| `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx vitest run tests/server/firestore/firestore-indexes.test.js` | exit 0; 1 test passed. |
| `npm run lint:changed` | exit 0; React settings warning only. |
| `npm run type-check:changed` | exit 0; no changed-file type errors. |
| `npm run workflow:check` | exit 0; 12 status files valid and synced after T007 `engineer_done` state and accepted env verification were recorded. |
| `firebase deploy --only firestore:indexes --project dive-into-run` | exit 0; Firebase CLI reported indexes in `firestore.indexes.json` deployed successfully for the `(default)` database; rules were compiled only and no rules/functions deploy was run. |

Blocker history:

- The previous `npm run lint:changed` blocker is resolved by moving the test to `tests/server/firestore`.
- The second focused Vitest blocker is resolved by running the accepted command with `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST`, matching the server/firestore test directory setup contract.
- No current implementation blocker remains. Reviewer attempt 2 passed with no findings. Firestore index deploy completed during release closeout.

Reviewer result:

- `review_passed`: T007 adds the exact `comments.authorUid` collection-group ASC index override, preserves existing index config, adds a semantic JSON-parsing regression test, and kept Firebase index deploy pending until explicit release closeout authorization. The index deploy has since completed successfully.

## T006 - Attempt 2 Follow-up

- **State**: `completed`
- **Attempt**: 2
- **Wave**: `wave-6`
- **Engineer**: Codex Engineer
- **Reviewer**: Codex Reviewer
- **Authorization boundary**: edit=yes, local verification=yes, commit=yes, push=yes, pullRequest=yes, ciWatch=yes, merge=yes, localMainSync=yes, deployFirestoreRules=yes
- **Rules deploy status**: pending for Firestore rules/functions release; deploy authorized for closeout

Scope:

- Record T006 attempt 1 `review_rejected` honestly before code edits.
- Fix rollback/finalizer behavior so failed rollback requests cannot later finalize and delete active users.
- Fix account deletion finalizer cleanup so post comment history subcollections are deleted like event comment history.
- Run required local verification without commit, stage, push, PR, deploy, or unit-test/TDD expansion.

Attempt 2 evidence:

- Rollback marks request `failed`, removes `scheduledFor`, sets `finalizationBlocked: true`, and records `failureStage: request_side_effects`.
- Finalizer eligibility skips `finalizationBlocked` requests and only retries `failed` requests that already reached finalization (`finalizeStartedAt`).
- Post deletion now uses comments-with-history cleanup, matching event comments cleanup.
- Reviewer PASS at 2026-05-27T18:14:25Z: no Critical, Important, or Minor findings remained after attempt 2.

Verification commands and observed signal:

| Command | Observed signal |
| ------- | --------------- |
| `npm run lint:changed` | exit 0; React settings warning only |
| `npm run type-check:changed` | exit 0; no changed-file type errors |
| `npm run workflow:check` | exit 0; 9 status files valid and synced after attempt 2 evidence write |
| `npm run workflow:links` | exit 0; 37 local workflow links scanned and all local references exist |
| `npm run depcruise` | exit 0; no dependency violations found |
| `node --check functions/index.js` | exit 0 |
| `node --check src/repo/server/account-deletion-server-repo.js` | exit 0 |
| `npm run build` | exit 0 |
| `firebase emulators:exec --only auth,firestore,storage,functions --project dive-into-run "node account-deletion-emulator-check.mjs"` | exit 0; authenticated flow verified request, pending gate, cancel, finalizer cleanup, blocked failed-request skip, and same-email new account |
| `firebase functions:artifacts:setpolicy --location us-central1 --days 1 --force --project dive-into-run` | exit 0; cleanup policy set for us-central1 function images older than 1 day |
| `firebase deploy --only firestore:rules,functions --project dive-into-run` | exit 0; Firestore rules released and `finalizeAccountDeletions(us-central1)` present |

Reviewer result:

- `review_passed`: T006 attempt 2 resolves the prior rollback/finalizer eligibility bug and post comment history cleanup gap.
- Workflow state records attempt 1 rejection and attempt 2 review pass without implying production deploy.
