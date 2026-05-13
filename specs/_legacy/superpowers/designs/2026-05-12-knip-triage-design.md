# Knip Triage Design

Date: 2026-05-12

## Decision

Proceed with Option A: triage current Knip findings, document the result, and
perform only minimal cleanup that is clearly supported by the triage. Do not
attempt a broad Knip cleanup in this step.

This work is classified as C2/R2, which routes to Profile P2. If the work
requires a new dependency, a package lockfile material update, or any
security-sensitive dependency change, escalate immediately to P4 before
continuing.

## Artifacts

The formal triage document will be:

```text
docs/quality/2026-05-12-knip-triage.md
```

Do not use or edit `project-health/**` for this work.

This design document is the brainstorming output only. It does not authorize
implementation of the Knip cleanup.

## Scope

Allowed scope:

- Run and inspect the current Knip report commands.
- Classify findings into actionable cleanup, intentional usage, false positive,
  and deferred follow-up.
- Write the formal triage summary in:
  ```text
  docs/quality/2026-05-12-knip-triage.md
  ```
- Make minimal cleanup only when it is narrow, mechanically justified by the
  triage, and does not change runtime behavior.
- Adjust a Knip gate script only if needed to preserve the intended reporting
  behavior for the triage.

Non-scope:

- Broad source or export deletion.
- Full Knip cleanup across the repository.
- Hard-gating the full Knip report.
- New dependency installation or dependency replacement.
- Material `package-lock.json` changes.
- Changes under `project-health/**`.

## Roles

Implementation must be done by an Engineer subagent using a focused task brief.
Review must be done by a Reviewer subagent before the work is considered
complete.

The implementation Engineer owns only the files named in the task brief. If the
triage reveals that additional files must be edited, stop and update the task
brief before continuing.

## Stop Conditions

Stop and return to the coordinator if any of these occur:

- A new dependency is needed.
- `package-lock.json` needs a material update.
- The cleanup requires broad source or export deletion.
- The work would hard-gate the full Knip report.
- Any change would touch `project-health/**`.
- Knip findings imply a wider architecture or ownership decision outside
  Option A triage plus minimal cleanup.

## Verification Plan

Run these commands as separate evidence items after implementation:

- `npm run knip:report`
- `npm run knip:production-deps`
- `npm run knip:production-unlisted-deps`
- `npm run lint:changed`
- `npm run type-check:changed`
- `git diff --check`

Run focused Vitest only if a Knip gate script changes. The focused test command
must target the changed gate behavior rather than expanding into a full test
suite by default.

## Acceptance Criteria

- The formal triage document exists at:
  ```text
  docs/quality/2026-05-12-knip-triage.md
  ```
- The triage explains each current Knip category well enough for a future
  cleanup task to act without redoing the same classification work.
- Any cleanup is minimal, justified by the triage, and stays within P2 scope.
- No `project-health/**` file is changed.
- No dependency or lockfile escalation is hidden inside the P2 task.
- Engineer evidence and Reviewer evidence are available before closeout.
