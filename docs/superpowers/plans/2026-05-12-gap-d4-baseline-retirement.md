# Gap D4 Baseline Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the current Gap D4 MVP lint baseline by removing the 14 known violations across the 10 baseline files and deleting the matching baseline ignores. The PR must not include `project-health/**`; the ignored local archive update happens separately in the original repo after final verification evidence exists.

**Architecture:** Keep the existing D4-MVP `no-restricted-syntax` gate shape and make the baseline files comply with it. Implementation is split into three independent UI cleanup slices followed by one integration/closeout slice; the main agent coordinates only, while Engineer subagents edit and Reviewer subagents verify each repo-changing slice.

**Tech Stack:** Next.js 15, React 19, JavaScript with JSDoc `checkJs`, ESLint 9 flat config, npm scripts `lint:changed` and `type-check:changed`.

---

## Tracked PR File Responsibility Map

- `src/components/Navbar/MobileDrawer.jsx`: Renders the mobile navigation drawer; remove JSX-time `NAV_ITEMS.map` block callback and conditional JSX prop spread by preparing drawer link elements before the returned JSX.
- `src/components/Navbar/Navbar.jsx`: Renders the desktop navigation list and shell; remove JSX-time `NAV_ITEMS.map` block callback and conditional JSX prop spread by preparing desktop link elements before the returned JSX.
- `src/components/PostCard.jsx`: Renders post content preview; move conditional class and handler preparation out of JSX props so the content wrapper receives named values.
- `src/components/CommentHistoryModal.jsx`: Renders current comment and edit history; remove JSX-time `reversedHistory.map` block callback by preparing history entry elements before the returned JSX.
- `src/components/EventRouteEditor.jsx`: Renders route editor status and map props; move route status branching and normalized route polyline prop preparation out of JSX.
- `src/components/RunCalendarDialog.jsx`: Renders calendar grid and month summary; remove JSX-time `gridCells.map` and nested `runs.map` block callbacks by preparing run entries and day cells before the returned JSX.
- `src/components/weather/FavoritesBar.jsx`: Renders favorite weather chips; remove JSX-time `favorites.map` block callback by preparing favorite chip elements before the returned JSX.
- `src/ui/events/EventsListSection.jsx`: Renders event cards and list state; remove JSX-time `events.map` from the list branch by preparing event card elements before the returned JSX.
- `src/ui/events/PaceSelector.jsx`: Renders pace minute/second selects; remove JSX-time option generation by preparing minute and second option elements before the returned JSX.
- `src/ui/events/ParticipantsModal.jsx`: Renders participant rows; prepare participant row elements before JSX so this baseline file no longer depends on JSX-time collection rendering.
- `eslint.config.mjs`: Owns the D4-MVP rule block; remove only the D4 baseline `ignores` list after all baseline files comply, keeping the rule selectors and messages intact.

## Local Archive Follow-up

- `project-health/2026-04-24-openai-harness-gap-analysis.md`: Ignored local
  archive, absent from this worktree, and not a PR-owned implementation file.
  After final verification evidence exists, a separate subagent updates this
  file in the original repo/local archive outside the PR.

## P3 Task Contract

- Profile/classification: P3 High-risk Fix/Refactor, C3/R3. The change spans multiple UI domains plus lint gate configuration, but does not add product functionality, dependencies, schema changes, security rules, migrations, or tracked project-health documentation.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-052-gap-d4-baseline-retirement`.
- Branch rule: do not work on `main`; this plan assumes the existing isolated worktree branch is used.
- Scope: clear only the current Gap D4 baseline files, remove only the matching D4-MVP baseline ignores, and keep the current D4-MVP gate shape.
- Non-scope: no stronger lint rules, no custom full JSX policy, no unrelated source cleanup, no broad component rewrites, no dependency changes, no package script changes, no spec changes, no project-health changes in the PR, no product behavior changes beyond preserving current behavior while satisfying the D4 gate.
- Owned files for this plan document task: `docs/superpowers/plans/2026-05-12-gap-d4-baseline-retirement.md`.
- Owned files for implementation tasks: each task lists its exact write set; Engineer subagents must not expand it.
- Read-only context for implementation: `AGENTS.md`, `docs/superpowers/workflow.md`, `docs/superpowers/task-profiles.md`, `docs/superpowers/specs/2026-05-12-gap-d4-baseline-retirement-design.md`, the D4-MVP section of `eslint.config.mjs`, the listed source files around the baseline lines, and `package.json` scripts only when checking verification commands.
- Acceptance criteria: all 10 baseline source files avoid the current D4 restricted JSX patterns, `eslint.config.mjs` has no D4 baseline ignores, `project-health/**` is absent from the PR diff, fresh verification commands pass, and Reviewer subagents confirm zero remaining D4 baseline violations.
- Verification command: `npx eslint src --no-error-on-unmatched-pattern`
  Expected signal: exit 0; no D4-MVP errors and no lint errors in `src`.
- Verification command: `npm run lint:changed`
  Expected signal: exit 0; changed-file lint gate passes.
- Verification command: `npm run type-check:changed`
  Expected signal: exit 0; changed-file type check reports no blocking errors.
- Verification command: `git diff --check`
  Expected signal: exit 0; no whitespace errors.
- Authorization boundary: current user request authorizes writing this plan file only. Future implementation authorization must be explicit and separate for edit, commit, push, PR creation, merge, and local `main` fast-forward. Do not stage, commit, push, create a PR, merge, or sync `main` from this plan task.
- Agent boundary: implementation must use Engineer subagents and Reviewer subagents. The main agent coordinates dispatch, checks status, and handles closeout only after reviewed evidence.

## Task 1: Nav/Shared Components

**Profile:** P3 slice under the approved Gap D4 baseline retirement.

**Owned files:**
- Modify: `src/components/Navbar/MobileDrawer.jsx`
- Modify: `src/components/Navbar/Navbar.jsx`
- Modify: `src/components/PostCard.jsx`

**Read-only context:**
- `docs/superpowers/specs/2026-05-12-gap-d4-baseline-retirement-design.md`
- `eslint.config.mjs` D4-MVP block
- `src/components/Navbar/MobileDrawer.jsx` around lines 62 and 73
- `src/components/Navbar/Navbar.jsx` around lines 57 and 65
- `src/components/PostCard.jsx` around line 299

**Non-scope:**
- Do not change `NAV_ITEMS`, `isActivePath`, auth behavior, drawer state hooks, notification behavior, routing, CSS modules, post truncation semantics, or any file outside this task write set.

- [ ] **Step 1: Engineer reads the exact D4 patterns in this slice**

  Inspect only the owned files and D4-MVP rule block. Identify these baseline patterns:

  ```text
  MobileDrawer: JSX contains a NAV_ITEMS map callback and conditional JSX prop spread.
  Navbar: JSX contains a NAV_ITEMS map callback and conditional JSX prop spread.
  PostCard: JSX prop className contains branching that builds wrapper class inline.
  ```

- [ ] **Step 2: Engineer refactors MobileDrawer without behavior changes**

  Expected pattern:

  ```jsx
  const drawerLinks = NAV_ITEMS.map((item) => {
    const active = isActivePath(pathname, item.href);
    const linkClass = active
      ? `${styles.drawerLink} ${styles.drawerLinkActive}`
      : styles.drawerLink;
    const ariaCurrent = active ? 'page' : undefined;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={linkClass}
        onClick={handleLinkClick}
        aria-current={ariaCurrent}
      >
        {item.label}
      </Link>
    );
  });
  ```

  Render with `{drawerLinks}` inside `.drawerLinks`. Do not leave the `NAV_ITEMS`
  map callback or conditional active-state prop spread inside returned JSX.

- [ ] **Step 3: Engineer refactors Navbar without behavior changes**

  Expected pattern:

  ```jsx
  const desktopLinks = NAV_ITEMS.map((item) => {
    const active = isActivePath(pathname, item.href);
    const linkClass = active ? `${styles.link} ${styles.linkActive}` : styles.link;
    const ariaCurrent = active ? 'page' : undefined;

    return (
      <li key={item.href}>
        <Link href={item.href} className={linkClass} aria-current={ariaCurrent}>
          {item.label}
        </Link>
      </li>
    );
  });
  ```

  Render with `{desktopLinks}` inside `.desktopLinks`. Preserve `hamburgerLabel`, `hamburgerClass`, user menu, notification panel, and mobile drawer props.

- [ ] **Step 4: Engineer refactors PostCard content wrapper props**

  Expected pattern:

  ```jsx
  const contentWrapperClassName = needsTruncation
    ? `${styles.contentWrapper}${isCollapsed ? ` ${styles.contentCollapsed}` : ''}`
    : undefined;
  const contentTransitionEnd = needsTruncation ? handleTransitionEnd : undefined;
  ```

  Use `className={contentWrapperClassName}` and `onTransitionEnd={contentTransitionEnd}` in JSX. Keep the current collapsed/expanded behavior and text.

- [ ] **Step 5: Engineer runs focused verification**

  Verification command: `npx eslint src/components/Navbar/MobileDrawer.jsx src/components/Navbar/Navbar.jsx src/components/PostCard.jsx --no-error-on-unmatched-pattern`
  Expected signal: exit 0; no lint errors for the changed files. This does not prove D4 removal while baseline ignores remain; Reviewer must inspect the diff for the removed patterns.

  Verification command: `npm run lint:changed`
  Expected signal: exit 0; changed-file lint gate passes.

  Verification command: `npm run type-check:changed`
  Expected signal: exit 0; changed-file type check passes.

  Verification command: `git diff --check`
  Expected signal: exit 0; no whitespace errors.

- [ ] **Step 6: Reviewer checks Task 1**

  PASS criteria:
  - Only the three owned files changed.
  - MobileDrawer and Navbar no longer render block-bodied `NAV_ITEMS.map` callbacks inside returned JSX.
  - MobileDrawer and Navbar no longer use conditional JSX prop spread for `aria-current`.
  - PostCard computes content wrapper class and transition handler before JSX.
  - User-visible labels, links, auth controls, drawer close behavior, and post expand behavior are preserved.
  - All Task 1 verification commands have fresh exit 0 evidence.

  REJECT criteria:
  - Any owned file still contains the listed D4 pattern.
  - Any unowned file changed.
  - Behavior, route targets, aria labels, auth controls, or CSS class names changed without necessity.
  - Verification is missing, stale, combined into one shell command, or failing.

- [ ] **Step 7: Commit checkpoint guidance**

  Do not commit until Reviewer PASS. After PASS and user authorization to commit, use an atomic checkpoint such as:

  ```bash
  git add src/components/Navbar/MobileDrawer.jsx src/components/Navbar/Navbar.jsx src/components/PostCard.jsx
  git commit -m "refactor: clear d4 nav shared baseline"
  ```

## Task 2: Dialog/Editor Components

**Profile:** P3 slice under the approved Gap D4 baseline retirement.

**Owned files:**
- Modify: `src/components/CommentHistoryModal.jsx`
- Modify: `src/components/EventRouteEditor.jsx`
- Modify: `src/components/RunCalendarDialog.jsx`
- Modify: `src/components/weather/FavoritesBar.jsx`

**Read-only context:**
- `docs/superpowers/specs/2026-05-12-gap-d4-baseline-retirement-design.md`
- `eslint.config.mjs` D4-MVP block
- `src/components/CommentHistoryModal.jsx` around line 59
- `src/components/EventRouteEditor.jsx` around line 125
- `src/components/RunCalendarDialog.jsx` around lines 150 and 164
- `src/components/weather/FavoritesBar.jsx` around line 41

**Non-scope:**
- Do not change modal open/close behavior, map drawing behavior, route normalization semantics, calendar summary math, weather favorite selection/removal behavior, CSS modules, or any file outside this task write set.

- [ ] **Step 1: Engineer reads the exact D4 patterns in this slice**

  Inspect only the owned files and D4-MVP rule block. Identify these baseline patterns:

  ```text
  CommentHistoryModal: JSX contains a reversedHistory map callback.
  EventRouteEditor: JSX contains nested route status branching and route prop preparation.
  RunCalendarDialog: JSX contains a gridCells map callback and a nested dayActivities.runs map callback.
  FavoritesBar: JSX contains a favorites map callback.
  ```

- [ ] **Step 2: Engineer refactors CommentHistoryModal history entries**

  Expected pattern:

  ```jsx
  const historyEntries = reversedHistory.map((entry, i) => {
    const isOriginal = i === reversedHistory.length - 1;

    return (
      <li key={entry.id || i} className={styles.entry}>
        <div className={styles.entryHeader}>
          {isOriginal && <span className={styles.badgeOriginal}>原始版本</span>}
          <time className={styles.entryTime}>{formatCommentTimeFull(entry.editedAt)}</time>
        </div>
        <p className={styles.entryContent}>{entry.content}</p>
      </li>
    );
  });
  ```

  Render `{historyEntries}` where the map used to be. Preserve ordering, fallback key behavior, and labels.

- [ ] **Step 3: Engineer refactors EventRouteEditor status and map props**

  Expected pattern:

  ```jsx
  const drawRouteStatusText = editedRouteCoordinates
    ? `路線已更新（${countTotalPoints(editedRouteCoordinates)} 點）`
    : !routeCleared && route
      ? `編輯既有路線（${route.pointsCount ?? '?'} 點）`
      : '請在地圖上繪製路線';
  const initialEncodedPolylines = routeCleared ? undefined : normalizeRoutePolylines(route);
  ```

  Use the prepared values in JSX. If the existing component can avoid the nested conditional more clearly with `if` statements before return, prefer:

  ```jsx
  let drawRouteStatusText = '請在地圖上繪製路線';
  if (editedRouteCoordinates) {
    drawRouteStatusText = `路線已更新（${countTotalPoints(editedRouteCoordinates)} 點）`;
  } else if (!routeCleared && route) {
    drawRouteStatusText = `編輯既有路線（${route.pointsCount ?? '?'} 點）`;
  }
  const initialEncodedPolylines = routeCleared ? undefined : normalizeRoutePolylines(route);
  ```

  Preserve the `routeMode === 'draw'` rendering branch and `EventMap` props.

- [ ] **Step 4: Engineer refactors RunCalendarDialog calendar cells**

  Expected pattern:

  ```jsx
  const renderRunEntry = (run) => {
    const Icon = getRunIcon(run.type);

    return (
      <div key={run.type} className={styles.runEntry}>
        <Icon size={12} />
        <span className={styles.runDistance}>{(run.totalMeters / 1000).toFixed(1)}</span>
      </div>
    );
  };

  const calendarCells = gridCells.map(({ key, day }) => {
    if (day === null) {
      return <div key={key} className={styles.dayCell} />;
    }

    const dayActivities = dayMap.get(day);
    const cellClass = dayActivities ? `${styles.dayCell} ${styles.dayActive}` : styles.dayCell;

    return (
      <div key={key} className={cellClass}>
        <span className={styles.dayNumber}>{day}</span>
        {dayActivities && dayActivities.runs.map(renderRunEntry)}
      </div>
    );
  });
  ```

  Render `{calendarCells}` inside `.grid`. The nested `runs.map` may remain inside the prepared `calendarCells` computation because it is outside returned JSX, but the callback must be a named function or otherwise avoid a block callback inside JSX.

- [ ] **Step 5: Engineer refactors FavoritesBar chips**

  Move the `favorites.map(...)` callback out of returned JSX into a prepared
  `favoriteChips` constant before the component return. For each favorite,
  keep the existing per-chip derived values near the map callback:
  `summary`, short location name, active-state boolean, active/default chip
  class, select handler, and remove handler.

  Transformation pattern:

  - Before: returned JSX contains the complete `favorites.map` callback
    expression, including derived chip values and the returned chip element.
  - After: the component body defines `const favoriteChips = favorites.map(...)`
    with the same callback body, and returned JSX contains only
    `{favoriteChips}` at the original list position.

  Replace only the outer JSX favorites map expression with `{favoriteChips}`.
  Do not redesign the chip UI. Invariants: the rendered
  element tree, keys, roles, class selection, `Image` usage, weather icon URL,
  temperature display, select button label, select callback argument, and remove
  callback id must remain behaviorally identical to the current source.

- [ ] **Step 6: Engineer runs focused verification**

  Verification command: `npx eslint src/components/CommentHistoryModal.jsx src/components/EventRouteEditor.jsx src/components/RunCalendarDialog.jsx src/components/weather/FavoritesBar.jsx --no-error-on-unmatched-pattern`
  Expected signal: exit 0; no lint errors for the changed files. This does not prove D4 removal while baseline ignores remain; Reviewer must inspect the diff for the removed patterns.

  Verification command: `npm run lint:changed`
  Expected signal: exit 0; changed-file lint gate passes.

  Verification command: `npm run type-check:changed`
  Expected signal: exit 0; changed-file type check passes.

  Verification command: `git diff --check`
  Expected signal: exit 0; no whitespace errors.

- [ ] **Step 7: Reviewer checks Task 2**

  PASS criteria:
  - Only the four owned files changed.
  - CommentHistoryModal no longer renders a block-bodied history `map` inside returned JSX.
  - EventRouteEditor prepares route status text and route polyline props before JSX, with route display text preserved.
  - RunCalendarDialog prepares calendar cells before JSX and preserves empty cells, active cell class, run icons, distances, and month summary.
  - FavoritesBar prepares favorite chips before JSX and preserves select/remove behavior, icon rendering, active styling, and labels.
  - All Task 2 verification commands have fresh exit 0 evidence.

  REJECT criteria:
  - Any listed D4 pattern remains in returned JSX.
  - Any unowned file changed.
  - UI labels, keys, aria labels, image props, route/map props, calendar math, or favorite callbacks changed unnecessarily.
  - Verification is missing, stale, combined into one shell command, or failing.

- [ ] **Step 8: Commit checkpoint guidance**

  Do not commit until Reviewer PASS. After PASS and user authorization to commit, use an atomic checkpoint such as:

  ```bash
  git add src/components/CommentHistoryModal.jsx src/components/EventRouteEditor.jsx src/components/RunCalendarDialog.jsx src/components/weather/FavoritesBar.jsx
  git commit -m "refactor: clear d4 dialog editor baseline"
  ```

## Task 3: Events UI Plus Gate

**Profile:** P3 slice under the approved Gap D4 baseline retirement.

**Owned files:**
- Modify: `src/ui/events/EventsListSection.jsx`
- Modify: `src/ui/events/PaceSelector.jsx`
- Modify: `src/ui/events/ParticipantsModal.jsx`
- Modify: `eslint.config.mjs`

**Read-only context:**
- `docs/superpowers/specs/2026-05-12-gap-d4-baseline-retirement-design.md`
- `eslint.config.mjs` D4-MVP block
- `src/ui/events/EventsListSection.jsx` around line 122
- `src/ui/events/PaceSelector.jsx` around lines 30 and 53
- `src/ui/events/ParticipantsModal.jsx` around line 101

**Non-scope:**
- Do not change event card behavior, filtering/loading semantics, event action callbacks, route labels, participant identity logic, pace field names, D4 rule selectors/messages, non-D4 ESLint rules, package scripts, or any file outside this task write set.

- [ ] **Step 1: Engineer reads the exact D4 patterns in this slice**

  Inspect only the owned files and D4-MVP rule block. Identify these baseline patterns:

  ```text
  EventsListSection: JSX list branch calls events.map(...) inside returned JSX.
  PaceSelector: JSX generates minute and second options from inline array construction and map callbacks.
  ParticipantsModal: JSX renders participant rows from participants.map(...) inside returned JSX.
  eslint.config.mjs: D4-MVP block has an ignores list for the 10 baseline source files.
  ```

- [ ] **Step 2: Engineer refactors EventsListSection event cards**

  Move the `events.map(...)` event-card rendering out of returned JSX into a
  prepared `eventCards` constant before the component return. Also prepare
  `const isEmptyEventsList = !isLoadingEvents && !isFiltering && events.length === 0;`
  before return.

  Transformation pattern:

  - Before: returned JSX owns the branch that either renders the empty-state
    message or calls the `events.map` callback for card wrappers.
  - After: the component body owns the `events.map(...)` card-wrapper
    computation, and returned JSX keeps the same empty-state branch while
    rendering `eventCards` for the non-empty branch.

  Replace only the returned-JSX branch that currently maps over `events` with
  a reference to `eventCards`. Do not redesign the event card UI. Invariants:
  the wrapper key, wrapper class, card/menu structure, metadata text, action
  button labels, route label rendering, pending-state behavior, membership
  status fallback, and all event callback arguments must remain behaviorally
  identical to the current source.

  In returned JSX, render:

  ```jsx
  {isEmptyEventsList ? (
    <div className={styles.emptyHint}>
      {isFilteredResults ? '沒有符合條件的活動' : '目前還沒有活動（先建立一筆看看）'}
    </div>
  ) : (
    eventCards
  )}
  ```

  Keep all current metadata fields, `Link` href, `UserLink`, `EventActionButtons`, `EventCardMenu`, `getRemainingSeats(event)`, `renderRouteLabel(event)`, and pending/membership lookup semantics.

- [ ] **Step 3: Engineer refactors PaceSelector options**

  Expected pattern:

  ```jsx
  const minuteOptions = Array.from({ length: 19 }, (_, index) => {
    const value = String(index + 2).padStart(2, '0');

    return (
      <option key={value} value={value}>
        {index + 2}
      </option>
    );
  });

  const secondOptions = Array.from({ length: 60 }, (_, seconds) => {
    const label = String(seconds).padStart(2, '0');

    return (
      <option key={seconds} value={label}>
        {label}
      </option>
    );
  });
  ```

  Render `{minuteOptions}` and `{secondOptions}` inside the existing selects. Preserve `name`, `id`, `required`, `defaultValue`, hidden disabled options, labels, and helper text.

- [ ] **Step 4: Engineer refactors ParticipantsModal rows**

  Expected pattern:

  ```jsx
  const participantRows = participants.map((participant) => {
    const participantUid = String(participant.uid || participant.id);
    const participantName = participant.name || '（未命名）';
    const participantStatus = participant.uid === hostUid ? '主揪' : '已參加';

    return (
      <div key={participantUid} className={styles.participantItem}>
        <UserLink
          uid={participantUid}
          name={participantName}
          photoURL={participant.photoURL}
          size={36}
          className={styles.participantLink}
        />
        <div className={styles.participantStatus}>{participantStatus}</div>
      </div>
    );
  });
  ```

  Render `{participantRows}` inside `.participantsList`. Preserve loading/error/empty branches and modal markup.

- [ ] **Step 5: Engineer removes only the D4 baseline ignores**

  In `eslint.config.mjs`, update the D4-MVP block from:

  ```js
  {
    files: ['src/**/*.{js,jsx}'],
    // D4-MVP baseline is 14 existing violations / 10 files; retire by cleaning those files, do not add new files.
    ignores: [
      'src/components/CommentHistoryModal.jsx',
      'src/components/EventRouteEditor.jsx',
      'src/components/Navbar/MobileDrawer.jsx',
      'src/components/Navbar/Navbar.jsx',
      'src/components/PostCard.jsx',
      'src/components/RunCalendarDialog.jsx',
      'src/components/weather/FavoritesBar.jsx',
      'src/ui/events/EventsListSection.jsx',
      'src/ui/events/PaceSelector.jsx',
      'src/ui/events/ParticipantsModal.jsx',
    ],
    rules: {
  ```

  To:

  ```js
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
  ```

  Keep the existing `no-restricted-syntax` selectors and messages unchanged.

- [ ] **Step 6: Engineer runs focused and full verification**

  Verification command: `npx eslint src/ui/events/EventsListSection.jsx src/ui/events/PaceSelector.jsx src/ui/events/ParticipantsModal.jsx --no-error-on-unmatched-pattern`
  Expected signal: exit 0; no lint errors for the changed events UI files.

  Verification command: `npx eslint src --no-error-on-unmatched-pattern`
  Expected signal: exit 0; after removing D4 ignores, no D4-MVP errors remain anywhere in `src`.

  Verification command: `npm run lint:changed`
  Expected signal: exit 0; changed-file lint gate passes.

  Verification command: `npm run type-check:changed`
  Expected signal: exit 0; changed-file type check passes.

  Verification command: `git diff --check`
  Expected signal: exit 0; no whitespace errors.

- [ ] **Step 7: Reviewer checks Task 3**

  PASS criteria:
  - Only the four owned files changed.
  - EventsListSection prepares event card elements before returned JSX and preserves empty/loading/filtering behavior.
  - PaceSelector prepares minute and second option elements before returned JSX and preserves submitted values.
  - ParticipantsModal prepares participant rows before returned JSX and preserves identity fallback, display name fallback, and host status label.
  - `eslint.config.mjs` removes only the D4 baseline comment and `ignores` list; D4 selectors/messages and other ESLint blocks are unchanged.
  - `project-health/**` is not present in the diff.
  - `npx eslint src --no-error-on-unmatched-pattern` has fresh exit 0 evidence after the ignores removal.

  REJECT criteria:
  - Any D4 baseline ignore remains in `eslint.config.mjs`.
  - Any listed source file still depends on the D4 baseline to pass.
  - Any unowned file changed.
  - Any `project-health/**` file is created or modified in the PR worktree.
  - Verification is missing, stale, combined into one shell command, or failing.

- [ ] **Step 8: Commit checkpoint guidance**

  Do not commit until Reviewer PASS. After PASS and user authorization to commit, use an atomic checkpoint such as:

  ```bash
  git add src/ui/events/EventsListSection.jsx src/ui/events/PaceSelector.jsx src/ui/events/ParticipantsModal.jsx eslint.config.mjs
  git commit -m "chore: retire d4 baseline gate"
  ```

## Task 4: Integration And Closeout

**Profile:** P3 integration gate for the approved Gap D4 baseline retirement.

**Owned files:**
- No new source edits unless a Reviewer rejects a prior task and dispatches back to that task's Engineer.
- Read changed-file list and task-local diffs only.

**Read-only context:**
- Reviewed Engineer evidence from Tasks 1-3
- Reviewer PASS/REJECT records from Tasks 1-3
- `git status --short --branch`
- `git diff --check`
- Exact D4-MVP block in `eslint.config.mjs`

**Non-scope:**
- Do not self-review as the main agent.
- Do not add new source changes during closeout.
- Do not stage, commit, push, open PR, merge, or sync local `main` without explicit user authorization for each boundary.

- [ ] **Step 1: Main agent confirms all slice reviews passed**

  Required evidence:

  ```text
  Task 1: Reviewer decision is PASS.
  Task 2: Reviewer decision is PASS.
  Task 3: Reviewer decision is PASS.
  ```

  If any task is rejected or blocked, dispatch back to the relevant Engineer subagent with the Reviewer evidence. Do not continue closeout.

- [ ] **Step 2: Main agent runs final verification one command at a time**

  Verification command: `npx eslint src --no-error-on-unmatched-pattern`
  Expected signal: exit 0; no D4-MVP errors and no lint errors in `src`.

  Verification command: `npm run lint:changed`
  Expected signal: exit 0; changed-file lint gate passes.

  Verification command: `npm run type-check:changed`
  Expected signal: exit 0; changed-file type check passes.

  Verification command: `git diff --check`
  Expected signal: exit 0; no whitespace errors.

  Verification command: `git status --short --branch`
  Expected signal: on the feature worktree branch, with only reviewed intended files modified before staging.

- [ ] **Step 3: Reviewer performs final integration check**

  PASS criteria:
  - The full diff contains only the approved baseline retirement files.
  - All 10 original D4 baseline source files are clean under the D4-MVP gate.
  - `eslint.config.mjs` has no D4 baseline `ignores` list and no replacement baseline mechanism.
  - `project-health/**` is absent from the PR diff.
  - Final verification commands have fresh exit 0 evidence, except `git status --short --branch`, which must show the expected branch and reviewed file set.

  REJECT criteria:
  - Any D4 baseline ignore remains.
  - Any unreviewed file is modified.
  - `project-health/**` appears in the PR diff.
  - Main agent made implementation edits instead of dispatching Engineer subagents.

- [ ] **Step 4: Dispatch local archive follow-up after final verification**

  After final verification evidence exists and before PR closeout summary, dispatch a separate subagent in the original repo/local archive context to update only the ignored file:

  ```text
  project-health/2026-04-24-openai-harness-gap-analysis.md
  ```

  Required archive facts:

  ```text
  Gap D4 MVP baseline retired: 0 remaining baseline violations across 0 baseline files.
  The D4-MVP ESLint gate now applies to src/**/*.{js,jsx} without baseline ignores.
  Remaining D4 work: none for the retired baseline; future D4 work requires a separate approved scope.
  ```

  This ignored archive update is not a PR file, not a Task 3 blocker, and must not be staged with the implementation branch.

- [ ] **Step 5: Commit, push, PR, CI, merge, and sync only after authorization**

  After final Reviewer PASS, ask for any missing authorization boundary. If authorized, close out in this order:

  ```bash
  git add src/components/Navbar/MobileDrawer.jsx src/components/Navbar/Navbar.jsx src/components/PostCard.jsx src/components/CommentHistoryModal.jsx src/components/EventRouteEditor.jsx src/components/RunCalendarDialog.jsx src/components/weather/FavoritesBar.jsx src/ui/events/EventsListSection.jsx src/ui/events/PaceSelector.jsx src/ui/events/ParticipantsModal.jsx eslint.config.mjs
  git commit -m "chore: retire gap d4 baseline"
  git push
  ```

  Then open a PR, wait for required `ci` and `e2e` to pass, merge on GitHub, and fast-forward local `main` only after merge completion and explicit authorization. If `gh` token is invalid, use the GitHub connector if available. If neither `gh` nor the GitHub connector can perform the GitHub operation, report blocked.

## Self-Review Checklist For This Plan

- The plan starts with the required writing-plans header.
- The scope matches `docs/superpowers/specs/2026-05-12-gap-d4-baseline-retirement-design.md`: one-shot retirement, 10 baseline files, D4 ignores removal, no project-health changes in the PR, no stronger lint policy.
- Each implementation slice has exact owned files, non-scope, Engineer instructions, verification commands, Reviewer PASS/REJECT criteria, and commit checkpoint guidance.
- Verification commands are listed one command per evidence item with expected signals.
- The plan records the known fact that the project-health archive is ignored and absent from this worktree, keeps it out of PR-owned files, and routes the local archive update to a separate follow-up after final verification.
