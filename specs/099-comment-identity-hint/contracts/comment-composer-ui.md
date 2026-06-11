# UI Contract: Comment Composer Identity Hint

## Scope

This contract applies to the bottom comment composer on post detail and event detail surfaces.

## Authenticated Rendering

- Composer is visible for authenticated users.
- Layout is consistent across post and event pages: circular avatar on the left, text input in the middle, submit button on the right.
- Composer is fixed to the bottom of the viewport.
- Mobile and desktop layouts must keep avatar, input, and button visible, operable, and non-overlapping.

## Anonymous Rendering

- Composer is not rendered for anonymous users.
- No avatar, input, submit button, login prompt, or login CTA is added by this feature.

## Avatar Behavior

- Use the current user's avatar when available.
- Use `/default-avatar.png` when the current user has no usable avatar.
- Avatar is display-only.
- Avatar must not be clickable, focusable as a link, or wrapped in `UserLink`.
- Avatar must not navigate to a profile.

## Draft Validation

- Maximum length is 500 characters.
- Empty or whitespace-only content is invalid.
- Content over 500 characters is invalid.
- Submit is disabled when content is invalid or when a submit is already in progress.

## Submit Contract

- Submit receives the current draft content from the shared composer.
- Submit must not run when the composer is anonymous, invalid, or already submitting.
- Submit returns success/failure to the composer.
- On success, the composer clears the draft.
- On failure, the composer preserves the draft and uses existing error handling.
- Duplicate submit attempts during `submitting` are blocked.

## Non-Goals

- Do not change comment list styling.
- Do not change comment sorting.
- Do not change notification behavior.
- Do not change edit or delete behavior.
- Do not add login prompts or login routing.
- Do not change Firestore rules or schema.
- Firestore schema/rules changes are out of scope for this feature. If implementation evidence proves they are required, stop implementation and re-scope with explicit user approval and a new plan before making those changes.
