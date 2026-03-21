---
name: workflow-step-3-tdd
description: 測試驅動開發 (TDD) 與流程第三步。當需要撰寫功能測試、Bug 修復測試，或執行開發流程第三步 (Step 3) 時使用。此 Skill 是專案中 TDD 的唯一權威來源。
---

# Step 3: Test Driven Development (TDD)

此 Skill 負責在寫入任何實作代碼前，先建立測試案例。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-3-tdd skill」。

1.  **TDD Core Principles (The Iron Law)**:
    *   **NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**
    *   **Verify Red**: 必須親眼看到測試失敗（證明測試能抓到錯誤）。
    *   **Verify Green**: 寫最少量的代碼讓測試通過。
    *   **Refactor**: 在 Green 狀態下重構，保持測試通過。
    *   **Anti-patterns**: 
        -   先寫 Code 再補測試 (False TDD)。
        -   一次寫一堆測試再實作 (Batch Testing)。
        -   測試過於依賴 Mock 而不測試真實行為。
    *   **Rationalization Prevention**: 
        -   **禁止**以「功能簡單」、「時間緊迫」或「已有手動測試」為由跳過此階段。
        -   **Iron Law**: No Production Code Without A Failing Test First. 違者視為違反核心價值。

1.5 **測試品質防線 (Quality Gate)**:
    *   **Action 1 (Read The Laws)**: 在撰寫任何測試代碼前，**必須依序執行以下指令**，否則視為任務失敗：
        1.  `read_file` 讀取 `.claude/skills/workflow-step-3-tdd/references/coding-style.md` (這是你的法律，必須嚴格遵守)。
        2.  `read_file` 讀取 `.claude/skills/workflow-step-3-tdd/references/jsdoc-cheatsheet.md` (這是你的語法字典，請查閱型別寫法)。
        3.  `read_file` 讀取 `.claude/skills/workflow-step-3-tdd/references/boilerplate.js` (這是你的範本，請照抄結構)。
    *   **Action 2 (Anti-Patterns)**: 執行 `view_file` 讀取並理解 `.claude/skills/workflow-step-3-tdd/references/testing-anti-patterns.md`。
    *   **Iron Rule**: 嚴格遵守「三不原則」：不測試 Mock 行為、不污染生產代碼、不使用不完整 Mock。

2.  **分析 Spec (Analyze & Locate)**:
    *   **Locate Spec (Robust Strategy)**:
        -   **Action**: 必須準確找到對應的 `spec.md`。由於分支名稱 (e.g. `refactor/fix-bug`) 可能與 Spec 路徑 (e.g. `specs/feature-auth`) 不一致，切勿 blindly assume路徑。
        -   **Strategy**:
            1.  預設嘗試: `specs/$(git branch --show-current)/spec.md`
            2.  搜尋嘗試: 若上述不存在，應尋找父目錄或相關連的 `specs/**/spec.md` (類似 Tests 的尋找邏輯)。
            3.  **Mandatory Ask**: 若有多個候選或無法確定，**必須**請使用者提供正確路徑。
    *   **Analyze (Critical Thinking)**:
        -   **Action**: 閱讀 Spec 並進行**批判性思考**。
        -   **Gap Analysis**: 若 Spec 描述不足 (e.g. 只有 Happy Path)，**必須**主動補完 Edge Cases (Null, Network Error, Boundary) 並列出測試案例。
        -   **Verification**: 確保測試覆蓋了 Spec 的所有驗收標準 (AC)。

2.5 **決定測試路徑 (Path Strategy)**:
    *   **Action**: 執行以下邏輯以決定測試檔案存放位置：
        1.  取得當前分支名稱: `BRANCH=$(git branch --show-current)`
        2.  **判斷任務類型 (Feature vs. Refactor)**:
            -   **Scenario A: Refactoring (Task-Based)**
                -   若分支名稱包含 `refactor`，或使用者明確指定為重構任務。
                -   找出當前參考的 `spec.md` 路徑 (e.g., `specs/003-strict-type-fixes/refactor-events-page/spec.md`)。
                -   提取 `spec.md` 的**父目錄名稱** (e.g., `refactor-events-page`) 作為 `TASK_NAME`。
                -   **TEST_PATH**: `tests/$BRANCH/$TASK_NAME`
                -   **RESULT_PATH**: `test-results/$BRANCH/$TASK_NAME`
            -   **Scenario B: Standard Feature**
                -   預設情況，或 `spec.md` 直接位於 `specs/$BRANCH/spec.md`。
                -   **TEST_PATH**: `tests/$BRANCH`
                -   **RESULT_PATH**: `test-results/$BRANCH`
        3.  **Create Directories**: 使用 `mkdir -p` 確保目標資料夾存在。
    *   **Result**: 輸出你決定的 `TEST_PATH` 與 `RESULT_PATH` 供使用者確認。

3.  **撰寫測試 (Testing)**:
    *   **Requirement**: 必須**明確處理**以下三個層級的測試。對於每一個層級，**必須**建立測試檔案，**或**明確說明「為何本任務不需要此層級測試」(例如：純 UI 修改不涉邏輯則免 Unit Test)。
    *   **Unit Tests**:
        - **Target**: `src/lib/` 中的純商業邏輯。
        - **Path**: `$TEST_PATH/unit/`。
        - **Requirement**: 禁止使用 DOM 或 React Testing Library，保持速度與純粹性。
        - **Action**: 使用 `write_to_file` 建立測試檔案。
        - **Standards**:
            1. **Logic**: 遵循 **AAA pattern** (Arrange, Act, Assert)。
            2. **Quality**: 符合 **F.I.R.S.T 原則** (Fast, Independent, Repeatable, Self-Validating, Timely)。
    *   **Integration Tests**:
        - **Target**: UI 元件與 Interaction。
        - **Path**: `$TEST_PATH/integration/`。
        - **Requirement**: 必須使用 **Testing Library 三劍客** (`dom`, `react`, `user-event`)。**禁止使用 fireEvent**。
        - **Action**: 使用 `write_to_file` 建立測試檔案。
    *   **Writing Standards (Zero-Tolerance)**:
        *   **Style Guide**: 必須嚴格遵守專案定義的風格規範 (**Airbnb Base + React Hooks**)。
        *   在撰寫測試代碼時，**必須**隨時確保符合 TypeScript/JSDoc 類型定義與 ESLint 規範。
        *   **禁止**寫出「先求有再求好」的爛 code。測試代碼也是產品代碼的一部分。
        *   **禁止**使用 `@ts-ignore` 或 `any` (除非極度必要且有詳細註解)。
        *   寫完一個檔案，建議立即執行 `npm run lint -- --fix` 自動修復風格問題，並手動修正剩餘錯誤。

    *   **E2E Tests**:
        - **Target**: 關鍵的使用者操作流程 (Critical User Journeys)。
        - **Path**: `$TEST_PATH/e2e/`。
        - **Tool**: Playwright。
        - **Action**: 使用 `write_to_file` 建立測試檔案。
        - **Standards**:
            1. **Locators**: 優先使用 `page.getByRole`, `page.getByText`。禁止使用脆弱的 CSS selector。
            2. **Stability**: **嚴格禁止使用 `page.waitForTimeout()`**。必須使用 Playwright 的自動等待特性與 Assertions。

4.  **The Iron Wall (絕對防線 - Zero Tolerance)**:
    *   **Mandatory**: 提交測試前，**必須**確保測試程式碼通過靜態分析。測試邏輯應失敗 (Red)，但語法與類型必須正確。
    *   **Strict Rule**: **絕對沒有任何不遵守的空間 (NO EXCEPTIONS)**。任何錯誤 (Error) 或警告 (Warning) 都是攔路虎，禁止繞過。
    *   **Variable Definition**: 下列指令中的 `$TEST_FILE_PATH` 代表**你剛剛建立的測試檔案路徑** (e.g. `tests/feature/login.test.jsx`)。
    *   **Mandatory Protocol (Loop until Green)**:
        1.  **Type Check**: 執行 `npx tsc $TEST_FILE_PATH --noEmit --allowJs --checkJs --jsx react-jsx --moduleResolution bundler --target esnext --module esnext` (僅檢查此檔案)。
            -   結果必須為 **0 errors**。
            -   若有錯 -> **立刻修復 (Fix Immediately)**。禁止 Commit。
        2.  **Lint Check**: 執行 `npx eslint $TEST_FILE_PATH`。
            -   結果必須為 **0 problems**。
            -   使用 `npx eslint $TEST_FILE_PATH --fix` 自動修復，手修剩餘問題。
        3.  **Sanity Check**: 執行 `grep "@ts-ignore" $TEST_FILE_PATH`。
            -   結果必須為 **Empty (空)**。
            -   若有輸出 -> **立刻移除 (Remove Immediately)**。
    *   **Constraint**: 只有當上述三項全數通過時，才允許執行 `git commit`。AI 不得在未驗證的情況下假設代碼是乾淨的。

5.  **驗證測試 (Red)**:
    *   **Action**: 執行測試指令，確認它們**失敗** (因為功能尚未實作)。
    *   **Strict Check**: 必須確認測試失敗是因為 **Assertion Error (功能未實作)**，而非 **Syntax Error / Reference Error**。
        -   ✅ `npx tsc ...` 必須通過 (0 errors)。
        -   ✅ `npx eslint ...` 必須通過 (0 errors)。
        -   ✅ `grep "@ts-ignore" ...` 確保沒有任何被禁用的註解。
        -   ❌ `ReferenceError: x is not defined` (這是你的測試寫錯了，修好它)
        -   ✅ `AssertionError: expected 'success' but got undefined` (這才是有效的 RED)
    *   **Commands**:
        - Unit: `mkdir -p $RESULT_PATH/unit && npx vitest run $TEST_PATH/unit --reporter=junit --outputFile=$RESULT_PATH/unit/results.xml`
        - Integration: `mkdir -p $RESULT_PATH/integration && npx vitest run $TEST_PATH/integration --reporter=junit --outputFile=$RESULT_PATH/integration/results.xml`
        - E2E: `mkdir -p $RESULT_PATH/e2e && PLAYWRIGHT_JUNIT_OUTPUT_NAME=$RESULT_PATH/e2e/results.xml npx playwright test $TEST_PATH/e2e --reporter=junit`
    
    *   **Test Results (Output)**:
        -   **Standard**: `test-results/<feature-name>/[unit | integration | e2e]/`
        -   **Refactoring**: `test-results/<branch-name>/<task-name>/[unit | integration | e2e]/`

## 下一步

當**所有需要的測試檔案** (Unit / Integration / E2E) 都已建立且確認為 Red 狀態後，請提示使用者執行以下指令（一次性提交）：
> **Command**: `git add . && git commit -m "test($(git branch --show-current)): add failing tests (RED)"`

提示使用者：
> 測試案例已建立 (RED) 並已提交。請輸入「繼續」以進入 Step 4: Plan 階段。

同時回覆：「workflow-step-3-tdd skill 已執行完畢」。
