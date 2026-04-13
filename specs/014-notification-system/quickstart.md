# Quickstart: 通知系統 (Notification System)

**Branch**: `014-notification-system` | **Date**: 2026-04-13

---

## 新增檔案清單

| 檔案路徑                                                    | 用途                                        |
| ----------------------------------------------------------- | ------------------------------------------- |
| `src/lib/firebase-notifications.js`                         | Service layer：通知 CRUD + 即時監聽         |
| `src/lib/notification-helpers.js`                           | 純函式：訊息組合、相對時間、導航 URL        |
| `src/contexts/NotificationContext.jsx`                      | Context Provider：全域通知狀態 + 監聽器管理 |
| `src/components/Notifications/NotificationBell.jsx`         | 鈴鐺圖示 + 未讀徽章                         |
| `src/components/Notifications/NotificationBell.module.css`  | 鈴鐺樣式                                    |
| `src/components/Notifications/NotificationPanel.jsx`        | 下拉通知面板（分頁 + 列表）                 |
| `src/components/Notifications/NotificationPanel.module.css` | 面板樣式                                    |
| `src/components/Notifications/NotificationItem.jsx`         | 單則通知列                                  |
| `src/components/Notifications/NotificationItem.module.css`  | 通知列樣式                                  |
| `src/components/Notifications/NotificationToast.jsx`        | 新通知 toast 提示                           |
| `src/components/Notifications/NotificationToast.module.css` | Toast 樣式                                  |

## 修改檔案清單

| 檔案路徑                                    | 修改內容                                                    |
| ------------------------------------------- | ----------------------------------------------------------- |
| `src/app/layout.jsx`                        | 加入 `<NotificationProvider>`                               |
| `src/components/Navbar/Navbar.jsx`          | 在 desktopLinks 與 UserMenu 之間加入 `<NotificationBell />` |
| `src/components/Navbar/Navbar.module.css`   | 鈴鐺區域的 flex 排版調整                                    |
| `src/app/events/[id]/eventDetailClient.jsx` | 活動編輯/刪除後呼叫通知建立函式                             |
| `src/app/posts/[id]/PostDetailClient.jsx`   | 留言後呼叫通知建立函式 + scroll-to-comment                  |
| `firestore.rules`                           | 新增 `notifications` collection rules                       |
| `firestore.indexes.json`                    | 新增 2 組 composite indexes                                 |

## 實作建議順序

```
1. notification-helpers.js     ← 純函式，零依賴，最好 TDD
2. firebase-notifications.js   ← Service layer，依賴 helpers
3. firestore.rules + indexes   ← Security rules 就緒
4. NotificationContext.jsx     ← 全域狀態 + 監聽器
5. NotificationBell.jsx        ← 鈴鐺 + 徽章
6. NotificationItem.jsx        ← 單則通知渲染
7. NotificationPanel.jsx       ← 面板（含分頁、分頁載入、無限滾動）
8. NotificationToast.jsx       ← Toast 提示
9. Navbar 整合                 ← 放入鈴鐺 + Provider
10. 活動/文章頁面整合          ← 觸發通知建立
11. scroll-to-comment          ← 文章詳文頁的留言定位 + 高亮
```

## 關鍵依賴

- `NotificationContext` 依賴 `AuthContext`（需要 `user.uid`）
- `firebase-notifications.js` 依賴 `firebase-events.js`（`fetchParticipants`）
- `NotificationPanel` 依賴 `NotificationContext`、`NotificationItem`、`notification-helpers.js`
- Firestore composite indexes 需事先部署（否則查詢會失敗）

## 必要 Firestore Indexes

部署前需確認 `firestore.indexes.json` 包含：

1. `notifications`: `recipientUid ASC` + `createdAt DESC`
2. `notifications`: `recipientUid ASC` + `read ASC` + `createdAt DESC`

開發時 Firestore 會在 console 自動提示缺少的 index 並提供建立連結。
