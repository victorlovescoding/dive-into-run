# <Feature Name> Plan

## Summary

<Technical summary of the approach.>

## Architecture

- <Data flow / control flow decision>
- <Important interface or boundary>

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `<path>` | Create/Modify | <responsibility> |

## Verification Strategy

- Required local gates: <commands and expected signals>
- Behavior or document evidence target: <observable proof>
- Regression risk and mitigation: <risk and verification rationale>

## Workflow State

- Status schema: v3.
- Current head snapshot: <when/how `status.json.currentHead` is captured>
- Remote head snapshot: <when/how `status.json.remoteHead` is captured>
- Last verified commit policy: <when `lastVerifiedCommit` is updated>
- Phase commit checkpoints: <phase names expected in `phaseCommits`>
- Rules deploy status: <not_applicable / not_required / required / pending / blocked / deployed>
- Incident handling: <how open incidents block closeout or are carried forward>

## Release Boundary

- Firestore/storage rules deploy authorization:
  `authorizationBoundary.deployFirestoreRules=<true/false>`.
- Rules deploy is separate from edit, commit, push, PR, CI, merge, and local
  `main` sync.
- Final summaries must not imply deployed rules or deployed product behavior
  unless `rulesDeployStatus.state` is `deployed` with deploy evidence.

## Risk And Stop Conditions

- <Feature-specific stop condition>
- <Forbidden scope or escalation point>
- Actual rules deploy or a deployed-rules/product-behavior claim needed but
  `deployFirestoreRules` is not authorized or deploy evidence is absent.

## Task Slices

- T001: <task title>
- T002: <task title>
