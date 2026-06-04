# Article Post Edit History Plan

## Summary

Current phase: `spec_drafted_awaiting_review`. This is a technical direction draft, not an implementation-ready Planner output.

The feature should add article post edit history through Shared Core + Resource Adapters. The shared layer owns generic edit-history UI/state/building blocks; article posts own their Firestore path, repo calls, rules validation, and tests.

## Architecture

- Shared Core + Resource Adapters:
  - Shared UI: one generic edit-history modal presentation and one reusable `已編輯` affordance.
  - Shared runtime: one modal-state hook for active resource, entries, loading/error, and close/reset behavior.
  - Shared service: one pre-edit snapshot/update payload builder concept that can handle text-only comments and title+content article posts.
  - Resource adapters: post comments, article posts, and any future resource provide fetch/update/normalize/path-specific behavior.
- Article post edit write must be atomic and use `/posts/{postId}/history/{historyId}`:
  - Read current post.
  - Build history payload from pre-edit `title` + `content`.
  - Update parent post with trimmed new `title` / `content`, `updatedAt`, `isEdited=true`, and `lastEditHistoryId=<historyId>`.
  - Create history entry under `/posts/{postId}/history/{historyId}`.
  - Parent post update and history create must cross-validate pre-edit `title` + `content`, timestamp, and `lastEditHistoryId` / `historyId` coupling.
- Firestore rules must validate article post history against the pre-edit parent snapshot with strict post-comment style validation, mirroring the stricter post comment pattern without changing event comments.
- Article post history read rules must match active article post read visibility; users who can view the active post can read its history, and soft-deleted or inaccessible parent posts make history unavailable.

## Files And Responsibilities

These are candidate responsibilities for Planner validation. They are not dispatchable implementation tasks until the user approves `spec.md` and Planner slices the work.

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `src/service/comment-edit-history-service.js` or new shared service helper | Modify/Create | Generalize pre-edit snapshot + update payload building without breaking comment callers. |
| `src/service/post-service.js` | Modify | Build article post update payload including edit metadata and pre-edit history payload. |
| `src/repo/client/firebase-posts-repo.js` | Modify | Add atomic article post update + `/posts/{postId}/history/{historyId}` create repo operation. |
| `src/runtime/client/use-cases/post-use-cases.js` | Modify | Route article post edits through the new atomic use case and expose article post history fetch normalization. |
| `src/runtime/hooks/useEditHistoryModal.js` | Create | Shared modal state for history resource adapters. |
| `src/runtime/hooks/usePostComments.js` | Modify | Keep comment history behavior through shared modal state or an adapter without behavior regression. |
| `src/components/EditedAffordance.jsx` | Create | Shared `已編輯` affordance used by comments and article posts. |
| `src/components/EditHistoryModal.jsx` | Create | Generic modal shell/presentation for edit history entries. |
| `src/components/CommentHistoryModal.jsx` | Modify | Compatibility wrapper or thin adapter over generic modal. |
| `src/components/PostCard.jsx` | Modify | Render article post `已編輯` affordance and trigger article post history view. |
| `src/ui/posts/PostDetailScreen.jsx` | Modify | Wire article post history modal and preserve existing comment history modal behavior. |
| `firestore.rules` | Modify | Add strict article post edit-history validation and `/posts/{postId}/history/{historyId}` access rules. Do not harden event comments in this feature. |
| `tests/**` focused unit/integration/server rules tests | Modify/Create | Cover builder, runtime adapter, UI affordance/modal, and Firestore rules acceptance/rejection cases. |

## Verification Strategy

- Required local gates for implementation planning:
  - `npm run lint:changed`: changed files lint clean.
  - `npm run type-check:changed`: JSDoc `checkJs` surface clean.
  - Focused unit tests for payload builders and modal state.
  - Focused UI/component tests for article post `已編輯` affordance and history modal rendering.
  - Focused Firestore rules tests proving article post update requires matching pre-edit title/content history, matching timestamp, and parent `lastEditHistoryId` / `historyId` coupling.
- Behavior evidence target:
  - Browser/UI evidence should show an edited article post with `已編輯`, opening a modal that displays previous `title` and `content`.
- Regression risk and mitigation:
  - Comment history regression: keep `CommentHistoryModal` API stable or migrate with tests.
  - Rules overreach: tests must prove event comments are not newly constrained by this feature.
  - Non-atomic writes: rules and repo tests must reject missing history, mismatched pre-edit title/content, mismatched timestamp, and broken `lastEditHistoryId` / `historyId` coupling.

## Workflow State

- Status schema: v3.
- Current head snapshot: captured from `092-post-edit-history` at `64607617c9af07fbb8efc1d1a147964f7a589c50`.
- Remote head snapshot: captured from `origin/main` at `64607617c9af07fbb8efc1d1a147964f7a589c50`.
- Last verified commit policy: remains `null` until a Planner/Engineer/Verifier records fresh verification against a commit/ref for implementation or doc closeout.
- Phase commit checkpoints: none in this Engineer slice because `commit=false`.
- Rules deploy status: `required` for the feature program because Firestore rules are expected to change later; `changed=false` in this spec slice.
- Incident handling: any open incident blocks dispatch or closeout unless explicitly mitigated in `status.json` and `handoff.md`.

## Release Boundary

- Firestore/storage rules deploy authorization: `authorizationBoundary.deployFirestoreRules=false`.
- Rules deploy is separate from edit, commit, push, PR, CI, merge, and local `main` sync.
- Final summaries must not imply deployed rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.

## Risk And Stop Conditions

- Stop if implementation needs data migration/backfill for existing posts; this spec excludes migration.
- Stop if implementation changes article post history read policy away from active article post visibility without user approval.
- Stop if shared core changes require touching event comment behavior beyond adapter compatibility.
- Stop if Planner proposes same-wave tasks that share `firestore.rules`, shared helpers, workflow state, package files, or lockfiles.
- Stop before any dependency install, package change, rules deploy, commit, push, PR, CI watch, merge, or local `main` sync unless separately authorized.

## Task Slices

Planner has not run. Candidate slices for Planner to validate after spec approval:

- PENDING-1: Shared core UI/runtime/service adapter contract.
- PENDING-2: Article post repo/service/rules strict atomic edit-history write at `/posts/{postId}/history/{historyId}`.
- PENDING-3: Article post UI/runtime wiring for list/detail `已編輯` affordance and modal.
- PENDING-4: Focused tests and integration gate.

No implementation task is `ready` in this spec-stage handoff.
