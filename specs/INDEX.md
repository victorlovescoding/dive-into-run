# Specs Index

## Purpose

讓 future agents 快速找到 specs、目前狀態、關聯決策與主要 artifacts。這是導覽文件，不是 workflow state，也不取代各 spec 內的 `spec.md`、`plan.md`、`tasks.md` 或 handoff。

## Status Legend

`Active` 表示仍有交付、PR、merge、或驗證收尾未完成。`Completed` 表示已有明確完成或合併證據。`Verified` 表示完成且有明確驗證文件。`Ready to merge` 表示 artifacts 顯示已達可合併狀態但仍需走 PR/merge 收尾。`Task-complete` 表示 task list 已完成但缺較強的最終交付證據。`Needs fixes` 表示仍有實作或 review 修復要做。`Incomplete` 表示工作未完成。`Completed?` 表示舊 artifacts 有完成線索但 evidence 不一致或不完整。

| Spec | Domain | Status | Summary | Key files | Related |
| ---- | ------ | ------ | ------- | --------- | ------- |
| `001-event-filtering` | Events | Task-complete | 活動列表篩選與搜尋條件 | `spec.md`, `plan.md`, `tasks.md` | `004`, `008`, `011` |
| `002-jsdoc-refactor` | Quality | Verified | 活動資料層 JSDoc 補強 | `spec.md`, `plan.md`, `tasks.md`, `verification.md`, `code-review.md` | `003` |
| `003-strict-type-fixes` | Quality | Verified | 嚴格型別與 lint 修復 | 子目錄各有 workflow docs | `001`, `002` |
| `004-event-edit-delete` | Events | Needs fixes | 活動編輯刪除與權限 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `001`, `005`, `009` |
| `005-event-comments` | Social | Ready to merge | 活動留言與錯誤回饋 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `004`, `014`, `015` |
| `006-strava-running-records` | Auth/Profile | Needs fixes | Strava OAuth 同步跑步紀錄 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `007`, `012` |
| `007-member-dashboard` | Auth/Profile | Ready to merge | 會員活動文章留言儀表板 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `006`, `012` |
| `008-run-calendar` | Events | Ready to merge | 跑步紀錄月曆與摘要 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `006`, `007` |
| `009-global-toast` | UI | Ready to merge | 全域 Toast 與頁面遷移 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `004`, `005`, `018` |
| `010-responsive-navbar` | UI | Ready to merge | 響應式導覽列重構 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | - |
| `011-event-share-og` | Social | Ready to merge | 活動分享與 OG metadata | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `004` |
| `012-public-profile` | Auth/Profile | Ready to merge | 公開個人頁與 profile 資料 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md`, `code-review-r2.md` | `006`, `007` |
| `013-pre-run-weather` | Weather | Ready to merge | 跑前天氣與收藏流程 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | - |
| `weather-taiwan-md-map` | Weather/UI | Active | 天氣頁 Taiwan.md 風格互動地圖規格 | `spec.md` | `013` |
| `014-notification-system` | Notifications | Ready to merge | 通知中心與未讀分頁 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `015` |
| `015-comment-notifications` | Notifications | Ready to merge | 留言回覆通知擴充 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `005`, `014` |
| `016-posts-bug-fix` | Posts | Incomplete | 文章頁 dead code 與 bug 修復 | `spec.md`, `plan.md`, `tasks.md` | `017`, `018`, `019`, `020` |
| `017-delete-post-cleanup` | Posts | Task-complete | 刪文時清除子集合 | `spec.md`, `plan.md`, `tasks.md` | `016`, `020` |
| `018-posts-input-validation` | Posts | Task-complete | 文章輸入驗證防線 | `spec.md`, `plan.md`, `tasks.md` | `016`, `020` |
| `019-posts-ui-refactor` | Posts | Ready to merge | 文章列表 UI 重設計 | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `016`, `018`, `020` |
| `020-post-edit-dirty-check` | Posts | Completed? | 編輯 dirty check 與 trim | `spec.md`, `plan.md`, `tasks.md`, `code-review.md` | `018`, `019` |
| `post-comment-soft-delete-retention` | Posts/Notifications | Active | 文章與留言 soft delete、90 天保留、自動清理與跟帖通知資格 | `spec.md` | `014`, `015`, `017`, `fix/post-detail-deleted-guard` |
| `021-layered-dependency-architecture` | Architecture | Completed? | 六層分層與邊界成形 | `tasks.md`, `plan.md`, `handoff.md`, article analysis | - |
| `022-file-size-limits` | Quality | Completed? | 檔案上限拆分全數打勾 | `tasks.md` | `021` |
| `fix/post-detail-deleted-guard` | Quality | Active | 刪文 race 防護規格已核准 | `spec.md` | Posts |
| `gap-b-tech-debt-tracker` | Docs | Active | 技債 tracker 完成待 commit | `spec.md`, `plan.md`, `tasks.md`, `status.json`, `handoff.md` | - |
| `039-gap-g-specs-index` | Docs | Active | specs 導覽索引與交接 | `spec.md`, `plan.md`, `tasks.md`, `status.json`, `handoff.md` | Gap G |
