# Account Deletion Handoff

## Current State

- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-073-account-deletion`
- Branch: `073-account-deletion` (local status showed behind `origin/main` by 2; pull/rebase is not authorized in this task).
- Active task: none; T001-T006 are completed after integrated Reviewer PASS.
- Current phase: deployed; reviewed implementation, fresh local verification, Firestore rules deploy, Functions deploy, and cleanup policy setup are complete.
- Authorization: edit, local verification, stage, commit, push, PR, CI watch, GitHub merge, Firebase deploy, and local main sync.
- T006 attempt 1 Reviewer decision: `review_rejected` at 2026-05-27T18:04:39Z.
- T006 attempt 2 Reviewer decision: `review_passed` at 2026-05-27T18:14:25Z.
- Verification decision: no unit tests and no TDD for v1; use local gates and emulator walkthrough only when authorized/available.

## Attempt 2 Changes

- Rollback/finalizer safety: rollback failed requests remove `scheduledFor`, set `finalizationBlocked: true`, and record `failureStage: request_side_effects`; finalizer skips non-finalizable failed requests and only retries failed requests that already have `finalizeStartedAt`.
- Post comment history cleanup: post deletion now deletes each post comment `history` subcollection before deleting the comment, mirroring event comment cleanup, in both server repo and deployed Functions source.
- Reviewer PASS found no Critical, Important, or Minor findings after attempt 2.

## Latest Verification

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

- None for reviewed local implementation, local verification, and Firebase deploy.
- Production Firebase deploy, CI watch, and GitHub merge are authorized for closeout.

## Pitfalls

- Do not imply GitHub merge, CI status, or deploy status without separate evidence.
- Do not add unit tests for this v1.
- Record CI, merge, and deploy evidence before claiming release completion.
- Do not mark tasks `completed` from Engineer evidence alone; canonical lifecycle requires Reviewer PASS first.
