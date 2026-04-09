# Implementation Plan: 使用者公開檔案頁面 (Public Profile)

**Branch**: `012-public-profile` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-public-profile/spec.md`

## Summary

建立 `/users/[uid]` 公開檔案頁面，顯示跑者的頭像、名稱、簡介、加入日期、統計數據（開團數 / 參團數 / 累計公里數）和主辦活動列表。同時讓全站使用者名稱/頭像可點擊跳轉至公開檔案，並在會員頁面新增簡介（Bio）編輯功能。

## Technical Context

**Language/Version**: JavaScript (ES6+), JSDoc `checkJs: true`
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+ (Firestore client SDK)
**Storage**: Firestore — `users/{uid}` (新增 `bio` 欄位), `events`, `stravaActivities`, `stravaConnections/{uid}`, `collectionGroup('participants')`
**Testing**: Vitest (Unit/Integration, jsdom), Playwright (E2E, Chromium)
**Target Platform**: Web (Desktop + Mobile responsive)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: 公開檔案頁面 < 2 秒載入 (SC-001)
**Constraints**: 無須登入即可瀏覽 (FR-007)、簡介 ≤ 150 字 (FR-006)、XSS 防護 (FR-009)
**Scale/Scope**: 單一新頁面 + 全站連結修改 + 會員頁 Bio 編輯

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status  | Notes                                                                                     |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| I. SDD/TDD                    | ✅ PASS | spec.md 已完成，plan 階段產出設計文件，tasks 階段寫失敗測試先                             |
| II. Strict Service Layer      | ✅ PASS | 新增 `src/lib/firebase-profile.js` 封裝所有 Firestore 查詢，UI 不直接 import Firebase SDK |
| III. UX & Consistency         | ✅ PASS | 正體中文、無限捲動用 IntersectionObserver + Firestore cursor、無地圖元件                  |
| IV. Performance & Concurrency | ✅ PASS | 統計數據為只讀聚合查詢，不涉及 runTransaction；Bio 更新為 setDoc merge                    |
| V. Code Quality               | ✅ PASS | MVP 思維 — 單一頁面 + 服務層 + 連結元件，無過度設計                                       |
| VI. Modern Standards          | ✅ PASS | const 優先、CSS Modules、JSDoc 完整標註                                                   |
| VII. Security                 | ✅ PASS | Bio 輸出用 React 自動轉義（防 XSS）、無機密暴露                                           |
| VIII. Agent Protocol          | ✅ PASS | 修改前確認、資訊誠實                                                                      |
| IX. Strict Coding             | ✅ PASS | No logic in JSX、No eslint-disable、Meaningful JSDoc                                      |

## Project Structure

### Documentation (this feature)

```text
specs/012-public-profile/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── firebase-profile-api.md
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── users/
│       └── [uid]/
│           ├── page.jsx              # Server component (generateMetadata + fetch user data)
│           ├── ProfileClient.jsx     # Client component (統計、活動列表、互動)
│           ├── ProfileHeader.jsx     # 頭像 + 名稱 + 簡介 + 加入日期
│           ├── ProfileStats.jsx      # 開團數 / 參團數 / 累計公里數
│           ├── ProfileEventList.jsx  # 主辦活動列表 (infinite scroll)
│           └── PublicProfile.module.css
├── components/
│   └── UserLink.jsx                  # 可複用的使用者名稱/頭像連結元件
│   └── UserLink.module.css
├── lib/
│   └── firebase-profile.js           # 公開檔案服務層
└── app/member/
    └── (Bio 編輯功能整合至現有 member page)

specs/012-public-profile/tests/
├── unit/
│   └── firebase-profile.test.js      # 服務層單元測試
├── integration/
│   ├── ProfilePage.test.jsx          # 公開檔案頁面整合測試
│   ├── BioEditor.test.jsx            # Bio 編輯整合測試
│   └── UserLink.test.jsx             # UserLink 元件整合測試
└── e2e/
    └── public-profile.spec.js        # E2E 關鍵路徑
```

**Structure Decision**: 採用 Next.js App Router 慣例，新頁面放 `src/app/users/[uid]/`。服務層新增 `firebase-profile.js` 集中公開檔案相關查詢。共用 `UserLink` 元件取代全站散落的作者名稱/頭像顯示。

## Constitution Check — Post-Design

_Re-check after Phase 1 design completion._

| Principle                     | Status  | Post-Design Notes                                                       |
| ----------------------------- | ------- | ----------------------------------------------------------------------- |
| I. SDD/TDD                    | ✅ PASS | data-model.md + contracts/ 完成，ready for /speckit.tasks               |
| II. Strict Service Layer      | ✅ PASS | `firebase-profile.js` 4 函式明確定義，UI 零直接 Firebase import         |
| III. UX & Consistency         | ✅ PASS | IntersectionObserver + Firestore cursor 分頁、正體中文                  |
| IV. Performance & Concurrency | ✅ PASS | `getAggregateFromServer` + `sum()` 避免全量讀取、`Promise.all` 平行查詢 |
| V. Code Quality               | ✅ PASS | 無過度設計 — 4 個服務函式、1 個共用元件、5 個頁面子元件                 |
| VI. Modern Standards          | ✅ PASS | JSDoc typedef 完整、CSS Modules、const 優先                             |
| VII. Security                 | ✅ PASS | React 自動轉義 bio 輸出、Firestore Rules 驗證 bio ≤ 150 字              |
| VIII. Agent Protocol          | ✅ PASS | 設計文件齊全，待使用者確認後進入 tasks                                  |
| IX. Strict Coding             | ✅ PASS | 子元件拆分避免 JSX 邏輯、JSDoc contract 明確                            |
