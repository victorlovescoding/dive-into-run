# UI Contracts: Posts 頁面 UI 重新設計

**Branch**: `019-posts-ui-refactor` | **Date**: 2026-04-15

> 定義新增與修改元件的 public interface，供 tasks 階段實作參考。

---

## PostCard

**檔案**: `src/components/PostCard.jsx` + `PostCard.module.css`
**用途**: 社群風格文章卡片，用於列表頁和詳文頁。

### Props

```js
/**
 * 社群風格文章卡片。
 * @param {object} props
 * @param {import('@/specs/019-posts-ui-refactor/data-model').EnrichedPost} props.post - 文章資料（含 UI flags）。
 * @param {boolean} [props.truncate=true] - 是否啟用內容截斷（列表頁 true，詳文頁 false）。
 * @param {string} [props.openMenuPostId] - 目前展開選單的文章 ID。
 * @param {(postId: string, e: import('react').MouseEvent) => void} [props.onToggleMenu] - 切換選單回呼。
 * @param {(postId: string) => void} [props.onEdit] - 編輯回呼。
 * @param {(postId: string) => void} [props.onDelete] - 刪除回呼。
 * @param {(postId: string) => void} [props.onLike] - 按讚回呼。
 * @param {import('react').ReactNode} [props.children] - 額外內容（詳文頁用，如 ShareButton）。
 */
```

### 行為

- `truncate=true`（預設）：內容 >150 字時截斷 + 「......」 + 「查看更多」按鈕
- `truncate=false`：顯示完整內容（詳文頁用）
- 展開狀態為 component local state，不暴露到外部
- 展開動畫：`max-height` transition 250ms ease
- 卡片標題為 `<Link>` 連結到詳文頁（`truncate=true` 時）
- 作者區域使用 `UserLink` 顯示頭像 + 名稱
- 相對時間使用 `formatRelativeTime(post.postAt)`
- 作者操作選單（編輯/刪除）僅 `post.isAuthor` 時顯示

### 視覺規格

- 圓角 8px、底部 1px `#e0e3e7` 分隔線（非 `border` 全框）
- 背景白色、文字深色（`#1a1a1a` 標題、`#5f6368` meta）
- 頭像 36px 圓形、名稱 + 時間同行
- 按讚/留言 icon + count 在卡片底部

---

## PostCardSkeleton

**檔案**: `src/components/PostCardSkeleton.jsx` + `PostCardSkeleton.module.css`
**用途**: 文章卡片的骨架屏載入佔位。

### Props

```js
/**
 * 文章卡片骨架屏。
 * @param {object} [props]
 * @param {number} [props.count=3] - 顯示的骨架卡片數量。
 */
```

### 行為

- 渲染 `count` 個骨架卡片
- 每張卡片結構鏡像 PostCard：頭像佔位 + 名稱行 + 標題行 + 內容行 x2 + meta 行
- shimmer 動畫（`linear-gradient` + `@keyframes`）

### 視覺規格

- 佔位方塊顏色 `#e0e0e0`，shimmer 亮色 `#f0f0f0`
- 圓角與間距與 PostCard 一致
- 動畫週期 1.5s `ease-in-out` infinite

---

## ComposePrompt

**檔案**: `src/components/ComposePrompt.jsx` + `ComposePrompt.module.css`
**用途**: Feed 頂部假輸入框，點擊後觸發開啟 Modal。

### Props

```js
/**
 * Feed 頂部發文假輸入框。
 * @param {object} props
 * @param {string} [props.userPhotoURL] - 使用者頭像 URL。
 * @param {() => void} props.onClick - 點擊後的回呼（開啟 Modal）。
 */
```

### 行為

- 顯示使用者頭像（或預設頭像）+ placeholder 文字「分享你的跑步故事...」
- 整塊可點擊，觸發 `onClick`
- 隨頁面滾動（非固定定位）
- 只在已登入使用者的 feed 顯示（由父元件控制 render）

### 視覺規格

- 與 PostCard 同寬（繼承 feed 容器 max-width）
- 圓角 8px、1px border `#e0e3e7`
- 頭像 36px 圓形、placeholder 文字 `#9e9e9e`
- 背景 `#f8f9fa`（微灰，區別於卡片白色）

---

## ComposeModal

**檔案**: `src/components/ComposeModal.jsx` + `ComposeModal.module.css`
**用途**: 發文/編輯 Modal，使用 `<dialog>` 原生元素。

### Props

```js
/**
 * 發文/編輯文章 Modal。
 * @param {object} props
 * @param {import('react').RefObject<HTMLDialogElement | null>} props.dialogRef - dialog 元素 ref。
 * @param {string} props.title - 標題輸入值。
 * @param {string} props.content - 內容輸入值。
 * @param {(value: string) => void} props.onTitleChange - 標題變更回呼。
 * @param {(value: string) => void} props.onContentChange - 內容變更回呼。
 * @param {(e: import('react').FormEvent<HTMLFormElement>) => void} props.onSubmit - 表單送出回呼。
 * @param {boolean} [props.isEditing=false] - 是否為編輯模式（影響標題文字）。
 */
```

### 行為

- 由父元件透過 `dialogRef.current.showModal()` 開啟
- Escape 鍵或點擊 backdrop 關閉（原生 `<dialog>` 行為 + backdrop click handler）
- 表單包含：標題 input、內容 textarea、發布/更新按鈕
- `isEditing=true` 時 Modal 標題顯示「編輯文章」，按鈕文字「更新」
- `isEditing=false` 時 Modal 標題顯示「發表文章」，按鈕文字「發布」
- 關閉時由父元件負責清空表單狀態

### 視覺規格

- 居中顯示，max-width 500px
- 圓角 12px、白色背景
- `::backdrop` 半透明黑色（`rgba(0, 0, 0, 0.5)`）
- 標題 input 底部 border-only、內容 textarea 自適應高度
- 發布按鈕 primary color（`#673ab7`）

---

## 列表頁 page.jsx 修改契約

### 結構變更

```text
Before:
  <div>
    <h1>文章河道</h1>
    <ul> {posts.map → inline card rendering} </ul>
    <button className={styles.compose}>➕</button>  ← 移除
    {isComposeEditing && <inline form>}               ← 改為 ComposeModal
    <div ref={bottomRef}>我是底部</div>

After:
  <div className={styles.feed}>
    <h1 className={styles.feedTitle}>文章河道</h1>
    {user && <ComposePrompt onClick={openModal} />}
    {isLoading
      ? <PostCardSkeleton count={3} />
      : posts.map → <PostCard truncate />}
    {isLoadingNext && <PostCardSkeleton count={1} />}
    <div ref={bottomRef} className={styles.scrollSentinel} />
    <ComposeModal dialogRef={dialogRef} ... />
  </div>
```

### 新增 state

- `isLoading: boolean` — 初始載入狀態（取代目前的無載入指示）

### 移除項目

- 固定右下角 ➕ FAB 按鈕（`.compose` class）
- Inline compose form
- 藍色邊框卡片樣式

---

## 詳文頁 PostDetailClient.jsx 修改契約

### 結構變更

```text
Before:
  <article>
    {owner menu + inline post rendering}
    <ul> {comments.map → inline comment rendering with red border} </ul>
    {like/comment buttons}
    {comment form}
    {inline edit form}
    <div ref={bottomRef}>我是底部</div>

After:
  <article className={styles.detailContainer}>
    <PostCard post={postDetail} truncate={false}>
      <ShareButton ... />
    </PostCard>
    {like/comment meta bar}
    <section className={styles.commentsSection}>
      <h3>留言 ({commentsCount})</h3>
      {comments.map → <CommentCard ... />}  ← 使用既有 CommentCard
    </section>
    {comment input area — 配合新視覺風格}
    <ComposeModal dialogRef={dialogRef} isEditing ... />
    <div ref={bottomRef} className={styles.scrollSentinel} />
  </article>
```

### 移除項目

- 紅色邊框留言容器（`.commentContainer` class）
- Inline owner menu（改由 PostCard 內部處理）
- Inline edit form（改為 ComposeModal）
