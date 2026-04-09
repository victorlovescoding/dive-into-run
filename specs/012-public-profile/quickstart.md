# Quickstart: 使用者公開檔案頁面 (Public Profile)

**Feature Branch**: `012-public-profile`
**Date**: 2026-04-10

---

## 快速理解

本功能新增 `/users/[uid]` 公開檔案頁面，讓任何人（含未登入訪客）瀏覽跑者的個人資訊與跑步歷程。同時將全站使用者名稱/頭像升級為可點擊連結。

### 核心功能

1. **公開檔案頁面** — 頭像、名稱、簡介、加入日期、統計數據、主辦活動列表
2. **全站 UserLink** — 所有使用者名稱/頭像可點擊跳轉至公開檔案
3. **Bio 編輯** — 會員頁面新增簡介編輯區塊

---

## 新增檔案

| 檔案                                           | 用途                                                     |
| ---------------------------------------------- | -------------------------------------------------------- |
| `src/app/users/[uid]/page.jsx`                 | Server Component — generateMetadata + 渲染 ProfileClient |
| `src/app/users/[uid]/ProfileClient.jsx`        | Client Component — 整體頁面 layout                       |
| `src/app/users/[uid]/ProfileHeader.jsx`        | 頭像 + 名稱 + 簡介 + 加入日期                            |
| `src/app/users/[uid]/ProfileStats.jsx`         | 開團數 / 參團數 / 累計公里數                             |
| `src/app/users/[uid]/ProfileEventList.jsx`     | 主辦活動列表 (infinite scroll)                           |
| `src/app/users/[uid]/PublicProfile.module.css` | 頁面樣式                                                 |
| `src/components/UserLink.jsx`                  | 共用使用者連結元件                                       |
| `src/components/UserLink.module.css`           | UserLink 樣式                                            |
| `src/lib/firebase-profile.js`                  | 服務層 — 所有公開檔案相關查詢                            |

## 修改檔案

| 檔案                                        | 修改                                               |
| ------------------------------------------- | -------------------------------------------------- |
| `src/lib/firebase-users.js`                 | 新增 bio 相關（或直接在 firebase-profile.js 處理） |
| `src/app/member/page.jsx`                   | 新增 Bio 編輯區塊 + 「查看我的公開檔案」連結       |
| `src/components/CommentCard.jsx`            | 作者名稱/頭像 → UserLink                           |
| `src/app/events/[id]/eventDetailClient.jsx` | 主揪/參與者 → UserLink                             |
| `src/app/posts/[id]/PostDetailClient.jsx`   | 作者 → UserLink                                    |
| `src/app/events/page.jsx`                   | 活動卡片主揪 → UserLink                            |
| `src/app/posts/page.jsx`                    | 文章作者 → UserLink                                |

---

## 開發環境

```bash
# 開發
npm run dev

# 測試
npx vitest run specs/012-public-profile/tests/unit/
npx vitest run specs/012-public-profile/tests/integration/
npx playwright test specs/012-public-profile/tests/e2e/

# 品質檢查
npm run lint:changed
npm run type-check:changed
```

---

## 關鍵決策

1. **統計數據 = 即時聚合**（非 denormalized counter），因 MVP 階段使用者量小
2. **累計公里數 = Firestore `getAggregateFromServer` + `sum()`**，Firebase v12 支援
3. **UserLink 共用元件**統一處理頭像 fallback + 連結 + a11y
4. **Bio 存在 `users/{uid}.bio`**，隨既有 `watchUserProfile` onSnapshot 自動同步
5. **Server Component 只做 metadata**，所有互動邏輯在 Client Component
