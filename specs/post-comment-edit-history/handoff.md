# Post Comment Edit History Handoff

## Current State

- Must match `status.json`; reconcile before dispatch if this section differs.
- Profile: P4, because this is a new product feature and Firestore rules are in scope.
- Worktree: `/Users/chentzuyu/Desktop/dive-into-run-088-post-comment-edit-history`
- Branch: `088-post-comment-edit-history`
- Current head: `f3ca150ece7f9ba182fcde80cae95d6c0da18305`
- Remote head: `origin/main` at `f3ca150ece7f9ba182fcde80cae95d6c0da18305`
- Authorization boundary:
  - edit: true. User authorized implementation on 2026-06-03 after approving the design and durable repo docs.
  - commit: true. User said "該commit就commit" on 2026-06-03.
  - push: false
  - pullRequest: false
  - ciWatch: false
  - merge: false
  - localMainSync: false
  - deployFirestoreRules: false
- Current phase: `implementation_authorized`
- Active task: none
- Active wave: none
- Latest reviewer decision: none
- Last verified commit: none
- Phase commits: none
- Rules deploy status: `required`, `changed=false`, no deploy evidence.
- Incidents: none
- Blocked: no
- Blocked reason: none.

## Read Order

1. `AGENTS.md`
2. `docs/superpowers/workflow.md`
3. `specs/post-comment-edit-history/handoff.md`
4. `specs/post-comment-edit-history/tasks.md`
5. `specs/post-comment-edit-history/status.json`
6. `specs/post-comment-edit-history/spec.md` and `specs/post-comment-edit-history/plan.md` as needed for scope or acceptance details

## Next Action

Main coordinator should dispatch T001 to an Engineer. Product implementation edits and commits are authorized; push, pull request, CI watch, merge, local main sync, and Firestore rules deploy are not authorized.

## Latest Evidence

- Branch/worktree evidence:
  - `git status --short --branch` at planning start showed `## 088-post-comment-edit-history...origin/main` with no changed files.
  - `git rev-parse --verify HEAD` returned `f3ca150ece7f9ba182fcde80cae95d6c0da18305`.
  - `git rev-parse --verify origin/main` returned `f3ca150ece7f9ba182fcde80cae95d6c0da18305`.
- Existing event flow evidence:
  - `src/service/event-comment-service.js:114` builds event update/history payload using `content`.
  - `src/runtime/client/use-cases/event-comment-use-cases.js:130` calls event comment update flow with old content.
  - `src/repo/client/firebase-event-comments-repo.js:89` through `src/repo/client/firebase-event-comments-repo.js:109` writes event comment history in a transaction.
  - `firestore.rules:409` through `firestore.rules:421` defines event comment history rules.
- Existing post gap evidence:
  - `src/service/post-service.js:156` through `src/service/post-service.js:176` already has an unused post comment update/history payload helper. The plan accounts for this by extracting shared helper logic instead of assuming no post payload code exists.
  - `src/runtime/client/use-cases/post-use-cases.js:317` through `src/runtime/client/use-cases/post-use-cases.js:318` only calls `updateCommentDocument(postId, commentId, { comment })`.
  - `src/repo/client/firebase-posts-repo.js:280` through `src/repo/client/firebase-posts-repo.js:281` only uses `updateDoc` for post comment updates.
  - `src/runtime/hooks/usePostComments.js:136` through `src/runtime/hooks/usePostComments.js:165` updates only local `comment` text and calls update without previous text/history metadata.
  - `src/ui/posts/PostDetailScreen.jsx:189` through `src/ui/posts/PostDetailScreen.jsx:199` maps post comments to `CommentCard` with `updatedAt: null` and `isEdited: false`.
  - `src/ui/posts/PostDetailScreen.jsx:346` through `src/ui/posts/PostDetailScreen.jsx:358` renders `CommentCard` without `onViewHistory`.
  - `firestore.rules:250` through `firestore.rules:281` defines post comment rules without a nested history match.
- Shared modal evidence:
  - `src/components/CommentHistoryModal.jsx:30` through `src/components/CommentHistoryModal.jsx:40` renders history entries from `entry.content`.
  - `src/components/CommentHistoryModal.jsx:65` through `src/components/CommentHistoryModal.jsx:69` renders current comment from `comment.content`.

## Latest Verification

| Command | Exit | Evidence |
| ------- | ---- | -------- |
| `npm run workflow:check -- specs/post-comment-edit-history/status.json` | 0 | `status.json` valid and synced for this feature. |
| `node scripts/check-superpowers-state.js --owned-files specs/post-comment-edit-history/spec.md specs/post-comment-edit-history/plan.md specs/post-comment-edit-history/tasks.md specs/post-comment-edit-history/handoff.md specs/post-comment-edit-history/status.json --status specs/post-comment-edit-history/status.json` | 0 | Five changed files are within explicit owned specs files; workflow state synced. |
| `git diff --check` | 0 | No whitespace errors. |

## Closeout Checklist

- [ ] `tasks.md` task states match `status.json`.
- [ ] Active task and active wave match `status.json`.
- [ ] Latest reviewer decision is recorded in `tasks.md` and `status.json`.
- [ ] `lastVerification` has one entry per command.
- [ ] `lastVerifiedCommit`, `currentHead`, `remoteHead`, and `phaseCommits` reflect the latest verified state.
- [ ] `authorizationBoundary.deployFirestoreRules` is recorded and treated as separate from `edit`, `commit`, `push`, `pullRequest`, `ciWatch`, `merge`, and `localMainSync`.
- [ ] `rulesDeployStatus` matches the rules release state.
- [ ] Final summary does not imply deployed rules/product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
- [ ] PR/CI/merge notes explicitly carry release risk if rules are in a non-deployed state such as `required`, `pending`, or `blocked`.
- [ ] Open `incidents` are resolved, mitigated with an explicit carry-forward, or block closeout.
- [ ] Changed files are intentionally in scope.
- [ ] Blockers are resolved or explicitly carried forward.

## Blockers

- No workflow blocker for the specs-only planning task.
- Firestore rules deploy is not authorized.

## Pitfalls

- Do not treat the existing `src/service/post-service.js` update helper as complete feature support; it is not wired to repo transaction, runtime history state, UI, or rules.
- Do not change post comment main document text field from `comment` to `content`.
- Do not claim rules-backed behavior is deployed unless `rulesDeployStatus.state=deployed` and deploy evidence exists.
- Do not parallelize shared helper or Firestore rules work with dependent tasks.
