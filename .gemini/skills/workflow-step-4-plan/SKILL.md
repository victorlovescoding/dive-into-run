---
name: workflow-step-4-plan
description: 執行開發流程的第四步：技術實作規劃。當收到 `/speckit.plan` 指令或 `workflow-orchestrator` 指示進入 Plan 階段時使用。負責產出 plan.md。
---

# Step 4: Technical Planning

此 Skill 負責填補 Spec (做什麼) 與 Code (怎麼做) 之間的鴻溝。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-4-plan skill」。

1.  **啟用 Planning Skill**:
    *   **Action**: 呼叫 `activate_skill` 啟用 `writing-plans`。

2.  **整合資訊**:
    *   **Input**: `spec.md` (需求)、`tests/` (驗收標準)、現有代碼結構。

3.  **制定技術細節**:
    *   **資料結構**: 定義 Firestore Document 的確切 JSON 形狀。
    *   **API/Functions**: 定義 `src/lib/` 中需要新增哪些函式 (輸入/輸出)。
    *   **Component Hierarchy**: 定義 UI 元件樹狀結構與 Props。
    *   **State Management**: 定義 Client Side 狀態如何流動。

4.  **產出 Plan 檔案**:
    *   **Path**: `specs/<feature>/plan.md`。

## Plan.md 結構範本

```markdown
# [Feature Name] Implementation Plan

## 1. Data Model Changes
(Firestore Schema 更新)

## 2. Server-Side Logic (src/lib/)
- [ ] `function A`: logic description
- [ ] `function B`: logic description

## 3. UI Components (src/components/ & src/app/)
- [ ] `Page.js`: layout
- [ ] `ComponentA.jsx`: props & behavior

## 4. Step-by-Step Implementation Guide
(詳細的步驟，供 Step 5 拆解任務用)
```

## 下一步

當 `plan.md` 完成後，請提示使用者：
> 技術計畫已完成。請輸入「繼續」以進入 Step 5: Task 階段。

同時回覆：「workflow-step-4-plan skill 已執行完畢」。