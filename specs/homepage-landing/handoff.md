# Homepage Landing Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-069-homepage-landing`
- Branch: `069-homepage-landing`
- Current head: `781f62aa5871d3caeb10c17195475b8e271a8f27`
- Remote head: `origin/main` at `7ad004ee405b8485adeb9ca7ae5f19cd77cddb54`
- Profile: P4 full feature.
- Current phase: merged.
- Active task: none.
- Active wave: none.
- Task queue:
  - `T001`: completed, RED homepage integration test only; Reviewer PASS.
  - `T002`: completed, GREEN thin page plus render-only HomePage UI; Reviewer PASS.
  - `VG001`: completed, final verifier/integration gate PASS.
  - `T002-fix-1`: completed, CSS-only tablet overlap fix; Reviewer PASS.
  - `T002-fix-2`: completed, CSS-only desktop event/map overlap fix; Reviewer PASS.
- Latest reviewer decision: `VG001` review_passed.
- Last verified commit: `781f62aa5871d3caeb10c17195475b8e271a8f27`.
- Phase commits:
  - `781f62aa5871d3caeb10c17195475b8e271a8f27` - Add homepage landing.
- Rules deploy status: not applicable.
- Incidents: none.
- Blocked: no.
- Blocked reason: none.
- Authorization boundary:
  - edit: authorized for Planner and Engineer production-code work, 2026-05-21.
  - commit: authorized, 2026-05-22.
  - push: authorized, 2026-05-22.
  - pullRequest: authorized, 2026-05-22.
  - ciWatch: authorized, 2026-05-22.
  - merge: authorized, 2026-05-22.
  - localMainSync: authorized, 2026-05-22.
  - deployFirestoreRules: not authorized.

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `docs/superpowers/task-profiles.md`
4. `.codex/references/subagent-roles.md`
5. `.codex/rules/testing-standards.md`
6. `.codex/rules/e2e-commands.md`
7. `.codex/rules/sensors.md`
8. `specs/homepage-landing/handoff.md`
9. `specs/homepage-landing/tasks.md`
10. `specs/homepage-landing/status.json`
11. `specs/homepage-landing/spec.md`
12. `specs/homepage-landing/plan.md`

## Next Action

No active work. The homepage landing feature has already been merged through GitHub. Use this spec as historical state only unless new homepage work is explicitly authorized.

## Planner Evidence

| Evidence | Result |
| --- | --- |
| Open Design MCP artifact | Project `dive-into-run-website-ui`, entry `index.html`, resolved as `Dive Into Run Website UI`, not truncated. |
| CTA route verification | `src/app/events/page.jsx` exists; `rg --files src/app/events` showed no `src/app/events/create/page.jsx`. |
| CTA decision | All discovery and creation CTAs use `/events`. |
| Parallelism decision | One Engineer/Reviewer lane only; no disjoint implementation writes were proven. |

## Latest Verification

| Command | Exit | Evidence |
| --- | --- | --- |
| `git status --short --branch` | `0` | Worktree on `069-homepage-landing...origin/main`; `specs/homepage-landing/` is untracked workflow artifact state before Planner artifact edits are committed or staged. |
| `npm run workflow:validate` | `0` | `specs/homepage-landing/status.json: ok`; 7 status files valid. |
| `npm run workflow:check` | `0` | `specs/homepage-landing/status.json: sync ok`; 7 status files synced. |
| `npm run test:browser -- --run tests/integration/app/home-page-entry.test.jsx` | `1` | RED failure reached Vitest: expected H1 to contain `今天，一起出門跑。`; current page only rendered `Dive Into Run`; missing homepage regions. |
| `npm run test:browser -- --run tests/integration/app/home-page-entry.test.jsx` | `1` | T001 Reviewer reran RED: failed for missing hero copy/required region, not syntax/import/provider/environment. |
| `npm run test:browser -- --run tests/integration/app/home-page-entry.test.jsx` | `0` | T002 Engineer GREEN: focused homepage integration passed. |
| `npm run lint:changed` | `0` | T002 Engineer fixed helper order after one lint failure; changed-file lint passed. |
| `npm run type-check:changed` | `0` | T002 Engineer changed-file type-check passed. |
| `npm run test:browser -- --run tests/integration/app/home-page-entry.test.jsx` | `0` | T002 Reviewer reran focused homepage integration: 1 file / 2 tests passed. |
| `npm run lint:changed` | `0` | T002 Reviewer reran changed-file lint; only existing React-version warning. |
| `npm run type-check:changed` | `0` | T002 Reviewer reran changed-file type-check; no changed-file type errors. |
| `VG001 Browser 768x1024` | `fail` | Weather chip overlaps the hero event card content; Debugger diagnosed missing 641-820px separation rule. |
| `npm run test:browser -- --run tests/integration/app/home-page-entry.test.jsx` | `0` | T002-fix-1 focused homepage integration remained green after the tablet overlap CSS fix. |
| `npm run lint:changed` | `0` | T002-fix-1 changed-file lint passed; existing React-version warning only. |
| `npm run type-check:changed` | `0` | T002-fix-1 changed-file type-check reported no errors. |
| `T002-fix-1 Reviewer` | `pass` | CSS-only 641-820px tablet overlap fix passed review; VG001 Browser QA remains required. |
| `VG001 retry commands` | `0` | Focused integration, lint:changed, type-check:changed, hydration, axe, workflow validate/check/links, and diff-check all passed. |
| `VG001 Browser 375x812` | `pass` | No horizontal scroll, one global nav, no clipping/overlap, CTA focus ring visible. Screenshot: `/private/tmp/homepage-qa-375x812.png`. |
| `VG001 Browser 768x1024` | `pass` | Prior weather/event overlap fixed; no horizontal scroll, one global nav, no clipping/overlap. Screenshot: `/private/tmp/homepage-qa-768x1024.png`. |
| `VG001 Browser 1280x800` | `fail` | Event card overlaps map card: event `x=814..1173 y=-2..274`, map `x=638..948 y=206..428`. Screenshot: `/private/tmp/homepage-qa-1280x800.png`. |
| `Debugger 1280x800` | `diagnosed` | Desktop base CSS uses `.sceneWrap min-height: 540px`, `.eventCard top: 74px`, and `.mapCard bottom: 36px`; absolute boxes share one container without enough vertical space. Recommended CSS-only desktop scene spacing/height fix. |
| `npm run test:browser -- --run tests/integration/app/home-page-entry.test.jsx` | `0` | T002-fix-2 focused homepage integration remained green after the desktop overlap CSS fix. |
| `npm run lint:changed` | `0` | T002-fix-2 changed-file lint passed; existing React-version warning only. |
| `npm run type-check:changed` | `0` | T002-fix-2 changed-file type-check reported no errors. |
| `T002-fix-2 Reviewer` | `pass` | CSS-only 1081-1320px desktop overlap fix passed review; VG001 Browser QA remains required. |
| `npm run test:browser -- --run tests/integration/app/home-page-entry.test.jsx` | `0` | VG001 final attempt: 1 file / 2 tests passed. |
| `npm run lint:changed` | `0` | VG001 final attempt: changed-file lint passed; existing React-version warning only. |
| `npm run type-check:changed` | `0` | VG001 final attempt: no type errors in changed files. |
| `npm run test:e2e:hydration` | `0` | VG001 final attempt: 3 tests passed. |
| `npm run test:e2e:axe` | `0` | VG001 final attempt: 7 tests passed. |
| `npm run workflow:validate` | `0` | VG001 final attempt: 7 status files valid. |
| `npm run workflow:check` | `0` | VG001 final attempt: 7 status files synced. |
| `npm run workflow:links` | `0` | VG001 final attempt: 41 local reference files scanned; all exist. |
| `git diff --check` | `0` | VG001 final attempt: no whitespace errors. |
| `VG001 Browser 375x812` | `pass` | No horizontal scroll, one global nav, no weather/event/map overlap, CTA focus outline visible. Screenshot: `/private/tmp/homepage-qa-attempt3-375x812.png`. |
| `VG001 Browser 768x1024` | `pass` | Prior weather/event overlap fixed; no horizontal scroll, one global nav, no card overlap, CTA focus outline visible. Screenshot: `/private/tmp/homepage-qa-attempt3-768x1024.png`. |
| `VG001 Browser 1280x800` | `pass` | Event/map overlap fixed; weather/event/map visible and separated, two-column hero confirmed. Screenshot: `/private/tmp/homepage-qa-attempt3-1280x800-before-focus.png`. |

## Closeout Checklist

- [x] `tasks.md` task states match `status.json`.
- [x] Active task and active wave match `status.json`.
- [x] Latest reviewer decision is recorded in `tasks.md` and `status.json`.
- [x] `lastVerification` has one entry per command.
- [x] `lastVerifiedCommit`, `currentHead`, `remoteHead`, and `phaseCommits` reflect the latest verified state.
- [x] `authorizationBoundary.deployFirestoreRules` is recorded and treated as separate from `edit`, `commit`, `push`, `pullRequest`, `ciWatch`, `merge`, and `localMainSync`.
- [x] `rulesDeployStatus` matches the rules release state.
- [x] Final summary does not imply deployed rules/product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
- [ ] PR/CI/merge notes explicitly carry release risk if rules are in a non-deployed state such as `required`, `pending`, or `blocked`.
- [ ] Open `incidents` are resolved, mitigated with an explicit carry-forward, or block closeout.
- [x] Changed files are intentionally in scope.
- [x] Blockers are resolved or explicitly carried forward.

## Blockers

- None.

## Pitfalls

- Do not port the Open Design `topnav`; the app already renders a global Navbar from `src/app/layout.jsx`.
- Do not render any homepage `nav`, navigation header, fixed hero chrome, or sticky page chrome that competes with the global Navbar.
- Do not use `/events/create` or `#runs` for event CTAs in this slice; all event CTAs are `/events`.
- Do not introduce live data, runtime hooks, Firebase/service/repo access, weather API calls, Strava calls, or new dependencies for this static homepage slice.
- Do not edit `src/app/layout.jsx`, `src/app/globals.css`, Navbar files, `tests/e2e/**`, `package.json`, or `package-lock.json`.
- Do not claim implementation is complete without fresh integration, lint, changed-file type-check, hydration smoke, axe smoke, workflow, diff-check, and browser evidence.
