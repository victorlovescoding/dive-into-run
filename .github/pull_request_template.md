<!--
  GitHub renders this template into the PR description editor for new PRs
  whose base branch contains this file. Author: fill in Summary / Test Plan
  / Related; tick the Audit Checklist boxes. If a checkbox does not apply,
  leave it unchecked AND add a one-line note in the PR description (do not
  delete the line — reviewers run grep over the rendered body).
-->

## Summary

<!--
  1-3 bullet points: the why, the what, and any cross-cutting impact.
  Example:
  - Add Firestore rules unit test for posts.likes collectionGroup (P0-2).
  - Adjust client read path so unauthenticated users hit deny branch first.
  - Affects tests/server/rules/, no production code change.
-->

## Test Plan

<!--
  Bulleted checklist of the verifications you ran locally + on CI.
  Replace the placeholders below with the exact commands and outputs.
-->

- [ ] `npm test` — browser project green (record file/test counts)
- [ ] `npm run test:server` — server project green (or N/A, with reason)
- [ ] Affected E2E specs green (`npx playwright test ...`) — or N/A
- [ ] `npm run lint` / `npm run type-check` / `npm run spellcheck` green

## Audit Checklist

<!--
  Four sub-sections derived from the 026 tests audit
  (project-health/2026-04-29-tests-audit-report.md). Tick every box that
  applies to this PR; unchecked boxes need a one-line justification in the
  PR description so reviewers can mechanically diff the audit posture.
-->

### Mock boundary

- [ ] Any new/changed test in this PR does **not** mock `@/lib/**`, `@/repo/**`, `@/service/**`, or `@/runtime/**` (except `@/runtime/providers/**`). These layers are inside the mock-boundary cleanup scope. [P0-1, audit L77-95; anti-pattern sample audit L83]
- [ ] Allowed boundary mocks are limited to repo-external or approved edge boundaries: `@/config/**`, `@/runtime/providers/**`, `@/contexts/**`, `@/data/**`, Firebase SDK/Admin SDK, third-party SDKs, browser APIs, and external fetch/network calls. [P0-1, audit L77-95; specs/027-tests-mock-cleanup]

### Flaky pattern

- [ ] Any new test in this PR does **not** introduce `toHaveBeenCalledTimes(N)` (unless N has explicit semantic meaning); prefer `toHaveBeenCalled()`, `toHaveBeenLastCalledWith(...)`, or `toHaveBeenNthCalledWith(n, ...)`. [P1-4, audit L294-305; anti-pattern sample audit L295 `useStravaActivities.test.jsx:268`]
- [ ] Any new test in this PR does **not** use `await new Promise(r => setTimeout(r, N))` paired with `act()` as a hard wait; use `waitFor(() => expect(...))` or `vi.useFakeTimers()` + `vi.runAllTimersAsync()` instead. [P1-5, audit L309-318; anti-pattern sample audit L311 `useStravaConnection.test.jsx:75-96`]

### Firestore rules

- [ ] If this PR modifies `firestore.rules`, a matching negative-path test was added under `tests/server/rules/` (unauthenticated read denied, cross-user update denied, forged `recipientUid` denied, etc.). [P0-2, audit L113-141; five critical paths at audit L125-129]
- [ ] If this PR touches any of the five critical paths — `posts/{postId}/likes/{uid}` collectionGroup (rules L80-84) / Strava tokens read-only (L113-123) / event seat consistency (L151-166) / events participants cascade (L180-183) / notification `recipientUid` (L248-254) — a corresponding rules unit test is linked in this PR description. [P0-2, audit L121-129]

### Coverage

- [ ] If this PR adds files under `src/ui/**`, `src/components/**`, or `src/app/**`, the vitest coverage `include` glob in `vitest.config.mjs` already covers that directory (avoid the `not displayed` blackhole described at audit L172-181: 55 + 17 + 15 files currently absent from the report). [P0-4, audit L168-181]
- [ ] If this PR changes `vitest.config.mjs` `thresholds`, a baseline report is attached showing per-directory threshold deltas (e.g. `src/ui/**` lines 30 -> 35), aligned with the per-directory `+5 per sprint` ramp at audit L188-204. [P0-4, audit L185-206]

## Related

<!--
  Links: closing issues, spec directory, audit report, related PRs.
  Example:
  - Closes #NN
  - Spec: specs/0XX-feature-slug/
  - Audit: project-health/2026-04-29-tests-audit-report.md (Lxx-yy)
  - Depends on: #MM
-->
