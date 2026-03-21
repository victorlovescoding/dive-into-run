---
name: workflow-orchestrator
description: 主動式開發流程導航 (Workflow Orchestrator)。當使用者輸入「繼續」或詢問「下一步是什麼」、「目前進度」時觸發。負責分析專案當前狀態 (Spec -> Clarify -> TDD -> Plan -> Task -> Execute -> Verify -> Review)，並自動執行或指引下一個開發階段的指令與 Skill。
---

# Workflow Orchestrator

這個 Skill 是你的開發流程導航員。它會自動偵測當前的開發階段，並告訴你下一步該做什麼。

## 核心工作流程

標準開發流程包含以下 8 個階段：

1.  **Specify**: `/speckit.specify` (搭配 `brainstorming`, `frontend-design`) - 釐清需求，產出 `spec.md`。
2.  **Clarify**: `/speckit.clarify` - 找出漏洞，完善 Spec。
3.  **TDD**: `workflow-step-3-tdd` - 撰寫測試 (Vitest/Playwright)。
4.  **Plan**: `/speckit.plan` (搭配 `writing-plans`) - 根據 Spec 和測試寫出技術實作計畫 `plan.md`。
5.  **Task**: `/speckit.task` - 產出 `tasks.md`。
6.  **Execute**: 將任務加入 Kanban 並執行。
7.  **Verify**: 使用 Chrome DevTools MCP 驗收。
8.  **Review**: Code Review。

## 使用指引

當此 Skill 被觸發時，請依序執行以下步驟：

### 0. 狀態報告 (Start)
請第一時間回覆：「目前執行 workflow-orchestrator skill」。

### 1. 執行狀態偵測

執行隨附的 Python 腳本來判斷當前狀態：

```bash
python3 .claude/skills/workflow-orchestrator/scripts/detect_state.py
```

### 2. 解讀輸出並行動

腳本會輸出一個 JSON 物件，包含以下欄位：
- `stage`: 階段編號 (1-6)
- `stage_name`: 階段名稱
- `message`: 給使用者的訊息
- `command`: 下一步建議執行的指令
- `recommended_skills`: 建議搭配使用的 Skills

根據輸出結果，採取以下行動：

#### 若 Command 是 CLI 指令 (如 `/speckit.specify`)

1.  **向使用者報告狀態**: 顯示 `message`。
2.  **建議或自動執行**: 告訴使用者即將執行 `command`。如果是 `/speckit` 系列指令，通常可以直接執行或請使用者確認。
3.  **提醒 Skill**: 如果有 `recommended_skills`，提醒使用者這些 Skill 將會派上用場 (或者如果 Gemini 支援，可以在執行指令時一併考慮這些 Skill 的上下文)。

#### 若 Command 是 `GEMINI_CLI_ADD_TASKS` (Stage 6)

這表示 `tasks.md` 已經準備好了。此時應該：
1.  讀取 `tasks.md` 的內容 (使用 `read_file`，路徑通常在 `specs/<feature>/tasks.md`)。
2.  解析任務列表。
3.  使用 `list_projects` 找到專案 ID。
4.  引導使用者將任務加入 Kanban (可以使用 `create_task` tool)。
5.  提醒使用者開始執行第一個任務。

#### 若處於 Verify (Stage 7) 或 Review (Stage 8)

腳本可能無法精確偵測這兩個階段（因為它們不產生特定檔案）。如果使用者在 Stage 6 完成後繼續輸入「繼續」，請詢問使用者：
- "任務是否已執行完畢？是否要進行驗收 (Verify)？"
- 或者 "是否要進入 Code Review 階段？"

根據回答引導至對應的步驟。

## 範例回應

> 偵測到目前處於 **Stage 4: Plan**。
> `spec.md` 與測試檔案已就緒。
>
> 下一步：執行 `/speckit.plan` 來產生技術實作計畫。
> 建議搭配 Skill: `writing-plans`。
>
> 是否立即執行？

同時回覆：「workflow-orchestrator skill 已執行完畢」。