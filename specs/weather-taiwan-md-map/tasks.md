# Weather Taiwan.md-Style Map Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/weather-taiwan-md-map/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `specs/weather-taiwan-md-map/handoff.md`, this file, and `specs/weather-taiwan-md-map/status.json` before dispatching work.
- Main agent is control plane only. Repo-changing edits belong to Engineer subagents, including code, executable tests, docs, workflow docs, ADRs, `.codex/**`, scripts, and config.
- Planner subagent slices repo-changing work. Main validates Planner output and dispatches; it does not self-slice repo-changing work.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block before dispatch, commit, push, PR, merge, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator state sync.
- Command evidence is one command per entry. Do not combine commands with shell chain operators.
- New `status.json` state uses schemaVersion 3 and records `currentHead`, `remoteHead`, `lastVerifiedCommit`, `phaseCommits`, `rulesDeployStatus`, and `incidents`.
- Final summaries must not imply deployed Firestore/storage rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.

## Team And Parallelism

- Profile: P4 full feature planning.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-067-weather-taiwan-md-map`.
- Branch: `067-weather-taiwan-md-map`.
- Default staffing: one Engineer plus one Reviewer per task.
- Parallelism: none by default. The task graph is serialized because map DOM contracts, CSS hooks, bottom-sheet layout, and E2E assertions depend on each other.
- Same-wave owned-file rule: satisfied because each wave has one writable task.
- Implementation authorization: T001 and T002 edits were authorized by the user on 2026-05-21 and are complete; T003-T004 remain future task contracts until separately authorized.
- Commit checkpoint rule: user authorized atomic commits on 2026-05-21; push, PR, CI watch, merge, local main sync, and rules deploy remain unauthorized.

## Planner Output

Current workflow state:

- Phase: implementation, T003 pending dispatch.
- Active task: none.
- Active wave: none.
- Planner review state: review_rejected addressed by Planner revision on 2026-05-21.

Dependency graph:

```text
T001 -> T002 -> T003 -> T004
```

Parallel waves:

- `wave-1`: T001
- `wave-2`: T002
- `wave-3`: T003
- `wave-4`: T004

Final integration gate:

| Command | Expected signal |
| ------- | --------------- |
| `npm run lint:changed` | Exit 0; no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0; no changed-file type errors. |
| `npm run depcruise` | Exit 0; dependency direction remains valid. |
| `npm run test:branch` | Exit 0; branch-scoped Vitest gate passes. |
| `npm run test:e2e:branch` | Exit 0; branch-scoped E2E gate passes or documents credential-gated weather skip already allowed by the existing E2E file. |
| `npm run build` | Exit 0; production build succeeds. |

Browser integration gate:

- Start `npm run dev`.
- Open `http://localhost:3000/weather`.
- Capture desktop 1440x900, tablet 834x1112, and mobile 390x844 evidence.
- Required signals: nonblank map, pan/zoom/reset work, desktop hover tooltip appears, selected polygon remains highlighted, mobile tap reveals bottom sheet, sheet dismissal preserves selected weather state, back-to-overview clears selected weather state, no Taiwan.md left-bottom branding text.

## Tasks

### T001 - Leaflet Interaction, Controls, And Administrative Tooltips

- **State**: `completed`
- **Attempt**: 2
- **Wave**: `wave-1`
- **Engineer**: Map UI Engineer
- **Reviewer**: Weather UI Reviewer
- **Commit checkpoint**: none; future Release Manager action only after explicit `commit=true` authorization.
- **Last verified commit**: none
- **Authorization boundary**: current edit=no, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Enable real Leaflet interaction flags in the weather map.
- Add custom zoom-in, zoom-out, and reset buttons in the map canvas.
- Add county hover tooltip in overview mode and township hover tooltip in county mode.
- Update county-level and township-level weather integration tests and mocks for control and tooltip behavior.

Non-scope:

- Do not edit CSS visual treatment beyond class references needed by `TaiwanMap.jsx`.
- Do not edit `WeatherPageScreen.jsx`.
- Do not edit runtime hooks, weather API, Firebase favorites, GeoJSON source data, package metadata, or lockfiles.
- Do not add dependencies or migrate to D3.
- Do not edit workflow state files.

Owned files:

- `src/components/weather/TaiwanMap.jsx`
- `tests/integration/weather/weather-page.test.jsx`
- `tests/integration/weather/township-drilldown.test.jsx`

Read-only context:

- `specs/weather-taiwan-md-map/spec.md`
- `specs/weather-taiwan-md-map/plan.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `.codex/rules/testing-standards.md`
- `src/components/weather/weather.module.css`
- `src/ui/weather/WeatherPageScreen.jsx`
- `src/runtime/hooks/useWeatherPageRuntime.js`
- `tests/integration/app/weather-page-entry.test.jsx`
- `package.json`

Dependencies:

- Approved `spec.md`.
- Planning artifacts in this directory are present and in sync.
- User authorized T001 implementation with edit=true on 2026-05-21; commit, push, and PR remain unauthorized.

Browser evidence:

- Required later in T004. T001 Engineer may run local browser smoke evidence if useful, but T001 completion relies on focused integration tests plus lint and type-check.

Engineer instructions:

- Modify only the owned files above.
- Update the `react-leaflet` mocks in `tests/integration/weather/weather-page.test.jsx` and `tests/integration/weather/township-drilldown.test.jsx` so `MapContainer` exposes received props and `GeoJSON` mock feature buttons can trigger `mouseover`, `mousemove`, `mouseout`, and `click` handlers.
- Add tests that hover `臺北市`, assert tooltip text `臺北市`, move or unhover, and assert the tooltip disappears.
- Add tests that select `新北市`, hover `板橋區`, assert tooltip text `新北市 · 板橋區`, move or unhover, and assert the tooltip disappears.
- Add tests that find buttons named `放大地圖`, `縮小地圖`, and `重設地圖範圍`, click them, and assert the mocked map boundary observed zoom-in, zoom-out, and reset behavior.
- In `TaiwanMap.jsx`, set `dragging`, `scrollWheelZoom`, `touchZoom`, and `doubleClickZoom` to enabled values on `MapContainer`.
- Add an internal controls component using `useMap()` and the active GeoJSON collection. It must call `map.zoomIn()`, `map.zoomOut()`, and `map.fitBounds(...)` for reset.
- Add internal tooltip state and pointer handlers. Overview hover displays the county name; county-layer hover displays `countyName · townshipName`; pointer leave clears tooltip; tooltip uses `pointer-events: none`.
- Preserve existing county, township, and island click callback signatures.
- Stop if `TaiwanMap.jsx` cannot remain within the repo source line limit without a new helper file; request a plan update before adding files.

Acceptance criteria:

- AC-T001.1: County click still fetches `臺北市` weather and enters county drill-down in the existing integration test.
- AC-T001.2: Island click still displays `臺東縣 · 蘭嶼鄉`.
- AC-T001.3: County hover tooltip renders `臺北市` and hides after pointer leave.
- AC-T001.4: Township hover tooltip renders `新北市 · 板橋區` and hides after pointer leave.
- AC-T001.5: Custom map controls are keyboard-focusable buttons with labels `放大地圖`, `縮小地圖`, and `重設地圖範圍`.
- AC-T001.6: Control clicks call the map boundary for zoom-in, zoom-out, and current-layer reset.
- AC-T001.7: `package.json` and lockfiles are untouched.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser tests/integration/weather/weather-page.test.jsx` | Exit 0; county selection, island selection, county tooltip, and custom controls pass. |
| `npx vitest run --project=browser tests/integration/weather/township-drilldown.test.jsx` | Exit 0; township drill-down and township tooltip pass. |
| `npm run lint:changed` | Exit 0; no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0; no changed-file type errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Required verification commands pass and match the expected signal.
- Acceptance criteria are covered by tests or explicit evidence.
- Map still uses Leaflet/react-leaflet and existing GeoJSON data.
- No runtime, API, Firebase, package, lockfile, or workflow-state changes are present.
- `TaiwanMap.jsx` stays within repo coding rules or has a coordinator-approved plan update.

Reviewer REJECT criteria:

- Diff touches non-owned files without prior coordinator approval.
- Verification is missing, stale, failed, or uses a different command.
- Tooltip blocks click behavior or changes selected weather state on hover.
- Controls are not labelled buttons.
- Any D3 migration, dependency addition, weather API change, or persistence change appears.

Evidence:

- Engineer report: DONE attempt 2 on 2026-05-21T15:22:23Z. Reworked `src/components/weather/TaiwanMap.jsx` and `tests/integration/weather/weather-page.test.jsx` only; added minimal inline fallback styles so controls are positioned/clickable and tooltip is absolutely positioned with `pointerEvents: 'none'` without relying on missing CSS Module classes; kept CSS Module hooks for T002; no stage, commit, push, PR, dependency, package, lockfile, runtime, API, Firebase, workflow-state, or CSS edits by Engineer.
- Reviewer report: Attempt 1 spec compliance reviewer passed on 2026-05-21T15:12:51Z with no findings. Attempt 1 code quality reviewer rejected on 2026-05-21T15:17:14Z because `styles.mapControls`, `styles.mapControlButton`, and `styles.mapTooltip` resolved to undefined CSS Module classes. Attempt 2 spec compliance reviewer passed on 2026-05-21T15:26:27Z with no findings. Attempt 2 code quality reviewer passed on 2026-05-21T15:30:48Z with no findings; original CSS Module fallback blocker is resolved without CSS edits.
- Command output summary:
  - `npx vitest run --project=browser tests/integration/weather/weather-page.test.jsx`: attempt 2 code quality reviewer rerun exit 0; 8/8 tests passed.
  - `npx vitest run --project=browser tests/integration/weather/township-drilldown.test.jsx`: attempt 2 code quality reviewer rerun exit 0; 5/5 tests passed.
  - `npm run lint:changed`: attempt 2 code quality reviewer rerun exit 0; no changed-file lint errors.
  - `npm run type-check:changed`: attempt 2 code quality reviewer rerun exit 0; no changed-file type errors.
  - `git diff --exit-code 7ad004ee405b8485adeb9ca7ae5f19cd77cddb54 -- src/components/weather/weather.module.css package.json package-lock.json`: exit 0; no CSS, package, or lockfile changes.
- Changed files summary:
  - `src/components/weather/TaiwanMap.jsx`
  - `tests/integration/weather/weather-page.test.jsx`
  - `tests/integration/weather/township-drilldown.test.jsx`
- Phase commits: none.
- Rules deploy status: not_applicable.
- Incidents: none.

### T002 - Taiwan.md-Inspired Weather Map Styling

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Weather Visual Engineer
- **Reviewer**: UX UI Reviewer
- **Commit checkpoint**: none; future Release Manager action only after explicit `commit=true` authorization.
- **Last verified commit**: none
- **Authorization boundary**: current edit=no, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no. Future T003 work is now authorized by the user, but T003 has not been dispatched yet.
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Style the weather map canvas, controls, compass, tooltip, selected polygons, hover states, and responsive bottom-sheet hooks.
- Keep styling inside the weather CSS Module and weather map Leaflet descendants.

Non-scope:

- Do not edit JavaScript or tests.
- Do not add image assets, font assets, dependencies, package metadata, or lockfiles.
- Do not add Taiwan.md article UI or left-bottom branding text.
- Do not edit workflow state files.

Owned files:

- `src/components/weather/weather.module.css`

Read-only context:

- `specs/weather-taiwan-md-map/spec.md`
- `specs/weather-taiwan-md-map/plan.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `src/components/weather/TaiwanMap.jsx`
- `src/ui/weather/WeatherPageScreen.jsx`
- `tests/integration/weather/weather-page.test.jsx`
- `tests/integration/weather/township-drilldown.test.jsx`

Dependencies:

- T001 completed.
- User authorized T002 implementation with edit=true on 2026-05-21; commit, push, and PR remain unauthorized.

Browser evidence:

- Required later in T004 and final integration. Visual Reviewer should compare against the T004 screenshots before closeout.

Engineer instructions:

- Modify only the owned file above.
- Add scoped CSS variables for ocean, paper, land, shoreline, hover, selected, control, tooltip, and sheet colors.
- Style `.mapContainer` with a soft ocean background, subtle wave texture using CSS gradients, paper-like depth, stable border radius, and no external assets.
- Style the class hooks introduced by T001 for controls, compass, and tooltip.
- Style Leaflet path descendants inside `.mapContainer` to make hover and selected states legible while preserving JS path styles.
- Add responsive styles for bottom-sheet class hooks expected by T003: mobile sheet positioning, collapsed state, scrim or dismiss affordance if implemented in markup, and desktop side-by-side fallback.
- Keep button text and icons inside stable dimensions; no viewport-width font scaling.

Acceptance criteria:

- AC-T002.1: Map canvas has soft ocean background, subtle wave texture, and paper-like surface depth.
- AC-T002.2: Controls, compass, and tooltip are visible and do not overlap core map content.
- AC-T002.3: Hover and selected polygons remain visibly distinct.
- AC-T002.4: CSS remains scoped to weather page classes and Leaflet descendants inside the weather map.
- AC-T002.5: No Taiwan.md left-bottom branding text or article UI is introduced.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npm run lint:changed` | Exit 0; no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0; no changed-file type errors. |

Reviewer PASS criteria:

- Diff touches only `src/components/weather/weather.module.css`.
- Required verification commands pass and match the expected signal.
- CSS selectors are scoped and do not target global app surfaces beyond weather map Leaflet descendants.
- The styling supports T001 controls and tooltip class names.
- No new dependency, asset, package, lockfile, or workflow-state change is present.

Reviewer REJECT criteria:

- Diff touches non-owned files.
- CSS hides Leaflet SVG paths or controls by default.
- Text can visibly overflow known compact controls or sheet handles.
- Styling adds Taiwan.md non-weather content or branding text.
- Verification is missing, stale, failed, or uses a different command.

Evidence:

- Engineer report: DONE 2026-05-21T15:43:27Z. Changed `src/components/weather/weather.module.css` only; added soft ocean canvas, CSS-gradient wave texture, paper-like border/depth, scoped styles for map controls, tooltip, CSS-only compass, Leaflet hover/selected states, and bottom-sheet hooks; no stage, commit, push, PR, dependency, package, lockfile, asset, JavaScript, test, or workflow-state edits by Engineer.
- Reviewer report: Spec compliance reviewer passed on 2026-05-21T15:46:47Z with no findings. Code quality reviewer passed on 2026-05-21T15:49:47Z with no findings; CSS remains scoped, no package/lock/asset changes were introduced, and T001 inline fallback styles do not make T002 styling meaningfully ineffective.
- Command output summary:
  - `npm run lint:changed`: coordinator fresh verification exit 0; no changed-file lint errors; existing React version warning only.
  - `npm run type-check:changed`: coordinator fresh verification exit 0; no type errors in changed files.
  - `node scripts/validate-workflow-state.js specs/weather-taiwan-md-map/status.json`: coordinator fresh verification exit 0; workflow state valid.
  - `git diff --check`: coordinator fresh verification exit 0; no whitespace errors.
  - `rg -n "vw|!important|:global\\(|url\\(|@import|position:\\s*fixed|z-index|overflow-wrap|white-space" src/components/weather/weather.module.css`: exit 0; no reject-worthy CSS patterns found.
- Changed files summary:
  - `src/components/weather/weather.module.css`
- Phase commits: none.
- Rules deploy status: not_applicable.
- Incidents: none.

### T003 - Mobile Bottom Sheet

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Weather Screen Engineer
- **Reviewer**: Weather Flow Reviewer
- **Commit checkpoint**: none; future Release Manager action only after explicit `commit=true` authorization.
- **Last verified commit**: none
- **Authorization boundary**: current edit=yes for T003 owned files, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Add mobile bottom-sheet presentation behavior to weather screen.
- Preserve weather runtime selection, fetch, favorites, URL sync, localStorage restore, and back-to-overview behavior.

Non-scope:

- Do not edit `TaiwanMap.jsx`; township tooltip implementation and coverage belong to T001.
- Do not edit `weather.module.css`; T002 owns styling.
- Do not edit runtime hooks, weather API, Firebase favorites, GeoJSON source data, package metadata, or lockfiles.
- Do not edit workflow state files.

Owned files:

- `src/ui/weather/WeatherPageScreen.jsx`
- `tests/integration/weather/township-drilldown.test.jsx`

Read-only context:

- `specs/weather-taiwan-md-map/spec.md`
- `specs/weather-taiwan-md-map/plan.md`
- `.codex/rules/coding-rules.md`
- `.codex/rules/code-style.md`
- `.codex/rules/testing-standards.md`
- `src/components/weather/TaiwanMap.jsx`
- `src/components/weather/weather.module.css`
- `src/runtime/hooks/useWeatherPageRuntime.js`
- `tests/integration/weather/weather-page.test.jsx`
- `tests/integration/weather/favorites.test.jsx`

Dependencies:

- T001 completed.
- T002 completed.
- User authorized continuing implementation through the pre-push stage on 2026-05-21; edit=true and commit=true for T003, push and later release steps remain unauthorized.

Browser evidence:

- Required later in T004. The T003 Engineer may include local responsive observations, but Reviewer PASS requires the focused integration command.

Engineer instructions:

- Modify only the owned files above.
- Add a test that simulates mobile width before selection, selects `新北市` then `板橋區`, confirms a labelled weather information sheet is present, dismisses or collapses it, confirms selected weather text remains available through the selected-state surface or re-open affordance, then uses `全台總覽` to clear state.
- In `WeatherPageScreen.jsx`, keep weather data rendering through `renderWeatherCard` and add presentation state only for sheet open/collapsed behavior.
- Keep favorites visible and usable when weather state is success.
- Do not fetch, persist, or sync URL from `WeatherPageScreen.jsx`.

Acceptance criteria:

- AC-T003.1: Township selection still displays `新北市 · 板橋區` and fetches township weather.
- AC-T003.2: Mobile bottom sheet appears or is reachable after tap selection.
- AC-T003.3: Dismissing or collapsing the sheet does not reset selected weather state.
- AC-T003.4: Back-to-overview clears selected weather state and returns to overview map.
- AC-T003.5: Favorites and favorite toggle remain reachable when selected weather is loaded.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser tests/integration/weather/township-drilldown.test.jsx` | Exit 0; township drill-down, existing township tooltip coverage from T001, bottom sheet, and back-to-overview pass. |
| `npm run lint:changed` | Exit 0; no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0; no changed-file type errors. |

Reviewer PASS criteria:

- Diff touches only owned files.
- Required verification commands pass and match the expected signal.
- No fetch, persistence, Firebase, or URL sync behavior is moved into UI screen code.
- Bottom-sheet dismissal is presentation-only and does not call `handleBackToOverview`.
- Existing township and back-to-overview tests remain meaningful.

Reviewer REJECT criteria:

- Diff touches non-owned files without coordinator approval.
- Runtime weather semantics change without a documented blocker and plan update.
- Bottom-sheet dismissal clears selected weather state.
- Bottom-sheet behavior is missing, stale, or not covered by tests.
- Verification is missing, stale, failed, or uses a different command.

Evidence:

- Engineer report: none yet.
- Reviewer report: none yet.
- Command output summary: none yet.
- Changed files summary: none yet.
- Phase commits: none.
- Rules deploy status: not_applicable.
- Incidents: none.

### T004 - E2E Coverage And Browser Evidence Gate

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: Weather E2E Engineer
- **Reviewer**: Test Strategist Reviewer
- **Commit checkpoint**: none; future Release Manager action only after explicit `commit=true` authorization.
- **Last verified commit**: none
- **Authorization boundary**: current edit=yes for T004 owned file after T003 completes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Extend weather E2E coverage for custom controls, hover tooltip, selected polygon visibility, mobile bottom sheet, and existing weather journey.
- Define final browser evidence fields for Verifier closeout.

Non-scope:

- Do not edit product code, integration tests, package metadata, Playwright config, or lockfiles.
- Do not remove the existing `CWA_API_KEY` skip behavior.
- Do not use fixed sleeps.
- Do not edit workflow state files.

Owned files:

- `tests/e2e/weather-page.spec.js`

Read-only context:

- `specs/weather-taiwan-md-map/spec.md`
- `specs/weather-taiwan-md-map/plan.md`
- `.codex/rules/testing-standards.md`
- `src/components/weather/TaiwanMap.jsx`
- `src/components/weather/weather.module.css`
- `src/ui/weather/WeatherPageScreen.jsx`
- `tests/integration/weather/weather-page.test.jsx`
- `tests/integration/weather/township-drilldown.test.jsx`
- `package.json`

Dependencies:

- T001 completed.
- T002 completed.
- T003 completed.
- User authorized continuing implementation through the pre-push stage on 2026-05-21; edit=true and commit=true for T004 after T003 completes, push and later release steps remain unauthorized.

Browser evidence:

- Required in this task and again at final Verifier gate if any later implementation changes occur.
- Target URL: `http://localhost:3000/weather`.
- Viewports: desktop 1440x900, tablet 834x1112, mobile 390x844.
- Tool: Browser plugin or Playwright screenshot evidence.
- Required signals: map nonblank, pan/zoom/reset work, hover tooltip visible on desktop, selected polygon visibly highlighted, mobile tap reveals bottom sheet, sheet dismissal preserves selected state, back-to-overview clears selected state, console has no new relevant errors, network has no new third-party tile or D3 requests.

Engineer instructions:

- Modify only the owned file above.
- Keep `test.skip(!hasCwaKey, 'Requires CWA_API_KEY in .env — skipped in CI');` behavior or an equivalent credential-gated skip.
- Add locator helpers for map controls and Leaflet SVG paths using Playwright locators and web-first assertions.
- Add assertions for zoom-in, zoom-out, and reset controls without depending on fixed sleeps.
- Add desktop hover tooltip assertion against a real Leaflet path.
- Add selected polygon visibility assertion after county selection.
- Add mobile viewport test for tap selection and weather bottom sheet behavior.
- Keep the existing empty state, county selection, back-to-overview, and URL sync coverage.

Acceptance criteria:

- AC-T004.1: E2E file covers controls, tooltip, selected polygon, mobile sheet, and existing weather journey.
- AC-T004.2: E2E command exits 0 when credentials are available or skips for the existing credential reason when absent.
- AC-T004.3: No `page.waitForTimeout()` is introduced.
- AC-T004.4: Browser evidence is recorded for desktop, tablet, and mobile.
- AC-T004.5: No new dependencies, package changes, Playwright config changes, or product-code changes are present.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx playwright test tests/e2e/weather-page.spec.js --project=chromium` | Exit 0; passes with `CWA_API_KEY`, or skips with the existing key-required reason when absent. |
| `npm run lint:changed` | Exit 0; no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0; no changed-file type errors. |

Reviewer PASS criteria:

- Diff touches only `tests/e2e/weather-page.spec.js`.
- Required verification commands pass and match the expected signal.
- Browser evidence fields are present in the Engineer report.
- Playwright style follows repo testing rules: locators and web-first assertions, no fixed waits.
- Existing credential skip behavior is preserved.

Reviewer REJECT criteria:

- Diff touches non-owned files.
- Test relies on fixed sleeps or brittle DOM node traversal when a locator is available.
- Existing weather journey coverage is removed.
- Browser evidence is missing or cannot prove required viewports and interactions.
- Verification is missing, stale, failed, or uses a different command.

Evidence:

- Engineer report: none yet.
- Reviewer report: none yet.
- Command output summary: none yet.
- Changed files summary: none yet.
- Phase commits: none.
- Rules deploy status: not_applicable.
- Incidents: none.
