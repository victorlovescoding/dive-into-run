---
paths:
  - 'src/**'
  - 'specs/**'
  - 'tests/**'
---

# Strict Coding Rules (Non-Negotiable)

1. **No `@ts-ignore`** — use `@ts-expect-error` with explanation if absolutely necessary. Verify with `grep -r "@ts-ignore" src specs tests`
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
7. **React Hooks compiler gates are errors** — official `recommended-latest` plus compiler hardening blocks `rules-of-hooks`, `exhaustive-deps`, `purity`, `immutability`, `globals`, `refs`, `set-state-in-render`, `set-state-in-effect`, `static-components`, `component-hook-factories`, `preserve-manual-memoization`, `incompatible-library`, `unsupported-syntax`, `config`, `gating`, `error-boundaries`, `use-memo`, and `void-use-memo`
8. **Next Core Web Vitals are hard gates** — `@next/next/core-web-vitals` rules are enforced; `@next/next/no-img-element` is an error. Any exception must be a path-level documented ESLint override, not an inline disable.
9. **No data fetching in UI/component effects** — `npm run audit:use-effect-data-fetching` mechanically blocks `src/ui/**` and `src/components/**` effect fetches/imports from direct fetch, data layer, or Firebase. The script also mechanically blocks `react-hooks/exhaustive-deps` suppression in UI/components/runtime hooks. Reviewer checklist: runtime hook effects that fetch/listen must synchronize with an external system, include cleanup or stale guards, keep dependencies honest, and avoid derived state; these semantics are not fully AST-enforced.
10. **Legacy ESLint plugins stay as existing gates** — `eslint-plugin-react`, `jsx-a11y`, `import`, `jsdoc`, and `eslint-comments` remain enforced where configured, but this React/Next hardening does not expand their policy surface.
