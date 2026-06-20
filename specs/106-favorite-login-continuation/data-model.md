# Data Model: 未登入使用者的收藏登入接續流程

## Entity: FavoriteContinuationIntent

Represents one unauthenticated click on an event or post favorite button.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `contentType` | `'event' \| 'post'` | Yes | The supported favorite domain. Maps to `FAVORITE_CONTENT_TYPES.EVENT` or `FAVORITE_CONTENT_TYPES.POST`. |
| `targetId` | `string` | Yes | Event id or post id originally clicked by the user. |
| `copyKind` | `'event' \| 'post'` | Yes | Selects dialog body copy. It must not contain target title/name. |
| `status` | `'open' \| 'authenticating' \| 'applyingFavorite'` | Yes | Current continuation state. |
| `createdAtMs` | `number` | Yes | In-memory timestamp for debugging/test assertions only. Not persisted. |

### Validation Rules

- `contentType` must be `event` or `post`.
- `targetId` must normalize to a non-empty string.
- Only one intent may exist at a time in a page runtime.
- The intent is add-only and never represents favorite removal.
- The intent must be cleared on success, user cancel/close, add failure, unmount, or page reload.
- The intent must not be serialized or persisted.

### State Transitions

```text
none
  └── unauthenticated favorite click with valid target -> open

open
  ├── secondary click / close -> none
  ├── primary click -> authenticating
  └── second unauthenticated favorite click -> open (unchanged)

authenticating
  ├── login cancel / popup close / login failure -> open
  └── login success with uid -> applyingFavorite

applyingFavorite
  ├── add favorite success -> none
  └── add favorite failure -> none
```

## Entity: FavoriteLoginContinuationDialogState

Render contract for the lightweight dialog.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `isOpen` | `boolean` | Yes | Whether the dialog should render. |
| `title` | `'登入後即可收藏'` | Yes | Fixed dialog title. |
| `body` | `string` | Yes | `登入後會自動將這個活動加入收藏。` or `登入後會自動將這篇文章加入收藏。` |
| `primaryLabel` | `'使用 Google 登入'` | Yes | Login action label. |
| `secondaryLabel` | `'稍後再說'` | Yes | Cancel action label. |
| `isSubmitting` | `boolean` | Yes | True while login or add favorite is in progress. |

### Validation Rules

- `body` must be derived only from `copyKind`.
- The dialog must not render event title, event name, post title, post content, or any target preview.
- Login popup must not open while `isOpen` is false or before the primary button is pressed.
- The secondary/close action clears the intent and emits no toast.

## Entity: FavoriteContinuationResult

Represents the outcome of pressing `使用 Google 登入`.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `kind` | `'auth-cancelled' \| 'auth-failed' \| 'favorite-added' \| 'favorite-add-failed'` | Yes | Normalized outcome for hook/runtime decisions. |
| `uid` | `string \| null` | No | Authenticated user id when available. |
| `targetId` | `string` | Yes for favorite outcomes | Original target id. |

### Validation Rules

- `favorite-added` requires a non-empty uid and successful `addContentFavorite`.
- `favorite-add-failed` requires login success and failed favorite write.
- `auth-cancelled` and `auth-failed` must not call `addContentFavorite`.
- `favorite-added` must call page-local success callback with `targetId` and `isFavorited: true`.
- `favorite-add-failed` must call page-local failure callback or leave state unchanged.

## Entity: PageFavoriteStatePatch

Page-owned state update applied after a successful continuation.

| Page | Patch Target | Success Patch |
| --- | --- | --- |
| `/events` | `favoriteEventIds` | Add `eventId` to the current page `Set`. |
| `/events/[id]` | `isFavoriteEvent` | Set to `true` for the current event detail only. |
| `/posts` | `posts` | Set `post.isFavorited = true` only for the clicked `postId`. |
| `/posts/search` | `searchState.results` | Set nested `match.post.isFavorited = true` only for the clicked `postId`. |
| `/posts/[id]` | `postDetail` | Set `postDetail.isFavorited = true` only when it is the clicked post. |

### Validation Rules

- No cross-page favorite state synchronization is required.
- No list reload is required after success.
- Add failure must leave or restore the page state to unfavorited for the target.
- Signed-in add/remove toggle state patches remain unchanged and are outside this entity.

## Existing Persistent Entity: ContentFavoriteDocument

Existing Firestore favorite document written by `addContentFavorite`.

| Field | Type | Description |
| --- | --- | --- |
| `targetId` | `string` | Event or post id. |
| `createdAt` | Firestore server timestamp | Favorite creation/update timestamp. |

### Persistence Rules

- Event favorites are stored under `users/{uid}/favoriteEvents/{eventId}`.
- Post favorites are stored under `users/{uid}/favoritePosts/{postId}`.
- Continuation writes use the same persistent shape as existing signed-in add behavior.
- No new collection or document is introduced by this feature.
