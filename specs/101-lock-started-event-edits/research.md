# Research: 活動開始後鎖定編輯與刪除

## Decision: Firestore `request.time` 作為 authoritative operation-time guard

**Rationale**: 目前 event update/delete 走 client Firestore SDK：`updateEvent` 呼叫 `runEventUpdateTransaction`，delete 呼叫 `deleteEventTree`。現有活動 update/delete 沒有 server API route 可擁有服務端時間，因此 final write authority 必須落在 Firestore rules 評估當下的 `request.time`。既有 rules 也已在其他區塊使用 `request.time` 模式。

**Alternatives considered**:

- Client `Date.now()`：拒絕，因為裝置時間可能錯誤，且 stale UI/direct SDK writes 會繞過 UI 判斷。
- 新增 server API route for update/delete：拒絕，因為這是超出 MVP 的架構遷移，且目前寫入路徑沒有使用該 route。
- Admin timestamp sentinel 當成「現在」：拒絕，因為 sentinel 是寫入值，不是 permission-time authority。

## Decision: 「活動已開始」定義為 `operationTime >= event.time`

**Rationale**: FR-001 與 edge cases 要求 equality boundary 也鎖定。本 MVP 只有活動開始時間，不新增 end time、取消狀態、公告、解鎖或推算時間點。

**Alternatives considered**:

- `operationTime > event.time`：拒絕，因為會允許開始時間當下仍可編輯。
- 使用報名截止或 derived time：拒絕，因為 spec 明確只以活動開始時間作為 lock boundary。
- 加 grace period：拒絕，因為那是未被要求的新產品政策。

## Decision: Authoritative update/delete lock 放在 `firestore.rules`

**Rationale**: Event update path 會到 `src/repo/client/firebase-events-repo.js` 的 `tx.update`；soft-delete 也透過 client transaction 更新 event document。Firestore rules 是唯一能一致擋住舊畫面、直接寫入、重送、快速連點與多裝置 race 的 backend boundary。

**Alternatives considered**:

- 只在 `prepareEventUpdateFields` 做 service validation：拒絕，因為 hostile/stale clients 可繞過 local service code。
- 只在 runtime hooks guard：拒絕，因為無法保護 stale submit/confirm 與 direct SDK writes。
- 鎖住所有 `events/{eventId}` updates：拒絕，因為 join/leave 造成的 participant counter updates 是 non-body interactions，必須保留。

## Decision: UI disabled behavior 是 host 提示，不是安全邊界

**Rationale**: Detail page 和 list flows 共用 `EventCardMenu`。當 confirmed host 的 client current time 達到或晚於 `event.time` 時，edit/delete entries 必須保留但 disabled，並顯示精確原因字串。最終仍以 rules 為準，因為 client time 可能漂移。

**Alternatives considered**:

- 開始後隱藏 host edit/delete entries：拒絕，因為 FR-011 要求保留 disabled entry。
- 對所有使用者 disabled：拒絕，因為非主揪既有 UI 是隱藏/無權限優先。
- 為 menu state 另取 server time：拒絕，因為增加 network cost，且仍不能取代 Firestore rules。

## Decision: Permission failure 的 user-facing priority 高於 started-lock failure

**Rationale**: FR-018 要求未登入與非主揪維持既有 no-permission behavior。Firestore rules 不提供細分 denial reason，因此 runtime/UI ordering 必須先檢查 actor identity，只對 confirmed host 顯示 started-lock reason。

**Alternatives considered**:

- 一律顯示「活動已開始，無法編輯或刪除。」：拒絕，因為會對非主揪呈現錯誤主要原因。
- Runtime 先判斷 start lock 再判斷 auth/host：拒絕，因為違反 permission priority 並可能掩蓋授權錯誤。

## Decision: Stale submit 與 stale confirm 必須在 write time 原子失敗

**Rationale**: 主揪可能在開始前打開 edit form 或 delete confirm，開始後才送出。Firestore rules 必須拒絕該 transaction write，確保沒有 partial event body update，也沒有 soft-delete commit。UI/runtime 不得顯示成功 toast、成功 navigation 或成功 local state。

**Alternatives considered**:

- 只在開表單或開 confirm 時檢查：拒絕，因為送出前可能跨過開始時間。
- Submit 前 best-effort client check：可作提示，但拒絕作為唯一防線。
- 允許已開啟的表單完成：拒絕，因為違反 FR-013 與 FR-014。

## Decision: Non-body interactions 沿用既有規則

**Rationale**: FR-022 要求查看、列表/搜尋/篩選/排序、留言、分享、收藏、參加、退出與 identity display 不變。Join/leave 可能更新 `participantsCount` 與 `remainingSeats`；這些 counter 不是本次 EventBody lock。`maxParticipants` 則是活動本體，開始後仍要鎖。

**Alternatives considered**:

- 開始後 freeze 整個 event document：拒絕，因為會破壞 participant counter updates。
- 開始後 freeze child collections：拒絕，因為 comments、favorites、participants 必須維持既有行為。
- 把 participant count changes 視為 body edits：拒絕，因為 spec 明確排除 join/leave effects。

## Decision: 保留 soft-delete product behavior，但用 delete lock gate

**Rationale**: 產品語意是刪除活動；實作上寫入 soft-delete fields (`deletedAt`, `deletedByUid`, `deletedPurgeAt`)。FR-019 要求這種底層非 hard delete 的行為仍受開始後刪除鎖限制。

**Alternatives considered**:

- 只擋 hard delete：拒絕，因為 hard delete 已被 rules deny，產品 delete 使用 soft-delete。
- 改用 cancellation status：拒絕，因為取消狀態不在 scope。
- 允許 host 開始後 soft-delete 做清理：拒絕，因為 spec 明確禁止開始後刪除。

## Decision: Testing 組合 pure boundary、targeted UI/runtime 與 Firestore rules tests

**Rationale**: `now == start` 是關鍵邊界，但 rules emulator 不一定容易精準控制 equality。用 pure helper unit tests 覆蓋 exact boundary，component/runtime tests 覆蓋 disabled state 與 permission priority，service tests 覆蓋 update validation，Firestore emulator tests 覆蓋 authoritative write rejection。

**Alternatives considered**:

- 只做 manual QA：拒絕，因為 race 與 permission boundary 需要可重複驗證。
- 只做 Firestore rules tests：拒絕，因為 UI disabled behavior 與 error ordering 也需要 coverage。
- 用 broad package scripts 當 evidence：拒絕，因為 `npm run test`、`npm run test:server`、`npm run test:branch`、`npm run test:e2e:emulator` 都是 disabled echo scripts。

## Decision: 編輯時新的開始時間必須拒絕 `time <= request.time`

**Rationale**: FR-017 要求主揪編輯尚未開始活動時，不能把新的活動開始時間設成現在或過去。因為寫入走 client SDK，rules 必須同時驗證舊 event 尚未開始，且 resulting `request.resource.data.time` 仍嚴格晚於 `request.time`。

**Alternatives considered**:

- 只依賴 form validation：拒絕，因為 direct SDK writes 可繞過表單。
- 允許新時間等於 operation time：拒絕，因為 equality 已被定義為 started。
- 只在 `time` changed 時驗證：拒絕，因為 rules 應確保 resulting event body 保持合法狀態。
