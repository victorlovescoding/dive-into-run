# CSP Triage PR B Design

## Goal

Create a durable design for CSP triage PR B that improves source visibility,
test coverage, and evidence quality without changing current security behavior.

The approved approach is Approach A: keep the existing report-only CSP model and
do not add a report collector endpoint.

## Problem

Current CSP behavior is difficult to review because the allowlist is hard-coded
in `next.config.mjs`, test assertions duplicate expected sources, and browser
evidence does not prove every source is still runtime-required.

Known current state:

- CSP is emitted as `Content-Security-Policy-Report-Only` from
  `next.config.mjs`.
- No enforced `Content-Security-Policy` header is emitted.
- No `report-uri`, `report-to`, or report collector route exists.
- Existing security tests assert report-only presence and enforced CSP absence,
  but unit coverage is partial and the allowlist is duplicated.
- Browser-level evidence is weak for OSM tiles, Nominatim, CWA icon/image,
  Firebase Storage media, and Strava browser `connect-src`.

## Scope

- Structure CSP directives and source inventory in `next.config.mjs` while
  preserving the current report-only header behavior.
- Add a runbook/inventory document that classifies every CSP source as
  runtime-required, dev-only, legacy, or unknown.
- Record each source's purpose, evidence, owner, and expiry when applicable.
- Strengthen security header unit and E2E test design for exact directives,
  report-only presence, enforced CSP absence, and key route coverage.
- Add an evidence inventory for sources whose runtime need is weak or unknown.

## Non-Scope

- Do not add CSP enforcement.
- Do not add a CSP collector endpoint.
- Do not hard gate CSP on violation reporting.
- Do not change HSTS preload.
- Do not remove CSP sources in PR B. Evidence collected in PR B may justify a
  later approved task, but PR B must not remove sources.
- Do not change application runtime behavior, Firebase behavior, Strava flows,
  weather behavior, map behavior, or media loading behavior.

## Design

1. Keep report-only behavior as the compatibility boundary.
   - `next.config.mjs` remains the source of the emitted report-only header.
   - The implementation must continue omitting the enforced
     `Content-Security-Policy` header.
   - No `report-uri` or `report-to` directive is introduced.

2. Make the CSP source model reviewable.
   - Represent directives and sources in structured constants before joining
     them into the final header string.
   - Keep source ordering deterministic so tests can assert exact output.
   - Prefer one source definition path that tests can import or mirror through a
     stable helper, avoiding independent allowlist copies.

3. Add a maintained CSP source inventory/runbook.
   - Classify each source as `runtime-required`, `dev-only`, `legacy`, or
     `unknown`.
   - Include purpose, route or feature dependency, evidence link or command,
     owner, and expiry/revisit date when the source is not clearly permanent.
   - Treat `unknown` as a triage label, not approval to remove the source.

4. Define future removal rules.
   - A source can be proposed for removal only after browser or automated
     evidence shows it is unused for covered routes and a Reviewer confirms the
     evidence.
   - Removal proposals must happen in a later approved implementation slice,
     not in PR B.

## Evidence Inventory

PR B must document the evidence needed and current status for each source. It
may capture low-cost browser or request evidence when practical, but missing
browser evidence does not block PR B; classify the source as
`unknown`/`needs-evidence` with owner and revisit date instead.

Initial evidence categories:

| Source area | Current confidence | Required evidence |
| --- | --- | --- |
| OSM tiles | Weak | Browser route evidence showing map tile requests or absence on map routes. |
| Nominatim | Weak | Browser evidence for geocoding/search route behavior and request origin. |
| CWA icon/image | Weak | Weather UI evidence for icon/image loads and fallback behavior. |
| Firebase Storage media | Weak | Browser evidence for post/event media rendering and source host. |
| Strava browser `connect-src` | Weak | OAuth/sync browser evidence showing whether browser-side requests occur. |
| Dev-only sources | Unknown until classified | Local dev evidence proving they are not required in production headers. |
| Legacy sources | Unknown until classified | Historical or runtime evidence plus owner decision and expiry. |

Evidence should name the route, feature, observed request/header, command or
screenshot source, date, and confidence level.

Minimum key route coverage for PR B is:

- `/events`
- `/api/strava/webhook?hub.mode=subscribe`

Any additional key route must be listed by the future implementation task
contract before that route becomes required coverage.

## Testing

Future implementation should add or strengthen these checks:

- `npm run test:security-headers`
  - Assert exact report-only CSP directives and deterministic source ordering.
  - Assert `Content-Security-Policy-Report-Only` is present.
  - Assert enforced `Content-Security-Policy` is absent.
  - Cover key server routes that should receive security headers.

- `npm run test:e2e:security-headers`
  - Assert browser-visible headers on key app routes.
  - Preserve report-only behavior.
  - Capture evidence for weak source areas when practical.

- `npm run lint:changed`
  - Verify docs/config/test style for changed files.

- `npm run type-check:changed`
  - Verify JSDoc and imported helper shapes when CSP constants become shared.

## Subagent Workflow

- Engineer owns the implementation slice and may edit only the files approved by
  the task contract.
- Future implementation may edit `next.config.mjs` and security tests only when
  they are included in that task's approved write set.
- Reviewer checks the task-local diff against this spec before completion.
- Any source removal, CSP enforcement, collector endpoint, or HSTS preload
  change is out of bounds and requires a new approved task.
- Verification evidence must be fresh and command-specific; do not reuse stale
  transcript claims.
- If browser evidence is inconclusive, classify the source as `unknown` with an
  owner and expiry rather than removing it.

## Stop Conditions

Stop and ask for a new decision if implementation would require any of these:

- Adding an enforced CSP header.
- Adding a collector endpoint, `report-uri`, or `report-to`.
- Hard-gating CI or runtime behavior on CSP violation collection.
- Changing HSTS preload.
- Removing any CSP source in PR B. Implementation evidence and Reviewer support
  may only justify a later approved task.
- Editing production code, tests, package files, backlog docs, or any other
  file outside the approved write set for the current task. This does not block
  intended future edits to `next.config.mjs` or security tests when those files
  are explicitly included in that task's approved write set.
