# Verification Evidence

| Command | Exit code | Expected signal | Actual signal | Commit SHA / changed surface |
| ------- | --------- | --------------- | ------------- | ---------------------------- |
| `command` | 0 | expected output | actual output | `HEAD` / `path/to/file` |

## Status V3 Snapshot

- currentHead:
- remoteHead:
- authorizationBoundary:
  - edit:
  - commit:
  - push:
  - pullRequest:
  - ciWatch:
  - merge:
  - localMainSync:
  - deployFirestoreRules:
- lastVerifiedCommit:
- phaseCommits:
- rulesDeployStatus:
  - state:
  - required:
  - changed:
  - deployedCommit:
  - deploy evidence:
- incidents:

## Final Summary Guard

- Do not describe Firestore/storage rules or product behavior as deployed unless
  `rulesDeployStatus.state` is `deployed` and deploy evidence is recorded.
- Missing `authorizationBoundary.deployFirestoreRules` blocks the actual deploy
  command and deployed-rules claims, not edit/commit/push/PR/CI/merge evidence
  that has its own authorization and records the non-deployed release risk.
