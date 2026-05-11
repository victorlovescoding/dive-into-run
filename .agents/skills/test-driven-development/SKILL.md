---
name: test-driven-development
description: Test-Driven-Development（測試驅動開發）。當需要撰寫功能測試、Bug 修復測試，或在實作前建立失敗測試案例（RED phase）時使用。涵蓋 Unit / Integration / E2E / Server 測試的撰寫規範與品質防線。
---

# Step 3: Test Driven Development (TDD)

此 Skill 負責在寫入任何實作代碼前，先建立測試案例。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 Test-Driven-Development skill」。

1.  **TDD Core Principles (The Iron Law)**:
    - **NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**
    - **Verify Red**: 必須親眼看到測試失敗（證明測試能抓到錯誤）。
    - **Verify Green**: 寫最少量的代碼讓測試通過。
    - **Refactor**: 在 Green 狀態下重構，保持測試通過。
    - **Anti-patterns**:
      - 先寫 Code 再補測試 (False TDD)。
      - 一次寫一堆測試再實作 (Batch Testing)。
      - 測試過於依賴 Mock 而不測試真實行為。
    - **Rationalization Prevention**:
      - **禁止**以「功能簡單」、「時間緊迫」或「已有手動測試」為由跳過此階段。
      - **Iron Law**: No Production Code Without A Failing Test First. 違者視為違反核心價值。

1.5 **測試品質防線 (Quality Gate)**:
_ **Action 1 (Read The Laws)**: 在撰寫任何測試代碼前，**必須依序執行以下指令**，否則視為任務失敗：1. `Read` 讀取 `.agents/skills/test-driven-development/references/coding-style.md` (這是你的法律，必須嚴格遵守)。2. `Read` 讀取 `.agents/skills/test-driven-development/references/jsdoc-cheatsheet.md` (這是你的語法字典，請查閱型別寫法)。3. `Read` 讀取 `.agents/skills/test-driven-development/references/boilerplate.js` (這是你的範本，請照抄結構)。
_ **Action 2 (Anti-Patterns)**: `Read` 讀取並理解 `.agents/skills/test-driven-development/references/testing-anti-patterns.md`。\* **Iron Rule**: 嚴格遵守「三不原則」：不測試 Mock 行為、不污染生產代碼、不使用不完整 Mock。

2.  **分析設計文件 (Analyze & Locate)**:
    - **Profile-aware context**:
      - 先讀 `docs/superpowers/task-profiles.md` 判斷目前任務是 P1/P2/P3/P4。
      - P1/P2：不硬要求 `spec.md` / `plan.md`。以使用者訊息、task brief、PR review comment、issue scope、或 conversation scope 作為測試意圖來源；若資訊不足，先問清楚，不要因找不到 `specs/` 直接失敗。
      - P3：讀任務指定的 compact task contract、handoff、tasks 或 status artifact；只有該 profile/dispatch 要求 durable artifacts 時才要求它們存在。
      - P4：讀完整 durable specs，包含 `spec.md`、`plan.md`、`tasks.md`、`handoff.md`、`status.json`。
    - **Locate Documents (Robust Strategy)**:
      - **Action**: 必須準確找到任務授權的 context。分支名稱 (e.g. `refactor/fix-bug`) 可能與 Spec 路徑 (e.g. `specs/feature-auth`) 不一致，切勿 blindly assume 路徑。
      - **Strategy**:
        1.  若 dispatch 明確提供 task brief 或 spec path，優先使用它。
        2.  若 profile 是 P3/P4 且沒有明確路徑，可嘗試 `specs/$(git branch --show-current)/`。
        3.  若上述不存在，搜尋相關 `specs/**/handoff.md`、`tasks.md`、`status.json` 作候選。
        4.  多個候選、P3/P4 找不到必要 durable artifact、或 scope 不足以設計測試時，才請使用者提供正確路徑或補 scope。
      - **必讀文件 / context**:
        1.  P1/P2 task brief 或 conversation scope（必要）— 定義 bug、acceptance、owned files、verification。
        2.  P3 task contract / handoff / tasks / status（依 dispatch 要求）。
        3.  P4 `spec.md`（必要）— 定義**測什麼**: User Stories、Acceptance Scenarios、Functional Requirements (FRs)
        4.  P4 `plan.md`（必要）— 定義**怎麼測**: Function signatures、Component architecture、State management、UI specs
        5.  `data-model.md`（若存在且 relevant）— 補充 validation rules、資料結構、query patterns
    - **文件 → 測試層級對應**:

      | 測試層級    | 主要依據                              | 輔助參考                                |
      | ----------- | ------------------------------------- | --------------------------------------- |
      | Unit        | `plan.md` (service layer functions)   | `data-model.md` (validation rules)      |
      | Integration | `spec.md` (acceptance scenarios, FRs) | `plan.md` (component tree, state, a11y) |
      | E2E         | `spec.md` (user stories)              | —                                       |
      - **Unit Tests**: 從 `plan.md` 的 service layer 表格提取每個 function 的 signature 與要點，據此設計 mock/assert。`data-model.md` 的 validation rules 直接對應邊界測試案例。
      - **Integration Tests**: 從 `spec.md` 的 Acceptance Scenarios 逐條轉為測試案例（每個 Given/When/Then 至少一個 test）。從 `plan.md` 取得 component props、state 名稱、aria attributes 作為斷言依據。
      - **E2E Tests**: 從 `spec.md` 的 User Stories 提取 critical user journeys。

    - **Analyze (Critical Thinking)**:
      - **Action**: 閱讀上述文件並進行**批判性思考**。
      - **Gap Analysis**: 若 Spec 描述不足 (e.g. 只有 Happy Path)，**必須**主動補完 Edge Cases (Null, Network Error, Boundary) 並列出測試案例。
      - **Verification**: 確保測試覆蓋了 Spec 的所有驗收標準 (AC)。

2.5 **決定測試路徑 (Path Strategy)**:
_ **Action**: 執行以下邏輯以決定測試檔案存放位置：1. 確認 profile 與 task scope。P1/P2 可只用 task brief / conversation scope；P3/P4 才依 durable artifacts 尋找 specs。2. **定位 Spec 資料夾（只在需要 durable artifacts 時）**: - 優先使用 dispatch 指定路徑。- 若無指定且 profile 是 P3/P4，才嘗試 `specs/$(git branch --show-current)/`。- 若 P3/P4 必要 specs 不存在，詢問使用者確認正確路徑後再繼續。- `specs/<feature>/` 只作為 planning artifact 來源，不得建立 test/test directories。3. **設定 repo-root 測試路徑**: - **Unit**: `tests/unit/<layer>/<name>.test.js[x]` - **Integration**: `tests/integration/<domain>/<name>.test.jsx` - **E2E**: `tests/e2e/<name>.spec.js` - **Server**: `tests/server/<suite>/<name>.test.js`；現有 suite 範例包含 `tests/server/g8-server-coverage/unit/*.test.js` 與 `tests/server/rules/*.rules.test.js`。- **Results**: `tests/test-results/[unit|integration|e2e]/`。4. **Create Directories**: 使用 `mkdir -p` 一次建立需要的子資料夾：
`             mkdir -p tests/unit/<layer> tests/integration/<domain> tests/e2e
            mkdir -p tests/test-results/unit tests/test-results/integration tests/test-results/e2e
            `
_ **Result**: 輸出你決定的 unit / integration / e2e / server 測試檔路徑與 `tests/test-results/[unit|integration|e2e]/` 結果路徑供使用者確認。Server Vitest 測試必須放在 `tests/server/<suite>/...`；只有延伸既有 coverage suite 時才放進 `tests/server/g8-server-coverage/unit/`。

2.7 **建立 Stub 檔案 (Stub Creation)**: - **Why**: Vite/Vitest 在跑測試時會真的解析 import 路徑。即使測試用了 `vi.mock()`，如果被 import 的檔案本身不存在，Vite 會直接 crash（`Failed to resolve import`），導致測試連跑都跑不了、無法得到有效的 RED。- **When**: 在撰寫測試（Step 3）**之前**。根據 `plan.md` 的「新增檔案清單」，為所有尚未存在的 source 檔案建立 stub。- **How**: - **Service layer functions** → `export async function xxx() { throw new Error('Not implemented'); }` - **React components** → `export default function Xxx() { return null; }` - **Helper functions**（加在既有檔案中）→ `export function xxx() { return ''; }` 或合適的零值 - **原則**: - 只有 export signature + JSDoc，**不寫任何邏輯**（這不算 production code，只是讓 import 能解析）。- Stub **必須附完整 JSDoc**（`@param` / `@returns`），這樣測試的 type check 不會因為型別不明而報錯。- **Example**:
`js
      /**
       * 新增留言。
       * @param {string} eventId - 活動 ID。
       * @param {{ uid: string, name: string, photoURL: string }} user - 使用者資料。
       * @param {string} content - 留言內容。
       * @returns {Promise<{ id: string }>} 新留言 ID。
       */
      export async function addComment(eventId, user, content) {
        void eventId; void user; void content;
        throw new Error('Not implemented');
      }
      `

3.  **撰寫測試 (Testing)**:
    - **Parallel Strategy**: Unit / Integration / E2E / Server 測試**可以平行撰寫**（用 subagent 各負責一份）。若平行執行：
      - 每個 subagent **必須獨立讀取** Step 1.5 的 4 份 reference 文件（coding-style, jsdoc-cheatsheet, boilerplate, testing-anti-patterns）。
      - 每個 subagent **應參考前一個 feature 同層級的測試檔案**作為 pattern reference（用 `Glob` 找 `tests/unit/**/*.test.js[x]`、`tests/integration/**/*.test.jsx`、`tests/e2e/**/*.spec.js`、`tests/server/**/*.test.js` 等取最近的範本），確保 mock scaffold、import pattern、JSDoc style 一致。
    - **Requirement**: 必須**明確處理**以下四類測試。對於每一類，**必須**建立測試檔案，**或**明確說明「為何本任務不需要此類測試」(例如：純 UI 修改不涉 server logic 則免 Server Test)。
    - **Unit Tests**:
      - **Target**: 以 `src/service/**` 為主的純商業邏輯；若任務碰到 `src/lib/**` compatibility facade，補的是 facade 契約測試，不要把它當主要 service layer。
      - **Path**: `tests/unit/<layer>/<name>.test.js[x]`。
      - **Requirement**: 禁止使用 DOM 或 React Testing Library，保持速度與純粹性。
      - **Action**: 使用 `Write` 建立測試檔案。
      - **Standards**:
        1. **Logic**: 遵循 **AAA pattern** (Arrange, Act, Assert)。
        2. **Quality**: 符合 **F.I.R.S.T 原則** (Fast, Independent, Repeatable, Self-Validating, Timely)。
    - **Integration Tests**:
      - **Target**: UI 元件與 Interaction。
      - **Path**: `tests/integration/<domain>/<name>.test.jsx`。
      - **Requirement**: 必須使用 **Testing Library 三劍客** (`dom`, `react`, `user-event`)。**禁止使用 fireEvent**。
      - **Action**: 使用 `Write` 建立測試檔案。
    - **Writing Standards (Zero-Tolerance)**:
      - **Style Guide**: 必須嚴格遵守專案定義的風格規範 (**Airbnb Base + React Hooks**)。
      - 在撰寫測試代碼時，**必須**隨時確保符合 TypeScript/JSDoc 類型定義與 ESLint 規範。
      - **禁止**寫出「先求有再求好」的爛 code。測試代碼也是產品代碼的一部分。
      - **禁止**使用 `@ts-ignore` 或 `any` (除非極度必要且有詳細註解)。
      - 寫完一個檔案，建議立即執行 `npm run lint -- --fix` 自動修復風格問題，並手動修正剩餘錯誤。

    - **E2E Tests**:
      - **Target**: 關鍵的使用者操作流程 (Critical User Journeys)。
      - **Path**: `tests/e2e/<name>.spec.js`。
      - **Tool**: Playwright。
      - **Action**: 使用 `Write` 建立測試檔案。
      - **Standards**:
        1. **Locators**: 優先使用 `page.getByRole`, `page.getByText`。禁止使用脆弱的 CSS selector。
        2. **Stability**: **嚴格禁止使用 `page.waitForTimeout()`**。必須使用 Playwright 的自動等待特性與 Assertions。
    - **Server Tests**:
      - **Target**: 必須在 node/server Vitest project 執行的 server-only 邏輯、Firebase Admin、route/server adapters。
      - **Path**: `tests/server/<suite>/<name>.test.js`；現有 suite 範例包含 `tests/server/g8-server-coverage/unit/*.test.js` 與 `tests/server/rules/*.rules.test.js`。
      - **Tool**: Vitest server project；需要 Firebase Emulator 時使用 server test command，不要放進 browser unit bucket。
      - **Action**: 使用 `Write` 建立測試檔案，或明確說明本任務沒有 server-only surface。

4.  **The Iron Wall (絕對防線 - Zero Tolerance)**:
    - **Mandatory**: 提交測試前，**必須**確保測試程式碼通過靜態分析。測試邏輯應失敗 (Red)，但語法與類型必須正確。
    - **Strict Rule**: **絕對沒有任何不遵守的空間 (NO EXCEPTIONS)**。任何錯誤 (Error) 或警告 (Warning) 都是攔路虎，禁止繞過。
    - **Variable Definition**: 下列指令中的 `$TEST_FILE_PATH` 代表**你剛剛建立的測試檔案路徑** (e.g. `tests/unit/service/login.test.js`、`tests/integration/auth/login-form.test.jsx`、`tests/e2e/login.spec.js`、`tests/server/auth/firebase-admin.test.js`)。
    - **Mandatory Protocol (Loop until Green)**:
      1.  **Type Check**: 執行 `npm run type-check:changed`（或全量 `npm run type-check` / `npx tsc --noEmit --project tsconfig.json`）。
          - 結果必須為 **0 errors**。
          - 若有錯 -> **立刻修復 (Fix Immediately)**。禁止 Commit。
          - 不要直接對單一 JS/JSX 檔跑 `tsc ... --allowJs --checkJs`；那會漏掉 repo `tsconfig.json` 的 paths 與 include/exclude。
      2.  **Lint Check**: 執行 `npx eslint $TEST_FILE_PATH`。
          - 結果必須為 **0 problems**。
          - 使用 `npx eslint $TEST_FILE_PATH --fix` 自動修復，手修剩餘問題。
      3.  **Sanity Check**: 執行 `grep "@ts-ignore" $TEST_FILE_PATH`。
          - 結果必須為 **Empty (空)**。
          - 若有輸出 -> **立刻移除 (Remove Immediately)**。
    - **Constraint**: 只有當上述三項全數通過時，才允許執行 `git commit`。AI 不得在未驗證的情況下假設代碼是乾淨的。

5.  **驗證測試 (Red)**:
    - **Action**: 執行測試指令，確認它們**失敗** (因為功能尚未實作)。
    - **Strict Check**: 必須確認測試失敗是因為 **Assertion Error (功能未實作)**，而非其他類型的錯誤。前提：Step 4 的三項檢查（tsc / eslint / grep）必須已全數通過。
      - ❌ `Failed to resolve import "@/lib/xxx"` → 缺少 stub 檔案，回到 Step 2.7 建立
      - ❌ `ReferenceError: x is not defined` → 測試寫錯了，修好它
      - ❌ `SyntaxError` → 測試語法錯誤，修好它
      - ❌ `TypeError: X is not a function` → mock 不完整或 import 錯誤
      - ✅ `AssertionError: expected 'success' but got undefined` → 這才是有效的 RED
      - ✅ `TestingLibraryElementError: Unable to find role="xxx"` → 元件尚未實作，有效的 RED
    - **部分 PASS 是正常的**: 某些測試 case 在 RED phase 可能直接通過（例如驗證 throw 行為的 case，因為 stub 本來就 `throw new Error('Not implemented')`）。重點是**非 throw 類的正面驗證 case 必須 fail**。
    - **Commands**:
      - Unit: `mkdir -p tests/test-results/unit && npx vitest run tests/unit/<layer>/<name>.test.js --reporter=junit --outputFile=tests/test-results/unit/results.xml`
      - Integration: `mkdir -p tests/test-results/integration && npx vitest run tests/integration/<domain>/<name>.test.jsx --reporter=junit --outputFile=tests/test-results/integration/results.xml`
      - E2E: `mkdir -p tests/test-results/e2e && PLAYWRIGHT_JUNIT_OUTPUT_NAME=tests/test-results/e2e/results.xml npx playwright test tests/e2e/<name>.spec.js --reporter=junit`
      - Server: `npm run test:server -- tests/server/<suite>/<name>.test.js`
    - **Test Results (Output)**:
      - `tests/test-results/[unit | integration | e2e]/`

## 下一步

當**所有需要的測試檔案** (Unit / Integration / E2E / Server) 都已建立且確認為 Red 狀態後，請提示使用者執行以下指令（一次性提交）：

> **Command**: `git add . && git commit -m "test($(git branch --show-current)): add failing tests (RED)"`

提示使用者：

> 測試案例已建立 (RED) 並已提交。請輸入「繼續」以進入 Step 4: Plan 階段。

同時回覆：「Test-Driven-Development skill 已執行完畢」。
