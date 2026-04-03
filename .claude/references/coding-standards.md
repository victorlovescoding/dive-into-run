# Coding Standards Reference

> **用途**：implement / plan 階段的強制參考（Quality Gate）。
> **來源**：彙整自 CLAUDE.md、constitution.md (Principle V/VI/IX)、`.prettierrc`、`eslint.config.mjs`。
> **測試專用規範**請見 `.claude/skills/test-driven-development/references/`。

---

## Formatting 鐵律

| 規則     | 設定                                           |
| -------- | ---------------------------------------------- |
| 引號     | JS 用 `'`，JSX 屬性用 `"`                      |
| 分號     | 必加 `;`                                       |
| 縮排     | 2 spaces                                       |
| 尾部逗號 | all（objects, arrays, params）                 |
| 行寬     | 100 字元                                       |
| 變數宣告 | `const` 預設，`let` 僅重新賦值，**禁止 `var`** |
| 解構     | 多屬性存取時強制使用                           |

```js
// ❌ BAD
var name = user.name;
var email = user.email;
console.log('hello');

// ✅ GOOD
const { name, email } = user;
console.warn('something happened');
```

---

## JSDoc 規範

- 所有 exported functions **必須**有 JSDoc，含 `@param` 描述
- `@typedef` 用小寫 `{object}`，**禁止** `{Object}`
- `@property` 必須附描述
- **禁止** `{*}` 或 `any` — 定義具體結構
- 偏好 TypeScript arrow syntax：`(id: string) => void`

```js
// ❌ BAD
/** @typedef {Object} User */

/** @param {*} data */
function save(data) {}

// ✅ GOOD
/**
 * @typedef {object} User
 * @property {string} id - 使用者唯一識別碼。
 * @property {string} name - 顯示名稱。
 * @property {string} [email] - 電子郵件（選填）。
 */

/**
 * 儲存使用者資料至 Firestore。
 * @param {User} data - 要儲存的使用者資料。
 * @returns {Promise<void>}
 */
function save(data) {}
```

### Component Props

```js
// ✅ GOOD — JSDoc 取代 prop-types
/**
 * 使用者卡片元件。
 * @param {object} props
 * @param {User} props.user - 使用者資料。
 * @param {(id: string) => void} props.onUpdate - 更新回呼。
 */
function UserCard({ user, onUpdate }) {}
```

### Import External Types

```js
/** @param {import('@/lib/types').Event} event - 活動資料。 */
```

### Type Casting

```js
const el = /** @type {HTMLInputElement} */ (document.getElementById('x'));
```

---

## React / JSX

- **NO logic in JSX** — 複雜邏輯抽到 helper function 或子元件
- **Hook 順序**：State → Context → Refs → Effects → Handlers
- **禁止** `prop-types` — 用 JSDoc
- **禁止** `import React`（Next.js / React 19 不需要）

```jsx
// ❌ BAD — JSX 內塞邏輯
function EventList({ events }) {
  return (
    <ul>
      {events
        .filter((e) => e.status === 'active')
        .sort((a, b) => b.date - a.date)
        .map((e) => (
          <li key={e.id}>{e.title}</li>
        ))}
    </ul>
  );
}

// ✅ GOOD — 邏輯抽出
function EventList({ events }) {
  const activeEvents = getActiveEventsSorted(events);

  return (
    <ul>
      {activeEvents.map((e) => (
        <li key={e.id}>{e.title}</li>
      ))}
    </ul>
  );
}
```

---

## Architecture

- **Firebase 隔離**：所有 Firebase 邏輯封裝在 `src/lib/`，UI 元件 **禁止**直接 import Firebase SDK
- **Path alias**：`@/` → `./src/`
- **樣式**：CSS Modules + Tailwind CSS
- **地圖**：Leaflet 必須透過 `next/dynamic`（SSR: false）載入

```js
// ❌ BAD — UI 直接用 Firebase
import { doc, getDoc } from 'firebase/firestore';

// ✅ GOOD — 透過 service layer
import { getEvent } from '@/lib/firebase-events';
```

---

## 禁令清單

| 禁止                                | 替代                                      |
| ----------------------------------- | ----------------------------------------- |
| `@ts-ignore`                        | `@ts-expect-error` + 說明原因             |
| `eslint-disable` a11y 規則          | 修復 HTML 結構（roles, labels, handlers） |
| `console.log`                       | `console.warn` / `console.error`          |
| `var`                               | `const` / `let`                           |
| `fireEvent`（測試中）               | `userEvent.setup()` + `user.click()`      |
| `container.querySelector`（測試中） | `screen.getByRole` / `screen.getByText`   |

---

## 測試規範（簡要）

測試完整規範請讀以下檔案（TDD skill Quality Gate）：

1. `.claude/skills/test-driven-development/references/coding-style.md` — vi.mock typed alias、mock typedef 對齊
2. `.claude/skills/test-driven-development/references/jsdoc-cheatsheet.md` — @callback、TypeScript vs Closure syntax
3. `.claude/skills/test-driven-development/references/boilerplate.js` — 測試 golden sample
4. `.claude/skills/test-driven-development/references/testing-anti-patterns.md` — 不測試 mock 行為、不污染生產代碼
