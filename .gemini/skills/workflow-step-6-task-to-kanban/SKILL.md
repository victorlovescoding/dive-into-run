---
name: workflow-step-6-task-to-kanban
description: 執行開發流程的第六步：將 Task 轉交給 Vibe Kanban。當 `workflow-orchestrator` 指示同步任務時使用。負責將 tasks.md 加入 Kanban 並標記狀態。
---

# Step 6: Task to Kanban

此 Skill 負責將 `tasks.md` 的內容同步到 Vibe Kanban 系統。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-6-task-to-kanban skill」。

1.  **解析 Tasks**:
    - **Command**: `python3 .gemini/skills/workflow-step-6-task-to-kanban/scripts/parse_tasks.py specs/$(git branch --show-current)/tasks.md`

2.  **加入 Kanban**:
    - **Tool**: 使用 `list_projects` (請勿提供 `organization_id` 參數，除非你確定它是正確的。禁止瞎掰 UUID)。
    - **Logic**: 
        1. 呼叫 `list_projects()` (無參數)。
        2. 若回傳專案列表，選擇與當前 repo 名稱最接近的專案。
        3. 若列表為空或找不到，請告知使用者先在 Vibe Kanban 建立專案，或嘗試使用 `create_project`。
        4. 取得正確 `project_id` 後，使用 `create_task` 建立任務。

3.  **標記狀態**:
    - **Action**: 在 `tasks.md` 檔案開頭加入標記：`status: kanban_synced`。
    - **重要**: 這讓 Workflow 知道已完成同步。

## 結束

> 任務已同步至 Kanban。請輸入「繼續」以進入 Step 7: Execute 階段。

同時回覆：「workflow-step-6-task-to-kanban skill 已執行完畢」。
