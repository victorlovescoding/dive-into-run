# Event List Card Redesign Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/event-list-card-redesign/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `specs/event-list-card-redesign/handoff.md`, this file, and `specs/event-list-card-redesign/status.json` before dispatching work.
- Main agent is control plane only. Product, test, docs, workflow, script, config, commit, push, PR, merge, and local sync work must be delegated to the matching subagent role.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block before dispatch, commit, push, PR, merge, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator state sync.
- Command evidence uses one command per row. Do not combine commands with shell chain operators.
- New `status.json` state uses schemaVersion 3 and records `currentHead`, `remoteHead`, `lastVerifiedCommit`, `phaseCommits`, `rulesDeployStatus`, and `incidents`.
- Final summaries must not imply deployed Firestore/storage rules or deployed product behavior.

## Team And Parallelism

- Profile: P4.
- Default execution: one Engineer + one Reviewer at a time.
- Same-wave parallel work is not approved for this plan because JSX and CSS share class-name contracts.
- Debugger is required on unexpected verification failure before any fix attempt.
- Verifier is required before any completion or commit claim.
- Release Manager may commit only after Reviewer PASS, Verifier PASS, no workflow state drift, and explicit boundary coverage.

## Planner Output

- Dependency graph:
  - `T001 -> T002 -> T003 -> T004`
- Parallel waves:
  - `wave-1`: `T001`
  - `wave-2`: `T002`
  - `wave-3`: `T003`
  - `wave-4`: `T004`
- Final integration gate after T003:
  - `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser`: exit 0.
  - `npx vitest run src/runtime/hooks/useEventParticipation.test.jsx --project browser`: exit 0.
  - `npm run lint:changed`: exit 0.
  - `npm run type-check:changed`: exit 0.
  - `git diff --check -- src/ui/events/EventsListSection.jsx src/ui/events/EventsPageScreen.module.css src/ui/events/EventsListSection.test.jsx`: exit 0.
  - Browser evidence for `/events` at `1440x900` and `390x844`: screenshots recorded, no new console errors, no failed app requests, no card/control overlap.
- Workflow checker gate after T004:
  - `npx vitest run scripts/check-superpowers-state.test.js --project browser`: exit 0.
  - `npm run workflow:validate`: exit 0.
  - `npm run workflow:check`: exit 0 after the checker fix.
  - `git diff --check -- scripts/check-superpowers-state.js scripts/check-superpowers-state.test.js specs/event-list-card-redesign/tasks.md specs/event-list-card-redesign/status.json specs/event-list-card-redesign/handoff.md`: exit 0.

## Tasks

### T001 - Add Focused List Card Tests

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: T001 Engineer subagent (`DONE_WITH_CONCERNS`)
- **Reviewer**: T001 Spec Compliance Reviewer and T001 Code Quality Reviewer subagents
- **Commit checkpoint**: no Engineer commit; Release Manager may commit reviewed implementation later because `authorizationBoundary.commit=true`
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Create a focused Testing Library test file for `EventsListSection`.
- Cover current field rendering, formatter output, list state text, card background navigation, and nested control propagation.
- The initial focused test run should fail only because the current component lacks the new card background navigation behavior or the new rendered structure.

Non-scope:

- Do not modify production files.
- Do not modify shared components, runtime hooks, package files, configs, or existing tests.
- Do not weaken or skip existing participation runtime coverage.

Owned files:

- `src/ui/events/EventsListSection.test.jsx`

Read-only context:

- `src/ui/events/EventsListSection.jsx`
- `src/ui/events/event-formatters.js`
- `src/components/BookmarkButton.jsx`
- `src/components/EventActionButtons.jsx`
- `src/components/EventCardMenu.jsx`
- `src/components/UserLink.jsx`
- `src/runtime/hooks/useEventParticipation.test.jsx`
- `vitest.config.mjs`
- `vitest.setup.jsx`

Dependencies:

- none

Browser evidence:

- not applicable for this test-only task

Engineer instructions:

- Create `src/ui/events/EventsListSection.test.jsx`.
- Use `@testing-library/react`, `@testing-library/user-event`, and Vitest.
- Mock `next/link` as an `<a>`, mock `next/navigation` with a hoisted `routerPushMock`, and mock `next/image` as an `<img>` or rely on the existing UserLink mock pattern.
- Use a stable future event date such as `2999-06-01T06:00:00.000Z` so participation deadline behavior does not become time-dependent.
- Build a `createProps(overrides = {})` helper that provides every required `EventsListSection` prop with `vi.fn()` handlers and `createRef()` for `sentinelRef`.
- Include these test cases:
  - renders the title link, host link, time, deadline, location, meet place, distance, formatted pace, max participants, remaining seats, route label, bookmark button, owner menu trigger, and participation button.
  - preserves all list state text for loading, filtering, creating, empty, load error, load-more error with retry, load-more loading, and end hint.
  - clicking `data-testid="event-card-event-1"` calls `routerPushMock('/events/event-1')`.
  - clicking bookmark calls `onToggleFavoriteEvent('event-1')` and does not call `routerPushMock`.
  - clicking menu trigger, edit menu item, and delete menu item calls only the relevant menu handlers and does not call `routerPushMock`.
  - clicking join or leave calls the relevant participation handler and does not call `routerPushMock`.
  - clicking a disabled-looking full, deadline, or checking participation state does not call `routerPushMock`.
- Keep assertions on visible text and roles rather than CSS module hashes.

Representative test setup:

```jsx
/* eslint-disable jsdoc/require-jsdoc -- Focused UI behavior tests use local doubles. */
import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import EventsListSection from './EventsListSection';

const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock('next/link', () => ({
  default: function MockLink({ href, children, ...props }) {
    return <a href={href} {...props}>{children}</a>;
  },
}));

vi.mock('next/image', () => ({
  default: function MockImage({ alt, src, width, height, className, style }) {
    return (
      <img
        alt={alt}
        className={className}
        data-height={height}
        data-src={src}
        data-width={width}
        src={src}
        style={style}
      />
    );
  },
}));
```

Acceptance criteria:

- AC-T001.1: The new test file compiles and targets `EventsListSection`.
- AC-T001.2: The tests assert the approved card click exception and every nested-control exception.
- AC-T001.3: The tests assert all existing list state texts remain rendered.
- AC-T001.4: The focused test run fails against the pre-implementation component for the intended missing behavior or structure, not because of syntax, import, alias, or mock errors.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser` | Exit 1 with the new card background navigation assertion failing against the old component, while imports and mocks load successfully. |
| `git diff --check -- src/ui/events/EventsListSection.test.jsx` | Exit 0 with no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only `src/ui/events/EventsListSection.test.jsx`.
- Focused test failure is the intended product gap and not test infrastructure breakage.
- Tests cover background click navigation, nested controls, field rendering, formatter output, and list states.
- No production behavior changes are present.

Reviewer REJECT criteria:

- Diff touches non-owned files.
- Tests miss bookmark, menu, participation, disabled-looking participation, or list state coverage.
- Focused test run fails because of syntax, import, alias, or mocking defects.
- Tests assert new product behavior outside the approved spec.

Evidence:

- Engineer report: `DONE_WITH_CONCERNS`; created `src/ui/events/EventsListSection.test.jsx` for focused list card coverage. Concerns: Engineer initially created the file in the parent repo, then copied it into this worktree and deleted the mistaken parent-repo file; no tracked residue reported. `node_modules` was installed in this worktree; `package.json` and `package-lock.json` stayed clean.
- Reviewer report: `review_passed`; T001 Spec Compliance Reviewer and T001 Code Quality Reviewer both passed. Spec Compliance confirmed the diff boundary, untracked T001 test file, expected red focused test, and whitespace check. Code Quality reviewed `src/ui/events/EventsListSection.test.jsx` lines 1-324, confirmed the expected red test signal, whitespace check, dirty state shape, and no staged changes.
- Residual risk: T001 intentionally leaves one red focused test for T002.
- Command output summary:
  - `npm install`: exit 0; local dependencies installed, package files stayed clean.
  - `git status --short --branch`: exit 0; dirty workflow state plus untracked `src/ui/events/EventsListSection.test.jsx`.
  - `git diff --name-status`: exit 0; tracked changes were workflow files only.
  - `git ls-files --others --exclude-standard src/ui/events/EventsListSection.test.jsx`: exit 0; confirmed the untracked T001 test file.
  - `nl -ba src/ui/events/EventsListSection.test.jsx`: exit 0; Code Quality Reviewer inspected lines 1-324.
  - `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser`: exit 1; expected red result, 7 tests, 1 failed and 6 passed, failing only on missing `data-testid="event-card-event-1"` / background navigation at line 216.
  - `git diff --check -- src/ui/events/EventsListSection.test.jsx`: exit 0; no whitespace errors.
  - `git diff --cached --name-status`: exit 0; no staged changes.
- Changed files summary:
  - `src/ui/events/EventsListSection.test.jsx` added.
  - No product files, package files, configs, or existing tests reported changed for T001.
  - Tracked dirty files were workflow state files only.

### T002 - Implement Card Markup And Background Navigation

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: T002 Engineer subagent; narrow test lint fix subagent for T001 test lint unblocker
- **Reviewer**: T002 Spec Compliance Reviewer and T002 Code Quality Reviewer subagents
- **Commit checkpoint**: no Engineer commit; Release Manager may commit reviewed implementation later because `authorizationBoundary.commit=true`
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Modify `EventsListSection.jsx` to render the approved card architecture.
- Add the card background click guard and router navigation to `/events/{id}`.
- Preserve all existing props, handlers, list state text, formatter usage, and child components.

Non-scope:

- Do not modify CSS in this task.
- Do not modify tests beyond the T001 file.
- Do not modify `BookmarkButton`, `EventActionButtons`, `EventCardMenu`, `UserLink`, runtime hooks, services, event formatters, route definitions, or package files.
- Do not change toasts, side effects, modal triggers, owner menu contents, bookmark aria labels, route formatting, date formatting, pace formatting, remaining-seat logic, or participation behavior.

Owned files:

- `src/ui/events/EventsListSection.jsx`

Read-only context:

- `src/ui/events/EventsListSection.test.jsx`
- `src/ui/events/event-formatters.js`
- `src/components/BookmarkButton.jsx`
- `src/components/EventActionButtons.jsx`
- `src/components/EventCardMenu.jsx`
- `src/components/UserLink.jsx`
- `src/runtime/hooks/useEventParticipation.js`
- `src/runtime/hooks/useEventsPageRuntime.js`

Dependencies:

- `T001`

Browser evidence:

- not applicable for this JSX behavior task; T003 owns browser evidence after CSS is applied

Engineer instructions:

- Add `'use client';` at the top of `EventsListSection.jsx`.
- Import `useRouter` from `next/navigation`.
- Add `CARD_NAVIGATION_SELECTOR`, `isInteractiveCardTarget(target)`, and a local `handleCardClick(eventId, clickEvent)` that exits for interactive descendants and otherwise calls `router.push(`/events/${eventId}`)`.
- Replace the current three stacked `.eventMeta` blocks with the approved structure from `plan.md`: top meta row, title/action cluster, six-field fact grid, and footer host/route/participation row.
- Keep `Link href={`/events/${event.id}`}` for the title and `UserLink` for the host.
- Move route status into a small footer pill next to host.
- Keep `BookmarkButton` props exactly equivalent to the current labels and active state.
- Keep `EventCardMenu` props exactly equivalent to the current owner menu wiring.
- Keep `EventActionButtons` props exactly equivalent to the current participation wiring.
- Keep `loadError`, `emptyHint`, `loadMoreError`, retry button, `loadMore`, `hasMore`, and sentinel behavior equivalent to the current component.
- Add `data-testid={`event-card-${eventId}`}` to the card container to make the approved card background click contract testable without visible UI text.

Acceptance criteria:

- AC-T002.1: The focused `EventsListSection` tests pass.
- AC-T002.2: Clicking card background calls `router.push('/events/{id}')`.
- AC-T002.3: Title link and host link remain semantic links with the same hrefs.
- AC-T002.4: Bookmark, menu trigger, edit, delete, join, leave, full, deadline, checking, retry, and filter controls do not trigger card background navigation.
- AC-T002.5: The card still renders exactly the approved field set and formatter outputs.
- AC-T002.6: Owner-only menu contents remain exactly edit and delete.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser` | Exit 0 with all focused list card tests passing. |
| `npx vitest run src/runtime/hooks/useEventParticipation.test.jsx --project browser` | Exit 0 with existing participation runtime tests passing. |
| `npm run lint:changed` | Exit 0 with no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0 with no changed-file type-check errors. |
| `git diff --check -- src/ui/events/EventsListSection.jsx src/ui/events/EventsListSection.test.jsx` | Exit 0 with no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only `src/ui/events/EventsListSection.jsx` and already-reviewed T001 test file remains unchanged unless the Reviewer accepts a narrow assertion correction.
- All acceptance criteria are demonstrated by focused tests or direct diff evidence.
- No shared component, runtime hook, service, route, formatter, package, or CSS file changes are present.
- Click guard is target-based and protects nested interactive descendants.

Reviewer REJECT criteria:

- Card is implemented as a nested link around buttons or links.
- Nested controls can trigger card background navigation.
- Existing handlers, labels, fields, formatters, list state text, or child component props change without spec approval.
- Diff expands beyond owned files.
- Verification is missing, stale, or failing.

Evidence:

- Engineer report: `engineer_done`; T002 Engineer changed `src/ui/events/EventsListSection.jsx` for the approved card markup and background navigation behavior. Core T002 tests passed, then `npm run lint:changed` was blocked by a T001 test lint issue. A narrow test lint fix subagent updated `src/ui/events/EventsListSection.test.jsx`; fresh T002 verification now passes.
- Reviewer report: `review_passed`; T002 Spec Compliance Reviewer passed with no findings after validating `EventsListSection` test exit 0 (7 passed), `useEventParticipation` test exit 0 (8 passed), `npm run lint:changed` exit 0 with the React-version warning only, `npm run type-check:changed` exit 0, and `git diff --check` exit 0. T002 Code Quality Reviewer passed with no findings after validating `EventsListSection` test exit 0, `npm run lint:changed` exit 0 warning only, and `npm run type-check:changed` exit 0.
- Residual risk: browser visual evidence is deferred to T003; no manual browser/screen-reader verification beyond the browser-project test.
- Command output summary:
  - `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser`: exit 0; 1 test file passed, 7 tests passed.
  - `npx vitest run src/runtime/hooks/useEventParticipation.test.jsx --project browser`: exit 0; 1 test file passed, 8 tests passed.
  - `npm run lint:changed`: exit 0; changed-file lint completed with the existing React version settings warning only.
  - `npm run type-check:changed`: exit 0; no type errors in changed files.
  - `git diff --check -- src/ui/events/EventsListSection.jsx src/ui/events/EventsListSection.test.jsx`: exit 0; no whitespace errors.
  - `git status --short --branch`: exit 0; branch `081-event-list-card-redesign` ahead 2, with modified workflow state files, modified `src/ui/events/EventsListSection.jsx`, and untracked `src/ui/events/EventsListSection.test.jsx`.
- Changed files summary:
  - `src/ui/events/EventsListSection.jsx` modified by T002 Engineer for card markup and background navigation.
  - `src/ui/events/EventsListSection.test.jsx` updated by the narrow test lint fix subagent and remains untracked in this worktree.
  - Workflow state files updated by coordinator after fresh verification: `specs/event-list-card-redesign/tasks.md`, `specs/event-list-card-redesign/status.json`, and `specs/event-list-card-redesign/handoff.md`.

### T003 - Implement Card Visual System And Browser Evidence

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: T003 Engineer subagent (`DONE_WITH_CONCERNS`)
- **Reviewer**: T003 Spec Compliance Reviewer and T003 Code Quality Reviewer subagents
- **Commit checkpoint**: reviewed implementation batch commit after T003 plus Verifier PASS, if Release Manager is dispatched
- **Last verified commit**: none
- **Authorization boundary**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable
- **Incidents**: none

Scope:

- Modify `EventsPageScreen.module.css` to implement the approved list card and list state visual design.
- Add responsive layout rules for the fact grid, title/action cluster, and bottom host/route/participation row.
- Use only list-local selectors for participation button adjustments.
- Capture browser evidence for `/events` desktop and mobile.

Non-scope:

- Do not modify JSX except through a coordinator-approved plan update.
- Do not modify `EventActionButtons.module.css`, `BookmarkButton.module.css`, `EventCardMenu.module.css`, `UserLink.module.css`, event detail CSS, edit/create form CSS, runtime hooks, services, package files, or tests.
- Do not change visible list text or product behavior.

Owned files:

- `src/ui/events/EventsPageScreen.module.css`

Read-only context:

- `src/ui/events/EventsListSection.jsx`
- `src/ui/events/EventsListSection.test.jsx`
- `src/components/BookmarkButton.module.css`
- `src/components/EventActionButtons.module.css`
- `src/components/EventCardMenu.module.css`
- `src/components/UserLink.module.css`
- `.codex/rules/sensors.md`

Dependencies:

- `T002`

Browser evidence:

- Required.
- Start dev server with `npm run dev`.
- Target URL: `http://localhost:3000/events`.
- Desktop viewport: `1440x900`.
- Mobile viewport: `390x844`.
- Screenshot artifacts: record absolute paths in the Engineer report.
- Expected visual signals: warm white event cards, deep green title/accent, muted green-gray supporting text, 8px radius, fine border, low shadow, no negative letter spacing, top time/deadline row, title/action cluster without overlap, desktop 3-column fact grid, mobile 1-2 fact columns depending width, route pill next to host, participation area wrapping cleanly, loading/filtering/creating/empty/error/load-more/end hint state cards matching the same language.
- Expected diagnostics: no new console errors and no failed app network requests.
- Stop the dev server after evidence is captured.

Engineer instructions:

- Replace the existing list card styles around `.statusRow`, `.spinner`, `.errorCard`, `.eventList`, `.eventCardWrapper`, `.eventCard`, `.eventTitleLink`, `.eventTitle`, `.eventMeta`, `.emptyHint`, `.loadMoreArea`, `.retryButton`, `.endHint`, and `.eventCardTopActions` with the new list-local visual system.
- Preserve or remove `.eventCardWrapper` only if the JSX no longer references it; do not leave unused list-only selectors when the new structure removes them.
- Use responsive grid rules that produce three fact columns on desktop and one or two columns on smaller widths without overlap.
- Use `font-variant-numeric: tabular-nums;` or a monospace font stack only on numeric values and time/deadline values.
- Set `letter-spacing: 0` when a selector needs explicit letter spacing; do not add negative values.
- Keep `BookmarkButton` visible style unchanged by avoiding generic `.eventCardTopActions button` overrides that would restyle it.
- Scope participation button layout under `.eventParticipationSlot` so shared detail/edit surfaces do not change.
- Keep state cards visually aligned with the event card language while preserving their roles and text from JSX.

Acceptance criteria:

- AC-T003.1: Event cards visually match the warm white/deep green/muted green-gray direction with 8px radius, fine border, low shadow, and mono numeric facts.
- AC-T003.2: State cards for loading, filtering, creating, empty, error, load-more, and end hint match the new list card language.
- AC-T003.3: Desktop viewport shows a single-column event list and 3-column fact grid.
- AC-T003.4: Mobile viewport shows 1-2 fact columns depending width, with no overlap in the action cluster or footer.
- AC-T003.5: Route pill is visually beside host, not in the fact grid.
- AC-T003.6: Bookmark icon/style is not restyled into a heart or global variant.
- AC-T003.7: No negative letter spacing exists in the changed CSS.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser` | Exit 0 with all focused list card tests passing. |
| `npx vitest run src/runtime/hooks/useEventParticipation.test.jsx --project browser` | Exit 0 with existing participation runtime tests passing. |
| `npm run lint:changed` | Exit 0 with no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0 with no changed-file type-check errors. |
| `rg -n "letter-spacing[[:space:]]*:[[:space:]]*-" src/ui/events/EventsPageScreen.module.css` | Exit 1 with no matches. |
| `git diff --check -- src/ui/events/EventsListSection.jsx src/ui/events/EventsPageScreen.module.css src/ui/events/EventsListSection.test.jsx` | Exit 0 with no whitespace errors. |

Reviewer PASS criteria:

- Diff touches only `src/ui/events/EventsPageScreen.module.css`.
- Browser evidence includes `/events` desktop and mobile screenshots, expected visual signals, console findings, and network findings.
- Required local verification commands pass with the expected signals.
- Visual changes stay list-local and do not modify shared component CSS.
- Responsive layout has no overlap in title/action cluster, fact grid, or bottom row.

Reviewer REJECT criteria:

- Diff touches non-owned files without coordinator approval.
- Shared action, bookmark, menu, user-link, detail, edit, create, runtime, package, or route files change.
- Browser evidence is missing or shows overlap, unreadable text, blank content, new console errors, or failed app requests.
- Negative letter spacing is present.
- Verification is missing, stale, or failing.

Evidence:

- Engineer report: `DONE_WITH_CONCERNS`; T003 Engineer changed `src/ui/events/EventsPageScreen.module.css` for a CSS-only card visual system: warm white cards, deep green title/accent, muted green-gray support text, 8px radius, fine borders, low shadow, tabular/mono numeric facts, responsive fact grid, footer host/route/participation wrapping, and matching empty/status/error/load-more/end card language.
- Reviewer report: `review_passed`; T003 Spec Compliance Reviewer passed after validating `EventsListSection` test exit 0 (7 passed), `useEventParticipation` test exit 0 (8 passed), `npm run lint:changed` exit 0, `npm run type-check:changed` exit 0, negative letter-spacing search exit 1 with no matches, `git diff --check` exit 0, non-empty screenshots, and no forbidden shared path changes. T003 Code Quality Reviewer passed with no blocking findings after validating `EventsListSection` test exit 0, `npm run lint:changed` exit 0, `npm run type-check:changed` exit 0, and negative letter-spacing search exit 1.
- Residual risk accepted: loading/filtering/creating/error/load-more/end-hint visual states were not each forced in-browser; they share updated `.statusRow` / `.errorCard` / list-state CSS and existing tests preserve text/roles. Pending spinner wrapping is lightly covered. Page-level mobile create CTA overlap is outside T003 scope.
- Browser evidence:
  - Used `http://localhost:3001/events` because port 3000 was occupied by parent repo.
  - Dev server `npm run dev -- --port 3001` reached Ready and was stopped; `lsof` on 3001 after stop exit 1.
  - Console errors: 0.
  - Failed resource/app-network diagnostics: 0.
  - Screenshots: `/private/tmp/dive-into-run-081-events-desktop-1440x900.png`, `/private/tmp/dive-into-run-081-events-mobile-390x844.png`, `/private/tmp/dive-into-run-081-events-mobile-390x844-footer.png`, `/private/tmp/dive-into-run-081-events-empty-state-1440x900.png`; reviewer confirmed screenshot artifacts were non-empty.
  - Observed: desktop card count 5; desktop fact grid 3 columns; mobile fact grid 1 column at 390px; card background `rgb(255,253,248)`, title `rgb(23,74,55)`, radius 8px, low green shadow; title/actions overlap false; footer overlap false; route pill in host/route group; empty filtered state matched warm style.
- Command output summary:
  - `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser`: exit 0; 1 test file passed, 7 tests passed.
  - `npx vitest run src/runtime/hooks/useEventParticipation.test.jsx --project browser`: exit 0; 1 test file passed, 8 tests passed.
  - `npm run lint:changed`: exit 0; changed-file lint completed with the existing React-version warning only.
  - `npm run type-check:changed`: exit 0; no type errors in changed files.
  - `rg -n "letter-spacing[[:space:]]*:[[:space:]]*-" src/ui/events/EventsPageScreen.module.css`: exit 1; no matches.
  - `git diff --check -- src/ui/events/EventsListSection.jsx src/ui/events/EventsPageScreen.module.css src/ui/events/EventsListSection.test.jsx`: exit 0; no whitespace errors.
  - T003 Spec Compliance Reviewer: `review_passed`; no forbidden shared path changes.
  - T003 Code Quality Reviewer: `review_passed`; no blocking findings.
- Changed files summary:
  - `src/ui/events/EventsPageScreen.module.css` modified by T003 Engineer for CSS-only card visual system.
  - No forbidden shared component, runtime, package, route, or additional product path changes were accepted for T003.

### T004 - Fix Workflow Checker Historical Closeout Guard

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-4`
- **Engineer**: T004 Engineer subagent
- **Reviewer**: T004 Spec Compliance Reviewer and T004 Code Quality Reviewer subagents
- **Commit checkpoint**: none; no stage, commit, push, PR, merge, or local main sync is authorized
- **Last verified commit**: `aa4b9a8de9903d5e682087b05437dd837f5857e8` for the already-committed product implementation; T004 checker fix is reviewed and pending final verifier/release-manager commit
- **Authorization boundary**: edit=yes for the T004 owned files only, commit=no, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable
- **Incidents**: `workflow-check-historical-closeout-guard` closed after T004 review PASS; checker fix remains pending commit

Scope:

- Use TDD to fix `scripts/check-superpowers-state.js` so historical closeout-ish status files do not apply the `lastVerifiedCommit..HEAD` evidence guard against moving repo `HEAD`.
- Add or update the existing checker test/fixture surface required to reproduce the false positive and prove the durable fix.
- Update this feature's workflow state files with T004 evidence after the checker fix.

Non-scope:

- Do not modify activity/event list card product code.
- Do not mutate old historical status files as a workaround.
- Do not stage, commit, push, create a PR, watch CI, merge, or sync local `main`.
- Do not change package files, dependencies, rules, migrations, secrets, or deployment behavior.

Owned files:

- `scripts/check-superpowers-state.js`
- `scripts/check-superpowers-state.test.js`
- `specs/event-list-card-redesign/tasks.md`
- `specs/event-list-card-redesign/status.json`
- `specs/event-list-card-redesign/handoff.md`

Read-only context:

- `scripts/validate-workflow-state.js`
- `docs/superpowers/status.schema.json`
- `docs/superpowers/task-contract.md`
- `specs/event-host-join-notification/status.json`
- `package.json`
- `vitest.config.mjs`

Dependencies:

- `T003`
- Implementation commit `aa4b9a8de9903d5e682087b05437dd837f5857e8`

Browser evidence:

- not applicable for this workflow checker task

Engineer instructions:

- First add a focused regression test that fails against the current checker false positive.
- Model a historical closeout-ish status whose `currentHead.commit` is behind moving repo `HEAD`, with later product changes unrelated to that historical status.
- Fix `scripts/check-superpowers-state.js` so closeout-ish historical statuses use their captured head boundary when available instead of comparing `lastVerifiedCommit` to moving repo `HEAD`.
- Keep the closeout guard active for current statuses and for statuses without a usable captured head.
- Do not mutate `specs/event-host-join-notification/status.json` or any other historical status as a workaround.
- Update only this feature's workflow state files for T004 evidence after the fix.

Acceptance criteria:

- AC-T004.1: A focused regression test proves the historical closeout-ish false positive before the fix and passes after the fix.
- AC-T004.2: `npm run workflow:check` no longer reports this feature's product files against `specs/event-host-join-notification/status.json`.
- AC-T004.3: Current closeout-ish status protection remains in place for real post-verification non-workflow/evidence changes.
- AC-T004.4: T004 changes stay inside owned files and do not alter product behavior.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npm run workflow:check` | Exit 0; 13 status files synced and historical closeout status no longer false-positives on unrelated later product files. |
| `npm run workflow:validate` | Exit 0 with 13 workflow status files schema-valid. |
| `npx vitest run scripts/check-superpowers-state.test.js --project browser` | Exit 0 with the checker regression test passing. |
| `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser` | Exit 0 with focused list card tests still passing. |
| `npm run lint:changed` | Exit 0 with no changed-file lint errors; existing React warning only. |
| `npm run type-check:changed` | Exit 0 with no changed-file type-check errors. |
| `git diff --check -- scripts/check-superpowers-state.js scripts/check-superpowers-state.test.js` | Exit 0 with no whitespace errors in T004 script files. |
| `node scripts/check-superpowers-state.js specs/event-host-join-notification/status.json` | Exit 0; historical status no longer false-positives on unrelated later product files. |

Reviewer PASS criteria:

- Diff touches only T004 owned files.
- Regression test fails against the old checker behavior or clearly encodes the old false-positive case, and passes with the fix.
- `npm run workflow:validate` and `npm run workflow:check` pass after the fix.
- The fix uses captured historical status head information instead of weakening closeout guards globally.
- No historical status mutation workaround, product code change, package change, or release boundary action is present.

Reviewer REJECT criteria:

- Diff modifies product code, package files, old historical statuses, rules, migrations, or non-owned files.
- The fix disables the closeout-ish guard instead of bounding it correctly.
- Tests are missing, stale, or do not cover the historical-status false positive.
- `npm run workflow:check` still fails with the known historical status false positive after the fix.
- Any stage, commit, push, PR, CI watch, merge, or local `main` sync action is attempted.

Evidence:

- Engineer report: `DONE`; T004 Engineer changed `scripts/check-superpowers-state.js` and added `scripts/check-superpowers-state.test.js` for the durable checker regression. Root cause: the closeout-ish guard compared each historical status `lastVerifiedCommit..HEAD`, so unrelated current branch product files were treated as post-verification changes for old specs. Fix policy: keep global schema/sync/semantic checks for every status, but run the moving-HEAD product-change guard only when a status belongs to the current branch (`status.branch`, `currentHead.branch`, or GitHub env fallback).
- Reviewer report: `review_passed`; T004 Spec Compliance Reviewer passed after validating `npm run workflow:check` exit 0, `npm run workflow:validate` exit 0, `npx vitest run scripts/check-superpowers-state.test.js --project browser` exit 0, direct `specs/event-host-join-notification/status.json` checker run exit 0, `npm run lint:changed` exit 0, `npm run type-check:changed` exit 0, and diff-check exit 0. Evidence: historical status files were not mutated, the moving `HEAD` closeout guard is gated to the current branch, and the regression covers a historical closeout status with unrelated later product files. T004 Code Quality Reviewer also returned `review_passed` after validating the checker regression, workflow check, lint, and type-check.
- Residual risk: no stage, commit, push, PR, merge, or local main sync has run; `scripts/check-superpowers-state.test.js` is still untracked and must be staged by the Release Manager with the T004 checker fix. The regression covers the historical skip path, not an explicit same-branch negative path; other v3 semantic guards remain active.
- Command output summary:
  - TDD red: server-project temporary test path failed as expected with `v3 closeout-ish phase has non-workflow/evidence changes after lastVerifiedCommit: src/current-feature.js`; regression moved to `scripts/check-superpowers-state.test.js` because of the ESLint project-service allowlist.
  - `npm run workflow:check`: exit 0; 13 status files synced.
  - `npm run workflow:validate`: exit 0; 13 status files valid.
  - `npx vitest run scripts/check-superpowers-state.test.js --project browser`: exit 0; 1 test passed.
  - `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser`: exit 0; 7 tests passed.
  - `npm run lint:changed`: exit 0; existing React warning only.
  - `npm run type-check:changed`: exit 0.
  - `git diff --check -- scripts/check-superpowers-state.js scripts/check-superpowers-state.test.js`: exit 0.
  - `node scripts/check-superpowers-state.js specs/event-host-join-notification/status.json`: exit 0.
  - T004 Spec Compliance Reviewer: `review_passed`; workflow check, validation, checker regression, historical status direct check, lint, type-check, and diff-check all exit 0.
  - T004 Code Quality Reviewer: `review_passed`; checker regression, workflow check, lint, and type-check all exit 0.
- Changed files summary:
  - `scripts/check-superpowers-state.js` modified.
  - `scripts/check-superpowers-state.test.js` added.
  - Existing workflow state files were left untouched by the Engineer and are being updated by this coordinator pass.

## Final Verifier Evidence Before Implementation Commit

- **Phase**: `implementation_committed`
- **Verified at**: 2026-05-31T13:44:55Z
- **Verifier decision**: PASS; reviewed implementation was committed as `aa4b9a8de9903d5e682087b05437dd837f5857e8` (`Implement event list card redesign`).
- **Residual risks accepted**: loading/filtering/creating/error/load-more/end-hint visual states were not each forced in-browser; pending spinner wrapping is lightly covered; page-level mobile create CTA overlap is outside this feature slice.
- **Authorization boundary at verifier time**: edit=yes, commit=yes, push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no.

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `git status --short --branch` | 0 | Branch `081-event-list-card-redesign` ahead 2; only expected modified workflow/product files and untracked `src/ui/events/EventsListSection.test.jsx`; no staged changes. |
| `git diff --name-status` | 0 | Tracked changes only in `specs/event-list-card-redesign/handoff.md`, `specs/event-list-card-redesign/status.json`, `specs/event-list-card-redesign/tasks.md`, `src/ui/events/EventsListSection.jsx`, and `src/ui/events/EventsPageScreen.module.css`. |
| `git ls-files --others --exclude-standard src/ui/events/EventsListSection.test.jsx` | 0 | Untracked test file present. |
| `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser` | 0 | Focused list card tests passed: 1 test file passed, 7 tests passed. |
| `npx vitest run src/runtime/hooks/useEventParticipation.test.jsx --project browser` | 0 | Existing participation runtime tests passed: 1 test file passed, 8 tests passed. |
| `npm run lint:changed` | 0 | Changed-file lint completed with the existing React version settings warning only. |
| `npm run type-check:changed` | 0 | Changed-file type check passed with no type errors. |
| `npm run workflow:validate` | 0 | Workflow schema validation passed: 13 status files valid. |
| `npm run workflow:check` | 0 | Workflow sync check passed: 13 status files synced. |
| `rg -n "letter-spacing[[:space:]]*:[[:space:]]*-" src/ui/events/EventsPageScreen.module.css` | 1 | No negative letter-spacing matches. |
| `git diff --check -- src/ui/events/EventsListSection.jsx src/ui/events/EventsPageScreen.module.css src/ui/events/EventsListSection.test.jsx specs/event-list-card-redesign/tasks.md specs/event-list-card-redesign/status.json specs/event-list-card-redesign/handoff.md` | 0 | No whitespace errors in implementation files or workflow state files. |
| `stat -f "%z %N" /private/tmp/dive-into-run-081-events-desktop-1440x900.png /private/tmp/dive-into-run-081-events-mobile-390x844.png /private/tmp/dive-into-run-081-events-mobile-390x844-footer.png /private/tmp/dive-into-run-081-events-empty-state-1440x900.png` | 0 | All screenshot artifacts existed and were non-empty: 68888, 30199, 28459, and 25415 bytes. |
