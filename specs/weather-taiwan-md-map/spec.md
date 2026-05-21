# Weather Taiwan.md-Style Map Spec

## Summary

Replace the weather page's current fixed Taiwan map presentation with a
Taiwan.md-inspired interactive map while preserving the existing weather,
township drill-down, island, favorites, URL restore, and localStorage restore
behavior.

The implementation should keep the current Leaflet / GeoJSON stack instead of
switching to Taiwan.md's D3 / SVG stack. The target is matching user-facing
interaction and visual quality, not copying Taiwan.md internals.

## User Scenarios

- As a runner checking weather, I can pan, zoom, and reset the Taiwan map so I
  can inspect areas without losing the weather page workflow.
- As a user browsing the overview map, I can hover a county and see the county
  name in a cursor tooltip before selecting it.
- As a user browsing a selected county, I can hover a township and see
  `county · township` in a cursor tooltip before selecting it.
- As a mobile user, I can tap a county or township and see the selected
  administrative area in the weather bottom sheet because hover is unavailable.
- As an existing weather page user, county weather, township weather, favorites,
  URL sync, last-location restore, and back-to-overview keep working.

## Requirements

- Preserve the existing weather page functional contract:
  - county selection fetches county weather and enters township drill-down;
  - township selection fetches township weather;
  - island selection continues to resolve to the existing target weather
    location and display suffix behavior;
  - favorites continue to load, select, remove, and toggle;
  - URL parameter sync and initial restore from URL, favorites, and localStorage
    continue to work;
  - back-to-overview clears selected weather state and returns to the overview
    map.
- Keep `react-leaflet`, `leaflet`, and existing weather GeoJSON data as the map
  implementation base.
- Do not add `d3` or migrate the weather map to Taiwan.md's D3 / SVG engine.
- Enable full interactive map controls:
  - drag pan;
  - scroll wheel / touch zoom where practical;
  - double-click zoom;
  - custom `+`, `-`, and home/reset controls;
  - reset returns to the fitted bounds for the current layer.
- Apply Taiwan.md-inspired visual treatment:
  - soft ocean background;
  - subtle wave texture;
  - county/region color palette;
  - compass in the map canvas;
  - visible hover and selected polygon states;
  - paper-like map surface depth.
- Exclude Taiwan.md-specific non-weather content:
  - no article markers;
  - no curated route pills;
  - no article sidebar;
  - no region/category article filters;
  - no left-bottom `台灣 TAIWAN / 22 COUNTIES...` branding text.
- Add cursor tooltip behavior:
  - overview hover shows the county name;
  - county-layer hover shows `countyName · townshipName`;
  - tooltip follows the cursor and stays within the map container when possible;
  - tooltip hides on pointer leave and does not block map clicks.
- Mobile behavior:
  - use tap selection instead of hover;
  - show selected administrative area in the weather information surface;
  - use a bottom-sheet pattern for weather content after selection;
  - overlay or equivalent dismissal must not break back-to-overview;
  - map pan/zoom must not make the weather sheet unusable.
- Accessibility and testability:
  - keep the map discoverable by its existing accessible role/name or update
    tests and semantics together;
  - controls must be keyboard-focusable buttons with labels;
  - visible text must not overlap or overflow on desktop, tablet, or mobile.

## Success Criteria

- Existing weather page integration tests still prove county selection,
  township selection, favorites, restore, and back-to-overview behavior.
- New or updated tests prove hover tooltip content for county and township
  administrative areas.
- New or updated tests prove zoom-in, zoom-out, and home/reset controls are
  present and wired to the map operation boundary.
- Browser verification covers desktop, tablet, and mobile viewports.
- Browser verification confirms:
  - map is nonblank;
  - pan, zoom, and reset work;
  - hover tooltip appears on desktop;
  - selected polygons remain visibly highlighted;
  - mobile tap opens the weather bottom sheet;
  - bottom sheet dismissal does not lose the selected weather state unless the
    user explicitly returns to overview.
- No new dependency is added for this feature.
- No visual regression includes Taiwan.md's left-bottom branding text.

## Out Of Scope

- Rewriting the map with D3.
- Adding article markers, routes, route stops, category filters, or article
  exploration behavior from Taiwan.md.
- Changing the weather API contract.
- Changing Firebase weather favorites schema or security rules.
- Changing CWA data parsing.
- Reworking global page navigation or app shell layout.
- Adding new third-party map tile sources.

## Technical Direction

Keep the change concentrated in the weather map UI boundary:

- `src/components/weather/TaiwanMap.jsx` owns Leaflet map configuration,
  GeoJSON layers, layer fitting, tooltip state, and custom map controls.
- `src/components/weather/weather.module.css` owns the visual treatment,
  responsive layout, tooltip, controls, map canvas, and bottom-sheet styling.
- `src/ui/weather/WeatherPageScreen.jsx` may change only where layout structure
  is needed for the mobile bottom sheet.
- `src/runtime/hooks/useWeatherPageRuntime.js` should remain focused on weather,
  selection, favorites, and restore orchestration. Avoid changing fetch or
  persistence semantics unless the UI requires a small state boundary.

The main design tradeoff is intentional: Leaflet will remain the engine even
though Taiwan.md uses D3 / SVG. This avoids a dependency and engine migration
while still delivering the requested user-facing behavior.

## Verification Plan

- Run focused weather integration/unit tests affected by `TaiwanMap`,
  `WeatherPageScreen`, and `useWeatherPageRuntime`.
- Run `npm run lint:changed`.
- Run `npm run type-check:changed`.
- Run browser verification at desktop, tablet, and mobile viewport sizes.
- Run or update weather E2E when feasible. If live CWA credentials are required
  and unavailable, use browser smoke verification plus mocked integration tests
  and state the limitation.

## User Authorization

- Spec approved by: user on 2026-05-21 for the design conversation.
- One-time automated execution authorization: no.
- Authorization boundary:
  - edit: spec document only
  - commit: no
  - push: no
  - pullRequest: no
  - ciWatch: no
  - merge: no
  - localMainSync: no
  - deployFirestoreRules: no

## Release Notes

- Firestore/storage rules deploy required: not applicable.
- Final summaries must not imply deployed rules or deployed product behavior.
