---
name: workflow-step-1-specify
description: 執行開發流程的第一步：需求定義。當收到 `/speckit.specify` 指令或 `workflow-orchestrator` 指示進入 Specify 階段時使用。負責引導使用者釐清需求，並產出 spec.md。
---

# Step 1: Specify Requirements

此 Skill 負責協助使用者將模糊的想法轉化為具體的規格文件 (`spec.md`)。

## 執行流程

0.  **狀態報告 (Start)**:
    - 請第一時間回覆：「目前執行 workflow-step-1-specify skill」。

1.  **啟動 Brainstorming**:
    *   **Action**: 呼叫 `activate_skill` 啟用 `brainstorming` skill。
    *   **Goal**: 透過問答釐清使用者的核心需求、目標受眾與關鍵功能。

2.  **設計 Frontend (若涉及 UI)**:
    *   **Action**: 呼叫 `activate_skill` 啟用 `frontend-design` skill。
    *   **Goal**: 討論 UI 佈局、互動模式與視覺風格。

3.  **建立 Spec 檔案**:
    *   **Action**: 確認功能名稱 (Feature Name)，例如 `event-filtering`。
    *   **Action**: 建立目錄 `specs/<feature-name>/`。
    *   **Action**: 撰寫 `specs/<feature-name>/spec.md`。

## Spec.md 結構範本

```markdown
# [Feature Name] Specification

## 1. Background & Problem
(為什麼要做這個功能？解決什麼問題？)

## 2. Goals
- [ ] 目標 1
- [ ] 目標 2

## 3. User Stories
- As a [User], I want to [Action], so that [Benefit].

## 4. UI/UX Design
(描述介面元件、操作流程，可參考 frontend-design 的產出)

## 5. Technical Constraints
(Firebase 限制、Next.js 限制等)

## 6. Out of Scope
(這次不做什麼)
```

將執行：Step 2: Clarify 階段。

完成 `spec.md` 後，請提示使用者：
> Spec 已建立。請輸入「繼續」以進入 Step 2: Clarify 階段。

同時回覆：「workflow-step-1-specify skill 已執行完畢」。