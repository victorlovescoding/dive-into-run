# Homepage Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal `/` page with a static, production-quality homepage landing page based on the Open Design artifact `Dive Into Run Website UI / index.html`, while preserving the existing global Navbar and keeping all CTAs inside existing routes.

**Architecture:** Keep `src/app/page.jsx` as a thin App Router entry that delegates to a render-only UI component under `src/ui/home/`. The homepage owns its static presentation content, semantic sections, CTA links, and page-specific footer; it must not introduce runtime hooks, Firebase/service/repo access, live data fetching, global Navbar changes, or new dependencies. Styling should live in a component-scoped CSS module so the warm morning-run visual system does not leak into unrelated app routes.

**Tech Stack:** Next.js 15 App Router, React 19, JavaScript with JSDoc `checkJs`, CSS Modules, existing Tailwind/global font setup, Vitest browser/jsdom integration tests, Playwright smoke gates.

---

## Source Inputs

- Approved spec: `specs/homepage-landing/spec.md`.
- Open Design artifact pulled from Open Design MCP: project `dive-into-run-website-ui`, entry `index.html`, resolved project `Dive Into Run Website UI`, not truncated.
- Open Design visual structure to preserve: warm morning-run landing page; hero left copy and right running scene; floating weather, event, and map cards; three available run group cards; trust/system items; runner profile context; CTA panel; page-specific footer.
- Open Design element to exclude: the artifact `topnav`; the app already mounts the global Navbar from `src/app/layout.jsx`.

## Route And CTA Decision

Route verification performed during planning:

- `src/app/events/page.jsx` exists and renders the existing events entry route.
- `rg --files src/app/events` returned `src/app/events/page.jsx` and `src/app/events/[id]/page.jsx`; it did not show an `src/app/events/create/page.jsx` route.
- `rg --files src/app` showed existing top-level app routes including `/`, `/events`, `/runs`, `/weather`, `/member`, and `/posts`.

Decision:

- All event discovery CTAs use `href="/events"`.
- All event creation CTAs also use `href="/events"` because there is no verified dedicated create route; this matches the spec instruction to use the existing events entry point.
- Do not use `#runs` for CTAs in this slice. Section ids are allowed for semantics and testing, but user-facing CTA links must route to `/events`.

Exact CTA labels and hrefs:

| Location | Link text | href |
| --- | --- | --- |
| Hero primary | `查看揪團活動` | `/events` |
| Hero secondary | `新增跑步揪團` | `/events` |
| Run groups strip | `看全部活動` | `/events` |
| Join card links, if cards include explicit links | `查看揪團活動` or card-specific accessible names ending in `查看揪團活動` | `/events` |
| CTA panel primary | `新增跑步揪團` | `/events` |
| CTA panel secondary | `查看揪團活動` | `/events` |

## Files And Responsibilities

| Path | Action | Responsibility |
| --- | --- | --- |
| `tests/integration/app/home-page-entry.test.jsx` | Create in T001 | RED integration coverage for the homepage app entry. Assert the main heading, core copy, CTA hrefs, named sections, three run cards, trust/system content, runner profile context, CTA panel, page-specific footer, and no homepage `navigation` landmark. |
| `src/app/page.jsx` | Modify in T002 | Thin `/` entry only. Import `HomePage` from `@/ui/home/HomePage` and return it. Keep JSDoc. Do not add layout, providers, global nav, runtime hooks, or data fetching. |
| `src/ui/home/HomePage.jsx` | Create in T002 | Render-only homepage screen. Own static arrays for join cards and trust items, semantic landmarks/sections, accessible CTA links, decorative scene markup with `aria-hidden`, and text alternatives for weather/event/map/profile information. No `'use client'` directive unless implementation proves a browser-only API is unavoidable; the planned implementation needs none. |
| `src/ui/home/HomePage.module.css` | Create in T002 | Component-scoped warm morning-run styling, OKLCH-compatible color tokens, hero scene, responsive layout, focus-visible styles, and reduced-motion handling. No global selectors outside the CSS module root. No global body/html changes. |
| `src/app/layout.jsx` | Read-only | Existing global Navbar and providers. Must not be modified. |
| `src/app/globals.css` | Read-only | Existing global tokens and base styles. Must not be modified for this slice. |
| `tests/e2e/quality-gates/hydration-smoke.spec.js` | Read-only | Existing `/` hydration smoke must remain green. Do not edit unless Reviewer proves the smoke itself is broken by stale expectations and asks for explicit user authorization. |
| `tests/e2e/quality-gates/axe-smoke.spec.js` | Read-only | Existing `/` axe report-only smoke must remain green. Do not edit unless Reviewer proves the smoke itself is broken by stale expectations and asks for explicit user authorization. |
| `specs/homepage-landing/plan.md` | Planner-owned | This plan. Implementation agents must not edit it unless explicitly dispatched for workflow state repair. |
| `specs/homepage-landing/tasks.md` | Planner/Main-owned | Human-readable task contracts and later task-state updates. |
| `specs/homepage-landing/handoff.md` | Planner/Main-owned | Resume state, next action, latest evidence, pitfalls. |
| `specs/homepage-landing/status.json` | Planner/Main-owned | Machine-readable workflow state. |

## Render-Only Content Contract

The UI may adapt exact layout details to the repo style, but it must render these user-visible signals:

- H1 contains `Dive Into Run` and `今天，一起出門跑。`.
- Hero lead includes the idea that runners can find groups by pace, time, location, route, capacity, organizer context, and participant signals.
- Hero proof text mentions public profiles, organizer information, participant lists, and event comments.
- Hero scene text includes `22°C`, `微風`, `大安森林公園`, `06:18`, `8K`, `6:30/km`, `7 人`, `2 號出口`, and route/map context.
- Available run groups section heading: `可以加入的揪團活動`.
- Exactly three visible join cards:
  - `大安森林公園 8K`, `週六 06:30`, `6:30/km`, `2 號出口`, `8K`, `7 人`.
  - `河濱輕鬆跑 5K`, `今天 19:20`, `7:00/km`, `古亭河濱`, `5K`, `5 人`.
  - `松山機場外圈 10K`, `週日 07:00`, `5:50/km`, `民權公園`, `10K`, `9 人`.
- Trust/system section heading communicates that necessary information is visible before joining.
- Trust items include `跑者公開檔案`, `Strava 跑步紀錄`, and `文章與活動留言`.
- Runner profile panel includes `RUNNER PROFILE`, `陳以文`, `台北晨跑`, `18`, `42`, and `328.4 km`.
- CTA panel heading communicates moving the next run from chat into a clear event page.
- Page-specific footer includes `Dive Into Run` and `Taipei running community`.

## Accessibility And Semantics

- Render one `<main>` for homepage content and one page-specific `<footer>`.
- Do not render a `<nav>` element or any element with `role="navigation"` from the homepage component.
- Each major section should be a named region using `aria-labelledby`:
  - Hero: `首頁主視覺`.
  - Run groups: `可以加入的揪團活動`.
  - Trust/system: `加入活動前，先把必要資訊看清楚。`.
  - Runner profile context: `跑者公開檔案情境`.
  - CTA panel: `建立清楚的活動頁`.
- Decorative scene shapes, runner silhouettes, avatar initials used only as decoration, and route art should be `aria-hidden="true"`.
- Meaningful scene information must also appear as normal text, not only as graphic labels.
- CTA links need visible focus states in the CSS module using `:focus-visible`.
- Text contrast must meet WCAG AA. Avoid low-contrast warm-on-cream pairings for paragraph text.
- Honor reduced motion with `@media (prefers-reduced-motion: reduce)` by disabling route drawing, hover translation, and decorative transitions.

## Responsive And Visual QA Strategy

Implementation requirements:

- 1280px: hero is two columns; copy on the left, scene on the right; floating cards may use absolute positioning inside the scene.
- 768px: layout remains stable with no horizontal scrolling; the scene may remain two-column only if there is no overlap, otherwise stack the hero and keep floating cards inside the scene without covering text.
- 375px: hero is single-column; floating cards become non-overlapping stacked or inline content; CTA buttons wrap without text clipping; three join cards stack vertically.
- No viewport may show horizontal scrolling.
- Homepage content must start below the global Navbar when rendered through the app layout.
- The Open Design `topnav` must not appear; the app should show one global Navbar only.
- CSS module should use stable dimensions or responsive constraints for the scene, cards, and CTA buttons so hover/focus states do not shift layout.
- Do not use viewport-width-scaled font sizes. Use CSS `clamp()` with rem/px bounds for headings if needed, and keep letter spacing at `0`.
- Avoid decorative gradient orbs and one-note palettes. Warm morning color is acceptable, but add route blue, grass green, neutral surface, and foreground tokens so the page does not read as a single beige theme.

Browser evidence required for final verifier gate:

| Viewport | Required checks |
| --- | --- |
| 375x812 | No horizontal scrolling; one global Navbar; hero single-column; CTA text fits; floating cards stacked/non-overlapping; join cards stack; focus ring visible on CTA links. |
| 768x1024 | No horizontal scrolling; no hero/scene overlap; section headings and cards fit; focus order starts in global Navbar then homepage content. |
| 1280x800 | Hero two-column; floating weather/event/map cards visible and non-overlapping; available run groups show three cards; footer visible after CTA panel. |

## TDD And Testing Strategy

TDD order is mandatory:

1. T001 creates only the failing integration test.
2. T001 runs the focused integration command and records a RED failure caused by missing homepage UI assertions.
3. T001 Reviewer passes only if the test fails for the expected product gap and does not fail from syntax, import, provider, or test-environment errors.
4. T002 implements production UI only after the RED failure is observed and reviewed.
5. T002 runs the same focused integration command and records a GREEN pass.
6. Verifier runs final regression, quality, workflow, and browser evidence gates.

Focused RED/GREEN command:

```bash
npm run test:browser -- --run tests/integration/app/home-page-entry.test.jsx
```

Final local verification commands, one command per evidence item:

```bash
npm run test:browser -- --run tests/integration/app/home-page-entry.test.jsx
```

```bash
npm run lint:changed
```

```bash
npm run type-check:changed
```

```bash
npm run test:e2e:hydration
```

```bash
npm run test:e2e:axe
```

```bash
npm run workflow:validate
```

```bash
npm run workflow:check
```

```bash
npm run workflow:links
```

```bash
git diff --check
```

Dev server for browser evidence:

```bash
npm run dev
```

Use the Browser plugin against `http://localhost:3000/` for screenshots and console/network inspection at 375x812, 768x1024, and 1280x800. If no browser evidence surface is callable, mark visual conformance blocked rather than claiming it.

## Dependency Graph And Waves

- Wave 1: `T001` RED integration test.
- Wave 2: `T002` GREEN homepage implementation. Depends on `T001` reviewed RED evidence.
- Wave 3: `VG001` final verification and visual QA gate. Depends on `T002` Reviewer PASS.

Parallel implementation lanes are not approved. The test, app entry, UI component, and CSS module describe one user-facing slice with tight behavioral coupling, so one Engineer/Reviewer lane is safer than disjoint writes.

## Final Integration Gate

Before any completion claim, the Main/Dispatcher must confirm:

- `tasks.md`, `status.json`, and `handoff.md` agree on active/completed task state.
- T001 has Reviewer PASS for RED test validity.
- T002 has Reviewer PASS for implementation diff.
- VG001 has fresh command evidence for all final verification commands listed above.
- Browser evidence exists for 375x812, 768x1024, and 1280x800, including screenshots or snapshots, console state, failed network requests, and expected/actual notes.
- No product code outside `src/app/page.jsx`, `src/ui/home/HomePage.jsx`, and `src/ui/home/HomePage.module.css` changed.
- No tests outside `tests/integration/app/home-page-entry.test.jsx` changed.
- `src/app/layout.jsx`, `src/app/globals.css`, global Navbar code, `package.json`, and `package-lock.json` are unchanged.
- No commit, push, PR, CI watch, merge, local `main` sync, deployment, or Firestore/storage rules deployment occurred.

## Risk And Stop Conditions

Stop and return control to Main/User if any of these happen:

- The Engineer needs to modify `src/app/layout.jsx`, Navbar code, `src/app/globals.css`, `package.json`, `package-lock.json`, `tests/e2e/**`, or any file outside the task-owned write set.
- A task attempts to add a second nav/header/topnav, sticky homepage chrome, or fixed hero chrome that competes with the global Navbar.
- CTA destination becomes ambiguous or an Engineer discovers a more specific creation route that was not verified in this plan.
- The implementation needs live Firestore, Strava, weather, map, auth, runtime hooks, service/repo calls, or a new dependency.
- The focused RED test fails because of test environment, import resolution, provider setup, invalid assertions, or syntax rather than missing homepage behavior.
- The final browser evidence shows horizontal scrolling, overlapping content, duplicate navigation, invisible focus, or contrast problems that cannot be fixed inside the owned files.
- Any verification failure remains unexplained after the first fix attempt; dispatch Debugger with `superpowers:systematic-debugging`.
- Any command requires network or sandbox access beyond local project execution and cannot run under the current authorization.
- Commit, push, PR creation, CI watch, merge, local `main` sync, or rules deployment is requested by an agent without explicit user authorization.
