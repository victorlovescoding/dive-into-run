# Account Deletion Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/account-deletion/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`, this file, and `status.json` before dispatching work.
- Command evidence is one command per entry. Do not combine commands with shell chain operators.
- Final summaries must not imply deployed Firestore/storage rules, deployed Functions, or deployed product behavior.
- Workflow drift was found on 2026-05-27 and reconciled without Reviewer PASS.

## Current State

- Active task: none; T001-T006 are completed after integrated Reviewer PASS.
- T006 attempt 1 Reviewer decision: `review_rejected` at 2026-05-27T18:04:39Z.
- T006 attempt 2 Reviewer decision: `review_passed` at 2026-05-27T18:14:25Z.
- `completedTasks`: T001, T002, T003, T004, T005, T006.
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

Reviewer result:

- `review_passed`: T006 attempt 2 resolves the prior rollback/finalizer eligibility bug and post comment history cleanup gap.
- Workflow state records attempt 1 rejection and attempt 2 review pass without implying production deploy.
