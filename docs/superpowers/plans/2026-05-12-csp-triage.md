# CSP Triage PR B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve CSP PR B reviewability by centralizing report-only CSP construction, documenting source evidence, and strengthening security-header tests without changing current security behavior.

**Architecture:** Keep `next.config.mjs` as the compatibility boundary that emits `Content-Security-Policy-Report-Only` and omits enforced `Content-Security-Policy`. Move CSP directive construction behind exported helpers so unit and E2E tests can assert deterministic output from one source of truth, while a maintained runbook records source purpose, evidence status, owner, and revisit dates.

**Tech Stack:** Next.js 15 config (`next.config.mjs`), JavaScript ES modules with JSDoc `checkJs`, Vitest security-header unit tests, Playwright E2E request tests, Markdown runbook docs.

---

## Profile And Authorization

- Profile: P3.
- Classification: C3 because this touches shared security config, unit tests, E2E tests, and maintained documentation; R3 because security headers and E2E coverage are shared infrastructure even though PR B is report-only.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-055-csp-triage`.
- Branch: `055-csp-triage`.
- Automation boundary for this plan's execution: Engineer subagents may edit only the owned files listed in their task. Do not commit, push, open a PR, merge, or sync `main` unless the main agent later receives explicit authorization.
- Required roles: every repo-changing task needs an Engineer result and a Reviewer decision before the task is complete.

## Global Non-Scope

- Do not add an enforced `Content-Security-Policy` response header.
- Do not add a CSP collector endpoint, `report-uri`, or `report-to`.
- Do not hard gate CI, runtime behavior, or PR completion on collected CSP violations.
- Do not change HSTS preload behavior or the existing production HSTS string.
- Do not remove CSP sources in PR B. Missing browser evidence may be classified as `unknown` or `needs-evidence` with owner and revisit date rather than blocking PR B.
- Do not change app runtime behavior, Firebase behavior, Strava flows, weather behavior, map behavior, image loading behavior, package dependencies, or lockfiles.
- Do not touch backlog docs or `specs/**` in PR B implementation unless a later approved task explicitly changes the write set.

## Files And Ownership

- Modify: `next.config.mjs`
  - Owner: CSP Config Engineer.
  - Responsibility: export CSP directive constants and helper functions, keep deterministic report-only header output, preserve HSTS behavior and existing Next config behavior.
- Modify: `tests/unit/config/security-headers.test.js`
  - Owner: CSP Config Engineer.
  - Responsibility: assert exact CSP directives/order through exported config helpers and confirm report-only presence plus enforced CSP absence.
- Create: `docs/security/csp-source-inventory.md`
  - Owner: CSP Runbook Engineer.
  - Responsibility: maintained CSP source inventory with classification, purpose, feature route, evidence, owner, and revisit date.
- Modify: `tests/e2e/security-headers.spec.js`
  - Owner: Security E2E Engineer.
  - Responsibility: strengthen browser-visible security header assertions for key routes using the same exact directive expectations.
- Read-only integration context: `package.json`, `docs/superpowers/specs/2026-05-12-csp-triage-design.md`, `AGENTS.md`, `docs/superpowers/workflow.md`, `docs/superpowers/task-profiles.md`.

## Target CSP Helper Contract

The CSP config task should converge on this exported helper shape in `next.config.mjs`:

```js
export const CSP_REPORT_ONLY_DIRECTIVES = Object.freeze({
  'default-src': Object.freeze(["'self'"]),
  'base-uri': Object.freeze(["'self'"]),
  'form-action': Object.freeze(["'self'"]),
  'frame-ancestors': Object.freeze(["'none'"]),
  'object-src': Object.freeze(["'none'"]),
  'script-src': Object.freeze(["'self'", "'unsafe-inline'", "'unsafe-eval'"]),
  'style-src': Object.freeze(["'self'", "'unsafe-inline'"]),
  'img-src': Object.freeze([
    "'self'",
    'data:',
    'blob:',
    'https://lh3.googleusercontent.com',
    'https://firebasestorage.googleapis.com',
    'https://*.tile.openstreetmap.org',
    'https://www.cwa.gov.tw',
  ]),
  'font-src': Object.freeze(["'self'", 'data:']),
  'connect-src': Object.freeze([
    "'self'",
    'http://localhost:*',
    'ws://localhost:*',
    'https://*.googleapis.com',
    'https://*.firebaseio.com',
    'https://*.firebaseapp.com',
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://firestore.googleapis.com',
    'https://firebaseinstallations.googleapis.com',
    'https://firebase.googleapis.com',
    'https://firebasestorage.googleapis.com',
    'https://www.strava.com',
    'https://nominatim.openstreetmap.org',
  ]),
});

export function buildCspReportOnlyHeaderValue() {
  return Object.entries(CSP_REPORT_ONLY_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}
```

`buildSecurityHeaders()` may remain unexported unless tests need it. If tests import `nextConfig.headers()` only, do not export extra helpers beyond the directive constant and CSP builder.

## Dependency Graph And Waves

- Wave 1, Task 1: CSP constants/header helper refactor plus unit tests. Blocks Task 2 because the inventory should reference the finalized source list and exact header string.
- Wave 2, Task 2: CSP inventory/runbook document. Depends on Task 1 for the final directive/source list.
- Wave 3, Task 3: E2E security header strengthening. Depends on Task 2 because it reads `docs/security/csp-source-inventory.md`, and therefore cannot run in parallel with Task 2.
- Wave 4, Task 4: final verification and Reviewer integration. Depends on Task 1, Task 2, and Task 3.

## Task 1: CSP Constants And Unit Tests

**Files:**

- Modify: `next.config.mjs`
- Modify: `tests/unit/config/security-headers.test.js`
- Read-only context: `package.json`, `docs/superpowers/specs/2026-05-12-csp-triage-design.md`
- Forbidden: E2E tests, docs, package files, lockfiles, app code, route handlers

- [ ] **Step 1: Confirm branch and task boundary**

Run:

```bash
git status --short --branch
```

Expected: branch is `055-csp-triage`; no unowned changes in `next.config.mjs` or `tests/unit/config/security-headers.test.js`. If either file has unrelated user edits, stop and ask the main agent how to proceed.

- [ ] **Step 2: Write the failing exact-CSP unit assertions first**

In `tests/unit/config/security-headers.test.js`, replace partial `REQUIRED_CSP_SOURCES` assertions with an exact directive contract imported from `next.config.mjs`:

```js
import nextConfig, {
  CSP_REPORT_ONLY_DIRECTIVES,
  buildCspReportOnlyHeaderValue,
} from '../../../next.config.mjs';

const EXPECTED_CSP_REPORT_ONLY = Object.entries(CSP_REPORT_ONLY_DIRECTIVES)
  .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
  .join('; ');
```

Add a focused test:

```js
it('builds the exact deterministic CSP report-only header from exported directives', () => {
  expect(buildCspReportOnlyHeaderValue()).toBe(EXPECTED_CSP_REPORT_ONLY);
  expect(buildCspReportOnlyHeaderValue()).toBe(
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://*.tile.openstreetmap.org https://www.cwa.gov.tw; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:* https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://firebasestorage.googleapis.com https://www.strava.com https://nominatim.openstreetmap.org",
  );
});
```

Update the existing global header test to assert the exact CSP value:

```js
expect(headers.has('content-security-policy')).toBe(false);
expect(headers.get('content-security-policy-report-only')).toBe(EXPECTED_CSP_REPORT_ONLY);
```

Expected: this fails before implementation if `CSP_REPORT_ONLY_DIRECTIVES` or `buildCspReportOnlyHeaderValue` is not exported.

- [ ] **Step 3: Run the failing unit test**

Run:

```bash
npm run test:security-headers
```

Expected before implementation: FAIL with an import/export error for `buildCspReportOnlyHeaderValue` or `CSP_REPORT_ONLY_DIRECTIVES`, or FAIL because the existing test still sees a non-exported helper.

- [ ] **Step 4: Export the minimal CSP helper implementation**

In `next.config.mjs`, export `CSP_REPORT_ONLY_DIRECTIVES` and add:

```js
export function buildCspReportOnlyHeaderValue() {
  return Object.entries(CSP_REPORT_ONLY_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

const cspReportOnly = buildCspReportOnlyHeaderValue();
```

Keep these invariants unchanged:

```js
const DEVELOPMENT_HSTS = 'max-age=0';
const PRODUCTION_HSTS = 'max-age=63072000; includeSubDomains; preload';
```

Do not add `report-uri`, `report-to`, an enforced CSP header, or any new CSP source.

- [ ] **Step 5: Run unit test to verify it passes**

Run:

```bash
npm run test:security-headers
```

Expected: exits 0. The exact CSP report-only value matches the exported directive order, `Content-Security-Policy-Report-Only` is present, `Content-Security-Policy` is absent, and HSTS development/production behavior is unchanged.

- [ ] **Step 6: Run changed-file static checks**

Run:

```bash
npm run lint:changed
```

Expected: exits 0.

Run:

```bash
npm run type-check:changed
```

Expected: exits 0.

- [ ] **Step 7: Engineer report**

Return:

- changed files: `next.config.mjs`, `tests/unit/config/security-headers.test.js`.
- verification commands with exit codes.
- confirmation that no enforced CSP header, collector endpoint, HSTS preload change, source removal, package change, or runtime behavior change was made.

- [ ] **Step 8: Reviewer check**

Reviewer reads only:

- `git diff -- next.config.mjs tests/unit/config/security-headers.test.js`
- `npm run test:security-headers` output summary
- `npm run lint:changed` output summary
- `npm run type-check:changed` output summary

PASS criteria:

- tests import the exported directive/helper contract rather than duplicating a partial allowlist.
- exact CSP order and value are asserted.
- enforced CSP remains absent.
- HSTS strings and behavior are unchanged.
- no out-of-scope file was edited.

REJECT criteria:

- any CSP source is removed.
- `report-uri`, `report-to`, collector endpoint, or enforced CSP is added.
- HSTS preload behavior changes.
- tests still duplicate only a partial allowlist.

- [ ] **Step 9: Commit checkpoint only after Reviewer PASS and explicit commit authorization**

Run only when authorized:

```bash
git add next.config.mjs tests/unit/config/security-headers.test.js
git commit -m "test: centralize csp report-only header assertions"
```

Expected: commit succeeds with only the two owned files staged.

## Task 2: CSP Source Inventory Runbook

**Files:**

- Create: `docs/security/csp-source-inventory.md`
- Read-only context: `next.config.mjs`, `docs/superpowers/specs/2026-05-12-csp-triage-design.md`, `docs/TECH_DEBT.md`, `docs/decisions/INDEX.md`
- Forbidden: config files, tests, package files, app code, backlog docs, `specs/**`

- [ ] **Step 1: Confirm branch and task boundary**

Run:

```bash
git status --short --branch
```

Expected: branch is `055-csp-triage`; no existing unowned `docs/security/csp-source-inventory.md`. If the file exists with unrelated edits, stop and ask the main agent how to proceed.

- [ ] **Step 2: Create the runbook with the fixed sections**

Create `docs/security/csp-source-inventory.md`:

```markdown
# CSP Source Inventory

> Last-Verified: 2026-05-12

## Purpose

Tracks the report-only CSP source inventory for PR B triage. This document does
not approve source removal; it records source purpose, evidence status, owner,
and revisit dates for later approved work.

## Compatibility Boundary

- Current emitted header: `Content-Security-Policy-Report-Only`.
- Current enforced header: absent by design.
- No `report-uri` or `report-to` directive is configured.
- PR B may classify missing browser evidence as `unknown` or `needs-evidence`.
- CSP source removal requires a later approved task with browser or automated
  evidence and Reviewer confirmation.

## Source Inventory

| Directive | Source | Classification | Purpose | Route or feature dependency | Evidence status | Owner | Revisit date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `default-src` | `'self'` | runtime-required | Baseline same-origin fallback. | All routes | Covered by security-header tests. | Security | Permanent |
| `base-uri` | `'self'` | runtime-required | Restricts document base URL. | All document routes | Covered by exact CSP unit test. | Security | Permanent |
| `form-action` | `'self'` | runtime-required | Restricts same-origin form submissions. | Auth and app forms | Covered by exact CSP unit test. | Security | Permanent |
| `frame-ancestors` | `'none'` | runtime-required | Prevents framing. | All routes | Covered by unit and E2E security-header tests. | Security | Permanent |
| `object-src` | `'none'` | runtime-required | Blocks plugin/object loads. | All routes | Covered by unit and E2E security-header tests. | Security | Permanent |
| `script-src` | `'self'` | runtime-required | Allows same-origin scripts. | App shell | Covered by exact CSP unit test. | Security | Permanent |
| `script-src` | `'unsafe-inline'` | unknown | Compatibility for framework/runtime inline scripts while report-only. | App shell | Needs production browser evidence before removal proposal. | Frontend | 2026-06-12 |
| `script-src` | `'unsafe-eval'` | unknown | Compatibility for dev/framework tooling while report-only. | App shell and local dev | Needs production build evidence before classification changes. | Frontend | 2026-06-12 |
| `style-src` | `'self'` | runtime-required | Allows same-origin styles. | App shell | Covered by exact CSP unit test. | Frontend | Permanent |
| `style-src` | `'unsafe-inline'` | unknown | Compatibility for inline styles from framework or map libraries. | App shell, maps | Needs browser evidence before removal proposal. | Frontend | 2026-06-12 |
| `img-src` | `'self'` | runtime-required | Allows same-origin images. | App shell and media | Covered by exact CSP unit test. | Frontend | Permanent |
| `img-src` | `data:` | runtime-required | Allows inline image/data URL fallbacks. | Icons and UI fallbacks | Covered by exact CSP unit test; browser need remains needs-evidence. | Frontend | 2026-06-12 |
| `img-src` | `blob:` | unknown | Allows blob image previews or generated media. | Media previews | Needs browser evidence before removal proposal. | Frontend | 2026-06-12 |
| `img-src` | `https://lh3.googleusercontent.com` | runtime-required | Allows Google profile images. | Auth profile display | Covered by Next image remote pattern and exact CSP unit test. | Auth | 2026-06-12 |
| `img-src` | `https://firebasestorage.googleapis.com` | unknown | Allows Firebase Storage media. | Posts/events media | Needs browser route evidence for rendered media host. | Media | 2026-06-12 |
| `img-src` | `https://*.tile.openstreetmap.org` | unknown | Allows OSM map tile images. | Event map routes | Needs browser route evidence for map tile requests or absence. | Maps | 2026-06-12 |
| `img-src` | `https://www.cwa.gov.tw` | unknown | Allows CWA weather icon/image assets. | Weather UI | Needs browser evidence for icon/image loads and fallback behavior. | Weather | 2026-06-12 |
| `font-src` | `'self'` | runtime-required | Allows same-origin fonts. | App shell | Covered by exact CSP unit test. | Frontend | Permanent |
| `font-src` | `data:` | unknown | Allows data URL fonts if framework or assets need them. | App shell | Needs production build/browser evidence. | Frontend | 2026-06-12 |
| `connect-src` | `'self'` | runtime-required | Allows same-origin API and route-handler requests. | All app/API routes | Covered by unit and E2E security-header tests. | Security | Permanent |
| `connect-src` | `http://localhost:*` | dev-only | Allows local development HTTP requests while report-only. | Local dev | Covered by exact CSP unit test; not required as production evidence. | Developer Experience | 2026-06-12 |
| `connect-src` | `ws://localhost:*` | dev-only | Allows local dev WebSocket connections. | Local dev | Covered by exact CSP unit test; not required as production evidence. | Developer Experience | 2026-06-12 |
| `connect-src` | `https://*.googleapis.com` | runtime-required | Allows Google/Firebase APIs. | Auth and Firebase services | Covered by exact CSP unit test. | Firebase | 2026-06-12 |
| `connect-src` | `https://*.firebaseio.com` | runtime-required | Allows Firebase realtime service endpoints if used by SDK. | Firebase SDK | Covered by exact CSP unit test; browser evidence still useful. | Firebase | 2026-06-12 |
| `connect-src` | `https://*.firebaseapp.com` | runtime-required | Allows Firebase app-hosted service endpoints if used by SDK. | Firebase SDK | Covered by exact CSP unit test; browser evidence still useful. | Firebase | 2026-06-12 |
| `connect-src` | `https://identitytoolkit.googleapis.com` | runtime-required | Allows Firebase Auth identity toolkit. | Auth flows | Covered by exact CSP unit and E2E tests. | Auth | 2026-06-12 |
| `connect-src` | `https://securetoken.googleapis.com` | runtime-required | Allows Firebase Auth token refresh. | Auth flows | Covered by exact CSP unit test. | Auth | 2026-06-12 |
| `connect-src` | `https://firestore.googleapis.com` | runtime-required | Allows Firestore SDK calls. | App data loading | Covered by exact CSP unit and E2E tests. | Firebase | 2026-06-12 |
| `connect-src` | `https://firebaseinstallations.googleapis.com` | runtime-required | Allows Firebase installation service calls. | Firebase SDK initialization | Covered by exact CSP unit test. | Firebase | 2026-06-12 |
| `connect-src` | `https://firebase.googleapis.com` | runtime-required | Allows Firebase service endpoints. | Firebase SDK | Covered by exact CSP unit test. | Firebase | 2026-06-12 |
| `connect-src` | `https://firebasestorage.googleapis.com` | unknown | Allows Firebase Storage browser requests. | Posts/events media | Needs browser evidence for media rendering or upload flows. | Media | 2026-06-12 |
| `connect-src` | `https://www.strava.com` | unknown | Allows browser-side Strava requests if OAuth/sync uses them. | Strava OAuth/sync | Needs browser evidence showing whether browser-side requests occur. | Integrations | 2026-06-12 |
| `connect-src` | `https://nominatim.openstreetmap.org` | unknown | Allows geocoding/search requests. | Map search/geocoding | Needs browser evidence for geocoding/search route behavior. | Maps | 2026-06-12 |

## Evidence Rules

- Runtime-required: covered by tests or browser evidence and expected to remain.
- Dev-only: needed for local development, not proof of production runtime need.
- Legacy: kept for historical compatibility with owner and revisit date.
- Unknown: source remains allowed in PR B but requires evidence before later removal or permanent classification.
- Needs-evidence: current label for weak browser evidence; not a blocker for PR B.

## Future Removal Rules

1. Collect browser or automated evidence for covered routes.
2. Confirm the source is unused or superseded for those routes.
3. Get Reviewer confirmation for the evidence.
4. Open a later approved task that explicitly permits source removal.
```

Expected: the inventory includes every source currently present in `CSP_REPORT_ONLY_DIRECTIVES`, including weak evidence areas for OSM tiles, Nominatim, CWA icon/image, Firebase Storage media, Strava browser `connect-src`, dev-only sources, and legacy/unknown sources.

- [ ] **Step 3: Verify the inventory source list against `next.config.mjs`**

Run:

```bash
rg -n "https://|http://|ws://|data:|blob:|'self'|'none'|'unsafe-inline'|'unsafe-eval'" docs/security/csp-source-inventory.md next.config.mjs
```

Expected: every source expression in `next.config.mjs` appears in `docs/security/csp-source-inventory.md` at least once. If a source exists in config but not in the runbook, update the runbook before continuing.

- [ ] **Step 4: Verify forbidden expansion is absent**

Run:

```bash
rg -n "report-uri|report-to|collector endpoint|Content-Security-Policy:|hard gate|HSTS preload|remove CSP source|removed CSP source" docs/security/csp-source-inventory.md
```

Expected: matches, if any, are only in compatibility boundary, non-scope, or future-removal-rule prose that says PR B does not do those things. There must be no instruction to implement them in PR B.

- [ ] **Step 5: Engineer report**

Return:

- changed file: `docs/security/csp-source-inventory.md`.
- verification command output summaries with exit codes.
- source count confirmation against `next.config.mjs`.
- explicit statement that unknown or needs-evidence sources were documented, not removed.

- [ ] **Step 6: Reviewer check**

Reviewer reads only:

- `git diff -- docs/security/csp-source-inventory.md`
- the `rg` verification outputs from Step 3 and Step 4
- `next.config.mjs` CSP directive block for source comparison

PASS criteria:

- every source from current CSP directives appears in the inventory.
- each source has classification, purpose, route or feature dependency, evidence status, owner, and revisit date.
- missing browser evidence is classified as `unknown` or `needs-evidence`, not used as a blocker.
- no source removal, collector endpoint, enforced CSP, hard gate, or HSTS preload change is planned.

REJECT criteria:

- any current CSP source is missing from the inventory.
- weak evidence areas are omitted.
- the doc directs PR B to remove a source or add collector/enforcement behavior.

- [ ] **Step 7: Commit checkpoint only after Reviewer PASS and explicit commit authorization**

Run only when authorized:

```bash
git add docs/security/csp-source-inventory.md
git commit -m "docs: add csp source inventory runbook"
```

Expected: commit succeeds with only the runbook staged.

## Task 3: E2E Security Header Strengthening

**Files:**

- Modify: `tests/e2e/security-headers.spec.js`
- Read-only context: `next.config.mjs`, `tests/unit/config/security-headers.test.js`, `package.json`, `docs/security/csp-source-inventory.md`
- Forbidden: `next.config.mjs`, unit tests, docs edits, package files, app code

- [ ] **Step 1: Confirm branch and task boundary**

Run:

```bash
git status --short --branch
```

Expected: branch is `055-csp-triage`; no unowned changes in `tests/e2e/security-headers.spec.js`. If Task 2 has not completed and reviewed `docs/security/csp-source-inventory.md`, stop.

- [ ] **Step 2: Write stricter E2E assertions first**

In `tests/e2e/security-headers.spec.js`, replace partial `CORE_CSP_DIRECTIVES` with exact directive strings matching Task 1:

```js
const EXPECTED_CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://*.tile.openstreetmap.org https://www.cwa.gov.tw",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:* ws://localhost:* https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://firebasestorage.googleapis.com https://www.strava.com https://nominatim.openstreetmap.org",
].join('; ');
```

Update `expectSecurityHeaders`:

```js
expect(headers['content-security-policy']).toBeUndefined();
expect(cspReportOnly).toBe(EXPECTED_CSP_REPORT_ONLY);
expect(cspReportOnly).not.toContain('report-uri');
expect(cspReportOnly).not.toContain('report-to');
```

Keep route cases:

```js
const SECURITY_HEADER_CASES = Object.freeze([
  { label: 'events-page', path: '/events' },
  { label: 'strava-webhook-api', path: '/api/strava/webhook?hub.mode=subscribe' },
]);
```

Expected: this may fail before Task 1 implementation or if E2E receives a different exact header value.

- [ ] **Step 3: Run the expected failing or confirming E2E test**

Run:

```bash
npm run test:e2e:security-headers
```

Expected before implementation alignment: FAIL if the browser-visible header differs from the exact expected report-only string. If Task 1 already aligned the config and the E2E change passes immediately, record that the stricter assertion is already satisfied by current config.

- [ ] **Step 4: Adjust only the E2E expected string if Task 1 intentionally changed formatting**

If Task 1's reviewed `buildCspReportOnlyHeaderValue()` output differs only because directive order or spacing was intentionally preserved from config, update `EXPECTED_CSP_REPORT_ONLY` to match the reviewed helper output exactly.

Do not edit config, add routes, remove sources, or broaden E2E scope in this task.

- [ ] **Step 5: Rerun E2E security header test**

Run:

```bash
npm run test:e2e:security-headers
```

Expected: exits 0. Both `/events` and `/api/strava/webhook?hub.mode=subscribe` return security headers, report-only CSP is exact, enforced CSP is absent, `report-uri` and `report-to` are absent, and baseline security headers still match.

- [ ] **Step 6: Run changed-file static checks**

Run:

```bash
npm run lint:changed
```

Expected: exits 0.

Run:

```bash
npm run type-check:changed
```

Expected: exits 0.

- [ ] **Step 7: Engineer report**

Return:

- changed file: `tests/e2e/security-headers.spec.js`.
- verification commands with exit codes.
- route coverage evidence for `/events` and `/api/strava/webhook?hub.mode=subscribe`.
- confirmation that no collector endpoint, enforced CSP, source removal, or route behavior change was made.

- [ ] **Step 8: Reviewer check**

Reviewer reads only:

- `git diff -- tests/e2e/security-headers.spec.js`
- `npm run test:e2e:security-headers` output summary
- `npm run lint:changed` output summary
- `npm run type-check:changed` output summary

PASS criteria:

- E2E asserts exact report-only CSP.
- E2E asserts enforced CSP absence.
- E2E asserts `report-uri` and `report-to` absence.
- minimum key route coverage remains `/events` and `/api/strava/webhook?hub.mode=subscribe`.
- no out-of-scope file was edited.

REJECT criteria:

- E2E only checks partial `contains` for the CSP allowlist.
- E2E adds app behavior coupling or broad route requirements not approved by this plan.
- E2E expects enforced CSP or collector behavior.

- [ ] **Step 9: Commit checkpoint only after Reviewer PASS and explicit commit authorization**

Run only when authorized:

```bash
git add tests/e2e/security-headers.spec.js
git commit -m "test: assert exact csp headers in e2e"
```

Expected: commit succeeds with only the E2E test staged.

## Task 4: Final Verification And Integration Review

**Files:**

- Read-only: `next.config.mjs`, `tests/unit/config/security-headers.test.js`, `tests/e2e/security-headers.spec.js`, `docs/security/csp-source-inventory.md`, `package.json`
- Modify: none
- Forbidden: all writes

- [ ] **Step 1: Confirm final changed-file set**

Run:

```bash
git status --short --branch
```

Expected: branch is `055-csp-triage`; changed files are limited to:

- `next.config.mjs`
- `tests/unit/config/security-headers.test.js`
- `docs/security/csp-source-inventory.md`
- `tests/e2e/security-headers.spec.js`

If any package file, app code, backlog doc, spec file, or unrelated file is changed, stop and ask the main agent to reconcile scope.

- [ ] **Step 2: Run unit security-header verification**

Run:

```bash
npm run test:security-headers
```

Expected: exits 0.

- [ ] **Step 3: Run E2E security-header verification**

Run:

```bash
npm run test:e2e:security-headers
```

Expected: exits 0.

- [ ] **Step 4: Run changed-file lint**

Run:

```bash
npm run lint:changed
```

Expected: exits 0.

- [ ] **Step 5: Run changed-file type check**

Run:

```bash
npm run type-check:changed
```

Expected: exits 0.

- [ ] **Step 6: Run forbidden-scope scan**

Run:

```bash
rg -n "report-uri|report-to|collector endpoint|Content-Security-Policy:|hard gate|HSTS preload|remove CSP source|removed CSP source" next.config.mjs tests/unit/config/security-headers.test.js tests/e2e/security-headers.spec.js docs/security/csp-source-inventory.md
```

Expected: code/test matches must only assert absence of `report-uri` or `report-to`; doc matches must only describe non-scope, compatibility boundary, or future removal rules. No match may indicate PR B implements an enforced CSP header, collector endpoint, hard gate, HSTS preload change, or source removal.

- [ ] **Step 7: Reviewer integration check**

Reviewer reads:

- `git diff --stat`
- `git diff -- next.config.mjs tests/unit/config/security-headers.test.js tests/e2e/security-headers.spec.js docs/security/csp-source-inventory.md`
- verification output summaries from Steps 2-6

PASS criteria:

- implementation matches the approved CSP triage design.
- report-only behavior is preserved.
- enforced CSP remains absent.
- no collector endpoint, `report-uri`, or `report-to` was added.
- HSTS preload behavior is unchanged.
- no CSP source is removed.
- weak browser evidence is documented as `unknown` or `needs-evidence`, not treated as a blocker.
- verification commands are fresh and command-specific.

REJECT criteria:

- any global non-scope item is violated.
- changed files exceed the allowed implementation set without an approved plan update.
- tests or runbook drift from the finalized `next.config.mjs` CSP source list.

- [ ] **Step 8: Final commit checkpoint only after Reviewer PASS and explicit commit authorization**

If previous task checkpoints were not committed and the main agent authorizes a final commit, stage concrete files only:

```bash
git add next.config.mjs tests/unit/config/security-headers.test.js tests/e2e/security-headers.spec.js docs/security/csp-source-inventory.md
git commit -m "test: strengthen csp triage coverage"
```

Expected: commit succeeds with only the four implementation files staged.

## Stop Conditions

Stop and ask the main agent before continuing if any task would require:

- adding an enforced CSP header.
- adding a CSP collector endpoint, `report-uri`, or `report-to`.
- hard-gating CI, runtime behavior, or PR completion on CSP violation reporting.
- changing HSTS preload behavior.
- removing any CSP source in PR B.
- changing application runtime behavior, Firebase behavior, Strava flows, weather behavior, map behavior, media loading behavior, package dependencies, or lockfiles.
- editing files outside the task-owned write set.
- treating missing browser evidence as proof that a source can be removed.
- combining verification commands into one chained evidence item.

## Acceptance Criteria

- `next.config.mjs` exposes deterministic CSP report-only directive construction for tests.
- Unit tests assert the exact report-only CSP value, report-only presence, enforced CSP absence, and unchanged HSTS behavior.
- E2E tests assert exact browser-visible report-only CSP for `/events` and `/api/strava/webhook?hub.mode=subscribe`.
- The runbook lists every current CSP source with classification, purpose, dependency, evidence status, owner, and revisit date.
- PR B may ship with weak browser evidence classified as `unknown` or `needs-evidence`.
- No collector endpoint, enforced CSP, hard gate, HSTS preload change, or CSP source removal is implemented.
- Fresh verification passes: `npm run test:security-headers`, `npm run test:e2e:security-headers`, `npm run lint:changed`, and `npm run type-check:changed`.
