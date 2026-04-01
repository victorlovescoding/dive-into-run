# Quickstart: 005-event-comments

## Prerequisites

```bash
npm install          # 安裝依賴（本 feature 無新增套件）
```

## Development

```bash
npm run dev          # 啟動 dev server on localhost:3000
```

1. 開啟 `http://localhost:3000/events/{eventId}` 任一活動詳情頁
2. 捲到路線圖下方即可看到留言區
3. 登入後可見浮動輸入框（底部固定）

## Testing

```bash
# Unit tests (firebase-comments service layer)
npx vitest run specs/005-event-comments/tests/unit/

# Integration tests (comment UI components)
npx vitest run specs/005-event-comments/tests/integration/

# E2E tests (需要 dev server 先啟動)
npx playwright test specs/005-event-comments/tests/e2e/

# 全部測試
npm run test
```

## Verification

```bash
npm run type-check   # JSDoc type checking
npm run lint         # ESLint
```

## Key Files

| File                                        | Purpose                         |
| ------------------------------------------- | ------------------------------- |
| `src/lib/firebase-comments.js`              | Service layer — CRUD + history  |
| `src/components/CommentSection.jsx`         | 留言區主容器                    |
| `src/components/CommentCard.jsx`            | 單則留言卡片                    |
| `src/components/CommentInput.jsx`           | 浮動輸入框                      |
| `src/components/CommentEditModal.jsx`       | 編輯留言 modal                  |
| `src/components/CommentDeleteConfirm.jsx`   | 刪除確認 dialog                 |
| `src/components/CommentHistoryModal.jsx`    | 編輯記錄 modal                  |
| `src/app/events/[id]/eventDetailClient.jsx` | 接入點（render CommentSection） |
