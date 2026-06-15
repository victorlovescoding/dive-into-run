# Contract: Posts Search UI / Runtime / Use-case

## Route contract

### `/posts`

- 頁面頂部在 `h1` 後、`ComposePrompt` 前顯示搜尋 form。
- Form submit 先 trim keyword。
- Trim 後空字串：不得 navigation；顯示 inline prompt，提示使用者輸入關鍵字。
- Trim 後有效：導向 `/posts/search?q={encodeURIComponent(keyword)}`。
- `/posts` 主河道仍以最新文章排序與既有 infinite scroll 載入，不被搜尋結果取代。
- `/posts` 發文入口、發文與編輯草稿、按讚、收藏、作者操作、詳文連結與未登入閱讀行為不得退化。

### `/posts/search`

- `q` missing、只有空白或 trim 後為空：redirect `/posts`，不得顯示搜尋結果頁。
- Valid `q`：搜尋框顯示目前 keyword，開始載入搜尋結果。
- Refresh `/posts/search?q={keyword}`：從 URL 還原 keyword 並重新載入結果。
- 清空搜尋框後 submit：導回 `/posts`。
- 修改為另一個有效 keyword 後 submit：導向新的 `/posts/search?q={encodeURIComponent(keyword)}` 並重新搜尋。
- 搜尋結果頁不得顯示發文入口。

## UI state contract

- 初始載入：顯示既有文章頁骨架屏體驗或等價 loading state。
- 有結果：顯示符合排序 contract 的 result cards。
- 無結果：顯示 `找不到符合「{q}」的文章`，並提示使用者換個關鍵字。
- 初始搜尋失敗：保留搜尋框與目前 keyword，顯示「搜尋失敗，請稍後再試」或等價清楚訊息，並提供 retry。
- Retry：使用目前 keyword 重新執行初始搜尋。
- Load more：底部 sentinel 觸發；載入時顯示 loading state；失敗時保留既有結果並提供可恢復狀態。
- Result card interactions：沿用 `PostCard` 核心互動，包含詳文導覽、留言數導覽、按讚、收藏、作者編輯/刪除入口與文章編輯記錄入口（若現有卡片提供）。

## Runtime contract

`usePostsSearchPageRuntime` 應提供 render-only screen 所需狀態與 handlers：

```text
{
  keyword,
  searchInput,
  setSearchInput,
  inlinePrompt,
  results,
  status,
  errorMessage,
  hasMore,
  isLoading,
  isLoadingNext,
  bottomRef,
  openMenuPostId,
  handleSubmitSearch,
  handleRetrySearch,
  handlePressLike,
  handleToggleFavoritePost,
  handleToggleOwnerMenu,
  handleCloseOwnerMenu,
  handleDeletePost,
  handleViewArticleHistory,
  handleCloseArticleHistory
}
```

- Runtime owns URL validation, redirect behavior, initial load, retry, load-more, optimistic interaction updates, and owner menu state.
- UI components must not call Firebase/repo/service directly.
- Runtime must dedupe by post id when appending load-more results.

## Use-case response contract

Initial search:

```text
searchPublicActivePosts({
  keyword,
  userUid,
  pageSize,
  cursor: null
}) -> {
  keyword,
  items,
  nextCursor,
  hasMore,
  scannedCount
}
```

Load more:

```text
searchPublicActivePosts({
  keyword,
  userUid,
  pageSize,
  cursor
}) -> {
  keyword,
  items,
  nextCursor,
  hasMore,
  scannedCount
}
```

Error behavior:

- Throw or return a structured failure only for operational failures.
- Invalid blank keyword should be handled before calling the use-case.
- Load-more failure must not discard already rendered results.

## Sorting contract

- Include a post when public active and title/content contains keyword after trim/case-fold.
- A title hit sorts before a content-only hit.
- A post with both title and content hit belongs to the title-hit tier.
- Inside each tier, sort by `postAt` descending.
- If `postAt` is equal, sort by post id descending.
- Results must be stable across pagination and retry for the same underlying data snapshot.

## Snippet/highlight contract

- `snippet` for content hit must include text around the first content match, not a fixed article prefix.
- Title-only hit may use the normal truncated content summary.
- Highlight metadata must identify matched keyword ranges in title and/or snippet.
- UI should render highlight from range/segment data, not from unsafe HTML strings.
- English matching is case-insensitive; Chinese matching uses literal contains without tokenization.

## Visibility contract

- Only public active posts may appear.
- Soft-deleted posts and account-deletion-hidden posts must be excluded.
- Search must not expose author-name, comments, edit history, tag, or category matches.
- Anonymous users can search and open details, but cannot execute actions that require login.
- Logged-in users see liked/favorite state and author actions according to existing permission rules.
