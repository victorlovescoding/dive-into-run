---
name: workflow-step-4-plan
description: 執行開發流程的第四步：技術實作規劃。當收到 `/speckit.plan` 指令或 `workflow-orchestrator` 指示進入 Plan 階段時使用。負責產出 plan.md。
---

# Step 4: Technical Planning

**目前正在做 workflow-step-4-plan skill！！！**

此 Skill 負責填補 Spec (做什麼) 與 Code (怎麼做) 之間的鴻溝。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-4-plan skill」。

1.  **啟用 Planning Skill**:
    *   **Action**: 呼叫 `activate_skill` 啟用 `writing-plans`。

2.  **整合資訊**:
    *   **Input**: `spec.md` (需求)、`tests/` (驗收標準)、現有代碼結構。

3.  **制定技術細節 (Strict Rules)**:
    *   **規範對應 (Style Alignment)**: 規劃中的代碼片段與模組設計，必須明確符合 **Airbnb JavaScript 風格**。規劃時應主動讀取專案中的 `eslint.config.mjs`，核對函數定義與語法是否 100% 符合該設定。
    *   **型別預定義 (JSDoc Contract)**: 在規劃核心 Service (src/lib) 時，必須預先定義其 **JSDoc 結構** (@param 型別與描述)。
    *   **品質門檻 (Quality Gates)**: 計畫中必須包含實作後的 `npm run lint` 掃描與測試驗證規劃。

4.  **產出 Plan 檔案**:
    *   **Path**: `specs/<feature>/plan.md`。

## Plan.md 結構範本

```markdown
# [Feature Name] Implementation Plan

## 1. Data Model Changes
(Firestore Schema 更新)

## 2. Server-Side Logic (src/lib/)
- [ ] `function A`: logic description (Include JSDoc definition)
- [ ] `function B`: logic description (Include JSDoc definition)

## 3. UI Components (src/components/ & src/app/)
- [ ] `Page.js`: layout
- [ ] `ComponentA.jsx`: props & behavior

## 4. 品質保證與規範 (MANDATORY)
- [ ] **風格規範**: 遵循憲法 Principle VI (Airbnb Style)。
- [ ] **JSDoc 契約**: 已在「技術細節」區塊預先定義所有函數的參數與型別。
- [ ] **驗收門檻**: 此計畫包含實作後的 `npm run lint` 掃描與 Vitest 測試驗證。

## 5. Step-by-Step Implementation Guide
(詳細的步驟，供 Step 5 拆解任務用)
```

## 下一步

當 `plan.md` 完成後，請提示使用者：
> 技術計畫已完成。請輸入「繼續」以進入 Step 5: Task 階段。

同時回覆：「workflow-step-4-plan skill 已執行完畢」。

## Instructions

### 0. 啟動宣告 (Declaration)
*   **必須**在第一時間先回覆：'**目前正在做 workflow-step-4-plan skill！！！**'.

### 1. 核心規範遵守 (Standard Compliance)
*   **Airbnb 風格**: 規劃時必須確保所有代碼設計符合 Airbnb 風格與 `eslint.config.mjs` 設定。
*   **JSDoc 契約**: 核心函數實作前，必須在計畫中預先定義完整 JSDoc 結構。
*   **驗收機制**: 必須將 `npm run lint` 與測試驗證列為計畫的必要驗收門檻。