# CSP Source Inventory Runbook

> Last-Verified: 2026-05-12

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

## Source Inventory

| Directive | Source | Classification | Purpose | Route or feature dependency | Evidence status | Owner | Revisit date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `default-src` | `'self'` | runtime-required | Baseline same-origin fallback. | All routes. | Covered by security-header tests. | Security | Permanent |
| `base-uri` | `'self'` | runtime-required | Restricts document base URL. | All document routes. | Covered by exact CSP unit test. | Security | Permanent |
| `form-action` | `'self'` | runtime-required | Restricts same-origin form submissions. | Auth and app forms. | Covered by exact CSP unit test. | Security | Permanent |
| `frame-ancestors` | `'none'` | runtime-required | Prevents framing. | All routes. | Covered by unit/E2E security-header tests. | Security | Permanent |
| `object-src` | `'none'` | runtime-required | Blocks plugin/object loads. | All routes. | Covered by unit/E2E security-header tests. | Security | Permanent |
| `script-src` | `'self'` | runtime-required | Allows same-origin scripts. | App shell. | Covered by exact CSP unit test. | Security | Permanent |
| `script-src` | `'unsafe-inline'` | unknown | Framework/runtime inline script compatibility while report-only. | App shell. | needs-evidence: production browser evidence required before removal proposal. | Frontend | 2026-06-12 |
| `script-src` | `'unsafe-eval'` | unknown | Dev/framework tooling compatibility while report-only. | App shell/local dev. | needs-evidence: production build evidence required before classification changes. | Frontend | 2026-06-12 |
| `style-src` | `'self'` | runtime-required | Allows same-origin styles. | App shell. | Covered by exact CSP unit test. | Frontend | Permanent |
| `style-src` | `'unsafe-inline'` | unknown | Inline styles from framework/map libraries. | App shell/maps. | needs-evidence: browser evidence required before removal proposal. | Frontend | 2026-06-12 |
| `img-src` | `'self'` | runtime-required | Allows same-origin images. | App shell/media. | Covered by exact CSP unit test. | Frontend | Permanent |
| `img-src` | `data:` | unknown | Allows inline image/data URL fallbacks. | Icons/UI fallbacks. | header-covered by exact CSP unit test; browser runtime need remains needs-evidence. | Frontend | 2026-06-12 |
| `img-src` | `blob:` | unknown | Blob image previews/generated media. | Media previews. | needs-evidence: browser evidence required before removal proposal. | Frontend | 2026-06-12 |
| `img-src` | `https://lh3.googleusercontent.com` | runtime-required | Google profile images. | Auth profile display. | Covered by Next image remote pattern and exact CSP unit test. | Auth | 2026-06-12 |
| `img-src` | `https://firebasestorage.googleapis.com` | unknown | Firebase Storage media. | Posts/events media. | needs-evidence: browser route evidence required for rendered media host. | Media | 2026-06-12 |
| `img-src` | `https://*.tile.openstreetmap.org` | unknown | OSM map tile images. | Event map routes. | needs-evidence: browser route evidence required for map tile requests or absence. | Maps | 2026-06-12 |
| `img-src` | `https://www.cwa.gov.tw` | unknown | CWA weather icon/image assets. | Weather UI. | needs-evidence: browser evidence required for icon/image loads and fallback behavior. | Weather | 2026-06-12 |
| `font-src` | `'self'` | runtime-required | Allows same-origin fonts. | App shell. | Covered by exact CSP unit test. | Frontend | Permanent |
| `font-src` | `data:` | unknown | Data URL fonts if framework/assets need them. | App shell. | needs-evidence: production build/browser evidence required. | Frontend | 2026-06-12 |
| `connect-src` | `'self'` | runtime-required | Allows same-origin API and route-handler requests. | All app/API routes. | Covered by unit/E2E security-header tests. | Security | Permanent |
| `connect-src` | `http://localhost:*` | dev-only | Local development HTTP requests while report-only. | Local dev. | Covered by exact CSP unit test; not production evidence. | Developer Experience | 2026-06-12 |
| `connect-src` | `ws://localhost:*` | dev-only | Local dev WebSocket connections. | Local dev. | Covered by exact CSP unit test; not production evidence. | Developer Experience | 2026-06-12 |
| `connect-src` | `https://*.googleapis.com` | runtime-required | Google/Firebase APIs. | Auth/Firebase services. | Covered by exact CSP unit test. | Firebase | 2026-06-12 |
| `connect-src` | `https://*.firebaseio.com` | runtime-required | Firebase realtime service endpoints if SDK uses them. | Firebase SDK. | Covered by exact CSP unit test; browser evidence still useful. | Firebase | 2026-06-12 |
| `connect-src` | `https://*.firebaseapp.com` | runtime-required | Firebase app-hosted service endpoints if SDK uses them. | Firebase SDK. | Covered by exact CSP unit test; browser evidence still useful. | Firebase | 2026-06-12 |
| `connect-src` | `https://identitytoolkit.googleapis.com` | runtime-required | Firebase Auth identity toolkit. | Auth flows. | Covered by exact CSP unit/E2E tests. | Auth | 2026-06-12 |
| `connect-src` | `https://securetoken.googleapis.com` | runtime-required | Firebase Auth token refresh. | Auth flows. | Covered by exact CSP unit test. | Auth | 2026-06-12 |
| `connect-src` | `https://firestore.googleapis.com` | runtime-required | Firestore SDK calls. | App data loading. | Covered by exact CSP unit/E2E tests. | Firebase | 2026-06-12 |
| `connect-src` | `https://firebaseinstallations.googleapis.com` | runtime-required | Firebase installation service calls. | Firebase SDK init. | Covered by exact CSP unit test. | Firebase | 2026-06-12 |
| `connect-src` | `https://firebase.googleapis.com` | runtime-required | Firebase service endpoints. | Firebase SDK. | Covered by exact CSP unit test. | Firebase | 2026-06-12 |
| `connect-src` | `https://firebasestorage.googleapis.com` | unknown | Firebase Storage browser requests. | Posts/events media. | needs-evidence: browser evidence required for media rendering/upload flows. | Media | 2026-06-12 |
| `connect-src` | `https://www.strava.com` | unknown | Browser-side Strava requests if OAuth/sync uses them. | Strava OAuth/sync. | needs-evidence: browser evidence required to show whether browser-side requests occur. | Integrations | 2026-06-12 |
| `connect-src` | `https://nominatim.openstreetmap.org` | unknown | Geocoding/search requests. | Map search/geocoding. | needs-evidence: browser evidence required for geocoding/search route behavior. | Maps | 2026-06-12 |

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
