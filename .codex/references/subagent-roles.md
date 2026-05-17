# Subagent Roles

> Last-Verified: 2026-05-17

## Purpose

This reference defines repo role profiles and dispatch rules for staffing
Superpowers work. It complements `AGENTS.md`,
`docs/superpowers/workflow.md`, `docs/superpowers/task-profiles.md`, and
`docs/superpowers/task-contract.md`.

Use it when choosing subagent roles, assigning stage leads, deciding whether
parallel lanes are safe, or writing a dispatch brief.

Chinese and English repo-changing phrases, including develop, implement, fix,
refactor, test, document, 開發, 實作, 修, 修正, 修 bug, 重構, 補測試, 改文件,
and 更新文件, trigger workflow routing. Triggering routing does not grant edit
authorization; writable roles still need an explicit authorization boundary.

## Precedence

Follow workflow instructions in this order:

1. `AGENTS.md`, `docs/superpowers/**`, and repo rules.
2. Superpowers plugin defaults.
3. Specialized skills and local role/advisor habits.

Specialized skills may attach to a role, but they cannot weaken repo workflow
rules, owned-file boundaries, verification evidence, or authorization
boundaries.

## Formal Roles

The main agent is the control plane. It coordinates users, dispatches roles,
tracks workflow state, and enforces stop conditions. It is not an Engineer,
Reviewer, Debugger, Verifier, or Release Manager for repo-changing work.

Formal subagent roles:

| Role | Purpose | Primary protocol |
| ---- | ------- | ---------------- |
| `repo_explorer` / Explorer | Bounded read-only investigation with file/line, command, and uncertainty evidence. Future custom TOML should avoid overriding built-in role names. | Repo workflow exploration rules |
| Planner | Slice repo-changing work into dependency-aware task contracts, parallel waves, owned files, verification, and integration gates. | `superpowers:writing-plans` where a plan is needed |
| Engineer | Implement one owned task slice inside the write set and report changed files, commands, exit codes, risks, and unverified items. | Task contract plus task-specific skills |
| Debugger | Diagnose failures with root-cause evidence before any fix; may switch to fix mode only when authorized. | `superpowers:systematic-debugging` |
| Reviewer | Inspect the task-local diff, validate evidence, rerun or check required commands, and return one decision. | `superpowers:requesting-code-review` / repo review standards |
| Verifier | Run fresh verification gates and report exact command evidence before completion claims. | `superpowers:verification-before-completion` |
| Release Manager | Handle stage, commit, push, PR, CI, merge, and local sync only when authorized and only after Reviewer PASS plus Verifier PASS. | `superpowers:finishing-a-development-branch` plus closeout SOP |

## Advisor Labels

Advisors provide focused judgment. They do not own writes or replace formal
roles unless explicitly dispatched with a writable role and owned files.

Use these labels in specs, plans, and dispatch briefs:

- PM/Requirements: product intent, success criteria, and go/no-go clarity.
- UX/UI: interaction, visual behavior, and user-facing acceptance.
- Feasibility Engineer: viability, unknowns, and spike-worthy risks.
- Architect: boundaries, data flow, dependency direction, and system shape.
- Test Strategist: risk-based coverage and verification selection.
- Security/Rules: permissions, secrets, rules, and irreversible operations.
- Performance/Quality Gate: performance, reliability, and quality gates.
- Docs/Workflow: durable process docs, state, and agent instructions.

## Stage Leads And Pipeline

Each stage has one lead. The lead owns stage quality, not every task's
implementation.

| Stage | Lead | Required support |
| ----- | ---- | ---------------- |
| Spec | Main | P4 always includes PM/Requirements, UX/UI, and Feasibility advisors. |
| Plan | Planner | P3/P4 include Architect and Test Strategist; P1/P2 stay lighter by profile. Single clear P1/P2 slices may use an inline minimum task brief; unclear or multi-slice P1/P2 work uses Planner. |
| Implementation | Main/Dispatcher | Engineers and paired Reviewers by task lane. |
| Debug | Debugger | Engineer may fix only after Debugger root cause and authorization. |
| Verification | Verifier | Fresh command evidence before completion, commit, push, PR, merge, or sync claims. |
| Release | Release Manager | Reviewer PASS, Verifier PASS, and explicit boundary authorization. |

Spec stage is the product design package plus go/no-go gate. Plan stage turns
approved scope into task contracts. Implementation, review, debug,
verification, and release stay separate unless the profile explicitly allows a
lighter path and repo invariants still hold.

## Profile-Based Staffing Matrix

Use the lightest profile that preserves branch/worktree isolation,
Engineer-first edits, Reviewer checks, and fresh evidence.

| Profile | Default staffing |
| ------- | ---------------- |
| P0 | Main plus zero or one Explorer. No writes. |
| P1 | Main, one Generalist Engineer, one Reviewer. Debugger only for unclear failure. Verifier usually optional unless closing out. |
| P2 | Main, one Generalist Engineer, one Reviewer. Add Test Strategist when test surface needs it. Verifier recommended before commit or PR. |
| P3 | Main, Architect advisor, Planner, Test Strategist, one Engineer/Reviewer pair. Debugger mandatory on any failure. Verifier mandatory. Release Manager only for closeout. |
| P4 | Main, PM/Requirements, UX/UI, Feasibility advisor, Architect, Planner, Test Strategist, one to three Engineer/Reviewer lanes, Debugger on failure, Verifier, and Release Manager. |

Implementation uses a mixed Engineer model:

- P1/P2 default to a Generalist Engineer.
- P3/P4 default to layer Engineers when boundaries are clean.
- Use a Feature Lane Engineer when one user-flow slice is safer than a layer
  split.

## Reviewer Matrix

Every repo-changing Engineer lane gets its own Reviewer.

Default to one primary Reviewer. Add a secondary Reviewer only for high-risk
specialized surfaces, such as auth, Firebase rules, schema/migration, secrets,
E2E infrastructure, shared workflow policy, or dependency changes.

Reviewer decisions are limited to:

- `review_passed`
- `review_rejected`
- `blocked`

Reviewers do not fix while reviewing. A rejected task returns to the same
Engineer by default unless the issue is missing context, insufficient model
capability, or a flawed plan.

## Debugger Modes

Debugger uses `superpowers:systematic-debugging` and never skips root-cause
analysis.

Diagnostic mode:

- Read and run only within the approved context.
- Reproduce or characterize the failure.
- Identify root cause, affected boundary, confidence, and next recommended
  action.
- Do not edit files.

Fix mode:

- Requires owned files and edit authorization.
- Keeps changes inside the approved write set.
- Reports root cause, fix, verification, and residual risk.
- Stops instead of widening scope.

After three failed fix attempts for the same symptom, stop for architecture or
user discussion.

## Dispatch Contract

Every subagent dispatch must include:

- Role, stage, profile, task id when applicable, and attempt.
- Worktree or branch and working directory.
- Scope and non-scope.
- Owned files for writable roles.
- Allowed read-only context.
- Authorization boundary: edit, commit, push, PR, merge, and local `main` sync
  are separate. Start/edit authorization does not imply closeout authorization.
- Required skill or protocol.
- Dependencies and same-wave lanes.
- Acceptance criteria and verification commands with expected signal.
- Stop conditions.
- Required output format.

Writable dispatch without owned files is invalid. Read-only dispatch must
explicitly forbid writes.

## Parallel Staffing Rules

Default to one Engineer/Reviewer pair.

Use two or three same-wave pairs only when all conditions hold:

- The Planner dependency graph says there is no ordering dependency.
- Owned files are completely disjoint.
- No lane writes shared helpers, config, lockfiles, workflow state, schema,
  rules, migrations, or generated shared artifacts.
- Every Engineer lane has its own Reviewer.
- A wave final integration gate runs after parallel lanes.

Serialize shared helpers, config, lockfiles, workflow state, schema, rules,
migrations, and release actions.

## Release Tail

Verifier and Release Manager are separate. Release Manager cannot self-verify.

Release Manager may stage, commit, push, open PRs, watch CI, merge, or sync
local `main` only after:

- Reviewer PASS for the relevant diff.
- Verifier PASS with fresh command evidence.
- No workflow state drift.
- Explicit authorization for the exact boundary being crossed.

Closeout remains branch/worktree -> reviewed diff -> fresh verification ->
commit -> push -> PR -> required `ci` and `e2e` green -> GitHub merge -> local
`main` fast-forward when authorized.

## Future Custom Subagent Definitions

Custom `.codex/agents/*.toml` definitions are future work. This repo currently
defines role profiles and dispatch rules in docs only.

When custom definitions are added, they must preserve this reference's role
boundaries, avoid overriding built-in naming unintentionally, and keep repo
workflow precedence above tool defaults.
