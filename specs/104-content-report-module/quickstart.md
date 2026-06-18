# Quickstart: 模組化內容檢舉系統驗證指南

This guide is for validating the future implementation of `specs/104-content-report-module/plan.md`. It intentionally contains no implementation code.

Planned test paths below may not exist until `$speckit-tasks` and implementation create them.

## Prerequisites

- Work on branch `104-content-report-module`, not `main`.
- Install dependencies with the repo's normal `npm install` flow if needed.
- Have local Firebase emulator configuration available for Firestore rules tests.
- Have test fixtures for:
  - authenticated reporter.
  - anonymous user.
  - target author.
  - non-author post and post comment.
  - self-authored post and comment.
  - soft-deleted or hidden post/event targets.
  - duplicate report attempt for the same reporter-target pair.

## Focused Vitest validation

### Service/domain validation

```bash
npx vitest run tests/unit/service/report-service.test.js tests/unit/service/report-target-resolver.test.js
```

Expected coverage:

- targetType variants: `post`, `postComment`, `event`, `eventComment`.
- targetKey formats from `data-model.md`.
- reason enum and labels.
- reason required.
- `other` requires non-empty trimmed details.
- details capped at 500 characters.
- sourcePath sanitization: safe same-app relative paths up to 1024 characters are saved; missing, invalid, or over-limit values fall back to targetPath without truncation.
- client-supplied server-owned fields (`reportId`, `targetKey`, `targetSnapshot`, `reporterUid`, `status`, `createdAt`) are rejected with 400.
- targetSnapshot excludes media URLs, full author profiles, reporter names, and reporter profiles.
- comment targets validate parent post/event active state.

### Server use-case and client use-case

```bash
npx vitest run tests/unit/runtime/report-server-use-cases.test.js tests/unit/runtime/report-use-cases.test.js
```

Expected coverage:

- bearer token missing/invalid -> 401.
- valid report -> 201 and success message.
- self-report -> 403 and `不能檢舉自己的內容。`.
- target unavailable -> 404.
- duplicate deterministic doc create -> 409 and `你已經檢舉過這則內容。`.
- unexpected repo/resolver error -> 500 generic response.
- client pending guard prevents double submit.
- client maps duplicate/self/generic messages correctly.

### API route adapter

```bash
npx vitest run tests/unit/api/reports-route.test.js
```

Expected coverage:

- route accepts only POST.
- route parses JSON and delegates to the server use-case.
- route returns the use-case `{ status, body }`.
- malformed JSON maps to 400.
- unexpected exception maps to 500 generic.

### UI integration

```bash
npx vitest run tests/integration/reports/ReportDialog.test.jsx tests/integration/reports/post-report-menu.test.jsx tests/integration/reports/post-comment-report-menu.test.jsx
```

Expected coverage:

- modal title is `檢舉這篇文章` for post.
- modal title is `檢舉這則留言` for postComment.
- preview is shown but not submitted as targetSnapshot.
- submit button disabled while pending; modal remains closable.
- `檢舉文章` appears for authenticated non-authors only.
- `檢舉留言` appears for authenticated non-authors only.
- report action is not hidden inside owner-only edit/delete menus.
- event/eventComment report entries are absent from Phase 1 UI.

## Firestore rules emulator validation

```bash
firebase emulators:exec --only firestore --project dive-into-run "npx vitest run tests/server/firestore/report-rules.test.js"
```

Expected coverage:

- unauthenticated client cannot get/list/create/update/delete `reports`.
- authenticated reporter cannot get/list/create/update/delete `reports`.
- authenticated non-reporter cannot get/list/create/update/delete `reports`.
- existing post/event read rules remain unchanged.

## Lint and type-check

During implementation:

```bash
npm run lint:changed
npm run type-check:changed
```

Before a task is marked complete, follow the repo gates from `.specify/memory/constitution.md` and `.codex/references/quality-gates.md`, including branch-scope lint/type-check/spellcheck/test commands when available.

## Browser visual verification

Start the app with the repo's normal dev server command:

```bash
npm run dev
```

Verify these pages manually or with Playwright.

### `/posts`

- Anonymous user: opening a post three-dot menu does not show `檢舉文章`.
- Authenticated target author: opening own post menu does not show `檢舉文章`.
- Authenticated non-author: opening another user's post menu shows `檢舉文章`.
- Clicking `檢舉文章` opens a modal titled `檢舉這篇文章`.
- Modal shows a short post preview.
- Submitting a valid report shows `已收到你的檢舉，我們會進行審查。`.
- The reported post remains visible after success.

### `/posts/search`

- Search result post cards follow the same anonymous/author/non-author visibility checks as `/posts`.
- `檢舉文章` is in the post three-dot menu, not a separate inline button.
- Successful report does not remove the result from the page.

### `/posts/[id]`

- Post card menu shows `檢舉文章` only to authenticated non-authors.
- Normal comment list shows `檢舉留言` only for authenticated non-authors of each comment.
- `/posts/{postId}?commentId={commentId}` notification target comment block also shows `檢舉留言` for authenticated non-authors.
- Author users do not see report entries on their own posts/comments.
- Clicking `檢舉留言` opens a modal titled `檢舉這則留言`.
- Successful comment report keeps the comment visible and does not create artificial pinned-comment behavior.
- During submit, only the submit button is disabled; the modal can still close.
- A second submit for the same reporter-target pair shows `你已經檢舉過這則內容。`.
- Self-report API failures show `不能檢舉自己的內容。`.

### Event pages

- `/events` and `/events/{eventId}` do not show `檢舉活動` in Phase 1.
- Event comments do not show `檢舉留言` in Phase 1.
- Do not add or validate event-comment UI until Phase 2 confirms the notification/deep-link target comment render path.

## Acceptance checklist

- All accepted reports are created through `POST /api/reports`.
- No client code imports Firestore to read/write `reports`.
- `reports` rules deny all client access.
- Duplicate detection does not use client precheck or reporter history.
- No admin review list, moderation action, notification, media snapshot, reporter history, or composite index is added in Phase 1.
