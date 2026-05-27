# Account Deletion Plan

## Summary

Add a server-owned account deletion workflow with thin app routes, client UI in `/member`, pending-deletion gating, public-content filtering, Firestore rule protection, and a Firebase scheduled finalizer. The reversible waiting-period changes use account-deletion metadata so cancellation can restore only this request's effects.

## Architecture

- Client starts from `/member` Danger Zone, performs Google reauthentication, then calls `/api/account/deletion` with a fresh Firebase ID token.
- Server verifies the token, enforces recent `auth_time`, writes `accountDeletionRequests/{uid}`, updates `users/{uid}`, hides/cancels account-owned public content, and records restore metadata.
- AuthProvider surfaces `accountStatus`; a root gate renders a pending-deletion screen for signed-in pending users.
- Public service mappers filter pending-deletion or account-deletion-hidden content.
- Firebase scheduled function scans due requests and permanently deletes Firestore documents, Auth user, Strava data, notifications, relationships, and avatar storage.

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `specs/account-deletion/*` | Create | P4 workflow state and verification contract. |
| `src/config/account-deletion.js` | Create | Shared account deletion constants. |
| `src/repo/server/account-deletion-server-repo.js` | Create | Admin SDK deletion request, restore, and cleanup primitives. |
| `src/runtime/server/use-cases/account-deletion-server-use-cases.js` | Create | Token validation and API/finalizer orchestration. |
| `src/app/api/account/deletion/route.js` | Create | Thin App Router API handlers. |
| `src/runtime/client/use-cases/account-deletion-use-cases.js` | Create | Client reauth and account deletion API calls. |
| `src/runtime/providers/AccountDeletionGate.jsx` | Create | Pending deletion screen and gate. |
| `src/ui/member/AccountDeletionDangerZone.jsx` | Create | Render-only Danger Zone UI. |
| `src/app/layout.jsx`, `src/app/member/page.jsx` | Modify | Wire gate and member page slot. |
| `src/repo/client/firebase-auth-repo.js`, `src/service/auth-service.js`, `src/runtime/client/use-cases/auth-use-cases.js` | Modify | Preserve account status and reauth support. |
| `src/service/*profile*`, `src/service/post-service.js`, `src/service/event-service.js` | Modify | Hide pending-deletion profiles and content. |
| `firestore.rules` | Modify | Protect server-owned deletion fields and request docs. |
| `storage.rules` | Considered, no v1 change | Existing owner-only avatar writes remain; Admin finalizer deletes avatar storage. Blocking pending users from direct avatar uploads is a v1 residual risk, not a spec requirement. |
| `functions/index.js` | Modify | Add scheduled finalizer entrypoint. |

## Verification Strategy

- Required local gates:
  - `npm run lint:changed`
  - `npm run type-check:changed`
  - `npm run depcruise`
  - `npm run workflow:check`
  - `npm run workflow:links`
  - `npm run build`
- Behavior evidence target: Firebase Emulator Auth, Firestore, Storage, and Functions run with a logged-in user; capture screen/data evidence for request, pending gate, cancellation, finalization, and new sign-in behavior.
- Regression risk and mitigation: data deletion is irreversible, so production deploy is explicitly out of scope; local finalizer verification must use emulator data only.
- v1 pagination limitation: account-deletion-hidden records are filtered in memory after Firestore page limits in several public/member lists. This satisfies the v1 hide requirement, but pages can under-fill and `hasMore`/cursor signals can be conservative or early-false when hidden records occupy the fetched page. Exact visible pagination would require query/index changes or over-fetch pagination work outside this follow-up.
- v1 storage limitation: `storage.rules` remains owner-write for avatar paths. A pending-deletion user with a still-valid token could directly upload to their own avatar path until finalization; the public profile is hidden and the Admin finalizer deletes avatar storage.

## Workflow State

- Status schema: v3.
- Current head snapshot: captured in `status.json.currentHead` before implementation.
- Remote head snapshot: captured in `status.json.remoteHead` before implementation.
- Last verified commit policy: update only after fresh verification passes.
- Phase commit checkpoints: none authorized in this session.
- Rules deploy status: pending for Firestore rules/functions release; deploy authorized for closeout. `storage.rules` is not changed in v1.
- Incident handling: any failed finalizer, failing repo gate, or unverified authenticated flow blocks completion.

## Release Boundary

- Firestore/storage/functions deploy authorization:
  `authorizationBoundary.deployFirestoreRules=true` for closeout.
- Rules/functions deploy is separate from edit, commit, push, PR, CI, merge, and local `main` sync.
- Final summaries must not imply deployed rules, deployed functions, or deployed product behavior.

## Risk And Stop Conditions

- CI watch and GitHub merge are authorized for closeout.
- Stop if emulator authenticated verification cannot be completed; report the blocker with the farthest verified state.
- Stop if implementation would require changing Firebase project secrets or `.env`.
- Do not add unit tests for v1; do not claim unit-test coverage.

## Task Slices

- T001: Workflow state and shared constants.
- T002: Server API, deletion request lifecycle, restore metadata, and finalizer primitives.
- T003: Client UI, reauth, `/member` Danger Zone, and pending-deletion gate.
- T004: Public-content filtering and security rules protection.
- T005: Firebase scheduled function wiring and authenticated emulator verification.
