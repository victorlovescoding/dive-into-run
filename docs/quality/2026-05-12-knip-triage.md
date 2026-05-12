# Knip Triage

Date: 2026-05-12
Branch: `053-knip-triage`
Mode: Option A - triage plus minimal cleanup

## Summary

- Full Knip report remains report-only through `npm run knip:report`.
- Production unlisted dependency checking remains limited to `npm run knip:production-unlisted-deps`.
- No `project-health/**` output is used.
- No broad source, export, or runtime cleanup is part of this task.
- Task 1 stopped before cleanup because several Knip categories cannot be proven from the allowed narrow context.

## Commands

| Command | Exit | Signal |
| --- | ---: | --- |
| `git status --short --branch` | 0 | exited 0 on branch `053-knip-triage`; `docs/superpowers/specs/2026-05-12-knip-triage-design.md` remained staged and no implementation file was staged |
| `npm install` | 0 | exited 0 with `up to date, audited 1178 packages in 12s`; no `package-lock.json` diff appeared |
| `npm run knip:report` | 0 | exited 0 and wrote `knip-report.json`; compact output reported unused files, unused dependencies, unused devDependencies, unlisted dependencies, unlisted binaries, unused exports, and duplicate exports |
| `npm run knip:production-deps` | 0 | exited 0 with production unused dependency findings for `functions/package.json: firebase-admin` and `package.json: @mapbox/polyline, firebase, firebase-admin, leaflet-geosearch, react-leaflet, topojson-client` |
| `npm run knip:production-unlisted-deps` | 0 | exited 0 with `Knip production unlisted-deps gate passed: no production unlisted dependencies found.` |

## Classification

| Bucket | Finding | Evidence | Decision |
| --- | --- | --- | --- |
| `deferred-follow-up` | unused files: 16 `src/hooks/**` and `src/lib/**` files | `npm run knip:report` reported `Unused files (16)` including `src/hooks/useCommentMutations.js`, `src/hooks/useComments.js`, `src/hooks/useDashboardTab.js`, `src/hooks/useRunCalendar.js`, `src/hooks/useStravaActivities.js`, `src/hooks/useStravaConnection.js`, `src/hooks/useStravaSync.js`, and multiple `src/lib/**` files | Defer; source deletion is broad runtime cleanup and outside Task 1 and Option A cleanup scope. |
| `blocked-unclear` | unused dependencies in the full report: `functions/package.json: firebase-admin` | `npm run knip:report` reported `Unused dependencies (1)` for `functions/package.json: firebase-admin` | Stop before cleanup; package metadata removal cannot be proven from the allowed narrow context. |
| `blocked-unclear` | production unused dependencies: `functions/package.json: firebase-admin` and `package.json: @mapbox/polyline, firebase, firebase-admin, leaflet-geosearch, react-leaflet, topojson-client` | `npm run knip:production-deps` reported `Unused dependencies (2)` with those package manifests and dependency names | Stop before cleanup; production dependency removal needs runtime and deployment ownership proof outside Task 1. |
| `blocked-unclear` | unused devDependencies: `package.json: eslint-config-next, taiwan-atlas` | `npm run knip:report` reported `Unused devDependencies (1)` with those names | Stop before cleanup; dev dependency metadata removal cannot be proven from the allowed narrow context. |
| `blocked-unclear` | unlisted dependencies: `@next/eslint-plugin-next`, `globals`, `estree`, `@babel/parser`, `geojson` | `npm run knip:report` reported `Unlisted dependencies (5)` in `eslint.config.mjs`, `scripts/audit-use-effect-data-fetching.mjs`, `specs/021-layered-dependency-architecture/test-buckets/policy.js`, `src/components/weather/TaiwanMap.jsx`, and `src/config/geo/weather-geo-cache.js` | Stop before cleanup; deciding whether to add metadata, rewrite imports, or treat transitive/tooling usage as intentional needs files outside the Task 1 write scope and broader ownership judgment. |
| `blocked-unclear` | unlisted binaries: `functions/package.json: firebase`; `package.json: firebase, open` | `npm run knip:report` reported `Unlisted binaries (2)` with those binary names | Stop before cleanup; binary usage and package-script intent cannot be proven enough for metadata changes in Task 1. |
| `deferred-follow-up` | unused exports: 23 export groups across specs, UI contexts, repo, runtime, and service modules | `npm run knip:report` reported `Unused exports (23)` including `Navbar.jsx`, context defaults, notification helpers, Strava helpers, repo functions, runtime hooks, providers, and service helpers | Defer; export deletion is broad source/API cleanup and outside Task 1 and Option A cleanup scope. |
| `deferred-follow-up` | duplicate exports: `specs/021-layered-dependency-architecture/test-buckets/policy.js` duplicate export groups | `npm run knip:report` reported `Duplicate exports (2)` for `evaluateTestDependency`, `evaluateTestModuleSpecifier`, `KNOWN_S015_UNIT_CONFLICTS`, and `KNOWN_S015_CONFLICTS` | Defer; specs helper cleanup is not part of Task 1 and needs ownership review. |
| `actionable-cleanup` | none observed | `blocked-unclear` rows above prevent proven cleanup in Task 1 | no action |
| `intentional-usage` | none observed | no Knip category could be proven intentional from the allowed narrow context | no action |
| `false-positive` | none observed | no Knip category could be proven false-positive from the allowed narrow context | no action |

## Minimal Cleanup Rationale

- Cleanup is limited to config, script, or dependency metadata.
- Runtime source and export deletion are excluded.
- Full Knip remains report-only.
- No minimal cleanup was performed because the current dependency and unlisted findings are `blocked-unclear`, while source/export findings are deferred by scope.

## Stop Condition Review

| Stop condition | Status |
| --- | --- |
| New dependency required | `blocked-unclear` |
| Material `package-lock.json` update required | `no` |
| Broad source or export deletion required | `yes` |
| Full Knip hard-gate required | `no` |
| `project-health/**` touched | `no` |
| Unclear Knip false positive | `yes` |

## Verification

| Command | Exit | Signal |
| --- | ---: | --- |
| completion marker scan | 1 | exited 1 with no matches for unfinished-work markers in this document |
| `npm run workflow:links` | 0 | exited 0 with `LOCAL LINKS: 44 file(s) scanned, all local references exist` |
| `git diff --check` | 0 | exited 0 with no whitespace errors |
