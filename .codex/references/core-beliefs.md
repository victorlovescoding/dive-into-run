# Core Beliefs

> Agent-facing HOW decision framework for this repo.
> 這不是 coding standards 文件；具體 rules 與 gates 請看 `.codex/rules/*` 和 `.codex/references/quality-gates.md`。
> Workflow、Engineer + Reviewer、lifecycle 請看 `docs/superpowers/workflow.md`。

當 agent 需要在多個合理做法之間取捨、review tradeoff、或判斷 refactor 時該保留什麼，用這份文件決定 HOW。

## 1. Repo-Visible Truth

長期專案事實要放在 repo 可見文件，不放在對話記憶或私人假設。後續 agent 需要知道的事，就放進正確 source of truth，並從入口地圖連過去。

## 2. Spec First, Then Plan

先分清 WHAT/WHY，再決定 HOW。先確認產品意圖，再讓 plan 決定資料流、檔案責任、驗證策略、風險與停損條件。

## 3. Small Task Slices, Paired Review

任務切成可獨立 review 的小片段，且 owned files 要清楚。每個 slice 都需要 Engineer、Reviewer、驗收標準與明確驗證，才算完成。

## 4. Evidence Before Claims

不要只靠意圖宣稱 fixed、complete、safe 或 passing。任何完成宣告都需要 fresh evidence：diff inspection、targeted checks、相關驗證或 CI。

短回饋迴圈是好事：早點找出落差、快速修正、讓工作貼近證據。但這不代表可以繞過 pre-commit、protected branch、PR workflow、Reviewer PASS、fresh verification 或 CI。

## 5. Mechanical Enforcement Over Documentation

文件只能引導；可重複執行的防線才可靠。若一條規則重要到應該反覆阻擋壞改動，優先做成 lint、dependency-cruiser、script、workflow 或 CI。

## 6. Boundaries Are Product Infrastructure

Layer boundaries、verification boundaries、runtime ownership、compatibility facades 都是產品基礎建設。除非 plan 明確改架構，否則 refactor 時要保留這些邊界。

## 7. Context Is Scarce

入口文件保持像地圖，不要塞成手冊。深層 reference 只在相關時載入；handoff 要讓新 session 能從文件續接，而不是考古整段對話。

## 8. Prefer Boring, Inspectable Tech

先選簡單、明確、本機可檢查的機制，再考慮聰明抽象。新增 tool、wrapper 或 framework 必須值得它帶來的操作成本。

## 9. Findings Become Code or Debt

Review finding、bug、audit gap 最後要變成已實作修正，或有 owner、evidence、trigger condition 的 debt。重要發現不能只留在對話裡。
