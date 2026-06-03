# Post Comment Edit History Plan

## Summary

實作文章留言編輯歷史，並把 event/post 兩套留言更新 payload 生成收斂到共用 service。post comment 主文件繼續使用 `comment` 欄位；history 與 UI modal 使用 `{ content, editedAt }` 的共用形狀。

Profile: P4。理由是新增 product feature 且涉及 Firestore rules，屬 C4/R4。

## Architecture

- 共用 helper 放在 service layer，負責 trim、unchanged guard、history payload、comment update payload。helper 接受目前文字欄位名稱，讓 event 使用 `content`，post 使用 `comment`。
- event flow 保持現有行為，改為呼叫共用 helper，避免 event 與 post 各自複製 payload 邏輯。
- post flow 補齊 event 同等資料流：runtime hook 保存 history modal state，use-case 建立 payload，repo transaction 同時寫 history 與更新 comment。
- UI 沿用 `CommentCard` 與 `CommentHistoryModal`。PostDetailScreen 負責把 post comment 正規化成 `{ content, updatedAt, isEdited }`，不改共用 modal 的資料契約。
- Firestore rules 在 `posts/{postId}/comments/{commentId}/history/{historyId}` 增加明確 read/create/update/delete 規則；actual deploy 另走 release boundary。

## Files And Responsibilities

| Path | Action | Responsibility |
| ---- | ------ | -------------- |
| `src/service/comment-edit-history-service.js` | Create | 共用 comment edit history payload builder，支援 event `content` 與 post `comment`。 |
| `src/service/event-comment-service.js` | Modify | 改用共用 helper，保持現有 event payload 與 validation 行為。 |
| `src/service/post-service.js` | Modify | 改用共用 helper；保留 post comment 主文件 `comment` 欄位；移除或收斂目前未串接的 post update payload 重複邏輯。 |
| `src/repo/client/firebase-posts-repo.js` | Modify | 新增 post comment transaction update 與 history fetch。 |
| `src/runtime/client/use-cases/post-use-cases.js` | Modify | 建立 post comment update/history use-case，負責 payload 與 repo 串接。 |
| `src/runtime/hooks/usePostComments.js` | Modify | 管理 post comment history modal state、view/close handler、更新後 optimistic state。 |
| `src/ui/posts/PostDetailScreen.jsx` | Modify | 將 post comments 正規化給 `CommentCard` / `CommentHistoryModal`，接上 `onViewHistory`。 |
| `firestore.rules` | Modify | 加上 post comment history 子集合 read/create/update/delete 規則。 |
| `specs/post-comment-edit-history/tests/unit/service/comment-edit-history-service.test.js` | Create | 共用 helper 和 event/post payload contract 單元測試。 |
| `specs/post-comment-edit-history/tests/unit/runtime/post-comment-edit-history-use-cases.test.js` | Create | post use-case update/history fetch 測試。 |
| `src/runtime/hooks/usePostComments.test.jsx` | Modify | post comment edit/history hook 測試。 |
| `src/ui/posts/PostDetailScreen.test.jsx` | Modify | post detail history button/modal wiring 測試。 |
| `tests/server/firestore/post-soft-delete-rules.test.js` | Modify | post comment history Firestore rules 測試。 |

## Data Flow

1. 使用者在文章詳情頁編輯自己的留言。
2. `usePostComments.saveEditedPostComment` 取得目前留言文字，傳給 `post-use-cases.updateComment(postId, commentId, { comment, currentComment })`。
3. `post-use-cases` 用 `serverTimestamp()` 呼叫 shared helper，取得 `historyPayload` 與 `commentUpdate`。
4. `firebase-posts-repo` 在 transaction 內讀取 comment 文件，建立 `posts/{postId}/comments/{commentId}/history/{autoId}`，再更新 comment 主文件。
5. hook optimistic state 更新 `comment`、`updatedAt`、`isEdited`。失敗時回滾文字與 edit metadata。
6. 使用者點擊 `已編輯` 時，hook 呼叫 use-case 讀取 history，回傳 `{ id, content, editedAt }[]` 給 `CommentHistoryModal`。

## Rules Plan

- 新增 nested match: `match /posts/{postId}/comments/{commentId}/history/{historyId}`。
- `allow read`: 與 post comment 可見性一致，至少要求 `isActivePost(postId)`。
- `allow create`: 需要登入、active post、parent comment 存在且 `request.auth.uid` 等於 parent comment `authorUid`。
- `allow create` payload 應限制為 history contract 欄位，例如 `content` 與 `editedAt`，且 `content` 是非空字串、長度不超過 500，`editedAt` 是 timestamp。
- `allow update, delete`: false。
- 不在此功能執行 deploy。`rulesDeployStatus` 在 workflow state 中維持 `required`，直到 release boundary 有 deploy evidence。

## Verification Strategy

- Required local gates:
  - `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/service/comment-edit-history-service.test.js`
  - `npx vitest run --project=browser specs/post-comment-edit-history/tests/unit/runtime/post-comment-edit-history-use-cases.test.js`
  - `npx vitest run --project=browser src/runtime/hooks/usePostComments.test.jsx`
  - `npx vitest run --project=browser src/ui/posts/PostDetailScreen.test.jsx`
  - `npx vitest run --project=server tests/server/firestore/post-soft-delete-rules.test.js`
  - `npm run lint:changed`
  - `npm run type-check:changed`
  - `npm run depcruise`
  - `git diff --check`
  - `npm run workflow:check -- specs/post-comment-edit-history/status.json`
- Browser evidence target: required for final UI integration before completion claim. Use Browser or Chrome against post detail page, verify edited marker and history modal at desktop and mobile viewport. This is not required for service/repo/rules-only slices.
- Regression risk and mitigation: event comment history is existing behavior; T001 must keep event payload output stable with focused tests before post layers depend on the shared helper.

## Workflow State

- Status schema: v3.
- Current head snapshot: captured from `git rev-parse --verify HEAD` at planning time.
- Remote head snapshot: captured from `git rev-parse --verify origin/main` at planning time.
- Last verified commit policy: remains `null` until fresh task verification passes for an implementation commit/ref.
- Phase commit checkpoints: expected phases are `spec`, `plan`, `service`, `post-data-flow`, `runtime-ui`, `rules`, and `closeout`. Commit is authorized; push remains unauthorized.
- Rules deploy status: `required`, because Firestore rules are in scope. `changed=false` until `firestore.rules` is actually modified.
- Incident handling: open incidents block dispatch or closeout unless explicitly carried forward in `handoff.md`, `tasks.md`, and `status.json`.

## Release Boundary

- Firestore/storage rules deploy authorization: `authorizationBoundary.deployFirestoreRules=false`.
- Rules deploy is separate from edit, commit, push, PR, CI, merge, and local `main` sync.
- Final summaries must not imply deployed rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.

## Risk And Stop Conditions

- Stop if implementation requires migrating post comment documents from `comment` to `content`.
- Stop if Firestore rules need broader public/private semantics than active post comment visibility.
- Stop if a task needs files outside its owned files, a new dependency, a package/lockfile change, or a data migration.
- Stop if event comment behavior changes beyond helper extraction parity.
- Stop if rules tests require an actual deploy, because deploy is not authorized.
- Stop if `tasks.md`, `status.json`, and `handoff.md` drift before dispatch or closeout.

## Task Slices

- T001: Shared comment edit history service and event/post service contracts.
- T002: Post comment repository transaction and use-case history API.
- T003: Post comment runtime hook history state and optimistic metadata.
- T004: PostDetailScreen history UI wiring.
- T005: Firestore rules and rules tests for post comment history.
