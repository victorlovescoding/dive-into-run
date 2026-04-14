# Research: Posts Input Validation

**Branch**: `018-posts-input-validation` | **Date**: 2026-04-15

---

## R-001: 驗證函式的放置位置

**Decision**: 將 `validatePostInput` 純函式與常數放在 `src/lib/firebase-posts.js`，並 export。

**Rationale**:

- Constitution Principle II 明確要求「資料驗證與正規化必須在服務層處理」，service layer 即 `src/lib/`
- 既有模式一致：`firebase-comments.js:103-109` 的 `addComment` 將 trim + empty + 500 字限制直接寫在函式內
- UI 可合法 import `src/lib/` 的 export（Constitution 禁止的是直接 import Firebase SDK，不是 lib 函式）
- 只是新增 export，不需開新檔案，符合 MVP 原則

**Alternatives considered**:

- 新建 `src/lib/post-validation.js`：多一個檔案，但函式只有一個、與 `firebase-posts.js` 的耦合度高，不值得拆
- 放在 `src/lib/helpers/` 或 `src/lib/validation/`：過度設計，目前只有 post 需要共用驗證

---

## R-002: 驗證函式的回傳型別

**Decision**: `validatePostInput({ title, content })` 回傳 `string | null` — 錯誤訊息字串或 null。

**Rationale**:

- UI 直接拿回傳值丟 `showToast(error, 'error')`，零轉換成本
- Service 層拿回傳值丟 `throw new Error(\`createPost: \${error}\`)`，與 `addComment` 的 throw pattern 一致
- 不回傳 `{ field, message }` 物件 — spec 明說不做 inline error（UI redesign 會重建表單），目前只用 toast，field 資訊無用途

**Alternatives considered**:

- 回傳 `{ field: string, message: string } | null`：為未來 inline error 預留，但 spec 明確說 UI redesign 即將進行，現在加是 YAGNI
- 回傳 `string[]`（所有錯誤）：clarification 說「只顯示第一個錯誤」，回傳陣列多餘

---

## R-003: 「兩欄皆空」的合併訊息

**Decision**: 當 title 和 content trim 後皆為空時，回傳 `'請輸入標題和內容'`（合併訊息），而非依序只回傳 `'請輸入標題'`。

**Rationale**:

- US1 AC3 明確要求：「When 標題和內容都只有空格, Then 顯示『請輸入標題和內容』」
- Clarification 的「只顯示第一個錯誤」主要適用於混合類型錯誤（e.g. title 過長 + content 為空），US1 AC3 是「同類型錯誤的特例」，UX 上合併更直覺
- 實作上只需在 empty check 前多一個 `if (!t && !c)` 判斷，複雜度極低

**Alternatives considered**:

- 一律只回傳第一個錯誤（`'請輸入標題'`）：違反 US1 AC3 驗收條件
- 回傳兩個錯誤讓 UI 決定：過度設計，且 clarification 說「只顯示第一個」

---

## R-004: 字數計算方式

**Decision**: 使用 JavaScript `string.length`。

**Rationale**:

- Spec Assumptions 明確要求：「字數計算方式沿用 JavaScript `string.length`，與 event comments 的 500 字限制一致」
- `firebase-comments.js:109` 使用 `trimmed.length > 500`，確認既有模式即 `string.length`
- Edge case（emoji 佔 2 個 length）已被 spec 接受

**Alternatives considered**:

- `Intl.Segmenter`（grapheme-based）：spec 明確排除
- `Array.from(str).length`（code point count）：spec 未提及，且與 event comments 不一致

---

## R-005: Service 層的 Error 格式

**Decision**: 遵循 `firebase-comments.js` 的 `functionName: message` 格式拋出 Error。

**Rationale**:

- `addComment` 使用 `throw new Error('addComment: content is required')`（firebase-comments.js:108）
- `createPost` / `updatePost` 同理：`throw new Error('createPost: 請輸入標題')`
- 既有 UI catch block 已經用 `console.error` + `showToast` 處理，不需改 error handling

**Alternatives considered**:

- 自訂 `ValidationError` class：過度設計，現有 try-catch 不區分 error type
- 不帶 prefix：失去 debug 可追蹤性

---

## R-006: 常數命名與值

**Decision**:

- `POST_TITLE_MAX_LENGTH = 50`
- `POST_CONTENT_MAX_LENGTH = 10000`

**Rationale**:

- 值直接來自 spec FR-003 / FR-004
- 命名遵循 `SCREAMING_SNAKE_CASE`（JS 常數慣例）
- 加 `POST_` prefix 避免與其他 entity 的常數衝突（e.g. 未來可能有 `EVENT_TITLE_MAX_LENGTH`）
- 兩個常數 export 滿足 FR-010（UI 和 service 共用同一來源）

**Alternatives considered**:

- 放進 config object `POST_LIMITS.title`：只有兩個值，object 多餘
- 不 export（hardcode 在 validatePostInput 內）：違反 FR-010，UI 無法取得上限值
