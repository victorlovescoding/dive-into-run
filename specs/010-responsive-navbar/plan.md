# Implementation Plan: 響應式導覽列 (RWD Navbar)

**Branch**: `010-responsive-navbar` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-responsive-navbar/spec.md`

## Summary

重構現有內聯導覽列為獨立 client component，實現 mobile-first RWD 設計：

- **手機版（<768px）**：漢堡按鈕 + 右側滑出面板（含 overlay、body scroll lock）
- **桌面版（≥768px）**：水平導覽列 + 使用者頭像下拉選單（僅含登出）
- **共通**：active link highlight、skeleton loading、sticky 定位、a11y 合規
- **Metadata 修正**：標題 → "Dive Into Run"、語言 → `zh-Hant-TW`

技術方案：CSS-only 響應式切換（media queries），CSS transform 滑出動畫，`usePathname()` 偵測 active route。

## Technical Context

**Language/Version**: JavaScript (ES6+), JSDoc `checkJs: true`
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+ (Auth — 透過 AuthContext)
**Storage**: N/A（純 UI 功能，認證狀態來自現有 AuthContext）
**Testing**: Vitest (unit/integration, jsdom), Playwright (E2E, Chromium)
**Target Platform**: Web（320px–1920px 響應式）
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: 動畫 60fps、無 layout shift（skeleton loading 佔位）
**Constraints**: Sticky navbar、body scroll lock on mobile panel、WCAG a11y 合規
**Scale/Scope**: 5 個導覽連結 + 認證 UI、單一 Navbar 元件目錄

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle             | Status  | Notes                                                                                                                                                      |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. SDD/TDD            | ✅ PASS | Feature spec 已完成，實作將遵循 Red-Green-Refactor                                                                                                         |
| II. Service Layer     | ✅ PASS | Navbar 透過 AuthContext 取得使用者狀態；sign-in/sign-out 邏輯需封裝至 `src/lib/` 服務層（現有 LoginButton/SignOutButton 直接 import Firebase SDK，需修正） |
| III. UX & Consistency | ✅ PASS | UI 文字使用正體中文                                                                                                                                        |
| IV. Performance       | N/A     | 此功能無 Firestore 資料操作                                                                                                                                |
| V. Code Quality       | ✅ PASS | CSS Modules + Tailwind、JSDoc、JavaScript only、MVP approach                                                                                               |
| VI. Modern Standards  | ✅ PASS | const/destructuring、Airbnb style、JSDoc 完整、React 19 無需 import React                                                                                  |
| VII. Security         | N/A     | 不涉及機密資訊                                                                                                                                             |
| VIII. Agent Protocol  | ✅ PASS | 修改前確認                                                                                                                                                 |
| IX. Iron Rules        | ✅ PASS | 複雜邏輯抽為 helper/子元件、修復 a11y 結構而非 eslint-disable                                                                                              |

### Post-Phase 1 Re-check

| Principle         | Status  | Notes                                                                                          |
| ----------------- | ------- | ---------------------------------------------------------------------------------------------- |
| I. SDD/TDD        | ✅ PASS | 資料模型、元件契約已定義，可進入 TDD                                                           |
| II. Service Layer | ✅ PASS | 新增 `src/lib/firebase-auth-helpers.js` 封裝 signIn/signOut，Navbar 不直接 import Firebase SDK |
| V. Code Quality   | ✅ PASS | 單一 Navbar 目錄，CSS Modules 管理樣式，無過度拆分                                             |
| IX. Iron Rules    | ✅ PASS | NavItem 配置抽為常數、active 判斷抽為 helper、JSX 僅負責 view                                  |

## Project Structure

### Documentation (this feature)

```text
specs/010-responsive-navbar/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 — 技術決策與替代方案
├── data-model.md        # Phase 1 — 元件狀態與配置模型
├── quickstart.md        # Phase 1 — 開發快速指南
├── contracts/
│   └── navbar-contract.md  # Phase 1 — 元件介面契約
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── Navbar/
│       ├── Navbar.jsx           # 主元件：響應式導覽列（'use client'）
│       └── Navbar.module.css    # 所有樣式（media queries 處理響應式）
├── lib/
│   └── firebase-auth-helpers.js # 新增：signInWithGoogle(), signOutUser()
├── app/
│   ├── layout.jsx               # 修改：引入 Navbar、更新 metadata + lang
│   └── globals.css              # 修改：移除 .main-nav 樣式 + <hr>

specs/010-responsive-navbar/tests/
├── unit/                         # helper 函式單元測試
├── integration/                  # Navbar 元件整合測試
└── e2e/                          # 響應式行為 E2E 測試
```

**Structure Decision**: 採用單一 `src/components/Navbar/` 目錄，起始為 `Navbar.jsx` + `Navbar.module.css`。若 Navbar.jsx 超過 ~200 行，再拆分 `MobileDrawer.jsx`、`UserMenu.jsx` 等子元件。遵循 Constitution V MVP 原則。

## Complexity Tracking

> No violations — all gates passed. No justifications needed.
