# Weather Taiwan.md-Style Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed weather Taiwan map with a Taiwan.md-inspired interactive Leaflet map while preserving county weather, township drill-down, islands, favorites, URL restore, localStorage restore, and back-to-overview behavior.

**Architecture:** Keep the feature inside the weather UI boundary. `TaiwanMap.jsx` owns Leaflet map behavior, layer fitting, tooltip state, and custom controls; `WeatherPageScreen.jsx` owns the weather information surface and mobile bottom-sheet state; `weather.module.css` owns all visual treatment and responsive layout. Runtime weather selection and persistence should remain unchanged unless an Engineer proves the UI cannot satisfy the spec with existing runtime state.

**Tech Stack:** Next.js 15 App Router, React 19, JavaScript with JSDoc `checkJs`, CSS Modules, Leaflet, react-leaflet, existing weather GeoJSON cache, Vitest browser project, Testing Library, Playwright.

---

## Scope And Non-Scope

In scope:

- Enable Leaflet drag pan, scroll/touch zoom where practical, double-click zoom, and custom zoom/home controls.
- Add cursor tooltip for county and township hover without blocking map clicks.
- Add Taiwan.md-inspired weather map visuals using the existing Leaflet and CSS Module stack.
- Add mobile bottom-sheet behavior for weather information after tap selection.
- Update focused integration and E2E tests for the new behavior.

Non-scope:

- No new dependency, including no D3 migration.
- No new third-party tile source.
- No weather API, CWA parser, Firebase favorite schema, security rules, auth, or persistence contract change.
- No article markers, route pills, article sidebar, category filters, or Taiwan.md left-bottom branding text.
- No product-code edits by the main agent; implementation must be Engineer-first and Reviewer-checked.
- No commit, push, PR, CI watch, merge, local `main` sync, or rules deploy unless the user explicitly authorizes that boundary later.

## File Responsibility Map

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `src/components/weather/TaiwanMap.jsx` | Modify | Leaflet configuration, helper controls, fit-bounds reset, GeoJSON event handlers, hover tooltip state, selected polygon behavior, map accessibility labels. |
| `src/components/weather/weather.module.css` | Modify | Ocean background, wave texture, map surface depth, region palette support, tooltip, compass, custom controls, selected and hover visual states, responsive bottom sheet. |
| `src/ui/weather/WeatherPageScreen.jsx` | Modify | Weather content placement, mobile bottom-sheet open/dismiss behavior, selected location surface, preservation of back-to-overview and favorite actions. |
| `tests/integration/weather/weather-page.test.jsx` | Modify | County-level integration coverage for map render, county hover tooltip, custom controls, county selection, island selection, and unchanged weather fetch behavior. |
| `tests/integration/weather/township-drilldown.test.jsx` | Modify | T001 owns township hover tooltip and township-selection map-handler coverage; T003 later owns mobile bottom-sheet, back-to-overview, and dismissal coverage in the same file after T001 completes. |
| `tests/integration/app/weather-page-entry.test.jsx` | Modify only if T001 evidence shows entry coverage breaks | App-entry smoke coverage for updated accessible map/control semantics. This file is intentionally not owned by any default implementation task; request coordinator approval before editing it. |
| `tests/e2e/weather-page.spec.js` | Modify | Browser-level weather journey assertions for controls, tooltip, selected polygon visibility, mobile bottom sheet, and URL/back-to-overview behavior. |
| `src/runtime/hooks/useWeatherPageRuntime.js` | Read-only by default | Selection, fetch, favorites, URL sync, localStorage restore. Do not edit unless the coordinator updates this plan after a reviewed blocker. |

## Dependency Graph

```text
T001 map behavior, county tests, and township tooltip tests
  -> T002 visual styling
    -> T003 mobile bottom sheet and township tests
      -> T004 E2E and browser evidence gate
```

There are no same-wave parallel implementation tasks in this plan. The files are too coupled for safe parallel writes: `TaiwanMap.jsx` defines class and accessibility contracts consumed by CSS and tests, while `weather.module.css` styles both the map and bottom sheet.

## Task Waves

### Wave 1: Interactive Map Contract

- Task: T001.
- Owned files: `src/components/weather/TaiwanMap.jsx`, `tests/integration/weather/weather-page.test.jsx`, `tests/integration/weather/township-drilldown.test.jsx`.
- Outcome: map interaction flags, custom controls, reset boundary, county and township tooltips, and map-handler test coverage are in place.

### Wave 2: Visual Treatment

- Task: T002.
- Owned files: `src/components/weather/weather.module.css`.
- Outcome: CSS implements the Taiwan.md-inspired weather map treatment and responsive support for controls, tooltip, compass, and bottom sheet classes introduced by T001 and T003.

### Wave 3: Mobile Weather Surface

- Task: T003.
- Owned files: `src/ui/weather/WeatherPageScreen.jsx`, `tests/integration/weather/township-drilldown.test.jsx`.
- Outcome: mobile bottom-sheet behavior works without altering weather runtime semantics, and township selection coverage remains green.

### Wave 4: Browser And E2E Gate

- Task: T004.
- Owned files: `tests/e2e/weather-page.spec.js`.
- Outcome: E2E assertions and manual browser evidence requirements cover desktop, tablet, and mobile journeys.

## Task Details

### Task T001: Leaflet Interaction, Controls, And Administrative Tooltips

Owned files:

- `src/components/weather/TaiwanMap.jsx`
- `tests/integration/weather/weather-page.test.jsx`
- `tests/integration/weather/township-drilldown.test.jsx`

Implementation steps:

- [ ] Update the `react-leaflet` mocks in `tests/integration/weather/weather-page.test.jsx` and `tests/integration/weather/township-drilldown.test.jsx` so `MapContainer` exposes received map props in the DOM and `GeoJSON` mock buttons can trigger `mouseover`, `mousemove`, `mouseout`, and `click` handlers.
- [ ] Add failing tests for county hover tooltip: hover `臺北市`, assert tooltip text `臺北市`, move/leave, assert it disappears.
- [ ] Add failing tests for township hover tooltip: select `新北市`, hover `板橋區`, assert tooltip text `新北市 · 板橋區`, move/leave, assert it disappears.
- [ ] Add failing tests for custom controls: assert keyboard-focusable buttons named `放大地圖`, `縮小地圖`, and `重設地圖範圍` are present; click each and assert the mocked map boundary receives zoom-in, zoom-out, and reset signals.
- [ ] In `TaiwanMap.jsx`, enable `dragging`, `scrollWheelZoom`, `touchZoom`, and `doubleClickZoom` on `MapContainer`.
- [ ] Add a small map-control component using `useMap()` that renders `+`, `-`, and home buttons, calls `map.zoomIn()`, `map.zoomOut()`, and fits the current active GeoJSON bounds.
- [ ] Add tooltip state to `TaiwanMap.jsx`; overview hover shows county name, county-layer hover shows `countyName · townshipName`, follows pointer inside the map container where possible, and hides on pointer leave.
- [ ] Keep existing county click and island click behavior unchanged.

Acceptance criteria:

- County click still fetches weather and enters township drill-down.
- Island click still resolves to the existing target weather location and display suffix behavior.
- Custom controls are buttons with accessible labels.
- Tooltip does not block map clicks and hides on pointer leave for both county and township layers.
- No new dependency appears in `package.json` or lockfile.

Verification commands:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser tests/integration/weather/weather-page.test.jsx` | Exit 0; county selection, island selection, county tooltip, and custom control tests pass. |
| `npx vitest run --project=browser tests/integration/weather/township-drilldown.test.jsx` | Exit 0; township drill-down and township tooltip tests pass. |
| `npm run lint:changed` | Exit 0; no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0; no changed-file type errors. |

Browser evidence requirement:

- Required after Wave 4, not during this task. The evidence must later show desktop county and township hover tooltip plus control behavior on a real Leaflet map.

### Task T002: Taiwan.md-Inspired Weather Map Styling

Owned file:

- `src/components/weather/weather.module.css`

Implementation steps:

- [ ] Add CSS variables for ocean, land palette, shoreline, selected, hover, paper surface, control surface, and tooltip text colors.
- [ ] Style `.mapContainer` as the map canvas with soft ocean background, subtle wave texture, paper-like depth, and no Taiwan.md left-bottom branding text.
- [ ] Add styles for Leaflet SVG paths using class hooks or container descendant selectors so hover and selected states are visible without relying only on JS path colors.
- [ ] Add styles for map controls, compass, and tooltip introduced by T001.
- [ ] Add responsive CSS for the mobile bottom-sheet classes that T003 will use, keeping desktop side-by-side layout intact.
- [ ] Confirm visible text does not overflow at 390px mobile width, 834px tablet width, and 1440px desktop width during Wave 4 browser evidence.

Acceptance criteria:

- Map background reads as soft ocean with subtle wave texture and paper-like depth.
- County and township polygons have visible hover and selected states.
- Compass and controls are visually present inside the map canvas.
- CSS does not introduce global leakage outside `.weatherRoot` or Leaflet descendants inside the weather map.
- No Taiwan.md left-bottom branding text is added.

Verification commands:

| Command | Expected signal |
| ------- | --------------- |
| `npm run lint:changed` | Exit 0; CSS Module references from changed JS files remain valid and lint has no changed-file errors. |
| `npm run type-check:changed` | Exit 0; no changed-file type errors. |

Browser evidence requirement:

- Required after Wave 4. Capture desktop, tablet, and mobile screenshots proving nonblank map, visible controls, compass, selected polygon, and no overlapping text.

### Task T003: Mobile Bottom Sheet

Owned files:

- `src/ui/weather/WeatherPageScreen.jsx`
- `tests/integration/weather/township-drilldown.test.jsx`

Implementation steps:

- [ ] Add failing bottom-sheet test: after mobile-width township selection, weather information is inside a labelled weather sheet; dismissing or collapsing the sheet does not reset selected weather state; back-to-overview still clears the selection.
- [ ] In `WeatherPageScreen.jsx`, add local presentation state for sheet collapsed/open state without moving weather fetch or persistence behavior out of runtime.
- [ ] Render selected weather information in a bottom-sheet pattern on mobile while preserving the existing desktop card panel and favorite controls.
- [ ] Keep `BackToOverviewButton`, `FavoriteButton`, `FavoritesBar`, `WeatherCard`, loading, empty, and error states reachable.

Acceptance criteria:

- Township selection still fetches township weather.
- Back-to-overview clears selected weather state and returns to overview.
- Bottom-sheet dismissal does not lose selected weather state.
- Mobile users can see the selected administrative area after tap selection.
- Desktop layout remains side-by-side.

Verification commands:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser tests/integration/weather/township-drilldown.test.jsx` | Exit 0; township drill-down, existing township tooltip coverage from T001, bottom-sheet dismissal, and back-to-overview tests pass. |
| `npm run lint:changed` | Exit 0; no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0; no changed-file type errors. |

Browser evidence requirement:

- Required after Wave 4. Capture mobile viewport evidence that tap selection opens or reveals the bottom sheet and dismissal does not reset selected weather state.

### Task T004: E2E Coverage And Browser Evidence Gate

Owned file:

- `tests/e2e/weather-page.spec.js`

Implementation steps:

- [ ] Extend the E2E helper to locate the weather map, real Leaflet paths, custom controls, and selected path state without using fixed sleeps.
- [ ] Add E2E assertions for custom zoom-in, zoom-out, and reset controls.
- [ ] Add E2E assertions for desktop hover tooltip on a county path.
- [ ] Add E2E assertions that selected polygons remain visibly highlighted after selection.
- [ ] Add mobile viewport coverage for tap selection and weather bottom sheet visibility.
- [ ] Keep the existing CWA API key skip behavior; when `CWA_API_KEY` is absent, the Playwright command should skip rather than fail.

Acceptance criteria:

- E2E still covers empty state, county click, drill-down/back-to-overview, and URL parameter sync.
- E2E adds control, tooltip, selected state, and mobile bottom-sheet checks.
- The test uses Playwright locators and web-first assertions.
- No `page.waitForTimeout()` is introduced.

Verification commands:

| Command | Expected signal |
| ------- | --------------- |
| `npx playwright test tests/e2e/weather-page.spec.js --project=chromium` | Exit 0; passes when `CWA_API_KEY` is configured, or skips with the existing `Requires CWA_API_KEY` reason when absent. |
| `npm run lint:changed` | Exit 0; no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0; no changed-file type errors. |

Browser evidence requirement:

- Required for final integration. Start the local app with `npm run dev`, open `http://localhost:3000/weather`, and collect screenshots or browser-tool observations for:
  - desktop 1440x900: nonblank map, hover tooltip, controls, reset, selected polygon, no Taiwan.md left-bottom branding text;
  - tablet 834x1112: nonblank map, controls usable, weather content not overlapping map;
  - mobile 390x844: tap selection reveals weather bottom sheet, dismissing sheet preserves selected state, back-to-overview clears state.

## Acceptance Criteria

- Existing county selection, township selection, island selection, favorites, URL sync, localStorage restore, and back-to-overview behavior still pass focused tests.
- New or updated tests prove county and township hover tooltip content.
- New or updated tests prove zoom-in, zoom-out, and reset controls exist and call the map boundary.
- Browser verification covers desktop, tablet, and mobile viewports.
- Browser verification confirms map is nonblank, pan/zoom/reset work, desktop hover tooltip appears, selected polygons remain highlighted, mobile tap reveals the weather bottom sheet, and sheet dismissal does not lose selected weather state.
- No new dependency is added.
- No Taiwan.md left-bottom branding text appears.

## Verification Commands

Focused task commands:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run --project=browser tests/integration/weather/weather-page.test.jsx` | Exit 0; county map behavior, custom controls, tooltip, and island behavior pass. |
| `npx vitest run --project=browser tests/integration/weather/township-drilldown.test.jsx` | Exit 0; township drill-down, tooltip, bottom sheet, and back-to-overview pass. |
| `npx vitest run --project=browser tests/integration/app/weather-page-entry.test.jsx` | Exit 0 if run after entry semantics are touched; app-entry smoke remains green. |
| `npx playwright test tests/e2e/weather-page.spec.js --project=chromium` | Exit 0; passes with `CWA_API_KEY`, or skips with existing key-required reason when absent. |
| `npm run lint:changed` | Exit 0; no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0; no changed-file type errors. |
| `npm run depcruise` | Exit 0; dependency direction remains valid. |

Final integration gate:

| Command | Expected signal |
| ------- | --------------- |
| `npm run test:branch` | Exit 0; branch-scoped Vitest gate passes. |
| `npm run test:e2e:branch` | Exit 0; branch-scoped E2E gate passes or documents a credential-gated skip already permitted by the existing weather E2E contract. |
| `npm run build` | Exit 0; production build succeeds. |

## Browser Evidence Requirements

Browser evidence is mandatory before claiming implementation complete. Use the in-app Browser tool or Playwright screenshots against `http://localhost:3000/weather` after starting `npm run dev`.

Record the following for the Reviewer or Verifier:

- Desktop 1440x900: screenshot path or browser observation, map nonblank, county hover tooltip visible, controls clickable, reset returns to fitted bounds, selected polygon visibly highlighted, console has no new relevant errors.
- Tablet 834x1112: screenshot path or browser observation, map and weather content do not overlap, controls remain usable, text stays inside containers.
- Mobile 390x844: screenshot path or browser observation, tap selection reveals weather bottom sheet, sheet dismissal preserves selected location/weather state, back-to-overview clears selection, map pan/zoom does not make the sheet unusable.
- Network observation: no new third-party tile requests or D3 dependency fetches are introduced.

## Risk Analysis

- Leaflet in jsdom is mocked, so integration tests can prove DOM contracts and handler wiring but cannot prove real SVG geometry. Mitigation: T004 requires real browser evidence.
- Tooltip state can cause React re-render churn on pointer move. Mitigation: keep state minimal, clamp coordinates cheaply, and avoid changing selected weather state during hover.
- Bottom-sheet dismissal could accidentally clear weather state if implemented through runtime reset. Mitigation: keep dismissal as presentation state in `WeatherPageScreen.jsx`; only `handleBackToOverview` clears selection.
- CSS changes can accidentally hide Leaflet SVG paths or controls. Mitigation: browser evidence requires nonblank map and selected polygon visibility.
- E2E depends on `CWA_API_KEY`. Mitigation: keep existing skip behavior and rely on mocked integration tests plus browser smoke evidence when credentials are absent.
- `TaiwanMap.jsx` may exceed the 300-line source limit after adding controls and tooltip. Mitigation: Engineer should extract small internal components in the same file only if the final file remains compliant; if it cannot, stop and request a plan update for a new owned helper file.
- Editing `tests/integration/app/weather-page-entry.test.jsx` is not in a default task. If accessible map semantics require that file to change, stop and ask the coordinator to update owned files before editing.

## Final Integration Gate

T001 implementation edit is authorized by the user on 2026-05-21 for the T001 owned files only. T002-T004 implementation edits remain unauthorized until the user explicitly grants `edit=true` for those task scopes.

Before Release Manager closeout is considered, all task states must be `completed` in `tasks.md` and `status.json`, and `handoff.md` must match them. Reviewer PASS is required for every implementation task. Verifier must then run fresh final integration evidence:

- `npm run lint:changed`
- `npm run type-check:changed`
- `npm run depcruise`
- `npm run test:branch`
- `npm run test:e2e:branch`
- `npm run build`

Release Manager actions are outside the current authorization boundary. Commit checkpoints, push, PR creation, CI watch, merge, and local `main` sync require explicit future user authorization for each boundary.
