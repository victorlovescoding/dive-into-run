# Code Review — 009-global-toast

日期：2026-04-09

---

## Taste Rating: 🟢 **Good taste**

This is a clean, well-scoped migration. The data structures are right (useReducer for a queue), the abstraction level is right (one Context, two components, one hook), and the migration strategy (page-by-page replacement) is right. No over-engineering, no unnecessary dependencies.

---

## Linus's Three Questions

1. **Is this solving a real problem?** — Yes. Six pages with six different feedback mechanisms (actionMessage state, window.alert, console.error silent failures, disconnectError inline, createError/deleteError inline). This is a genuine UX inconsistency problem.
2. **Is there a simpler way?** — Not really. A Context + useReducer for a toast queue is the minimal viable solution. The component split (Toast vs ToastContainer) is the obvious separation of concerns.
3. **What will this break?** — Nothing in production. Inline error states are removed and replaced with toast. The EventDeleteConfirm prop cleanup is a clean breaking change within the codebase.

---

## [CRITICAL ISSUES]

None found.

---

## [IMPROVEMENT OPPORTUNITIES]

### 1. `@ts-expect-error` on Toast key prop — incorrect justification

**[src/components/ToastContainer.jsx, Line 20]**

```js
// @ts-expect-error — key 是 React 特殊 prop，不在 Toast JSDoc 型別中但為合法用法
<Toast key={toast.id} toast={toast} onClose={removeToast} />
```

`key` is handled by React internally — it is never passed to the component and should not trigger a type error. If `tsc` is complaining about `key`, the issue is likely the `ToastItem` type not being imported properly, not `key` itself. This `@ts-expect-error` might be masking a real type resolution issue.

**Suggestion**: Run `tsc` without the `@ts-expect-error` to confirm whether the error still exists. If it doesn't fire, remove the suppression (per CLAUDE.md: `@ts-expect-error` requires explanation and must be absolutely necessary).

### 2. Toast animation exit state is defined in CSS but never applied

**[src/components/Toast.jsx, Lines 40–48 + Toast.module.css Lines 44–47]**

```css
.exiting {
  opacity: 0;
  transform: translateY(100%);
}
```

The `animState` is `'entering'` → `'visible'`, but never transitions to `'exiting'`. The `handleClose` calls `onClose(id)` directly, which removes the toast from the array immediately. This means the exit animation defined in `.exiting` is dead CSS — it never plays.

**Pragmatic assessment**: For MVP this is fine — the toast simply disappears on close/timeout. But dead CSS is confusing to future readers. Either:

- Remove `.exiting` class entirely (honest), or
- Wire up the exit animation: set `animState('exiting')`, wait for `transitionend`, then call `onClose` (proper but more complex)

### 3. Duplicated `ToastItem` typedef across files

**[src/contexts/ToastContext.jsx, Line 9] + [src/components/Toast.jsx, Line 11]**

`ToastItem` is defined as a `@typedef` in both files with identical shape. This violates DRY — if the shape changes, two files need updating.

**Suggestion**: Define `ToastItem` once in `ToastContext.jsx` (the source of truth) and use `import('@/contexts/ToastContext').ToastItem` in `Toast.jsx`. The JSDoc import pattern is already used elsewhere in the codebase.

### 4. `handleDeleteConfirm` catch block swallows error silently

**[src/app/events/page.jsx, Line 700] + [src/app/events/[id]/eventDetailClient.jsx, Line 358]**

```js
} catch {
  showToast('刪除活動失敗，請稍後再試', 'error');
}
```

Unlike every other catch block in this codebase that includes `console.error(err)`, these two delete-confirm handlers use bare `catch` without logging. This is inconsistent with the established pattern (e.g., `handleEditSubmit` at line 660 logs `console.error('更新活動失敗:', err)`). When debugging production issues, having no error logged will make diagnosis harder.

**Suggestion**: Add `catch (err) { console.error('刪除活動失敗:', err); ... }` for consistency.

### 5. `PostDetailClient.jsx` — `setTitle/setContent/setIsComposeEditing/setEditingPostId` run even on error

**[src/app/posts/[id]/PostDetailClient.jsx, Lines 184–188]**

```js
} catch (err) {
  console.error('Post update error:', err);
  showToast('更新文章失敗，請稍後再試', 'error');
}
setTitle('');
setContent('');
setIsComposeEditing(false);
setEditingPostId(null);
```

The state cleanup runs unconditionally — even when the update fails. On error, the user's edit form closes and their changes are lost. Consider only resetting form state inside the `try` block's success path, so the form stays open on failure and the user can retry.

The same issue exists in `posts/page.jsx` at lines 214–218 with the same pattern.

### 6. posts/page.jsx `deletePostHandler` still uses `window.confirm`

**[src/app/posts/page.jsx, Line 276–277]**

```js
// eslint-disable-next-line no-alert -- 刪除確認使用原生對話框
if (!window.confirm('確定要刪除文章？')) return;
```

The events pages have a custom `EventDeleteConfirm` modal, but posts still use native `window.confirm`. This is pre-existing and not part of this PR's scope, but worth noting that it's an `eslint-disable` that CLAUDE.md says should be avoided for a11y. Same pattern exists in `PostDetailClient.jsx` line 210.

**Not blocking** — this is pre-existing debt, not introduced by this PR.

---

## [STYLE NOTES]

### 7. `layout.jsx` still imports React explicitly

**[src/app/layout.jsx, Line 1]**

```js
import React from 'react';
```

React 19 + Next.js App Router — no need for explicit React import. This is pre-existing and not introduced by this PR, but as you're already touching this file, it could be a clean one-liner cleanup.

### 8. `ToastType` typedef exists in Toast.jsx but not exported or used externally

**[src/components/Toast.jsx, Line 7]**

```js
/** @typedef {'success' | 'error' | 'info'} ToastType */
```

This type is only used internally by `getAriaRole`. It's fine, but note that `ToastContext.jsx` inlines the union type `'success' | 'error' | 'info'` everywhere instead of referencing a shared typedef. Minor inconsistency.

---

## [TESTING GAPS]

### 9. Integration tests for delete/edit events rely on conditional `if` guards

**[specs/009-global-toast/tests/integration/crud-toast.test.jsx, Lines 347–366]**

```js
const menuButtons = screen.queryAllByRole('button', { name: /更多操作|選單|menu/i });
if (menuButtons.length > 0) {
  // ... click menu → click delete → click confirm
  if (deleteButton) {
    if (confirmButton) {
      await waitFor(() => {
        expect(deleteEvent).toHaveBeenCalledWith('ev-del-1');
      });
    }
  }
}
```

Three nested `if` guards mean this test can pass even when the menu/delete/confirm buttons are never found. If the button text changes, this test silently becomes a no-op. These should be assertions (`expect(menuButton).toBeInTheDocument()`) not conditional guards. A test that never executes its core assertion is not a test.

**This is the most significant testing issue.** The happy-path tests for create/update on both events and posts pages are solid because they use direct `screen.getByRole`. But the delete event tests are fragile by design.

### 10. No unit test for `showToast` with invalid type

The reducer has a clear contract: type must be `'success' | 'error' | 'info'`. There's no test for what happens when someone calls `showToast('msg', 'warning')` — does it silently add with an unknown type, crash, or get filtered? The current implementation would add it (no validation), which means the CSS class would be `undefined`. Not critical, but a one-liner test would document the contract.

### 11. No test for the exit animation flow (or lack thereof)

Connected to Improvement #2 — since the exit animation path is dead code, there's no test for it. If someone later wires it up, they'll have no regression safety net.

---

## [TASK GAPS]

Cross-referencing `tasks.md` (all 23 tasks marked `[x]`):

| Task      | Status | Verification                                                                                                                                                                              |
| --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T001–T004 | ✅     | Phase 1 foundational code present in diff                                                                                                                                                 |
| T005–T007 | ✅     | Events page migration + CSS cleanup confirmed                                                                                                                                             |
| T008–T010 | ✅     | PostDetailClient, SignOutButton, member page all migrated                                                                                                                                 |
| T011      | ✅     | runs/page.jsx uses showToast for disconnect errors                                                                                                                                        |
| T012      | ✅     | Multi-toast stacking verified by unit test (MAX_TOASTS = 5)                                                                                                                               |
| T013      | ✅     | ESLint 0 warnings, type-check passes (src/ files clean)                                                                                                                                   |
| T014      | ✅     | success/info → `role="status"`, error → `role="alert"`, close button has `aria-label="關閉通知"`                                                                                          |
| T015      | ⚠️     | Mobile responsiveness CSS is present (`@media max-width: 640px`), but no automated test verifies 375px viewport. Manual verification needed.                                              |
| T016–T018 | ✅     | Events CRUD toast + search params + EventDeleteConfirm cleanup all in diff                                                                                                                |
| T019–T020 | ✅     | Posts CRUD toast + search params + delete navigation bug fix all in diff                                                                                                                  |
| T021      | ✅     | crud-toast.test.jsx with 17 test cases                                                                                                                                                    |
| T022      | ✅     | ESLint 0 warnings, type-check clean                                                                                                                                                       |
| T023      | ⚠️     | SC-001 coverage: all 10 success + 10 error paths produce visible toast. Verified by code review. But the integration tests for event delete paths (items #9 above) are structurally weak. |

**No scope creep detected.** All code changes map to tasks.

---

## VERDICT

✅ **Worth merging**

Core architecture is sound. The Context + useReducer design is the right level of abstraction. Page migrations are thorough and consistent. All 38 tests pass. ESLint clean. No `@ts-ignore`. No `window.alert` remaining in `src/`.

The issues identified are all improvement-level, not blockers:

- Dead exit animation CSS (#2) — cosmetic
- Duplicated typedef (#3) — maintenance burden, not a bug
- Missing `console.error` in two catch blocks (#4) — debuggability
- Form state cleanup on error (#5) — UX polish
- Conditional test guards (#9) — the most actionable item; these tests could silently pass without executing assertions

**KEY INSIGHT:**
The strongest aspect of this PR is the migration discipline — every page was systematically audited and converted with a consistent pattern (`showToast` for success, `showToast(msg, 'error')` for failure, `console.error` retained for dev debugging). The weakest aspect is the delete-event test paths that use conditional guards instead of assertions, which could mask regressions.
