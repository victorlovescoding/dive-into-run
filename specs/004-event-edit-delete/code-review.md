# Code Review — 004-event-edit-delete

日期：2026-03-31（第二輪）

---

## Taste Rating

🟢 **Good taste** — 上一輪的三個 Critical Issues（非原子刪除、Security Rules、State desync）全數修正。程式碼乾淨、結構明確，剩餘問題都是 minor。

---

## 上一輪修正追蹤

| #   | 上一輪問題                                                     | 狀態     | 修正方式                                              |
| --- | -------------------------------------------------------------- | -------- | ----------------------------------------------------- |
| 1   | `deleteEvent` 非原子刪除（Promise.all + deleteDoc）            | ✅ Fixed | 改用 `writeBatch` 原子操作                            |
| 2   | Firestore rules 缺 `maxParticipants >= participantsCount` 驗證 | ✅ Fixed | 加入 server-side rule validation                      |
| 3   | `handleEditSubmit` 本地 state 注入 string timestamp            | ✅ Fixed | update 後手動轉回 `FirestoreTimestamp.fromDate()`     |
| 4   | Unit test 只驗 `ok: true`，不驗寫入內容                        | ✅ Fixed | 加入 `mockUpdate.mock.calls[0][1]` assertion          |
| 5   | `testFirebaseHelpers` 殘留在 production bundle                 | ✅ Fixed | 已從 `src/` 移除                                      |
| 6   | `EventDeleteConfirm` 缺 `aria-labelledby`                      | ✅ Fixed | 加入 `id` + `aria-labelledby`                         |
| 7   | 新增 `console.error` calls                                     | ✅ Fixed | catch block 改用 state 傳遞 error，不再 console.error |
| 8   | dirty detection 每次 render 重算                               | ✅ Fixed | 改用 `useMemo(() => ({...}), [event])`                |
| 9   | `participantsSnap?.docs` 多餘 optional chaining                | ✅ Fixed | 改為 `participantsSnap.docs`                          |
| 10  | `return result ?? { ok: true }` 多餘 fallback                  | ✅ Fixed | 改為 `return result;`                                 |

**10/10 全部修正，沒有遺漏。**

---

## Linus-Style Analysis

### [CRITICAL ISSUES]

無。

---

### [IMPROVEMENT OPPORTUNITIES]

**[`specs/.../integration/EventDeleteConfirm.test.jsx`] — 4 個測試失敗：按鈕文字 mismatch**

```js
// 測試期望：
screen.getByRole('button', { name: /^是$/i });
screen.getByRole('button', { name: /^否$/i });

// 實際元件按鈕文字：
('是，確認刪除');
('否，取消');
```

4 個 tests fail（`FR-010 是否按鈕`、`US2-AC2 否取消`、`US2-AC3 是確認`、`disable both buttons`），原因是測試 regex 用 `^是$` 精確匹配，但元件使用的是帶逗號的長文字。

修法很簡單 — 把 regex 改成匹配實際文字：

```js
screen.getByRole('button', { name: /是，確認刪除/i });
screen.getByRole('button', { name: /否，取消/i });
```

---

**[`src/app/events/page.jsx`] — 1894 行 God Component**

這檔案已經膨脹到近 2000 行。這次 branch 新增了 ~120 行（editingEvent、deletingEventId、handleEditSubmit、handleDeleteConfirm 等 handler），雖然每個 handler 各自簡潔，但 page.jsx 作為「萬用控制器」已到了需要拆分的臨界點。

建議（非阻擋）：未來考慮抽出 custom hooks：

- `useEventEdit()` — 封裝 editingEvent state + handleEditSubmit/handleEditCancel
- `useEventDelete()` — 封裝 deletingEventId state + handleDeleteConfirm/handleDeleteCancel

這不是這次 PR 必須做的事，但下次再加功能前應該先 refactor。

---

**[`src/app/events/page.jsx`, line 492] — `editingEvent` 型別過於寬鬆**

```js
const [editingEvent, setEditingEvent] = useState(/** @type {object|null} */ (null));
```

應改為：

```js
const [editingEvent, setEditingEvent] = useState(
  /** @type {import('@/lib/event-helpers').EventData|null} */ (null),
);
```

`object` 太寬，失去 checkJs 型別安全的意義。同樣的 `handleEditEvent` 的 JSDoc `@param {object} ev` 也應改為 `EventData`。

---

### [STYLE NOTES]

**[`src/lib/firebase-events.js`, `deleteEvent`] — TOCTOU 存在性檢查**

```js
const snap = await getDoc(eventRef);
if (!snap.exists()) throw new Error('活動不存在');
// ... race window ...
const batch = writeBatch(db);
batch.delete(eventRef);
await batch.commit();
```

`getDoc` 和 `batch.commit()` 之間有 race window — 理論上另一個 user 可以在這之間刪除同一活動。因為 `batch.delete` 在文件不存在時不會 throw，所以不會真正出錯，但 existence check 給了一個不完全準確的保證。

如果要精確，應該用 `runTransaction` 來做 read-then-delete。不過目前的做法在實務上足夠安全（最差情況是刪了一個已被刪除的活動，不會有資料損壞），這是 style note 不是 bug。

---

### [TESTING GAPS]

**E2E 測試被 Vitest 誤執行**

`specs/004-event-edit-delete/tests/e2e/event-edit-delete.spec.js` 在 `npx vitest run specs/004-event-edit-delete/tests/` 時被 vitest 掃到並 crash，因為 Playwright 的 `test.describe.configure` 不存在於 vitest 環境。

建議在 `vitest.config` 的 `exclude` 加入 `**/e2e/**` 或 `**/*.spec.js`。

---

## 驗證結果

| 檢查項                                | 結果                                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| `npm run lint:changed`                | ✅ 通過（0 warnings）                                               |
| `npm run type-check:changed`          | ✅ 通過（0 errors）                                                 |
| `grep -r "@ts-ignore" src specs`      | ✅ 無違規                                                           |
| `npx vitest run` (unit + integration) | ⚠️ 45/49 passed，4 failed（EventDeleteConfirm 按鈕 regex mismatch） |
| E2E (Playwright)                      | ⏭️ Skipped — 需要 Firebase Emulator，非本次 review 範圍             |

---

## VERDICT

✅ **Worth merging** — 上一輪所有 Critical Issues 全部正確修復。剩餘的問題是：4 個 integration tests 的 regex 需要對齊實際按鈕文字（一分鐘修完），以及一些非阻擋性的改善建議。核心邏輯（`updateEvent`/`deleteEvent` service、安全規則、元件設計）全部正確。

## KEY INSIGHT

從 ❌ 翻到 ✅，所有修正都精準到位 — 特別是 `writeBatch` 原子刪除、server-side rules 驗證、Timestamp 回轉。唯一差一步就完美的是測試的按鈕文字沒跟著元件一起更新。
