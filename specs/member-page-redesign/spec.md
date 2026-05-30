# Member Page Redesign Spec

## Summary

Redesign `/member` from a plain stacked page into a utility-light member workspace that makes profile controls, bio editing, dashboard activity, saved-content entry, public-profile entry, and account deletion easier to scan.

This is a presentation and layout redesign only. Current user-visible behavior, data loading, mutation flows, navigation targets, dashboard pagination, and account deletion behavior must remain equivalent.

## Scope

- Applies only to `/member`.
- Keeps `/member/favorites` as-is and links to it through the existing `我的收藏` entry.
- Reworks the `/member` visual hierarchy, spacing, responsive layout, and render-only presentation.
- Removes the visible page text `這是會員頁面` and does not replace it with another page title.
- Keeps Nav outside this work; Nav is owned by the root layout and must not be added inside the page redesign.
- Default implementation scope is render/CSS/component layout only around the member screen and its existing render-only slots.

## Non-Goals

- Do not redesign `/member/favorites`.
- Do not add, remove, rename, or reorder current member-page features beyond the approved responsive layout.
- Do not add new auth behavior, auth redirects, data fetching, server actions, service calls, repo calls, dashboard data logic, pagination behavior, or account deletion logic.
- Do not copy the homepage landing hero, decorative runner scene, large marketing H1, footer CTA, or floating decorative cards.
- Do not change Firestore rules, schemas, migrations, dependencies, or deployment behavior.
- Do not fix pre-existing dashboard comment title-cache collision risk in this work.
- Do not change bio validation/counting semantics unless implementation discovers a strictly necessary UI state gap and gets explicit authorization.

## Approved Design

- Visual style: utility-light member workspace.
- Borrow only these homepage cues: warm off-white page background, deep green foreground, muted green-gray labels, yellow primary action, subtle blue/green accents, thin borders, 8px cards, and mono labels.
- The design should feel operational and scan-friendly, not like a marketing page.
- Desktop layout: two columns.
- Desktop left column: profile/account controls, Bio editor, then Danger Zone.
- Desktop right column: activity dashboard tabs.
- Mobile layout: one column in this order:
  1. profile/account controls
  2. Bio editor
  3. dashboard tabs
  4. Danger Zone
- Profile/account controls include avatar, greeting/user identity, display name editing, `查看我的公開檔案`, and `我的收藏`.
- Cards and panels should use restrained 8px radii, thin borders, stable dimensions where layout shift would be visible, and no nested card-in-card treatment.

## Functional Parity Checklist

- Avatar displays `user.photoURL` when present and `/default-avatar.png` otherwise.
- Avatar image remains clickable and opens the hidden `image/*` file input.
- Avatar upload flow remains unchanged, including clearing the input after handling and showing the existing failure toast on upload or photo URL update failure.
- Display name edit keeps a text input and a submit button labeled `變更名稱`.
- Display name submit remains a no-op or disabled equivalent when the input is empty, unchanged, loading, or no user exists.
- Display name update failure still shows the existing failure toast.
- `查看我的公開檔案` appears only when a user UID exists and links to `/users/{uid}`.
- `我的收藏` appears only when a user UID exists, keeps the exact label `我的收藏`, and links to `/member/favorites`.
- Bio editor keeps `個人簡介`, textarea, 150-character count, `儲存簡介`, `儲存中…`, `已儲存`, and current error-message behavior.
- Dashboard tabs keep labels `我的活動`, `我的文章`, and `我的留言`.
- Dashboard tabs keep click selection and keyboard behavior for ArrowLeft, ArrowRight, Home, and End.
- Dashboard panel states preserve initial loading, load failure with retry, per-tab empty copy, infinite-scroll loading, load-more error with retry, and `已顯示全部`.
- Activity cards preserve event detail links, `主辦` badge, `即將到來` / `已結束`, time, location, attendee count, and capacity.
- Post cards preserve post detail links, time, like count, and comment count.
- Comment cards preserve source badge `活動` / `文章`, parent link/title, comment text, and time.
- Danger Zone preserves current account deletion copy, `刪除帳號`, modal, `取消`, `重新驗證並刪除` / `處理中...`, error display, Google reauthentication, and deletion API flow.

## Responsive Behavior

- Desktop breakpoint behavior should support two columns without causing the dashboard list to squeeze below readable widths.
- The left column is the account-management column; the right column is the activity-history column.
- On mobile, source order and visual order must match the approved single-column order.
- Long names, emails, links, tab labels, button text, and status text must wrap or truncate cleanly without overlapping neighboring controls.
- Avatar, buttons, tabs, counters, and list cards must keep stable dimensions so hover/focus/loading states do not resize the layout.

## Accessibility And Keyboard Behavior

- Existing semantic roles for dashboard `tablist`, `tab`, and `tabpanel` must be preserved.
- Existing `aria-selected`, `aria-controls`, `aria-labelledby`, and active-tab `tabIndex` behavior must remain intact.
- ArrowLeft, ArrowRight, Home, and End must continue to move/select dashboard tabs as they do today.
- The avatar image click behavior must not regress. If the redesign introduces an explicit avatar trigger control, that control must be keyboard-accessible.
- Focus-visible states must be clear on avatar controls, text inputs, links, buttons, tabs, retry actions, and modal actions.
- The account deletion modal must keep `role="dialog"`, `aria-modal="true"`, and its title association.
- Bio success remains announced through the existing status behavior, and Bio errors remain alert behavior.

## Data Flow And Architecture Boundaries

- `src/app/member/page.jsx` must stay thin: compose `useMemberPageRuntime()`, slot components, and `MemberPageScreen`.
- Data fetching and mutations must not move into `MemberPageScreen` or other render-only UI screens.
- Preserve the forward-only dependency direction: Types -> Config -> Repo -> Service -> Runtime -> UI.
- Default implementation should stay in render/CSS/component layout. Avoid changing runtime hooks, use cases, services, or repos.
- Runtime changes are allowed only if implementation discovers a strictly necessary UI state gap; such changes must be minimal, justified, and preserve existing behavior.
- Account deletion filtering and dashboard pagination behavior must remain untouched.
- `/member/favorites` data logic must remain untouched.

## Error, Loading, And Empty States

- The dashboard must continue showing its current initial loading state before data resolves.
- Dashboard first-load failure must keep an error message and a retry button.
- Dashboard load-more failure must keep an error message and a retry button without discarding already loaded items.
- Dashboard empty states must keep the existing per-tab copy.
- Dashboard completion state must keep `已顯示全部`.
- Bio over-limit, saving, saved, unchanged, and failure states must remain behaviorally equivalent.
- Display name and avatar failures must continue using the current toast behavior.
- Danger Zone modal errors must remain visible inside the modal and still use the current toast behavior where applicable.
- Existing `/member` has `runtime.loading`, but the screen currently has no explicit top-level loading branch. The redesign may add visual treatment for that state only if it is behaviorally equivalent and does not promise new auth redirect or new auth behavior.

## Acceptance Criteria

- `/member` no longer displays `這是會員頁面`.
- `/member` has no in-page Nav added by this work.
- Desktop shows profile/account controls, Bio editor, and Danger Zone in the left column, with dashboard tabs in the right column.
- Mobile shows profile/account controls, Bio editor, dashboard tabs, then Danger Zone.
- `查看我的公開檔案` and `我的收藏` are visible only when UID exists and keep their current destinations.
- Avatar click still opens the hidden file input and preserves upload behavior.
- Display name editing preserves current no-op/disabled conditions and failure toast behavior.
- Bio editor labels, count, save states, success, and errors remain equivalent.
- Dashboard tabs, keyboard behavior, panel states, card links, badges, metadata, pagination, and retry behavior remain equivalent.
- Danger Zone copy, modal actions, errors, reauth, and deletion API flow remain equivalent.
- No product behavior outside `/member` changes.
- No repo/service/runtime data logic changes are made unless explicitly justified by a necessary UI state gap.

## Verification Expectations

- Run a focused changed-file lint gate such as `npm run lint:changed`.
- Run a focused changed-file type-check gate such as `npm run type-check:changed`.
- Run a dependency-direction gate such as `npm run depcruise` if implementation touches imports or component boundaries.
- Manually verify `/member` in desktop and mobile widths for layout order, no overlapping text, avatar/input interactions, links, dashboard tabs, retry states if reproducible, and Danger Zone modal behavior.
- If automated tests already cover member dashboard tabs, Bio editor, or account deletion UI, rerun the affected focused tests.
- Do not claim auth redirect behavior, account deletion production behavior, or deployed rules behavior from this redesign verification.

## Implementation Risks

- A visual redesign can accidentally break hidden input activation for avatar uploads; keep the input/ref/handler flow intact.
- Making the display-name button visibly disabled must still match the existing no-op conditions and must not block valid submits.
- Reordering the Danger Zone on mobile while keeping it in the left column on desktop can create duplicated markup if handled carelessly; avoid duplicate interactive instances.
- Dashboard tabs have keyboard and ARIA behavior that must survive styling and layout changes.
- Dashboard infinite scroll depends on the sentinel remaining mounted in the active panel.
- Account deletion is a critical flow; visual changes must not alter modal submission, disabled states, or reauth request sequencing.
- If client/server Bio emoji counting mismatch is observed during implementation, treat it as pre-existing and out of scope unless the implementation explicitly touches Bio validation.
- The dashboard comment title-cache collision risk is pre-existing and out of scope.

## User Authorization

- Spec stage approved by: user, 2026-05-30.
- Repo doc persistence: long-term P4 feature spec under `specs/member-page-redesign/spec.md`.
- One-time automated execution authorization: spec doc edit, staging, and commit only, 2026-05-30.
- Authorization boundary:
  - edit: yes, spec doc only
  - commit: yes, spec doc only
  - push: no
  - pullRequest: no
  - ciWatch: no
  - merge: no
  - localMainSync: no
  - deployFirestoreRules: no

## Release Notes

- Firestore/storage rules deploy required: no.
- Functions deploy required: no.
- Final summaries must not imply deployed rules, deployed functions, or production product behavior.
