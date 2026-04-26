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
5. **Forward-only layer imports** — Types → Config → Repo → Service → Runtime → UI
   - Canonical layers must not import `src/lib/` — import from canonical home
   - Providers must not import `src/repo/` or `src/service/` — route through use-cases
   - `src/app/` must not import `src/config/` or `src/repo/` directly
   - Client files must not import `**/server/**`; `firebase-admin` requires server path
   - `src/` must not import `specs/`
   - `src/lib/` must not import React / Next.js / react-leaflet
   - Type-only imports (`@typedef`, `@param {import(...)}`) are exempt
6. **300-line file limit** — `src/**/*.{js,jsx}` max 300 lines (skipBlankLines, skipComments); `src/config/geo/**` exempt
