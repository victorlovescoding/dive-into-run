---
name: workflow-step-9-review
description: 執行開發流程的最後一步：代碼審查與提交。當 `workflow-orchestrator` 指示進入 Review 階段時使用。負責結案並標記 spec.md。
---

# Step 9: Review & Submit

此 Skill 負責確保程式碼品質並完成交付。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-9-review skill」。

1.  **AI 自動化審查 (Linus Mode)**:
    *   **取得變更**: 執行 `git diff main` 以檢視本 Feature 的所有異動。
    *   **Action**: 啟用 `codereview-roasted` Skill。
    *   **指令**: 「請針對本次變更進行毒舌 Review。除了你的核心原則外，請務必嚴格檢查是否符合以下 **測試法規**：
        1. **Unit**: 必須有 AAA 註解，禁止使用 DOM。
        2. **Integration**: 必須使用三劍客與 user-event，禁止 fireEvent。
        3. **E2E**: 禁止 waitForTimeout，必須使用 Web-first assertions。」
    *   **判定標準**:
        - 🟢 **Good taste** / 🟡 **Acceptable**: 通過，可進入下一步。
        - 🔴 **Needs improvement**: **禁止提交**。必須回到實作階段修正後，重新執行 Review。

2.  **紀錄 Code Review 報告**:
    *   **Action**: 在 `specs/$(git branch --show-current)/code-review.md` 紀錄審查結果。
    *   **內容規範**:
        - **若為 🔴**: 必須詳細紀錄問題點與預計修正方案。
        - **若為 🟢🟡**: 可選擇性紀錄重要的架構 Insights 或優化建議。

3.  **修正代碼與對話**:
    *   根據 AI 的批判進行修正。
    *   **若需質疑 AI 意見**: 參考 `receiving-code-review` Skill 的流程進行專業辯論 (Pushback)。

4.  **開啟 Vibe Kanban 進行最終確認**:
    - **Command**: `open https://vibe-kanban.vercel.app/`。
    - 將任務移動至 **Completed**。

5.  **提交與結案**:
    - **Command**: `git add . && git commit -m "feat($(git branch --show-current)): complete feature and finalize after review"`
    - **範例**: `git commit -m "feat(001-event-filtering): 實作活動篩選功能與最終優化"`
    - **Action**: 在 `specs/$(git branch --show-current)/spec.md` 的最上方標記：`status: completed`。
    - **重要**: 這標誌著整個 Feature 的結束。

## 結束

> 流程結束！功能已交付。您可以輸入「繼續」來開始下一個功能的開發 (將回到 Step 1)。

同時回覆：「workflow-step-9-review skill 已執行完畢」。
