# <Feature Name> Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/<feature>/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`, this file, and `status.json` before dispatching work.
- Main agent is control plane only. Repo-changing edits belong to Engineer
  subagents, including code, executable tests, docs, workflow docs, ADRs,
  `.codex/**`, scripts, and config.
- Planner subagent slices repo-changing work. Main validates Planner output and
  dispatches; it does not self-slice repo-changing work.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block
  before dispatch, commit, push, PR, merge, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator
  state sync.
- Command evidence is one command per entry. Do not combine commands with `&&`
  or `;`.
- New `status.json` state uses schemaVersion 3 and records `currentHead`,
  `remoteHead`, `lastVerifiedCommit`, `phaseCommits`, `rulesDeployStatus`, and
  `incidents`.
- Final summaries must not imply deployed Firestore/storage rules or deployed
  product behavior unless `rulesDeployStatus.state` is `deployed` with deploy
  evidence.

## Team And Parallelism

- Default: one Engineer + Reviewer pair at a time.
- Planner output must include dependency graph, execution order, parallel waves,
  owned files, read-only context, acceptance criteria, verification plan, and
  final integration gate.
- Same-wave tasks require completely disjoint owned files, one Reviewer per
  lane, and a final integration gate.
- Shared helpers, config, lockfiles, and workflow state must serialize or become
  a prerequisite shared-helper task.
- Shared schema, security rules, migration, and release-state writes must
  serialize.
- Recommended maximum in one shared worktree: two to three Engineer/Reviewer
  pairs.

## Planner Output

- Dependency graph:
  - <T001 -> T002 / none>
- Parallel waves:
  - `wave-1`: <task ids>
- Final integration gate:
  - `<command or browser/reviewer gate>`: <expected signal>

## Tasks

### T001 - <Task Title>

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: <role>
- **Reviewer**: <role>
- **Commit checkpoint**: <none / phase commit name>
- **Last verified commit**: <none / commit sha or ref>
- **Authorization boundary**: edit=<yes/no>, commit=<yes/no>, push=<yes/no>, pullRequest=<yes/no>, ciWatch=<yes/no>, merge=<yes/no>, localMainSync=<yes/no>, deployFirestoreRules=<yes/no>
- **Rules deploy status**: <not_applicable / not_required / required / pending / blocked / deployed>
- **Incidents**: <none / incident IDs and state>

Scope:

- <what this task may change>

Non-scope:

- <what this task must not change>

Owned files:

- `<path>`

Read-only context:

- `<path>`

Dependencies:

- <none / task IDs / user decision>

Browser evidence:

- <not applicable / required; target URL, route or journey, viewport, tool,
  screenshot artifact, expected vs actual UI signal, console and network
  findings>

Engineer instructions:

- <concrete implementation instruction>
- Modify only the owned files above.

Acceptance criteria:

- AC-T001.1: <criterion>
- AC-T001.2: <criterion>

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `<command>` | <exit 0 and key output / no relevant errors> |

> Use one command per row. Split shell chains into separate rows.

Reviewer PASS criteria:

- Diff touches only owned files.
- Required verification commands pass and match the expected signal.
- Acceptance criteria are covered by tests, docs evidence, or explicit
  rationale.
- Layer, testing, and workflow rules remain satisfied.
- Behavior or docs changes stay inside scope and non-scope is untouched.
- Rules deploy claims, if any, are backed by `rulesDeployStatus.state=deployed`
  and deploy evidence.

Reviewer REJECT criteria:

- Diff touches non-owned files without prior coordinator approval.
- Verification is missing, stale, failed, or not the required command.
- Acceptance criteria are unmet or unsupported by evidence.
- Layer, testing, or workflow rules are violated.
- Behavior or docs changed outside scope or inside non-scope.
- Final evidence implies deployed rules or deployed product behavior without
  `rulesDeployStatus.state=deployed` and deploy evidence.

Evidence:

- Engineer report:
  - <files changed, commands, exit codes, risks>
- Reviewer report:
  - <review_passed/review_rejected/blocked, checked diff, commands, exit codes>
- Command output summary:
  - `<command>`: <short signal>
- Changed files summary:
  - `<path>`
    - <why changed>
- Phase commits:
  - `<phase>`: `<commit/ref>` - <summary>
- Rules deploy status:
  - state: <not_applicable / not_required / required / pending / blocked / deployed>
  - evidence: <none / deploy command and artifact>
- Incidents:
  - <none / incident id, state, summary>
