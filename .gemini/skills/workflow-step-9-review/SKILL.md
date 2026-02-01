---
name: workflow-step-9-review
description: 執行開發流程的最後一步：代碼審查與提交。當 `workflow-orchestrator` 指示進入 Review 階段時使用。負責結案並標記 spec.md。
---

# Step 9: Review & Submit

此 Skill 負責確保程式碼品質並完成交付。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-9-review skill」。

1.  **開啟 Vibe Kanban 進行 Review**:
    - **Command**: `open https://vibe-kanban.vercel.app/`。

2.  **自我審查 (Self-Review)**:
    - 檢查代碼品質、Linting。

3.  **提交代碼**:
    - `git commit`。

4.  **標記結案 (Mark as Completed)**:
    - **Action**: 在 `specs/<feature>/spec.md` 的最上方加入 YAML Frontmatter 或標記：`status: completed`。
    - **重要**: 這標誌著整個 Feature 的結束。

## 結束

> 流程結束！功能已交付。您可以輸入「繼續」來開始下一個功能的開發 (將回到 Step 1)。

同時回覆：「workflow-step-9-review skill 已執行完畢」。
