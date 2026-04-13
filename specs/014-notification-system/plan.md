# Implementation Plan: 通知系統 (Notification System)

**Branch**: `014-notification-system` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-notification-system/spec.md`

## Summary

為社群跑步平台新增通知系統，讓使用者在活動被修改/取消、文章收到新留言時即時收到通知。技術上採用頂層 Firestore `notifications` collection + 雙 `onSnapshot` 監聽器架構（未讀計數 + 最新通知），搭配 React Context 管理全域通知狀態。UI 包含 Nav 鈴鐺圖示 + 未讀徽章、Facebook 風格下拉面板（全部/未讀分頁 + 分頁載入 + 無限滾動）、點擊導航、新通知 toast 提示。

## Technical Context

**Language/Version**: JavaScript (ES6+) with JSDoc type checking (`checkJs: true`)
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+ (Firestore)
**Storage**: Cloud Firestore — 新增頂層 `notifications` collection
**Testing**: Vitest (unit/integration, jsdom), Playwright (E2E, Chromium only)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (Next.js App Router, SSR + CSR hybrid)
**Performance Goals**: 通知送達 < 30s (SC-001)、面板開啟 < 1s (SC-002)、批次載入 < 2s (SC-006)
**Constraints**: Client-side only（無 Cloud Functions）、即時更新 via onSnapshot、Firestore batch 上限 500
**Scale/Scope**: 社群跑步 app，~100-1000 使用者，單次活動通知最多 = maxParticipants - 1

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status | Notes                                                                    |
| ----------------------------- | ------ | ------------------------------------------------------------------------ |
| I. SDD/TDD                    | ✅     | spec.md 完整，tests 於實作前撰寫                                         |
| II. Service Layer             | ✅     | 新增 `firebase-notifications.js` 在 `src/lib/`，UI 不直接碰 Firebase SDK |
| III. UX & Consistency         | ✅     | 中文 UI、IntersectionObserver 無限滾動（FR-015）、無地圖元件             |
| IV. Performance & Concurrency | ✅     | `writeBatch` 批次建立通知、`serverTimestamp()` 時間一致性                |
| V. Code Quality               | ✅     | MVP 思維（不過度設計）、JavaScript only、CSS Modules                     |
| VI. Modern Standards          | ✅     | 全部匯出函式有 JSDoc、遵循 formatting 鐵律                               |
| VII. Security                 | ✅     | Firestore security rules 限制讀寫權限、無秘密資料                        |
| VIII. Agent Protocol          | ✅     | 遵循 spec → plan → tasks 流程                                            |
| IX. Iron Rules                | ✅     | 不在 JSX 內放邏輯、不 eslint-disable a11y、meaningful JSDoc              |

**Gate Result**: PASS — 無違規項目

### Post-Phase 1 Re-check

| Principle                     | Status | Notes                                                                             |
| ----------------------------- | ------ | --------------------------------------------------------------------------------- |
| II. Service Layer             | ✅     | 確認：通知建立/查詢/更新全封裝在 `firebase-notifications.js`，UI 層僅呼叫匯出函式 |
| III. UX & Consistency         | ✅     | 確認：無限滾動用 IntersectionObserver + Firestore cursor (`startAfter`)           |
| IV. Performance & Concurrency | ✅     | 確認：`writeBatch` 批次通知建立；未讀計數 `onSnapshot` limit 100 控制資料量       |
| IX. Iron Rules                | ✅     | 確認：相對時間 / 訊息組合 / 導航 URL 皆抽為 helper 函式，不在 JSX 內計算          |

**Post-Design Gate Result**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/014-notification-system/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: 技術決策研究
├── data-model.md        # Phase 1: 資料模型 + Security Rules
├── quickstart.md        # Phase 1: 實作指南
├── contracts/
│   ├── notification-service.md    # Service layer API 合約
│   └── notification-components.md # Components + Context 介面合約
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── firebase-notifications.js   # [NEW] 通知 service layer
│   └── notification-helpers.js     # [NEW] 純函式：訊息、時間、URL
├── contexts/
│   └── NotificationContext.jsx     # [NEW] 全域通知狀態 + 監聽器
├── components/
│   └── Notifications/
│       ├── NotificationBell.jsx        # [NEW] 鈴鐺 + 徽章
│       ├── NotificationBell.module.css
│       ├── NotificationPanel.jsx       # [NEW] 下拉面板
│       ├── NotificationPanel.module.css
│       ├── NotificationItem.jsx        # [NEW] 單則通知列
│       ├── NotificationItem.module.css
│       ├── NotificationToast.jsx       # [NEW] Toast 提示
│       └── NotificationToast.module.css
├── app/
│   ├── layout.jsx                      # [MOD] 加入 NotificationProvider
│   ├── events/[id]/
│   │   └── eventDetailClient.jsx       # [MOD] 活動編輯/刪除觸發通知
│   └── posts/[id]/
│       └── PostDetailClient.jsx        # [MOD] 留言觸發通知 + scroll-to-comment
└── components/Navbar/
    ├── Navbar.jsx                      # [MOD] 加入 NotificationBell
    └── Navbar.module.css               # [MOD] Bell 區域 flex 排版

firestore.rules                         # [MOD] 新增 notifications rules
firestore.indexes.json                  # [MOD] 新增 composite indexes

specs/014-notification-system/tests/
├── unit/                  # notification-helpers 純函式測試
├── integration/           # NotificationBell, Panel, Context 整合測試
└── e2e/                   # 完整通知流程 E2E 測試
```

**Structure Decision**: 遵循既有架構 — service layer 在 `src/lib/`、Context 在 `src/contexts/`、元件在 `src/components/` 下新建 `Notifications/` 子資料夾。測試在 `specs/014-notification-system/tests/`。

## Complexity Tracking

> 無違規需辯護。所有設計決策均在 Constitution 範圍內。
