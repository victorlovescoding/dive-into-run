# Tasks: Lock Started Event Edits and Deletes

**Input**: Design documents from `specs/101-lock-started-event-edits/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/event-start-lock.md`, `quickstart.md`

**Tests**: Required. The specification has mandatory user scenarios and success criteria, and the constitution requires TDD. Write tests first and verify they fail before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently after the foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other ready tasks because it touches a different file and does not depend on incomplete work.
- **[Story]**: User story label for story phases only: `[US1]`, `[US2]`, `[US3]`, `[US4]`.
- Every task includes an exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the shared test and helper surface used by all stories without changing feature behavior yet.

- [X] T001 Create the started-lock Firestore rules test shell and dynamic timestamp fixture builder in tests/server/firestore/event-start-lock-rules.test.js
- [X] T002 [P] Add reusable event-start boundary unit tests for client-side helper behavior in tests/unit/runtime/event-runtime-helpers.test.js
- [X] T003 Implement the pure event start boundary helper with `now >= event.time` semantics in src/runtime/events/event-runtime-helpers.js
- [X] T004 [P] Add shared host/non-host event factories for started-lock component assertions in tests/unit/components/EventCardMenu.test.jsx
- [X] T005 [P] Add shared host/non-host event factories for detail-screen started-lock assertions in tests/unit/ui/events/EventDetailScreen.test.jsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the authoritative lock contract and shared UI/runtime data shape before story slices start.

**CRITICAL**: No user story implementation should begin until this phase is complete.

- [X] T006 Define the event body field allowlist and non-body counter field separation in firestore.rules
- [X] T007 Add service-level started-lock error classification constants and messages in src/service/event-service.js
- [X] T008 Thread started-lock metadata through event mutation use-case result shapes in src/runtime/client/use-cases/event-use-cases.js
- [X] T009 Add shared menu disabled-reason props for owner-only controls in src/components/EventCardMenu.jsx
- [X] T010 Add shared delete confirmation disabled-reason props without changing existing enabled behavior in src/components/EventDeleteConfirm.jsx

**Checkpoint**: Foundation ready. After T001-T010, rules, service/runtime, and UI slices can be assigned to disjoint subagents.

---

## Phase 3: User Story 1 - Host Cannot Edit Event Body After Start (Priority: P1) MVP

**Goal**: A confirmed host can edit before start, cannot edit at or after start, sees `活動已開始，無法編輯或刪除。`, and stale edit submissions fail without partial updates.

**Independent Test**: As host, verify edit is enabled before start, disabled at exact start and after start, stale submit is rejected, and saving `time <= request.time` is rejected.

### Tests for User Story 1

- [X] T011 [P] [US1] Add service tests for host edit rejection at and after event start and for `time <= now` validation in tests/unit/service/event-service.test.js
- [X] T012 [P] [US1] Add runtime helper tests for edit lock equality boundary and before-start behavior in tests/unit/runtime/event-runtime-helpers.test.js
- [X] T013 [P] [US1] Add owner menu edit-disabled tests with exact reason text in tests/unit/components/EventCardMenu.test.jsx
- [X] T014 [P] [US1] Add detail-screen host edit-disabled tests for started events in tests/unit/ui/events/EventDetailScreen.test.jsx
- [X] T015 [P] [US1] Add stale edit submit tests for detail mutations in tests/unit/runtime/useEventDetailMutations.test.jsx
- [X] T016 [P] [US1] Add stale edit submit tests for list mutations in tests/unit/runtime/useEventMutations.test.jsx
- [X] T017 [US1] Add Firestore rules tests for host update allowed before start, denied at start, denied after start, stale edit denial, and resulting `time > request.time` in tests/server/firestore/event-start-lock-rules.test.js

### Implementation for User Story 1

- [X] T018 [P] [US1] Enforce host event body updates only when `request.time < resource.data.time` and `request.resource.data.time > request.time` in firestore.rules
- [X] T019 [P] [US1] Add service validation for started host edit attempts and future resulting start time in src/service/event-service.js
- [X] T020 [P] [US1] Extend client helper usage for started edit lock evaluation in src/runtime/events/event-runtime-helpers.js
- [X] T021 [US1] Apply edit started-lock handling to event update use-cases in src/runtime/client/use-cases/event-use-cases.js
- [X] T022 [P] [US1] Handle stale edit submit failure without success state in src/runtime/hooks/useEventDetailMutations.js
- [X] T023 [P] [US1] Handle stale edit submit failure without success state in src/runtime/hooks/useEventMutations.js
- [X] T024 [US1] Disable the host edit menu entry and expose `活動已開始，無法編輯或刪除。` in src/components/EventCardMenu.jsx
- [X] T025 [US1] Pass host edit started-lock state from detail data into the owner menu in src/ui/events/EventDetailScreen.jsx
- [X] T026 [US1] Pass host edit started-lock state from list data into the owner menu in src/ui/events/EventsListSection.jsx

**Checkpoint**: US1 is independently functional and testable with the US1 test set plus the targeted unit/component/runtime/service command.

---

## Phase 4: User Story 2 - Host Cannot Delete Event After Start (Priority: P1)

**Goal**: A confirmed host can delete before start, cannot delete at or after start, sees the same started-lock reason, and stale delete confirmations fail while the event remains active.

**Independent Test**: As host, verify delete opens confirmation before start, is disabled at exact start and after start, and stale confirmation does not soft-delete the event or emit misleading success side effects.

### Tests for User Story 2

- [X] T027 [P] [US2] Add soft-delete rules tests for host delete allowed before start and denied at or after start in tests/server/firestore/event-soft-delete-rules.test.js
- [X] T028 [US2] Add detail mutation tests proving stale delete confirm does not report success or send misleading cancellation side effects in tests/unit/runtime/useEventDetailMutations.test.jsx
- [X] T029 [US2] Add list mutation tests proving stale delete confirm keeps the event active after rejection in tests/unit/runtime/useEventMutations.test.jsx
- [X] T030 [P] [US2] Add delete confirmation disabled and blocked-confirm tests in tests/unit/components/EventDeleteConfirm.test.jsx
- [X] T031 [US2] Add owner menu delete-disabled tests with exact reason text in tests/unit/components/EventCardMenu.test.jsx

### Implementation for User Story 2

- [X] T032 [US2] Enforce host soft-delete only when `request.time < resource.data.time` while keeping hard delete denied in firestore.rules
- [X] T033 [US2] Apply delete started-lock handling to event delete use-cases in src/runtime/client/use-cases/event-use-cases.js
- [X] T034 [US2] Gate detail delete before cancellation notifications and preserve active state on rejection in src/runtime/hooks/useEventDetailMutations.js
- [X] T035 [US2] Preserve list event state and surface started-lock rejection on delete failure in src/runtime/hooks/useEventMutations.js
- [X] T036 [P] [US2] Prevent disabled delete confirmation submission and display the started-lock reason in src/components/EventDeleteConfirm.jsx
- [X] T037 [US2] Disable the host delete menu entry and pass the shared started-lock reason in src/components/EventCardMenu.jsx
- [X] T038 [US2] Pass host delete started-lock state from detail data into delete confirmation flow in src/ui/events/EventDetailScreen.jsx
- [X] T039 [US2] Pass host delete started-lock state from list data into delete confirmation flow in src/ui/events/EventsListSection.jsx

**Checkpoint**: US2 is independently functional and testable with US2 tests plus the Firestore rules command.

---

## Phase 5: User Story 3 - Non-host Permission Priority Remains First (Priority: P1)

**Goal**: Non-host and unauthenticated users can never edit or delete, and started-lock messaging never replaces the existing permission-first behavior.

**Independent Test**: As non-host and unauthenticated actor, verify edit/delete are denied before start, at start, and after start, with permission or sign-in behavior taking priority over started-lock reason.

### Tests for User Story 3

- [X] T040 [US3] Add Firestore rules tests for non-host update and soft-delete denial before, at, and after start in tests/server/firestore/event-start-lock-rules.test.js
- [X] T041 [US3] Add permission-priority runtime tests for non-host edit/delete attempts in tests/unit/runtime/useEventDetailMutations.test.jsx
- [X] T042 [US3] Add permission-priority list mutation tests for non-host edit/delete attempts in tests/unit/runtime/useEventMutations.test.jsx
- [X] T043 [US3] Add menu tests proving non-host controls keep existing absence or permission behavior without started-lock reason in tests/unit/components/EventCardMenu.test.jsx

### Implementation for User Story 3

- [X] T044 [US3] Preserve host ownership checks ahead of started-lock checks in src/runtime/client/use-cases/event-use-cases.js
- [X] T045 [US3] Preserve permission-first detail mutation error ordering in src/runtime/hooks/useEventDetailMutations.js
- [X] T046 [US3] Preserve permission-first list mutation error ordering in src/runtime/hooks/useEventMutations.js
- [X] T047 [US3] Keep started-lock disabled controls host-only in src/components/EventCardMenu.jsx

**Checkpoint**: US3 is independently functional and testable without relying on host started-lock UI.

---

## Phase 6: User Story 4 - Started Events Preserve Non-body Interactions (Priority: P2)

**Goal**: Started-lock applies only to event body edit and product delete; view, comments, share, favorites, join, leave, counters, and identity display keep existing behavior.

**Independent Test**: On a started event, verify detail/list display, share, favorite/unfavorite, comments, join/leave, participant counters, and identity display are not blocked by this feature when existing rules allow them.

### Tests for User Story 4

- [X] T048 [US4] Add rules regression tests proving participant counter updates remain allowed after start when existing join/leave rules allow them in tests/server/firestore/event-start-lock-rules.test.js
- [X] T049 [P] [US4] Add rules regression tests proving comment create and delete-own remain allowed after start when existing comment rules allow them in tests/server/firestore/event-comments-rules.test.js
- [X] T050 [P] [US4] Add rules regression tests proving favorite and unfavorite remain allowed after start when existing favorite rules allow them in tests/server/firestore/event-favorites-rules.test.js
- [X] T051 [P] [US4] Add participation regression tests for join and leave on started events in tests/unit/runtime/useEventDetailParticipation.test.jsx
- [X] T052 [US4] Add detail-screen regression tests for comment create, delete-own comment, favorite, unfavorite, and share actions on started events in tests/unit/ui/events/EventDetailScreen.test.jsx
- [X] T053 [P] [US4] Add list/search/filter/sort regression tests proving started events still render, search, filter, and sort in tests/unit/runtime/useEventsPageRuntime.test.jsx
- [X] T054 [P] [US4] Add list-section regression tests proving started event display and owner menu state do not block non-body list interactions in tests/unit/ui/events/EventsListSection.test.jsx
- [X] T055 [US4] Add detail-screen regression tests for host identity and participant identity display on started events in tests/unit/ui/events/EventDetailScreen.test.jsx

### Implementation for User Story 4

- [X] T056 [US4] Keep participant counter update rules separate from started-lock body update rules in firestore.rules
- [X] T057 [P] [US4] Preserve join and leave runtime behavior for started events in src/runtime/hooks/useEventDetailParticipation.js
- [X] T058 [US4] Preserve detail-screen comment create and delete-own flows for started events in src/ui/events/EventDetailScreen.jsx
- [X] T059 [US4] Preserve detail-screen favorite, unfavorite, share, host identity, and participant identity flows for started events in src/ui/events/EventDetailScreen.jsx
- [X] T060 [P] [US4] Preserve list/search/filter/sort behavior for started events in src/runtime/hooks/useEventsPageRuntime.js
- [X] T061 [US4] Preserve list-section rendering and non-body interaction wiring for started events in src/ui/events/EventsListSection.jsx

**Checkpoint**: US4 proves the lock scope is limited to event body edit and product delete.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Verify story behavior, quality gates, and branch readiness after selected story slices are complete.

- [X] T062 Run `npx vitest run tests/unit/service/event-service.test.js tests/unit/components/EventCardMenu.test.jsx tests/unit/ui/events/EventDetailScreen.test.jsx tests/unit/runtime/useEventMutations.test.jsx tests/unit/runtime/useEventDetailMutations.test.jsx` for tests/unit/service/event-service.test.js
- [X] T063 Run `firebase emulators:exec --only firestore --project demo-test "npx vitest run tests/server/firestore/event-start-lock-rules.test.js"` for tests/server/firestore/event-start-lock-rules.test.js
- [X] T064 Run `firebase emulators:exec --only firestore --project demo-test "npx vitest run tests/server/firestore/event-soft-delete-rules.test.js tests/server/firestore/event-comments-rules.test.js tests/server/firestore/event-favorites-rules.test.js"` for tests/server/firestore/event-soft-delete-rules.test.js
- [X] T065 Run `npx vitest run tests/unit/runtime/useEventDetailParticipation.test.jsx tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/ui/events/EventsListSection.test.jsx tests/unit/components/EventDeleteConfirm.test.jsx tests/unit/runtime/event-runtime-helpers.test.js` for tests/unit/runtime/useEventDetailParticipation.test.jsx
- [X] T066 Run `npm run lint:changed` for changed files including firestore.rules and src/service/event-service.js
- [X] T067 Run `npm run type-check:changed` for changed files including src/runtime/client/use-cases/event-use-cases.js and src/runtime/events/event-runtime-helpers.js
- [X] T068 Run `npm run depcruise` for dependency direction across src/service/event-service.js and src/runtime/client/use-cases/event-use-cases.js
- [X] T069 Run `npm run build` from package.json for the Next.js app after UI changes in src/ui/events/EventDetailScreen.jsx
- [X] T070 Run `npm run lint -- --max-warnings 0` from package.json for the pre-commit quality gate
- [X] T071 Run `npm run type-check` from package.json for the pre-commit quality gate
- [X] T072 Run `npm run spellcheck` from package.json for the pre-commit quality gate
- [X] T073 Run `git diff --check -- firestore.rules src/service/event-service.js src/runtime/events/event-runtime-helpers.js src/runtime/client/use-cases/event-use-cases.js src/runtime/hooks/useEventDetailMutations.js src/runtime/hooks/useEventMutations.js src/runtime/hooks/useEventDetailParticipation.js src/runtime/hooks/useEventsPageRuntime.js src/components/EventCardMenu.jsx src/components/EventDeleteConfirm.jsx src/ui/events/EventDetailScreen.jsx src/ui/events/EventsListSection.jsx tests/server/firestore/event-start-lock-rules.test.js tests/server/firestore/event-soft-delete-rules.test.js tests/server/firestore/event-comments-rules.test.js tests/server/firestore/event-favorites-rules.test.js tests/unit/service/event-service.test.js tests/unit/components/EventCardMenu.test.jsx tests/unit/components/EventDeleteConfirm.test.jsx tests/unit/ui/events/EventDetailScreen.test.jsx tests/unit/ui/events/EventsListSection.test.jsx tests/unit/runtime/useEventMutations.test.jsx tests/unit/runtime/useEventDetailMutations.test.jsx tests/unit/runtime/useEventDetailParticipation.test.jsx tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/runtime/event-runtime-helpers.test.js` for whitespace verification
- [X] T074 Request reviewer verification of the full diff after tests pass, with focus on firestore.rules and stale delete notification ordering in src/runtime/hooks/useEventDetailMutations.js

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **US1 (Phase 3)**: Depends on Phase 2. This is MVP.
- **US2 (Phase 4)**: Depends on Phase 2. It may run alongside US1 only if subagents do not touch the same files at the same time; coordinate `firestore.rules`, `EventCardMenu.jsx`, and mutation hooks carefully.
- **US3 (Phase 5)**: Depends on Phase 2. Best run after US1/US2 menu and guard shapes exist, but its tests can be prepared in parallel.
- **US4 (Phase 6)**: Depends on Phase 2. Rules and participation regression tests can start after foundation; implementation should wait until US1/US2 rules changes are visible.
- **Polish (Phase 7)**: Depends on all selected story slices.

### User Story Dependencies

- **US1 (P1)**: Independent MVP after foundation.
- **US2 (P1)**: Independent product behavior after foundation, but shares files with US1.
- **US3 (P1)**: Independent permission-priority behavior after foundation, but safest after US1/US2 introduced started-lock messaging.
- **US4 (P2)**: Independent non-body regression coverage after foundation, safest after `firestore.rules` started-lock branches exist.

### Within Each User Story

- Write and run story tests first; confirm they fail for the intended behavior.
- Implement rules/service/runtime/UI in disjoint file slices where possible.
- Do not mark a task complete until its focused tests pass and relevant changed-file gates are clean.
- Do not mark tasks `[P]` when they touch the same file or depend on incomplete work.

---

## Parallel Execution Examples

### After Foundation

Use subagents with disjoint write scopes and reviewer verification before marking complete:

```text
Subagent A: write T017 in tests/server/firestore/event-start-lock-rules.test.js, confirm red, then implement T018 in firestore.rules
Subagent B: write T011 in tests/unit/service/event-service.test.js, confirm red, then implement T019 in src/service/event-service.js
Subagent C: write T012 in tests/unit/runtime/event-runtime-helpers.test.js, confirm red, then implement T020 in src/runtime/events/event-runtime-helpers.js
Subagent D: write T013 in tests/unit/components/EventCardMenu.test.jsx, confirm red, then implement T024 in src/components/EventCardMenu.jsx
Subagent E: write T015 in tests/unit/runtime/useEventDetailMutations.test.jsx, confirm red, then implement T022 in src/runtime/hooks/useEventDetailMutations.js
Subagent F: write T016 in tests/unit/runtime/useEventMutations.test.jsx, confirm red, then implement T023 in src/runtime/hooks/useEventMutations.js
```

### User Story 1

```text
Run test tasks in parallel after T001-T010: T011, T012, T013, T014, T015, T016, plus T017 when the rules test fixture is ready.
Confirm each focused test is red for the intended reason before implementation.
Then run implementation in disjoint subagents: T018 after T017, T019 after T011, T020 after T012, T022 after T015, T023 after T016, and T024 after T013.
Finish with T021, T025, and T026 once service/helper/menu contracts are stable.
```

### User Story 2

```text
Run safe disjoint tests in parallel after foundation: T027 in tests/server/firestore/event-soft-delete-rules.test.js and T030 in tests/unit/components/EventDeleteConfirm.test.jsx.
Run T028, T029, and T031 after the US1 tests touching the same files are settled; they are not marked [P] because they share files with earlier story work.
Confirm red before implementation, then run T032 after T027 and T036 after T030.
Run T033, T034, T035, T037, T038, and T039 only after their same-file US1 edits are merged into the working diff.
```

### User Story 3

```text
Run T040, T041, T042, and T043 after same-file US1/US2 test edits are settled; they are not marked [P] because they extend shared rules, mutation, and menu test files.
Confirm red before implementation.
Then implement T044, T045, and T046 after their corresponding permission-priority tests are red.
Finish T047 after menu behavior from US1/US2 is implemented.
```

### User Story 4

```text
Run safe disjoint tests in parallel after foundation: T049, T050, T051, T053, and T054.
Run T048 after US1/US3 event-start-lock rules tests are settled, and run T052/T055 after earlier EventDetailScreen tests are settled.
Confirm red before implementation, then run T056 after T048, T057 after T051, T060 after T053, and T061 after T054.
Run T058 and T059 only after T052 and T055 are red because they share src/ui/events/EventDetailScreen.jsx.
```

---

## Verification Commands

Use targeted commands from `specs/101-lock-started-event-edits/quickstart.md`:

```bash
npx vitest run tests/unit/service/event-service.test.js tests/unit/components/EventCardMenu.test.jsx tests/unit/ui/events/EventDetailScreen.test.jsx tests/unit/runtime/useEventMutations.test.jsx tests/unit/runtime/useEventDetailMutations.test.jsx
firebase emulators:exec --only firestore --project demo-test "npx vitest run tests/server/firestore/event-start-lock-rules.test.js"
firebase emulators:exec --only firestore --project demo-test "npx vitest run tests/server/firestore/event-soft-delete-rules.test.js tests/server/firestore/event-comments-rules.test.js tests/server/firestore/event-favorites-rules.test.js"
npm run lint:changed
npm run type-check:changed
npm run depcruise
npm run build
```

Use active quality gates from `.codex/references/quality-gates.md` and `.codex/rules/sensors.md`:

```bash
npm run lint -- --max-warnings 0
npm run type-check
npm run depcruise
npm run spellcheck
git diff --check
```

Do not use disabled package scripts as behavior evidence: `npm run test`, `npm run test:server`, `npm run test:branch`, or `npm run test:e2e:emulator`.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete US1 tests, confirm they fail, then implement US1.
3. Validate US1 independently with the targeted unit/component/runtime/service command and the Firestore rules command.
4. Stop for reviewer verification before marking US1 complete.

### Incremental Delivery

1. Add US1 edit lock and validate it independently.
2. Add US2 delete lock and validate stale confirm and soft-delete rules independently.
3. Add US3 permission-priority regression and validate non-host behavior independently.
4. Add US4 non-body regression and validate join/leave counters, comment create/delete-own, favorite/unfavorite, share, and list/search/filter/sort independently.
5. Run Phase 7 verification before completion claims.

### Parallel Team Strategy

After foundation, maximize subagent usage by assigning one subagent per disjoint write scope: rules, service/helper, shared menu component, detail mutation hook, list mutation hook, detail screen, list screen, and participation regression. Do not let two subagents write the same file concurrently. Reviewer verification is required before any task is marked complete.

---

## Notes

- Authoritative started-lock enforcement belongs in firestore.rules using `request.time`.
- UI started-lock state is a hint only and must not add server round trips, polling, API routes, new time fields, cancel state, admin override, version history, or server-side menu fetches.
- Resulting event `time` must remain strictly greater than `request.time` on allowed host body updates.
- Permission checks must stay ahead of started-lock messaging for unauthenticated users and non-hosts.
- Participant counter updates from join/leave must remain outside the event body lock.
- Closeout boundaries are separate: this task list does not authorize staging, commit, push, PR, CI watch, merge, or local main sync.
