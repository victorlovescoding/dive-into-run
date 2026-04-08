# Tasks: 響應式導覽列 (RWD Navbar)

**Input**: Design documents from `/specs/010-responsive-navbar/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/navbar-contract.md, quickstart.md

**Tests**: 依 Constitution I TDD 規則，於 `/speckit.implement` 階段每個 task 內執行 Red-Green-Refactor。

**Auth Testing**: 涉及登入狀態的 task（auth UI、avatar、dropdown、跨 viewport 驗證等），integration test 使用 mock AuthContext，E2E 使用 Firebase Auth Emulator（`firebase emulators:exec --only auth "npm run test:e2e:emulator"`）。

**Organization**: Tasks grouped by user story. US3 (component extraction) is placed in the Foundational phase as it blocks all other stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create service layer that Navbar depends on

- [ ] T001 Create `src/lib/firebase-auth-helpers.js` — export `signInWithGoogle()` (Google popup auth) and `signOutUser()` (sign out current user) per service layer contract in `specs/010-responsive-navbar/contracts/navbar-contract.md`

---

## Phase 2: Foundational — Component Extraction (Covers US3, Blocking)

**Purpose**: Extract navbar from layout into independent client component. Corresponds to User Story 3 (P2) — architecturally required before US1/US2 can begin.

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Create `src/components/Navbar/Navbar.jsx` — `'use client'` directive, `NAV_ITEMS` constant array (5 items per data-model.md), `isActivePath(pathname, href)` helper, `<nav aria-label="主要導覽">` with brand `<Link href="/">Dive Into Run</Link>`, flat nav link list using `usePathname()`。**注意**：此 task 僅建立 `isActivePath` helper 和基礎 link markup，不套用 active 樣式——active styling 由 T009（desktop）和 T006（drawer）各自負責套用
- [ ] T003 Create `src/components/Navbar/Navbar.module.css` — `.navbar` (sticky, top:0, display:flex, align-items:center, z-index:1000, background, padding), `.brand` (font-weight, text-decoration), `.link` and `.linkActive` (active highlight style)
- [ ] T004 Integrate Navbar into `src/app/layout.jsx` — import and render `<Navbar />` replacing inline `<nav className="main-nav">` block, remove `<hr />` divider, remove `.main-nav a` styles from `src/app/globals.css`, remove unused `LoginButton.jsx` and `SignOutButton.jsx` from `src/components/`（已被 Navbar 內建 auth UI 取代，舊元件直接 import Firebase SDK 違反 Constitution II）

**Checkpoint**: Site works with Navbar as independent component. Navigation identical to pre-refactor. All links visible as flat list.

---

## Phase 3: User Story 1 — 手機使用者瀏覽導覽列 (Priority: P1) MVP

**Goal**: Mobile users see hamburger button, tap to open right-side drawer with all nav links + auth actions. Drawer closes on link click, overlay click, close button, or Escape.

**Independent Test**: At <768px viewport, verify hamburger visible, drawer opens/closes, all links navigate correctly, body scroll locked while open.

- [ ] T005 [US1] Add hamburger button markup — 3 `<span>` elements inside `<button>`, CSS transform animation to ✕ on open — in `src/components/Navbar/Navbar.jsx` + `src/components/Navbar/Navbar.module.css` (`.hamburger`, `.hamburgerLine`, `.hamburgerOpen`; hidden at >=768px via media query)
- [ ] T006 [US1] Add drawer panel + overlay — right-side drawer with nav links and auth section (login button or user info + sign-out), semi-transparent overlay backdrop, CSS `transform: translateX(100%)` → `translateX(0)` slide-in transition with `will-change: transform`, overlay `opacity` fade, drawer 連結同樣套用 `.linkActive` + `aria-current="page"` 標示目前所在頁面 — in `src/components/Navbar/Navbar.jsx` + `src/components/Navbar/Navbar.module.css` (`.drawer`, `.drawerOpen`, `.overlay`, `.overlayVisible`, `.drawerLinks`, `.drawerLinkActive`, `.drawerClose`, `.loginButton`)
- [ ] T007 [US1] Implement drawer state management in `src/components/Navbar/Navbar.jsx` — `isDrawerOpen` state, hamburger click toggles, `useEffect` for body scroll lock (`document.body.style.overflow` with cleanup), auto-close on nav link click, `matchMedia('(min-width: 768px)')` listener to auto-close on viewport resize to desktop
- [ ] T008 [US1] Add drawer accessibility in `src/components/Navbar/Navbar.jsx` — `id="mobile-drawer"`, `role="dialog"`, `aria-modal="true"`, `aria-label="導覽選單"`, hamburger `aria-controls="mobile-drawer"` + `aria-expanded`, `aria-label="開啟導覽選單"/"關閉導覽選單"`, Escape key handler to close drawer, focus management (open: focus close button, close: focus hamburger button)

**Checkpoint**: Mobile experience fully functional — hamburger opens right-side drawer, all links work, overlay dismiss, body scroll lock, keyboard accessible.

---

## Phase 4: User Story 2 — 桌面使用者的導覽體驗 (Priority: P1)

**Goal**: Desktop users see horizontal nav links with active highlight, user avatar with dropdown (sign out), or login button. Skeleton loading during auth check.

**Independent Test**: At >=768px viewport, verify horizontal links with active state, avatar dropdown opens/closes with sign-out, login button shown when logged out, skeleton during loading.

- [ ] T009 [US2] Add desktop horizontal link container — 將 T002 的 flat link list 包進 `<ul role="list">` desktop-only container（>=768px 顯示，<768px 隱藏），並在此套用 `.linkActive` + `aria-current="page"` active styling — in `src/components/Navbar/Navbar.jsx` + `src/components/Navbar/Navbar.module.css` (`.desktopLinks`; hidden at <768px via media query)
- [ ] T010 [US2] Add auth UI section — skeleton loading state (`.skeleton` circular pulse animation while `loading === true`), user avatar (`user.photoURL` in `<img>` with inline SVG circle+person fallback, `.avatar`, `.avatarImage`), login button when `user === null` (`.loginButton`, calls `signInWithGoogle()`) — in `src/components/Navbar/Navbar.jsx` + `src/components/Navbar/Navbar.module.css` (`.userSection`, `.skeleton`, `.avatar`, `.avatarImage`, `.loginButton`)
- [ ] T011 [US2] Add avatar dropdown menu — `isDropdownOpen` state, avatar `<button>` click toggles dropdown, `<ul>` with sign-out `<button>` calling `signOutUser()`, click-outside close via `useEffect` + `dropdownRef` + `document.addEventListener('click')` — in `src/components/Navbar/Navbar.jsx` + `src/components/Navbar/Navbar.module.css` (`.dropdown`, `.dropdownOpen`)
- [ ] T012 [US2] Add dropdown accessibility in `src/components/Navbar/Navbar.jsx` — avatar button `aria-expanded` + `aria-haspopup="true"`, dropdown `role="menu"`, sign-out `role="menuitem"`, Escape key handler to close dropdown, focus management (open: focus first menu item, close: focus avatar button)

**Checkpoint**: Desktop experience fully functional — horizontal nav with active state, avatar dropdown with sign-out, login button for unauthenticated, skeleton loading. Both mobile and desktop viewports now work correctly.

---

## Phase 5: User Story 4 — 網站基本 metadata 修正 (Priority: P2)

**Goal**: Correct page title and language attribute for SEO and accessibility.

**Independent Test**: View page source — `<html lang="zh-Hant-TW">` and `<title>Dive Into Run</title>`.

- [ ] T013 [US4] Update `src/app/layout.jsx` — change `export const metadata` title from current value to `'Dive Into Run'`, change `<html lang="en">` to `<html lang="zh-Hant-TW">`

**Checkpoint**: Metadata correct. All 4 user stories complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification across all user stories

- [ ] T014 Cross-viewport verification — test responsive behavior at 320px, 375px, 768px, 1024px, 1920px breakpoints, verify no overflow/overlap/layout shift, confirm drawer and dropdown work correctly at boundary (768px), 在地圖頁面（含 Leaflet 的頁面）確認 navbar 不被地圖 container 覆蓋（z-index 驗證）
- [ ] T015 Run `npm run lint` + `npm run type-check`, fix all issues; run getDiagnostics and fix Warning/Hint/Error items; add any unknown words to `cspell.json`
- [ ] T016 Edge case 驗證與修正 — (1) 手機旋轉時面板適應或自動關閉（orientation change / resize 事件）, (2) 滑出面板展開時按瀏覽器返回鍵關閉面板而非導航離開（popstate 事件 + history.pushState）, (3) 快速連續點擊漢堡按鈕不導致狀態不一致（CSS transition 期間 pointer-events 防護或 state guard）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Setup + Foundational (Phase 1+2)**: T001, T002, T003 可平行 [P]（不同檔案，T002 不 import firebase-auth-helpers — auth import 在 T010 才發生）; T004 depends on T002+T003; T010/T011 depends on T001
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 2 completion; depends on Phase 3 in practice (same files)
- **US4 (Phase 5)**: Depends on Phase 2 (T004 modifies same file); can run parallel with US1/US2 if done before T004
- **Polish (Phase 6)**: Depends on all story phases complete

### User Story Dependencies

- **US3 (Foundational)**: No dependencies — extraction is the base
- **US1 (P1)**: Depends on US3 (Navbar must exist). Independent of US2
- **US2 (P1)**: Depends on US3 (Navbar must exist). Independent of US1 logically, but same files — sequential in practice
- **US4 (P2)**: Independent of all stories, but same file as T004 — sequence after Phase 2

### Within Each User Story

- Markup + styles before state management
- State management before accessibility
- Core implementation before polish

### Parallel Opportunities

- **Phase 1+2**: T001, T002, T003 三者可平行 [P] — 不同檔案，無相互依賴（auth import 在 T010 才發生）
- **Cross-story**: US4 (T013) could be done any time after Phase 2 since it's a one-line metadata change

---

## Parallel Example: Setup + Foundational

```text
# Parallel batch 1:
T001: Create firebase-auth-helpers.js
T002: Create Navbar.jsx (no auth imports — those come in T010)
T003: Create Navbar.module.css

# Then:
T004: Integrate into layout.jsx (depends on T002+T003)
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3 = Mobile Works)

1. Complete Phase 1: Setup (firebase-auth-helpers)
2. Complete Phase 2: Foundational (Navbar extraction — US3)
3. Complete Phase 3: US1 (Mobile drawer)
4. **STOP and VALIDATE**: Mobile experience fully functional
5. Deploy/demo if ready — mobile users unblocked

### Incremental Delivery

1. Setup + Foundational → Navbar exists as component (US3 done)
2. Add US1 → Mobile drawer works → Validate independently
3. Add US2 → Desktop nav + dropdown works → Validate independently
4. Add US4 → Metadata correct → Validate independently
5. Polish → Cross-viewport + lint/type-check → Ship

### Single Developer Flow (Recommended)

All tasks sequential: T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015

---

## Notes

- All files in `src/components/Navbar/` are new; `layout.jsx` and `globals.css` are modifications
- CSS-only responsive switching — no useMediaQuery hook (avoids SSR hydration mismatch)
- Navbar.jsx target ~150-180 lines; if exceeding ~200 lines, extract `MobileDrawer.jsx` or `UserMenu.jsx`
- Auth state from existing `AuthContext` — no new context needed
