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
  - `T001 -> T002 -> T003`
- Parallel waves:
  - `wave-1`: `T001`
  - `wave-2`: `T002`
  - `wave-3`: `T003`
- Final integration gate after T003:
  - `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser`: exit 0.
  - `npx vitest run src/runtime/hooks/useEventParticipation.test.jsx --project browser`: exit 0.
  - `npm run lint:changed`: exit 0.
  - `npm run type-check:changed`: exit 0.
  - `git diff --check -- src/ui/events/EventsListSection.jsx src/ui/events/EventsPageScreen.module.css src/ui/events/EventsListSection.test.jsx`: exit 0.
  - Browser evidence for `/events` at `1440x900` and `390x844`: screenshots recorded, no new console errors, no failed app requests, no card/control overlap.

## Tasks

### T001 - Add Focused List Card Tests

- **State**: `ready`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Engineer subagent
- **Reviewer**: Reviewer subagent
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

- Engineer report: not recorded yet
- Reviewer report: not recorded yet
- Command output summary: none
- Changed files summary: none

### T002 - Implement Card Markup And Background Navigation

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Engineer subagent
- **Reviewer**: Reviewer subagent
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

- Engineer report: not recorded yet
- Reviewer report: not recorded yet
- Command output summary: none
- Changed files summary: none

### T003 - Implement Card Visual System And Browser Evidence

- **State**: `todo`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Engineer subagent
- **Reviewer**: Reviewer subagent
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

- Engineer report: not recorded yet
- Reviewer report: not recorded yet
- Command output summary: none
- Changed files summary: none
