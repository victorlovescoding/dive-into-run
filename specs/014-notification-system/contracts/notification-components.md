# Contract: Notification Components & Context

---

## NotificationContext (`src/contexts/NotificationContext.jsx`)

### Context Value

```js
/**
 * @typedef {object} NotificationContextValue
 * @property {number} unreadCount - 未讀通知數量（上限 100，>= 100 顯示 99+）。
 * @property {import('@/lib/firebase-notifications').NotificationItem[]} notifications - 目前顯示的通知列表。
 * @property {boolean} isPanelOpen - 通知面板是否開啟。
 * @property {'all'|'unread'} activeTab - 目前分頁標籤。
 * @property {boolean} hasMore - 是否有更多通知可載入。
 * @property {boolean} isLoadingMore - 是否正在載入更多通知。
 * @property {boolean} hasLoadedMore - 是否已執行過「查看先前通知」（用於切換至無限滾動）。
 * @property {() => void} togglePanel - 切換面板開關。
 * @property {() => void} closePanel - 關閉面板。
 * @property {(tab: 'all'|'unread') => void} setActiveTab - 切換分頁。
 * @property {() => Promise<void>} loadMore - 載入更多通知。
 * @property {(notificationId: string) => Promise<void>} markAsRead - 標記單則通知已讀。
 */
```

### Provider 行為

1. **登入時**：啟動 Listener 1（未讀）+ Listener 2（最新 5 則）
2. **登出時**：清除所有監聽器 + 重置狀態
3. **Tab 切換**：
   - `'all'`：顯示 Listener 2 資料 + 已分頁載入資料
   - `'unread'`：顯示 Listener 1 資料（前 5 則 slice）+ 已分頁載入資料
4. **新通知偵測**（toast）：
   - 透過 `watchNotifications` 的 `onNew` callback 接收新通知（service layer 內部處理 `docChanges` + `isInitialLoad`，Context 不直接碰 Firestore snapshot）
   - 面板關閉時才觸發 toast queue
5. **markAsRead**：
   - 呼叫 `markNotificationAsRead(id)`
   - 樂觀更新：本地立即標記 read = true，不等 onSnapshot 回寫

### Toast Queue（內部管理）

```js
/**
 * @typedef {object} NotificationToastItem
 * @property {string} id - 唯一 ID。
 * @property {string} message - 通知訊息文字。
 */
```

- 佇列模式：一次顯示一則，5 秒後自動移除，顯示下一則
- 面板開啟時暫停出列（不顯示 toast）
- 面板關閉後恢復出列

---

## Components

### NotificationBell (`src/components/Notifications/NotificationBell.jsx`)

```js
/**
 * 鈴鐺圖示 + 未讀數量徽章。點擊切換通知面板。
 * @returns {import('react').JSX.Element|null} 鈴鐺元件（未登入時回傳 null）。
 */
```

**行為**：

- 面板關閉：空心鈴鐺（outlined）
- 面板開啟：實心鈴鐺（filled）
- 有未讀：右上角紅色數字徽章
- 未讀 > 99：顯示「99+」
- 未讀 = 0：不顯示徽章
- 點擊：呼叫 `togglePanel()`

**Props**: 無（從 NotificationContext 取值）

**a11y**:

- `<button>` 元素
- `aria-label="通知"` 或 `aria-label="通知，${unreadCount} 則未讀"`
- `aria-expanded={isPanelOpen}`
- `aria-controls="notification-panel"`

---

### NotificationPanel (`src/components/Notifications/NotificationPanel.jsx`)

```js
/**
 * 通知下拉面板，含分頁標籤與通知列表。
 * @returns {import('react').JSX.Element|null} 面板元件（面板關閉時回傳 null）。
 */
```

**行為**：

- 從鈴鐺下方展開的 dropdown
- 最大高度 `70vh`，超出內部滾動
- 手機版寬度接近全螢幕
- 頂部：「通知」標題 + 「全部」/「未讀」分頁標籤
- 中間：通知列表（NotificationItem × N）
- 底部（條件性）：「查看先前通知」按鈕
- 空狀態：「目前沒有通知」/「沒有未讀通知」
- 點擊面板外區域：關閉面板

**Props**: 無（從 NotificationContext 取值）

**a11y**:

- `id="notification-panel"`
- `role="region"`
- `aria-label="通知面板"`
- 分頁標籤用 `role="tablist"` + `role="tab"` + `aria-selected`

---

### NotificationItem (`src/components/Notifications/NotificationItem.jsx`)

```js
/**
 * 單則通知列（頭像 + 訊息 + 時間 + 未讀圓點）。
 * @param {object} props
 * @param {import('@/lib/firebase-notifications').NotificationItem} props.notification - 通知資料。
 * @param {() => void} props.onClick - 點擊回呼（標記已讀 + 導航 + 關閉面板）。
 * @returns {import('react').JSX.Element} 通知列元件。
 */
```

**佈局**：

```
[圓形頭像] [訊息文字        ] [藍色圓點]
           [相對時間（灰色）]
```

**行為**：

- 點擊：`onClick` → markAsRead + router.push(getNotificationLink) + closePanel
- 未讀：右側藍色圓點
- 已讀：無圓點

**a11y**:

- 可聚焦的互動元素（`<a>` 或 `<button>`）
- `aria-label` 包含完整通知描述

---

### NotificationToast (`src/components/Notifications/NotificationToast.jsx`)

```js
/**
 * 新通知 toast 提示。一次顯示一則，5 秒後自動消失。
 * @returns {import('react').JSX.Element|null} Toast 元件（無待顯示時回傳 null）。
 */
```

**行為**：

- 從 NotificationContext 讀取 toast queue
- 一次僅渲染一則
- 5 秒後自動淡出移除
- 不可點擊（純提示）
- 不可由使用者關閉

**Props**: 無（從 NotificationContext 取值）

**a11y**:

- `role="status"`
- `aria-live="polite"`

---

## 面板外點擊關閉機制

使用與現有 UserMenu 相同的 pattern：

- `useRef` 追蹤面板 + 鈴鐺元素
- `useEffect` 監聯 `mousedown` 事件
- 點擊目標不在 ref 範圍內 → `closePanel()`

---

## Navbar 整合

### Desktop

```jsx
{/* 現有 desktopLinks 之後 */}
{user && <NotificationBell />}
<UserMenu ... />
```

### Mobile

```jsx
{
  /* hamburger 之後，與 hamburger 相鄰 */
}
{
  user && <NotificationBell />;
}
```

Bell + Panel 始終在 `<nav>` 內，不進入 MobileDrawer。

---

## Provider 層級（`src/app/layout.jsx`）

```jsx
<AuthContext.Provider>
  <ToastProvider>
    <NotificationProvider>
      {' '}
      {/* 新增 — 依賴 AuthContext */}
      <Navbar />
      <NotificationToast /> {/* 全域 toast — 面板外 */}
      {children}
    </NotificationProvider>
  </ToastProvider>
</AuthContext.Provider>
```

NotificationProvider 必須在 AuthContext 內部（需要讀取 `user.uid`）。
