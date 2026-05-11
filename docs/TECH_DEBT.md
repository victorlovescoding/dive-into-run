# Tech Debt Tracker

> Last Updated: 2026-05-12

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
| TD-001 | High | Firestore rules | Non-host event update rules still use changedKeys() for the seat-counter allowlist, so adding a brand-new unrelated field remains allowed and is documented by an assertSucceeds known-gap test. | 2026-05-10 test quality review P0 Firestore rules; 2026-05-12 read-only recheck | Open | Next Firestore rules change or dedicated security-rules cleanup using affectedKeys() or an equivalent full-field allowlist. |
| TD-006 | Medium | Integration tests | Integration tests still mock broad UI/App surfaces such as `@/components`, `@/contexts`, and `@/app`, which can turn integration tests into shallow contract tests. Existing mock-boundary gates block `@/lib`, `@/repo`, `@/service`, and non-provider `@/runtime` mocks, but do not cover these broader UI/app/context mocks. | 2026-05-10 tests enforcement audit P1 integration mocks; 2026-05-12 read-only recheck | Open | Next integration-test cleanup or expansion of mock-boundary audit scope. |
| TD-007 | Medium | Async tests | Flaky async patterns are partially gated: CI blocks `toHaveBeenCalledTimes`, fixed sleeps, `page.waitForTimeout`, `waitFor` side effects, and multiple assertions inside a single `waitFor`. Remaining debt is high `waitFor` density plus call-order/count-like assertions such as `mock.calls.length >= N` or `toHaveBeenLastCalledWith` inside async waits. | 2026-05-10 tests enforcement audit P1 waitFor density; 2026-05-12 read-only recheck | Open | Next async test cleanup or expansion of flaky-pattern audit to cover waitFor density and call-order/count-like waits. |
| TD-008 | Medium | E2E | CI E2E still overstates coverage because `run-calendar.spec.js` is entirely skipped, `weather-page.spec.js` skips without `CWA_API_KEY`, and `events-page.spec.js` is named like a join/leave flow but only verifies render smoke behavior. Seeded emulator routing has improved for most feature specs, so the remaining debt is focused on run calendar seeding, deterministic weather stubbing, and real events join/leave coverage. | 2026-05-10 test quality review P1 skipped thin E2E; 2026-05-12 read-only recheck | Open | Next E2E work touching run calendar auth/Strava seed setup, weather API stubbing, or events join/leave flows. |
| TD-009 | Medium | Test helpers | Notification scroll helper still uses an obsolete one-shot timer and mirrors production behavior instead of importing or asserting the real scroll hook. Production post/event paths have partial direct unit/integration/E2E coverage, but helper-based tests can still pass while retry/max-attempt behavior regresses. | 2026-05-10 test quality review P2 helper drift; 2026-05-12 read-only recheck | Open | Replace helper-based notification scroll tests with real hook/component coverage, especially retry and max-attempt cases. |
| TD-010 | Medium | Quality tracking | `docs/QUALITY_SCORE.md` remains a manually maintained quality snapshot. `doc:freshness` and CI now guard Last-Verified metadata freshness only; there is still no quality-score generation/update script or recurring scan that recomputes layer/domain scores. | 2026-04-24 round1 Gap M quality GC; 2026-05-12 read-only recheck | Deferred | When score data becomes stale, add a script that computes the matrix inputs and optionally opens or updates this tracker. |

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
- `2026-05-12 read-only recheck` confirmed every Open Item still needs
  follow-up; the main changes were narrower descriptions for TD-006 through
  TD-010 and explicit recognition that doc freshness does not automate quality
  scoring.
- Excluded from Open Items: completed Gap A, completed Gap D1/D2/D3,
  completed provider mock cleanup, broad mutation testing, generic specs index
  work, and one-off observations without a concrete next trigger.
