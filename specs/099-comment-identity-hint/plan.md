# Implementation Plan: Comment Identity Hint Consistency

**Branch**: `099-comment-identity-hint` | **Date**: 2026-06-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/099-comment-identity-hint/spec.md`

**Note**: This plan is produced for explicit `$speckit-plan` use only. `AGENTS.md` remains the repo source of truth.

## Summary

Make the post and event comment composers use the same bottom-fixed identity hint pattern for authenticated users: circular current-user avatar, text input, and submit button. Anonymous users must not see a composer on either path. Use or extend the shared `src/components/CommentInput.jsx` and `src/components/useCommentComposerInput.js` behavior rather than building a second post-only form. No Firestore schema migration is planned; this is UI/runtime parity over existing post and event comment flows.

## Technical Context

**Language/Version**: JavaScript ES6+ with JSDoc and `checkJs: true`; React 19; Next.js 15 App Router
**Primary Dependencies**: Next.js, React, Firebase v9+, Vitest, Testing Library, jsdom, CSS Modules
**Storage**: Existing Firestore comment storage only: post comments under `posts/{postId}/comments`; event comments through `src/service/event-comment-service.js`
**Testing**: Focused Vitest/RTL jsdom tests for composer behavior; existing server Firestore rules tests remain separate
**Target Platform**: Web app, mobile and desktop browsers
**Project Type**: Next.js web application
**Performance Goals**: No added network round trips or list re-render behavior; composer updates must stay local to draft/submission state
**Constraints**: Preserve existing comment lists, sorting, notification, edit/delete, login prompt, and Firestore rules behavior; keep UI usable without overlap at mobile and desktop widths
**Scale/Scope**: Narrow parity update for post detail and event detail comment composers

## Constitution Check

_Gate: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Initial Gate - PASS

- **SDD/TDD**: Written feature spec exists at `specs/099-comment-identity-hint/spec.md`; implementation plan recommends focused failing tests before source changes.
- **Strict Layered Architecture**: Planned changes stay in component/runtime/service validation boundaries. UI must not import Firebase SDK directly.
- **UX Consistency**: Core objective is consistent post/event comment composer behavior and Traditional Chinese app UI preservation.
- **Performance/Concurrency**: No new data model, migration, transaction, or polling behavior.
- **Code Quality**: MVP scope reuses shared composer code and avoids duplicating post-only form logic.
- **Security/Secrets**: No secrets or environment changes.
- **Agent Protocol**: This is explicitly authorized P4 Spec Kit planning/docs work; no source/test implementation, staging, commit, push, dependency install, or dev server is authorized.

### Post-Design Gate - PASS

- Phase 0/1 artifacts keep implementation bounded to `CommentInput`, comment composer input state, event composer props, post detail composer replacement, and optional service parity.
- Data model confirms no Firestore schema migration and no new stored entity.
- UI contract preserves non-goals: no comment list styling, sorting, notification, edit/delete, login prompt, Firestore schema change, or Firestore rules change.
- Agent context update is constrained to the `AGENTS.md` Spec Kit marker block. The broad generic `update-agent-context.sh` updater is intentionally not run because it may rewrite broad AGENTS content; this manual marker-block update is the constrained substitute.

## Project Structure

### Documentation

```text
specs/099-comment-identity-hint/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── comment-composer-ui.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/components/
├── CommentInput.jsx
├── CommentInput.module.css
├── CommentSection.jsx
├── CommentSection.module.css
└── useCommentComposerInput.js

src/runtime/hooks/
└── usePostComments.js

src/ui/posts/
├── PostDetailScreen.jsx
└── PostDetailScreen.module.css

src/service/
├── event-comment-service.js
└── post-service.js

public/
└── default-avatar.png

tests/
└── server/
    └── firestore/
```

**Structure Decision**: Keep the implementation inside the existing Next.js app structure. Shared composer UI remains in `src/components/`; post comment state stays in `src/runtime/hooks/usePostComments.js`; optional service validation parity belongs in `src/service/post-service.js`. No new package, app, route group, Firestore collection, or schema directory is needed.

## Complexity Tracking

No constitution violations. No complexity exception is needed.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| None | N/A | N/A |

## Phase 0 Output

See [research.md](./research.md).

## Phase 1 Outputs

- [data-model.md](./data-model.md)
- [contracts/comment-composer-ui.md](./contracts/comment-composer-ui.md)
- [quickstart.md](./quickstart.md)

## Implementation Direction

- Reuse or extend `src/components/CommentInput.jsx` and `src/components/useCommentComposerInput.js` so post and event composers share identity, validation, clearing, and duplicate-submit behavior.
- Event path: `src/components/CommentSection.jsx` already hides the composer when `AuthContext.user` is absent; pass current user identity into `CommentInput`.
- Post path: replace or align the inline form in `src/ui/posts/PostDetailScreen.jsx` with shared `CommentInput`; update `src/runtime/hooks/usePostComments.js` so submit accepts content, tracks submitting state, returns success, and prevents duplicate submit.
- Avatar fallback: use the existing `/default-avatar.png` pattern from `UserLink`; composer avatar must be non-clickable and must not link to a profile.
- Length limit: use 500 characters. `useCommentComposerInput.js` already uses 500 and Firestore rules enforce 500 for post/event comment text. If implementation touches service validation, bring `src/service/post-service.js` into parity with the same 500-character guard.
- Do not change comment list styling, sorting, notifications, edit/delete, login prompts, Firestore schema, or Firestore rules.
- Firestore schema/rules changes are out of scope for this feature. If implementation evidence proves they are required, stop implementation and re-scope with explicit user approval and a new plan before making those changes.

## Testing And Verification Plan

Recommended focused test files for implementation:

- `tests/unit/components/CommentInput.test.jsx`
- `tests/unit/components/CommentSection.test.jsx`
- `tests/unit/ui/posts/PostDetailScreen.test.jsx`
- `tests/unit/service/post-service.test.js` only if service length validation changes

Primary commands:

```bash
npx vitest run --environment jsdom tests/unit/components/CommentInput.test.jsx tests/unit/components/CommentSection.test.jsx tests/unit/ui/posts/PostDetailScreen.test.jsx
npx vitest run tests/unit/service/post-service.test.js tests/unit/service/event-comment-service.test.js
npm run lint:changed
npm run type-check:changed
git diff --check
npm run build
```

Use the service Vitest command only when those service validation tests exist or are changed. `npm test` and `npm run test:e2e:*` are disabled stubs in this repo snapshot, so they are not primary evidence.

After UI implementation and separate authorization to run the app, collect browser evidence from `npm run dev` on desktop and mobile widths for post and event pages: authenticated user with avatar, authenticated fallback avatar, anonymous hidden composer, and no overlap/truncation. For SC-007, the authenticated user must visually confirm the composer avatar matches the active account within 2 seconds on both post and event pages at desktop and mobile widths.
