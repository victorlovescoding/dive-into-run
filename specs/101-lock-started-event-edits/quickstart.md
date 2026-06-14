# Quickstart: 活動開始後鎖定編輯與刪除

本指南僅用於 implementation 完成後的 validation，不包含實作程式碼。

## 前置條件

- 使用 branch/worktree `101-lock-started-event-edits`。
- 從 repo root 執行。
- 驗證前先安裝 npm dependencies。
- Firestore emulator command 需要 Firebase CLI；但從 `package.json` 看不出 Firebase CLI 是否可用，因為 `firebase-tools` 不是 devDependency。
- `npm run build` 可能需要既有 `.env` 或 local Firebase config，依 app 現況為準。

## Script 注意事項

以下 package scripts 是 disabled echo scripts，不能作為 behavior evidence：

- `npm run test`
- `npm run test:server`
- `npm run test:branch`
- `npm run test:e2e:emulator`

請使用下方 targeted commands。

## 驗證情境

1. 主揪在活動開始前仍可編輯與刪除。
   - 預期：owner menu entries are enabled。
   - 預期：`request.time < event.time` 時，edit update 與 soft-delete allowed。

2. 主揪在 exact start boundary 被鎖定。
   - 預期：owner menu entries visible but disabled。
   - 預期：reason 是 `活動已開始，無法編輯或刪除。`
   - 預期：operation time 等於 `event.time` 時，backend/rules deny edit 與 soft-delete。

3. 主揪在活動開始後被鎖定。
   - 預期：stale edit submit fails without partial update。
   - 預期：stale delete confirm fails and event remains active。

4. 非主揪與未登入使用者維持 permission priority。
   - 預期：existing no-permission 或 sign-in behavior 出現在 started-lock reason 之前。
   - 預期：direct edit/delete attempts are denied。

5. Non-body interactions 依 existing rules 繼續運作。
   - 預期：view/detail/list/share/favorite/comment/join/leave behavior unchanged。
   - 預期：join/leave 造成的 participant count changes 不被 start lock 阻擋。

6. 將開始時間改成現在或過去會被拒絕。
   - 預期：host editing a before-start event cannot save `time <= request.time`。

## 指令

執行 targeted unit/component/runtime/service tests:

```bash
npx vitest run tests/unit/service/event-service.test.js tests/unit/components/EventCardMenu.test.jsx tests/unit/ui/events/EventDetailScreen.test.jsx tests/unit/runtime/useEventMutations.test.jsx tests/unit/runtime/useEventDetailMutations.test.jsx
```

預期結果：exit code 0，並涵蓋 equality boundary、disabled menu behavior、permission priority、stale submit/confirm handling 與 service/runtime validation。

執行 Firestore rules tests:

```bash
firebase emulators:exec --only firestore --project demo-test "npx vitest run tests/server/firestore/event-start-lock-rules.test.js"
```

預期結果：Firebase CLI 可用時 exit code 0。若失敗為 `firebase: command not found`，記為 missing prerequisite，不可當成 feature behavior evidence。

執行 changed-file lint:

```bash
npm run lint:changed
```

預期結果：exit code 0。

執行 changed-file type-check:

```bash
npm run type-check:changed
```

預期結果：exit code 0。

執行 dependency direction check:

```bash
npm run depcruise
```

預期結果：exit code 0；dependency direction 維持 `Types -> Config -> Repo -> Service -> Runtime -> UI`。

執行 production build:

```bash
npm run build
```

預期結果：exit code 0。
