---
name: workflow-step-8-chrome-devtools-verify
description: 執行開發流程的第八步：使用 Chrome DevTools 驗收。當 `workflow-orchestrator` 指示進入 Verify 階段時使用。負責驗收功能並標記狀態。
---

# Step 8: Chrome DevTools Verify

此 Skill 負責使用 Chrome DevTools MCP 驗收實作成果。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-8-chrome-devtools-verify skill」。

1.  **準備測試環境 (交互式)**:
    - **提示使用者**: 請使用者開啟兩個新的 Terminal 視窗並維持執行，完成後通知我 (例如回答「好了」)：
      1.  **Terminal A (Backend)**: `npx firebase-tools emulators:start`
      2.  **Terminal B (Frontend)**: `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true npm run dev`
    - **Wait**: 等待使用者確認環境已就緒。

2.  **驗收測試**:
    - **Navigate**: 前往 `http://localhost:3000` (或使用者指定的 Port)。
    - **Visual**: 截圖檢查 UI。
    - **Auth Automation**:
        - **Action**: 若遇到登入按鈕，使用 MCP 點擊。
        - **Auto-Login**: 在 Emulator 的模擬登入視窗中，自動點擊 "Add New Account" 或 "Sign in with Google.com"。
    - **Functional**: 使用 Chrome DevTools 模擬操作。

3.  **清理環境**:
    - **提示使用者**: 測試完成後，請記得關閉上述兩個 Terminal 視窗，並恢復正常的 `npm run dev` (不帶環境變數) 以連接雲端資料庫。

4.  **標記狀態**:
    - **Action**: 若驗收通過，在 `tasks.md` 檔案開頭加入（或更新）標記：`status: verified`。
    - **重要**: 這讓 Workflow 知道可以進入 Code Review。

## 結束

> 驗收完成。請輸入「繼續」以進入 Step 9: Review 階段。

同時回覆：「workflow-step-8-chrome-devtools-verify skill 已執行完畢」。
