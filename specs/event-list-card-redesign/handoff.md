# Event List Card Redesign Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-081-event-list-card-redesign`
- Branch: `081-event-list-card-redesign`
- Current head: `474481ba29647d6edcb33b6519a57cfbb04772b3` (`Add event list card redesign spec`)
- Remote head: `origin/main` at `4c5b45b1fbf5b62ded2da57dd178133532a90b9f`
- Authorization boundary:
  - edit: true for future Engineer subagent implementation in the planned owned files
  - commit: true for a later Release Manager after Reviewer PASS, Verifier PASS, and clean workflow state
  - push: false
  - pullRequest: false
  - ciWatch: false
  - merge: false
  - localMainSync: false
  - deployFirestoreRules: false
- Current phase: plan ready; implementation not started
- Active task: none
- Active wave: none
- Latest reviewer decision: none
- Last verified commit: none
- Phase commits:
  - spec: `474481ba29647d6edcb33b6519a57cfbb04772b3` (`Add event list card redesign spec`)
- Rules deploy status: not_applicable
- Incidents: none
- Blocked: no
- Blocked reason: none

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `docs/superpowers/task-profiles.md`
4. `docs/superpowers/task-contract.md`
5. `specs/event-list-card-redesign/handoff.md`
6. `specs/event-list-card-redesign/tasks.md`
7. `specs/event-list-card-redesign/status.json`
8. `specs/event-list-card-redesign/plan.md`
9. `specs/event-list-card-redesign/spec.md`

## Next Action

Main dispatcher validates that `handoff.md`, `tasks.md`, and `status.json` agree, confirms the worktree is still on `081-event-list-card-redesign`, then dispatches T001 to an Engineer subagent with owned file `src/ui/events/EventsListSection.test.jsx`.

## Latest Verification

No implementation verification has run. Planner self-review checks are reported in the Planner final response for this planning task.

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| none | n/a | Implementation not started. |

## Closeout Checklist

- [ ] `tasks.md` task states match `status.json`.
- [ ] Active task and active wave match `status.json`.
- [ ] Latest reviewer decision is recorded in `tasks.md` and `status.json`.
- [ ] `lastVerification` has one entry per command when implementation verification begins.
- [ ] `lastVerifiedCommit`, `currentHead`, `remoteHead`, and `phaseCommits` reflect the latest verified state.
- [ ] `authorizationBoundary.deployFirestoreRules` is recorded and treated as separate from `edit`, `commit`, `push`, `pullRequest`, `ciWatch`, `merge`, and `localMainSync`.
- [ ] `rulesDeployStatus` remains `not_applicable` unless the implementation unexpectedly touches rules, which is a stop condition.
- [ ] Final summary does not imply deployed rules or deployed product behavior.
- [ ] Open incidents are resolved, mitigated with explicit carry-forward, or block closeout.
- [ ] Changed files are intentionally in scope.
- [ ] Blockers are resolved or explicitly carried forward.

## Blockers

- None.

## Pitfalls

- Do not dispatch same-wave parallel Engineers for this plan; JSX and CSS share class-name contracts.
- Do not let the card background click become a wrapper link around nested buttons or links.
- Do not modify `EventActionButtons.module.css`; list-specific button layout belongs under the list participation wrapper.
- Do not treat `commit=true` as permission for push, PR creation, CI watch, merge, or local `main` sync.
- Do not claim browser visual completion without desktop and mobile evidence for `/events`.
