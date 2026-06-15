# Implementation Plan: 文章搜尋

**Branch**: `103-posts-search` | **Date**: 2026-06-15 | **Spec**: `specs/103-posts-search/spec.md`
**Input**: Feature specification from `specs/103-posts-search/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

在 `/posts` 文章河道加入搜尋入口，送出有效關鍵字後導向獨立 `/posts/search?q=` 搜尋結果頁。搜尋範圍是全站公開且 active 的文章，欄位限定 title/content 任意位置 contains，結果重用既有 `PostCard` 與文章互動能力。MVP 不導入專用搜尋索引或外部搜尋引擎，改沿用 Firestore `postAt desc` 候選集合分頁補抓，在 service/use-case 層完成 trim/case-fold、active filter、contains matching、排序、snippet/highlight metadata 與 dedupe。

## Technical Context

**Language/Version**: Next.js 15 / React 19 / JavaScript ES6+ with JSDoc `checkJs: true`
**Primary Dependencies**: Next.js App Router, React 19, Firebase v9+ Firestore/Auth, CSS Modules, existing runtime/use-case/service/repo layers
**Storage**: Firebase Firestore `posts` collection; Auth only for personalized interaction state and author actions
**Testing**: Vitest, Testing Library, Playwright are installed, but `npm run test`, branch test, and e2e scripts currently include disabled stub commands and cannot be treated as effective acceptance gates
**Target Platform**: Web App
**Project Type**: Next.js web application with thin App Router entries, runtime hooks/use-cases, render-only UI screens, and Firebase-backed service/repo data access
**Performance Goals**: 95% normal searches show first results, empty state, or error state within 2 seconds; this depends on candidate collection size and must be measured in research/implementation
**Constraints**: Preserve forward-only layering `Types -> Config -> Repo -> Service -> Runtime -> UI`; keep `src/app/` thin; render-only screens in `src/ui/`; business state in `src/runtime/`; Firebase access through `src/repo/` and `src/service/`; use CSS Modules; infinite scroll uses `IntersectionObserver`; Firestore does not support arbitrary substring contains queries; `/posts` main feed state must not be replaced by search state
**Scale/Scope**: Whole-site public active posts. MVP scans/paginates candidate posts ordered by `postAt desc` and `documentId desc`, filters matches client-side in service/use-case boundaries, fetches more candidate pages until a result page is filled or candidates end, and keeps a cursor for loading more.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. SDD/TDD**: PASS. Feature has `specs/103-posts-search/spec.md`; implementation phase must add failing tests before code changes. Executable tests belong under `tests/`, not `specs/`.
- **II. Strict Layered Architecture**: PASS. Planned data access remains `src/repo/client/firebase-posts-repo.js`; normalization/search business rules live in `src/service/post-service.js` and `src/runtime/client/use-cases/post-use-cases.js`; UI consumes runtime hooks only.
- **III. UX & Consistency**: PASS. UI text remains 正體中文; search result infinite scroll follows existing `IntersectionObserver` feed pattern; search page reuses `PostCard` interactions.
- **IV. Performance & Concurrency**: PASS with measurement caveat. No shared write transaction is introduced. The 2 秒首批目標 depends on candidate collection size because Firestore lacks arbitrary substring contains; implementation must measure candidate-scan behavior and keep a path to indexed/external search if MVP cannot meet the target at scale.
- **V. Code Quality & Conventions**: PASS. MVP avoids overengineering and uses JavaScript/CSS Modules with focused helpers for snippets/highlights/sorting instead of JSX-heavy logic.
- **VI. Modern Development Standards**: PASS. Implementation must keep exported functions documented with meaningful JSDoc and pass changed-file lint/type checks.
- **VII. Security & Secrets**: PASS. No secrets or new environment variables are required.
- **VIII. Agent Interaction Protocol**: PASS. Docs-only write scope is explicitly authorized; later code implementation still needs separate authorization and Reviewer/Verifier evidence.
- **IX. Strict Coding Iron Rules**: PASS. Plan requires snippet/highlight/sort logic outside JSX and no lint-disable workaround for accessibility.

Post-design re-check: PASS. `research.md`, `data-model.md`, `contracts/posts-search-ui-contract.md`, and `quickstart.md` keep the MVP inside the same architecture and record the performance caveat for measurement.

## Project Structure

### Documentation (this feature)

```text
specs/103-posts-search/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── posts-search-ui-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── posts/
│       ├── page.jsx
│       └── search/
│           └── page.jsx
├── runtime/
│   ├── client/
│   │   └── use-cases/
│   │       └── post-use-cases.js
│   └── hooks/
│       ├── usePostsPageRuntime.js
│       ├── usePostsPageRuntimeHelpers.js
│       └── usePostsSearchPageRuntime.js
├── service/
│   └── post-service.js
├── repo/
│   └── client/
│       └── firebase-posts-repo.js
├── ui/
│   └── posts/
│       ├── PostSearchForm.jsx
│       ├── PostsPageScreen.jsx
│       └── PostsSearchPageScreen.jsx
└── components/
    └── PostCard.jsx

tests/
├── unit/
│   ├── service/
│   │   └── post-service.test.js
│   ├── runtime/
│   │   ├── post-use-cases.test.js
│   │   └── usePostsSearchPageRuntime.test.jsx
│   ├── ui/
│   │   └── posts/
│   │       ├── PostSearchForm.test.jsx
│   │       ├── PostsPageScreen.test.jsx
│   │       └── PostsSearchPageScreen.test.jsx
│   └── components/
│       └── PostCard.test.jsx
├── integration/
├── e2e/
├── server/
└── _helpers/
```

**Structure Decision**: Use the existing Next.js App Router structure. Add a thin `src/app/posts/search/page.jsx` route, keep `/posts` route thin, put search state/load-more/retry/navigation in `src/runtime/hooks/usePostsSearchPageRuntime.js`, add search use-case/service helpers in existing post modules, and keep visual composition in `src/ui/posts/*`. Tests target service matching/sorting/snippet rules, runtime state transitions, search form routing contract, result screen states, and `PostCard` compatibility where needed.

## Complexity Tracking

無
