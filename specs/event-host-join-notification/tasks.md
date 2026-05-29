# Event Host Join Notification Tasks

## Compact Guard

- This file is the human-readable task source of truth for
  `specs/event-host-join-notification/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`,
  `specs/event-host-join-notification/handoff.md`, this file, and
  `specs/event-host-join-notification/status.json` before dispatching work.
- Main agent is control plane only. Repo-changing edits belong to Engineer
  subagents, including code, docs, workflow docs, ADRs, `.codex/**`, scripts,
  and config.
- Planner subagent slices repo-changing work. Main validates Planner output and
  dispatches; it does not self-slice repo-changing work.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block
  before dispatch, commit, push, pull request, merge, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator
  state sync.
- Command evidence is one command per entry. Do not combine commands with shell
  chain operators.
- New `status.json` state uses schemaVersion 3 and records `currentHead`,
  `remoteHead`, `lastVerifiedCommit`, `phaseCommits`, `rulesDeployStatus`, and
  `incidents`.
- Final summaries must not imply deployed Firestore rules or deployed product
  behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.

## Current State

- Feature slug: `event-host-join-notification`.
- Branch: `078-event-host-join-notification`.
- Worktree:
  `/Users/chentzuyu/Desktop/dive-into-run-078-event-host-join-notification`.
- Date: 2026-05-30 Asia/Taipei / 2026-05-29 UTC.
- Profile: P4 new product feature.
- Current phase: spec review passed.
- Active task: none.
- Active wave: none.
- Implementation tasks: none yet.
- Reviewed state: Reviewer `review_passed` at `2026-05-29T16:26:01Z`; spec
  artifacts capture approved behavior, architecture, authorization boundaries,
  and workflow state; no implementation tasks have been created yet.
- Next action: commit these reviewed spec artifacts, then ask the user to
  review the committed spec before invoking `superpowers:writing-plans` to
  produce the detailed implementation plan and task slices.

## Authorization Boundary

- edit: yes, for the owned spec workflow files only.
- commit: yes, after Reviewer PASS and coordinator verification; main agent
  will commit, not the Engineer.
- push: no.
- pullRequest: no.
- ciWatch: no.
- merge: no.
- localMainSync: no.
- deployFirestoreRules: no.

## Rules Release State

- A Firestore rules allowlist update is required later for this feature.
- Firestore rules deploy is not authorized in the current boundary.
- `rulesDeployStatus.state` is `required` because release will need rules work,
  while `rulesDeployStatus.changed` is `false` because this spec artifact
  creation task does not edit `firestore.rules`.
- No deployed rules or product behavior claim is allowed without deploy
  evidence.

## Planner Output

Implementation planning is intentionally pending. The next planning stage must
produce the dependency graph, execution order, parallel waves, owned files,
read-only context, acceptance criteria, verification plan, and final
integration gate through `superpowers:writing-plans` after user review.

## Tasks

No implementation tasks exist yet. Do not dispatch Engineers for source,
tests, rules, package files, lockfiles, or docs outside this spec directory
until the `superpowers:writing-plans` stage creates reviewed task slices.
