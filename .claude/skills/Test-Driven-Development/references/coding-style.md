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
