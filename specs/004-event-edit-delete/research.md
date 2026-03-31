# Research: Event Edit & Delete Actions

**Branch**: `004-event-edit-delete` | **Date**: 2026-03-30

## R-001: Firestore 批次刪除子集合的最佳實踐

**Decision**: 使用 `getDocs` 取得 `participants` 子集合所有文件，逐一 `deleteDoc`，最後刪除事件主文件。
**Rationale**: Firestore Web SDK 不支援 batch delete collections；Admin SDK 才有 `recursiveDelete()`。Client 端需手動遍歷刪除。活動參與者數量有限（maxParticipants 上限），逐一刪除效能可接受。
**Alternatives considered**:

- Cloud Function 觸發刪除 → 增加後端複雜度，MVP 不需要
- `writeBatch` 批次刪除 → 可行但需處理 500 doc 上限，對本案場景過度設計

## R-002: updateEvent 使用 runTransaction 還是 updateDoc

**Decision**: 當 `maxParticipants` 欄位被更新時使用 `runTransaction`（需讀取目前 `participantsCount` 驗證）；其他純欄位更新可用 `updateDoc`。實作上統一使用 `runTransaction` 簡化邏輯。
**Rationale**: FR-015 要求「人數上限不能低於目前報名人數」，需先讀後寫保證一致性，符合憲法 Principle IV（併發安全）。
**Alternatives considered**:

- 前端先 fetch 再 update → race condition 風險
- 僅用 `updateDoc` + Security Rules 驗證 → Rules 無法引用 subcollection count

## R-003: Dirty State Detection（表單髒值偵測）

**Decision**: 開啟編輯表單時快照原始值物件，每次 `onChange` 逐欄位 shallow compare 判斷是否有變更。
**Rationale**: FR-006/FR-007 要求「編輯完成」按鈕根據是否有任何欄位變更來切換 disabled/enabled。Shallow compare 對字串/數字欄位足夠，且效能開銷極低。
**Alternatives considered**:

- `JSON.stringify` 比較整體 → 欄位順序敏感，不穩定
- `dirty` flag per field → 更精細但過度設計

## R-004: 點擊外部關閉下拉選單（Click Outside）

**Decision**: 使用 `useRef` + `useEffect` 監聽 `document` 的 `mousedown` 事件，判斷點擊目標是否在選單 ref 外部。
**Rationale**: 標準的 React 模式，不需要額外套件。FR-003 明確要求此行為。
**Alternatives considered**:

- 第三方 hook library → 增加依賴
- `focusout`/`blur` → 對非 focusable 元素不可靠

## R-005: 編輯表單復用 vs 獨立元件

**Decision**: 建立獨立的 `EventEditForm` 元件，但復用相同的表單欄位結構（label、input name、驗證邏輯）。不直接復用建立表單元件。
**Rationale**: 建立表單直接寫在 `events/page.jsx` 中（非獨立元件），且編輯表單有不同行為（預填、dirty detection、不同按鈕文字）。強行復用會增加條件分支複雜度。測試已定義 `EventEditForm` 為獨立元件。
**Alternatives considered**:

- 抽出共用 `EventForm` 基底元件 → 目前表單未獨立元件化，重構範圍過大
- 在現有 page 內加 mode 判斷 → 違反 SRP，使頁面更臃腫
