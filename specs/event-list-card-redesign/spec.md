# Goal

Redesign the `/events` list activity/event card body and the surrounding list states so the event list reads as a polished homepage-style information card while preserving current list functionality, runtime behavior, and navigation contracts.

The design target is a warm white card surface with deep green title/accent treatment, muted green-gray supporting text, compact information hierarchy, 8px radius, fine border, low shadow, mono numeric facts, and no negative letter spacing.

# Scope

- Redesign `/events` list cards rendered by `EventsListSection`.
- Restyle list state cards for loading, filtering, creating, empty, error, load-more, and end hint states to match the card visual language.
- Preserve the current card composition points: `BookmarkButton`, `EventActionButtons`, `EventCardMenu`, `UserLink`, and `event-formatters`.
- Preserve title navigation to `/events/{id}` and host navigation to `/users/{uid}`.
- Add the approved explicit interaction exception: clicking card background or empty card area may navigate to `/events/{id}`.
- Keep implementation localized to the list screen boundary where possible, likely `src/ui/events/EventsListSection.jsx` and `src/ui/events/EventsPageScreen.module.css`.

# Non-goals

- Do not redesign the event detail page.
- Do not restyle shared detail/create/edit components globally.
- Do not redesign edit/delete modals, even though they are triggered from the card menu.
- Do not replace the existing bookmark icon/style with a heart.
- Do not add fields or features that are not currently in the list card: description, run type, map preview, participants list/count beyond existing max/remaining, comments, or share.
- Do not change product behavior, persistence, side effects, toasts, or route formatting semantics.
- Commit, push, PR creation, merge, CI watch, and local `main` sync are not authorized yet.

# Existing System Evidence

- `/events` enters through `src/app/events/page.jsx`, which renders `EventsPageScreen` at lines 4 and 13.
- `EventsPageScreen` owns the runtime and passes state/handlers into `EventsListSection` in `src/ui/events/EventsPageScreen.jsx` around lines 15 and 92-117. Create, filter, edit, and delete overlays are rendered outside the list section around lines 119-191.
- `EventsListSection` composes inline list cards and imports `BookmarkButton`, `EventActionButtons`, `EventCardMenu`, `UserLink`, and event formatters in `src/ui/events/EventsListSection.jsx` lines 1-7 and 71-164.
- Current card fields are already present in `EventsListSection`: title link at lines 74-76; time, deadline, location, and meet place at lines 78-95; distance, pace, max participants, and remaining seats at lines 97-114; host and route at lines 116-130; join/leave area at lines 132-144; bookmark/menu controls at lines 147-164.
- List state text and behavior also live in `EventsListSection`: empty state at lines 69-70; loading/filtering/creating at lines 196-215; load error at lines 217-221; list/empty switch at lines 223-228; load-more at lines 231-250; end hint at line 253; sentinel at line 255.
- Formatter semantics are centralized in `src/ui/events/event-formatters.js`: date formatting at lines 8-24, pace formatting at lines 32-47, and route label formatting at lines 54-58.
- `src/components/EventActionButtons.jsx` lines 54-135 contain join, leave, login, full, deadline, checking, and pending labels/behavior.
- `src/components/BookmarkButton.jsx` lines 18-55 define bookmark aria labels, visual structure, and button style. Favorite runtime side effects, unauth toast, optimistic toggle, and rollback live in `src/runtime/hooks/useEventsPageRuntime.js` from line 233 onward.
- Owner-only edit/delete menu behavior lives in `src/components/EventCardMenu.jsx` lines 45-91; its click-outside behavior should be preserved if present in that component.
- Join/leave side effects and propagation boundaries are in `src/runtime/hooks/useEventParticipation.js` around lines 217 and 312. Membership checking is handled around lines 89-181 and exposed around line 380.
- `src/ui/events/EventsPageScreen.module.css` already contains list/card/state styling: state classes around lines 665-685 and 699-819, current card white surface/8px radius/border/shadow around lines 710-728, meta grid around lines 754-767, and top actions around lines 973-982.
- `EventActionButtons.module.css` is shared and composed by detail/edit-related styles, including `src/ui/events/EventDetailScreen.module.css` lines 185-203, `src/components/EventEditForm.module.css` lines 185-187, and `EventsPageScreen.module.css` lines 618-637. Future styling should avoid global shared action CSS changes unless done through opt-in list-only wrapper/classes.
- Existing tests cover participation runtime behavior in `src/runtime/hooks/useEventParticipation.test.jsx`, including join, full, leave, host, and membership states. No direct source tests were found for `EventsListSection`, bookmark favorite runtime, menu behavior, or the new card click exception.

# Requirements

- Preserve the existing displayed data fields: `title`, `time`, `registrationDeadline`, `city`, `district`, `meetPlace`, `distanceKm`, `paceSec` or `pace`, `maxParticipants`, `remainingSeats` or `participantsCount`, host `uid`/`name`/`photo`, and route data from `routeCoordinates` or `route.pointsCount`.
- Preserve date, pace, remaining-seat, and route label formatting semantics from the existing formatter helpers.
- Preserve join, leave, login, full, deadline, checking, and pending labels and behavior.
- Preserve the rule that event hosts do not see join/leave controls.
- Preserve logged-out helper text.
- Preserve toasts and side effects for participation and favorite actions.
- Preserve bookmark aria labels, unauthenticated favorite toast, optimistic toggle, rollback behavior, and current bookmark visual style.
- Preserve owner-only menu contents with exactly edit and delete actions.
- Preserve menu click-outside close behavior.
- Preserve edit/delete modal behavior without redesigning the modals.
- Preserve list state text and behavior; only restyle the state containers to match the new card visual language.

# Interaction Contract

- Event title remains a link to `/events/{id}`.
- Host `UserLink` remains a link to `/users/{uid}`.
- Clicking card background or empty card area may navigate to `/events/{id}`.
- Clicking interactive controls must not trigger card navigation.
- Controls that must not navigate the card include the three-dot menu, edit/delete menu actions, participation buttons, disabled-looking participation states such as deadline/full/checking/report states, leave button, and `BookmarkButton`.
- Participation controls keep their current disabled/loading/auth/host behavior.
- Bookmark interactions keep their current aria labels, visual state, optimistic update, rollback, and unauthenticated toast.
- Owner menu keeps exactly edit/delete and its existing modal triggers.

# Visual Contract

- Use homepage-style information card direction: warm/white surface, deep green title/accent, muted green-gray secondary text, 8px radius, fine border, and low shadow.
- Use mono numeric styling for factual values such as distance, pace, max participants, remaining seats, times, and deadlines where appropriate.
- Do not use negative letter spacing.
- Preserve the current bookmark button style and icon.
- Card structure:
  - Top meta row: event time and registration deadline.
  - Main title area: event title plus right-side action cluster.
  - Middle fact grid with exactly location city/district, meet place, distance, pace, max participants, and remaining seats.
  - Bottom row: host `UserLink`, route status as a small pill next to host, and the participation/join area.
- Route status belongs as a small bottom pill next to host, not in the fact grid.
- State cards for loading, filtering, creating, empty, error, load-more, and end hint should visually align with the redesigned event card language.

# Responsive Contract

- Desktop uses a single-column wide event list with a 3-column fact grid.
- Mobile uses 1-2 fact columns depending on available width.
- The right-side action cluster must not overlap the title.
- The bottom host/route/join row must wrap cleanly without text or controls overlapping.
- Text and controls must remain legible and contained on mobile and desktop.

# Accessibility

- Preserve semantic links for the event title and host profile.
- Preserve existing button semantics and bookmark aria labels.
- Ensure card-level background navigation does not steal focus or activation from nested controls.
- Maintain keyboard access for title, host link, bookmark, menu, edit/delete actions, and participation controls.
- Keep route status and factual labels readable as text, not color-only signals.
- Loading, disabled, full, deadline, checking, and pending participation states must remain understandable without relying only on color.

# Verification

- Verify functionality parity for all preserved fields, formatting, joins/leaves, host behavior, logged-out behavior, bookmarks, owner menu, and list states.
- Verify the card click exception: card background/empty area navigates to detail, while menu, participation controls including disabled-looking states, leave, and bookmark do not navigate.
- Run existing runtime tests that cover participation behavior.
- Add a minimal render/interaction test for list card behavior if current UI coverage is insufficient, especially for the card click exception and control propagation.
- Perform desktop and mobile visual checks for the wide single-column list, 3-column desktop fact grid, 1-2 column mobile grid, title/action wrapping, and bottom row wrapping.
- Run changed-file lint/type checks required by the future implementation plan.

# Open Questions/Risks

- The card background navigation must be implemented carefully because nested links/buttons already own separate interactions; propagation mistakes would create accidental detail navigation.
- Shared `EventActionButtons.module.css` is used by detail and edit-related surfaces, so list-specific visual changes should use an opt-in list wrapper/class instead of global shared action restyling unless a later plan explicitly approves that boundary.
- Existing test coverage does not appear to directly cover `EventsListSection`, bookmark favorite runtime, menu behavior, or card background click behavior. The implementation plan should decide the smallest useful coverage addition.
- This spec intentionally excludes product code edits. Future implementation must request separate authorization before editing `src/`, tests, package files, committing, pushing, or opening a PR.
