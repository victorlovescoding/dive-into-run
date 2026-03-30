# Code Review — 004-event-edit-delete

日期：2026-03-31

---

## Taste Rating

🟡 **Acceptable** — 功能正確，架構合理，但有幾個真實的 bug 和測試品質問題需要修正。

---

## Linus-Style Analysis

### [CRITICAL ISSUES]

**[`src/lib/firebase-events.js`, `deleteEvent`] — Data Integrity: 非原子刪除**

```js
await Promise.all(participantDocs.map((d) => deleteDoc(d.ref)));
await deleteDoc(eventRef);
```

這不是原子操作。刪到一半 crash 或網路斷線，就會留下有 participants 但沒有 event 的孤兒資料。
正確做法是用 `writeBatch`：

```js
const batch = writeBatch(db);
participantDocs.forEach((d) => batch.delete(d.ref));
batch.delete(eventRef);
await batch.commit();
```

Firebase 的 `writeBatch` 支援最多 500 個 ops，對一般活動綽綽有餘。這是 Firebase 101，不是邊緣案例。

---

**[`firestore.rules`, `/events/{eventId}` update rule] — Security: Server-side 缺少 maxParticipants 驗證**

```
allow update: if (
  isSignedIn() && request.auth.uid == resource.data.hostUid
  // ← 主揪可更新任何欄位，沒有驗證 maxParticipants >= participantsCount
```

`updateEvent` 在 client-side transaction 裡做了 `maxParticipants < participantsCount` 的防護，
但 Firestore rules 的主揪 update path 完全沒有 server-side enforcement。
有心人直接打 Firestore REST API，可以把 `maxParticipants` 設成 0，讓資料進入不一致狀態。

Firestore rules 應加上：
```
&& (!request.resource.data.keys().hasAny(['maxParticipants'])
    || request.resource.data.maxParticipants >= resource.data.participantsCount)
```

---

**[`src/app/events/page.jsx`, `handleEditSubmit`] — Bug: 本地 state 注入 string timestamp，破壞後續操作**

```js
await updateEvent(String(id), fields);
setEvents((prev) => prev.map((ev) => (
  String(ev.id) === String(id) ? { ...ev, ...fields } : ev
)));
```

`fields` 裡的 `time` 和 `registrationDeadline` 是 `datetime-local` 字串（e.g. `"2026-04-01T08:00"`），
但原始 `ev.time` 是 Firestore `Timestamp`。

合併後，本地 state 的 `ev.time` 變成字串。下次開編輯表單時：

```js
const date = typeof val.toDate === 'function'
  ? val.toDate()
  : new Date("2026-04-01T08:00");  // ← 這行，時區行為在 Safari 和 Node 環境不一致
```

`new Date("2026-04-01T08:00")` 在 Chrome 是 local time，在某些環境可能是 UTC，
造成時間顯示偏移 8 小時的 bug。

修法：update 後要麼重新 fetch，要麼手動把字串轉回 Timestamp 再放進 state：
```js
time: fields.time ? FirestoreTimestamp.fromDate(new Date(fields.time)) : ev.time,
```

---

### [IMPROVEMENT OPPORTUNITIES]

**[`specs/.../unit/firebase-events-edit-delete.test.js`] — Testing Gap: 測試只驗 `ok: true`，不驗寫入內容**

```js
it('should recalculate remainingSeats when maxParticipants is updated', async () => {
  const result = await updateEvent(eventId, { maxParticipants: 12 });
  expect(result.ok).toBe(true);  // ← 這不是測試，這是確認函數沒有 throw
});
```

把 `updates.remainingSeats = newMax - participantsCount` 那行刪掉，這個 test 照樣綠。
timestamp 轉換那條也是一樣的問題。

你需要：
```js
const { update } = vi.mocked(mockTx);  // 或從 mock 取出
expect(update).toHaveBeenCalledWith(
  expect.anything(),
  expect.objectContaining({ remainingSeats: 4 })
);
```

這才是防止 regression 的測試。

---

**[`src/lib/firebase-client.js`] — Test Code in Production Bundle**

```js
window.testFirebaseHelpers = { auth, signIn: signInWithEmailAndPassword };
```

即使有 `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` 守門，這段 code 仍然在 production bundle 裡面
（Next.js 會根據 env var tree-shake 掉 if block，但這個是 runtime check，不是 build-time constant）。

更乾淨的做法：把 E2E auth 邏輯移到 `global-setup.js` 透過 Emulator REST API 直接建立 session，
production client 不應該知道測試 helper 的存在。

---

**[`src/components/EventDeleteConfirm.jsx`, line 459] — A11y: `role="dialog"` 缺 `aria-labelledby`**

```jsx
<div role="dialog" aria-modal="true" className={styles.dialog}>
  <p className={styles.message}>確定要刪除活動？</p>
```

`role="dialog"` 必須有 accessible name，否則螢幕閱讀器只會念「對話框」，不知道內容。
給 `<p>` 加 `id="delete-dialog-title"`，再加 `aria-labelledby="delete-dialog-title"` 到 div。

---

**[`src/app/events/page.jsx`, `handleEditSubmit`] — New `console.error` calls**

```js
console.error('更新活動失敗:', err);
// ...
console.error('刪除活動失敗:', err);
```

這兩行是這次新增的，但 `lint:changed` 不抓（因為 script 只看 git staged），
`npm run lint` 會報 `no-console` warning。
要麼統一用 toast 通知 user，要麼刪掉（error 已透過 `deleteError` state 傳遞了）。

---

### [STYLE NOTES]

**[`src/components/EventEditForm.jsx`, dirty detection] — 每次 render 重算原始值**

```js
const origTitle = String(event.title || '');
const origTime = toDatetimeLocal(event.time);
// ... 8 more
```

這 9 個值每次 render 都重算一次。`event` prop 在實際使用中不會變（`editingEvent` 只在 open/close 時改變），
所以影響不大，但用 `useMemo(() => ({...}), [event])` 或 `useRef` 初始化一次會更正確。

**[`src/lib/firebase-events.js`, `deleteEvent`] — 多餘的 optional chaining**

```js
const participantDocs = participantsSnap?.docs ?? [];
```

`getDocs()` 永遠回傳 `QuerySnapshot`，不會是 `undefined`。`?.` 是不必要的防禦。

**[`src/lib/firebase-events.js`, `updateEvent`] — 多餘的 fallback**

```js
return result ?? { ok: true };
```

`runTransaction` callback 已明確 `return { ok: true }`，transaction 不會 resolve 成 `undefined`。
這行 fallback 永遠不會跑到。

---

## VERDICT

❌ **Needs rework** — 有一個資料一致性 bug（非原子刪除）、一個真實的 security gap（rules 缺 server-side validation）、一個時區潛在 bug（state desync）。這三個是真正的問題，不是風格偏好。

## KEY INSIGHT

`deleteEvent` 跟 `updateEvent` 都用了 Firestore transaction，但偏偏最需要原子性的「刪 participants + 刪 event」沒用，這是架構上的不一致。
