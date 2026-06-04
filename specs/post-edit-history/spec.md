# Article Post Edit History Spec

## Summary

文章與頁面型 posts 要支援與留言一致的 `已編輯` affordance，讓使用者可從文章 UI 檢視該 post 作者的編輯歷史。每筆文章編輯歷史必須保存「編輯前」的 `title` 與 `content`，避免只留下目前版本而無法追溯修改內容。

此功能採用已核准的架構決策：**A. Shared Core + Resource Adapters**。共用 UI / runtime / service 核心只處理通用 edit-history 行為；article posts、post comments、event comments 各自透過 resource adapter 與 resource-specific repo / rules 串接。

## User Scenarios

- 使用者瀏覽文章列表或文章詳情時，若 article post 曾被作者編輯，能看到與留言相同語意的 `已編輯` affordance。
- 使用者點擊 article post 的 `已編輯` affordance 後，能看到該文章每次被編輯前保存的標題與內容。
- 文章作者更新標題或內容時，系統會先保存更新前的 `title` 與 `content` 到 edit-history entry，再更新目前文章內容。
- 若文章更新失敗，UI 不應永久顯示錯誤的 `已編輯` 狀態或錯誤的最新內容。

## Product Decisions

- Article post edit-history entry 保存的是每次編輯前的 `title` + `content`。
- Article post 需要支援與 comments 相同語意的 `已編輯` affordance。
- Article post history path 固定為 `/posts/{postId}/history/{historyId}`。
- Article post edit history 採用與 active article post 相同的 read visibility：任何可查看該 post 的使用者都可開啟 `已編輯` history；parent post soft-deleted 或不可存取時，history 也不可用。此為 user-reviewable spec decision。
- 架構採 **Shared Core + Resource Adapters**，不做只為文章硬刻的單一路徑。

## Requirements

- R1. Article post 目前版本需能標記為已編輯，至少包含可供 UI 判斷的 `isEdited` 狀態，以及可供排序/展示使用的更新時間。
- R2. 每次 article post 編輯必須在 `/posts/{postId}/history/{historyId}` 產生一筆 history entry，entry 必須保存編輯前的 `title` 與 `content`。
- R3. Article post 編輯寫入必須採用 strict post-comment style validation：parent post update 與 history create 必須互相 cross-validate pre-edit `title` + `content`、timestamp、以及 parent `lastEditHistoryId` / `historyId` coupling。
- R4. Article post parent update 必須寫入可驗證的 edit metadata，包含 `isEdited=true`、更新 timestamp、以及指向本次 history entry 的 `lastEditHistoryId`。
- R5. Rules / repo 實作必須保持 resource-specific：article post 的 parent update 與 `/posts/{postId}/history/{historyId}` create 由 post path 的規則驗證，不硬套 post comment 規則。
- R6. Shared Core 只能抽出跨 resource 的穩定概念，例如 affordance、modal presentation、modal state、history entry normalization、pre-edit snapshot builder；resource adapter 負責 path、fetch、payload shape、權限與欄位差異。
- R7. Existing post comments 的 stricter edit-history 行為不可退化：`lastEditHistoryId`、pre-edit content validation、atomic parent update + history create 的語意需保留。
- R8. Event comments 目前規則較鬆；本功能不得順手 harden event comments，除非後續 scope 明確擴張。
- R9. UI 應保留現有 comments history modal 行為，可透過 thin compatibility wrapper 維持 `CommentHistoryModal` import API，或由 Planner 明確排程遷移。
- R10. Firestore rules deploy 是獨立 release boundary；沒有 deploy evidence 前，任何總結不得宣稱 deployed rules 或 deployed product behavior。

## Acceptance Criteria

- AC1. 編輯 article post 的 `title` 或 `content` 後，該 post 會在列表與詳情 UI 呈現 `已編輯` affordance。
- AC2. 點擊 article post 的 `已編輯` affordance 會開啟 edit-history UI，並顯示至少一筆編輯前的 `title` 與 `content`。
- AC3. 多次編輯同一 article post 時，每次 history entry 都保存該次編輯前的 `title` 與 `content`，不覆蓋舊紀錄。
- AC4. Article post edit-history 寫入與 parent post update 需有測試證明不接受缺 history、錯 history、history snapshot 與 pre-edit parent 不一致、timestamp 不一致、或 parent `lastEditHistoryId` 未 coupling 到 `historyId` 的寫入。
- AC5. Existing post comment edit-history 測試仍通過，且 comment `已編輯` affordance / history modal 行為不退化。
- AC6. Event comment rules 未被本功能硬化或重構。
- AC7. Planner 產出的任務切片需包含 Firestore rules / repo-service / runtime / UI / test 的驗證路徑，且明確標示 deployFirestoreRules 邊界。
- AC8. Article post history read rules 與 active article post read visibility 一致；parent post soft-deleted 或不可存取時，history read 被拒絕。

## Out Of Scope

- 不處理 event comments 規則 hardening。
- 不新增資料 migration 或 backfill 舊 posts 的 edit-history。
- 不修改 soft-delete / retention 語意。
- 不改變 post comments 的資料模型，除非是透過 shared core adapter 做無行為變更的薄封裝。
- 不新增 package dependency，除非後續 Planner 提出並取得明確授權。
- 不部署 Firestore/storage rules；本 spec slice 的 `deployFirestoreRules` 授權為 false。
- 不 commit、push、開 PR、watch CI、merge、或 sync local `main`。

## Existing Evidence

- `src/service/post-service.js:109` 目前 `buildUpdatePostPayload` 只回傳 trim 後的 `title` 與 `content`。
- `src/runtime/client/use-cases/post-use-cases.js:176` 目前 `updatePost` 直接呼叫 `updatePostDocument(editingPostId, payload)`。
- `src/components/PostCard.jsx:335` 附近目前只渲染 title/content，沒有 post-level `已編輯` affordance。
- `src/components/CommentCard.jsx:65` 已有 comment-level `已編輯` button。
- `src/service/comment-edit-history-service.js:40` 已有保存 pre-edit comment content 與更新 parent payload 的 builder。
- `firestore.rules:68` 到 `firestore.rules:132` 對 post comments 已有 history create 與 parent update 的互相驗證。
- `firestore.rules:284` 到 `firestore.rules:310` 的 posts update 規則目前允許作者更新一般欄位，尚未要求 post-level history。

## User-Reviewable Spec Decisions

- Article post history path: `/posts/{postId}/history/{historyId}`。
- Article post history visibility: same as active article post read visibility; any user who can view the post can open the `已編輯` history, and history is unavailable when the parent post is soft-deleted or otherwise inaccessible.

## User Authorization

- Spec approved by: user, 2026-06-04.
- User approval evidence: `approve spec，開始實作文章已編輯功能`.
- One-time automated execution authorization: edit owned docs only for spec approval state reconciliation, 2026-06-04.
- Authorization boundary:
  - edit: true after Planner produces implementation task contracts; current reconciliation edits are limited to `specs/post-edit-history/spec.md`, `specs/post-edit-history/handoff.md`, `specs/post-edit-history/tasks.md`, and `specs/post-edit-history/status.json`
  - commit: true when appropriate after Engineer + Reviewer + fresh verification for reviewed implementation batches/workflow state
  - push: false
  - pullRequest: false
  - ciWatch: false
  - merge: false
  - localMainSync: false
  - deployFirestoreRules: false

## Release Notes

- Firestore/storage rules deploy required: yes, later implementation is expected to touch Firestore rules; this spec slice does not deploy.
- Final summaries must not imply deployed rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
