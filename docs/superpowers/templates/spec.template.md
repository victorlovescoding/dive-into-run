# <Feature Name> Spec

## Summary

<One or two sentences describing what this feature changes and why.>

## User Scenarios

- <Scenario 1>
- <Scenario 2>

## Requirements

- <Requirement 1>
- <Requirement 2>

## Success Criteria

- <Measurable outcome 1>
- <Measurable outcome 2>

## Out Of Scope

- <Explicit non-goal 1>
- <Explicit non-goal 2>

## User Authorization

- Spec approved by: <user / date>
- One-time automated execution authorization: <yes/no + date>
- Authorization boundary:
  - edit:
  - commit:
  - push:
  - pullRequest:
  - ciWatch:
  - merge:
  - localMainSync:
  - deployFirestoreRules:

## Release Notes

- Firestore/storage rules deploy required: <yes/no/not applicable>
- Final summaries must not imply deployed rules or deployed product behavior
  unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
