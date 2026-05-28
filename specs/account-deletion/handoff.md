# Account Deletion Handoff

## Current State

- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-075-account-deletion-index-error`
- Branch: `075-account-deletion-index-error`
- Active task: none; T001-T007 are completed after Reviewer PASS.
- Current phase: reviewed follow-up in release closeout. Local config/test fix exists, changed-file lint passes, focused server Vitest passes when run with the server/firestore setup contract env variables, Reviewer attempt 2 passed with no findings, and Firestore index deploy completed.
- Authorization for release closeout: edit=yes, commit=yes, push=yes, PR=yes, CI watch=yes, merge=yes, local main sync=yes, Firebase deploy authorization=yes for `firestore:indexes` only. No rules/functions deploy was run for T007.
- T006 attempt 1 Reviewer decision: `review_rejected` at 2026-05-27T18:04:39Z.
- T006 attempt 2 Reviewer decision: `review_passed` at 2026-05-27T18:14:25Z.
- T007 attempt 1 Reviewer decision: `review_rejected` only because workflow state incorrectly recorded `commit=false` despite user commit authorization; no implementation defect was reported.
- T007 attempt 2 Reviewer decision: `review_passed`; no findings.
- Verification decision: T007 explicitly uses a focused Vitest static regression test for the production missing-index incident.

## T007 Follow-up

- Root cause: `adminDb.collectionGroup('comments').where('authorUid', '==', uid)` needs a `comments.authorUid` collection-group ASC single-field index.
- Production signal: manual Chrome flow for `Crawler Mr. / mrcrawler987@gmail.com` returned to `/member` after `重新驗證並刪除`, did not enter the pending deletion gate, console showed `Error: Account deletion request failed`, and Next dev terminal showed Firestore `failed-precondition` missing `COLLECTION_GROUP_ASC` index for `comments.authorUid` with `POST /api/account/deletion 500`.
- Local fix: `firestore.indexes.json` now has `collectionGroup=comments`, `fieldPath=authorUid`, index `{ order: ASCENDING, queryScope: COLLECTION_GROUP }`.
- Regression test: `tests/server/firestore/firestore-indexes.test.js` parses `firestore.indexes.json` as JSON and asserts the exact field override. It was moved from `tests/unit/config` to resolve ESLint project-service scope without touching `tsconfig.json` or `eslint.config.mjs`.
- Verification contract: the server/firestore directory requires `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST`, even for this static test.
- Review state: authorization boundary is corrected to commit=yes and T007 passed Reviewer attempt 2.
- Firebase deploy: `firebase deploy --only firestore:indexes --project dive-into-run` exited 0 at 2026-05-28T11:49:32Z; Firebase CLI reported indexes in `firestore.indexes.json` deployed successfully for the `(default)` database. Rules were compiled only; no rules/functions deploy was run.

## Attempt 2 Changes

- Rollback/finalizer safety: rollback failed requests remove `scheduledFor`, set `finalizationBlocked: true`, and record `failureStage: request_side_effects`; finalizer skips non-finalizable failed requests and only retries failed requests that already have `finalizeStartedAt`.
- Post comment history cleanup: post deletion now deletes each post comment `history` subcollection before deleting the comment, mirroring event comment cleanup, in both server repo and deployed Functions source.
- Reviewer PASS found no Critical, Important, or Minor findings after attempt 2.

## Latest Verification

- `npx vitest run tests/unit/config/firestore-indexes.test.js` before index change: exit 1; expected RED assertion because `fieldOverrides` did not contain `comments.authorUid`.
- `npx vitest run tests/unit/config/firestore-indexes.test.js` after index change: exit 0; 1 test passed.
- `node --check tests/server/firestore/firestore-indexes.test.js`: exit 0.
- `npx vitest run tests/server/firestore/firestore-indexes.test.js` without env: historical exit 1; `vitest.setup.server.js` requires `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` before importing tests.
- `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx vitest run tests/server/firestore/firestore-indexes.test.js`: exit 0; 1 test passed.
- `npm run lint:changed`: exit 0; React settings warning only.
- `npm run type-check:changed`: exit 0; no changed-file type errors.
- `npm run workflow:check`: exit 0; 12 status files valid and synced after T007 `engineer_done` state and accepted env verification were recorded.
- `firebase deploy --only firestore:indexes --project dive-into-run`: exit 0; Firebase CLI reported indexes in `firestore.indexes.json` deployed successfully for the `(default)` database; rules were compiled only and no rules/functions deploy was run.

## Previous T006 Verification

- `npm run lint:changed`: exit 0; React settings warning only.
- `npm run type-check:changed`: exit 0; no changed-file type errors.
- `npm run workflow:check`: exit 0; 9 status files valid and synced after attempt 2 evidence write.
- `npm run workflow:links`: exit 0; 37 local workflow links scanned and all local references exist.
- `npm run depcruise`: exit 0; no dependency violations found. Historical spec script emitted Node `MODULE_TYPELESS_PACKAGE_JSON` warning.
- `node --check functions/index.js`: exit 0.
- `node --check src/repo/server/account-deletion-server-repo.js`: exit 0.
- `npm run build`: exit 0.
- `firebase emulators:exec --only auth,firestore,storage,functions --project dive-into-run "node account-deletion-emulator-check.mjs"`: exit 0. Temporary script was copied from `/private/tmp/account-deletion-emulator-check.mjs` into the worktree for module resolution, then removed after the run. Evidence included request, pending gate, cancel, finalizer deletion, post comment history cleanup, finalizer skip for `finalizationBlocked` failed rollback request, and same-email new account.
- `firebase functions:artifacts:setpolicy --location us-central1 --days 1 --force --project dive-into-run`: exit 0. Set cleanup policy for `projects/dive-into-run/locations/us-central1/repositories/gcf-artifacts` to delete images older than 1 day.
- `firebase deploy --only firestore:rules,functions --project dive-into-run`: exit 0. Firestore rules released; `finalizeAccountDeletions(us-central1)` present and unchanged on final deploy after prior successful create.

## Blockers

- None for reviewed local config/test changes.
- The earlier `tests/unit/config` lint blocker is resolved by moving the test to `tests/server/firestore`; do not modify `tsconfig.json` or `eslint.config.mjs`.
- The earlier server Vitest env blocker is resolved by using the required env vars on the focused command.
- Firestore index deploy is complete for the T007 fix commit. Browser account deletion was not re-run after deploy because it is destructive.

## Pitfalls

- Do not imply GitHub merge, CI status, or deploy status without separate evidence.
- T007 is the exception to the v1 no-unit-tests note: it intentionally adds a focused static Vitest regression for Firestore index config.
- Record CI, merge, and deploy evidence before claiming release completion.
- Do not mark tasks `completed` from Engineer evidence alone; canonical lifecycle requires Reviewer PASS first.
