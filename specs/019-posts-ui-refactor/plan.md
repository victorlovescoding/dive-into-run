# Implementation Plan: Posts 頁面 UI 重新設計

**Branch**: `019-posts-ui-refactor` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-posts-ui-refactor/spec.md`

## Summary

Posts 列表頁與詳文頁從開發樣式（藍/紅邊框、固定右下角 ➕ 按鈕）升級為社群風格的現代化介面：平坦分線風格卡片、內容摘要展開機制、Feed 頂部假輸入框發文入口、CommentCard 統一留言卡片、骨架屏載入狀態。**純 UI/UX 重構**，不變更任何業務邏輯（FR-024）。

## Technical Context

**Language/Version**: JavaScript (ES6+), React 19, Next.js 15 (App Router)
**Primary Dependencies**: React 19, Next.js 15, Firebase v9+ (Firestore), CSS Modules + Tailwind CSS 4
**Storage**: Firestore（補存 `authorName` 欄位 + 舊資料 migration）
**Testing**: Vitest (unit/integration, jsdom), Playwright (E2E, Chromium)
**Target Platform**: Web（桌面 1280px+ & 行動裝置 375px）
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: 骨架屏替代空白載入、展開動畫 200-300ms、無限滾動預載 300px margin
**Constraints**: 純 UI 重構（FR-024），不新增業務邏輯。例外：`createPost` 補存 `authorName`（修正遺漏，非新功能）
**Scale/Scope**: 2 頁面（列表頁 + 詳文頁）、4 個新元件、2 個 CSS 模組重寫

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 原則             | 狀態    | 說明                                                                        |
| ---------------- | ------- | --------------------------------------------------------------------------- |
| I. SDD/TDD       | ✅ PASS | spec.md 已完成，tasks 階段將執行 TDD                                        |
| II. 服務層隔離   | ✅ PASS | `createPost` 補一行 `authorName`（修正遺漏）；UI 不直接 import Firebase SDK |
| III. UX 一致性   | ✅ PASS | 正體中文、IntersectionObserver 無限滾動沿用                                 |
| IV. 效能與併發   | ✅ PASS | 不新增 transaction，既有機制不變                                            |
| V. 程式碼品質    | ✅ PASS | CSS Modules、const 優先、JSDoc on exports                                   |
| VI. 現代化標準   | ✅ PASS | JS only、Airbnb spirit、JSDoc 紀律                                          |
| VII. 安全        | ✅ PASS | 不涉及機密資料                                                              |
| VIII. 代理人協議 | ✅ PASS | 修改前確認、不臆測                                                          |
| IX. 編碼鐵律     | ✅ PASS | No logic in JSX、No eslint-disable a11y、Meaningful JSDoc                   |

**無違規，不需要 Complexity Tracking。**

## Project Structure

### Documentation (this feature)

```text
specs/019-posts-ui-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── ui-contracts.md  # Phase 1 output - UI component contracts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/posts/
│   ├── page.jsx                    # 列表頁 — 重構卡片渲染、加入 ComposePrompt、使用 PostCard
│   ├── posts.module.css            # 列表頁樣式 — 完全重寫
│   └── [id]/
│       ├── page.jsx                # 詳文頁 server component（不變）
│       ├── PostDetailClient.jsx    # 詳文頁 client — 視覺更新、使用 CommentCard
│       └── postDetail.module.css   # 詳文頁樣式 — 完全重寫
├── components/
│   ├── PostCard.jsx                # [NEW] 社群風格文章卡片（含截斷/展開）
│   ├── PostCard.module.css         # [NEW] PostCard 樣式
│   ├── PostCardSkeleton.jsx        # [NEW] 文章卡片骨架屏
│   ├── PostCardSkeleton.module.css # [NEW] 骨架屏樣式
│   ├── ComposePrompt.jsx           # [NEW] Feed 頂部假輸入框
│   ├── ComposePrompt.module.css    # [NEW] ComposePrompt 樣式
│   ├── ComposeModal.jsx            # [NEW] 發文 Modal（<dialog>）
│   ├── ComposeModal.module.css     # [NEW] ComposeModal 樣式
│   ├── CommentCard.jsx             # 既有 — 微調以配合新視覺風格
│   └── CommentCard.module.css      # 既有 — 微調
└── lib/
    └── firebase-posts.js            # createPost 補存 authorName（一行）

specs/019-posts-ui-refactor/tests/
├── unit/
│   └── PostCard.test.jsx           # PostCard 截斷/展開邏輯
├── integration/
│   ├── PostFeed.test.jsx           # 列表頁整合測試
│   ├── PostDetail.test.jsx         # 詳文頁整合測試
│   └── ComposeModal.test.jsx       # 發文 Modal 整合測試
└── e2e/
    └── posts-ui.spec.js            # E2E 關鍵路徑
```

**Structure Decision**: 延續既有 Next.js App Router 結構，新增 4 個共用元件（PostCard、PostCardSkeleton、ComposePrompt、ComposeModal），重寫 2 個 CSS 模組（posts.module.css、postDetail.module.css）。

## Design Decisions

### D1: PostCard 元件抽取

**決定**: 從 `page.jsx` 內聯渲染抽取為獨立 `PostCard` 元件。

**理由**:

- 列表頁與詳文頁需要同一套視覺風格（FR-015）
- 卡片含截斷/展開邏輯、作者資訊、操作選單 — 複雜度已超過 inline 渲染合理範圍
- 骨架屏需要鏡像卡片結構

**替代方案被拒**: 繼續 inline → 無法跨頁共用視覺、JSX 邏輯過重違反 IX.

### D2: `<dialog>` 原生 Modal

**決定**: 發文 Modal 使用 HTML `<dialog>` 元素的 `showModal()` API。

**理由**:

- 原生支援 Escape 關閉、backdrop 點擊、focus trap、inert（背景不可互動）
- 無需第三方 modal library，符合 MVP 思維
- 所有現代瀏覽器已支援（Chrome 37+, Safari 15.4+, Firefox 98+）

**替代方案被拒**: 自建 portal + overlay → 需手工處理 focus trap、scroll lock、a11y，overengineering。

### D3: 內容展開動畫方案

**決定**: 截斷態渲染 `content.slice(0, 150) + '......'`；展開態渲染完整內容。使用 CSS `max-height` transition 搭配 JS `scrollHeight` 量測。

**實作方式**:

1. 內容容器設 `overflow: hidden; transition: max-height 250ms ease`
2. 截斷態：`max-height` 設為截斷文字高度（由 ref 量測）
3. 點擊展開：`max-height` 設為 `scrollHeight`
4. transition 結束後移除 `max-height` 限制（避免後續 resize 問題）

**理由**:

- `max-height` transition 是最廣泛支援的高度動畫方案
- 搭配 `scrollHeight` 量測可精確動畫，不會有 `max-height: 9999px` 的計時偏差
- `transitionend` event 清除 `max-height` 確保後續內容自適應

**替代方案被拒**: CSS grid `0fr→1fr` → 不適用於「部分可見→全部可見」場景；Web Animations API → 增加複雜度無顯著收益。

### D4: 相對時間格式化

**決定**: 複用 `src/lib/notification-helpers.js` 的 `formatRelativeTime()`。

**理由**: 已實作「剛剛 / N 分鐘前 / N 小時前 / N 天前 / M/D」格式，完全符合 spec 需求（Assumptions: 沿用現有實作邏輯）。

### D5: 骨架屏動畫

**決定**: CSS Modules 實作 shimmer 動畫（`@keyframes shimmer` + `linear-gradient` + `background-size: 200%`）。

**理由**:

- 純 CSS，無 JS runtime 成本
- shimmer 是社群平台標準載入模式（Facebook, LinkedIn）
- CSS Modules 確保樣式隔離

### D6: Feed 置中窄欄

**決定**: 列表頁外層容器 `max-width: 680px; margin: 0 auto`，與 padding 配合響應式。

**理由**: FR-004a 指定 640-680px，取上限 680px 留給內容更多呼吸空間。

### D7: `createPost` 補存 `authorName` + 舊資料 migration

**決定**: `createPost` 補一行 `authorName: user.name || '匿名使用者'`（比照 `addComment` 做法），並寫一次性 migration script 回填既有文章。

**理由**:

- FR-002 要求卡片顯示作者名稱，但 post document 從未存過 `authorName`（`addComment` 和 `createEvent` 都有存，是 `createPost` 的遺漏）
- 改動極小（一行），不是新功能而是修正資料一致性
- Migration script 用 `authorUid` 查 `users` collection 回填 name，資料量小（~20 筆），一次性跑完
- 比 runtime fallback 查詢乾淨：UI 直接讀 `post.authorName`，不用每次載入多 N 個 query

**PostCard fallback**: `post.authorName ?? '跑者'`（防禦性，以防 migration 遺漏或 users 資料不全）

## Existing Code Impact Analysis

### 需完全重寫的檔案

| 檔案                                  | 原因                                           |
| ------------------------------------- | ---------------------------------------------- |
| `src/app/posts/posts.module.css`      | 藍色邊框 dev style → 社群風格，全部 class 失效 |
| `src/app/posts/postDetail.module.css` | 紅色邊框 dev style → 社群風格，全部 class 失效 |

### 需大幅修改的檔案

| 檔案                                      | 修改範圍                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/app/posts/page.jsx`                  | JSX 結構重構：引入 PostCard/ComposePrompt/ComposeModal/PostCardSkeleton，移除 inline 卡片渲染、移除固定 FAB ➕ 按鈕 |
| `src/app/posts/[id]/PostDetailClient.jsx` | 視覺對齊：文章區域使用同風格、留言改用 CommentCard、留言輸入區配合新風格                                            |

### 需微調的檔案

| 檔案                                    | 修改範圍                                          |
| --------------------------------------- | ------------------------------------------------- |
| `src/components/CommentCard.jsx`        | 確認卡片視覺在詳文頁 context 下一致（可能無需改） |
| `src/components/CommentCard.module.css` | 可能微調間距/配色以配合新風格                     |

### 不變更的檔案

| 檔案                              | 原因                                                |
| --------------------------------- | --------------------------------------------------- |
| `src/lib/firebase-posts.js`       | 僅補一行 `authorName`（修正遺漏）+ migration script |
| `src/lib/notification-helpers.js` | 只複用 `formatRelativeTime`，不修改                 |
| `src/app/posts/[id]/page.jsx`     | Server component，OG metadata 邏輯不變              |
| `src/contexts/AuthContext.jsx`    | 不變更                                              |
| `src/contexts/ToastContext.jsx`   | 不變更                                              |

## Risk Assessment

| 風險                                         | 影響      | 緩解                                                                                        |
| -------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| 內容展開動畫在不同內容長度下表現不一致       | 視覺體驗  | `transitionend` 後移除 `max-height`，避免長文被截                                           |
| 既有功能回歸（按讚、刪除、無限滾動）         | 功能破壞  | 整合測試 + E2E 覆蓋所有 FR-023 項目                                                         |
| `<dialog>` backdrop 點擊在 Safari 需特殊處理 | UX 一致性 | Safari 15.4+ 支援 `<dialog>`，backdrop click 需 `::backdrop` pseudo-element + click handler |
| PostCard 元件抽取後 state 管理變複雜         | 可維護性  | 卡片展開狀態為 local state（per-card），不需要 context 或 global store                      |
