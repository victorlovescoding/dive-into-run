# Weather UV/AQI Standards UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在天氣頁今日 UV 與 AQI 指標補上官方等級、保守跑步行動建議，以及可存取的官方級距說明 overlay。

**Architecture:** 保留既有天氣資料模型與資料來源，只在 weather UI 邊界新增 UI-local standards helper、UV/AQI 說明 overlay 互動狀態與 WeatherPageScreen 手機 sheet 協調。今日卡片使用既有 `today.uv.level` 與 `today.aqi.status` 顯示等級，helper 只負責 overlay 級距表、高亮與短建議文案。

**Tech Stack:** Next.js 15 App Router, React 19 client components, JavaScript + JSDoc `checkJs`, CSS Modules, Vitest browser project, Testing Library.

---

## Profile, Artifacts, And Authorization

- Profile: P3 High-risk UI Enhancement.
- Classification: C3/R2 -> P3. This is an existing weather page UI enhancement in one UI domain, with coordinated component/page interaction, accessibility requirements, and regression-prone overlay behavior. It is not a new product feature, schema/API change, dependency change, migration, or multi-feature program, so P4's full five-file feature artifact set is not justified.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-083-weather-uv-aqi-standards-ui`.
- Branch: `083-weather-uv-aqi-standards-ui`, currently ahead of `origin/main`.
- Durable artifacts: compact P3 state only. `specs/weather-uv-aqi-standards-ui/spec.md` and this `plan.md` are sufficient for the current dispatcher contract. Do not create `tasks.md`, `handoff.md`, or `status.json` unless implementation later crosses sessions, needs dispatcher continuity that cannot live in this plan, or the main agent explicitly authorizes additional durable state.
- Durable plan path: `specs/weather-uv-aqi-standards-ui/plan.md`; do not use legacy `docs/superpowers/plans/`.
- Authorization boundary recorded for later agents: this plan does not authorize app-source edits, commit, push, PR creation, CI watch, merge, local `main` sync, dependency changes, API changes, schema changes, rules changes, or deploy. Implementation agents need explicit dispatch with owned files and an edit boundary before changing app source. The commit checkpoint snippets below are examples only and require separate commit authorization.
- Planner/reviewer boundary: plan review may edit only this `plan.md`; it must not modify app source, implement UI, or commit.

## File Structure

### Create

- `src/components/weather/weather-standards.js`
  - UI-local source of truth for static standards metadata used only by weather UI.
  - Exports exact official source URLs from the approved spec:
    - UV: `https://opendata.cwa.gov.tw/opendatadoc/insrtuction/CWA_Data_Standard.pdf`
    - AQI: `https://airtw.moenv.gov.tw/CHT/Information/Standard/AirQualityIndicatorNew.aspx`
  - Exports `UV_STANDARD_ROWS` and `AQI_STANDARD_ROWS` with `id`, `rangeLabel`, `min`, `max`, and `label`.
  - Exports `getCurrentStandardRow(metric, value)` for overlay high亮; returns `null` only when `value == null` or metric is not `uv`/`aqi`.
  - Exports `getWeatherMetricAdvice(metric, levelOrStatus)` for the one-line card advice.
  - Does not import runtime, service, repo, API, Firebase, or type files.

- `src/components/weather/weather-standards.test.js`
  - Focused helper tests for official rows, AQI split hazard rows, boundary matching, `null` handling, source URLs, and advice copy.

- `src/components/weather/WeatherCard.test.jsx`
  - Rendering and desktop interaction coverage for today UV/AQI, null states, tomorrow summary constraints, popover content, high亮, Escape close, outside click close, focus return, and accessible button attributes.

- `src/ui/weather/WeatherPageScreen.test.jsx`
  - Mobile integration coverage for WeatherPageScreen passing sheet mode into WeatherCard, UV/AQI bottom sheet behavior, existing weather sheet suppression, Escape close, and state restoration after close.

### Modify

- `src/components/weather/WeatherCard.jsx`
  - Implement the UV/AQI standards interaction at the nearest appropriate weather UI client boundary. `WeatherPageScreen.jsx` is already a client component; add `'use client';` to `WeatherCard.jsx` only if the chosen design requires WeatherCard to be a standalone client boundary after confirming the Next.js import boundary.
  - Keep current temperature, weather description, and today morning/evening hierarchy ahead of metric details.
  - Replace only the UV/AQI metric cells with enhanced metric presentation.
  - Preserve rain and humidity metric behavior.
  - Preserve tomorrow summary: UV value plus `uv.level`; no tomorrow info button; no tomorrow AQI.
  - Add optional props:
    - `isMobileStandardsSheetMode?: boolean`
    - `onStandardsSheetOpenChange?: (isOpen: boolean) => void`
  - Use helper rows for overlay high亮 only; card grade text must come from `today.uv.level` and `today.aqi.status`.

- `src/components/weather/weather.module.css`
  - Add styles for enhanced metrics, compact advice text, 44px info buttons, desktop popover, mobile sheet layer, scrim, close button, standards table, and non-color current-row marker.
  - Add styling needed to ensure the existing mobile weather sheet is not visually or semantically active while a UV/AQI standards sheet is open. A suppression class is acceptable, but an equivalent parent/sibling overlay approach is also acceptable if it passes the behavior and accessibility tests.
  - Do not add a new color system; use existing `--sky-*` and `--map-sheet-*` variables with restrained contrast.

- `src/ui/weather/WeatherPageScreen.jsx`
  - Pass `isMobileStandardsSheetMode={isMobileWeatherSheetMode}` to `WeatherCard`, or use an equivalent parent-owned overlay design that keeps the same desktop/mobile behavior.
  - Track whether a mobile UV/AQI standards sheet is open.
  - Ensure the existing weather sheet is hidden from users and assistive technology only while a mobile standards sheet is open, then restore the previous collapsed/expanded state unchanged after close.
  - Keep map, favorites, selection, and weather loading/error behavior unchanged.

### Do Not Modify

- `src/types/weather-types.js`: existing `TodayWeather.uv`, `TodayWeather.aqi`, `TomorrowWeather.uv`, `UvInfo`, and `AqiInfo` are sufficient.
- API route, weather service, repo files, Firebase files, package files, lockfile, app routing files, and `specs/weather-uv-aqi-standards-ui/spec.md`.
- No third-party UI dependency.

## Dependency Graph

1. Task 1 creates helper contract and tests.
2. Task 2 consumes helper for static rendering and null/tomorrow constraints.
3. Task 3 builds desktop popover interaction on top of Task 2.
4. Task 4 adds mobile sheet and WeatherPageScreen coordination on top of Task 3.
5. Final integration gate runs after all Engineer/Reviewer slices pass.

All implementation tasks are serialized because Tasks 2-4 write overlapping `WeatherCard.jsx` and `weather.module.css`.

## Task 1: Standards Helper And Unit Tests

**Role:** Engineer, followed by Reviewer.

**Owned files:**
- Create: `src/components/weather/weather-standards.js`
- Create: `src/components/weather/weather-standards.test.js`

**Read-only context:**
- `specs/weather-uv-aqi-standards-ui/spec.md`
- `src/types/weather-types.js`
- `src/components/weather/WeatherCard.jsx`
- `src/components/weather/FavoritesBar.test.jsx`

**Non-scope:**
- Do not edit `WeatherCard.jsx`.
- Do not edit CSS.
- Do not change weather types, service normalization, API, or official spec content.

**Helper contract:**
- `UV_STANDARD_ROWS` exact rows:
  - `0-2` / `低量級`
  - `3-5` / `中量級`
  - `6-7` / `高量級`
  - `8-10` / `過量級`
  - `11+` / `危險級`
- `AQI_STANDARD_ROWS` exact rows:
  - `0-50` / `良好`
  - `51-100` / `普通`
  - `101-150` / `對敏感族群不健康`
  - `151-200` / `對所有族群不健康`
  - `201-300` / `非常不健康`
  - `301-400` / `危害`
  - `401-500` / `危害`
- `getCurrentStandardRow('uv', value)` returns the matching UV row by inclusive range.
- `getCurrentStandardRow('aqi', value)` returns the matching AQI row by inclusive range, with `450` matching only the `401-500` row.
- `getCurrentStandardRow(metric, null)` returns `null`.
- `getWeatherMetricAdvice('uv', level)` returns exactly one of:
  - `低量級`: `可正常跑，留意補水`
  - `中量級`: `補防曬，避開正午`
  - `高量級`: `改清晨/傍晚，縮短曝曬`
  - `過量級`: `改清晨/傍晚，縮短曝曬`
  - `危險級`: `優先室內或避開曝曬`
- `getWeatherMetricAdvice('aqi', status)` returns exactly one of:
  - `良好`: `可正常跑，留意體感`
  - `普通`: `可正常跑，敏感者留意體感`
  - `對敏感族群不健康`: `降低強度，敏感者改室內`
  - `對所有族群不健康`: `縮短戶外時間，室內優先`
  - `非常不健康`: `改室內，延後戶外跑`
  - `危害`: `改室內，延後戶外跑`
- Unknown level/status returns an empty string so the card can hide advice instead of inventing copy.

**TDD steps:**
- [ ] Add `weather-standards.test.js` with test names:
  - `defines the approved official UV standard rows`
  - `defines the approved official AQI standard rows with split hazard ranges`
  - `matches current UV rows by inclusive boundaries`
  - `matches current AQI rows by inclusive boundaries`
  - `returns no current row for null values`
  - `returns conservative one-line running advice without medical claims`
  - `exposes only CWA and MOENV source URLs`
- [ ] Run the helper test and confirm it fails because `weather-standards.js` does not exist.
- [ ] Create `weather-standards.js` with static rows and helper functions matching the contract above.
- [ ] Run the helper test and confirm all helper assertions pass.

**Acceptance criteria:**
- The helper rows exactly match the approved spec table.
- AQI has two separate `危害` rows and high亮 matching is range-specific.
- No helper function imports weather service, repo, API, or Firebase modules.
- Advice copy does not say a state is safe, does not mention training zones, and does not make medical eligibility claims.

**Verification commands:**
- `npx vitest run --project=browser src/components/weather/weather-standards.test.js`
- `npm run lint:changed`
- `npm run type-check:changed`

**Commit checkpoint suggestion:**
- Stage: `git add src/components/weather/weather-standards.js src/components/weather/weather-standards.test.js`
- Commit: `git commit -m "feat: add weather standards helper"`

**Reviewer slice:**
- Inspect only the two owned files and the helper test output.
- Return `review_rejected` if any official row, source URL, boundary, or advice string differs from this plan.

## Task 2: Today Metric Rendering, Null States, And Tomorrow Constraints

**Role:** Engineer, followed by Reviewer.

**Owned files:**
- Modify: `src/components/weather/WeatherCard.jsx`
- Modify: `src/components/weather/weather.module.css`
- Create: `src/components/weather/WeatherCard.test.jsx`

**Read-only context:**
- `specs/weather-uv-aqi-standards-ui/spec.md`
- `src/components/weather/weather-standards.js`
- `src/components/weather/WeatherCard.jsx`
- `src/components/weather/weather.module.css`
- `src/types/weather-types.js`
- `src/components/weather/FavoritesBar.test.jsx`

**Non-scope:**
- Do not implement popover open/close behavior in this task.
- Do not edit `WeatherPageScreen.jsx`.
- Do not change tomorrow data shape, add tomorrow AQI, or add tomorrow info buttons.
- Do not modify API, service, repo, or type files.

**Component contract:**
- Rain and humidity remain simple metric cells.
- Today UV with data shows:
  - label `紫外線`
  - value from `today.uv.value`
  - grade text from `today.uv.level`
  - advice from `getWeatherMetricAdvice('uv', today.uv.level)`
  - a real button with accessible name `查看紫外線等級說明`
  - `aria-expanded="false"` before overlay opens
- Today AQI with data shows:
  - label `AQI`
  - value from `today.aqi.value`
  - status text from `today.aqi.status`
  - advice from `getWeatherMetricAdvice('aqi', today.aqi.status)`
  - a real button with accessible name `查看 AQI 等級說明`
  - `aria-expanded="false"` before overlay opens
- Today UV `null` shows `—` in the UV metric cell and hides grade, advice, and info button.
- Today AQI `null` shows `—` in the AQI metric cell and hides status, advice, and info button.
- Tomorrow summary remains a text summary with UV value and level when present, `—` when null, no AQI text, and no UV/AQI info button.

**TDD steps:**
- [ ] Add `WeatherCard.test.jsx` with local fixtures for a full weather record, UV-null record, AQI-null record, and tomorrow-UV-null record.
- [ ] Add test `renders enhanced today UV and AQI metrics when values exist`.
  - Assert `紫外線`, `8`, `過量級`, `改清晨/傍晚，縮短曝曬`, and button `查看紫外線等級說明`.
  - Assert `AQI`, `67`, `普通`, `可正常跑，敏感者留意體感`, and button `查看 AQI 等級說明`.
- [ ] Add test `hides today UV level advice and info button when UV is null`.
  - Assert the UV metric cell contains `—`.
  - Assert `查看紫外線等級說明` is absent.
  - Assert the UV advice string is absent.
- [ ] Add test `hides today AQI status advice and info button when AQI is null`.
  - Assert the AQI metric cell contains `—`.
  - Assert `查看 AQI 等級說明` is absent.
  - Assert the AQI advice string is absent.
- [ ] Add test `keeps tomorrow summary to UV only without standards entry points`.
  - Assert tomorrow summary contains `UV 5 中量級`.
  - Assert tomorrow summary does not contain `AQI`.
  - Assert there are only the two today info buttons when both today values exist.
- [ ] Run `WeatherCard.test.jsx` and confirm the new tests fail against current simple metric rendering.
- [ ] Update WeatherCard rendering and CSS for the closed-state enhanced metric cells.
- [ ] Run `WeatherCard.test.jsx` and confirm the Task 2 tests pass.

**Acceptance criteria:**
- Enhanced content appears only for today's UV/AQI with non-null data.
- Current temperature, weather description, and morning/evening temperatures remain visually and DOM-order prominent before the metrics row.
- `i` controls are `button` elements, not `div`, `span`, or icon-only non-buttons.
- Info button touch targets are at least 44px via CSS.
- Closed buttons have stable `aria-controls` IDs and `aria-expanded="false"`.

**Verification commands:**
- `npx vitest run --project=browser src/components/weather/WeatherCard.test.jsx`
- `npm run lint:changed`
- `npm run type-check:changed`

**Commit checkpoint suggestion:**
- Stage: `git add src/components/weather/WeatherCard.jsx src/components/weather/weather.module.css src/components/weather/WeatherCard.test.jsx`
- Commit: `git commit -m "feat: render weather standard metric summaries"`

**Reviewer slice:**
- Inspect the WeatherCard diff, CSS diff, and WeatherCard test output.
- Return `review_rejected` if card grade/status text is derived from helper range matching instead of `today.uv.level` and `today.aqi.status`.
- Return `review_rejected` if tomorrow gains AQI or a standards info button.

## Task 3: Desktop Standards Popover Interaction

**Role:** Engineer, followed by Reviewer.

**Owned files:**
- Modify: `src/components/weather/WeatherCard.jsx`
- Modify: `src/components/weather/weather.module.css`
- Modify: `src/components/weather/WeatherCard.test.jsx`

**Read-only context:**
- `specs/weather-uv-aqi-standards-ui/spec.md`
- `src/components/weather/weather-standards.js`
- `src/components/weather/WeatherCard.jsx`
- `src/components/weather/weather.module.css`
- `src/components/weather/WeatherCard.test.jsx`

**Non-scope:**
- Do not add mobile sheet behavior in this task.
- Do not edit `WeatherPageScreen.jsx`.
- Do not introduce third-party popover libraries.
- Do not add per-level running advice inside the overlay.

**Interaction contract:**
- Only one standards overlay can be open at a time.
- Clicking UV `i` opens a desktop popover near the UV button.
- Clicking AQI `i` closes UV and opens AQI.
- Clicking the same active `i` closes the popover.
- Clicking outside closes the popover.
- Pressing Escape closes the popover.
- Closing returns focus to the triggering `i` button.
- Popover content contains title, official source link, complete standards table, a close button, and one current-row marker `目前`.
- Popover content excludes per-level running advice, medical claims, running score, training intensity, pollutant concentration thresholds, and UV encyclopedia copy.

**TDD steps:**
- [ ] Extend `WeatherCard.test.jsx` with test `opens a UV desktop popover with official rows source link and current marker`.
  - Render with `isMobileStandardsSheetMode={false}`.
  - Click `查看紫外線等級說明`.
  - Assert a region or dialog named `紫外線等級` is visible.
  - Assert all five UV ranges are visible.
  - Assert CWA URL is present in a link.
  - Assert the `8-10` row contains `目前`.
- [ ] Add test `switches from UV to AQI desktop popover and keeps only one overlay open`.
  - Open UV.
  - Click `查看 AQI 等級說明`.
  - Assert UV overlay is absent.
  - Assert AQI overlay is visible.
  - Assert all seven AQI ranges are visible.
- [ ] Add test `highlights only the matching split AQI hazard row`.
  - Render AQI value `450` and status `危害`.
  - Open AQI.
  - Assert both `301-400 危害` and `401-500 危害` rows exist.
  - Assert only the `401-500` row contains `目前`.
- [ ] Add test `closes the desktop popover with same button outside click Escape and close button`.
  - Verify each closing path with a fresh render.
  - Assert `aria-expanded` returns to `false`.
- [ ] Add test `returns focus to the triggering info button after desktop popover close`.
- [ ] Run `WeatherCard.test.jsx` and confirm the interaction tests fail before implementation.
- [ ] Implement WeatherCard active metric state, trigger refs, outside pointer/mouse handler, Escape handler, close button, focus return, and standards table rendering.
- [ ] Run `WeatherCard.test.jsx` and confirm all WeatherCard tests pass.

**Acceptance criteria:**
- Desktop popover is anchored within the corresponding metric item and does not cover the current temperature block.
- `aria-expanded` reflects open state.
- `aria-controls` points to the currently rendered overlay content container.
- Close button accessible names are exactly `關閉紫外線等級說明` and `關閉 AQI 等級說明`.
- Current row high亮 uses visual styling plus text `目前`; color alone is not the only signal.

**Verification commands:**
- `npx vitest run --project=browser src/components/weather/WeatherCard.test.jsx`
- `npm run lint:changed`
- `npm run type-check:changed`

**Commit checkpoint suggestion:**
- Stage: `git add src/components/weather/WeatherCard.jsx src/components/weather/weather.module.css src/components/weather/WeatherCard.test.jsx`
- Commit: `git commit -m "feat: add weather standards popovers"`

**Reviewer slice:**
- Inspect WeatherCard state handling and tests for all close paths.
- Return `review_rejected` if outside click closes immediately on the same opening click, if focus does not return to the trigger, or if overlay content includes per-level advice.

## Task 4: Mobile Standards Sheet And WeatherPageScreen Coordination

**Role:** Engineer, followed by Reviewer.

**Owned files:**
- Modify: `src/components/weather/WeatherCard.jsx`
- Modify: `src/components/weather/weather.module.css`
- Modify: `src/ui/weather/WeatherPageScreen.jsx`
- Modify: `src/components/weather/WeatherCard.test.jsx`
- Create: `src/ui/weather/WeatherPageScreen.test.jsx`

**Read-only context:**
- `specs/weather-uv-aqi-standards-ui/spec.md`
- `src/ui/weather/WeatherPageScreen.jsx`
- `src/components/weather/WeatherCard.jsx`
- `src/components/weather/weather.module.css`
- `src/components/weather/weather-standards.js`
- `vitest.setup.jsx`

**Non-scope:**
- Do not change runtime hook behavior.
- Do not change map selection, favorite behavior, weather loading/error rendering, or collapsed weather sheet state semantics.
- Do not add a UI dependency or package change.
- Do not use browser width sniffing in service/runtime layers.

**Mobile contract:**
- WeatherPageScreen continues to compute `isMobileWeatherSheetMode` from the existing breakpoint.
- WeatherPageScreen passes `isMobileStandardsSheetMode={isMobileWeatherSheetMode}` into WeatherCard, or otherwise provides equivalent mode selection at the weather UI boundary.
- The chosen weather UI boundary renders a bottom sheet when mobile standards mode is true and a desktop popover when false.
- Mobile sheet must be rendered in a layer that is not trapped by the transformed `.weatherSheet` container and does not stack with the existing weather information sheet. `createPortal(document.body, ...)` is acceptable if guarded for SSR/tests, but a parent-owned sibling layer or shared sheet container is also acceptable.
- Mobile sheet uses `role="dialog"`, `aria-modal="true"`, a clear title `紫外線等級` or `AQI 等級`, and the same standards content as desktop.
- While mobile standards sheet is open, the existing weather sheet is not simultaneously active or exposed. This can be implemented with `aria-hidden="true"` plus a suppression class, by replacing the active sheet content, or by another equivalent pattern that passes the tests.
- Closing the standards sheet restores the existing weather sheet's previous collapsed or expanded state for any state from which the standards sheet can be opened; it must not force-expand or force-collapse the sheet.
- Escape closes the mobile sheet and returns focus to the triggering info button.
- Clicking the scrim closes the mobile sheet.
- Clicking inside the sheet content does not close it.

**TDD steps:**
- [ ] Extend `WeatherCard.test.jsx` with test `renders standards content as a modal bottom sheet in mobile mode`.
  - Render WeatherCard with `isMobileStandardsSheetMode={true}`.
  - Click `查看紫外線等級說明`.
  - Assert `role="dialog"` named `紫外線等級`.
  - Assert `aria-modal="true"`.
  - Assert CWA source link and current marker.
- [ ] Extend `WeatherCard.test.jsx` with test `closes mobile standards sheet with scrim Escape and close button`.
- [ ] Create `WeatherPageScreen.test.jsx` with local runtime factory and mocks for heavy map/image boundaries.
- [ ] Add test `passes mobile mode into WeatherCard and suppresses the existing weather sheet while standards sheet is open`.
  - Set `window.innerWidth = 390`.
  - Render success weather state with today UV and AQI data.
  - Click `查看 AQI 等級說明`.
  - Assert standards dialog named `AQI 等級` is visible.
  - Assert `data-testid="weather-sheet-content"` remains mounted.
  - Assert the weather information section is not active or exposed while dialog is open, using the implementation's chosen signal such as `aria-hidden="true"`, a suppression class, or replacement of the active sheet content.
  - Close the AQI dialog.
  - Assert the weather information section is restored and the weather sheet remains expanded because it was expanded before opening the standards sheet.
- [ ] Add test `collapsed mobile weather sheet does not require opening standards from hidden content`.
  - Collapse the weather sheet with the existing handle.
  - Assert `data-testid="weather-sheet-content"` is hidden.
  - Assert visible-role queries do not expose `查看紫外線等級說明` or `查看 AQI 等級說明` while the content is hidden; do not fire events against nodes found only with `{ hidden: true }`.
  - Assert no standards dialog is present while the sheet remains collapsed.
  - Expand the weather sheet, open UV standards sheet from the now-visible trigger, close it, and assert `weather-sheet-content` is visible afterward.
  - If the implementation intentionally adds a separate visible standards trigger while the weather sheet is collapsed, replace this with a test that opens from that visible trigger and asserts the sheet returns to the collapsed hidden state after close.
- [ ] Run the mobile tests and confirm they fail before implementation.
- [ ] Implement the mobile sheet layer, parent open-state callback, weather sheet suppression/replacement behavior, and WeatherPageScreen test mocks.
- [ ] Run WeatherCard and WeatherPageScreen tests and confirm all pass.

**Acceptance criteria:**
- Mobile opens bottom sheet, not desktop popover.
- Mobile standards sheet does not visually or semantically stack with the existing weather information sheet.
- Existing weather sheet expanded/collapsed state is restored unchanged after standards sheet close for reachable opening paths. Do not require opening standards from UV/AQI buttons inside hidden collapsed content.
- Focus returns to the original UV/AQI trigger after close.
- Screen reader modal semantics do not leave the weather information sheet as the active overlay while standards sheet is open.

**Verification commands:**
- `npx vitest run --project=browser src/components/weather/WeatherCard.test.jsx`
- `npx vitest run --project=browser src/ui/weather/WeatherPageScreen.test.jsx`
- `npm run lint:changed`
- `npm run type-check:changed`

**Commit checkpoint suggestion:**
- Stage: `git add src/components/weather/WeatherCard.jsx src/components/weather/weather.module.css src/ui/weather/WeatherPageScreen.jsx src/components/weather/WeatherCard.test.jsx src/ui/weather/WeatherPageScreen.test.jsx`
- Commit: `git commit -m "feat: add mobile weather standards sheet"`

**Reviewer slice:**
- Inspect WeatherCard/WeatherPageScreen mobile sheet layering, suppression or replacement state, CSS z-index, and test evidence.
- Return `review_rejected` if the mobile sheet is trapped by transformed `.weatherSheet`, if weather sheet state changes after closing standards sheet on reachable opening paths, if tests require clicking hidden collapsed content, or if `aria-modal`/focus return is missing.

## Final Integration Gate

**Role:** Verifier after all Engineer/Reviewer slices pass.

**Owned files:** none. This gate reads the final diff and runs commands only.

**Read-only context:**
- `specs/weather-uv-aqi-standards-ui/spec.md`
- Final diff for the files listed in this plan
- Engineer and Reviewer evidence for Tasks 1-4

**Non-scope:**
- Do not edit files during this gate.
- Do not commit, push, create PR, watch CI, merge, or sync local `main` unless the main agent explicitly dispatches a Release Manager with that boundary.

**Verification commands:**
- `npx vitest run --project=browser src/components/weather/weather-standards.test.js`
- `npx vitest run --project=browser src/components/weather/WeatherCard.test.jsx`
- `npx vitest run --project=browser src/ui/weather/WeatherPageScreen.test.jsx`
- `npm run lint:changed`
- `npm run type-check:changed`
- `npm run depcruise`
- `git diff --check`
- `git status --short --branch`

**Acceptance criteria:**
- Every command exits 0.
- Final diff touches only files named in this plan.
- No dependency, type, API, service, repo, schema, rules, or lockfile changes exist.
- No legacy `docs/superpowers/plans/` or `docs/superpowers/specs/` files are created.

## Stop Conditions

- Stop and report if `spec.md` contradicts existing weather types or requires API/source changes.
- Stop and report if the official standards in the approved spec are changed by a newer source before implementation begins; do not silently update rows.
- Stop and report if mobile sheet focus management cannot be made reliable without changing shared overlay architecture outside owned files.
- Stop and report if tests require adding a new dependency.
- Stop and report if source files outside the planned write set need edits.
- Stop and report if any unowned user changes appear in planned write files.

## Plan Self-Review

### Spec Coverage

- Acceptance 1-2: Task 2 renders today UV/AQI values, `uv.level`/`aqi.status`, advice, and `i` buttons.
- Acceptance 3-4: Task 2 covers UV/AQI `null` states with `—` and hidden grade/advice/button.
- Acceptance 5-6: Task 2 preserves tomorrow UV value plus level and excludes tomorrow AQI and `i`.
- Acceptance 7-8: Task 3 covers desktop UV/AQI popovers with full rows and current high亮.
- Acceptance 9-10: Task 4 covers mobile bottom sheet mode and existing weather sheet suppression/restoration.
- Acceptance 11: Task 3 overlay contract excludes per-level advice, medical judgment, suitability scores, and training intensity.
- Acceptance 12: Tasks 2-4 cover real buttons, accessible names, `aria-expanded`, `aria-controls`, Escape close, and focus return.
- Acceptance 13: Tasks 1 and 3 require `目前` marker in addition to styling.
- Acceptance 14: Tasks 1 and 3 require both AQI `危害` rows and range-specific high亮.
- Acceptance 15: Tasks 1 and 3 require official CWA and MOENV source links only.
- Implementation constraints: File structure and non-scope sections forbid API, type, dependency, service, repo, and legacy path changes.

### Placeholder Scan

- The plan uses exact file paths, exact helper names, exact tests, exact source URLs, exact command lines, exact advice copy, explicit non-scope, and explicit stop conditions.
- No open-ended placeholder language is left for later agents.

### Type Consistency

- No change to `src/types/weather-types.js` is planned.
- WeatherCard consumes existing `TodayWeather.uv: UvInfo | null`, `TodayWeather.aqi: AqiInfo | null`, and `TomorrowWeather.uv: UvInfo | null`.
- Card display uses `UvInfo.value`, `UvInfo.level`, `AqiInfo.value`, and `AqiInfo.status`.
- Overlay high亮 uses numeric `value` only and never replaces the card's `level` or `status` display.
