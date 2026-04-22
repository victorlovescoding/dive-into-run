# Coding Style — TDD Supplement

> **Base rules**: See `CLAUDE.md` §"Strict Rules" + §"Code Style Quick Reference" for formatting, JSDoc patterns, and React/JSX rules.
> This file only covers **test-specific** conventions not in CLAUDE.md.

## JSDoc: No `any`

Do not use `{*}` or `any`. Define specific structures:

```js
// BAD
/** @param {*} data */

// GOOD
/** @param {{ id: string, name: string }} data */
```

## React Components

- Declaration: `function ComponentName() {}` or `const ComponentName = () => {}`
- Do NOT use `prop-types` — use JSDoc `@param {Object} props` instead

## Testing Mocks

- Global mocks (Leaflet, ResizeObserver) live in `vitest.setup.jsx` — do not re-mock them
- Always clear mocks if manual mocking is used (`vi.clearAllMocks()` or `mockFn.mockClear()`)

### vi.mock() Module Mock 必須建立 typed alias

`vi.mock()` 在 runtime 把 import 換成 `vi.fn()`，但 TypeScript 靜態分析只看到原始型別。
直接呼叫 `.mockResolvedValueOnce()` 會觸發 **TS2339**（property does not exist）。

**規則**：在 `vi.mock()` 區塊後，立刻為每個被 mock 的 function 建立 `/** @type {import('vitest').Mock} */` alias。

```js
import { fetchComments, addComment } from '@/lib/firebase-comments';

vi.mock('@/lib/firebase-comments', () => ({
  fetchComments: vi.fn(),
  addComment: vi.fn(),
}));

// ✅ 建立 typed alias — 之後用 mocked 版本呼叫 .mockXxx()
const mockedFetchComments = /** @type {import('vitest').Mock} */ (fetchComments);
const mockedAddComment = /** @type {import('vitest').Mock} */ (addComment);

// ✅ mock 設定用 alias
mockedFetchComments.mockResolvedValueOnce({ comments: [], lastDoc: null });

// ✅ expect 斷言可用原名（expect() 接受 any）
expect(fetchComments).toHaveBeenCalledWith('event-123');
```

**不要用 `vi.mocked()`** — 它會強制 mock 參數完全符合原始型別，導致簡化的 mock data 過不了 type check。

### Mock Typedef 必須對齊實際 function 參數

Mock 資料的 typedef（如 `MockUser`、`MockComment`）欄位名**必須**與 `plan.md` / stub 的 function 參數一致。

```js
// ❌ BAD — 照 Firebase Auth User 的欄位名寫，但 addComment 的參數要的是 name
/** @typedef {object} MockUser
 * @property {string} displayName
 */

// ✅ GOOD — 對齊 addComment(eventId, { uid, name, photoURL }, content)
/** @typedef {object} MockUser
 * @property {string} name
 */
```

**驗證方式**：寫完 typedef 後，對照 stub 的 `@param` JSDoc 確認每個欄位名都一致。
