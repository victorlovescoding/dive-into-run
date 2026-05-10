# Tech Debt Tracker

> Last Updated: 2026-05-11

## Purpose

This is the long-lived repo tracker for actionable technical debt that should
survive individual sessions, PR reviews, and handoff files.

Use this file for debt that is:

- still actionable
- likely to matter across multiple future sessions
- tied to product, architecture, testing, CI, docs, or workflow quality
- traceable to a concrete report, review, or durable repo source

Do not use this file for session status, vague notes, one-off observations, or
items that already have an immediate task owner in an active feature plan.

## Update Rules

- Add a new item when a review, audit, or implementation session finds
  acceptable-but-not-fixed debt that should remain discoverable.
- Keep each item small enough for one focused future task or one clear planning
  slice.
- Use only these statuses: Open, Deferred, In Progress, Resolved.
- Move items to Resolved Items only after the fix lands and the relevant
  verification is known.
- Prefer linking future work to this tracker from `specs/<feature>/plan.md`,
  `tasks.md`, or PR descriptions instead of copying full audit text.
- Do not add raw session state. Session state belongs in `handoff.md` and
  `status.json`.
- If an item becomes a mechanical rule, CI gate, lint rule, or script, update
  this tracker with the new enforcement path.

## Open Items

| ID | Severity | Domain | Description | Origin | Status | Next Trigger |
| --- | --- | --- | --- | --- | --- | --- |
| TD-001 | High | Firestore rules | Non-host event update rules currently allow adding unrelated fields through a known gap test, so the rules gate can preserve a security hole as passing behavior. | 2026-05-10 test quality review P0 Firestore rules | Open | Next Firestore rules change or dedicated security-rules cleanup. |
| TD-006 | Medium | Integration tests | Integration tests can still mock broad internal surfaces such as `@/components`, `@/contexts`, and `@/app`, which can turn integration tests into shallow contract tests. | 2026-05-10 tests enforcement audit P1 integration mocks | Open | After P0 test gates are fixed; start with warning-mode audit. |
| TD-007 | Medium | Async tests | Dense `waitFor` callbacks and call-order assertions inside `waitFor` remain possible and can hide flaky timing coupling. | 2026-05-10 tests enforcement audit P1 waitFor density | Open | Next audit-script expansion or async test cleanup. |
| TD-008 | Medium | E2E | Some CI E2E specs are skipped, external-key dependent, or thinner than their names imply, so green E2E can overstate user-flow coverage. | 2026-05-10 test quality review P1 skipped thin E2E | Open | Next E2E feature work touching run calendar, weather, or events join/leave. |
| TD-009 | Medium | Test helpers | Notification scroll test helper mirrors production logic and has drifted from the real hook behavior, so helper-based tests can pass while production polling/retry behavior regresses. | 2026-05-10 test quality review P2 helper drift | Open | Next notification scroll/highlight test work. |
| TD-010 | Medium | Quality tracking | `docs/QUALITY_SCORE.md` is useful but manually updated; there is no quality-score update script or recurring scan feeding this tracker. | 2026-04-24 round1 Gap M quality GC | Deferred | When quality score updates become stale or a scheduled maintenance workflow is approved. |

## Resolved Items

| ID | Description | Resolved In | Date |
| --- | --- | --- | --- |
| RD-001 | Quality score matrix created and later updated with coverage include expansion plus per-directory thresholds. | `docs/QUALITY_SCORE.md`; OpenAI Gap A update | 2026-05-03 |
| RD-002 | A11y eslint-disable ban, source max-lines limit, and JSDoc severity upgrades were promoted into executable ESLint gates. | OpenAI Gap D update | 2026-05-10 |
| RD-003 | Mock-boundary and flaky-pattern audits exist locally and currently report zero findings for their target patterns. | 2026-05-10 tests enforcement audit | 2026-05-10 |
| RD-004 | Internal provider mocks targeted by the 031 cleanup were removed, while broader integration mock debt remains tracked separately. | OpenAI Gap D update | 2026-05-10 |
| RD-005 | Mock-boundary audit was added to GitHub CI so the final gate matches the local pre-commit blocker. | `ci.yml` mock-boundary step | 2026-05-11 |
| RD-006 | E2E branch routing now classifies `comment-notifications.spec.js` as emulator-backed instead of vanilla. | `scripts/test-e2e-branch.sh` | 2026-05-11 |
| RD-007 | E2E emulator project ID now uses `demo-test` consistently through runner env and shared helpers. | `scripts/run-all-e2e.sh`; `tests/_helpers/e2e-helpers.js`; `scripts/test-e2e-branch.sh` | 2026-05-11 |
| RD-008 | Branch test routing now treats `tests/server/**` and Firestore rules changes as server test work. | `scripts/test-branch.sh` | 2026-05-11 |
| RD-009 | Doc freshness now has a script and CI gate, with Last-Verified metadata checked for key docs. | `scripts/doc-freshness-check.sh`; `package.json`; `ci.yml` | 2026-05-11 |
| RD-010 | Current workflow status files now have a canonical schema and validator while historical specs remain legacy evidence unless upgraded. | `docs/superpowers/status.schema.json`; `scripts/validate-workflow-state.js` | 2026-05-11 |

## Source Notes

- `2026-04-24 OpenAI Gap B` defines this tracker as versioned, co-located,
  and separate from scattered handoff files.
- `docs/QUALITY_SCORE.md` is a quality matrix, not a debt tracker. Its known
  gaps are evidence sources, not replacements for this file.
- `2026-05-10 tests enforcement audit` is the main source for remaining
  executable gate gaps: integration internal mocks, `waitFor` density, and E2E
  skip/network rules.
- `2026-05-10 test quality review` is the main source for confidence gaps:
  Firestore rules known-gap tests, thin E2E, async negative assertions,
  integration/unit classification drift, and helper logic drift.
- Excluded from Open Items: completed Gap A, completed Gap D1/D2/D3,
  completed provider mock cleanup, broad mutation testing, generic specs index
  work, and one-off observations without a concrete next trigger.
