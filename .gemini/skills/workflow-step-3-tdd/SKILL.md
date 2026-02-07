---
name: workflow-step-3-tdd
description: 執行開發流程的第三步：測試驅動開發 (TDD)。當 `workflow-orchestrator` 指示進入 TDD 階段時使用。負責撰寫 Unit Tests, Integration Tests 與 E2E Tests。
---

# Step 3: Test Driven Development (TDD)

此 Skill 負責在寫入任何實作代碼前，先建立測試案例。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-3-tdd skill」。

1.  **啟用 TDD Skill**:
    *   **Action**: 無需使用者介入。Agent 應自動呼叫 `view_file` 讀取並遵循 `.gemini/skills/test-driven-development/SKILL.md` 的指引。

2.  **分析 Spec**:
    *   **Action**: 根據 `specs/$(git branch --show-current)/spec.md` 的 User Stories 和驗收標準，列出需要的測試案例。

3.  **撰寫測試 (Testing)**:
    *   **Unit Tests**:
        - **Target**: `src/lib/` 中的純商業邏輯。
        - **Path**: `tests/$(git branch --show-current)/unit/` (使用當前分支名稱，請務必先確認)。
        - **Requirement**: 禁止使用 DOM 或 React Testing Library，保持速度與純粹性。
        - **Action**: 使用 `write_to_file` 建立測試檔案。
        - **Standards**:
            1. **Logic**: 遵循 **AAA pattern** (Arrange, Act, Assert)。
            2. **Quality**: 符合 **F.I.R.S.T 原則** (Fast, Independent, Repeatable, Self-Validating, Timely)。
    *   **Integration Tests**:
        - **Target**: UI 元件與 Interaction。
        - **Path**: `tests/$(git branch --show-current)/integration/`。
        - **Requirement**: 必須使用 **Testing Library 三劍客** (`dom`, `react`, `user-event`)。**禁止使用 fireEvent**。
        - **Action**: 使用 `write_to_file` 建立測試檔案。
    *   **E2E Tests**:
        - **Target**: 關鍵的使用者操作流程 (Critical User Journeys)。
        - **Path**: `tests/$(git branch --show-current)/e2e/`。
        - **Tool**: Playwright。
        - **Action**: 使用 `write_to_file` 建立測試檔案。
        - **Standards**:
            1. **Locators**: 優先使用 `page.getByRole`, `page.getByText`。禁止使用脆弱的 CSS selector。
            2. **Stability**: **嚴格禁止使用 `page.waitForTimeout()`**。必須使用 Playwright 的自動等待特性與 Assertions。

5.  **驗證測試 (Red)**:
    *   **Action**: 執行測試指令，確認它們**失敗** (因為功能尚未實作)。
    *   **Commands**:
        - Unit: `mkdir -p test-results/$(git branch --show-current)/unit && npx vitest run tests/$(git branch --show-current)/unit --reporter=junit --outputFile=test-results/$(git branch --show-current)/unit/results.xml`
        - Integration: `mkdir -p test-results/$(git branch --show-current)/integration && npx vitest run tests/$(git branch --show-current)/integration --reporter=junit --outputFile=test-results/$(git branch --show-current)/integration/results.xml`
        - E2E: `mkdir -p test-results/$(git branch --show-current)/e2e && PLAYWRIGHT_JUNIT_OUTPUT_NAME=test-results/$(git branch --show-current)/e2e/results.xml npx playwright test tests/$(git branch --show-current)/e2e --reporter=junit`

## 下一步

當**所有需要的測試檔案** (Unit / Integration / E2E) 都已建立且確認為 Red 狀態後，請提示使用者執行以下指令（一次性提交）：
> **Command**: `git add . && git commit -m "test($(git branch --show-current)): add failing tests (RED)"`

提示使用者：
> 測試案例已建立 (RED) 並已提交。請輸入「繼續」以進入 Step 4: Plan 階段。

同時回覆：「workflow-step-3-tdd skill 已執行完畢」。
