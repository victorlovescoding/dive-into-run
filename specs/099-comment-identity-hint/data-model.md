# Data Model: Comment Identity Hint Consistency

This feature has no database migration. The model below describes UI/runtime state over existing comment persistence flows.

## CurrentUser

Represents the active authentication identity shown beside the composer.

**Fields**

- `isAuthenticated`: boolean derived from `AuthContext.user`.
- `uid`: string from the authenticated user.
- `displayName`: optional string for accessible identity context if already available.
- `photoURL`: optional string from the authenticated user.
- `avatarSrc`: string, equal to `photoURL` when usable, otherwise `/default-avatar.png`.

**Validation Rules**

- Anonymous users have `isAuthenticated = false` and no composer is rendered.
- Authenticated users always render exactly one non-clickable avatar image.
- Avatar fallback must not produce a missing or empty visual state.

**Relationships**

- One `CurrentUser` may operate a `CommentComposer` for a visible `CommentTarget`.

## CommentTarget

Identifies where a draft will be submitted.

**Fields**

- `type`: enum, `post` or `event`.
- `id`: string for the post or event.
- `submit`: function that persists valid content through the existing runtime/service path.

**Validation Rules**

- `type` must map to the existing post or event comment flow.
- No new Firestore collection, field, index, or rule is introduced.

**Relationships**

- A `CommentComposer` has one `CommentTarget`.

## CommentComposer

Represents the bottom-fixed input surface shown to authenticated users.

**Fields**

- `currentUser`: `CurrentUser`.
- `target`: `CommentTarget`.
- `draft`: `CommentDraft`.
- `submissionState`: `CommentSubmissionState`.
- `maxLength`: number, fixed at 500.
- `isVisible`: boolean, true only when `currentUser.isAuthenticated`.

**Validation Rules**

- Must render avatar left, input middle, submit button right.
- Must be fixed at the bottom without overlap or truncation on mobile and desktop widths.
- Must not render for anonymous users.
- Must not add login prompt or login CTA.

**Relationships**

- Owns one `CommentDraft`.
- Reads one `CurrentUser`.
- Submits to one `CommentTarget`.

## CommentDraft

Represents text the user has typed but not submitted.

**Fields**

- `content`: string.
- `trimmedContent`: string derived by trimming `content`.
- `length`: number.
- `isEmpty`: boolean, true when `trimmedContent.length === 0`.
- `isOverLimit`: boolean, true when `content.length > 500`.
- `canSubmit`: boolean, true when authenticated, not empty, not over limit, and not submitting.

**Validation Rules**

- Empty or whitespace-only content is invalid.
- Content over 500 characters is invalid.
- Invalid drafts keep submit disabled and must not call persistence.

**State Transitions**

- `empty -> editing`: user types non-whitespace content.
- `editing -> invalid`: user clears content or exceeds 500 characters.
- `editing -> submitting`: user submits valid content.
- `submitting -> empty`: submit succeeds and the draft clears.
- `submitting -> editing`: submit fails and the draft is preserved.

## CommentSubmissionState

Tracks submit lifecycle and duplicate prevention.

**Fields**

- `status`: enum, `idle`, `submitting`, `success`, `error`.
- `isSubmitting`: boolean derived from `status === 'submitting'`.
- `lastResult`: optional success boolean from the submit handler.
- `error`: optional existing error representation.

**Validation Rules**

- While `isSubmitting`, duplicate submit attempts must be ignored or blocked.
- Submit handler returns success so the composer clears only after successful persistence.
- Existing error handling is preserved; this feature does not add new error UI.

**State Transitions**

- `idle -> submitting`: valid submit begins.
- `submitting -> success`: persistence succeeds; draft clears; state returns to `idle`.
- `submitting -> error`: persistence fails; draft remains; state returns to `idle` after existing error handling.
