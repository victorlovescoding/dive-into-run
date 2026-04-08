# Research: 響應式導覽列 (RWD Navbar)

**Branch**: `010-responsive-navbar` | **Date**: 2026-04-08
**Status**: Complete — all unknowns resolved

---

## Decision 1: 響應式切換策略

**Decision**: CSS-only 響應式切換（media queries hide/show）

**Rationale**:

- 桌面導覽和手機漢堡按鈕始終同時存在於 DOM 中，由 CSS `display` 控制顯示
- 避免 SSR hydration mismatch（Server 端無法偵測 viewport width）
- 無需額外 JavaScript（useMediaQuery hook），效能更佳
- 更好的 SEO — 所有導覽連結始終在 DOM 中

**Alternatives considered**:

- `useMediaQuery` hook（JS 偵測）— 有 SSR hydration 問題，需 `suppressHydrationWarning` 或延遲渲染
- Container queries — 瀏覽器支援度足夠，但此場景 media queries 已滿足需求且更直觀

---

## Decision 2: Body Scroll Lock

**Decision**: 直接 DOM 操作 `document.body.style.overflow = 'hidden'`

**Rationale**:

- 最簡單的實作方式，~5 行程式碼
- 在 `useEffect` 中設定/清除，確保 cleanup
- iOS Safari 上可能需要額外處理（`position: fixed` + scroll position restore），但對 MVP 而言基本方案即可

**Alternatives considered**:

- `body-scroll-lock` npm 套件 — 增加依賴，此場景不需要
- CSS `overscroll-behavior` — 只防止 scroll chaining，不鎖定背景滾動
- `<dialog>` element 的 `inert` attribute — 瀏覽器支援度不足以涵蓋目標裝置

---

## Decision 3: 滑出面板動畫

**Decision**: CSS `transform: translateX()` + `transition`

**Rationale**:

- GPU 加速，保證 60fps 動畫
- `transform` 和 `opacity` 是不觸發 layout/paint 的屬性
- 搭配 `will-change: transform` 提示瀏覽器預先分配 GPU 記憶體
- Overlay 使用 `opacity` transition 淡入淡出

**Alternatives considered**:

- Framer Motion — 功能強大但引入大型依賴，此場景不需要
- Web Animations API — 不如 CSS transition 直觀，且無額外效益
- `@keyframes` animation — 適合單次動畫，toggle 狀態用 transition 更自然

---

## Decision 4: Active Link 偵測

**Decision**: `usePathname()` from `next/navigation`

**Rationale**:

- Next.js App Router 官方 API，穩定可靠
- 回傳當前路徑字串（如 `/events`），可直接與 NavItem.href 比對
- 自動響應 client-side navigation 更新

**Implementation detail**:

```js
/** 判斷導覽連結是否為目前頁面。 */
function isActivePath(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}
```

- 首頁精確比對（避免所有路徑都 match `/`）
- 其他頁面使用 `startsWith`（如 `/events/123` 仍 highlight `/events`）

**Alternatives considered**:

- `useSelectedLayoutSegment()` — 只回傳 segment 而非完整路徑，不夠直觀
- Custom hook wrapping `window.location` — 不必要，`usePathname` 已足夠

---

## Decision 5: 元件架構

**Decision**: 單一 `Navbar/` 目錄，起始為 `Navbar.jsx` + `Navbar.module.css`

**Rationale**:

- Constitution V 要求 MVP，不預先拆分
- 預估 Navbar.jsx ~150-180 行（含 JSDoc），在可管理範圍內
- 複雜邏輯抽為 module-level helper functions（非子元件），符合 Constitution IX

**Extraction criteria**（若實作中超過閾值）:

- Navbar.jsx > 200 行 → 拆出 `MobileDrawer.jsx`
- Dropdown 邏輯 > 50 行 → 拆出 `UserMenu.jsx`

**Alternatives considered**:

- 預先拆為 4+ 子元件 — 過度設計，違反 MVP
- 所有邏輯塞在一個函式 — 違反 "No Logic in JSX"

---

## Decision 6: 漢堡按鈕圖示

**Decision**: CSS-only（3 個 `<span>` + transform 動畫形成 ✕）

**Rationale**:

- 零依賴，~20 行 CSS
- 開啟時動畫變形為 ✕ 關閉圖示，增加視覺回饋
- 語義化：`<button>` + `aria-label` + `aria-expanded`

**Alternatives considered**:

- SVG icon（heroicons, lucide）— 需引入圖示庫
- Unicode `☰` — 樣式控制不夠精細，無法做開關動畫

---

## Decision 7: 使用者頭像與 Fallback

**Decision**: AuthContext `user.photoURL`，fallback 為 SVG 預設頭像

**Rationale**:

- `user.photoURL` 來自 Google Auth，大多數使用者有圖片
- Fallback 用內聯 SVG（圓形 + 人形 icon），無額外請求
- Skeleton 載入狀態：圓形灰色脈動動畫

**Alternatives considered**:

- 使用者姓名首字母 — 需處理無名稱情況，較複雜
- Gravatar — 額外 HTTP 請求，不值得

---

## Decision 8: Click Outside 關閉

**Decision**: `useEffect` + `document.addEventListener('click', ...)`

**Rationale**:

- 標準 React 模式，無需額外套件
- 透過 `event.stopPropagation()` 或 ref 判斷點擊位置
- Drawer 和 Dropdown 各自獨立的 click outside handler

**Implementation approach**:

- Drawer：overlay 覆蓋全螢幕，點擊 overlay = 關閉
- Dropdown：document click listener，判斷 `!dropdownRef.current.contains(event.target)`

**Alternatives considered**:

- Headless UI `useClickOutside` — 額外依賴，不值得
- Popover API — 瀏覽器支援度不足

---

## Decision 9: 鍵盤導覽與無障礙

**Decision**: 標準 WCAG 2.1 AA 模式

**Contract**:

- `<nav aria-label="主要導覽">` — 語義化導覽
- 漢堡按鈕：`aria-expanded="true|false"` + `aria-controls="mobile-drawer"`
- 面板：`role="dialog"` + `aria-modal="true"` + `aria-label="導覽選單"`
- Active link：`aria-current="page"`
- Escape 鍵：關閉 drawer 和 dropdown
- Focus management：drawer 開啟時 focus 移至關閉按鈕，關閉時 focus 返回漢堡按鈕

**Alternatives considered**:

- Focus trap library（focus-trap-react）— 增加依賴，手動管理 focus 已足夠

---

## Decision 10: Sign-In / Sign-Out 封裝

**Decision**: 新增 `src/lib/firebase-auth-helpers.js`

**Rationale**:

- Constitution II 要求 UI 不直接 import Firebase SDK
- 現有 LoginButton、SignOutButton 直接 import `firebase/auth` — 技術債
- 新增 ~15 行 service layer 函式，Navbar 透過這些函式操作認證

**Functions**:

```js
// src/lib/firebase-auth-helpers.js
export async function signInWithGoogle() { ... }
export async function signOutUser() { ... }
```

**Alternatives considered**:

- 在 Navbar 中 import 現有 LoginButton/SignOutButton 元件 — UI 樣式衝突，且它們各自處理 visibility
- 直接在 Navbar import Firebase SDK — 違反 Constitution II
