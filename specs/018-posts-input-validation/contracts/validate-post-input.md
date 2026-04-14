# Contract: validatePostInput

**Module**: `src/lib/firebase-posts.js`
**Type**: Pure function (synchronous, no side effects)

---

## Signature

```js
/**
 * 驗證文章輸入是否合規。
 * @param {object} input - 驗證目標。
 * @param {string} input.title - 文章標題（raw，未 trim）。
 * @param {string} input.content - 文章內容（raw，未 trim）。
 * @returns {string | null} 第一個驗證錯誤訊息，或 null 表示通過。
 */
export function validatePostInput({ title, content })
```

## Exported Constants

```js
/** @type {number} 文章標題最大長度。 */
export const POST_TITLE_MAX_LENGTH = 50;

/** @type {number} 文章內容最大長度。 */
export const POST_CONTENT_MAX_LENGTH = 10000;
```

---

## Behavior

| Input (after trim)          | Return value                               |
| --------------------------- | ------------------------------------------ |
| title 空 AND content 空     | `'請輸入標題和內容'`                       |
| title 空, content 有值      | `'請輸入標題'`                             |
| title 有值, content 空      | `'請輸入內容'`                             |
| title.length > 50           | `'標題不可超過 50 字'`                     |
| content.length > 10,000     | `'內容不可超過 10,000 字'`                 |
| title 過長 AND content 過長 | `'標題不可超過 50 字'`（first error wins） |
| 皆合規                      | `null`                                     |

## Consumers

| Consumer                                  | Usage                                                   |
| ----------------------------------------- | ------------------------------------------------------- |
| `createPost` (service)                    | 驗證失敗 → `throw new Error('createPost: ${message}')`  |
| `updatePost` (service)                    | 驗證失敗 → `throw new Error('updatePost: ${message}')`  |
| `handleSubmitPost` (page.jsx)             | 驗證失敗 → `showToast(message, 'error')` + early return |
| `handleSubmitPost` (PostDetailClient.jsx) | 驗證失敗 → `showToast(message, 'error')` + early return |

## Invariants

- 所有值在 `(value ?? '').trim()` 後驗證（FR-009）
- 驗證順序固定：empty check（合併 → title → content）→ length check（title → content）
- 純函式，無 Firestore 或任何 I/O 依賴
