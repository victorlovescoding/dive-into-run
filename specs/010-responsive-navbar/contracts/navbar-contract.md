# Navbar Component Contract

**Branch**: `010-responsive-navbar` | **Date**: 2026-04-08

---

## Component: `Navbar`

**Path**: `src/components/Navbar/Navbar.jsx`
**Type**: Client Component (`'use client'`)
**Props**: None（自包含元件，透過 Context 和 hooks 取得所需資料）

### Internal Dependencies

| Dependency         | Source                        | Purpose            |
| ------------------ | ----------------------------- | ------------------ |
| `AuthContext`      | `@/contexts/AuthContext`      | 取得 user, loading |
| `usePathname()`    | `next/navigation`             | 偵測目前路由       |
| `Link`             | `next/link`                   | Client-side 導覽   |
| `signInWithGoogle` | `@/lib/firebase-auth-helpers` | Google 登入        |
| `signOutUser`      | `@/lib/firebase-auth-helpers` | 登出               |

---

## Navigation Items

| Label    | Path      | Active Match Rule                |
| -------- | --------- | -------------------------------- |
| 回首頁   | `/`       | `pathname === '/'`（精確比對）   |
| 會員頁面 | `/member` | `pathname.startsWith('/member')` |
| 文章     | `/posts`  | `pathname.startsWith('/posts')`  |
| 揪團頁面 | `/events` | `pathname.startsWith('/events')` |
| 跑步     | `/runs`   | `pathname.startsWith('/runs')`   |

---

## Responsive Behavior

| Viewport  | 顯示內容                                   |
| --------- | ------------------------------------------ |
| `< 768px` | Logo/站名 + 漢堡按鈕。導覽連結在滑出面板中 |
| `≥ 768px` | Logo/站名 + 水平連結列 + 使用者區域        |

實作方式：CSS media queries hide/show，兩套 UI 同時在 DOM 中。

---

## Accessibility Contract

### Semantic Structure

```html
<nav aria-label="主要導覽">
  <!-- 品牌 -->
  <a href="/">Dive Into Run</a>

  <!-- 桌面：水平連結 -->
  <ul role="list">
    <li><a href="/events" aria-current="page">揪團頁面</a></li>
    ...
  </ul>

  <!-- 桌面：使用者選單 -->
  <button aria-expanded="false" aria-haspopup="true">
    <img alt="使用者頭像" />
  </button>
  <ul role="menu">
    <li role="menuitem"><button>登出</button></li>
  </ul>

  <!-- 手機：漢堡按鈕 -->
  <button aria-label="開啟導覽選單" aria-expanded="false" aria-controls="mobile-drawer">
    <span /><span /><span />
  </button>

  <!-- 手機：滑出面板 -->
  <div id="mobile-drawer" role="dialog" aria-modal="true" aria-label="導覽選單">
    <button aria-label="關閉導覽選單">✕</button>
    <ul>
      ...
    </ul>
  </div>
</nav>
```

### Keyboard Interactions

| Key      | Context           | Action                           |
| -------- | ----------------- | -------------------------------- |
| `Tab`    | 任意位置          | 依序遍歷所有互動元素             |
| `Enter`  | 聚焦在連結/按鈕上 | 觸發該元素                       |
| `Space`  | 聚焦在按鈕上      | 觸發該按鈕                       |
| `Escape` | Drawer 開啟時     | 關閉 Drawer，focus 返回漢堡按鈕  |
| `Escape` | Dropdown 開啟時   | 關閉 Dropdown，focus 返回 avatar |

### Focus Management

- **Drawer 開啟**：focus 移至關閉按鈕
- **Drawer 關閉**：focus 返回漢堡按鈕
- **Dropdown 開啟**：focus 移至第一個選單項目
- **Dropdown 關閉**：focus 返回 avatar 按鈕

---

## CSS Module Classes

**File**: `src/components/Navbar/Navbar.module.css`

| Class             | Element                     | Description                   |
| ----------------- | --------------------------- | ----------------------------- |
| `.navbar`         | `<nav>`                     | Root — sticky, flex, z-index  |
| `.brand`          | `<a>`                       | Logo/站名連結                 |
| `.desktopLinks`   | `<ul>`                      | 桌面水平連結容器              |
| `.link`           | `<a>`                       | 導覽連結                      |
| `.linkActive`     | `<a>`                       | Active 狀態樣式               |
| `.userSection`    | `<div>`                     | 使用者區域容器                |
| `.avatar`         | `<button>` wrapping `<img>` | 頭像按鈕（dropdown trigger）  |
| `.avatarImage`    | `<img>`                     | 頭像圖片                      |
| `.dropdown`       | `<ul>`                      | 下拉選單                      |
| `.dropdownOpen`   | `<ul>`                      | 下拉選單展開狀態              |
| `.skeleton`       | `<div>`                     | Loading 骨架動畫              |
| `.hamburger`      | `<button>`                  | 漢堡按鈕                      |
| `.hamburgerLine`  | `<span>`                    | 漢堡線條（3 條）              |
| `.hamburgerOpen`  | `<button>`                  | 漢堡按鈕開啟狀態（✕ 動畫）    |
| `.overlay`        | `<div>`                     | 半透明背景遮罩                |
| `.overlayVisible` | `<div>`                     | 遮罩可見狀態                  |
| `.drawer`         | `<div>`                     | 滑出面板                      |
| `.drawerOpen`     | `<div>`                     | 面板開啟狀態（translateX(0)） |
| `.drawerLinks`    | `<ul>`                      | 面板內連結列表                |
| `.drawerClose`    | `<button>`                  | 面板關閉按鈕                  |
| `.loginButton`    | `<button>`                  | 登入按鈕                      |

---

## Service Layer Contract

### `src/lib/firebase-auth-helpers.js`

```js
/**
 * 使用 Google 帳號登入。
 * @returns {Promise<import('firebase/auth').UserCredential>} 登入結果。
 * @throws {Error} 登入失敗時拋出錯誤。
 */
export async function signInWithGoogle() {}

/**
 * 登出目前使用者。
 * @returns {Promise<void>}
 * @throws {Error} 登出失敗時拋出錯誤。
 */
export async function signOutUser() {}
```

---

## Layout Integration Contract

### `src/app/layout.jsx` 修改

**Before**:

```jsx
<html lang="en">
export const metadata = { title: 'Create Next App', ... };
<nav className="main-nav">...</nav>
<hr />
```

**After**:

```jsx
<html lang="zh-Hant-TW">
export const metadata = { title: 'Dive Into Run', ... };
<Navbar />
{/* <hr /> 移除 */}
```

### `src/app/globals.css` 修改

移除 `.main-nav a` 樣式規則。
