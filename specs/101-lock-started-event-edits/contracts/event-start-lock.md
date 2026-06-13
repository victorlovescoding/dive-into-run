# Contract: Event Start Lock

這是 web app UI/runtime 加 Firestore rules contract，不是 HTTP OpenAPI contract。

## Scope

本 contract 覆蓋 `events/{eventId}` 的 activity body edit 與 product delete。當 operation time 達到 event start time，host 不可再 edit/delete。它不涵蓋新時間欄位、取消狀態、公告、admin unlock、version history，或 server API route migration。

## User-facing Contract

### Host Before Start

- Given signed-in user 是 event host，且目前 UI time 早於 `event.time`，edit/delete entries 維持 enabled。
- Edit submit 與 delete confirm 可走既有 runtime/repo write path。
- Firestore rules 仍使用 `request.time` 做 final decision。

### Host At Or After Start

- Given signed-in user 是 event host，且目前 UI time 等於或晚於 `event.time`，edit/delete entries 保留顯示。
- 兩個 entries 都 disabled，並揭露原因：`活動已開始，無法編輯或刪除。`
- Disabled entries 不得開啟 edit form 或 delete confirmation。
- 已經開啟的 edit form 或 delete confirmation 若在開始後送出，不得 partial update，也不得 soft-delete event。

### Unauthenticated / Non-host Priority

- Unauthenticated users 維持既有 sign-in 或 permission behavior。
- Non-host users 維持既有 no-permission behavior；目前 owner menu absence 也應保留。
- Non-host 透過舊 UI 或 direct path 嘗試操作 started event 時，primary user-facing reason 是 permission failure，不是 started-lock reason。

## Runtime Contract

- Runtime 在呈現 started-lock messaging 前先檢查 actor identity。
- Runtime 只能用 client `Date.now()` 計算 disabled hints。
- Runtime 必須把 backend/rules rejection 視為 authoritative，不能顯示成功 toast、成功 local state，或宣稱 edit/delete succeeded 的 navigation。
- Detail 與 list flows 都套用 owner menu contract，因為 `EventCardMenu` 是 shared component。
- Delete flow 必須避免 final delete 已被 started-lock reject 時產生誤導性的 cancellation side effects。

## Firestore Rules Contract

Rules 使用 `request.time` 作為 authoritative operation time。

Prose/pseudocode:

```text
eventStarted(eventData):
  return request.time >= eventData.time

hostCanUpdateEventBody:
  signed in
  actor is resource.data.hostUid
  resource event is active
  eventStarted(resource.data) is false
  affected fields do not include account-deletion managed fields
  affected fields do not include soft-delete fields
  resulting request.resource.data.time > request.time
  existing maxParticipants and schema validations still pass

hostCanSoftDeleteEvent:
  signed in
  actor is resource.data.hostUid
  resource event is active
  eventStarted(resource.data) is false
  request is the existing valid soft-delete update by actor

counterUpdateForJoinLeave:
  existing participantsCount/remainingSeats-only branch remains separate
  no started-lock condition is added by this feature

allow hard delete:
  false

allow update:
  hostCanUpdateEventBody
  OR hostCanSoftDeleteEvent
  OR counterUpdateForJoinLeave
```

## Unaffected Interactions Contract

Started-lock 不得改變以下行為，除非既有 rules 本來就 deny：

- Read/view event detail。
- Event list/search/filter/sort display。
- Share link。
- Favorite and unfavorite。
- Comment create/update/delete where current comment rules allow。
- Join and leave，包含 participant document writes 與 `participantsCount` / `remainingSeats` updates。
- Host and participant identity display。

## Boundary Contract

- `request.time < event.time`: event 尚未開始，可進入 write authorization。
- `request.time == event.time`: event 已開始，body edit/delete denied。
- `request.time > event.time`: event 已開始，body edit/delete denied。
- Body update 的 `request.resource.data.time <= request.time` 必須 denied，即使 previous event 尚未開始。
