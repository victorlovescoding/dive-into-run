# Quickstart: 未登入使用者的收藏登入接續流程

## Prerequisites

- Work from the current feature branch `110-favorite-login-continuation`.
- Treat `specs/106-favorite-login-continuation/spec.md` and `contracts/favorite-login-continuation.md` as the source of truth.
- Do not start implementation until `$speckit-tasks` creates executable tasks.
- Keep executable tests under `tests/**`, not under `specs/**`.

## Focused Automated Validation

After implementation tasks create the planned tests, run focused checks first:

```bash
npx vitest run tests/unit/runtime/favorite-login-continuation-helpers.test.js
```

Expected:

- copy selection returns exact event/post body text
- invalid/empty target ids are rejected or ignored
- second open request does not replace an active intent
- no persistence API is used

```bash
npx vitest run tests/unit/runtime/favorite-login-continuation-use-cases.test.js
```

Expected:

- Google sign-in is called only by confirm action
- sign-in cancel/close/failure does not call `addContentFavorite`
- sign-in success calls `addContentFavorite` once with original target id
- add success returns favorite-added result
- add failure returns favorite-add-failed result

```bash
npx vitest run tests/unit/runtime/useFavoriteLoginContinuation.test.jsx
```

Expected:

- open renders event/post dialog state
- `稍後再說` and close clear intent without toast
- auth failure keeps dialog open for retry
- add success clears dialog, calls page success patch, and shows `登入成功，已加入收藏`
- add failure clears dialog, keeps state unfavorited, and shows `收藏失敗，請稍後再試`

```bash
npx vitest run tests/integration/favorites/FavoriteLoginContinuationDialog.test.jsx
```

Expected:

- `screen.getByRole('dialog', { name: '登入後即可收藏' })` exists when open
- event body is `登入後會自動將這個活動加入收藏。`
- post body is `登入後會自動將這篇文章加入收藏。`
- buttons `使用 Google 登入` and `稍後再說` are present
- target title/name/id is not rendered
- primary click calls confirm handler; secondary/close call cancel handler

Then run focused page/runtime regression checks:

```bash
npx vitest run tests/unit/runtime/useEventsPageRuntime.test.jsx tests/unit/ui/events/EventsListSection.test.jsx tests/unit/ui/events/EventDetailScreen.test.jsx
```

Expected:

- unauthenticated `/events` favorite click opens event continuation dialog instead of login toast
- unauthenticated `/events/[id]` favorite click opens event continuation dialog
- signed-in event add/remove favorite behavior and existing success/failure messages remain unchanged

```bash
npx vitest run tests/unit/runtime/usePostsSearchPageRuntime.test.jsx tests/unit/runtime/usePostDetailRuntime.test.jsx tests/unit/ui/posts/PostsPageScreen.test.jsx tests/unit/ui/posts/PostsSearchPageScreen.test.jsx tests/unit/ui/posts/PostDetailScreen.test.jsx tests/unit/components/PostCard.test.jsx
```

Expected:

- unauthenticated `/posts`, `/posts/search`, and `/posts/[id]` favorite clicks open post continuation dialog instead of login toast
- post search success patches only the matching nested result post
- post detail success patches only the current detail post
- signed-in post add/remove favorite behavior and existing success/failure messages remain unchanged

## Branch-Level Validation

After focused checks pass, run the repo gates required for the implementation slice:

```bash
npm run lint:changed
```

Expected: no lint errors for changed files.

```bash
npm run type-check:changed
```

Expected: changed-file type check reports no blocking errors.

```bash
npm run spellcheck
```

Expected: no cSpell errors from changed JS/JSX files.

Before closeout of the implementation branch, run branch-level gates:

```bash
npm run lint:branch
```

```bash
npm run type-check:branch
```

```bash
npm run test:branch
```

```bash
npm run test:e2e:branch
```

Expected: commands exit 0. If a script is intentionally disabled in `package.json`, record its actual output as evidence instead of claiming test coverage from it.

## Manual Browser Validation

Start the app:

```bash
npm run dev
```

Use an unauthenticated browser session.

### `/events`

1. Open `/events`.
2. Click any event favorite button.
3. Verify dialog title `登入後即可收藏`.
4. Verify body `登入後會自動將這個活動加入收藏。`.
5. Verify no event title/name appears in the dialog.
6. Verify no Google popup opens before pressing `使用 Google 登入`.
7. Click `稍後再說`.
8. Verify dialog closes, no favorite is added, and no toast appears.

### `/events/[id]`

1. Open an event detail page.
2. Click the favorite button.
3. Press `使用 Google 登入`.
4. Complete Google sign-in.
5. Verify the dialog closes.
6. Verify only the detail page favorite button becomes active.
7. Verify toast `登入成功，已加入收藏`.

### `/posts`

1. Open `/posts` unauthenticated.
2. Click a post favorite button.
3. Verify post body copy and buttons.
4. Close the dialog with the close button.
5. Verify no favorite is added and no toast appears.

### `/posts/search`

1. Open `/posts/search` with a query that returns posts.
2. Click a result favorite button.
3. Complete Google sign-in from the dialog.
4. Verify only the clicked result card becomes favorited.
5. Verify other result cards do not change.

### `/posts/[id]`

1. Open a post detail page.
2. Click the favorite button.
3. Simulate or force favorite add failure if available in test/dev tooling.
4. Verify the dialog closes, the button remains unfavorited, and toast `收藏失敗，請稍後再試` appears.

## Negative Validation

- Auth popup cancelled/closed: dialog remains open and can retry; no favorite write.
- Login succeeds when item was already favorited: success toast appears and item remains favorited.
- While one dialog is open, clicking another favorite does not open a second dialog or second popup.
- Reload while dialog is open: pending intent disappears.
- Signed-in user favorite clicks never show the continuation dialog.
- Weather favorite, member favorites, likes, comments, and non-listed routes never show the continuation dialog.
