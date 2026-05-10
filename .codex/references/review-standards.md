# Review Standards Reference

> Last-Verified: 2026-05-10
> Scope: Minimum reviewer contract for Superpowers task slices in this repo.

This is a small reviewer reference. It defines what a Reviewer must check before
recording PASS or REJECT for a task slice. It does not replace the mechanical
gates in `.codex/references/quality-gates.md` or the testing guidance in
`.codex/references/testing-handbook.md`.

## Reviewer Scope

Review the task-local diff against the approved `spec.md`, `plan.md`, and
`tasks.md` slice. Stay inside the owned files unless the diff proves a wider
contract is affected.

Reviewer checks must cover:

- The implementation matches the task acceptance criteria and does not add
  behavior outside the approved scope.
- The changed files follow the repo architecture, import boundaries, and
  commit-blocking rules summarized in `.codex/references/quality-gates.md`.
- Tests or verification are appropriate for the risk. When executable tests are
  changed or added, use `.codex/references/testing-handbook.md` for the relevant
  unit, integration, server, or E2E patterns.
- The Engineer report lists changed files, commands run, exit codes, evidence,
  and known risks.

## Severity Ordering

Report findings in this order:

1. Correctness or data-loss risk.
2. Security, privacy, permission, or secret-handling risk.
3. Architecture, layer-boundary, or forbidden import violation.
4. Test gap, invalid test, flaky pattern, or missing verification for the changed
   behavior.
5. Maintainability issue that materially increases future change risk.
6. Documentation or naming issue that makes the accepted behavior ambiguous.

Style-only preferences are not REJECT reasons unless they violate an existing
gate or make the code harder to review safely.

## PASS Evidence

A PASS must include:

- `PASS` status.
- Files reviewed.
- Verification commands rerun by the Reviewer, with exit codes.
- Short reason why the diff satisfies the task acceptance criteria.
- Any residual risk that is acceptable for this slice.

Use PASS only when there are no blocking findings for the owned scope.

## REJECT Evidence

A REJECT must include:

- `REJECT` status.
- Blocking finding list ordered by severity.
- File and line reference where possible.
- Expected fix or the specific acceptance criterion that is not met.
- Verification command that failed, if the rejection is evidence from a command.

Do not reject for new scope. Record the scope mismatch and stop for coordinator
or user decision instead.

## Minimum Checklist

Before PASS, confirm:

- The diff is limited to the task-owned files or the task explicitly allows the
  wider edit.
- Acceptance criteria in `tasks.md` are met.
- No production behavior, tests, docs, or workflow requirements were added
  outside the approved MVP.
- Required metadata and references are present when the task is documentation
  work.
- Relevant quality gates from `.codex/references/quality-gates.md` are not
  violated by the diff.
- Relevant testing patterns from `.codex/references/testing-handbook.md` are
  followed when tests are in scope.
- Engineer evidence includes files, commands, exit codes, and risks.
