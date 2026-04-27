---
paths:
  - 'src/**/*.{js,jsx}'
  - 'specs/**/*.{js,jsx}'
  - 'tests/**/*.{js,jsx}'
---

# Code Style Quick Reference

> 完整編碼規範 → `.claude/references/coding-standards.md`

## Formatting

- **Semicolons**: always
- **Quotes**: single `'` in JS, double `"` in JSX attributes
- **Indent**: 2 spaces
- **Trailing commas**: ES5 (objects, arrays, params)
- **Variables**: `const` default, `let` only for reassignment, **never** `var`
- **Destructuring**: required for objects and arrays when accessing multiple properties

## JSDoc Patterns (checkJs: true)

```js
// Callback / function type
/** @param {(id: string) => void} onUpdate */

// Typedef
/** @typedef {{ id: string, name: string, email?: string }} User */

// Component props (destructured)
/**
 * @param {Object} props
 * @param {User} props.user
 * @param {(id: string) => void} props.onUpdate
 */
function UserCard({ user, onUpdate }) {}

// Import external type
/** @param {import('@/service/event-service').EventData} event */

// Type casting
const el = /** @type {HTMLInputElement} */ (document.getElementById('x'));
```
