# Quickstart: Posts 頁面 Bug 修復 (A1 + A3 + A4)

**Branch**: `016-posts-bug-fix` | **Date**: 2026-04-14

## 修改範圍

| 檔案                                      | Bug | 變更                                                  |
| ----------------------------------------- | --- | ----------------------------------------------------- |
| `src/app/posts/page.jsx`                  | A1  | `composeButtonHandler`: 取消註解 guard clause + toast |
| `src/app/posts/page.jsx`                  | A4  | `pressLikeButton`: 改為 capture-and-restore           |
| `src/app/posts/[id]/PostDetailClient.jsx` | A3  | 移除 `isCommentEditing` state + 3 處 setter           |

## 驗證步驟

```bash
# 1. Type check
npm run type-check

# 2. Lint
npm run lint

# 3. 手動測試（dev server）
npm run dev
# → 建立文章 → 編輯 → 按讚 → 留言建立/編輯/取消
```

## 不做的事

- 不寫自動化測試（SC-005）
- 不修改 service layer（`src/lib/`）
- 不修改 Firestore schema
- 不處理 A2（deletePost subcollection）、A5（validation）、A6（migration）
