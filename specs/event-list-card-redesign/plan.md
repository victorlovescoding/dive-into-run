# Event List Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/events` list cards and list state cards into polished homepage-style information cards while preserving existing fields, actions, side effects, and navigation.

**Architecture:** Keep the change inside the events list boundary. `EventsListSection.jsx` owns the rendered card structure and the new background-click navigation guard; `EventsPageScreen.module.css` owns list-only visuals and responsive behavior. Shared components (`BookmarkButton`, `EventActionButtons`, `EventCardMenu`, `UserLink`) remain behavior sources and are styled only through list-local wrapper selectors when needed.

**Tech Stack:** Next.js 15 App Router, React 19, JavaScript with JSDoc and `checkJs`, CSS Modules, Vitest browser project with Testing Library, Firebase-backed runtime preserved through existing hooks.

---

## Source Findings

- `/events` enters at `src/app/events/page.jsx`, which renders `EventsPageScreen`.
- `src/ui/events/EventsPageScreen.jsx` is a client component and passes all list state and handlers into `EventsListSection`.
- `src/ui/events/EventsListSection.jsx` currently owns every relevant card field, list state, retry/load-more action, favorite action wiring, edit/delete menu wiring, and participation button wiring.
- `src/ui/events/event-formatters.js` owns `formatDateTime`, `formatPace`, and `renderRouteLabel`; the redesign must call these helpers rather than reformatting values.
- `src/runtime/hooks/useEventParticipation.js` already calls `preventDefault()` and `stopPropagation()` in join and leave handlers. The card-level click guard must still protect disabled-looking participation states and controls whose handlers do not stop propagation.
- `src/components/BookmarkButton.jsx`, `src/components/EventCardMenu.jsx`, and `src/components/UserLink.jsx` provide shared semantics that must stay intact.
- `src/components/EventActionButtons.module.css` is shared by list, detail, and edit surfaces. Do not modify it for this feature unless a later plan update creates an explicit list-only opt-in boundary.

## Architecture

### Card Navigation

Use a non-interactive card container with an `onClick` handler that calls `router.push('/events/{id}')` only when the click target is not inside an existing interactive descendant.

Required helper shape in `src/ui/events/EventsListSection.jsx`:

```jsx
const CARD_NAVIGATION_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  '[role="button"]',
  '[role="menuitem"]',
  '[data-card-navigation="ignore"]',
].join(',');

function isInteractiveCardTarget(target) {
  const element =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return Boolean(element?.closest(CARD_NAVIGATION_SELECTOR));
}
```

The card should not become a nested link and should not add a second keyboard focus target. The existing title link remains the keyboard-accessible detail navigation. This avoids invalid interactive nesting while satisfying the approved pointer-click exception.

### Card Layout

Render each event card as:

1. Top meta row: event time and registration deadline.
2. Title/action cluster: title link on the left; `BookmarkButton` and `EventCardMenu` on the right.
3. Six-field fact grid: location, meet place, distance, pace, max participants, remaining seats.
4. Bottom row: host `UserLink`, route status pill next to host, and participation area.

Use semantic text labels for every fact. A `dl` is acceptable for the six-field fact grid if the CSS keeps `dt`/`dd` contained.

### List State Cards

Keep all existing state text and behavior:

- `正在載入活動…`
- `正在篩選活動…`
- `正在建立活動…`
- load error text from `loadError`
- filtered empty text `沒有符合條件的活動`
- unfiltered empty text `目前還沒有活動（先建立一筆看看）`
- load-more text `載入更多活動…`
- load-more error text from `loadMoreError` plus retry button
- end hint `已經到底了`

Only restyle their containers in `EventsPageScreen.module.css`.

### Styling Boundary

Use list-local classes in `EventsPageScreen.module.css` for the new card language:

- Warm white surface.
- Deep green title and accent treatment.
- Muted green-gray supporting text.
- 8px card radius.
- Fine border and low shadow.
- Mono numeric styling for times, deadlines, distance, pace, max participants, and remaining seats.
- No negative `letter-spacing`.

Participation button visual adjustments, if needed, must be scoped under the list card participation wrapper, for example `.eventParticipationSlot button`, so detail/edit surfaces that compose `EventActionButtons.module.css` do not change globally.

## File Responsibility Map

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `src/ui/events/EventsListSection.test.jsx` | Create | Focused render and interaction coverage for list card facts, list states, card background navigation, and nested control propagation. |
| `src/ui/events/EventsListSection.jsx` | Modify | Card markup, data placement, route pill placement, card background click guard, and preservation of all current handlers/formatters. |
| `src/ui/events/EventsPageScreen.module.css` | Modify | List-only card/state visual language, responsive fact grid, wrapping behavior, and scoped action-button styling. |

Read-only context for Engineers:

- `src/ui/events/EventsPageScreen.jsx`
- `src/ui/events/event-formatters.js`
- `src/components/BookmarkButton.jsx`
- `src/components/BookmarkButton.module.css`
- `src/components/EventActionButtons.jsx`
- `src/components/EventActionButtons.module.css`
- `src/components/EventCardMenu.jsx`
- `src/components/EventCardMenu.module.css`
- `src/components/UserLink.jsx`
- `src/runtime/hooks/useEventParticipation.js`
- `src/runtime/hooks/useEventsPageRuntime.js`
- `vitest.config.mjs`
- `vitest.setup.jsx`
- `docs/superpowers/task-contract.md`
- `.codex/rules/sensors.md`

## Dependency Graph

```text
T001 create focused UI tests
  -> T002 implement card markup and click contract
    -> T003 implement list-card and list-state CSS plus browser evidence
```

No same-wave parallel execution is recommended. `EventsListSection.jsx` and `EventsPageScreen.module.css` share class-name contracts, and the CSS task depends on the JSX structure.

## Task Waves

| Wave | Tasks | Parallelism | Reason |
| ---- | ----- | ----------- | ------ |
| `wave-1` | T001 | Serial | Seeds focused failing coverage before implementation. |
| `wave-2` | T002 | Serial | Owns shared JSX and click behavior. |
| `wave-3` | T003 | Serial | Owns CSS and browser evidence after markup class names exist. |

## Implementation Details

### Expected JSX Shape

`EventsListSection.jsx` should keep the existing prop contract and handler names. The mapped card should follow this shape, with class names allowed to vary only when the Engineer updates the CSS task accordingly:

```jsx
const router = useRouter();

function handleCardClick(eventId, clickEvent) {
  if (isInteractiveCardTarget(clickEvent.target)) return;
  router.push(`/events/${eventId}`);
}

const eventCards = events.map((event) => {
  const eventId = String(event.id);
  const detailHref = `/events/${eventId}`;
  const routeLabel = renderRouteLabel(event);

  return (
    <article
      key={event.id}
      className={styles.eventCard}
      aria-label={`${event.title} 活動卡片`}
      data-testid={`event-card-${eventId}`}
      onClick={(clickEvent) => handleCardClick(eventId, clickEvent)}
    >
      <div className={styles.eventMetaRow}>
        <div className={styles.eventMetaItem}>
          <span className={styles.eventMetaLabel}>時間</span>
          <span className={styles.eventMetaValue}>{formatDateTime(event.time)}</span>
        </div>
        <div className={styles.eventMetaItem}>
          <span className={styles.eventMetaLabel}>報名截止</span>
          <span className={styles.eventMetaValue}>
            {formatDateTime(event.registrationDeadline)}
          </span>
        </div>
      </div>

      <div className={styles.eventCardHeader}>
        <Link href={detailHref} className={styles.eventTitleLink}>
          <h3 className={styles.eventTitle}>{event.title}</h3>
        </Link>
        <div className={styles.eventCardTopActions} role="group" aria-label={`${event.title} 操作`}>
          <BookmarkButton
            isActive={favoriteEventIds.has(eventId)}
            label={`收藏活動：${event.title}`}
            activeLabel={`取消收藏活動：${event.title}`}
            onClick={() => onToggleFavoriteEvent(eventId)}
          />
          <EventCardMenu
            event={event}
            currentUserUid={user?.uid || null}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>

      <dl className={styles.eventFactGrid}>
        <div className={styles.eventFact}>
          <dt>地點</dt>
          <dd>{event.city} {event.district}</dd>
        </div>
        <div className={styles.eventFact}>
          <dt>集合</dt>
          <dd>{event.meetPlace}</dd>
        </div>
        <div className={styles.eventFact}>
          <dt>距離</dt>
          <dd className={styles.eventNumericValue}>{event.distanceKm} km</dd>
        </div>
        <div className={styles.eventFact}>
          <dt>配速</dt>
          <dd className={styles.eventNumericValue}>{formatPace(event.paceSec, event.pace)} /km</dd>
        </div>
        <div className={styles.eventFact}>
          <dt>人數上限</dt>
          <dd className={styles.eventNumericValue}>{event.maxParticipants}</dd>
        </div>
        <div className={styles.eventFact}>
          <dt>剩餘名額</dt>
          <dd className={styles.eventNumericValue}>{getRemainingSeats(event)}</dd>
        </div>
      </dl>

      <div className={styles.eventCardFooter}>
        <div className={styles.eventHostRouteGroup}>
          <div className={styles.hostRow}>
            <span className={styles.eventMetaLabel}>主揪</span>
            <UserLink
              uid={event.hostUid}
              name={event.hostName}
              photoURL={event.hostPhotoURL}
              size={24}
            />
          </div>
          <span className={styles.routePill}>路線：{routeLabel}</span>
        </div>
        <div className={styles.eventParticipationSlot} data-card-navigation="ignore">
          <EventActionButtons
            event={event}
            user={user}
            onJoin={onJoin}
            onLeave={onLeave}
            isPending={pendingByEventId[eventId]}
            isCreating={isCreating}
            isFormOpen={isFormOpen}
            myJoinedEventIds={myJoinedEventIds}
            membershipStatus={membershipStatusByEventId[eventId]}
          />
        </div>
      </div>
    </article>
  );
});
```

This shape intentionally keeps `BookmarkButton` and `EventCardMenu` in their existing components, keeps `UserLink` as the host link, and keeps participation behavior in `EventActionButtons`.

### Expected CSS Structure

`EventsPageScreen.module.css` should replace the current `.eventCardWrapper`, `.eventCard`, `.eventMeta`, `.eventTitleLink`, `.eventTitle`, `.eventCardActions`, `.eventCardTopActions`, `.emptyHint`, `.statusRow`, `.errorCard`, `.loadMoreArea`, `.retryButton`, and `.endHint` list styles with a coherent list-local system.

Required responsive signals:

```css
.eventFactGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 768px) {
  .eventFactGrid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .eventFactGrid {
    grid-template-columns: 1fr;
  }
}
```

Use wrapper-scoped rules for list participation buttons:

```css
.eventParticipationSlot button {
  min-width: max-content;
}

.eventParticipationSlot :global(.spinnerLabel) {
  white-space: nowrap;
}
```

If CSS Modules do not expose the shared spinner class through `:global(.spinnerLabel)`, keep the rule under the wrapper and verify visually without changing `EventActionButtons.module.css`.

## Verification Strategy

Run these commands as separate evidence entries during implementation:

| Command | Expected signal |
| ------- | --------------- |
| `npx vitest run src/ui/events/EventsListSection.test.jsx --project browser` | After T001, exit 1 with the new card navigation assertion failing against the old component; after T002/T003, exit 0 with all focused list card tests passing. |
| `npx vitest run src/runtime/hooks/useEventParticipation.test.jsx --project browser` | Exit 0; existing join, leave, full, host, and membership-state behavior remains green. |
| `npm run lint:changed` | Exit 0; no lint errors in changed files. |
| `npm run type-check:changed` | Exit 0; changed-file type-check report has no errors. |
| `rg -n "letter-spacing[[:space:]]*:[[:space:]]*-" src/ui/events/EventsPageScreen.module.css` | Exit 1 with no matches, proving the feature did not add negative letter spacing. |
| `git diff --check -- src/ui/events/EventsListSection.jsx src/ui/events/EventsPageScreen.module.css src/ui/events/EventsListSection.test.jsx` | Exit 0; no whitespace errors in implementation files. |

Browser evidence is required for T003:

- Start the app with `npm run dev`.
- Target route: `http://localhost:3000/events`.
- Desktop viewport: `1440x900`.
- Mobile viewport: `390x844`.
- Required visual signals: single-column event list, warm white cards, deep green title/accent, muted green-gray secondary text, 8px radius, fine border, low shadow, top time/deadline row, title/action cluster without overlap, desktop 3-column fact grid, mobile 1-2 fact columns depending width, route pill beside host in the bottom row, participation area wrapping without overlap, and state cards matching the same visual language.
- Required interaction signals: clicking card background navigates to `/events/{id}`; clicking title, host, bookmark, menu trigger, menu items, join/leave, disabled-looking participation buttons, retry, and filter controls does not trigger card background navigation.
- Required browser diagnostics: record console errors, failed network requests, and screenshot artifact paths for both viewports.
- Stop the dev server after evidence is captured.

## Risk Analysis

- Card background navigation can accidentally fire for nested controls. Mitigation: central `closest()` guard, focused Testing Library interaction tests, and browser click evidence.
- Disabled-looking participation buttons can be easy to miss because disabled controls may not emit normal click events. Mitigation: guard all buttons, wrap the participation slot with `data-card-navigation="ignore"`, and include disabled/full/checking states in tests or browser evidence.
- Shared action button CSS is used by event detail and edit form surfaces. Mitigation: do not modify `EventActionButtons.module.css`; use list wrapper selectors only.
- CSS class churn can silently break tests if class names and markup tasks drift. Mitigation: serialize JSX before CSS and run the focused Vitest test after both tasks.
- Live `/events` data may not expose every list state during browser evidence. Mitigation: component tests cover all list state text and behavior; browser evidence verifies the visible route and responsive card layout.

## Stop Conditions

Stop and ask the coordinator before continuing if any of these occurs:

- A required change exceeds the owned files for the active task.
- Implementation requires changes to event detail, create/edit forms, shared `EventActionButtons.module.css`, Firebase services, Firestore rules, storage rules, schema, migration, dependencies, package files, or runtime side effects.
- The background-click contract cannot be satisfied without invalid nested interactive markup.
- Existing list text, formatter output, toasts, modal triggers, bookmark behavior, owner menu behavior, or participation behavior must change to make the design work.
- Verification fails for a reason outside the task-owned files.
- Browser evidence shows overlap or unreadable text at desktop or mobile viewport and the fix would require scope beyond `EventsListSection.jsx` and `EventsPageScreen.module.css`.

## Self-Review Coverage

- Scope B card body and list states are covered by T001, T002, and T003.
- Event detail page and global shared component restyles are excluded in every task non-scope.
- `BookmarkButton` style/icon is preserved by keeping the shared component and CSS read-only.
- Required card architecture is mapped to the JSX structure and CSS acceptance criteria.
- Route status pill is explicitly placed next to host in the footer, not in the fact grid.
- Background click navigation and nested control exceptions are covered by tests and browser evidence.
- Existing fields, formatters, handlers, side effects, list texts, retry behavior, menu/modal triggers, and participation states are preserved by file boundaries and verification.
- Desktop and mobile responsive contracts are covered by CSS requirements plus browser evidence.
