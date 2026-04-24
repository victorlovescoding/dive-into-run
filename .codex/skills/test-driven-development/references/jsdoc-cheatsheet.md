# JSDoc Cheatsheet — TDD Supplement

> **Common patterns** (typedef, props, import, casting): See `CLAUDE.md` §"JSDoc Patterns (checkJs: true)".
> This file only covers patterns **not** in CLAUDE.md.

## Named Callback (`@callback`)

Use when the same function signature is reused across multiple JSDoc blocks:

```js
/**
 * @callback UpdateCallback
 * @param {string} id
 * @returns {void}
 */

/** @param {UpdateCallback} onUpdate */
function subscribe(onUpdate) {}
```

Prefer inline arrow syntax for one-off usage:

```js
/** @param {(id: string) => void} onUpdate */
```

## Google Closure vs TypeScript Syntax

This project uses **TypeScript syntax** (better VS Code support):

```js
// PREFERRED: TypeScript arrow syntax
/** @param {(id: string) => void} onUpdate */

// AVOID: Google Closure syntax (verbose, weaker IDE support)
/** @param {function(string): void} onUpdate */
```
