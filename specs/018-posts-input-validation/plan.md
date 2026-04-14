# Implementation Plan: Posts Input Validation

**Branch**: `018-posts-input-validation` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-posts-input-validation/spec.md`

## Summary

在文章 create/update 流程加入 input validation（defense-in-depth）。新增共用純函式 `validatePostInput` 驗證 title/content 的非空與長度限制（50 / 10,000 字），UI 層用 toast 提示並 early return，service 層拋出 descriptive Error 確保不合規資料永遠不進 Firestore。

## Technical Context

**Language/Version**: JavaScript (ES6+) with JSDoc + `checkJs: true`
**Primary Dependencies**: Next.js 15, React 19, Firebase v9+ (Firestore)
**Storage**: Firestore (`posts` collection) — schema 不變，僅在寫入前增加 guard
**Testing**: Vitest (unit + integration, jsdom)
**Target Platform**: Web (browser)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: N/A — 驗證為同步純函式，無效能影響
**Constraints**: 不新增 UI 元素（只用既有 toast）、不做即時字數 counter
**Scale/Scope**: 修改 3 檔案、新增 ~50 行驗證邏輯、5 個測試檔案

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status  | Notes                                                           |
| ----------------------------- | ------- | --------------------------------------------------------------- |
| I. SDD/TDD                    | ✅ PASS | Spec 完整（10 FR + 3 US），TDD red-green-refactor 會嚴格遵守    |
| II. Strict Service Layer      | ✅ PASS | 驗證邏輯放 `src/lib/firebase-posts.js`，UI 只 import lib export |
| III. UX & Consistency         | ✅ PASS | 錯誤訊息用正體中文、沿用既有 `showToast` 機制                   |
| IV. Performance & Concurrency | ✅ N/A  | 驗證為同步純函式，不涉及併發寫入                                |
| V. Code Quality               | ✅ PASS | MVP — 單一純函式 + 兩個常數，無過度抽象                         |
| VI. Modern Dev Standards      | ✅ PASS | JSDoc 完整標註、`const` only、destructuring                     |
| VII. Security                 | ✅ N/A  | 不涉及 secrets                                                  |
| VIII. Agent Interaction       | ✅ PASS | 修改前必取得使用者確認                                          |
| IX. Strict Coding Iron Rules  | ✅ PASS | 驗證邏輯抽至 helper（not in JSX）、JSDoc 描述意圖               |

**Post-Phase 1 re-check**: ✅ 所有設計決策（research.md R-001~R-006）均符合 Constitution。無 violations。

## Project Structure

### Documentation (this feature)

```text
specs/018-posts-input-validation/
├── plan.md                           # This file
├── spec.md                           # Feature specification
├── research.md                       # Phase 0: design decisions
├── data-model.md                     # Phase 1: entity + validation rules
├── quickstart.md                     # Phase 1: implementation guide
├── contracts/
│   └── validate-post-input.md        # Phase 1: function contract
└── tests/
    ├── unit/
    │   ├── validate-post-input.test.js
    │   ├── create-post-validation.test.js
    │   └── update-post-validation.test.js
    └── integration/
        ├── post-form-validation.test.jsx
        └── post-edit-validation.test.jsx
```

### Source Code (repository root)

```text
src/lib/
└── firebase-posts.js       # 新增: validatePostInput, POST_TITLE_MAX_LENGTH, POST_CONTENT_MAX_LENGTH
                             # 修改: createPost, updatePost 加入驗證 guard

src/app/posts/
├── page.jsx                # 修改: handleSubmitPost 加入 validatePostInput + toast
└── [id]/
    └── PostDetailClient.jsx # 修改: handleSubmitPost 加入 validatePostInput + toast
```

**Structure Decision**: 遵循既有 service layer 架構，不新增檔案。驗證函式與常數 export from `firebase-posts.js`，與 `firebase-comments.js` 的 addComment 驗證模式一致。

## Design Decisions (from research.md)

| ID    | Decision                                            | Rationale                             |
| ----- | --------------------------------------------------- | ------------------------------------- |
| R-001 | 驗證放 `firebase-posts.js`                          | Constitution II + 既有 pattern        |
| R-002 | 回傳 `string \| null`                               | MVP，只需 toast 顯示                  |
| R-003 | 兩欄皆空時合併訊息                                  | US1-AC3 明確要求                      |
| R-004 | `string.length` 計算字數                            | Spec assumption + event comments 一致 |
| R-005 | Error 格式 `fnName: message`                        | 與 addComment pattern 一致            |
| R-006 | `POST_TITLE_MAX_LENGTH` / `POST_CONTENT_MAX_LENGTH` | FR-010 共用來源                       |

## Implementation Approach

### Service Layer (`firebase-posts.js`)

```js
// 新增 exports
export const POST_TITLE_MAX_LENGTH = 50;
export const POST_CONTENT_MAX_LENGTH = 10000;

export function validatePostInput({ title, content }) {
  // trim → both-empty → single-empty → length checks
  // Returns error message string or null
}

// 修改 createPost — 開頭加入:
const error = validatePostInput({ title, content });
if (error) throw new Error(`createPost: ${error}`);

// 修改 updatePost — 開頭加入:
const error = validatePostInput({ title, content });
if (error) throw new Error(`updatePost: ${error}`);
```

### UI Layer (page.jsx + PostDetailClient.jsx)

```js
// handleSubmitPost — 在 e.preventDefault() 後、try 前加入:
const validationError = validatePostInput({ title, content });
if (validationError) {
  showToast(validationError, 'error');
  return;
}
```

## Task Dependency Graph

```text
T1: validatePostInput + constants (純函式)
    │
    ├──▶ T2: createPost validation (depends T1)
    ├──▶ T3: updatePost validation (depends T1, parallel with T2)
    │
    ├──▶ T4: page.jsx UI validation (depends T1)
    └──▶ T5: PostDetailClient UI validation (depends T1, parallel with T4)
```

- T2 + T3 可平行
- T4 + T5 可平行
- 所有 task 依賴 T1

## Complexity Tracking

> 無 Constitution violations，此區段不適用。
