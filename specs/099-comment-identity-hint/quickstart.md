# Quickstart: Comment Identity Hint Validation

This guide is for validating an implementation of `specs/099-comment-identity-hint/spec.md`. It contains no implementation code.

## Prerequisites

- Work on branch `099-comment-identity-hint`.
- Install dependencies only if the workspace is not already prepared and the user has authorized it.
- Create focused tests during implementation; these paths do not exist in the current snapshot.

## Automated Validation

Run focused UI tests:

```bash
npx vitest run --environment jsdom tests/unit/components/CommentInput.test.jsx tests/unit/components/CommentSection.test.jsx tests/unit/ui/posts/PostDetailScreen.test.jsx
```

Expected outcome:

- Authenticated composer renders avatar, input, and submit button for post and event.
- Authenticated user without `photoURL` renders `/default-avatar.png`.
- Anonymous post and event surfaces do not render a composer.
- Empty, whitespace-only, and over-500-character drafts cannot submit.
- Successful submit clears the draft.
- Pending submit blocks duplicate submit.

Run service parity tests only if service validation tests exist or are changed:

```bash
npx vitest run tests/unit/service/post-service.test.js tests/unit/service/event-comment-service.test.js
```

Expected outcome:

- Event and post service validation agree on the 500-character limit when both are covered.

Run standard verification:

```bash
npm run lint:changed
npm run type-check:changed
git diff --check
npm run build
```

Expected outcome:

- Commands exit 0.
- `git diff --check` reports no whitespace errors.
- Build completes without introducing UI/runtime regressions.

Do not use `npm test` or `npm run test:e2e:*` as primary evidence in this repo snapshot; those scripts are disabled stubs.

## Manual Browser Checks

After UI implementation and separate authorization to run the app:

```bash
npm run dev
```

Check post detail and event detail pages at desktop and mobile widths.

Expected authenticated behavior with avatar:

- Composer is fixed at the bottom.
- Left side shows the current user's avatar.
- For SC-007, the authenticated user visually confirms the composer avatar matches the active account within 2 seconds on both post and event pages at desktop and mobile widths.
- Avatar is not clickable and does not navigate.
- Input and submit button are visible and operable.

Expected authenticated fallback behavior:

- With no usable `photoURL`, composer shows `/default-avatar.png`.
- No missing image or empty placeholder appears.

Expected anonymous behavior:

- No bottom composer is rendered on post detail or event detail.
- No login prompt or login CTA is added.

Expected responsive behavior:

- Avatar, input, and submit button do not overlap.
- Text is not truncated in controls.
- Composer does not block interaction with required page controls beyond the intended fixed-bottom area.

## References

- UI contract: [contracts/comment-composer-ui.md](./contracts/comment-composer-ui.md)
- Runtime state model: [data-model.md](./data-model.md)
