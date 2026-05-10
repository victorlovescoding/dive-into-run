# Gap B Tech-Debt Tracker Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/gap-b-tech-debt-tracker/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `handoff.md`, this file, and `status.json` before dispatching work.
- Main agent is coordinator only. This execution is docs-only.
- A task can be checked only after Reviewer PASS.
- Do not touch production code or executable tests.

## Team And Parallelism

- Default: one Engineer + Reviewer pair at a time.
- Parallelism is not recommended for this feature because T002 and T003 share `docs/TECH_DEBT.md` and workflow state files.
- If parallel research is used for T001, each lane must write only a temporary report outside the repo or report in chat; the coordinator consolidates after review.

## Tasks

### T001 - Inventory And Classify Source Findings

- **Status**: `[x]`
- **Scope**: Read source evidence and produce the candidate debt inventory for reviewer approval.
- **Owned files**:
  - `specs/gap-b-tech-debt-tracker/tasks.md`
  - `specs/gap-b-tech-debt-tracker/handoff.md`
  - `specs/gap-b-tech-debt-tracker/status.json`
- **Dependencies**: none
- **Engineer**: Engineer B or assigned docs Engineer
- **Reviewer**: Reviewer B or assigned docs Reviewer
- **Commit checkpoint**: none; commit only after T003 or T004 unless the coordinator chooses a docs phase commit.

Acceptance criteria:

- AC-T001.1: Read the absolute Gap B source file from `/Users/chentzuyu/Desktop/dive-into-run/project-health/2026-04-24-openai-harness-gap-analysis.md`.
- AC-T001.2: Confirm whether `docs/TECH_DEBT.md` exists in the current worktree before planning writes; if it exists, inspect and reconcile instead of overwriting.
- AC-T001.3: Inventory candidate items from `docs/QUALITY_SCORE.md`, `specs/026-tests-audit-report/handoff.md`, `specs/027-tests-mock-cleanup/handoff.md`, `specs/033-s9-coverage-gap/handoff.md`, `specs/*/code-review.md`, and the two project memory entries named in `plan.md`.
- AC-T001.4: Classify each candidate as `include`, `exclude-resolved`, `exclude-session-state`, `exclude-agent-memory`, or `mechanical-sensor-follow-up`.
- AC-T001.5: Every included candidate has severity, domain, description, origin, status, and next-trigger evidence.

Verification commands:

```bash
test -f /Users/chentzuyu/Desktop/dive-into-run/project-health/2026-04-24-openai-harness-gap-analysis.md
test -e docs/TECH_DEBT.md && printf 'EXISTS docs/TECH_DEBT.md\n' || printf 'MISSING docs/TECH_DEBT.md\n'
rg -n "debt|deferred|follow-up|followup|optional|tech debt|gap|risk|P0|P1|P2" docs/QUALITY_SCORE.md specs/026-tests-audit-report/handoff.md specs/027-tests-mock-cleanup/handoff.md specs/033-s9-coverage-gap/handoff.md specs/*/code-review.md
```

Engineer evidence:

- Engineer A read the Gap B source and 2026-05-10 test audit sources from the original checkout because `project-health/` is ignored in this worktree.
- Engineer A seeded 12 durable open items in `docs/TECH_DEBT.md` and excluded completed, session-local, vague, and low-ROI candidates.

Reviewer evidence:

- Reviewer A PASS: `docs/TECH_DEBT.md` items are source-backed, still actionable, and do not move resolved or session-local items into Open Items.

### T002 - Create The Tracker Document

- **Status**: `[x]`
- **Scope**: Create the durable tracker from the reviewed inventory.
- **Owned files**:
  - `docs/TECH_DEBT.md`
  - `specs/gap-b-tech-debt-tracker/tasks.md`
  - `specs/gap-b-tech-debt-tracker/handoff.md`
  - `specs/gap-b-tech-debt-tracker/status.json`
- **Dependencies**: T001 Reviewer PASS
- **Engineer**: Engineer B or assigned docs Engineer
- **Reviewer**: Reviewer B or assigned docs Reviewer
- **Commit checkpoint**: `docs(gap-b): add tech debt tracker`

Acceptance criteria:

- AC-T002.1: `docs/TECH_DEBT.md` exists and starts with purpose, scope, update rules, and source notes.
- AC-T002.2: Open items table includes only reviewed durable debt items.
- AC-T002.3: Resolved items table exists even if it starts empty.
- AC-T002.4: Each open item includes ID, severity, domain, description, origin, status, and Next Trigger.
- AC-T002.5: The document states that session-local handoff notes are evidence sources, not the tracker itself.
- AC-T002.6: No production code, executable tests, scripts, CI, hooks, or package files are changed.

Verification commands:

```bash
test -f docs/TECH_DEBT.md
rg -n "^\\| TD-[0-9]{3} \\|" docs/TECH_DEBT.md
rg -n "Update Rules|Open Items|Resolved Items|Source Notes" docs/TECH_DEBT.md
git diff --name-only
```

Engineer evidence:

- Engineer A created `docs/TECH_DEBT.md` with Purpose, Update Rules, Open Items, Resolved Items, and Source Notes.
- Open Items count: 12. Status values used: Open and Deferred.

Reviewer evidence:

- Reviewer A PASS: tracker fields and status enum match Gap B requirements; Markdown table structure and ASCII check were acceptable.

### T003 - Verify Tracker And Update Workflow State

- **Status**: `[x]`
- **Scope**: Run docs verification and sync workflow artifacts with fresh evidence.
- **Owned files**:
  - `specs/gap-b-tech-debt-tracker/tasks.md`
  - `specs/gap-b-tech-debt-tracker/handoff.md`
  - `specs/gap-b-tech-debt-tracker/status.json`
- **Dependencies**: T002 Reviewer PASS
- **Engineer**: Engineer B or assigned docs Engineer
- **Reviewer**: Reviewer B or assigned docs Reviewer
- **Commit checkpoint**: same checkpoint as T002 unless the coordinator intentionally splits docs state.

Acceptance criteria:

- AC-T003.1: `status.json` is valid JSON and reflects the current phase, active task, blocker state, latest verified commit, and task statuses.
- AC-T003.2: `handoff.md` records read order, current state, latest evidence, next action, and pitfalls.
- AC-T003.3: `tasks.md` records Engineer and Reviewer evidence for T001-T003.
- AC-T003.4: Markdown diff check passes for every changed markdown file.
- AC-T003.5: `docs/TECH_DEBT.md` contains no placeholder markers.

Verification commands:

```bash
node -e "JSON.parse(require('fs').readFileSync('specs/gap-b-tech-debt-tracker/status.json','utf8')); console.log('status.json ok')"
git diff --check -- docs/TECH_DEBT.md specs/gap-b-tech-debt-tracker/spec.md specs/gap-b-tech-debt-tracker/plan.md specs/gap-b-tech-debt-tracker/tasks.md specs/gap-b-tech-debt-tracker/handoff.md specs/gap-b-tech-debt-tracker/status.json
rg -n "PLACEHOLDER_VALUE|REPLACE_ME|FILL_ME" docs/TECH_DEBT.md specs/gap-b-tech-debt-tracker
```

Engineer evidence:

- Coordinator ran final docs verification on 2026-05-10:
  - `npm run lint:changed` exit 0, no changed JS files to lint.
  - `npm run type-check:changed` exit 0, no changed JS files to check.
  - status JSON parse command exit 0, `status.json ok`.
  - placeholder marker scan exit 1 with no output, expected no placeholder hits.
  - trailing whitespace `awk` check exit 0 with no output.
  - per-file `git diff --no-index --check` wrapper exit 0, `no-index diff check ok`.
  - ASCII byte check exit 0 with no output.
- `npm install` temporarily modified `package-lock.json`; coordinator restored that generated churn. Current changed scope is limited to `docs/TECH_DEBT.md` and `specs/gap-b-tech-debt-tracker/`.

Reviewer evidence:

- Final Reviewer rejected stale workflow state once; coordinator updated this file, `handoff.md`, and `status.json` so fresh sessions resume at T004 final review.

### T004 - Final Docs Closeout

- **Status**: `[x]`
- **Scope**: Final reviewer check before commit, push, or PR decisions.
- **Owned files**:
  - `docs/TECH_DEBT.md`
  - `specs/gap-b-tech-debt-tracker/tasks.md`
  - `specs/gap-b-tech-debt-tracker/handoff.md`
  - `specs/gap-b-tech-debt-tracker/status.json`
- **Dependencies**: T003 Reviewer PASS
- **Engineer**: Coordinator or assigned closeout Engineer
- **Reviewer**: Final docs Reviewer
- **Commit checkpoint**: `docs(gap-b): add tech debt tracker`

Acceptance criteria:

- AC-T004.1: Working tree diff is limited to `docs/TECH_DEBT.md` and `specs/gap-b-tech-debt-tracker/` files.
- AC-T004.2: No production code or executable test file appears in `git diff --name-only`.
- AC-T004.3: Final handoff states whether commit, push, or PR has not been performed.
- AC-T004.4: Reviewer confirms the tracker can be resumed from files without transcript context.

Verification commands:

```bash
git diff --name-only
git status --short --branch
git diff --check -- docs/TECH_DEBT.md specs/gap-b-tech-debt-tracker
```

Engineer evidence:

- Coordinator requested final docs review after workflow-state sync. No commit, push, or PR has been performed.

Reviewer evidence:

- Final Docs Reviewer PASS: no P1/P2 findings; files are sufficient to resume without transcript context; docs-only scope remains limited to `docs/TECH_DEBT.md` and `specs/gap-b-tech-debt-tracker/`.
