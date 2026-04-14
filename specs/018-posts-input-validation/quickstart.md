# Quickstart: Posts Input Validation

**Branch**: `018-posts-input-validation` | **Date**: 2026-04-15

---

## 實作概覽

本 feature 在文章 create/update 流程加入 input validation（defense-in-depth），共修改 1 個 service 檔案 + 2 個 UI 檔案。

## 修改檔案清單

### 1. `src/lib/firebase-posts.js`（Service 層）

**新增 exports**:

- `POST_TITLE_MAX_LENGTH` (50)
- `POST_CONTENT_MAX_LENGTH` (10000)
- `validatePostInput({ title, content })` → `string | null`

**修改**:

- `createPost`: 開頭加入 `validatePostInput` 呼叫，失敗 throw Error
- `updatePost`: 開頭加入 `validatePostInput` 呼叫，失敗 throw Error

**參考模式**: `firebase-comments.js:103-109`（addComment 的 trim + empty + length check）

### 2. `src/app/posts/page.jsx`（建立 + 編輯表單）

**修改**: `handleSubmitPost`（line ~190）

- 在 try block 前加入 `validatePostInput` 呼叫
- 失敗 → `showToast(error, 'error')` + `return`

### 3. `src/app/posts/[id]/PostDetailClient.jsx`（文章詳情編輯表單）

**修改**: `handleSubmitPost`（line ~198）

- 在 try block 前加入 `validatePostInput` 呼叫
- 失敗 → `showToast(error, 'error')` + `return`

## 測試結構

```text
specs/018-posts-input-validation/tests/
├── unit/
│   ├── validate-post-input.test.js       # validatePostInput 純函式測試
│   ├── create-post-validation.test.js    # createPost 驗證整合 (mock Firestore)
│   └── update-post-validation.test.js    # updatePost 驗證整合 (mock Firestore)
└── integration/
    ├── post-form-validation.test.jsx     # page.jsx 表單送出驗證行為
    └── post-edit-validation.test.jsx     # PostDetailClient.jsx 編輯送出驗證行為
```

## 實作順序建議

```text
T1: 新增 validatePostInput + 常數 (純函式，無依賴)
    ↓
T2: createPost 加入驗證 ──┐
T3: updatePost 加入驗證 ──┤ (可平行)
    ↓                      ↓
T4: page.jsx UI 驗證 ─────┐
T5: PostDetailClient UI 驗證 ┤ (可平行)
```

## 注意事項

- **不做即時字數 counter**（spec assumption：留給 UI redesign）
- **不做 inline error message**（spec assumption：只用 toast）
- **不改 post comments 驗證**（spec assumption：不在範圍內）
- **Error handling 不變**：service 層 throw 的 Error 會被既有 try-catch + `showToast(..., 'error')` 捕獲，但 UI 層提前攔截可避免不必要的 Firestore 請求
