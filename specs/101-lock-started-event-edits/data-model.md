# Data Model: 活動開始後鎖定編輯與刪除

## Event

活動文件，位於 `events/{eventId}`。

**欄位**

- `id`: 活動識別值，來自 document id 或 runtime normalized data。
- `hostUid`: 主揪 UID；決定 edit/delete permission。
- `time`: 活動開始 timestamp；本 feature 唯一用來判斷 started-lock 的時間。
- `title`, `meetPlace`, `city`, `district`, `route`, `distanceKm`, `paceSec`, `runType`, `maxParticipants`, `description`: 目前 host-editable 的 activity body fields。
- `registrationDeadline`: 既有 event field 與 form validation input；不是 started-lock boundary，也不是本 feature 新增的時間概念。
- `participantsCount`, `remainingSeats`: join/leave 會改變的 counters；不屬於本次 lock 的 activity body。
- `deletedAt`, `deletedByUid`, `deletedPurgeAt`: product delete 時寫入的 soft-delete fields。

**關係**

- 一個 Event 有一個 host (`hostUid` -> user)。
- 一個 Event 可擁有 participants、comments、favorites 與其他 child/related interaction records。
- Participant join/leave 可能更新 `participantsCount` 與 `remainingSeats`；這些 counter updates 不在本 lock 內。

**驗證規則**

- `time` 必須是 timestamp。
- Host body update 只有在 `request.time < resource.data.time` 時允許。
- Body update 若變更或重寫 `time`，resulting `request.resource.data.time` 必須 `> request.time`。
- `maxParticipants` 是 activity body，開始後不可改；開始前仍需符合既有 participant-count validation。
- Hard delete 維持 denied；product delete 是 soft-delete，套用同一個 start lock。

## EventBody

受本 feature 保護的 host-editable core activity data。

**欄位**

- Required/primary: `title`, `time`, `meetPlace`, `distanceKm`, `maxParticipants`。
- Additional body fields: `city`, `district`, `route`, `paceSec`, `runType`, `description`。
- 其他既有 edit form 視為 core event data 的 host-editable 欄位，也預設受本 lock 保護。

**驗證規則**

- 開始前，host 維持既有 edit capability，仍受現有 validation 限制。
- 開始當下或開始後，任何 EventBody field 都不得被 changed、removed 或 corrected。
- `participantsCount` 與 `remainingSeats` 不屬於本 lock 的 EventBody。

## Actor / Host / Non-host

**Actor**

- `uid`: authenticated user id；未登入時不存在。
- Auth state: 未登入使用者沒有 edit/delete permission。

**Host**

- `uid` 等於 `event.hostUid` 的 actor。
- 只在開始前可 edit EventBody 與 soft-delete Event。
- 開始後看得到 disabled edit/delete controls。

**Non-host**

- `uid` 不等於 `event.hostUid` 的 signed-in actor。
- 任何時間都不能 edit/delete。
- 即使 event started，user-facing reason 仍以 permission-related reason 優先。

## StartLockEvaluation

對 Event 進行 operation-time 評估。

**欄位**

- `operationTime`: Firestore rules `request.time`，write authorization 的 authoritative time。
- `clientNow`: UI-only current client time，只用於 disabled hints。
- `eventStartTime`: Event `time`。
- `isStarted`: backend/rules 使用 `operationTime >= eventStartTime`；UI hint 只能使用 `clientNow >= eventStartTime`。
- `actorRelation`: `host`, `nonHost` 或 `unauthenticated`。

**驗證規則**

- Backend lock 使用 `operationTime`，不得使用 `clientNow`。
- Equality boundary 要鎖定：`operationTime == eventStartTime` 代表已開始。
- User-facing order 必須先處理 permission，再處理 started-lock messaging。

## DeleteOperation / SoftDelete

Product delete 是一個把 Event 標成 soft-deleted 的 update。

**欄位**

- `deletedAt`: delete timestamp。
- `deletedByUid`: 執行 delete 的 actor UID。
- `deletedPurgeAt`: retention purge timestamp。
- `status`: product result，例如 active、deleted、already deleted。

**驗證規則**

- Client hard delete 維持 denied。
- Host soft-delete 只有在 event active 且 `request.time < resource.data.time` 時允許。
- Host soft-delete 在 `request.time >= resource.data.time` 時 denied。
- Non-host 與 unauthenticated delete attempts 在 UI 上必須先以 permission reason 處理。

## Non-body Interactions

本 feature 不應鎖住的互動。

**欄位 / 紀錄**

- Read/view activity detail 與 list data。
- Comments 與 comment history 在 existing rules 允許時維持可用。
- Favorites/bookmarks。
- Share link behavior。
- Participants records。
- Join/leave 造成的 `participantsCount` 與 `remainingSeats` counter changes。
- Host/participant identity display。

**驗證規則**

- 這些操作繼續由 existing rules 判斷。
- Started-lock 不得新增 comments、favorites、share、join、leave 或 identity display 的 denial path。
- `maxParticipants` 仍是 EventBody，開始後不可改；但 participant counts 可依既有 join/leave 流程變動。

## State Transitions

- `active_before_start -> active_before_start`: existing validation 通過且 resulting `time > request.time` 時，host body update allowed。
- `active_before_start -> soft_deleted`: existing soft-delete validation 通過時，host product delete allowed。
- `active_before_start -> active_started_locked`: authoritative time 達到 `time` 時隱式進入；不需要 write。
- `active_started_locked -> active_started_locked`: EventBody update 與 product delete denied；non-body interactions 仍可依既有規則進行。
- `active_started_locked -> soft_deleted`: client host product delete denied。
- `soft_deleted -> any active state`: 不屬於本 feature。
