---
name: workflow-step-7-execute-task-kanban
description: 執行開發流程的第七步：任務執行監控。當 `workflow-orchestrator` 指示執行任務時使用。負責監控 Kanban 進度並協助 Coding。
---

# Step 7: Execute Tasks (Kanban)

此 Skill 負責實際的代碼實作與進度追蹤。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-7-execute-task-kanban skill」。

1.  **檢查 Kanban 狀態**:
    - **Tool**: 使用 `vibe_kanban` 的 `list_tasks`。
    - **Strategy (Batch Execution)**:
        - **Rule**: 不要一次執行所有任務。優先執行 **前 3 個關鍵任務 (MVP)**。
        - **Checkpoint**: 完成首批任務後，暫停並詢問使用者確認方向，確保架構無誤後再繼續。
    - **Check**: 是否所有任務狀態皆為 `done`？

2.  **若有任務未完成 (或從 Step 8 退回修復)**:
    - **Action**: 挑選一個 `todo` 或 `inprogress` 的任務。
    - **若為修復任務**: 建議啟用 `systematic-debugging` Skill 輔助診斷根因。
    - **Action**: 開始 Coding / TDD 循環。
    - **Action**: **[原子化提交]** 任務完成後，**必須**執行 `npm run type-check` 確保無誤，且測試通過時，才執行 Commit。
        - **Standards**: 參考 `git-commit-guard` 規範撰寫 Message。
        - **Commit Format**:
            - **正常開發**: `feat(<feature>): <task-description>`
            - **驗收修復**: `fix(<feature>): <description of the bug fix>`
    - **Action**: 使用 `update_task` 標記為 `done`。
    - **Repeat**: 提示使用者繼續下一個任務，或再次輸入「繼續」。

3.  **若所有任務已完成**:
    - **Action**: 在 `specs/$(git branch --show-current)/tasks.md` 檔案開頭加入（或更新）標記：`status: implementation_completed`。
    - **重要**: 這讓 Workflow 知道實作已完成，準備進入 Verify。

## 結束

若任務全數完成：
> 所有任務實作完成。請輸入「繼續」以進入 Step 8: Verify 階段。

若仍有任務：
> 目前任務執行中。完成後請輸入「繼續」。

同時回覆：「workflow-step-7-execute-task-kanban skill 已執行完畢」。