---
paths:
  - 'src/**'
  - 'specs/**'
---

# Strict Coding Rules (Non-Negotiable)

1. **No `@ts-ignore`** — use `@ts-expect-error` with explanation if absolutely necessary. Verify with `grep -r "@ts-ignore" src specs`
2. **No logic in JSX** — extract complex logic into components or helper functions. JSX handles view only
3. **No `eslint-disable` for a11y rules** — fix the HTML structure (roles, labels, handlers) instead
4. **Meaningful JSDoc** — all new/modified exported functions must have JSDoc explaining intent and params, not boilerplate
   - `@typedef` must use lowercase `{object}`, not `{Object}`
   - Every `@property` must include a description (e.g. `@property {string} city - 活動所在縣市。`)
   - Every `@param` must include a description
