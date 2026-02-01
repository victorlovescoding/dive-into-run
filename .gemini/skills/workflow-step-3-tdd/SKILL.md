---
name: workflow-step-3-tdd
description: 執行開發流程的第三步：測試驅動開發 (TDD)。當 `workflow-orchestrator` 指示進入 TDD 階段時使用。負責撰寫 Unit Tests 與 E2E Tests。
---

# Step 3: Test Driven Development (TDD)

此 Skill 負責在寫入任何實作代碼前，先建立測試案例。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-3-tdd skill」。

1.  **啟用 TDD Skill**:
    *   **Action**: 呼叫 `activate_skill` 啟用 `test-driven-development`。

2.  **分析 Spec**:
    *   **Action**: 根據 `spec.md` 的 User Stories 和驗收標準，列出需要的測試案例。

3.  **撰寫單元/整合測試 (Vitest)**:
    *   **Target**: `src/lib/` 中的商業邏輯與 Firebase 操作。
    *   **Path**: `tests/<feature>/unit/`。
    *   **Tool**: Vitest。
    *   **Note**: 對於 Firebase，優先使用 Emulator 或 Mock。

4.  **撰寫 E2E 測試 (Playwright)**:
    *   **Target**: 關鍵的使用者操作流程 (Critical User Journeys)。
    *   **Path**: `tests/<feature>/e2e/`。
    *   **Tool**: Playwright。

5.  **驗證測試 (Red)**:
    *   **Action**: 執行測試指令，確認它們**失敗** (因為功能尚未實作)。
    *   **Command**: `npm test` 或 `npx vitest`, `npx playwright test`。

## 下一步

當測試檔案建立且確認為 Red 狀態後，請提示使用者：
> 測試案例已建立 (RED)。請輸入「繼續」以進入 Step 4: Plan 階段。

同時回覆：「workflow-step-3-tdd skill 已執行完畢」。