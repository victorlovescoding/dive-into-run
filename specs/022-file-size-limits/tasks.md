---
description: 'Session task list for 022-file-size-limits'
---

# Tasks: File Size Limits (D2)

**Input**: Plan file `~/.claude/plans/2026-04-24-openai-harness-gap-analysis-mellow-raven.md`
**目標**: 所有 `src/**` 檔案 code lines（扣空行 + 註解）< 300，並啟用 ESLint `max-lines` rule

---

## 共用驗收標準（每個提取 task 都適用）

| #    | 驗收項目                                            | 驗證方式                                          |
| ---- | --------------------------------------------------- | ------------------------------------------------- |
| AC-1 | 新檔案存在且 exports 正確                           | 讀新檔案，確認 export 名稱和型別                  |
| AC-2 | 源檔案 import 已更新                                | 讀源檔案，確認 import 新 sub-hook/component       |
| AC-3 | 源檔案不再包含已搬移的邏輯                          | grep 搬移的 function/state 名稱，不該在源檔案出現 |
| AC-4 | 源檔案 public API（export）不變                     | 讀源檔案 export，與原始比對                       |
| AC-5 | `npm run type-check:changed` 0 errors               | 跑指令                                            |
| AC-6 | `npm run lint:changed` 0 errors/warnings            | 跑指令                                            |
| AC-7 | `npm run test:branch` all pass                      | 跑指令                                            |
| AC-8 | Group 最後一個 task 完成後，源檔案 code lines < 300 | node script 計算                                  |

Code lines 計算方式：

```bash
node -e "
  const fs = require('fs');
  const code = fs.readFileSync('FILE_PATH', 'utf8');
  let s = code.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/\/\/.*$/gm, '');
  console.log(s.split('\n').filter(l => l.trim().length > 0).length);
"
```

---

## 相依性 & 平行分組

```
Group A: T01 → T02 → T03   (useEventsPageRuntime.js — 同檔循序)
Group B: T04 → T05          (EventsPageScreen.jsx — 同檔循序)
Group C: T06 → T07          (useEventDetailRuntime.js — 同檔循序)
Group D: T08                (usePostDetailRuntime.js)
Group E: T09 → T10          (EventEditForm.jsx — 同檔循序)
Group F: T11                (useWeatherPageRuntime.js)
Group G: T12                (weather-forecast-service.js)
Group H: T13                (EventDetailScreen.jsx)
Group I: T14                (NotificationProvider.jsx)

All Groups ──→ T15          (ESLint rule，依賴全部完成)
```

**跨 Group 無相依** — 最大平行 9 agents（每 Group 一個 engineer + 一個 reviewer）。

---

## Group A: useEventsPageRuntime.js（679 → < 300）

來源：`src/runtime/hooks/useEventsPageRuntime.js`
提取目標目錄：`src/runtime/hooks/`

### [ ] T01 提取 `useEventsFilter.js`

**搬移內容**：

- State：isFilterOpen, filters（及其所有子欄位 state）, cityOptions, districtOptions
- Handlers：handleOpenFilter, handleCloseFilter, city/district change handlers, handleClearFilters, handleSearchFilters
- Effect：body overflow for filter overlay

**驗收標準**（AC-1~7 + 以下）：

- [ ] `useEventsFilter` hook 接受必要參數（searchParams, router），回傳 filter state + handlers
- [ ] 源檔案呼叫 `useEventsFilter()` 並解構回傳值
- [ ] `grep -n 'handleOpenFilter\|handleCloseFilter\|handleClearFilters\|handleSearchFilters'` 的函式定義只出現在新檔案

### [ ] T02 提取 `useEventParticipation.js`

**搬移內容**：

- State：pendingJoin, pendingLeave, hasJoined, joinedEventIds 等
- Handlers：handleJoinClick, handleLeaveClick
- Effect：membership check（user joined events）

**驗收標準**（AC-1~7 + 以下）：

- [ ] `useEventParticipation` hook 接受必要參數（user, events），回傳 participation state + handlers
- [ ] `grep -n 'handleJoinClick\|handleLeaveClick\|pendingJoin\|pendingLeave'` 的定義只出現在新檔案
- [ ] join/leave 邏輯（seat availability check, recalc）完整搬移

### [ ] T03 提取 `useEventMutations.js`

**搬移內容**：

- State：editingEvent, deletingEventId, pendingDelete 等
- Handlers：handleEditEvent, handleEditCancel, handleEditSubmit, handleDeleteEventRequest, handleDeleteCancel, handleDeleteConfirm

**驗收標準**（AC-1~7 + **AC-8** + 以下）：

- [ ] `useEventMutations` hook 接受必要參數，回傳 mutation state + handlers
- [ ] `grep -n 'handleEditEvent\|handleEditCancel\|handleEditSubmit\|handleDeleteEventRequest\|handleDeleteCancel\|handleDeleteConfirm'` 的定義只出現在新檔案
- [ ] **AC-8**：源檔案 code lines < 300（T03 是 Group A 最後一個 task）

---

## Group B: EventsPageScreen.jsx（746 → < 300）

來源：`src/ui/events/EventsPageScreen.jsx`
提取目標目錄：`src/ui/events/`

### [ ] T04 提取 `EventCreateForm.jsx`

**搬移內容**：

- 建立活動表單 modal 的完整 JSX（host info, title, time, location, route drawing, pace selection, max participants, description, submit/cancel buttons）

**驗收標準**（AC-1~7 + 以下）：

- [ ] `EventCreateForm` 接受 props（form state + handlers from runtime），不含自身 state logic
- [ ] 源檔案用 `<EventCreateForm ... />` 取代原本的 inline JSX
- [ ] 表單所有欄位（title, time, location, route, pace, maxParticipants, description）都在新檔案

### [ ] T05 提取 `EventsFilterPanel.jsx`

**搬移內容**：

- 篩選 overlay modal 的完整 JSX（seats toggle, time range, distance range, city/district selectors, clear/search buttons）

**驗收標準**（AC-1~7 + **AC-8** + 以下）：

- [ ] `EventsFilterPanel` 接受 props（filter state + handlers from runtime），不含自身 state logic
- [ ] 源檔案用 `<EventsFilterPanel ... />` 取代原本的 inline JSX
- [ ] **AC-8**：源檔案 code lines < 300
- [ ] **注意**：若仍 > 300，需追加提取 `EventsListSection.jsx`（event cards + loading + empty + sentinel）

---

## Group C: useEventDetailRuntime.js（477 → < 300）

來源：`src/runtime/hooks/useEventDetailRuntime.js`
提取目標目錄：`src/runtime/hooks/`

### [ ] T06 提取 `useEventDetailParticipation.js`

**搬移內容**：

- State：participants, participantsLoading, participantsError, isParticipantsOpen, pendingJoin, pendingLeave, hasJoined
- Handlers：handleJoin, handleLeave, handleOpenParticipants, handleCloseParticipants
- Effect/Callback：refreshParticipants

**驗收標準**（AC-1~7 + 以下）：

- [ ] hook 接受必要參數（event, user/actor），回傳 participation state + handlers
- [ ] `grep -n 'handleJoin\|handleLeave\|handleOpenParticipants\|refreshParticipants'` 的定義只出現在新檔案

### [ ] T07 提取 `useEventDetailMutations.js`

**搬移內容**：

- State：editingEvent, deletingEventId
- Handlers：handleEditEvent, handleEditCancel, handleEditSubmit, handleDeleteEventRequest, handleDeleteCancel, handleDeleteConfirm
- Comment notification handler

**驗收標準**（AC-1~7 + **AC-8** + 以下）：

- [ ] hook 接受必要參數（event, router, user），回傳 mutation state + handlers
- [ ] `grep -n 'handleEditEvent\|handleDeleteEventRequest\|handleDeleteConfirm'` 的定義只出現在新檔案
- [ ] **AC-8**：源檔案 code lines < 300

---

## Group D: usePostDetailRuntime.js（465 → < 300）

來源：`src/runtime/hooks/usePostDetailRuntime.js`
提取目標目錄：`src/runtime/hooks/`

### [ ] T08 提取 `usePostComments.js`

**搬移內容**：

- State：comments, comment, commentEditing, nextCursor, isLoadingNext
- Infinite scroll：IntersectionObserver on bottomRef + getMoreComments with deduplication
- Highlight：highlightedCommentId + scroll-to-comment effect
- Handlers：handleEditComment, handleDeleteComment, handleSubmitComment, handleCommentChange

**驗收標準**（AC-1~7 + **AC-8** + 以下）：

- [ ] hook 接受必要參數（postId, user/actor），回傳 comments state + handlers + bottomRef
- [ ] `grep -n 'handleEditComment\|handleDeleteComment\|handleSubmitComment\|getMoreComments'` 的定義只出現在新檔案
- [ ] Infinite scroll（IntersectionObserver + cursor pagination）完整搬移
- [ ] **AC-8**：源檔案 code lines < 300

---

## Group E: EventEditForm.jsx（456 → < 300）

來源：`src/components/EventEditForm.jsx`

### [ ] T09 提取 `EventRouteEditor.jsx`（放 `src/components/`）

**搬移內容**：

- 路線編輯區塊 JSX：view mode / none mode / draw mode（EventMap 整合 + route drawing）
- Route mode switching logic

**驗收標準**（AC-1~7 + 以下）：

- [ ] `EventRouteEditor` 接受 props（route data, mode, onChange handlers）
- [ ] 源檔案用 `<EventRouteEditor ... />` 取代原本的三模式 JSX block
- [ ] 三種 route mode（view/none/draw）的 conditional rendering 都在新檔案

### [ ] T10 提取 `useEventEditForm.js`（放 `src/runtime/hooks/`）

**搬移內容**：

- Helpers：toDatetimeLocal(), deriveInitialPace(), pace constants
- All form state declarations
- Dirty detection useMemo + originalValues

**驗收標準**（AC-1~7 + **AC-8** + 以下）：

- [ ] hook 接受 event 物件，回傳 form state + setters + isDirty + helpers
- [ ] `grep -n 'toDatetimeLocal\|deriveInitialPace\|isDirty'` 的定義只出現在新檔案
- [ ] **AC-8**：源檔案 code lines < 300

---

## Group F: useWeatherPageRuntime.js（381 → < 300）

來源：`src/runtime/hooks/useWeatherPageRuntime.js`
提取目標目錄：`src/runtime/hooks/`

### [ ] T11 提取 `useWeatherFavorites.js`

**搬移內容**：

- State：favorites, favSummaries, currentFavStatus, isFavoriteMutating
- Callbacks：loadFavorites, refreshCurrentFavoriteStatus, buildFavoriteSummary helper
- Handlers：handleFavoriteToggle, handleFavoriteSelect, handleFavoriteRemove

**驗收標準**（AC-1~7 + **AC-8** + 以下）：

- [ ] hook 接受必要參數（selectedLocation, user），回傳 favorites state + handlers
- [ ] `grep -n 'handleFavoriteToggle\|handleFavoriteSelect\|handleFavoriteRemove\|loadFavorites'` 的定義只出現在新檔案
- [ ] **AC-8**：源檔案 code lines < 300

---

## Group G: weather-forecast-service.js（372 → < 300）

來源：`src/service/weather-forecast-service.js`
提取目標目錄：`src/service/`

### [ ] T12 提取 `weather-forecast-helpers.js`

**搬移內容**：

- Input normalization：normalizeCounty, normalizeTownship, resolveForecastRequest
- Time/period helpers：isPeriodCurrent, toTwDate, isPeriodTomorrow, isDaytimePeriod

**驗收標準**（AC-1~7 + **AC-8** + 以下）：

- [ ] 新檔案只包含 pure functions，無 async / 無 side effects
- [ ] 源檔案 import 這些 helpers 且不再包含其定義
- [ ] `grep -n 'function normalizeCounty\|function normalizeTownship\|function isPeriodCurrent\|function toTwDate'` 的定義只出現在新檔案
- [ ] **AC-8**：源檔案 code lines < 300

---

## Group H: EventDetailScreen.jsx（320 → < 300）

來源：`src/ui/events/EventDetailScreen.jsx`
提取目標目錄：`src/ui/events/`

### [ ] T13 提取 `ParticipantsModal.jsx`

**搬移內容**：

- 參加者列表 modal 完整 JSX：loading state, error state, participants list rendering, close button/handlers

**驗收標準**（AC-1~7 + **AC-8** + 以下）：

- [ ] `ParticipantsModal` 接受 props（participants, loading, error, isOpen, onClose）
- [ ] 源檔案用 `<ParticipantsModal ... />` 取代原本的 modal JSX
- [ ] **AC-8**：源檔案 code lines < 300

---

## Group I: NotificationProvider.jsx（305 → < 300）

來源：`src/runtime/providers/NotificationProvider.jsx`
提取目標目錄：`src/runtime/providers/`

### [ ] T14 提取 `notification-context.js`

**搬移內容**：

- createContext() call
- JSDoc typedefs（NotificationContextValue 及其所有 @property）
- Default context value object
- useNotificationContext convenience hook

**驗收標準**（AC-1~7 + **AC-8** + 以下）：

- [ ] 新檔案 export：NotificationContext, useNotificationContext, default value
- [ ] 源檔案 import NotificationContext from 新檔案
- [ ] **源檔案 re-export**：`export { NotificationContext, useNotificationContext } from './notification-context'` — 維持 public API 不變（8 個 notification test 直接 import `{ NotificationContext }` from `@/runtime/providers/NotificationProvider`，不 re-export 會全部 break）
- [ ] `grep -n 'createContext'` 只出現在新檔案
- [ ] **AC-8**：源檔案 code lines < 300

---

## T15: ESLint max-lines Rule

**依賴**：T01-T14 全部完成
**修改**：`eslint.config.mjs`

```javascript
// 19. File size limits (D2: mechanical enforcement)
{
  files: ['src/**/*.{js,jsx}'],
  ignores: ['src/config/geo/**'],
  rules: {
    'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
  },
},
```

**驗收標準**：

- [ ] Section 19 存在且 config 正確
- [ ] `npx eslint src` 全量 0 violations
- [ ] `npm run build` production build 通過
- [ ] `npm run test:branch` all pass
