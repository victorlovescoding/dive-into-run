# Research: Comment Identity Hint Consistency

## Shared Composer

**Decision**: Use or extend `src/components/CommentInput.jsx` and `src/components/useCommentComposerInput.js` for both event and post comment composer behavior.

**Rationale**: The existing shared composer already owns the 500-character draft constraint and composer input behavior. Reusing it avoids duplicating validation, disabled states, clearing logic, and bottom composer layout across post and event pages.

**Alternatives considered**: Keep the post inline form and copy missing avatar/validation behavior into it. Rejected because it preserves two behavior sources and makes future parity defects more likely.

## Auth Visibility

**Decision**: Keep the event composer hidden for anonymous users through `src/components/CommentSection.jsx`, and align the post path so anonymous users do not see the composer.

**Rationale**: The spec requires anonymous users to see no input, avatar, submit button, login prompt, or login CTA. Event behavior already matches the visibility requirement; post behavior currently needs parity because its inline form still renders when unauthenticated.

**Alternatives considered**: Render disabled anonymous composers or login prompts. Rejected because FR-008 and FR-009 explicitly require no composer and no new login prompt/CTA.

## Avatar Fallback

**Decision**: Use the current user's `photoURL` when available, otherwise use `/default-avatar.png`. The composer avatar is display-only, non-clickable, and not wrapped in `UserLink`.

**Rationale**: `public/default-avatar.png` exists and matches the existing product fallback pattern used by `UserLink`. The spec says the avatar is an identity hint only and must not navigate.

**Alternatives considered**: Use initials, hide the avatar, or link to the profile. Rejected because the spec requires a visible default avatar and forbids click-through behavior.

## Submit And Duplicate Handling

**Decision**: Make the post submit path accept comment content, expose/track submitting state, return a success result, clear only after success, and block duplicate submits while pending. Keep event submit behavior equivalent through the shared composer contract.

**Rationale**: The spec requires valid content submission, clear-on-success, and duplicate-submit prevention on both post and event pages. Returning success lets `CommentInput` clear drafts only when persistence succeeds.

**Alternatives considered**: Let the UI clear optimistically or rely only on button disabling. Rejected because failure handling should preserve the draft and duplicate prevention must not depend on visual state alone.

## 500-Character Parity

**Decision**: Use 500 characters as the product comment length limit for the composer. If implementation touches service validation, bring `src/service/post-service.js` into parity with the same 500-character guard.

**Rationale**: `src/components/useCommentComposerInput.js` already uses 500 and Firestore rules enforce 500 for post/event comment text. Explorer evidence notes the current post service lacks this guard; service validation should not drift if touched.

**Alternatives considered**: Introduce a new limit or leave post service validation weaker. Rejected because the spec says to use the existing product constraint and this feature is parity work, not a policy change.

## Test Strategy

**Decision**: Add focused Vitest/RTL jsdom tests for `CommentInput`, `CommentSection`, and `PostDetailScreen`. Add service tests only if service validation changes.

**Rationale**: Existing tests in this worktree are mostly server Firestore rules tests, and there is no useful E2E harness in this snapshot. Focused jsdom tests can prove authenticated avatar rendering, fallback avatar rendering, anonymous hidden composer, validation disabled states, submit success clearing, and duplicate-submit prevention.

**Alternatives considered**: Use only Firestore rules tests or E2E stubs. Rejected because rules tests do not cover UI/runtime behavior, and `npm test` plus `npm run test:e2e:*` are disabled stubs here.

## No Schema Migration

**Decision**: Do not add or migrate Firestore schemas, collections, fields, indexes, or rules as part of this plan.

**Rationale**: Existing data flow already stores post comments under `posts/{postId}/comments` and event comments through the event comment service. The feature is UI/runtime parity for composer identity and submit behavior.

**Alternatives considered**: Add author-avatar fields or composer state to stored comments. Rejected because the composer uses current auth identity at render time and the spec does not require changing persisted comment records.

## Constrained Agent Context Update

**Decision**: Manually update only the `<!-- SPECKIT START -->` to `<!-- SPECKIT END -->` block in `AGENTS.md` to reference `specs/099-comment-identity-hint/plan.md`.

**Rationale**: `AGENTS.md` is the repo source of truth, and Spec Kit is explicit-only legacy adapter context. The generic `update-agent-context.sh` script is broad and may rewrite unrelated AGENTS content, so it is not appropriate for this constrained write set.

**Alternatives considered**: Run the generic agent context updater. Rejected because the user explicitly forbids broad AGENTS rewrites and requires preserving Context Routing priority.
