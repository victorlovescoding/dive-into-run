---
name: workflow-step-5-task
description: 執行開發流程的第五步：任務拆解。當收到 `/speckit.task` 指令或 `workflow-orchestrator` 指示進入 Task 階段時使用。負責產出 tasks.md。
---

# Step 5: Task Breakdown

**目前正在做 workflow-step-5-task skill！！！**

此 Skill 負責將技術計畫 (`plan.md`) 轉化為可被追蹤與指派的任務清單 (`tasks.md`)。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-5-task skill」。

1.  **讀取 Plan**:
    *   **Action**: 讀取 `specs/$(git branch --show-current)/plan.md`。

2.  **拆解任務**:
    *   **Rule**: 每個任務應該是「原子化」的 (Atomic)，且 ideally 可在 1-2 小時內完成。
    *   **Strict Rule**: **每個 User Story 或主要功能區塊的最後一項任務，必須是「驗證：執行 Lint 與測試」**。
        - 內容範例：`Run 'npm run lint' and 'npm run test', fix all errors.`
    *   **Format**: 必須包含明確的標題與驗收標準。

3.  **產出 Tasks 檔案**:
    *   **Path**: `specs/$(git branch --show-current)/tasks.md`。

## Tasks.md 結構範本

```markdown
# Tasks for [Feature Name]

## 1. Setup & Config
- [ ] Task 1: Add new packages
  - Description: ...

## 2. Backend / Lib
- [ ] Task 2: Implement firebase-users.js function
  - Description: ...

## 3. Frontend
- [ ] Task 3: Create Component X
  - Description: ...

## 4. Verification (MANDATORY)
- [ ] Task: 執行 Lint 與測試
  - Description: 執行 `npm run lint` 並修復所有 errors 與 warnings (JSDoc, Airbnb style)。
  - Description: **僅對本次變更的檔案**執行 type-check：`git diff --name-only main -- '*.js' '*.jsx' | xargs npx tsc --noEmit --allowJs --checkJs` (0 errors)。
  - Description: **執行 `grep -r "@ts-ignore" src`**，確保結果為空 (0 items)。禁止任何 `ts-ignore`。
```

## 下一步

當 `tasks.md` 完成後，請提示使用者：
> 任務清單已準備就緒。請輸入「繼續」以進入 Step 6: Execute 階段 (將任務加入 Kanban)。

同時回覆：「workflow-step-5-task skill 已執行完畢」。

## Instructions

### 0. 啟動宣告 (Declaration)
*   **必須**在第一時間先回覆：'**目前正在做 workflow-step-5-task skill！！！**'.

### 1. 核心規範遵守 (Standard Compliance)
*   **強制驗證**: 必須在 `specs/$(git branch --show-current)/tasks.md` 的每個主要功能章節末尾加入「執行 Lint 與測試」任務。
*   **零容忍原則**: 驗收標準必須明確要求：
    1.  修復所有 Airbnb 風格與 JSDoc 的 warnings 與 errors。
    2.  **僅對本次變更的檔案**執行 type-check：`git diff --name-only main -- '*.js' '*.jsx' | xargs npx tsc --noEmit --allowJs --checkJs` (0 errors)。
    3.  **執行 `grep -r "@ts-ignore" src` 檢查**，確保結果為空 (0 items)。禁止任何 `ts-ignore`。