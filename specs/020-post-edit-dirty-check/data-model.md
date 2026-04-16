# Data Model: Post Edit Dirty Check

**Feature**: 020-post-edit-dirty-check | **Date**: 2026-04-16

> 本 feature 為**純 UI 行為變更**，不涉及 Firestore schema 或 domain entity 變動。此文件描述編輯對話框生命週期內的 **UI state shape**，對應 spec 的 Key Entities 章節。

---

## Entity 1 — Post Draft State（編輯對話框內的當前輸入狀態）

**Owner**: parent component（`src/app/posts/page.jsx` 與 `src/app/posts/[id]/PostDetailClient.jsx`）
**Lifetime**: 從使用者點擊「編輯」開啟 dialog 起，至 dialog 關閉止（成功送出後、或手動 cancel）。

### Shape

```js
/**
 * @typedef {object} PostDraftState
 * @property {string} title - 使用者當前輸入的標題（受控輸入，未 trim）。
 * @property {string} content - 使用者當前輸入的內文（受控輸入，未 trim）。
 */
```

### State Transitions

| Event                     | `title`                         | `content`             |
| ------------------------- | ------------------------------- | --------------------- |
| parent 初始化（未編輯中） | `''`                            | `''`                  |
| 點擊「編輯 post X」       | `post.title`（raw，含原始空白） | `post.content`（raw） |
| 使用者鍵盤輸入            | 每次 keystroke 更新             | 每次 keystroke 更新   |
| 成功送出 → dialog 關閉    | reset 為 `''`                   | reset 為 `''`         |
| 取消 / dialog 關閉        | reset 為 `''`                   | reset 為 `''`         |

### Validation

- 觸發時機：**使用者按下「更新」**（lazy validation）。
- 規則：沿用 `validatePostInput({ title, content })`（`src/lib/firebase-posts.js:35-46`），無變更。

---

## Entity 2 — Original Post Snapshot（dirty 比較基準）

**Owner**: parent component（同 Post Draft State）
**Lifetime**: 從「點擊編輯 post X」起，至 dialog 關閉止；**單次開啟生命週期內 immutable**。

### Shape

```js
/**
 * @typedef {object} OriginalPostSnapshot
 * @property {string} originalTitle - 對話框開啟當下載入的文章原始標題（raw，含原始空白）。
 * @property {string} originalContent - 對話框開啟當下載入的文章原始內文（raw）。
 */
```

### State Transitions

| Event                      | `originalTitle`                                   | `originalContent` |
| -------------------------- | ------------------------------------------------- | ----------------- |
| parent 初始化（未編輯中）  | `''`                                              | `''`              |
| 點擊「編輯 post X」        | `post.title`（與 Post Draft State 的 title 同值） | `post.content`    |
| 使用者輸入（不論如何編輯） | **不變**                                          | **不變**          |
| 成功送出 → dialog 關閉     | reset 為 `''`                                     | reset 為 `''`     |
| 取消 / dialog 關閉         | reset 為 `''`                                     | reset 為 `''`     |

### Invariants

- **I1**：`originalTitle` 與 `originalContent` 在單次 dialog 開啟期間**絕不變動**（即使使用者切換到其他視窗又回來、即使其他 session 更新了該文章）。
- **I2**：新增模式（`isEditing=false`）時 parent **不傳入** `originalTitle` / `originalContent`（或傳 undefined），ComposeModal 判斷 `isEditing` 決定是否啟用 dirty gate。

---

## Derived Value — `isDirty`

**Owner**: `ComposeModal.jsx`（computed inside component body，非 state）
**Definition**:

```js
// 只在編輯模式下有意義；新增模式 isDirty 永遠 true（亦即不 gate）
const isDirty = isEditing
  ? title.trim() !== (originalTitle ?? '').trim() ||
    content.trim() !== (originalContent ?? '').trim()
  : true;
```

### Behavior Spec

| Scenario                                    | 期望結果                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `isEditing=false`（新增模式）               | `isDirty === true`，按鈕不因 dirty gate 停用                                                              |
| `isEditing=true` 且所有欄位與原始值完全相同 | `isDirty === false`，按鈕停用                                                                             |
| `isEditing=true` 且 title 改動              | `isDirty === true`                                                                                        |
| `isEditing=true` 且僅 content 改動          | `isDirty === true`                                                                                        |
| `isEditing=true` 且 title 改後再改回原樣    | `isDirty === false`（spec FR-004）                                                                        |
| `isEditing=true` 且 title 只加前後空白      | `isDirty === false`（trim 後與 original 相同，spec Edge Case）                                            |
| `isEditing=true` 且 title 改為純空白        | `isDirty === true`（trim 後 `''` ≠ 原 title），但送出時 `validatePostInput` 擋下（spec Clarification Q2） |

---

## Derived Value — `submitDisabled`

**Owner**: `ComposeModal.jsx`
**Definition**:

```js
const submitDisabled = (isEditing && !isDirty) || !!isSubmitting;
```

### Behavior Spec

| Scenario                   | `submitDisabled`                   |
| -------------------------- | ---------------------------------- |
| 新增模式、未送出中         | `false`                            |
| 新增模式、送出中           | `true`（避免重複送出，Decision 4） |
| 編輯模式、非 dirty、未送出 | `true`                             |
| 編輯模式、dirty、未送出    | `false`                            |
| 編輯模式、dirty、送出中    | `true`                             |

---

## Derived Value — Button Label

**Owner**: `ComposeModal.jsx`
**Definition**:

```js
const submitText = isEditing ? (isSubmitting ? '更新中…' : '更新') : '發布';
```

> 新增模式不切換 label（spec 未規範；保持最小變更）。

---

## Entity 3 — Submission State

**Owner**: parent component
**Lifetime**: `isSubmitting` 僅在 `updatePost` / `createPost` 呼叫期間為 `true`。

### Shape

```js
/**
 * @typedef {object} SubmissionState
 * @property {boolean} isSubmitting - 送出請求是否進行中。
 */
```

### State Transitions

| Event                                                       | `isSubmitting` |
| ----------------------------------------------------------- | -------------- |
| 初始                                                        | `false`        |
| `handleSubmit` 進入 `try` block                             | `true`         |
| `await updatePost(...)` resolve 或 reject（`finally` 區塊） | `false`        |

---

## Relationship to Firestore Schema

- **無變更**：`posts/{postId}` 文件結構維持 `{ authorUid, title, content, authorImgURL, authorName, postAt, likesCount, commentsCount }`。
- **唯一影響**：`updatePost` 寫入 Firestore 的 `title` / `content` 值改為 `String.prototype.trim()` 後的結果（spec FR-010）。現行文件若已有前後空白，會在下次編輯儲存時被自動清掉 — 此為 acceptable side effect，spec Edge Case 已含蓋。
