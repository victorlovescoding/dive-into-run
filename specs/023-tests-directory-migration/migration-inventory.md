# Migration Inventory（測試目錄遷移：mv 對照表 + 每 phase handoff）

> 跨 Phase 1-3 的 mv 對照表 + 完成後的 handoff 紀錄。每個 phase 一節，按時間順序累加。
> Phase 0/1 的完整 handoff 細節在姐妹檔 [`./migration-handoff.md`](./migration-handoff.md)（保留為 archive，本檔不重複），本檔 Phase 1 Handoff Highlights 段只放最精煉的「下個 session 必看」要點。

---

## Phase 1 Inventory（unit tests，2026-04-27 完成）

> 產出時間：Phase 1 Wave 1 inventory，列每個 unit test 的 source/target/layer/import-evidence。
> **本文件不執行 mv**，僅作 Phase 1 batch mv 的 ground-truth；後續 wave 依此表執行 `git mv` 並驗證。

## Layer 對應規則速查

| 主要被測 import 來源                                   | Sub-folder               |
| ------------------------------------------------------ | ------------------------ |
| `@/service/<X>` 或 `*-service` / `*-helpers`           | `tests/unit/service/`    |
| `@/repo/<X>` 或 `firebase-<X>`（repo 層）              | `tests/unit/repo/`       |
| `@/runtime/<X>` 或 hook (`useXxx.test.jsx`) / provider | `tests/unit/runtime/`    |
| `@/lib/<X>` 或 lint rule / policy                      | `tests/unit/lib/`        |
| `@/config/<X>`                                         | `tests/unit/config/`     |
| Next.js API route handler (`*-route.test.js`)          | `tests/unit/api/`        |
| `@/components/<X>`                                     | `tests/unit/components/` |

## Inventory Table

| #   | Source Path                                                                                        | Layer   | Target Path                                                | Main Import Evidence                                                                               | Notes                                                                     |
| --- | -------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | specs/001-event-filtering/tests/unit/firebase-events.test.js                                       | lib     | tests/unit/lib/firebase-events-001-event-filtering.test.js | `import { queryEvents } from '@/lib/firebase-events'` (line 3)                                     | RENAME — collides with 002/003 firebase-events.test.js (content differs)  |
| 2   | specs/002-jsdoc-refactor/tests/unit/firebase-events.test.js                                        | lib     | tests/unit/lib/firebase-events-002-jsdoc.test.js           | `import { ... } from '@/lib/firebase-events'` (line 14)                                            | RENAME — collides with 001/003 firebase-events.test.js (content differs)  |
| 3   | specs/003-strict-type-fixes/app-events-page/tests/unit/event-helpers.test.js                       | lib     | tests/unit/lib/event-helpers.test.js                       | `import { ... } from '@/lib/event-helpers'` (line 11)                                              |                                                                           |
| 4   | specs/003-strict-type-fixes/lib-firebase-events/tests/unit/firebase-events.test.js                 | lib     | tests/unit/lib/firebase-events.test.js                     | `import { ... } from '@/lib/firebase-events'` (line 14)                                            | Latest spec number → keeps original name; older 001/002 get tag           |
| 5   | specs/004-event-edit-delete/tests/unit/firebase-events-edit-delete.test.js                         | lib     | tests/unit/lib/firebase-events-edit-delete.test.js         | `await import('@/lib/firebase-events')` (line 105+, updateEvent/deleteEvent)                       |                                                                           |
| 6   | specs/005-event-comments/tests/unit/firebase-comments.test.js                                      | lib     | tests/unit/lib/firebase-comments.test.js                   | `await import('@/lib/firebase-comments')` (line 144+, fetchComments)                               |                                                                           |
| 7   | specs/006-strava-running-records/tests/unit/firebase-admin-helpers.test.js                         | service | tests/unit/service/firebase-admin-helpers.test.js          | `await import('@/repo/server/strava-server-repo')` + `@/runtime/server/use-cases/...` (line 65-66) | `*-helpers` filename → service per rule; tests cross-cutting helpers      |
| 8   | specs/006-strava-running-records/tests/unit/firebase-strava.test.js                                | repo    | tests/unit/repo/firebase-strava.test.js                    | `await import('@/repo/client/firebase-strava-repo')` (line 64+)                                    |                                                                           |
| 9   | specs/006-strava-running-records/tests/unit/strava-callback-route.test.js                          | api     | tests/unit/api/strava-callback-route.test.js               | `import { POST } from '@/app/api/strava/callback/route'` (line 13)                                 | NEW sub-folder `tests/unit/api/`                                          |
| 10  | specs/006-strava-running-records/tests/unit/strava-disconnect-route.test.js                        | api     | tests/unit/api/strava-disconnect-route.test.js             | `import { POST } from '@/app/api/strava/disconnect/route'` (line 13)                               |                                                                           |
| 11  | specs/006-strava-running-records/tests/unit/strava-helpers.test.js                                 | service | tests/unit/service/strava-helpers.test.js                  | `import { formatDistance, ... } from '@/lib/strava-helpers'` (line 11)                             | `*-helpers` filename → service per rule                                   |
| 12  | specs/006-strava-running-records/tests/unit/strava-sync-route.test.js                              | api     | tests/unit/api/strava-sync-route.test.js                   | `import { POST } from '@/app/api/strava/sync/route'` (line 13)                                     |                                                                           |
| 13  | specs/006-strava-running-records/tests/unit/strava-webhook-route.test.js                           | api     | tests/unit/api/strava-webhook-route.test.js                | `import { GET, POST } from '@/app/api/strava/webhook/route'` (line 19)                             |                                                                           |
| 14  | specs/006-strava-running-records/tests/unit/sync-strava-activities.test.js                         | runtime | tests/unit/runtime/sync-strava-activities.test.js          | `await import('@/runtime/server/use-cases/strava-server-use-cases')` (line 63)                     |                                                                           |
| 15  | specs/006-strava-running-records/tests/unit/sync-token-revocation.test.js                          | api     | tests/unit/api/sync-token-revocation.test.js               | `import { POST } from '@/app/api/strava/sync/route'` (line 21)                                     |                                                                           |
| 16  | specs/006-strava-running-records/tests/unit/useStravaActivities.test.jsx                           | runtime | tests/unit/runtime/useStravaActivities.test.jsx            | `import useStravaActivities from '@/runtime/hooks/useStravaActivities'` (line 23)                  | Hook test                                                                 |
| 17  | specs/006-strava-running-records/tests/unit/useStravaConnection.test.jsx                           | runtime | tests/unit/runtime/useStravaConnection.test.jsx            | `import useStravaConnection from '@/runtime/hooks/useStravaConnection'` (line 37)                  | Hook test                                                                 |
| 18  | specs/007-member-dashboard/tests/unit/firebase-member.test.js                                      | lib     | tests/unit/lib/firebase-member.test.js                     | `await import('@/lib/firebase-member')` (line 135+, fetchMyEventIds/fetchMyEvents)                 |                                                                           |
| 19  | specs/008-run-calendar/tests/unit/buildCalendarGrid.test.js                                        | lib     | tests/unit/lib/buildCalendarGrid.test.js                   | `import { buildCalendarGrid } from '@/lib/strava-helpers'` (line 8)                                | Imports from `@/lib/...` (filename mismatched with `*-helpers`)           |
| 20  | specs/008-run-calendar/tests/unit/calcMonthSummary.test.js                                         | service | tests/unit/service/calcMonthSummary.test.js                | `import { calcMonthSummary } from '@/service/strava-data-service'` (line 8)                        |                                                                           |
| 21  | specs/008-run-calendar/tests/unit/groupActivitiesByDay.test.js                                     | service | tests/unit/service/groupActivitiesByDay.test.js            | `import { groupActivitiesByDay } from '@/service/strava-data-service'` (line 8)                    |                                                                           |
| 22  | specs/010-responsive-navbar/tests/unit/firebase-auth-helpers.test.js                               | service | tests/unit/service/firebase-auth-helpers.test.js           | `import { signInWithGoogle, ... } from '@/lib/firebase-auth-helpers'` (line 3)                     | `*-helpers` filename → service per rule                                   |
| 23  | specs/011-event-share-og/tests/unit/og-helpers.test.js                                             | service | tests/unit/service/og-helpers.test.js                      | `import { ... } from '@/lib/og-helpers'` (line 14)                                                 | `*-helpers` filename → service per rule                                   |
| 24  | specs/012-public-profile/tests/unit/firebase-profile-server.test.js                                | repo    | tests/unit/repo/firebase-profile-server.test.js            | `vi.mock('@/repo/server/firebase-profile-server-repo', ...)` (line 25)                             |                                                                           |
| 25  | specs/012-public-profile/tests/unit/firebase-profile.test.js                                       | lib     | tests/unit/lib/firebase-profile.test.js                    | `await import('@/lib/firebase-profile')` (line 177+, getUserProfile/getProfileStats)               |                                                                           |
| 26  | specs/013-pre-run-weather/tests/unit/firebase-weather-favorites.test.js                            | repo    | tests/unit/repo/firebase-weather-favorites.test.js         | `import { ... } from '@/repo/client/firebase-weather-favorites-repo'` (line 17)                    |                                                                           |
| 27  | specs/013-pre-run-weather/tests/unit/weather-api-route.test.js                                     | api     | tests/unit/api/weather-api-route.test.js                   | `import { GET } from '@/app/api/weather/route'` (line 6)                                           |                                                                           |
| 28  | specs/013-pre-run-weather/tests/unit/weather-helpers.test.js                                       | service | tests/unit/service/weather-helpers.test.js                 | `import { ... } from '@/service/weather-location-service'` (line 9) + `@/runtime/...use-cases`     | `*-helpers` filename + service is primary import → service                |
| 29  | specs/014-notification-system/tests/unit/firebase-notifications-read.test.js                       | lib     | tests/unit/lib/firebase-notifications-read.test.js         | `import ... from '@/lib/firebase-notifications'` (line 54)                                         |                                                                           |
| 30  | specs/014-notification-system/tests/unit/firebase-notifications-write.test.js                      | lib     | tests/unit/lib/firebase-notifications-write.test.js        | `import ... from '@/lib/firebase-notifications'` (line 40)                                         |                                                                           |
| 31  | specs/014-notification-system/tests/unit/notification-helpers.test.js                              | lib     | tests/unit/lib/notification-helpers-014.test.js            | `import { formatRelativeTime, getNotificationLink } from '@/lib/notification-helpers'` (line 2)    | RENAME — collides with 015 notification-helpers.test.js (content differs) |
| 32  | specs/015-comment-notifications/tests/unit/fetch-distinct-comment-authors.test.js                  | lib     | tests/unit/lib/fetch-distinct-comment-authors.test.js      | `import { fetchDistinctCommentAuthors } from '@/lib/firebase-notifications'` (line 37)             |                                                                           |
| 33  | specs/015-comment-notifications/tests/unit/notification-helpers.test.js                            | lib     | tests/unit/lib/notification-helpers.test.js                | `import { getNotificationLink } from '@/lib/notification-helpers'` (line 2)                        | Latest spec number → keeps original name                                  |
| 34  | specs/015-comment-notifications/tests/unit/notify-event-new-comment.test.js                        | lib     | tests/unit/lib/notify-event-new-comment.test.js            | `import { notifyEventNewComment } from '@/lib/firebase-notifications'` (line 50)                   |                                                                           |
| 35  | specs/015-comment-notifications/tests/unit/notify-post-comment-reply.test.js                       | lib     | tests/unit/lib/notify-post-comment-reply.test.js           | `import { notifyPostCommentReply } from '@/lib/firebase-notifications'` (line 40)                  |                                                                           |
| 36  | specs/017-delete-post-cleanup/tests/unit/deletePost.test.js                                        | lib     | tests/unit/lib/deletePost.test.js                          | `import { deletePost } from '@/lib/firebase-posts'` (line 3)                                       |                                                                           |
| 37  | specs/018-posts-input-validation/tests/unit/create-post-validation.test.js                         | lib     | tests/unit/lib/create-post-validation.test.js              | `import { createPost } from '@/lib/firebase-posts'` (line 25)                                      |                                                                           |
| 38  | specs/018-posts-input-validation/tests/unit/update-post-validation.test.js                         | lib     | tests/unit/lib/update-post-validation.test.js              | `import { updatePost } from '@/lib/firebase-posts'` (line 28)                                      |                                                                           |
| 39  | specs/018-posts-input-validation/tests/unit/validate-post-input.test.js                            | lib     | tests/unit/lib/validate-post-input.test.js                 | `import { ... } from '@/lib/firebase-posts'` (line 31)                                             |                                                                           |
| 40  | specs/020-post-edit-dirty-check/tests/unit/update-post-trim.test.js                                | lib     | tests/unit/lib/update-post-trim.test.js                    | `import { updatePost } from '@/lib/firebase-posts'` (line 3)                                       |                                                                           |
| 41  | specs/021-layered-dependency-architecture/tests/unit/canonical-no-import-lib.test.js               | lib     | tests/unit/lib/canonical-no-import-lib.test.js             | `import depCruiseConfig from '...../.dependency-cruiser.mjs'` (line 9) — policy/lint test          | Policy test (dep-cruise rule + filesystem scan)                           |
| 42  | specs/021-layered-dependency-architecture/tests/unit/event-service-rules.test.js                   | service | tests/unit/service/event-service-rules.test.js             | `import { ... } from '@/service/event-service'` (line 8)                                           |                                                                           |
| 43  | specs/021-layered-dependency-architecture/tests/unit/notification-use-cases.test.js                | runtime | tests/unit/runtime/notification-use-cases.test.js          | `await import('@/runtime/client/use-cases/notification-use-cases')` (line 29)                      |                                                                           |
| 44  | specs/021-layered-dependency-architecture/tests/unit/post-use-cases.test.js                        | runtime | tests/unit/runtime/post-use-cases.test.js                  | `await import('@/runtime/client/use-cases/post-use-cases')` (line 41)                              |                                                                           |
| 45  | specs/021-layered-dependency-architecture/tests/unit/profile-events-runtime.test.js                | runtime | tests/unit/runtime/profile-events-runtime.test.js          | `await import('@/runtime/hooks/useProfileEventsRuntime')` (line 93)                                | Hook test                                                                 |
| 46  | specs/021-layered-dependency-architecture/tests/unit/profile-service.test.js                       | service | tests/unit/service/profile-service.test.js                 | `await import('@/service/profile-service')` (line 17)                                              |                                                                           |
| 47  | specs/021-layered-dependency-architecture/tests/unit/provider-cross-cutting.test.js                | lib     | tests/unit/lib/provider-cross-cutting.test.js              | `import depCruiseConfig from '...../.dependency-cruiser.mjs'` (line 4) — policy test               | Policy test (dep-cruise rule)                                             |
| 48  | specs/021-layered-dependency-architecture/tests/unit/server-only-enforcement.test.js               | lib     | tests/unit/lib/server-only-enforcement.test.js             | `import depCruiseConfig from '...../.dependency-cruiser.mjs'` (line 4) — policy test               | Policy test (dep-cruise rule)                                             |
| 49  | specs/021-layered-dependency-architecture/tests/unit/test-bucket-policy.test.js                    | lib     | tests/unit/lib/test-bucket-policy.test.js                  | Bucket policy test (Phase 0 already asserts 8-bucket alignment)                                    | Per spec: special case `lib` target                                       |
| 50  | specs/021-layered-dependency-architecture/tests/unit/weather-forecast-service.test.js              | service | tests/unit/service/weather-forecast-service.test.js        | `import ... from '@/service/weather-forecast-service'` (line 11)                                   |                                                                           |
| 51  | specs/fix/event-detail-deleted-guard/tests/unit/EVENT_NOT_FOUND_MESSAGE.test.js                    | lib     | tests/unit/lib/EVENT_NOT_FOUND_MESSAGE.test.js             | `import { deleteEvent, EVENT_NOT_FOUND_MESSAGE } from '@/lib/firebase-events'` (line 11)           |                                                                           |
| 52  | specs/fix/post-detail-deleted-guard/tests/unit/POST_NOT_FOUND_MESSAGE.test.js                      | lib     | tests/unit/lib/POST_NOT_FOUND_MESSAGE.test.js              | `import { deletePost, POST_NOT_FOUND_MESSAGE } from '@/lib/firebase-posts'` (line 3)               |                                                                           |
| 53  | specs/g10-storage-helper/tests/unit/firebase-storage-helpers.test.js                               | runtime | tests/unit/runtime/firebase-storage-helpers.test.js        | `import { uploadUserAvatar } from '@/runtime/client/use-cases/avatar-upload-use-cases'` (line 3)   | Filename `*-helpers` but main import is runtime use-case → runtime        |
| 54  | specs/g8-server-coverage/tests/unit/firebase-admin.test.js                                         | KEEP    | (no move)                                                  | server project — `await import('@/config/server/firebase-admin-app')` etc.                         | KEEP IN PLACE — server project (vitest.config.mjs:59 hardcoded)           |
| 55  | specs/g8-server-coverage/tests/unit/firebase-profile-server.test.js                                | KEEP    | (no move)                                                  | server project — `await import('@/service/profile-server-service')` etc.                           | KEEP IN PLACE — server project (vitest.config.mjs:59 hardcoded)           |
| 56  | specs/mock-audit-b-weather-api/tests/unit/weather-api.test.js                                      | repo    | tests/unit/repo/weather-api.test.js                        | `import { fetchWeather } from '@/repo/client/weather-api-repo'` (line 9)                           |                                                                           |
| 57  | specs/mock-audit-c-firebase-users/tests/unit/firebase-users.test.js                                | repo    | tests/unit/repo/firebase-users.test.js                     | `import { ... } from '@/repo/client/firebase-users-repo'` (line 17)                                |                                                                           |
| 58  | specs/mock-audit-d1-firebase-posts/tests/unit/firebase-posts-crud.test.js                          | lib     | tests/unit/lib/firebase-posts-crud.test.js                 | `await import('@/lib/firebase-posts')` (line 104+, createPost/updatePost/deletePost)               |                                                                           |
| 59  | specs/mock-audit-d2-firebase-posts-comments-likes/tests/unit/firebase-posts-comments-likes.test.js | lib     | tests/unit/lib/firebase-posts-comments-likes.test.js       | `await import('@/lib/firebase-posts')` (line 142+, getLatestComments/getMoreComments)              |                                                                           |

## Summary

Total: 59 | service: 10 | repo: 5 | runtime: 7 | lib: 29 | config: 0 | api: 6 | components: 0 | KEEP: 2

Renames (filename collision after flatten):

- `firebase-events.test.js` × 3 → `firebase-events-001-event-filtering.test.js` / `firebase-events-002-jsdoc.test.js` / `firebase-events.test.js` (003 keeps)
- `notification-helpers.test.js` × 2 → `notification-helpers-014.test.js` / `notification-helpers.test.js` (015 keeps)

DUP_DELETE (content identical) — 0 flagged.

KEEP IN PLACE — 2 (g8-server-coverage server project tests; vitest.config.mjs:59 hardcoded).

---

## Phase 1 Handoff Highlights（精煉要點 — 詳見 migration-handoff.md）

> 完整紀錄在 [`./migration-handoff.md`](./migration-handoff.md) Phase 1 Handoff 段。本節只列下個 session 啟動 Phase 2 前必須記住的 4-6 條。

- **inventory 真實數 < plan 估算**：plan 估 60，實際 59 row（57 mv + 2 KEEP）。Phase 2 verify command 別寫死 row 數，用 `find` 動態算
- **KNOWN_S015 改 Option C 改成「刪 8 條 dead entry」**：grep 全 codebase 確認 zero consumer + 原 filePath 從建表起就指向不存在檔案 → dead config 直接刪比改正確
- **`git mv` 不會改檔內 import path**：8 個檔的相對 import 全壞（多 1 個 `..`），Wave 5 type-check 是早期警報；Phase 2 mv integration 也會踩。Wave 5 smoke 排 type-check 在最前面
- **`path.resolve(..., '../../../../')` 字串 type-check 抓不到**：vitest runtime 才會炸；fix-imports 完成後再 grep `path.resolve.*\.\.` / `path.join.*\.\.` 找這類 runtime path arithmetic
- **staged 檔被後續 edit 不會自動 re-stage**：commit subagent prompt 要 require「stage 後 + commit 前再跑一次 `git add` on 已 staged 檔」
- **vitest threshold.lines 70 暫降中**：觀察期，依新增測試節奏分階段提回 80 → 90 → 95
- **subagent Bash deny 在 Phase 1 已不重現**：可放心派 subagent 跑 `node -e` / `npm run *` / `git mv` runtime verify

---

## Phase 2 Inventory（integration tests）

> _待 Phase 2 Wave 1 T202 inventory engineer 完成後填入；T211 smoke 完成後 freeze。_

（placeholder：Wave 1 T202 engineer 會把 domain 對照表（Source Path / Domain / Target Path / Main Import Evidence / Notes 五欄）落筆於此。預估 ~65 row，依 `find specs -path '*/tests/integration/*' -type f` 實測為準。）

---

## Phase 2 Handoff Highlights

> _待 Phase 2 Wave 6b T213 handoff engineer 完成後填入。_

（placeholder：參考 Phase 1 體例，T213 engineer 會落筆 4-6 條精煉要點：plan 與實際的落差、踩過的坑、subagent permission 狀態變化、outstanding tech debt。）

---

## Phase 3 Inventory + Handoff（E2E + helpers）

> _待 Phase 3 開工後填入。_
