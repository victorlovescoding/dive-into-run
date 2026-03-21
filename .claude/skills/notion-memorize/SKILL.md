---
name: notion-memorize
description: 專門用於將對話中的 Bug、Code Review 建議或學習觀念自動記錄到 Notion 資料庫中。當使用者說「幫我記到 Notion」、「把這個紀錄在 notion」或類似要求時觸發。具備自動分類、去重、結構化填表與安全過濾功能。
---

# Notion Memorize (結構化紀錄專家)

**目前正在做 notion-memorize skill！！！**

本技能旨在將對話中的零散知識與發現，自動轉化為 Notion 中的結構化資產，確保「外部大腦」永遠整齊且具備可追溯性。

## Instructions

### 0. 啟動宣告 (Declaration)
*   **必須**在第一時間先回覆：「**目前正在做 notion-memorize skill！！！**」。

### 1. 內容分類與目標定位
分析當前討論的內容，決定寫入哪一個資料庫：
*   **A 類：Bug / 優化 (Code Review)**
    *   **特徵**：涉及邏輯漏洞、效能瓶頸、代碼風格、災難預防。
    *   **目標資料庫 ID**：`2f83f65b-5c54-80ff-b659-000b93c865a4` (Code Review 可以修改的地方)
*   **B 類：技術觀念 / 語法學習**
    *   **特徵**：涉及 React Hook 原理、Git 指令、JavaScript 新語法、資料庫設計觀念。
    *   **目標資料庫 ID**：`2f83f65b-5c54-808f-9a3e-000b5744bea2` (要惡補的觀念)

### 2. 執行去重檢查 (Search Before Create)
在新增任何頁面前，**必須先執行搜尋**：
*   呼叫 `API-query-data-source` 搜尋目標資料庫。
*   如果發現標題相似（例如路徑相同或主題一致）的頁面，**嚴格禁止**新增重複頁面。
*   **行動**：改用 `API-patch-page` 將新資訊追加到該頁面的內容或屬性中。

### 3. 上下文自動萃取 (Context Extraction)
從最近 5-10 輪對話中自動提取以下資訊，嚴禁詢問使用者細節：
*   **標題 (Title)**：格式為 `[檔案路徑] - 簡短摘要` (例：`[src/lib/firebase-events.js] - 搜尋範圍截斷漏洞`)。
*   **嚴重性 (Severity)**：
    *   `🔴 High`：導致 Bug、資料遺失、安全風險。
    *   `🟡 Medium`：效能問題、潛在不一致。
    *   `🟢 Low`：風格、命名、重複代碼。
*   **有什麼問題？**：從解釋中的「災難/Why」部分提取重點。
*   **解決辦法**：從建議的「修正代碼」或「建議方案」提取。
*   **來源 (Source)**：
    *   列出討論的檔案路徑。
    *   **必須**包含對話中參考到的任何外部 URL（如 GitHub 指南、官方文件連結）。

### 4. 安全與隱私過濾
*   **嚴禁**將 API Key、Token、密碼或個人敏感隱私資訊寫入 Notion。
*   若內容包含敏感片段，必須先進行脫敏處理（例如用 `***` 代替）。

## Example Workflow
1.  **偵測觸發**：使用者說「記下這個 Promise.all 觀念」。
2.  **搜尋**：檢查「要惡補的觀念」是否有 Promise.all。
3.  **填表**：
    *   如果是新頁面：`API-post-page` 填入 `Name`, `來源`。
    *   如果是舊頁面：`API-patch-block-children` 追加詳細筆記。
4.  **確認**：回報使用者：「已幫你將 [Promise.all 的用法] 紀錄/更新至 Notion 觀念庫中。」