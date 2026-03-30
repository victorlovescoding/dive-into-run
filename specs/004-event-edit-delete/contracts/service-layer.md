# Service Layer Contracts: Event Edit & Delete

**Branch**: `004-event-edit-delete` | **Date**: 2026-03-30

## updateEvent(eventId, updatedFields)

**Module**: `src/lib/firebase-events.js`

### Signature

```javascript
/**
 * 更新活動資料（使用 Firestore Transaction 確保一致性）。
 * @param {string} eventId - 活動 ID。
 * @param {object} updatedFields - 要更新的欄位（僅包含變更的欄位）。
 * @returns {Promise<{ok: boolean}>} 更新結果。
 * @throws {Error} eventId 為空、updatedFields 無效、event 不存在、或 maxParticipants 低於 participantsCount。
 */
export async function updateEvent(eventId, updatedFields)
```

### Preconditions

- `eventId` 為非空字串
- `updatedFields` 為非 null/undefined 的物件且至少有一個 key
- 目標 event document 存在於 Firestore

### Postconditions

- 成功：回傳 `{ ok: true }`，Firestore 中對應欄位已更新
- `maxParticipants` 變更時：`remainingSeats` 自動重算
- 失敗：throw Error（不回傳 `{ ok: false }`）

### Error Cases

| Condition | Error |
|---|---|
| `eventId` 為空 | `throw Error` |
| `updatedFields` 為 null 或非物件 | `throw Error` |
| Event document 不存在 | `throw Error` |
| `maxParticipants < participantsCount` | `throw Error(/人數上限/)` |
| Firestore write 失敗 | `throw Error`（原生錯誤） |

---

## deleteEvent(eventId)

**Module**: `src/lib/firebase-events.js`

### Signature

```javascript
/**
 * 刪除活動及其 participants 子集合。
 * @param {string} eventId - 活動 ID。
 * @returns {Promise<{ok: boolean}>} 刪除結果。
 * @throws {Error} eventId 為空、event 不存在、或 Firestore 操作失敗。
 */
export async function deleteEvent(eventId)
```

### Preconditions

- `eventId` 為非空字串
- 目標 event document 存在於 Firestore

### Postconditions

- 成功：回傳 `{ ok: true }`
- `events/{eventId}/participants` 子集合中所有文件已刪除
- `events/{eventId}` 主文件已刪除
- 無參與者時仍然成功

### Error Cases

| Condition | Error |
|---|---|
| `eventId` 為空 | `throw Error` |
| Event document 不存在 | `throw Error` |
| Firestore delete 失敗 | `throw Error`（原生錯誤） |

---

## Component Contracts

### EventCardMenu

**Module**: `src/components/EventCardMenu.jsx`

```javascript
/**
 * @typedef {object} EventCardMenuProps
 * @property {EventData} event - 活動資料。
 * @property {string|null} currentUserUid - 當前使用者 UID，null 表示未登入。
 * @property {(ev: EventData) => void} onEdit - 點擊「編輯活動」的回呼。
 * @property {(ev: EventData) => void} onDelete - 點擊「刪除活動」的回呼。
 */
```

**Behavior**:
- `currentUserUid !== event.hostUid` → render nothing (empty)
- `currentUserUid === event.hostUid` → render 三點按鈕 (aria-label: "更多操作")
- 點擊三點按鈕 → toggle dropdown (role="menuitem": "編輯活動", "刪除活動")
- 點擊外部 → 關閉 dropdown
- 點擊 menuitem → 呼叫對應 callback + 關閉 dropdown

### EventEditForm

**Module**: `src/components/EventEditForm.jsx`

```javascript
/**
 * @typedef {object} EventEditFormProps
 * @property {EventData} event - 要編輯的活動資料（預填表單）。
 * @property {(data: object) => void | Promise<void>} onSubmit - 提交更新。
 * @property {() => void} onCancel - 取消編輯。
 * @property {boolean} [isSubmitting] - 送出中狀態。
 */
```

**Behavior**:
- 所有欄位預填 `event` 對應值
- 按鈕: "取消編輯" (left) / "編輯完成" (right)
- "編輯完成" disabled when: 無欄位變更 OR isSubmitting
- "編輯完成" enabled when: 任一欄位值與原始值不同
- 修改後復原 → "編輯完成" 回到 disabled
- `maxParticipants` input min = max(event.participantsCount, 2)
- isSubmitting → 按鈕文字顯示 "編輯中" 或 "更新中"

### EventDeleteConfirm

**Module**: `src/components/EventDeleteConfirm.jsx`

```javascript
/**
 * @typedef {object} EventDeleteConfirmProps
 * @property {string} eventId - 要刪除的活動 ID。
 * @property {(id: string) => void} onConfirm - 確認刪除回呼。
 * @property {() => void} onCancel - 取消刪除回呼。
 * @property {boolean} [isDeleting] - 刪除中狀態。
 * @property {string} [deleteError] - 錯誤訊息。
 */
```

**Behavior**:
- 顯示 dialog (role="dialog", aria-modal="true")
- 文字: "確定要刪除活動？"
- 按鈕: "是" / "否"
- "否" → 呼叫 onCancel
- "是" → 呼叫 onConfirm(eventId)
- isDeleting → 兩個按鈕都 disabled
- deleteError → 顯示 role="alert" 的錯誤訊息
