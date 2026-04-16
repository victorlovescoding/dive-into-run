# Implementation Plan: Post Edit Dirty Check

**Branch**: `020-post-edit-dirty-check` | **Date**: 2026-04-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-post-edit-dirty-check/spec.md`

## Summary

在「編輯文章」對話框（`ComposeModal.jsx`）加入 dirty check：當使用者未對標題或內文做任何變更時，「更新」按鈕必須呈停用狀態。行為需對齊 `EventEditForm.jsx` 已建立的慣例（`disabled={!isDirty || !!isSubmitting}`、送出中文字切換為「更新中…」）。同時將 `updatePost()` 的寫入值改為「前後 trim 後」的 title/content，確保 dirty 判定與實際資料庫內容語意一致。新增文章流程（`isEditing=false`）不受影響。

**技術切入點**：

1. `src/components/ComposeModal.jsx`：新增 `originalTitle` / `originalContent` / `isSubmitting` props；computed `isDirty`；按鈕 `disabled` 與動態文字。
2. `src/app/posts/page.jsx` 與 `src/app/posts/[id]/PostDetailClient.jsx`：進入編輯時快照原始值傳入、包住 `updatePost` 的 `isSubmitting` state。
3. `src/lib/firebase-posts.js`：`updatePost` 寫入前 `trim` title/content。

## Technical Context

**Language/Version**: JavaScript (ES6+) with JSDoc + `checkJs: true`（無 TypeScript）
**Primary Dependencies**: Next.js 15 (App Router)、React 19、Firebase v9+ (Firestore)
**Storage**: Firestore — `posts` collection 的 `title`、`content` 欄位
**Testing**: Vitest (unit + integration, jsdom)、Playwright (E2E, Chromium)、`@testing-library/user-event`
**Target Platform**: Web (Next.js SSR + CSR)
**Project Type**: Web application（Next.js App Router，無 backend/frontend 拆分）
**Performance Goals**: N/A（此變更為純 client-side 表單 gate，無 latency 要求）
**Constraints**: 不得破壞現有新增文章流程；trim 語意必須「dirty 比較 = 實際寫入值」一致
**Scale/Scope**: 單一共用對話框元件 + 2 個呼叫點 + 1 個 service function；預估 ~50 行 production code 變更

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 原則             | 狀態    | 備註                                                                                        |
| ---------------- | ------- | ------------------------------------------------------------------------------------------- |
| I. SDD/TDD       | ✅ PASS | tests 先行（integration 為主涵蓋按鈕狀態互動；unit 包 `updatePost` trim 行為）              |
| II. 嚴格服務層   | ✅ PASS | `updatePost` 仍位於 `src/lib/firebase-posts.js`，UI 不直接 import Firebase SDK              |
| III. UX 一致性   | ✅ PASS | 刻意對齊 `EventEditForm` 慣例（`disabled={!isDirty \|\| !!isSubmitting}`、「更新中…」文字） |
| IV. 效能與併發   | ✅ N/A  | 純 UI gate，無共享資源寫入                                                                  |
| V. 程式碼品質    | ✅ PASS | MVP 思維：只在 ComposeModal 新增最小 props，不抽象 shared hook                              |
| VI. 現代化標準   | ✅ PASS | JSDoc `{object}` 小寫、@param/@property 帶描述、分號、單引號                                |
| VII. 安全與機密  | ✅ N/A  | 無 secrets 相關變更                                                                         |
| VIII. 代理人互動 | ✅ PASS | 本階段僅產出 plan 文件；實作前於 `/speckit.tasks` + `/speckit.implement` 再取得明確確認     |
| IX. 絕對編碼鐵律 | ✅ PASS | dirty 判定為 derived value，置於 function body（非 JSX IIFE）；不需 `eslint-disable`        |

**結論**：無違規，無需 Complexity Tracking 表。

## Project Structure

### Documentation (this feature)

```text
specs/020-post-edit-dirty-check/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output — 設計決策（無 NEEDS CLARIFICATION）
├── data-model.md        # Phase 1 output — UI state shape
├── quickstart.md        # Phase 1 output — 手動驗證步驟
├── spec.md              # 既存 feature spec
└── tasks.md             # /speckit.tasks 產出（非本 command 輸出）
```

> 本 feature 無外部介面（純內部 UI 行為），依 template 指引**不產出** `contracts/` 目錄。

### Source Code (repository root)

```text
src/
├── components/
│   └── ComposeModal.jsx              # [修改] 新增 originalTitle/originalContent/isSubmitting props；dirty 判定；按鈕 disabled + 動態文字
├── app/
│   └── posts/
│       ├── page.jsx                  # [修改] 列表頁編輯入口：快照原始值、包 isSubmitting state、trim 送出
│       └── [id]/
│           └── PostDetailClient.jsx  # [修改] 詳情頁編輯入口：同上
└── lib/
    └── firebase-posts.js             # [修改] updatePost 寫入前 trim(title), trim(content)

specs/020-post-edit-dirty-check/tests/
├── unit/
│   └── update-post-trim.test.js      # updatePost 實際寫入 Firestore 的值為 trim 後結果（mock firestore）
├── integration/
│   ├── compose-modal-dirty.test.jsx       # ComposeModal 在 isEditing=true 時的 dirty gate 行為
│   ├── posts-page-edit-dirty.test.jsx     # /posts 列表頁完整編輯流程（user-event）
│   └── post-detail-edit-dirty.test.jsx    # /posts/[id] 詳情頁完整編輯流程
└── e2e/
    └── post-edit-dirty.spec.js       # happy path：打開編輯 → 不改 → 送不出；改再改回 → 回到停用
```

**Structure Decision**: 遵循既有單一 Next.js App Router 專案結構（CLAUDE.md「Key Directories」定義）。此 feature 涉及 3 個 production source files + 1 個 service function，測試分層 60/20/20（integration 為主，對應共用 ComposeModal 的互動行為；unit 只覆蓋 service layer 的 trim 行為；E2E 只覆蓋 happy path 防呆）。

## Coding Standards References

實作時 MUST 遵守以下（源：`.claude/references/coding-standards.md`）：

- **JSDoc**：所有修改後的 exported function / React component props 必須有 `@param` + 描述；`@typedef` 使用小寫 `{object}`
- **React/JSX**：dirty 判定為 derived value，**不可**在 JSX 內寫 IIFE 或複雜 ternary；抽成函式內變數
- **Firebase 隔離**：`updatePost` 的 trim 必須在 `src/lib/firebase-posts.js` 內完成，UI 層**不得**呼叫 trim 後再 call（避免兩層 trim 邏輯漂移）— 但 dirty 比較在 UI 層仍需 trim（因 UI 需要即時判斷按鈕狀態，不能每次 keystroke call service）
- **CSS Modules**：沿用既有 `ComposeModal.module.css`，不新增 class
- **禁止** `fireEvent`、`container.querySelector`；測試一律 `userEvent.setup()` + `screen.getByRole`
- **cSpell**：若新增專案特有詞（如 `isDirty`）已存在於一般英文字典，不需加入 `cspell.json`

## Complexity Tracking

> 無違反 Constitution 的複雜度；此區留空。

---

## Phase 0 — Research

見 [`research.md`](./research.md)。由於 spec 已於 2026-04-16 session 完成 clarifications，無 `NEEDS CLARIFICATION` 項目；research.md 專注於**設計決策記錄**（state ownership、trim 策略落點、pattern alignment）。

## Phase 1 — Design & Contracts

- [`data-model.md`](./data-model.md)：Post Draft State 與 Original Post Snapshot 的 UI state 結構（非 Firestore schema 變更）
- [`quickstart.md`](./quickstart.md)：人工驗收步驟清單，對照 spec 的 Acceptance Scenarios 與 Edge Cases
- **Contracts**：Skip — 純內部 UI gate，無新增 HTTP / Firestore / public API

Phase 2（tasks.md）由 `/speckit.tasks` 另行產出，不在本 command 輸出範圍。

---

## Artifacts Generated

- [x] `/specs/020-post-edit-dirty-check/plan.md`（本檔）
- [x] `/specs/020-post-edit-dirty-check/research.md`
- [x] `/specs/020-post-edit-dirty-check/data-model.md`
- [x] `/specs/020-post-edit-dirty-check/quickstart.md`
- [x] Agent context refreshed via `.specify/scripts/bash/update-agent-context.sh claude`

## Post-Design Constitution Re-check

設計定稿後重新檢視 9 條原則：**全部維持 PASS**。state ownership（parent 持有 original snapshot 與 isSubmitting，ComposeModal 內部僅計算 isDirty）未引入新的 abstraction 或 shared hook，符合 Principle V「MVP 思維、拒絕過度設計」。
