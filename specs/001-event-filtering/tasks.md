# 功能任務：活動篩選 (MVP)

> **功能**: 活動篩選 (001-event-filtering)
> **狀態**: 已規劃
> **策略**: TDD (測試驅動開發)

## 實作策略

- **嚴格 TDD**: 所有任務在實作前後都必須執行現有的失敗測試 (`tests/001-event-filtering/`)。
- **遞增式服務層**: `src/lib/firebase-events.js` 中的 `queryEvents` 函式將跨階段逐步建立。
- **UI 整合**: `src/app/events/page.js` 將逐步更新，將 UI 狀態與服務層進行綁定。
- **嚴格遵守**: 嚴格遵循 `specs/001-event-filtering/plan.md` 與 `spec.md`，不得偏離。

## 第 1 階段：設定與驗證

**目標**: 確保測試環境已就緒並建立基準。

- [x] T001 透過執行 `npm test tests/001-event-filtering/unit/firebase-events.test.js` 驗證現有的單元測試如預期般失敗
- [x] T002 透過執行 `npx playwright test tests/001-event-filtering/e2e/event-filtering.spec.js` 驗證現有的 E2E 測試如預期般失敗

## 第 2 階段：使用者故事 1 & 4 - 地點與時間篩選 (優先級: P1/P2)

**目標**: 啟用使用 Firestore 查詢的地點、區域和時間範圍篩選。
**測試**: `unit/firebase-events.test.js` (US4 案例), `e2e/event-filtering.spec.js` (搜尋流程)。

- [x] T003 [US1] 在 `src/lib/firebase-events.js` 中實作 `queryEvents` 第 1 階段 (Firestore 查詢)，針對城市、區域和時間
- [x] T004 [US1] 在 `src/app/events/page.js` 中將城市、區域、開始時間、結束時間的輸入欄位綁定至狀態 (state)
- [x] T005 [US1] 在 `src/app/events/page.js` 中實作 `handleSearchFilters` 以呼叫帶有收集到之篩選條件的 `queryEvents`
- [x] T006 [US1] 更新 `src/app/events/page.js` 以在搜尋成功後渲染搜尋結果 (替換初始列表)
- [x] T007 [US1] 驗證 US1/US4 E2E 測試通過 (基本搜尋流程)

## 第 3 階段：使用者故事 2 - 距離篩選 (優先級: P2)

**目標**: 啟用具有 ±0.5km 寬容度的距離篩選 (記憶體內)。
**測試**: `unit/firebase-events.test.js` (距離寬容度案例)。

- [x] T008 [US2] 更新 `src/lib/firebase-events.js` 中的 `queryEvents` 以實作第 2 階段記憶體內距離篩選 (含寬容度)
- [x] T009 [US2] 在 `src/app/events/page.js` 中將距離最小值/最大值輸入欄位綁定至狀態
- [x] T010 [US2] 驗證 US2 單元測試中的距離寬容度邏輯通過

## 第 4 階段：使用者故事 3 - 名額狀況 (優先級: P3)

**目標**: 啟用「只顯示有名額」篩選 (記憶體內)。
**測試**: `unit/firebase-events.test.js` (名額案例)。

- [x] T011 [US3] 更新 `src/lib/firebase-events.js` 中的 `queryEvents` 以實作第 2 階段記憶體內 `remainingSeats` 篩選
- [x] T012 [US3] 確保從 `src/app/events/page.js` 正確傳遞「只顯示有名額」的切換狀態 (預設值: true)
- [x] T013 [US3] 驗證 US3 單元測試中的名額狀況邏輯通過

## 第 5 階段：使用者故事 5 & FR-007 - UX 與導覽 (優先級: P3)

**目標**: 處理空狀態並確保搜尋結果可供導覽。
**測試**: `e2e/event-filtering.spec.js` (空狀態、導覽案例)。

- [x] T014 [US5] 在 `src/app/events/page.js` 中實作搜尋後當 `events.length === 0` 時的空狀態顯示邏輯
- [x] T015 [US5] 驗證 UI-007 E2E 測試通過 (空狀態訊息)
- [x] T016 [US5] 在 `src/app/events/page.js` 中實作「清除」按鈕邏輯 (重置欄位，保留「只顯示有名額」為勾選狀態)
- [x] T017 [US5] 驗證 UI-003 E2E 測試通過 (清除功能)
- [x] T018 [FR-007] 確保 `src/app/events/page.js` 中搜尋結果列表內的活動卡片皆包裝在 `<Link>` 元件中 (參考 `UI-008`)
- [x] T019 [FR-007] 驗證 FR-007 E2E 測試通過 (點擊導覽至詳情頁)

## 第 6 階段：最終磨光

**目標**: 確保滿足所有需求且程式碼整潔。

- [x] T020 執行完整的測試套件 (`npm test` 和 `npx playwright test`) 以確保沒有迴歸錯誤
- [x] T021 [P] 移除 `src/lib/firebase-events.js` 和 `src/app/events/page.js` 中任何未使用的匯入或 console logs
- [x] T022 檢查 `src/app/events/page.js` 中不需要的篩選 UI 元素 (主揪、類型等) 是否已依據 UI-002 在視覺上隱裝或禁用

## 依賴關係

- US2, US3, US5 依賴於 US1 (基本搜尋基礎設施)。
- 所有 UI 任務皆依賴於對應的服務層實作。
- T018 (導覽) 必須確保結構符合 `src/app/events/events.module.css` 的要求。

## 並行執行範例

- T008 (服務層距離邏輯) 和 T009 (UI 距離綁定) 可並行準備，但整合需要先完成 T008。
- T016 (清除邏輯) 獨立於服務層的更動。
