# Member Page Redesign Tasks

## Compact Guard

- This file is the human-readable task source of truth for `specs/member-page-redesign/`.
- On resume, read `AGENTS.md`, `docs/superpowers/workflow.md`, `specs/member-page-redesign/handoff.md`, this file, `specs/member-page-redesign/status.json`, `specs/member-page-redesign/spec.md`, and `specs/member-page-redesign/plan.md` before dispatching work.
- Main agent is control plane only. Repo-changing product edits belong to Engineer subagents. Reviewer subagents check every non-read-only task slice before completion.
- Current implementation authorization allows product implementation edits through Engineer/Reviewer subagents and commit when appropriate. It does not authorize push, PR creation, CI watch, merge, local `main` sync, or Firestore/storage rules deploy.
- If this file, `status.json`, and `handoff.md` disagree, reconcile or block before dispatch, commit, push, PR, merge, or local `main` sync.
- A task can become `completed` only after `review_passed` and coordinator state sync.
- Command evidence is one command per entry. Do not combine commands with `&&` or `;`.
- New `status.json` state uses schemaVersion 3 and records `currentHead`, `remoteHead`, `lastVerifiedCommit`, `phaseCommits`, `rulesDeployStatus`, and `incidents`.
- Final summaries must not imply deployed Firestore/storage rules, deployed functions, or production product behavior.

## Team And Parallelism

- Profile: P4 full feature/program.
- Branch/worktree: `/Users/chentzuyu/Desktop/dive-into-run-082-member-page-redesign` on branch `082-member-page-redesign`.
- Default staffing: one Engineer and one Reviewer per task.
- Same-wave parallelism is allowed only for `T002` and `T003` after `T001` passes review, because their owned files are disjoint.
- Recommended maximum in this shared worktree: two same-wave lanes.

## Planner Output

- Dependency graph:
  - Explicit product-code implementation authorization precedes T001 and is satisfied by user authorization evidence before implementation dispatch.
  - T001 precedes T002.
  - T001 precedes T003.
  - T002 and T003 precede T004.
- Parallel waves:
  - `wave-1`: T001.
  - `wave-2`: T002 and T003 may run in parallel after T001 is `review_passed`.
  - `wave-3`: T004 after T002 and T003 are `review_passed`.
- Final integration gate:
  - `npm run lint:changed`: exit 0 with no changed-file lint errors.
  - `npm run type-check:changed`: exit 0 with no changed-file type errors.
  - `npm run depcruise`: exit 0 with no dependency-direction violations when imports or component boundaries changed.
  - Desktop `/member` browser evidence at 1440 by 1000: two columns, no overlap, no visible `這是會員頁面`, no in-page Nav duplicate, all required features present.
  - Mobile `/member` browser evidence at 390 by 844: single-column order is profile/account controls, Bio, dashboard tabs, Danger Zone, with no duplicated interactive sections.
  - `node scripts/validate-workflow-state.js specs/member-page-redesign/status.json`: exit 0 and `WORKFLOW STATE: 1 status file(s) valid`.
  - `node scripts/check-superpowers-state.js specs/member-page-redesign/status.json`: exit 0 and `SUPERPOWERS CHECK: 1 status file(s) synced`.

## Common Non-Scope For Product Tasks

- Do not redesign `/member/favorites`; only preserve the existing `我的收藏` link to `/member/favorites`.
- Do not add Nav inside `/member`.
- Do not change auth redirects, data fetching, server actions, service calls, repo calls, dashboard pagination logic, account deletion logic, Firestore/storage rules, schemas, migrations, dependencies, or deploy behavior.
- Do not change `src/app/member/page.jsx` unless the coordinator updates this plan with explicit owned-file authorization.
- Do not touch runtime hooks unless a task stops and the coordinator approves a narrow plan amendment.
- Do not fix the pre-existing dashboard comment title-cache collision risk.
- Do not change Bio validation/counting semantics.

## Common Reviewer Criteria

- PASS requires the diff to touch only task-owned files, preserve stated non-scope, satisfy all task acceptance criteria, and include fresh command/browser evidence.
- PASS requires no command evidence row to contain `&&` or `;`.
- PASS requires no final claim of deployed rules, deployed functions, or production product behavior.
- REJECT if behavior changes outside `/member`, if `/member/favorites` is modified, if Nav is added inside the page, if runtime/service/repo logic changes without a coordinator-approved plan update, or if required verification is missing or stale.
- BLOCK instead of rejecting when the implementation needs files outside the owned write set, new dependencies, schema/rules/deploy work, destructive actions, secrets, or a decision from the user.

## Tasks

### T001 - Member Page Shell And Profile Controls

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-1`
- **Engineer**: Engineer subagent, render/CSS task
- **Reviewer**: Reviewer subagent, UI behavior and boundary check
- **Commit checkpoint**: no per-task commit until Reviewer PASS and coordinator approval
- **Last verified commit**: none; final T001 commit SHA is created after this state update and reported by the commit subagent.
- **Authorization boundary**: product implementation tasks through Engineer/Reviewer subagents edit=yes, commit=yes; push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable, not required, unchanged
- **Incidents**: none

Scope:

- Remove the visible `這是會員頁面` text from `/member` without replacing it with another page title.
- Convert `MemberPageScreen` into the page-level workspace shell with profile/account controls, Bio slot, dashboard slot, and Danger Zone slot.
- Create page-scoped CSS module tokens and layout for warm off-white background, deep green foreground, muted green-gray labels, yellow primary action, subtle blue/green accents, 8px cards, thin borders, and mono labels.
- Implement desktop two-column layout: left column profile/account controls, Bio, Danger Zone; right column dashboard tabs.
- Implement mobile source and visual order: profile/account controls, Bio, dashboard tabs, Danger Zone.
- Preserve avatar image click calling `triggerFilePicker`, hidden `image/*` input, `inputFileRef`, `onAvatarFileChange`, display-name controlled input, and `onSubmitNewName`.
- Preserve `查看我的公開檔案` visibility only when `user.uid` exists and destination `/users/{uid}`.
- Preserve `我的收藏` visibility only when `user.uid` exists, exact label `我的收藏`, and destination `/member/favorites`.

Non-scope:

- Do not edit `src/app/member/page.jsx`.
- Do not edit Bio editor, Dashboard tabs, Danger Zone, runtime, service, repo, or rules files.
- Do not add page-level Nav, large marketing H1, landing hero, decorative runner scene, footer CTA, or floating decorative cards.
- Do not duplicate Danger Zone markup to satisfy responsive ordering.

Owned files:

- `src/ui/member/MemberPageScreen.jsx`
- `src/ui/member/MemberPageScreen.module.css`

Read-only context:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-profiles.md`
- `specs/member-page-redesign/spec.md`
- `specs/member-page-redesign/plan.md`
- `src/app/member/page.jsx`
- `src/runtime/hooks/useMemberPageRuntime.js`
- `src/app/member/BioEditor.jsx`
- `src/ui/member/AccountDeletionDangerZone.jsx`
- `src/components/DashboardTabs.jsx`
- `src/ui/home/HomePage.module.css`
- `src/ui/users/ProfileScreen.module.css`

Dependencies:

- Satisfied: explicit user authorization for product-code implementation through Engineer/Reviewer subagents is recorded by the coordinator before T001 dispatch.

Browser evidence:

- Required during task review if a dev server is available; otherwise T004 must cover it.
- Target route: `/member`.
- Desktop viewport: 1440 by 1000.
- Mobile viewport: 390 by 844.
- Expected signal: page text `這是會員頁面` absent; no in-page Nav; profile/account controls, Bio, dashboard tabs, and Danger Zone appear once; desktop and mobile order match spec; avatar click opens file input; links point to `/users/{uid}` and `/member/favorites` when UID exists; no overlap in long text controls.
- Suggested screenshot artifacts: `/tmp/member-page-redesign-T001-desktop.png` and `/tmp/member-page-redesign-T001-mobile.png`.

Engineer instructions:

- Add `import styles from './MemberPageScreen.module.css';` to `MemberPageScreen.jsx`.
- Use semantic sections and class names from the new CSS module; do not introduce data fetching or local behavior state.
- Keep the hidden file input in the same profile controls section as the clickable avatar.
- Use the existing runtime values and handlers exactly; do not rename runtime properties.
- Make the display-name submit button visually primary but do not alter submit/no-op logic in runtime.
- Gate both links on `user?.uid`, not just `user`.
- Use one markup instance for each slot: `bioEditor`, `dashboardTabs`, and `accountDeletionDangerZone`.
- Modify only the owned files above.

Acceptance criteria:

- AC-T001.1: `/member` no longer renders visible text `這是會員頁面`.
- AC-T001.2: No Nav is added inside the page.
- AC-T001.3: Desktop layout has the approved left and right columns.
- AC-T001.4: Mobile layout source and visual order matches the approved sequence.
- AC-T001.5: Avatar click, hidden file input, display-name form, public profile link, and `我的收藏` link preserve their current wiring and visibility rules.
- AC-T001.6: Page visual language uses utility-light homepage cues without copying homepage hero/decorative/CTA patterns.
- AC-T001.7: Long display names, emails, links, and button labels wrap or truncate without overlapping adjacent controls.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npm run lint:changed` | Exit 0 with no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0 with no changed-file type errors. |
| `npm run depcruise` | Exit 0 with no dependency-direction violations after adding the CSS module import. |

Reviewer PASS criteria:

- Diff touches only `src/ui/member/MemberPageScreen.jsx` and `src/ui/member/MemberPageScreen.module.css`.
- Required commands pass, or any missing browser evidence is explicitly deferred to T004 with a reason.
- JSX still composes existing slots and runtime handlers without adding data fetching or state.
- Link visibility and destinations match the spec.
- Responsive order is achieved without duplicate interactive Danger Zone or dashboard markup.

Reviewer REJECT criteria:

- `這是會員頁面` remains visible or is replaced by another page title.
- Avatar upload, display-name form, public profile link, or `我的收藏` link wiring changes behavior.
- Nav, marketing hero, decorative scene, or floating-card composition appears inside `/member`.
- Diff touches non-owned files or changes runtime/service/repo behavior.

Evidence:

- Engineer report: DONE_WITH_CONCERNS originally due missing dependencies; after setup, implemented a render-only member workspace shell, removed visible `這是會員頁面`, added no title/Nav, arranged desktop left profile/Bio/Danger plus right dashboard, arranged mobile profile -> Bio -> dashboard -> Danger, and preserved avatar input/ref/change, display-name form, public profile link, and exact `我的收藏` link.
- Reviewer decision: `review_passed`; Spec reviewer and code quality reviewer both passed with no findings; browser QA is deferred to T004.
- Reviewer report: review_passed. Spec reviewer found no findings and accepted browser QA deferral to T004. Code quality reviewer found no findings and accepted browser QA deferral to T004.
- Command output summary:
  - Setup/verifier: `npm install` exit 0 because `node_modules` was missing; no tracked lockfile/source changes.
  - `npm run lint:changed` exit 0; only React version warning.
  - `npm run type-check:changed` exit 0; no type errors in changed files.
  - `npm run depcruise` exit 0; no dependency violations; Node MODULE_TYPELESS_PACKAGE_JSON warning only.
  - `node scripts/validate-workflow-state.js specs/member-page-redesign/status.json` exit 0; `specs/member-page-redesign/status.json: ok`; `WORKFLOW STATE: 1 status file(s) valid`.
  - `node scripts/check-superpowers-state.js specs/member-page-redesign/status.json` exit 0; `specs/member-page-redesign/status.json: sync ok`; `SUPERPOWERS CHECK: 1 status file(s) synced`.
  - `git diff --check -- src/ui/member/MemberPageScreen.jsx src/ui/member/MemberPageScreen.module.css specs/member-page-redesign/tasks.md specs/member-page-redesign/handoff.md specs/member-page-redesign/status.json` exit 0; no whitespace errors.
- Changed files summary:
  - `src/ui/member/MemberPageScreen.jsx`: renders the member workspace shell/profile controls with CSS module classes; removes visible `這是會員頁面`; preserves avatar input/ref/change, display-name form, public profile link, and exact `我的收藏` link.
  - `src/ui/member/MemberPageScreen.module.css`: adds page-scoped warm off-white/deep green/yellow/blue tokens, 8px panels, desktop left/right grid, mobile profile/Bio/dashboard/Danger order, focus states, and wrapping/truncation safeguards.
  - `specs/member-page-redesign/tasks.md`: records T001 completion, Engineer evidence, Reviewer PASS evidence, command summaries, and changed-file summary.
  - `specs/member-page-redesign/handoff.md`: updates current state, latest reviewer decision, latest verification, and next action for wave-2 dispatch.
  - `specs/member-page-redesign/status.json`: syncs machine-readable T001 completion, reviewer decision, evidence, completedTasks, active task/wave, and latest verification.
- Phase commits: final T001 commit SHA is reported after commit creation; exact SHA is not embedded here to avoid a self-referential commit hash loop.
- Rules deploy status: not_applicable, not required, unchanged.
- Incidents: none.

### T002 - Bio Editor And Danger Zone Styling Alignment

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Engineer subagent, CSS-only task
- **Reviewer**: Reviewer subagent, behavior-preservation check
- **Commit checkpoint**: no per-task commit until Reviewer PASS and coordinator approval
- **Last verified commit**: none; final T002 commit SHA is created after this state update and reported by the commit subagent.
- **Authorization boundary**: product implementation tasks through Engineer/Reviewer subagents edit=yes, commit=yes; push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable, not required, unchanged
- **Incidents**: none

Scope:

- Align `BioEditor` styling with member workspace tokens, 8px card radius, thin borders, focus-visible states, stable textarea/footer/button dimensions, and muted mono labels where appropriate.
- Align Danger Zone styling with the same utility-light workspace while preserving its destructive emphasis.
- Improve modal fit and button wrapping on mobile without changing modal copy, role, ARIA attributes, actions, disabled behavior, or error display.

Non-scope:

- Do not edit `BioEditor.jsx` or `AccountDeletionDangerZone.jsx`.
- Do not change Bio labels, 150-character count, `儲存簡介`, `儲存中…`, `已儲存`, error behavior, code-point counting, or service calls.
- Do not change Danger Zone copy, `刪除帳號`, modal actions, `取消`, `重新驗證並刪除`, `處理中...`, Google reauthentication, deletion API flow, or runtime state.
- Do not edit MemberPageScreen or dashboard files.

Owned files:

- `src/app/member/BioEditor.module.css`
- `src/ui/member/AccountDeletionDangerZone.module.css`

Read-only context:

- `specs/member-page-redesign/spec.md`
- `specs/member-page-redesign/plan.md`
- `src/app/member/BioEditor.jsx`
- `src/ui/member/AccountDeletionDangerZone.jsx`
- `src/ui/member/MemberPageScreen.module.css`
- `src/ui/home/HomePage.module.css`

Dependencies:

- T001 `review_passed`.

Browser evidence:

- Required during task review if a dev server is available; otherwise T004 must cover it.
- Target route: `/member`.
- Viewports: 1440 by 1000 and 390 by 844.
- Expected signal: Bio editor labels, count, save states, success, and errors remain visible; Danger Zone appears left column on desktop and last on mobile; modal keeps title association and actions visible without overflow.
- Suggested screenshot artifacts: `/tmp/member-page-redesign-T002-bio-danger-desktop.png` and `/tmp/member-page-redesign-T002-bio-danger-mobile.png`.

Engineer instructions:

- Make CSS-only changes.
- Consume inherited member CSS variables from T001 with fallback values so the components remain usable if rendered outside the member shell.
- Add or refine `:focus-visible` styles for textarea and buttons.
- Ensure buttons have stable min-height and text does not overflow at mobile width.
- Keep modal backdrop and dialog accessible and usable on short viewports.
- Modify only the owned files above.

Acceptance criteria:

- AC-T002.1: Bio editor keeps all current labels, count, save states, success, and error behavior.
- AC-T002.2: Bio editor visually matches the member workspace without card nesting or layout shift from status messages.
- AC-T002.3: Danger Zone keeps current copy, modal semantics, actions, disabled states, and error display.
- AC-T002.4: Danger Zone destructive styling is clear but restrained and does not dominate the workspace.
- AC-T002.5: Mobile button rows and modal content wrap cleanly without overlapping text.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npm run lint:changed` | Exit 0 with no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0 with no changed-file type errors. |

Reviewer PASS criteria:

- Diff touches only the two owned CSS module files.
- No JSX, runtime, service, repo, rules, or dependency files changed.
- Browser or reviewer inspection confirms Bio and Danger Zone behavior surfaces are still present and readable.
- Mobile modal and action row fit within the viewport.

Reviewer REJECT criteria:

- Any behavior component file changes without coordinator approval.
- Bio state text, count, button labels, error/success behavior, or Danger Zone copy/actions are changed.
- CSS creates nested-card appearance, overlapping text, or unstable button/control dimensions.

Evidence:

- Engineer report: DONE. CSS-only changes to `BioEditor.module.css` and `AccountDeletionDangerZone.module.css`. Bio editor consumes `--member-*` token fallbacks, uses 8px radius, thin border, no shadow, textarea/button `:focus-visible`, stable footer/button min-height/mobile wrapping, and reserved success/error line to avoid layout shift. Danger Zone uses restrained destructive styling, 44px min-height buttons, wrapping, modal max-height/overflow-y, and mobile full-width buttons.
- Reviewer decision: `review_passed`; Spec reviewer confirmed the diff only touches owned CSS, JSX/runtime are untouched, copy/actions are unchanged, and browser evidence is deferred to T004. Code quality reviewer passed scoped maintainable CSS with no global leakage and accepted the focus-visible, button, modal, and wrapping choices; browser evidence is deferred to T004.
- Reviewer report: review_passed. Spec reviewer and code quality reviewer both passed with no findings requiring changes; browser QA remains deferred to T004.
- Command output summary:
  - `npm run lint:changed` exit 0; no changed JS files to lint.
  - `npm run type-check:changed` exit 0; no changed JS files to check.
  - `node scripts/validate-workflow-state.js specs/member-page-redesign/status.json` exit 0; `specs/member-page-redesign/status.json: ok`; `WORKFLOW STATE: 1 status file(s) valid`.
  - `node scripts/check-superpowers-state.js specs/member-page-redesign/status.json` exit 0; `specs/member-page-redesign/status.json: sync ok`; `SUPERPOWERS CHECK: 1 status file(s) synced`.
  - `npm run workflow:check` exit 0; `WORKFLOW STATE: 13 status file(s) valid`; `SUPERPOWERS CHECK: 13 status file(s) synced`.
  - `git diff --check -- src/app/member/BioEditor.module.css src/ui/member/AccountDeletionDangerZone.module.css specs/member-page-redesign/tasks.md specs/member-page-redesign/handoff.md specs/member-page-redesign/status.json` exit 0; no whitespace errors.
- Changed files summary:
  - `src/app/member/BioEditor.module.css`: aligns Bio editor with inherited member token fallbacks, 8px radius, thin border, no shadow, focus-visible states, stable footer/button sizing, mobile wrapping, and reserved success/error status space.
  - `src/ui/member/AccountDeletionDangerZone.module.css`: aligns Danger Zone with restrained destructive member styling, stable 44px buttons, wrapping, focus-visible states, scrollable modal, and mobile full-width actions.
  - `specs/member-page-redesign/tasks.md`: records T002 completion, Engineer evidence, Reviewer PASS evidence, command summaries, and changed-file summary.
  - `specs/member-page-redesign/handoff.md`: updates current state, latest reviewer decision, latest verification, and next action for T003 dispatch.
  - `specs/member-page-redesign/status.json`: syncs machine-readable T002 completion, reviewer decision, completedTasks, active task/wave, and latest verification.
- Phase commits: final T002 commit SHA is `7ec7cc584801548ece85218cb4e3bb49898cc0ed` (`Align member bio danger styling`).
- Rules deploy status: not_applicable.
- Incidents: none.

### T003 - Dashboard Tabs And Responsive Panel Fit

- **State**: `completed`
- **Attempt**: 1
- **Wave**: `wave-2`
- **Engineer**: Engineer subagent, render/CSS dashboard task
- **Reviewer**: Reviewer subagent, ARIA and keyboard behavior check
- **Commit checkpoint**: no per-task commit until Reviewer PASS and coordinator approval
- **Last verified commit**: none; current head captures the pre-commit T003 state, and final T003 commit SHA is reported by the commit subagent after commit creation.
- **Authorization boundary**: product implementation tasks through Engineer/Reviewer subagents edit=yes, commit=yes; push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable, not required, unchanged
- **Incidents**: none

Scope:

- Refine dashboard tab/panel presentation so it fits the right desktop column and mobile single-column layout.
- Preserve tab labels `我的活動`, `我的文章`, and `我的留言`.
- Preserve click selection and ArrowLeft, ArrowRight, Home, and End keyboard behavior.
- Preserve `tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, and active-tab `tabIndex`.
- Preserve initial loading, first-load failure with retry, per-tab empty copy, infinite-scroll loading, load-more error with retry, sentinel, and `已顯示全部`.
- Preserve card data and links by leaving dashboard card components untouched unless a coordinator-approved plan amendment names exact owned card files.

Non-scope:

- Do not edit `DashboardTabs.jsx`.
- Do not edit `useDashboardTabsRuntime.js`, `useDashboardTab.js`, member dashboard services, card data mapping, pagination logic, or fetch behavior.
- Do not edit `DashboardEventCard`, `DashboardPostCard`, `DashboardCommentCard`, or their CSS unless the task blocks and the coordinator expands owned files explicitly.
- Do not edit MemberPageScreen, Bio, or Danger Zone files.

Owned files:

- `src/ui/member/DashboardTabsScreen.jsx`
- `src/components/DashboardTabs.module.css`

Read-only context:

- `specs/member-page-redesign/spec.md`
- `specs/member-page-redesign/plan.md`
- `src/components/DashboardTabs.jsx`
- `src/ui/member/DashboardTabsScreen.jsx`
- `src/components/DashboardTabs.module.css`
- `src/runtime/hooks/useDashboardTabsRuntime.js`
- `src/runtime/hooks/useDashboardTab.js`
- `src/ui/member/MemberPageScreen.module.css`
- `src/ui/home/HomePage.module.css`

Dependencies:

- T001 `review_passed`.

Browser evidence:

- Required during task review if a dev server is available; otherwise T004 must cover it.
- Target route: `/member`.
- Viewports: 1440 by 1000 and 390 by 844.
- Expected signal: tabs fit without overflow; active and inactive tabs are visually distinct; keyboard navigation focuses/selects the expected tab; panel states remain reachable; list cards do not squeeze below readable widths.
- Suggested screenshot artifacts: `/tmp/member-page-redesign-T003-dashboard-desktop.png` and `/tmp/member-page-redesign-T003-dashboard-mobile.png`.

Engineer instructions:

- Prefer CSS changes. Change `DashboardTabsScreen.jsx` only for render-only wrappers or class names needed for layout/state styling.
- Keep the existing `onClick`, `onKeyDown`, `tabIndex`, roles, IDs, and ARIA attributes intact.
- Keep inactive panels hidden with the current active-tab condition unless a render-only equivalent preserves the same semantics.
- Keep the sentinel div bound to `sentinelRef` mounted inside the active non-empty panel after rendered items.
- Style retry buttons, loading, empty, load-more error, and end hint states consistently with member tokens.
- If dashboard card CSS is needed for readable widths, stop and report exact files required; do not edit unowned card files.
- Modify only the owned files above.

Acceptance criteria:

- AC-T003.1: Dashboard tab labels and keyboard/click behavior remain equivalent.
- AC-T003.2: ARIA roles and relationships remain intact.
- AC-T003.3: Loading, first-load error with retry, empty, load-more loading, load-more error with retry, sentinel, and `已顯示全部` states remain rendered through the same runtime data.
- AC-T003.4: Activity, post, and comment card data, links, badges, metadata, and text content remain untouched.
- AC-T003.5: Dashboard fits the desktop right column and mobile column without overlapping labels, buttons, or status text.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npm run lint:changed` | Exit 0 with no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0 with no changed-file type errors. |
| `npm run depcruise` | Exit 0 with no dependency-direction violations if `DashboardTabsScreen.jsx` imports change. |

Reviewer PASS criteria:

- Diff touches only `src/ui/member/DashboardTabsScreen.jsx` and `src/components/DashboardTabs.module.css`.
- Runtime hooks, services, DashboardTabs entry, and card components remain unchanged.
- Reviewer verifies keyboard behavior or receives credible browser evidence for ArrowLeft, ArrowRight, Home, and End.
- Sentinel and all panel states remain represented in the active panel.

Reviewer REJECT criteria:

- ARIA/tab behavior regresses or keyboard behavior is unsupported by evidence.
- Card data, links, badges, counts, pagination, or retry behavior changes.
- CSS causes tab labels or panel content to overlap at desktop or mobile widths.
- Engineer edits unowned card/runtime/service files.

Evidence:

- Engineer report: DONE. CSS-only changes to `DashboardTabs.module.css`. Added stable 3-column tab bar, active/inactive/focus states, panel width constraints, and mobile padding/button fit. Loading, empty, error, retry, loading-more, and end-hint states use member token fallbacks plus wrap/min-width guards. `DashboardTabsScreen.jsx`, runtime hooks, card components, card data, and links were untouched.
- Reviewer decision: `review_passed`; Spec reviewer confirmed only `DashboardTabs.module.css` was modified, runtime/JSX/hooks were untouched, and browser evidence is deferred to T004. Code quality reviewer passed the scoped maintainable CSS with token fallbacks, min-width/wrapping/focus states, no negative letter-spacing, and no viewport font scaling; browser evidence is deferred to T004.
- Reviewer report: review_passed. Spec reviewer and code quality reviewer both passed with no findings requiring changes; browser QA remains deferred to T004 integration verification.
- Command output summary:
  - `npm run lint:changed` exit 0; no changed JS files to lint.
  - `npm run type-check:changed` exit 0; no changed JS files to check.
  - `npm run depcruise` exit 0; no dependency violations; Node MODULE_TYPELESS_PACKAGE_JSON warning only.
  - `node scripts/validate-workflow-state.js specs/member-page-redesign/status.json` exit 0; `specs/member-page-redesign/status.json: ok`; `WORKFLOW STATE: 1 status file(s) valid`.
  - `node scripts/check-superpowers-state.js specs/member-page-redesign/status.json` exit 0; `specs/member-page-redesign/status.json: sync ok`; `SUPERPOWERS CHECK: 1 status file(s) synced`.
  - `npm run workflow:check` exit 0; `WORKFLOW STATE: 13 status file(s) valid`; `SUPERPOWERS CHECK: 13 status file(s) synced`.
  - `git diff --check -- src/components/DashboardTabs.module.css specs/member-page-redesign/tasks.md specs/member-page-redesign/handoff.md specs/member-page-redesign/status.json` exit 0; no whitespace errors.
- Changed files summary:
  - `src/components/DashboardTabs.module.css`: adds member token fallbacks, stable 3-column tabs, active/inactive/focus states, panel constraints, responsive padding, status-state styling, and wrap/min-width guards.
  - `specs/member-page-redesign/tasks.md`: records T003 completion, Engineer evidence, Reviewer PASS evidence, command summaries, and changed-file summary.
  - `specs/member-page-redesign/handoff.md`: updates current state, latest reviewer decision, latest verification, and next action for T004 dispatch.
  - `specs/member-page-redesign/status.json`: syncs machine-readable T003 completion, reviewer decision, completedTasks, active task/wave, and latest verification.
- Phase commits: final T003 commit SHA is reported after commit creation; exact SHA is not embedded here to avoid a self-referential commit hash loop.
- Rules deploy status: not_applicable.
- Incidents: none.

### T004 - Integration Verification And Workflow Evidence

- **State**: `in_progress`
- **Attempt**: 1
- **Wave**: `wave-3`
- **Engineer**: Verifier subagent, integration evidence task
- **Reviewer**: Reviewer subagent, final integration gate check
- **Commit checkpoint**: implementation phase commit only after all prior tasks are `completed`, T004 passes review, and coordinator has commit authorization
- **Last verified commit**: none
- **Authorization boundary**: product implementation tasks through Engineer/Reviewer subagents edit=yes, commit=yes; push=no, pullRequest=no, ciWatch=no, merge=no, localMainSync=no, deployFirestoreRules=no
- **Rules deploy status**: not_applicable, not required, unchanged
- **Incidents**: none

Scope:

- Run the final automated gates and browser QA for the integrated `/member` redesign.
- Record evidence in workflow state files after implementation tasks pass review.
- Confirm no product behavior outside `/member` changed and `/member/favorites` remains untouched.
- Confirm no Firestore/storage rules, schema, dependency, runtime/service/repo logic, or deploy behavior changed.

Non-scope:

- Do not edit product code by default.
- Do not fix implementation findings inside T004 unless the coordinator updates owned files and re-dispatches a narrow Engineer task.
- Do not push, open a PR, watch CI, merge, sync local `main`, or deploy rules.

Owned files:

- `specs/member-page-redesign/tasks.md`
- `specs/member-page-redesign/handoff.md`
- `specs/member-page-redesign/status.json`

Read-only context:

- `AGENTS.md`
- `docs/superpowers/workflow.md`
- `docs/superpowers/task-profiles.md`
- `docs/superpowers/task-contract.md`
- `specs/member-page-redesign/spec.md`
- `specs/member-page-redesign/plan.md`
- `specs/member-page-redesign/tasks.md`
- `specs/member-page-redesign/handoff.md`
- `specs/member-page-redesign/status.json`
- Task-local diffs and exact Engineer/Reviewer evidence for T001, T002, and T003.

Dependencies:

- T002 `review_passed`.
- T003 `review_passed`.

Browser evidence:

- Required.
- Start or reuse a local dev server for `/member`; if no server is running, use `npm run dev` as a long-running session and report the local URL.
- Desktop viewport: 1440 by 1000.
- Mobile viewport: 390 by 844.
- Required journey: load `/member`, inspect layout/order, click avatar to confirm file chooser trigger, verify public profile and `我的收藏` links, submit display-name no-op/disabled condition when possible without changing data, switch dashboard tabs by click and keyboard, inspect loading/empty/error states when reproducible, open and close Danger Zone modal without confirming deletion.
- Expected signal: no overlapping text, no missing functionality, two-column desktop, single-column mobile, no Nav duplicated inside page, no visible `這是會員頁面`, and no production deletion action executed.
- Suggested screenshot artifacts: `/tmp/member-page-redesign-T004-desktop-1440x1000.png` and `/tmp/member-page-redesign-T004-mobile-390x844.png`.
- Browser report must include console errors, network failures, and any unverified states.

Engineer instructions:

- Run each verification command separately and record exit code, expected signal, and actual signal.
- Use in-app Browser or Playwright for browser evidence; include viewport and screenshot artifact paths.
- If browser QA finds a product defect, do not edit product code. Record the defect, mark T004 blocked or rejected, and return to the coordinator for a targeted task update.
- Update only workflow evidence fields in the owned files.

Acceptance criteria:

- AC-T004.1: All automated gates pass or any failure is proven unrelated and explicitly carried as a blocker.
- AC-T004.2: Browser evidence covers desktop and mobile `/member` layout and required interactions.
- AC-T004.3: Tasks, status, and handoff agree on active task, active wave, task states, authorization boundary, rules deploy status, incidents, and latest verification.
- AC-T004.4: No release summary claims deployed rules, deployed functions, or production product behavior.
- AC-T004.5: No unreviewed product-code changes remain after integration verification.

Verification commands and expected signal:

| Command | Expected signal |
| ------- | --------------- |
| `npm run lint:changed` | Exit 0 with no changed-file lint errors. |
| `npm run type-check:changed` | Exit 0 with no changed-file type errors. |
| `npm run depcruise` | Exit 0 with no dependency-direction violations after integrated render/CSS changes. |
| `node scripts/validate-workflow-state.js specs/member-page-redesign/status.json` | Exit 0 and `WORKFLOW STATE: 1 status file(s) valid`. |
| `node scripts/check-superpowers-state.js specs/member-page-redesign/status.json` | Exit 0 and `SUPERPOWERS CHECK: 1 status file(s) synced`. |

Reviewer PASS criteria:

- Reviewer sees `review_passed` for T001, T002, and T003 before T004 completion.
- Required command evidence and browser evidence are fresh and one command per row.
- Workflow state files agree and validate.
- No product-code fixes are smuggled into T004.
- Rules deploy state remains not_applicable and no deploy claim is made.

Reviewer REJECT criteria:

- Any automated or browser evidence is missing, stale, or contradicts acceptance criteria.
- Tasks/status/handoff drift.
- T004 modifies product code without a coordinator-approved task update.
- Browser QA finds missing functionality, overlapping UI, duplicated Nav, duplicated interactive sections, or behavior regressions.

Evidence:

- Engineer report: not dispatched yet; record files changed, commands, exit codes, browser artifacts, risks, and unverified items after verification.
- Reviewer report: not reviewed yet; record `review_passed`, `review_rejected`, or `blocked`, checked diff, commands, exit codes, and reason.
- Command output summary: none yet.
- Changed files summary: none yet.
- Phase commits: none yet.
- Rules deploy status: not_applicable.
- Incidents: none.
