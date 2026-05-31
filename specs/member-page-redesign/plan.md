# Member Page Redesign Plan

## Summary

`/member` will be redesigned as a utility-light member workspace while keeping all current runtime behavior in place. The implementation should stay in render-only React screens and CSS modules: page composition remains thin, Firebase/auth/dashboard logic remains in the existing runtime, service, and repo layers, and `/member/favorites` remains unchanged except for the existing `我的收藏` link.

This plan records the technical path only. The current automation authorization covers editing, staging, and committing these workflow artifacts; product-code implementation still needs a fresh coordinator authorization before Engineer dispatch.

## Architecture

- `src/app/member/page.jsx` stays a thin client entry: it calls `useMemberPageRuntime()`, creates the existing Bio, dashboard, and Danger Zone slots, and passes them to `MemberPageScreen`.
- `MemberPageScreen` owns only `/member` page layout and profile/account controls. It must remove visible text `這是會員頁面`, avoid adding an in-page Nav, preserve the avatar hidden input/ref flow, keep display-name form behavior wired to runtime handlers, and render each slot exactly once.
- CSS custom properties for the member workspace visual language should be scoped on the page wrapper in the new `MemberPageScreen.module.css`. Child CSS modules can consume those inherited variables with fallbacks, but must not depend on homepage class names.
- Bio and Danger Zone remain behavior components. Their planned changes are CSS-only unless an Engineer finds a strictly necessary UI state gap and stops for coordinator approval.
- Dashboard runtime and tab behavior remain in `useDashboardTabsRuntime()` and `useDashboardTab()`. Dashboard screen work may adjust render-only wrappers and CSS, but must preserve `tablist`, `tab`, `tabpanel`, ARIA attributes, active `tabIndex`, keyboard handlers, sentinel mounting, loading/error/empty/load-more/end states, and card content.
- Runtime, service, repo, Firestore rules, storage rules, schema, dependency, and deployment changes are outside the default implementation scope.

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `src/app/member/page.jsx` | Keep read-only by default | Preserve App Router thin composition and existing slot creation. Stop if this file appears necessary to edit. |
| `src/ui/member/MemberPageScreen.jsx` | Modify | Page-level layout, profile/account controls, avatar input wiring, display-name form wiring, public-profile link, favorites link, slot order. |
| `src/ui/member/MemberPageScreen.module.css` | Create | Warm off-white workspace background, deep green foreground, muted labels, yellow primary action, two-column desktop grid, mobile source order, 8px cards, thin borders, stable profile controls. |
| `src/app/member/BioEditor.jsx` | Keep read-only by default | Preserve labels, count, saving/success/error behavior, code-point counting, and service call behavior. |
| `src/app/member/BioEditor.module.css` | Modify | Align Bio editor visual treatment with member workspace tokens without changing state semantics. |
| `src/ui/member/AccountDeletionDangerZone.jsx` | Keep read-only by default | Preserve copy, modal roles, actions, disabled states, error display, and runtime flow. |
| `src/ui/member/AccountDeletionDangerZone.module.css` | Modify | Align Danger Zone spacing, borders, focus states, modal fit, and mobile wrapping without changing copy or behavior. |
| `src/components/DashboardTabs.jsx` | Keep read-only by default | Preserve thin runtime-to-screen boundary. |
| `src/ui/member/DashboardTabsScreen.jsx` | Modify only when needed | Render-only dashboard wrappers and panel structure while preserving tab roles, ARIA, keyboard handlers, hidden inactive panels, and sentinel. |
| `src/components/DashboardTabs.module.css` | Modify | Responsive tab bar, dashboard panel, loading/error/empty/load-more/end states, and card-list fit. |
| `src/runtime/hooks/useMemberPageRuntime.js` | Keep read-only | Source of profile/account behavior; product plan does not change handlers or data flow. |
| `src/runtime/hooks/useDashboardTabsRuntime.js` | Keep read-only | Source of tab labels, active tab state, click selection, and keyboard behavior. |
| `src/runtime/hooks/useDashboardTab.js` | Keep read-only | Source of dashboard pagination, retry, sentinel, and loading/error behavior. |
| `src/ui/users/ProfileScreen.module.css` | Read-only reference | Existing profile page utility card treatment for comparison only. |
| `src/ui/home/HomePage.module.css` | Read-only reference | Borrow only color/tone cues: warm off-white, deep green, muted green-gray, yellow, subtle blue/green accents, thin borders, mono labels. Do not copy hero, scene, large H1, footer CTA, or floating-card composition. |

## Verification Strategy

- Required workflow gates for this plan stage:
  - `node scripts/validate-workflow-state.js specs/member-page-redesign/status.json` must exit 0 and print `status file(s) valid`.
  - `node scripts/check-superpowers-state.js specs/member-page-redesign/status.json` must exit 0 and print `status file(s) synced`.
- Required implementation gates after product changes:
  - `npm run lint:changed` must exit 0 with no changed-file lint errors.
  - `npm run type-check:changed` must exit 0 with no changed-file type errors.
  - `npm run depcruise` must exit 0 after any import or component-boundary change.
- Focused tests:
  - Planner did not read test files because they were outside the allowed planning context. Do not invent a test path.
  - If the coordinator later authorizes a bounded test lookup, add exact existing focused test commands for member dashboard tabs, Bio editor, or account deletion UI before dispatch.
- Browser evidence after implementation:
  - Use the in-app Browser or Playwright against `/member`.
  - Desktop viewport: 1440 by 1000. Expected: profile/account controls, Bio editor, and Danger Zone in the left column; dashboard tabs in the right column; no overlapping text; no visible `這是會員頁面`; no in-page Nav duplicate.
  - Mobile viewport: 390 by 844. Expected visual order: profile/account controls, Bio editor, dashboard tabs, Danger Zone; long names, emails, links, tab labels, buttons, and status text wrap or truncate cleanly.
  - Interaction checks: avatar click opens the hidden file input, public profile and `我的收藏` links keep destinations, display-name form keeps disabled/no-op conditions, dashboard click and ArrowLeft/ArrowRight/Home/End behavior still works, dashboard states remain visible when reproducible, and Danger Zone modal opens/closes/submits through existing handlers.
  - Evidence must include viewport, tool, screenshot or browser artifact path, console findings, network findings, and observed expected/actual signal.

## Workflow State

- Status schema: v3.
- Current head snapshot: `status.json.currentHead` captures local HEAD `ffad6f391690990f9369817da3db865f32199233` on branch `082-member-page-redesign` at plan creation time.
- Remote head snapshot: `status.json.remoteHead` captures `origin/main` at `4c5b45b1fbf5b62ded2da57dd178133532a90b9f`.
- Phase: `plan`.
- Active task: none. Product-code implementation is not authorized yet.
- Last verified commit policy: remain `null` until implementation or release verification covers a concrete commit. Plan-stage workflow validation is recorded in `lastVerification`, not as product verification.
- Phase commit checkpoints: the plan artifact commit is reported by the Planner after commit. Later implementation phase commits must be added by the coordinator only after reviewed task completion.
- Rules deploy status: `not_applicable`; Firestore/storage rules are not in scope and no deploy is required.
- Incident handling: open incidents block closeout. No incidents are open at plan creation.

## Release Boundary

- Current authorization boundary for this Planner task:
  - edit: true, limited to `specs/member-page-redesign/plan.md`, `tasks.md`, `handoff.md`, and `status.json`.
  - commit: true, limited to the same workflow artifacts.
  - push: false.
  - pullRequest: false.
  - ciWatch: false.
  - merge: false.
  - localMainSync: false.
  - deployFirestoreRules: false.
- Product-code implementation needs explicit fresh authorization before dispatch.
- Firestore/storage rules deploy authorization is false and not required.
- Final summaries must not imply deployed rules, deployed functions, or production product behavior.

## Risk And Stop Conditions

- Stop if implementation needs to touch files outside a task-owned write set.
- Stop if `src/app/member/page.jsx`, runtime hooks, service/repo files, dashboard use cases, Firestore rules, storage rules, schema, dependencies, or deployment behavior appear necessary to change.
- Stop if `/member/favorites` needs any edit; it is out of scope.
- Stop if preserving avatar input activation, dashboard keyboard/ARIA behavior, dashboard sentinel mounting, Bio state semantics, or account deletion modal flow requires behavior changes beyond render/CSS layout.
- Stop if a visual change would duplicate interactive Danger Zone markup to satisfy desktop/mobile ordering.
- Stop if validation fails and cannot be fixed within the four workflow artifacts during plan stage.
- Stop if an existing failing automated gate is unrelated to the touched files and blocks verification.

## Task Slices

- T001: Member page shell and profile/account controls. Serial prerequisite for visual tokens and responsive page layout.
- T002: Bio editor and Danger Zone styling alignment. Runs after T001 and owns CSS-only visual alignment.
- T003: Dashboard tabs and responsive panel fit. Runs after T001 and may run in parallel with T002 because owned files are disjoint.
- T004: Integration verification and workflow evidence. Runs after T002 and T003 pass Reviewer checks; owns workflow evidence only by default and must not fix product code without a coordinator-approved task update.
