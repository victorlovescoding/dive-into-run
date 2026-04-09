# Code Review — 011-event-share-og

日期：2026-04-10

---

## Taste Rating

🟢 **Good taste** — Clean separation of concerns, minimal new abstractions, reuses existing service layer. The data flows from Firestore through `generateMetadata()` into `<meta>` tags with zero unnecessary indirection. ShareButton is a single, focused component that handles exactly two code paths. This is how you ship a feature without creating technical debt.

---

## Linus-Style Analysis

### Linus's Three Questions

1. **Is this solving a real problem?** Yes — sharing links to social platforms without OG metadata means ugly raw URLs with no preview. This directly impacts user acquisition.
2. **Is there a simpler way?** Not really. `generateMetadata()` is the canonical Next.js 15 approach. Web Share API + clipboard fallback is the minimal implementation for cross-device sharing. No unnecessary libraries, no over-abstraction.
3. **What will this break?** Very little. Additive changes only — new metadata on existing pages, new button in existing UI. The only risk is `window.location.origin` in JSX (see below).

---

### [CRITICAL ISSUES]

None.

---

### [IMPROVEMENT OPPORTUNITIES]

- **[src/app/events/[id]/eventDetailClient.jsx, Line 405] `window.location.origin` in JSX render path**: While this works because it's a `'use client'` component that only renders after hydration (behind `!loading && !error && event` checks), directly referencing `window.location.origin` in JSX is a code smell. If the component's rendering logic ever changes (e.g., SSR pre-rendering), this becomes a runtime crash. Consider computing the URL in a `useMemo` or passing it as a prop from the server component. Same applies to `PostDetailClient.jsx` line 415. Pragmatically, this works today — it's a "should fix at some point" not a "must fix now".

- **[src/app/posts/[id]/PostDetailClient.jsx, Line 413] Inline `style` for layout**: The `<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>` wrapper and `<h2 style={{ margin: 0 }}>` are inline styles in a codebase that uses CSS Modules everywhere else. This is inconsistent. A CSS Module class (e.g., `.titleRow`) would be cleaner and more maintainable. The event page uses existing `styles.detailHeader` / `styles.detailHeaderRight` — the post page should follow the same pattern.

- **[src/app/events/[id]/page.jsx + src/app/posts/[id]/page.jsx] Duplicated constants**: `FALLBACK_TITLE` and `OG_IMAGE_PATH` are defined identically in both page files. These are not abstractions crying to be made — two occurrences is fine — but if a third page ever needs OG metadata, extract them to `og-helpers.js`. As-is, acceptable.

- **[src/lib/og-helpers.js, Line 34] Markdown bold/italic regex limitation**: The regex `(\*{1,2}|_{1,2})(.+?)\1` uses a backreference that only works for matching pairs. Mixed cases like `**bold *italic* still bold**` will partially strip. This is an inherent regex-based Markdown parsing limitation. For OG description purposes (80-char excerpt), this is pragmatically fine. Don't reach for a full Markdown parser — that would be over-engineering.

- **[src/lib/og-helpers.js, Line 40] List marker regex also matches `* italic *`**: The list marker removal `^[-*]\s+/gm` runs after bold/italic stripping, so `* italic *` would already have been handled. Execution order is correct. No action needed, but worth being aware of the coupling.

---

### [STYLE NOTES]

- **[src/components/ShareButton.jsx]** Good separation of `executeShare()` as a standalone async function outside the component. Clean `useCallback` with correct dependency array. The AbortError silencing (`error.name === 'AbortError'`) is the right call — users dismissing the share sheet is not an error.

- **[src/lib/og-helpers.js]** Good use of unicode escape sequences for CJK brackets (`\u300c`, `\u300d`) and separators (`\u00b7`, `\u2014`). Makes the code unambiguous regardless of file encoding.

- **[src/components/ShareButton.module.css]** Clean, minimal. Hardcoded colors (#dadce0, #5f6368, etc.) are Google Material-ish. If the project has design tokens or CSS variables, these should reference them. But for MVP, fine.

---

### [TESTING GAPS]

- **`generateMetadata()` has no tests**: Both `events/[id]/page.jsx` and `posts/[id]/page.jsx` have `generateMetadata()` functions that call Firebase, format metadata, and handle fallbacks. The unit tests only cover `og-helpers.js` (the pure functions). The integration between `fetchEventById` -> `buildEventOgDescription` -> metadata object construction is untested. This is the most important code path (it's what crawlers see) and it has zero test coverage. **Recommendation**: Add integration tests that mock the Firebase fetch and assert the full metadata object shape, including the fallback case when the document doesn't exist.

- **ShareButton integration tests are solid**: Good coverage of Web Share API path, clipboard fallback, toast feedback, AbortError handling. Uses real ToastProvider + ToastContainer — these are real integration tests, not mock-assert-mock patterns. Well done.

---

### [TASK GAPS]

All 14 tasks marked `[x]` have corresponding implementation in the diff. No tasks are missing implementation. No significant scope creep detected.

- **T002 partial**: Task says "add `NEXT_PUBLIC_SITE_URL` to `.env.example`" — this was not visible in the diff. Either `.env.example` doesn't exist, or this sub-item was skipped. Minor — it's a documentation concern, not a code concern.

---

## VERDICT

✅ **Worth merging** — Core logic is sound. The `og-helpers.js` module is clean, well-tested, and handles edge cases properly. `ShareButton` is a focused, reusable component with good a11y (`aria-label`, keyboard-accessible `<button>`). `generateMetadata()` follows Next.js 15 conventions correctly. The metadata structure matches the contract spec exactly.

Two items deserve attention before or shortly after merge:

1. The inline styles in `PostDetailClient.jsx` should use CSS Modules for consistency.
2. `generateMetadata()` integration tests should be added — this is the feature's most critical code path and it currently has zero direct test coverage.

---

## KEY INSIGHT

The entire feature ships with exactly **3 new source files** (og-helpers.js, ShareButton.jsx, ShareButton.module.css) and **5 modified files** — all additive, no breaking changes, no new dependencies. This is what "good taste" looks like: solving a real user problem with minimal surface area. The only code smell is the `PostDetailClient.jsx` inline styles, which is a consistency nit, not a design flaw.
