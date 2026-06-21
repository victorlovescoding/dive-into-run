# Contract: Favorite Login Continuation

This contract defines the runtime/UI behavior for unauthenticated favorite clicks on events and posts. It is not a network API contract.

## Supported Scope

| Route | Content Type | Body Copy | Local Success Patch |
| --- | --- | --- | --- |
| `/events` | `event` | `登入後會自動將這個活動加入收藏。` | Add clicked event id to `favoriteEventIds`. |
| `/events/[id]` | `event` | `登入後會自動將這個活動加入收藏。` | Set detail `isFavoriteEvent` to `true`. |
| `/posts` | `post` | `登入後會自動將這篇文章加入收藏。` | Set clicked post `isFavorited` to `true`. |
| `/posts/search` | `post` | `登入後會自動將這篇文章加入收藏。` | Set clicked result post `isFavorited` to `true`. |
| `/posts/[id]` | `post` | `登入後會自動將這篇文章加入收藏。` | Set detail post `isFavorited` to `true`. |

Excluded surfaces must not open this flow: member favorites, weather favorites, running records, comments, likes, report menus, event participation, post composer, and all non-listed routes.

## Dialog UI Contract

### Required Markup Semantics

- Render only when `dialogState.isOpen === true`.
- Dialog container has `role="dialog"` and `aria-modal="true"`.
- Dialog accessible name is the title `登入後即可收藏`.
- The component exposes:
  - close button with accessible label such as `關閉收藏登入提示`
  - primary button `使用 Google 登入`
  - secondary button `稍後再說`

### Required Copy

| Element | Event Favorite | Post Favorite |
| --- | --- | --- |
| Title | `登入後即可收藏` | `登入後即可收藏` |
| Body | `登入後會自動將這個活動加入收藏。` | `登入後會自動將這篇文章加入收藏。` |
| Primary | `使用 Google 登入` | `使用 Google 登入` |
| Secondary | `稍後再說` | `稍後再說` |

### Forbidden Dialog Content

The dialog must not render:

- event title or event name
- post title or post content
- target id
- author/host identity
- favorite state details such as "currently favorited"

## Runtime Hook Contract

The implementation may adjust names, but the behavior must match this shape.

```js
const continuation = useFavoriteLoginContinuation({
  onFavoriteAdded: ({ contentType, targetId }) => {},
  onFavoriteAddFailed: ({ contentType, targetId }) => {},
  showToast,
});
```

### Returned State And Handlers

| Name | Type | Contract |
| --- | --- | --- |
| `dialogState` | object | Contains `isOpen`, `contentType`, `body`, and `isSubmitting`. |
| `openContinuation` | function | Accepts `{ contentType, targetId }`; opens the dialog only when no intent is active. |
| `confirmContinuation` | async function | Starts Google login, then add favorite on login success. |
| `cancelContinuation` | function | Clears the intent without toast. |
| `closeContinuation` | function | Same as cancel; used by close button/backdrop if implemented. |

### `openContinuation({ contentType, targetId })`

Preconditions:

- `contentType` is `event` or `post`.
- `targetId` normalizes to non-empty string.
- No existing intent is open or pending.

Effects:

- Creates one `FavoriteContinuationIntent`.
- Does not call `signInWithGoogle`.
- Does not call `addContentFavorite`.
- Does not show a toast.

If an intent already exists, the call must leave the existing intent unchanged.

### `confirmContinuation()`

Preconditions:

- An intent is open.
- No confirm action is already pending.

Effects:

1. Set `isSubmitting` to true.
2. Call existing Google popup sign-in helper exactly once.
3. If sign-in rejects or returns no uid:
   - set `isSubmitting` false
   - keep the dialog open
   - do not call `addContentFavorite`
   - do not mark the item favorited
4. If sign-in succeeds with uid:
   - call `addContentFavorite({ uid, type, targetId })`
   - never call `removeContentFavorite`
5. If add succeeds:
   - clear and close the dialog
   - call `onFavoriteAdded({ contentType, targetId })`
   - show `登入成功，已加入收藏` with success toast type
6. If add fails:
   - clear and close the dialog
   - call `onFavoriteAddFailed({ contentType, targetId })` or leave state unchanged
   - show `收藏失敗，請稍後再試` with error toast type

### `cancelContinuation()` / `closeContinuation()`

Effects:

- Clear the intent.
- Close the dialog.
- Do not call Google sign-in.
- Do not add a favorite.
- Do not show success, failure, or cancel toast.

## Signed-In Behavior Contract

If the current page runtime already has a signed-in uid, the existing favorite toggle path remains authoritative:

- clicking an unfavorited item adds favorite and uses existing success/failure copy
- clicking a favorited item removes favorite and uses existing success/failure copy
- no continuation dialog is opened
- no new login popup is opened

## Error Contract

| Scenario | Dialog | Favorite Write | Local Favorite State | Toast |
| --- | --- | --- | --- | --- |
| User clicks `稍後再說` | closes | none | unchanged | none |
| User closes dialog | closes | none | unchanged | none |
| User has not pressed primary | open | none | unchanged | none |
| Google popup cancelled/closed | remains open | none | unchanged | none |
| Google sign-in fails | remains open | none | unchanged | none |
| Add favorite succeeds | closes | `addContentFavorite` once | clicked item true | `登入成功，已加入收藏` |
| Item already favorited before add | closes | `addContentFavorite` once | clicked item true | `登入成功，已加入收藏` |
| Add favorite fails | closes | attempted once | clicked item false/unchanged | `收藏失敗，請稍後再試` |

## Test Expectations

- Dialog tests assert exact copy by role/name.
- Runtime tests assert `signInWithGoogle` is not called until primary click.
- Runtime tests assert auth failure keeps dialog open and does not call `addContentFavorite`.
- Runtime tests assert add failure closes dialog, leaves state unfavorited, and shows only failure toast.
- Signed-in regression tests assert existing add/remove favorite behavior and messages remain unchanged.
- Page wiring tests assert each applicable route renders the dialog when runtime state is open.
