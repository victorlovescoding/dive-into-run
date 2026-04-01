# Research: 005-event-comments

## R1: 編輯記錄儲存方式

**Decision**: Firestore 子集合 `comments/{commentId}/history/{historyId}`

**Rationale**:

- 子集合的 read/write 有清晰的 security rule path
- Array field 會讓留言文件隨編輯次數膨脹
- 子集合可 lazy load（只有點擊「已編輯」才查詢）
- `orderBy('editedAt', 'asc')` 直接取得完整時間軸

**Alternatives considered**:

- Array field（`history: [{content, editedAt}]`）：文件膨脹、無法單獨查詢、需整個陣列更新
- 獨立頂層集合（`commentHistory/`）：需額外索引、權限設計複雜、與 comment 無直覺關聯

## R2: 是否維護 commentsCount

**Decision**: 不維護（event 主文件不加 commentsCount field）

**Rationale**:

- Spec 不要求在任何地方顯示留言總數
- 省去 addComment/deleteComment 的 transaction 成本
- 減少寫衝突（多人同時留言不需爭搶 event doc lock）

**Alternatives considered**:

- 維護 commentsCount（如 posts 的模式）：增加每次操作的 transaction 成本，且目前無 UI 用途

## R3: 浮動輸入框定位方式

**Decision**: `position: fixed; bottom: 0`

**Rationale**:

- 使用者滾動留言時輸入框永遠可見，符合聊天/留言 UX 慣例
- Spec 描述「浮動的輸入框」暗示永遠可觸及
- 搭配 `padding-bottom: 80px` 在留言列表底部防遮擋

**Alternatives considered**:

- `position: sticky`：若留言區很短，sticky 不會浮動；使用者滾過留言區後輸入框消失

## R4: IntersectionObserver pattern

**Decision**: 沿用 `events/page.jsx` 的 sentinel + observer pattern

**Rationale**:

- 專案已有成熟的 IntersectionObserver 實作可參考
- Constitution III 要求 IntersectionObserver + Firestore cursor
- `rootMargin: '0px 0px 300px 0px'` 提前 300px 觸發，UX 更流暢

**Alternatives considered**:

- Scroll event listener：效能差、需 debounce、不符合 Constitution 要求

## R5: Optimistic Update 策略

**Decision**: 全部使用 Server confirm（非 optimistic update）

**Rationale**:

- 與既有 PostDetailClient 的 comment pattern 一致
- 新增/刪除都有明確的 loading spinner 作為等待容器
- 避免 rollback 邏輯增加複雜度
- MVP 思維：先做最簡單的，效能不滿意再改

**Alternatives considered**:

- Optimistic update + rollback：程式碼更複雜，且留言操作不像 like 需要即時反饋

## R6: CSS Module 組織方式

**Decision**: 每個元件獨立 CSS Module

**Rationale**:

- 與既有元件一致（EventCardMenu.module.css、EventDeleteConfirm.module.css 等）
- 元件可獨立測試和重用
- 跨元件共用樣式用 `composes`

**Alternatives considered**:

- 單一共用 CSS Module：較簡潔但與既有慣例不符
