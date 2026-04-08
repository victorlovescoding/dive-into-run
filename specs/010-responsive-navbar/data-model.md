# Data Model: 響應式導覽列 (RWD Navbar)

**Branch**: `010-responsive-navbar` | **Date**: 2026-04-08

> 此功能無 Firestore 實體。資料模型涵蓋元件配置與內部狀態。

---

## Entities

### NavItem（導覽項目配置）

靜態常數陣列，定義導覽列所有連結項目。

| Field | Type     | Required | Description               |
| ----- | -------- | -------- | ------------------------- |
| href  | `string` | ✅       | 路由路徑（如 `/events`）  |
| label | `string` | ✅       | 顯示文字（如 `揪團頁面`） |

**JSDoc typedef**:

```js
/**
 * @typedef {object} NavItem
 * @property {string} href - 路由路徑。
 * @property {string} label - 顯示文字。
 */
```

**Configuration constant**:

```js
/** @type {NavItem[]} */
const NAV_ITEMS = [
  { href: '/', label: '回首頁' },
  { href: '/member', label: '會員頁面' },
  { href: '/posts', label: '文章' },
  { href: '/events', label: '揪團頁面' },
  { href: '/runs', label: '跑步' },
];
```

---

### AuthState（認證狀態 — 來自現有 AuthContext）

不新增定義，直接使用 `AuthContext` 提供的值。

| Property | Type             | Source      | Description                              |
| -------- | ---------------- | ----------- | ---------------------------------------- |
| user     | `object \| null` | AuthContext | 當前登入使用者（含 uid, name, photoURL） |
| loading  | `boolean`        | AuthContext | 認證狀態載入中                           |

---

## Component Internal State

### Navbar State

| State          | Type      | Default | Description                  |
| -------------- | --------- | ------- | ---------------------------- |
| isDrawerOpen   | `boolean` | `false` | 手機版滑出面板開關狀態       |
| isDropdownOpen | `boolean` | `false` | 桌面版使用者下拉選單開關狀態 |

---

## State Transitions

### Drawer State Machine

```text
CLOSED ──(hamburger click)──► OPEN
OPEN ──(link click)──────────► CLOSED
OPEN ──(overlay click)───────► CLOSED
OPEN ──(close button)────────► CLOSED
OPEN ──(Escape key)──────────► CLOSED
OPEN ──(viewport ≥ 768px)───► CLOSED
```

**Side effects on OPEN**:

- `document.body.style.overflow = 'hidden'`（鎖定背景滾動）
- Focus 移至面板內關閉按鈕

**Side effects on CLOSED**:

- `document.body.style.overflow = ''`（恢復滾動）
- Focus 返回漢堡按鈕

### Dropdown State Machine

```text
CLOSED ──(avatar click)──────► OPEN
OPEN ──(option click)────────► CLOSED
OPEN ──(outside click)───────► CLOSED
OPEN ──(Escape key)──────────► CLOSED
```

### Auth Display Logic

```text
loading === true  ──► 顯示 skeleton 圓形骨架
loading === false && user !== null  ──► 顯示頭像（桌面：dropdown trigger / 手機：面板內頭像 + 登出）
loading === false && user === null  ──► 顯示「登入」按鈕
```

---

## Validation Rules

- `NavItem.href` 必須以 `/` 開頭
- `NavItem.label` 不得為空字串
- `isDrawerOpen` 和 `isDropdownOpen` 互斥（桌面不顯示 drawer，手機不顯示 dropdown）— 由 CSS media query 天然保證，無需 JS 邏輯

---

## Relationships

```text
Navbar (component)
├── uses AuthContext (read-only)
│   └── { user, loading }
├── contains NAV_ITEMS[] (static config)
├── manages isDrawerOpen (state)
├── manages isDropdownOpen (state)
└── calls firebase-auth-helpers (service layer)
    ├── signInWithGoogle()
    └── signOutUser()
```
