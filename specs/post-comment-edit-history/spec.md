# Post Comment Edit History Spec

## Summary

文章留言編輯要補上與活動留言同等的「已編輯」標示與歷史檢視。使用者編輯自己的文章留言時，系統要保留被取代的舊內容，並讓可瀏覽該留言的人從文章詳情頁查看歷史版本。

此功能新增 `posts/{postId}/comments/{commentId}/history` 子集合與對應 Firestore rules。文章留言主文件仍使用既有 `comment` 欄位，不改成 `content`，也不做資料遷移。

## User Scenarios

- 文章留言作者編輯留言後，文章詳情頁上的該留言顯示 `已編輯`，目前版本顯示新的留言內容。
- 使用者點擊文章留言的 `已編輯` 後，看到目前版本與舊版本列表，舊版本依共用 history modal 的格式顯示。
- 非留言作者可以瀏覽可見文章留言的編輯歷史，但不能新增、修改或刪除 history 紀錄。
- 留言作者再次編輯同一則留言時，系統新增一筆 history，不覆蓋既有 history。
- 空白內容或未變更內容不會寫入留言更新，也不會新增 history。

## Requirements

- FR-001: 更新文章留言時，必須在同一個 Firestore transaction 中新增 history 文件並更新留言主文件。
- FR-002: history 文件必須保存被取代的舊文字與被取代時間，並暴露成共用 modal 需要的 `{ content, editedAt }` 形狀。
- FR-003: 文章留言主文件必須保留既有 `comment` 欄位，更新時只新增或更新 `updatedAt` 與 `isEdited`，不得把文章留言主文件改成 `content`。
- FR-004: 文章詳情頁必須用 `CommentCard` 顯示 post comment 的 `isEdited` 與 `updatedAt`，不再固定 `isEdited: false` 或 `updatedAt: null`。
- FR-005: 文章詳情頁必須共用 `CommentHistoryModal`，並把 post comment 的 `comment` 正規化成 modal 所需的 `content`。
- FR-006: 文章留言 runtime hook 必須提供 history modal 所需 state 與 handlers，包括載入成功、載入失敗、關閉 modal，以及更新後的 optimistic state。
- FR-007: Firestore rules 必須允許可讀取 active post comment 的使用者讀取 history，僅允許留言作者在 active post 底下建立 history，並拒絕 update/delete。
- FR-008: 測試必須涵蓋共用 helper、post use-case/repo transaction、post comment hook、PostDetailScreen UI wiring，以及 Firestore rules。

## Success Criteria

- 編輯文章留言後，Firestore 留言文件包含新的 `comment`、`updatedAt`、`isEdited: true`，history 子集合新增一筆舊內容。
- PostDetailScreen 不再把所有 post comments 映射成未編輯狀態。
- 點擊 post comment 的 `已編輯` 會開啟共用 history modal，顯示目前版本與歷史版本。
- Firestore rules tests 證明只有留言作者可建立 post comment history，非作者與未登入使用者不能建立，history update/delete 被拒絕。
- 不需要資料遷移，既有未編輯留言仍可正常顯示與編輯。

## Out Of Scope

- 不遷移既有 `posts/{postId}/comments/{commentId}.comment` 到 `content`。
- 不新增資料修復腳本、不回填既有 post comment history。
- 不改活動留言的使用者行為，除非是為了讓既有 event flow 使用共用 helper 並保持現有行為。
- 不改 post comment soft-delete retention 行為。
- 不新增通知、審計後台、管理員 history 檢視或 history 刪除功能。
- 不部署 Firestore rules。rules deploy 是獨立 release boundary。

## User Authorization

- Spec approved by: user approved design decisions before this Planner task; durable specs creation authorized on 2026-06-03.
- One-time automated execution authorization: product implementation edit and commit authorized by the user on 2026-06-03 after design approval.
- Authorization boundary:
  - edit: true
  - commit: true
  - push: false
  - pullRequest: false
  - ciWatch: false
  - merge: false
  - localMainSync: false
  - deployFirestoreRules: false

## Release Notes

- Firestore/storage rules deploy required: yes, Firestore rules deploy is required after the rules change is reviewed and merged or otherwise approved for release.
- Final summaries must not imply deployed rules or deployed product behavior unless `rulesDeployStatus.state` is `deployed` with deploy evidence.
