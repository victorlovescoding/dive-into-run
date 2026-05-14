# CSP Source Inventory Runbook

> Last-Verified: 2026-05-14

## Purpose

This runbook tracks the report-only CSP source inventory for PR B triage. It
records each source's purpose, evidence status, owner, and revisit date so later
approved work can decide whether a source is still needed.

This document does not approve source removal. Unknown or weakly evidenced
sources stay documented until a later approved task explicitly permits removal.

## Compatibility Boundary

The current emitted header is `Content-Security-Policy-Report-Only`. The
enforced `Content-Security-Policy` header is absent, and there is no
`report-uri`, `report-to`, or collector endpoint.

Missing browser evidence may be recorded as `unknown` or `needs-evidence`.
PR B does not add an enforced CSP header, add a collector endpoint, hard gate on
CSP violation reporting, change HSTS preload behavior, or remove any CSP source.
Removal requires a later approved task.

## PR B Decision

PR B keeps CSP in observation mode only. It records how to collect and review
source evidence before enforcement work exists; it does not introduce reporting
headers, a collector endpoint, an enforced policy, or CI failures on CSP
violations.

Collector decision for PR B: use manual browser DevTools and
Playwright/request-level evidence first. A collector endpoint, `report-uri`,
`report-to`, reporting-header tests, privacy/retention policy, or any enforced
CSP boundary requires a later approved collector task.

Until that later collector exists, valid evidence can come from manual browser
DevTools inspection or Playwright/request-level capture. A missing signal is not
proof that a source is unused; record it as `unknown` or `needs-evidence` with
the route, owner, and revisit date.

## Header Test Boundary

`tests/unit/config/security-headers.test.js` and
`tests/e2e/security-headers.spec.js` provide header coverage: they verify the
configured `Content-Security-Policy-Report-Only` value, confirm no enforced
`Content-Security-Policy` header is emitted, and confirm no `report-uri` /
`report-to` directive exists. They are not runtime proof that a source is
required by a browser route.

## Violation Triage Paths

| Path | Use when | Evidence to keep | Outcome |
| --- | --- | --- | --- |
| Manual browser / DevTools | A focused route or third-party flow needs human login, OAuth, media, maps, or weather verification. | Route URL, environment, browser, timestamp, Console CSP messages or absence, Network requests by host, screenshots only when they clarify the finding. | Update the source row's evidence wording, owner, and revisit date. If evidence is absent or partial, keep `unknown` / `needs-evidence`. |
| Playwright / request-level capture | The route can be exercised repeatably in local, emulator, preview, or staging without adding product behavior. | Test or script name, environment, captured request hosts, CSP console events if collected, and whether the source was required, unused, or not reached. | Use as stronger route evidence than header-only tests, but do not turn violation reporting into a hard gate in PR B. |
| Future collector | Manual and Playwright evidence are too sparse for enforcement readiness, or staging/production behavior needs longitudinal visibility. | Collector design, privacy review, retention, owner, rollout target, and the exact `report-uri` / `report-to` header change proposed. | Requires a later approved task. Adding the endpoint or reporting headers is outside PR B. |

## Triage Decision Matrix

| Finding | Decision |
| --- | --- |
| A route visibly needs a source and the request host matches the inventory. | Keep or upgrade to `runtime-required`; cite the route evidence, owner, and revisit date. |
| Header tests cover the source but no runtime route evidence exists. | Keep the row, but mark browser need as `needs-evidence`; header coverage alone is not runtime proof. |
| A route was tested and did not use the source. | Record the tested route and result, but keep the source unless a later approved removal task is opened. |
| A route or third-party flow cannot be reached yet. | Record `unknown` / `needs-evidence`, the blocker, the expected owner, and the next revisit date. |
| A violation appears in DevTools, Playwright, staging, or production logs. | Record directive, blocked URI, route, environment, owner, and whether it is expected compatibility, a missing source candidate, or a product bug. |
| Evidence suggests a source can be removed. | Do not remove it in PR B. Open a later approved task with Reviewer-confirmed evidence and rollback plan. |

## Source Evidence Record

When updating a source row or follow-up note, include:

- Source evidence: route or flow, environment, timestamp or run identifier,
  tool used, and the observed host or CSP violation.
- Owner: team or feature owner responsible for validating the source.
- Expiry / revisit: date when `unknown`, `legacy`, `dev-only`, or temporary
  rationale must be reviewed again.
- Rationale: why the source is required, dev-only, legacy, or still unknown.
- Gaps: use `unknown` or `needs-evidence` when evidence is missing, partial, or
  blocked. Do not infer removal eligibility from missing evidence.

## Collector Adoption Conditions

Consider a later collector/reporting-header task only when at least one of
these is true:

- Staging or production behavior cannot be represented by manual DevTools or
  Playwright/request evidence.
- Enforcement readiness needs continuous violation trends instead of one-off
  route checks.
- Third-party, OAuth, media, map, weather, or Firebase flows show intermittent
  hosts or environment-specific violations.
- The project is ready to define collector ownership, privacy handling,
  retention, alert policy, and a non-blocking rollout plan.

That later task must explicitly approve any collector endpoint, `report-uri`,
`report-to`, security header test updates, or enforcement work.

## Source Inventory

| Directive | Source | Classification | Purpose | Route or feature dependency | Evidence status | Owner | Revisit date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `default-src` | `'self'` | runtime-required | Baseline same-origin fallback. | All routes. | Header-covered; runtime route proof not required for baseline fallback. | Security | Permanent |
| `base-uri` | `'self'` | runtime-required | Restricts document base URL. | All document routes. | Header-covered; policy hardening baseline. | Security | Permanent |
| `form-action` | `'self'` | runtime-required | Restricts same-origin form submissions. | Auth and app forms. | Header-covered; browser form-flow evidence remains optional. | Security | Permanent |
| `frame-ancestors` | `'none'` | runtime-required | Prevents framing. | All routes. | Header-covered by unit/E2E smoke; this is header behavior, not route runtime proof. | Security | Permanent |
| `object-src` | `'none'` | runtime-required | Blocks plugin/object loads. | All routes. | Header-covered by unit/E2E smoke; policy hardening baseline. | Security | Permanent |
| `script-src` | `'self'` | runtime-required | Allows same-origin scripts. | App shell. | Header-covered; browser app-shell proof should be collected before enforcement. | Security | Permanent |
| `script-src` | `'unsafe-inline'` | unknown | Framework/runtime inline script compatibility while report-only. | App shell. | needs-evidence: production or preview browser evidence required before classification changes. | Frontend | 2026-06-12 |
| `script-src` | `'unsafe-eval'` | unknown | Dev/framework tooling compatibility while report-only. | App shell/local dev. | needs-evidence: production build/browser evidence required before classification changes. | Frontend | 2026-06-12 |
| `style-src` | `'self'` | runtime-required | Allows same-origin styles. | App shell. | Header-covered; same-origin stylesheet route proof remains optional. | Frontend | Permanent |
| `style-src` | `'unsafe-inline'` | unknown | Inline styles from framework/map/weather UI and component style props. | App shell/maps/weather. | needs-evidence: browser evidence required before classification changes. | Frontend | 2026-06-12 |
| `img-src` | `'self'` | runtime-required | Allows same-origin images. | App shell/media. | Header-covered; same-origin image route proof remains optional. | Frontend | Permanent |
| `img-src` | `data:` | unknown | Allows inline image/data URL fallbacks. | Icons/UI fallbacks. | needs-evidence: header-covered only; no route signal found in allowed search. | Frontend | 2026-06-12 |
| `img-src` | `blob:` | unknown | Blob image previews/generated media. | Media previews. | needs-evidence: no route signal found in allowed search. | Frontend | 2026-06-12 |
| `img-src` | `https://lh3.googleusercontent.com` | unknown | Google profile images. | Auth profile display. | needs-evidence: Next image allowlist and avatar routes exist, but no captured `lh3.googleusercontent.com` browser request yet. | Auth | 2026-06-12 |
| `img-src` | `https://firebasestorage.googleapis.com` | unknown | Firebase Storage media. | Posts/events media. | needs-evidence: Next image allowlist exists, but no route-specific browser request captured yet. | Media | 2026-06-12 |
| `img-src` | `https://*.tile.openstreetmap.org` | unknown | OSM map tile images. | Event create/detail map routes. | needs-evidence: route dependency exists; capture tile host on `/events` create-map and `/events/[id]` route view before classification changes. | Maps | 2026-06-12 |
| `img-src` | `https://www.cwa.gov.tw` | unknown | CWA weather icon/image assets. | Weather UI and favorite chips. | needs-evidence: route dependency exists; capture icon host on `/weather` before classification changes. | Weather | 2026-06-12 |
| `font-src` | `'self'` | runtime-required | Allows same-origin fonts. | App shell. | Header-covered; same-origin font route proof remains optional. | Frontend | Permanent |
| `font-src` | `data:` | unknown | Data URL fonts if framework/assets need them. | App shell. | needs-evidence: production build/browser evidence required. | Frontend | 2026-06-12 |
| `connect-src` | `'self'` | runtime-required | Allows same-origin API and route-handler requests. | All app/API routes. | Header-covered; same-origin `/api/strava/*` browser calls are visible in route code. | Security | Permanent |
| `connect-src` | `http://localhost:*` | dev-only | Local development HTTP requests while report-only. | Local dev and emulator. | Header-covered; local-only, not production evidence. | Developer Experience | 2026-06-12 |
| `connect-src` | `ws://localhost:*` | dev-only | Local dev WebSocket connections. | Local dev server/HMR. | Header-covered; local-only, not production evidence. | Developer Experience | 2026-06-12 |
| `connect-src` | `https://*.googleapis.com` | runtime-required | Google/Firebase APIs. | Auth/Firebase services. | Header-covered; browser route host capture still useful before enforcement. | Firebase | 2026-06-12 |
| `connect-src` | `https://*.firebaseio.com` | runtime-required | Firebase realtime service endpoints if SDK uses them. | Firebase SDK. | Header-covered; needs route host capture before any later narrowing proposal. | Firebase | 2026-06-12 |
| `connect-src` | `https://*.firebaseapp.com` | runtime-required | Firebase app-hosted service endpoints if SDK uses them. | Firebase SDK. | Header-covered; needs route host capture before any later narrowing proposal. | Firebase | 2026-06-12 |
| `connect-src` | `https://identitytoolkit.googleapis.com` | runtime-required | Firebase Auth identity toolkit. | Auth flows. | Header-covered; E2E auth flows exercise login against emulator/local endpoints, not production host proof. | Auth | 2026-06-12 |
| `connect-src` | `https://securetoken.googleapis.com` | runtime-required | Firebase Auth token refresh. | Auth flows. | Header-covered; browser token-refresh host capture remains needs-evidence before enforcement. | Auth | 2026-06-12 |
| `connect-src` | `https://firestore.googleapis.com` | runtime-required | Firestore SDK calls. | App data loading. | Header-covered; browser route host capture remains useful before enforcement. | Firebase | 2026-06-12 |
| `connect-src` | `https://firebaseinstallations.googleapis.com` | runtime-required | Firebase installation service calls. | Firebase SDK init. | Header-covered; browser init host capture remains useful before enforcement. | Firebase | 2026-06-12 |
| `connect-src` | `https://firebase.googleapis.com` | runtime-required | Firebase service endpoints. | Firebase SDK. | Header-covered; browser route host capture remains useful before enforcement. | Firebase | 2026-06-12 |
| `connect-src` | `https://firebasestorage.googleapis.com` | unknown | Firebase Storage browser requests. | Posts/events media. | needs-evidence: no route-specific browser request captured yet. | Media | 2026-06-12 |
| `connect-src` | `https://www.strava.com` | unknown | Browser-side Strava navigation/request compatibility and server-side Strava API context. | Strava OAuth/sync. | needs-evidence: browser OAuth navigation is mocked in E2E; server-side Strava API tests are not browser `connect-src` proof. | Integrations | 2026-06-12 |
| `connect-src` | `https://nominatim.openstreetmap.org` | unknown | Geocoding/search requests. | Event map search/geocoding. | needs-evidence: route dependency exists through map search provider; capture search host before classification changes. | Maps | 2026-06-12 |

## Route / Source Evidence Notes

| Source | Route or flow | Environment / tool | Observed host or missing signal | Owner | Revisit date | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| `'self'` in `default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `connect-src` | App shell, all pages, and same-origin route handlers. | Unit header test and Playwright request-level header smoke on `/events` and `/api/strava/webhook?hub.mode=subscribe`. | Header present as report-only; same-origin runtime hosts are implicit. | Security / Frontend | Permanent | Baseline same-origin application delivery. Header tests prove emitted policy only. |
| `'self'` in `base-uri` and `form-action` | Document routes, auth forms, event/post/weather app forms. | Unit header test. | Header present as report-only; no separate browser form submission host capture. | Security | Permanent | Hardening baseline. Missing per-form runtime capture does not imply removal. |
| `'none'` in `frame-ancestors` and `object-src` | All routes. | Unit header test and Playwright request-level header smoke. | Header present as report-only; no runtime route source request expected. | Security | Permanent | Hardening baseline. Header coverage is the intended evidence for this boundary. |
| `'unsafe-inline'` in `script-src` | App shell. | No runtime browser capture in PR B evidence. | missing signal: inline script compatibility unknown. | Frontend | 2026-06-12 | Keep `unknown` / `needs-evidence` until preview or production browser evidence exists. |
| `'unsafe-eval'` in `script-src` | App shell and local dev. | No production build/browser capture in PR B evidence. | missing signal: eval compatibility unknown outside local/framework assumptions. | Frontend | 2026-06-12 | Keep `unknown` / `needs-evidence`; do not infer removal from absent evidence. |
| `'unsafe-inline'` in `style-src` | App shell, Leaflet map UI, weather cards with inline style props. | Code-level route evidence only. | missing signal: no DevTools or Playwright CSP event capture. | Frontend | 2026-06-12 | Keep `unknown` / `needs-evidence`; collect browser route evidence before enforcement. |
| `data:` in `img-src` | Icons/UI fallbacks. | `rg` over allowed source/test paths. | missing signal: no route-specific `data:` image use found in allowed search. | Frontend | 2026-06-12 | Keep `unknown` / `needs-evidence`; absence in search is not removal evidence. |
| `blob:` in `img-src` | Media previews/generated media. | `rg` over allowed source/test paths. | missing signal: no route-specific `blob:` image use found in allowed search. | Frontend | 2026-06-12 | Keep `unknown` / `needs-evidence`; absence in search is not removal evidence. |
| `https://lh3.googleusercontent.com` in `img-src` | User avatars on events/posts/profile-adjacent UI, including `UserLink`, `PostCard`, comments, and navbar. | Code-level evidence plus Next image remote pattern. | missing signal: no captured browser request to `lh3.googleusercontent.com`. | Auth | 2026-06-12 | Avatar routes can render external `photoURL`, but runtime host proof still needs DevTools or Playwright request capture. |
| `https://firebasestorage.googleapis.com` in `img-src` | Posts/events media and image remote pattern. | Code/config evidence only. | missing signal: no captured browser image request to `firebasestorage.googleapis.com`. | Media | 2026-06-12 | Keep `unknown` / `needs-evidence`; collect seeded media route evidence before classification changes. |
| `https://*.tile.openstreetmap.org` in `img-src` | `/events` create form route drawing and `/events/[id]` route-view map. | Code-level evidence from `EventMap` `TileLayer`. | expected host pattern `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`; no browser request capture yet. | Maps | 2026-06-12 | Route dependency exists, but runtime proof still needs DevTools or Playwright request capture. |
| `https://www.cwa.gov.tw` in `img-src` | `/weather` weather card and favorites weather icons. | Code-level evidence from weather icon URL builder and weather components. | expected host `https://www.cwa.gov.tw`; no browser request capture yet. | Weather | 2026-06-12 | Route dependency exists, but runtime proof still needs DevTools or Playwright request capture. |
| `data:` in `font-src` | App shell. | Unit header test only. | missing signal: no browser font request evidence. | Frontend | 2026-06-12 | Keep `unknown` / `needs-evidence`; header coverage is not runtime proof. |
| `http://localhost:*` and `ws://localhost:*` in `connect-src` | Local dev server, emulator, and HMR-like development flows. | Unit header test. | Header present; production runtime signal intentionally not required. | Developer Experience | 2026-06-12 | Classified `dev-only`; revisit with any dev-server/HMR CSP change. |
| Firebase/Google API hosts in `connect-src` | Auth, Firestore, Firebase SDK init, token refresh, and app data routes. | Unit header test; route code depends on Firebase client/server layers. | missing/partial signal: no production browser host capture in PR B evidence. | Firebase / Auth | 2026-06-12 | Keep `runtime-required` for platform dependency, but collect request-level browser evidence before enforcement. |
| `https://firebasestorage.googleapis.com` in `connect-src` | Posts/events media rendering or upload flows. | Code/config evidence only. | missing signal: no browser request capture for storage connect flow. | Media | 2026-06-12 | Keep `unknown` / `needs-evidence`; do not infer removal from missing signal. |
| `https://www.strava.com` in `connect-src` | `/runs` OAuth navigation, `/runs/callback`, `/api/strava/callback`, `/api/strava/sync`, `/api/strava/webhook`. | Playwright OAuth E2E mocks `https://www.strava.com/oauth/authorize`; unit/API tests cover server-side Strava API calls. | partial signal: browser-visible Strava OAuth is mocked; server-side fetches are not browser `connect-src` proof. | Integrations | 2026-06-12 | Keep `unknown` / `needs-evidence`; credentials or real third-party OAuth may be needed for stronger browser evidence. |
| `https://nominatim.openstreetmap.org` in `connect-src` | Event map search/geocoding via Leaflet GeoSearch in draw mode. | Code-level evidence from `OpenStreetMapProvider`. | expected host `https://nominatim.openstreetmap.org`; no search request capture yet. | Maps | 2026-06-12 | Keep `unknown` / `needs-evidence`; collect search interaction evidence before classification changes. |

## Evidence Rules

- `runtime-required`: Known runtime behavior or a current route/feature
  dependency shows the source is needed for supported routes or platform
  behavior. Header tests, unit tests, and configuration-only references are
  header-covered evidence, not runtime proof by themselves.
- `dev-only`: Source is intended for local development compatibility and is not
  production runtime evidence.
- `legacy`: Source exists for historical compatibility but still needs current
  owner review and evidence before any later removal proposal.
- `unknown`: Current purpose is plausible or inherited, but browser or automated
  evidence is not strong enough to prove runtime need.
- `needs-evidence`: A follow-up must collect route-specific browser or automated
  evidence before the classification can be upgraded or a later removal proposal
  can be made.

## Future Removal Rules

1. Collect browser or automated evidence for covered routes.
2. Confirm the source is unused or superseded for those routes.
3. Get Reviewer confirmation for the evidence.
4. Open a later approved task that explicitly permits source removal.
