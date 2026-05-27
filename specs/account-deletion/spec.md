# Account Deletion Spec

## Summary

Users can request account deletion from `/member`. The app immediately hides the account and public content, gives the user 30 days to cancel, then a scheduled Firebase function permanently deletes Auth, profile, content, relationships, notifications, Strava data, and avatar storage.

## User Scenarios

- A signed-in Google user opens `/member`, uses Danger Zone, reauthenticates, and requests account deletion.
- During the waiting period, the same user can only see the pending deletion screen, cancel deletion, or sign out.
- Public visitors no longer see the pending-deletion user's profile, posts, comments, hosted events, or event participation state.
- A pending-deletion user cancels within 30 days and the account/content becomes active again.
- After the scheduled finalizer completes, the old Auth user and account data are gone; the same Google identity can sign in as a new account without reconnecting old data.

## Requirements

- Use two-stage deletion with `accountDeletionRequests/{uid}` and `users/{uid}.accountStatus`.
- `POST /api/account/deletion` requires a valid Firebase ID token and recent reauthentication.
- `GET /api/account/deletion` and `DELETE /api/account/deletion` require a valid Firebase ID token.
- Requesting deletion must mark the user `pendingDeletion`, hide public account-owned content, cancel hosted events, and notify participants.
- Cancellation must restore this request's reversible hidden/cancelled state and mark the user `active`.
- Scheduled finalization must clean Auth, profile, posts, comments, events, participants, likes, favorites, follows, notifications, Strava data, and avatar storage.
- Notifications sent to the deleted user's own inbox are removed; other users' retained notifications are anonymized to `已刪除使用者`.
- v1 does not add unit tests and does not use the TDD RED/GREEN workflow. Verification is authenticated emulator behavior plus repo gates.

## Success Criteria

- In Firebase Emulator with a logged-in user, requesting deletion from `/member` enters the pending deletion gate.
- Public profile, posts, comments, and hosted events for the pending-deletion account are no longer visible.
- Cancelling within 30 days restores the account to `active` and makes previously hidden public content visible again.
- Forcing `scheduledFor` into the past and running the finalizer deletes the Auth user and account data.
- Signing in again with the same emulator Google identity creates a new account and does not restore old data.
- Repo gates pass: `npm run lint:changed`, `npm run type-check:changed`, `npm run depcruise`, `npm run workflow:check`, `npm run workflow:links`, and `npm run build`.

## Out Of Scope

- Data export before deletion.
- Production deploy of Functions, Firestore rules, or Storage rules.
- Unit test files or TDD RED/GREEN flow for this v1.
- Legal/privacy copy beyond concise in-app confirmation text.

## User Authorization

- Spec approved by: user, 2026-05-28.
- One-time automated execution authorization: yes, 2026-05-28, via "PLEASE IMPLEMENT THIS PLAN".
- Authorization boundary:
  - edit: yes
  - commit: yes
  - push: yes
  - pullRequest: yes
  - ciWatch: yes
  - merge: yes
  - localMainSync: yes
  - deployFirestoreRules: yes

## Release Notes

- Firestore/functions deploy required: yes, authorized for closeout. `storage.rules` has no v1 change.
- Functions deploy required: yes, authorized for closeout.
- Final summaries must not imply deployed rules, deployed functions, or production product behavior.
