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
    - **準備**: 確保已建立 `specs/<feature>/verification/` 目錄。
    - **對照標準**: 以 `specs/<feature>/spec.md` 的 **User Stories** 為唯一真理。
    - **執行動作**: 每條 User Story 必須有對應的 MCP 操作與截圖。
    - **截圖路徑**: 存放於 `specs/<feature>/verification/`。
    - **驗收清單**:
        1. 核心功能是否正常運作
        2. UI 是否符合設計
        3. Error handling 是否正確
        4. **Console 檢查**: 瀏覽器 Console 是否有紅字 Error 或黃字 Warning
    - **Auth Automation**:
        - **Action**: 若遇到登入按鈕，使用 MCP 點擊。
        - **Auto-Login**: 在 Emulator 的模擬登入視窗中，自動點擊 "Add New Account" 或 "Sign in with Google.com"。

3.  **紀錄驗收結果**:
    - **Action**: 在 `specs/<feature>/verification.md` 紀錄審查結果。
    - **內容規範**:
        - 每條 User Story 的驗收狀態 (✅ Pass / ❌ Fail)
        - **格式要求**: 必須標註 User Story ID，例如：`US1: 搜尋地點 - ✅ Pass`
        - 截圖路徑引用
        - 若有問題，詳細描述問題點

4.  **清理環境**:
    - **提示使用者**: 測試完成後，請記得關閉上述兩個 Terminal 視窗，並恢復正常的 `npm run dev` (不帶環境變數) 以連接雲端資料庫。

5.  **標記狀態**:
    - **若驗收通過**: 在 `tasks.md` **Frontmatter (檔案最開頭)** 加入（或更新）標記：`status: verified`。進入 Step 9。
    - **若驗收失敗**: **禁止標記**。
        - **簡單問題**: 直接回到 Step 7 修正代碼。
        - **複雜問題**: 建議啟用 `systematic-debugging` 進行根因分析後，再回到 Step 7 實作修復並 Commit。

## 結束

若驗收通過：
> 驗收完成。請輸入「繼續」以進入 Step 9: Review 階段。

若驗收失敗：
> 驗收未通過。請輸入「繼續」以回到 Step 7 進行修正。

同時回覆：「workflow-step-8-chrome-devtools-verify skill 已執行完畢」。
