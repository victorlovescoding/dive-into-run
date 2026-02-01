---
name: workflow-step-5-task
description: 執行開發流程的第五步：任務拆解。當收到 `/speckit.task` 指令或 `workflow-orchestrator` 指示進入 Task 階段時使用。負責產出 tasks.md。
---

# Step 5: Task Breakdown

此 Skill 負責將技術計畫 (`plan.md`) 轉化為可被追蹤與指派的任務清單 (`tasks.md`)。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-5-task skill」。

1.  **讀取 Plan**:
    *   **Action**: 讀取 `specs/<feature>/plan.md`。

2.  **拆解任務**:
    *   **Rule**: 每個任務應該是「原子化」的 (Atomic)，且 ideally 可在 1-2 小時內完成。
    *   **Format**: 必須包含明確的標題與驗收標準。

3.  **產出 Tasks 檔案**:
    *   **Path**: `specs/<feature>/tasks.md`。

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
```

## 下一步

當 `tasks.md` 完成後，請提示使用者：
> 任務清單已準備就緒。請輸入「繼續」以進入 Step 6: Execute 階段 (將任務加入 Kanban)。

同時回覆：「workflow-step-5-task skill 已執行完畢」。