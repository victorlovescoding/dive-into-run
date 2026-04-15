# Quickstart: Posts 頁面 UI 重新設計

**Branch**: `019-posts-ui-refactor` | **Date**: 2026-04-15

## 環境準備

```bash
# 切到 feature branch
git checkout 019-posts-ui-refactor

# 安裝依賴
npm install

# 啟動 dev server
npm run dev
```

開啟 `http://localhost:3000/posts` 查看列表頁，點擊任意文章進入詳文頁。

## 開發流程

### 1. 確認 spec 與 plan

```bash
# 讀 spec
cat specs/019-posts-ui-refactor/spec.md

# 讀 plan
cat specs/019-posts-ui-refactor/plan.md

# 讀 UI contracts
cat specs/019-posts-ui-refactor/contracts/ui-contracts.md
```

### 2. TDD 循環

每個 task 遵循 Red → Green → Refactor：

```bash
# 跑單一測試檔
npx vitest run specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx

# 跑整個 feature 測試
npx vitest run specs/019-posts-ui-refactor/tests/

# E2E
npx playwright test specs/019-posts-ui-refactor/tests/e2e/
```

### 3. Quality Gate

每個 task 完成前必須通過：

```bash
npm run type-check    # JSDoc type 檢查
npm run lint          # ESLint
```

## 關鍵檔案地圖

| 要改什麼      | 去看哪裡                                                   |
| ------------- | ---------------------------------------------------------- |
| 列表頁結構    | `src/app/posts/page.jsx`                                   |
| 列表頁樣式    | `src/app/posts/posts.module.css`                           |
| 詳文頁邏輯    | `src/app/posts/[id]/PostDetailClient.jsx`                  |
| 詳文頁樣式    | `src/app/posts/postDetail.module.css`                      |
| 留言卡片      | `src/components/CommentCard.jsx` + `.module.css`           |
| 分享按鈕      | `src/components/ShareButton.jsx`                           |
| 使用者連結    | `src/components/UserLink.jsx`                              |
| 文章 service  | `src/lib/firebase-posts.js`（不動）                        |
| 相對時間      | `src/lib/notification-helpers.js` → `formatRelativeTime()` |
| Auth context  | `src/contexts/AuthContext.jsx`                             |
| Toast context | `src/contexts/ToastContext.jsx`                            |

## 新元件清單

| 元件             | 檔案                                  | 用途              |
| ---------------- | ------------------------------------- | ----------------- |
| PostCard         | `src/components/PostCard.jsx`         | 社群風格文章卡片  |
| PostCardSkeleton | `src/components/PostCardSkeleton.jsx` | 骨架屏載入佔位    |
| ComposePrompt    | `src/components/ComposePrompt.jsx`    | Feed 頂部假輸入框 |
| ComposeModal     | `src/components/ComposeModal.jsx`     | 發文/編輯 Modal   |

## 注意事項

- **FR-024**: 純 UI 重構，不動 `src/lib/` service layer
- **authorName 缺失**: `posts` collection 無 `authorName` 欄位，卡片需 fallback（見 data-model.md）
- **CSS Modules**: 新元件一律用 CSS Modules，不用 inline styles
- **JSDoc**: 所有 export 函式/元件必須有完整 JSDoc
- **`<dialog>`**: Modal 用原生 `<dialog>` + `showModal()`，不引入 library
