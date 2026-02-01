---
name: workflow-step-2-clarify
description: 執行開發流程的第二步：漏洞偵測與釐清。當收到 `/speckit.clarify` 指令或 `workflow-orchestrator` 指示進入 Clarify 階段時使用。負責審查 spec.md 並找出潛在問題。
---

# Step 2: Clarify & Validate

此 Skill 負責擔任「魔鬼代言人」，審查 `spec.md` 的可行性與完整性。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-2-clarify skill」。

1.  **讀取 Spec**:
    *   **Action**: 讀取 `specs/<active-feature>/spec.md`。

2.  **Context Check (重要!)**:
    *   **Action**: 使用 `search_file_content` 或 `glob` 檢查專案現有程式碼。
    *   **Checkpoints**:
        *   **資料庫結構**: Spec 定義的欄位是否符合現有 Firestore Schema (`src/lib/firebase-*.js`)？
        *   **路由衝突**: 新增的 Page URL 是否已存在？
        *   **元件重用**: 是否有現成的 Component 可以使用？
        *   **技術限制**: 是否違反 Next.js 15 或 Firebase 的限制？

3.  **提出質疑**:
    *   **Goal**: 找出邏輯漏洞、邊界情況 (Edge Cases) 或未定義的行為。
    *   **Output**: 列出「待釐清事項清單」請使用者確認。

4.  **更新 Spec**:
    *   **Action**: 根據使用者的回答，更新 `spec.md`，使其更嚴謹。

## 下一步

當 Spec 確認無誤且漏洞已修補後，請提示使用者：
> Spec 已釐清並更新。請輸入「繼續」以進入 Step 3: TDD 階段。

同時回覆：「workflow-step-2-clarify skill 已執行完畢」。