# Implementation Plan: 活動留言功能

**Branch**: `005-event-comments` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-event-comments/spec.md`

## Summary

在活動詳情頁路線圖下方新增留言區，支援瀏覽（無限捲動）、發表（浮動輸入框）、編輯（含歷史記錄）、刪除留言。以 Firestore 子集合 `events/{eventId}/comments` 儲存留言，`comments/{commentId}/history` 儲存編輯記錄。UI 沿用既有 Google Forms 風格 + 紫色 accent。

## Technical Context

**Language/Version**: JavaScript (ES6+), JSDoc type checking (checkJs: true)
**Primary Dependencies**: Next.js 15 (App Router), React 19, Firebase v9+ (Firestore)
**Storage**: Firestore — subcollections `events/{eventId}/comments`, `comments/{commentId}/history`
**Testing**: Vitest (unit/integration, jsdom), Playwright (E2E, Chromium)
**Target Platform**: Web (desktop + mobile browsers)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: 留言首次載入 <3s, 送出後 <3s 顯示, 載入更多 <2s
**Constraints**: 純 CSS 動畫（無動畫庫）、CSS Modules 為主、position fixed 浮動輸入框需 iOS safe area
**Scale/Scope**: 單一活動可有數百則留言，每次載入 15 則

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status | Evidence                                                                          |
| ----------------------------- | ------ | --------------------------------------------------------------------------------- |
| I. SDD/TDD                    | PASS   | spec.md 已定義完整 acceptance scenarios；tests 在 specs/005-event-comments/tests/ |
| II. Service Layer             | PASS   | 新建 `firebase-comments.js`，UI 不直接 import Firebase SDK                        |
| III. UX & Consistency         | PASS   | IntersectionObserver + Firestore cursor；正體中文                                 |
| IV. Performance & Concurrency | PASS   | updateComment 用 runTransaction；serverTimestamp()                                |
| V. Code Quality               | PASS   | MVP 思維（不維護 commentsCount）；JS + CSS Modules                                |
| VI. Modern Standards          | PASS   | JSDoc 完整定義、const/解構/結尾逗號                                               |
| VII. Security                 | PASS   | 無新增機密                                                                        |
| VIII. Agent Protocol          | PASS   | 實作前取得使用者確認                                                              |
| IX. Coding Iron Rules         | PASS   | 無 JSX 邏輯、無 eslint-disable a11y                                               |

## Project Structure

### Documentation (this feature)

```text
specs/005-event-comments/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── tests/
│   ├── unit/            # firebase-comments.test.js
│   ├── integration/     # comment UI tests
│   └── e2e/             # Playwright tests
└── test-results/
    ├── unit/
    ├── integration/
    └── e2e/
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── firebase-comments.js       # NEW: Service layer (7 functions)
│   └── event-helpers.js           # MODIFIED: +formatCommentTime, +formatCommentTimeFull
├── components/
│   ├── CommentSection.jsx         # NEW: 留言區容器
│   ├── CommentSection.module.css
│   ├── CommentCard.jsx            # NEW: 單則留言卡片
│   ├── CommentCard.module.css
│   ├── CommentCardMenu.jsx        # NEW: 三點選單
│   ├── CommentCardMenu.module.css
│   ├── CommentInput.jsx           # NEW: 浮動輸入框
│   ├── CommentInput.module.css
│   ├── CommentEditModal.jsx       # NEW: 編輯 modal
│   ├── CommentEditModal.module.css
│   ├── CommentDeleteConfirm.jsx   # NEW: 刪除確認
│   ├── CommentDeleteConfirm.module.css
│   ├── CommentHistoryModal.jsx    # NEW: 編輯記錄
│   └── CommentHistoryModal.module.css
└── app/events/[id]/
    └── eventDetailClient.jsx      # MODIFIED: import + render CommentSection
```

**Structure Decision**: 沿用既有 Next.js App Router 結構，service layer 在 `src/lib/`，UI 元件在 `src/components/`，每個元件獨立 CSS Module（與 EventCardMenu、EventDeleteConfirm 等既有元件一致）。

## Complexity Tracking

> 無 Constitution 違規，無需填寫。

---

## 一、Firestore Data Model

### Comment 文件: `events/{eventId}/comments/{commentId}`

| Field            | Type              | Description                 |
| ---------------- | ----------------- | --------------------------- |
| `authorUid`      | string            | 留言者 UID                  |
| `authorName`     | string            | 留言者名稱                  |
| `authorPhotoURL` | string            | 留言者大頭貼 URL            |
| `content`        | string            | 留言內容（上限 500 字）     |
| `createdAt`      | Timestamp         | 建立時間（serverTimestamp） |
| `updatedAt`      | Timestamp \| null | 最後編輯時間                |
| `isEdited`       | boolean           | 是否曾被編輯                |

### Edit History: `events/{eventId}/comments/{commentId}/history/{historyId}`

| Field      | Type      | Description      |
| ---------- | --------- | ---------------- |
| `content`  | string    | 該版本的留言內容 |
| `editedAt` | Timestamp | 該版本的時間     |

**設計決策**:

- **子集合而非 array field**: 避免留言文件隨編輯膨脹，可 lazy load，security rule path 清晰
- **不維護 `commentsCount`**: spec 不要求顯示留言總數，省去 transaction 成本
- **需要 Firestore 索引**: `events/{eventId}/comments` → `createdAt DESC`

---

## 二、Service Layer — `src/lib/firebase-comments.js`（新建）

參考: `src/lib/firebase-posts.js`（已有 addComment/deleteComment transaction pattern）

| Function              | Signature                                                    | 要點                                                                                                 |
| --------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `fetchComments`       | `(eventId, limitCount=15) → {comments[], lastDoc}`           | cursor-based pagination，orderBy createdAt DESC                                                      |
| `fetchMoreComments`   | `(eventId, afterDoc, limitCount=15) → {comments[], lastDoc}` | startAfter(afterDoc)                                                                                 |
| `getCommentById`      | `(eventId, commentId) → CommentData\|null`                   | 新增後取完整資料（含 serverTimestamp）                                                               |
| `addComment`          | `(eventId, user, content) → {id}`                            | 直接 addDoc（不需 transaction，不維護 count）                                                        |
| `updateComment`       | `(eventId, commentId, newContent, oldContent) → void`        | **runTransaction**: 讀 comment → addDoc history → update comment (content, updatedAt, isEdited=true) |
| `deleteComment`       | `(eventId, commentId) → void`                                | **writeBatch**: 查 history 子集合全刪 → 刪 comment 主文件                                            |
| `fetchCommentHistory` | `(eventId, commentId) → CommentHistoryEntry[]`               | orderBy editedAt ASC，不分頁（編輯次數有限）                                                         |

**Optimistic Update 策略**:

- 新增: Server confirm（等 addDoc + getCommentById，顯示 spinner）
- 編輯: Server confirm（modal 內顯示 spinner）
- 刪除: Server confirm（confirm dialog 內顯示 spinner）

---

## 三、Component Architecture

### Component Tree

```
eventDetailClient.jsx（既有）
├─ ... 既有 cards
├─ 路線 card（EventMap）
├─ <CommentSection eventId={id} user={user} />  ← 新增
│   ├─ Section header + empty/loading state
│   ├─ <ul> Comment list
│   │   ├─ <CommentCard> × N
│   │   │   └─ <CommentCardMenu>（僅作者可見）
│   │   ├─ sentinel div（IntersectionObserver）
│   │   └─ load more / end hint
│   ├─ <CommentInput>（fixed bottom，僅登入使用者）
│   ├─ <CommentEditModal>（overlay）
│   ├─ <CommentDeleteConfirm>（overlay）
│   └─ <CommentHistoryModal>（overlay）
└─ 既有 overlays
```

### State 集中在 CommentSection

```
comments[]        / cursor / hasMore / isLoading / isLoadingMore
isSubmitting      / submitError
editingComment    / isUpdating
deletingCommentId / isDeleting / deleteError
historyComment
highlightId       （新留言高亮 ID，2s 後清除）
```

不抽 custom hook（專案沒有 hooks 慣例，events/posts 頁都直接管理 state）。

---

## 四、UI Design Specifications

### 4.1 設計語言

沿用既有 Google Forms 風格 + 紫色 accent（#673ab7）。

### 4.2 Comment Card

- **Avatar**: 36px 圓形，有 photoURL 用 img，無則 fallback 首字（紫色背景 rgba(103,58,183,0.12)）
- **名稱**: 0.9rem, fw 700, #202124
- **時間**: 0.75rem, #70757a, 格式 `4/2 14:30`，hover `title="2026年4月2日 14:30"`
- **已編輯**: `<button>` 元素，0.75rem #5f6368，hover 紫色底線，`aria-label="查看編輯記錄"`
- **內容**: 0.95rem, `padding-left: 48px`（與名字對齊：36px avatar + 12px gap）
- **三點選單**: 複用 EventCardMenu pattern（28x28px trigger, dropdown z-50）
- **高亮**: `@keyframes commentHighlight` rgba(103,58,183,0.12) → #fff, 2s ease-out

### 4.3 Floating Comment Input

- **`position: fixed; bottom: 0; left: 0; right: 0`**, z-index 100
- **border-top**: 1px solid #e0e3e7, box-shadow 0 -2px 8px rgba(0,0,0,0.08)
- **Input**: pill shape（border-radius 20px），flex: 1, bg #f8f9fa, focus border #673ab7
- **送出按鈕**: pill shape, bg #673ab7, disabled bg #e5e7eb
- **字數**: 450 以上才顯示，500+ 紅色 #d32f2f + disabled
- **防遮擋**: comment list 底部 `padding-bottom: 80px`（僅登入時）
- **快捷鍵**: Ctrl/Cmd + Enter 送出
- **RWD 細節見 §4.9**

### 4.4 Edit Modal

- **z-index 200**, overlay rgba(0,0,0,0.5)
- **Dialog**: max-width 480px, width 90vw, border-radius 12px
- **Textarea**: 預填原文，min-height 120px, resize vertical
- **完成編輯**: trim 後與原文同則 disabled
- **入場動畫**: `modalFadeIn` 0.2s scale(0.95)+translateY(10px) → normal
- **RWD 細節見 §4.9**

### 4.5 Delete Confirm Dialog

- 直接沿用 `EventDeleteConfirm` 的設計 pattern
- max-width 380px, 文案「確定刪除留言？」
- 確定刪除（紅 #d32f2f）+ 取消刪除（紫 outline）

### 4.6 Edit History Modal

- max-width 520px, header + scrollable body
- 由新到舊排列，最新標 `目前版本`（紫色 badge），最舊標 `原始版本`（灰色 badge）
- 時間用完整格式 `2026年4月2日 14:30`
- 32px 圓形關閉按鈕

### 4.7 Infinite Scroll

- `.sentinel` 1px + IntersectionObserver（rootMargin `0px 0px 300px 0px`）
- Loading: spinner + `載入更多留言…`
- End: dashed border `已顯示所有留言`
- Error: `載入失敗` + [重試] button

### 4.8 Z-index 層級

```
10  card menu wrapper
50  dropdown
100 floating input bar
200 edit/delete/history modal overlays
```

### 4.9 Responsive Design (RWD)

沿用專案 Mobile-First 慣例，斷點 768px / 1024px，單位 `min-width`。

#### 整體容器（CommentSection）

- 寬度跟隨父層 `googleFormCard`（65vw → 70vw @1024px），自身 `width: 100%` 即可
- Comment list 底部 padding-bottom 80px（登入時，為 floating input 留空間）

#### CommentCard

| 屬性              | Mobile (default) | Tablet+ (≥768px) |
| ----------------- | ---------------- | ---------------- |
| Avatar            | 32px 圓形        | 36px 圓形        |
| 名稱 font-size    | 0.85rem          | 0.9rem           |
| 內容 padding-left | 44px (32+12)     | 48px (36+12)     |
| 內容 font-size    | 0.9rem           | 0.95rem          |
| 卡片 padding      | 12px 12px        | 16px 16px        |

#### CommentInput（fixed bottom）

| 屬性                | Mobile (default)                                        | Tablet+ (≥768px)                                         |
| ------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Input height        | 36px                                                    | 40px                                                     |
| Input border-radius | 18px                                                    | 20px                                                     |
| 送出按鈕 min-width  | 48px                                                    | 56px                                                     |
| 容器 padding        | 8px 12px                                                | 12px 16px                                                |
| iOS safe area       | `padding-bottom: max(8px, env(safe-area-inset-bottom))` | `padding-bottom: max(12px, env(safe-area-inset-bottom))` |

#### CommentEditModal

| 屬性                | Mobile (default)                          | Tablet+ (≥768px)                     |
| ------------------- | ----------------------------------------- | ------------------------------------ |
| Dialog width        | 90vw                                      | 90vw, max-width 480px                |
| Dialog padding      | 20px                                      | 28px                                 |
| Textarea min-height | 100px                                     | 120px                                |
| Buttons layout      | flex-direction column-reverse（完成在上） | flex-direction row（取消左、完成右） |
| Button width        | 100%                                      | auto                                 |

#### CommentDeleteConfirm

- 沿用 EventDeleteConfirm 的 `width: 90vw; max-width: 380px` 模式，**不需額外 media query**
- 按鈕並排 `display: flex; gap: 16px`，小螢幕自然 wrap

#### CommentHistoryModal

| 屬性             | Mobile (default) | Tablet+ (≥768px)      |
| ---------------- | ---------------- | --------------------- |
| Dialog width     | 90vw             | 90vw, max-width 520px |
| Dialog padding   | 16px             | 24px                  |
| 版本項目 padding | 12px             | 16px                  |
| 時間 font-size   | 0.7rem           | 0.75rem               |

#### CommentCardMenu（三點選單）

- Dropdown `position: absolute; right: 0`，自然靠右不超出卡片
- 小螢幕不需額外處理（選單寬度固定 ~120px，卡片最小寬度遠大於此）

#### 共通原則

- Modal overlay 一律 `position: fixed; inset: 0`，內容 `width: 90vw` + `max-width`，**不需 media query 控制寬度**
- 字體大小差異控制在 0.05rem 以內，避免跳躍感
- Touch target 最小 44×44px（按鈕、選單項目），符合 WCAG 2.5.5

### 4.10 Accessibility

- Comment section: `role="region"` + `aria-label="留言區"`
- Comment list: semantic `<ul>/<li>`
- Time: `<time dateTime="ISO">`
- All modals: `role="dialog"` + `aria-modal="true"` + focus trap + Escape 關閉
- Three-dot menu: `role="menu"` + `role="menuitem"` + `aria-expanded`
- Loading: `role="status"` + `aria-live="polite"`
- Errors: `role="alert"`

---

## 五、新增檔案清單

| 檔案                                             | 用途                                       |
| ------------------------------------------------ | ------------------------------------------ |
| `src/lib/firebase-comments.js`                   | Service layer (7 functions)                |
| `src/components/CommentSection.jsx`              | 留言區容器                                 |
| `src/components/CommentSection.module.css`       | 容器、list、loading、empty、sentinel CSS   |
| `src/components/CommentCard.jsx`                 | 單則留言卡片                               |
| `src/components/CommentCard.module.css`          | 卡片 CSS（含高亮 animation）               |
| `src/components/CommentCardMenu.jsx`             | 三點選單                                   |
| `src/components/CommentCardMenu.module.css`      | 選單 CSS（composes EventCardMenu pattern） |
| `src/components/CommentInput.jsx`                | 浮動輸入框                                 |
| `src/components/CommentInput.module.css`         | 輸入框 CSS                                 |
| `src/components/CommentEditModal.jsx`            | 編輯留言 modal                             |
| `src/components/CommentEditModal.module.css`     | 編輯 modal CSS                             |
| `src/components/CommentDeleteConfirm.jsx`        | 刪除確認 dialog                            |
| `src/components/CommentDeleteConfirm.module.css` | 刪除確認 CSS                               |
| `src/components/CommentHistoryModal.jsx`         | 編輯記錄 modal                             |
| `src/components/CommentHistoryModal.module.css`  | 編輯記錄 CSS                               |

---

## 六、修改既有檔案

| 檔案                                         | 變更                                                      |
| -------------------------------------------- | --------------------------------------------------------- |
| `src/app/events/[id]/eventDetailClient.jsx`  | import + render `<CommentSection>` 在路線 card 下方       |
| `src/lib/firebase-events.js` → `deleteEvent` | cascade delete comments 子集合（含每則的 history）        |
| `src/lib/event-helpers.js`                   | 新增 `formatCommentTime` + `formatCommentTimeFull` helper |

---

## 七、重用既有程式碼

| 來源                                                      | 重用於                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `EventCardMenu.jsx` (L24-95)                              | CommentCardMenu 結構範本（click-outside, role="menu"）            |
| `EventDeleteConfirm.jsx`                                  | CommentDeleteConfirm 結構範本（dialog, overlay pattern）          |
| `EventActionButtons.module.css`                           | Button spinner 樣式（可 composes）                                |
| `events/page.jsx` IntersectionObserver pattern            | CommentSection infinite scroll                                    |
| `firebase-posts.js` addComment (L268-284)                 | firebase-comments.js addComment/updateComment transaction pattern |
| `firebase-events.js` deleteEvent batch pattern (L569-589) | firebase-comments.js deleteComment cascade                        |
| `event-helpers.js` buildUserPayload (L212-219)            | Comment 建立時的 user payload                                     |
