'use client';

import ComposeModal from '@/components/ComposeModal';
import EditHistoryModal from '@/components/EditHistoryModal';
import PostCard from '@/components/PostCard';
import feedStyles from '@/app/posts/posts.module.css';
import PostSearchForm from '@/ui/posts/PostSearchForm';
import styles from './PostsSearchPageScreen.module.css';

/**
 * @typedef {object} SearchResultPost
 * @property {string} id 文章 ID。
 * @property {string} title 文章標題。
 * @property {string} content 文章內容。
 * @property {string} authorUid 作者 UID。
 * @property {string} [authorImgURL] 作者頭像 URL。
 * @property {string} [authorName] 作者顯示名稱。
 * @property {import('firebase/firestore').Timestamp} [postAt] 發文時間。
 * @property {number} likesCount 按讚數。
 * @property {number} commentsCount 留言數。
 * @property {boolean} liked 當前使用者是否已按讚。
 * @property {boolean} [isFavorited] 當前使用者是否已收藏。
 * @property {boolean} isAuthor 當前使用者是否為作者。
 * @property {boolean} [isEdited] 文章是否曾被編輯。
 */

/**
 * @typedef {object} SearchHighlightRange
 * @property {'title' | 'snippet'} field 高亮目標欄位。
 * @property {number} start 高亮起點（含）。
 * @property {number} end 高亮終點（不含）。
 */

/**
 * @typedef {object} SearchResultMatch
 * @property {SearchResultPost} [post] 搜尋命中的文章。
 * @property {string} [id] 直接文章結果的 ID。
 * @property {string} [title] 直接文章結果的標題。
 * @property {string} [content] 直接文章結果的內容。
 * @property {string} [snippet] 搜尋結果摘要。
 * @property {SearchHighlightRange[]} [highlightRanges] 搜尋高亮 metadata。
 */

/**
 * Extracts the post payload from a search match.
 * @param {SearchResultMatch} match 搜尋結果。
 * @returns {SearchResultPost} 可渲染的文章資料。
 */
function getResultPost(match) {
  return /** @type {SearchResultPost} */ (match.post ?? match);
}

/**
 * 搜尋結果卡片。
 * @param {object} props Component props。
 * @param {SearchResultMatch} props.match 搜尋結果。
 * @param {string} [props.openMenuPostId] 目前展開選單的文章 ID。
 * @param {(postId: string, event: import('react').MouseEvent) => void} [props.onToggleMenu] 切換作者選單。
 * @param {() => void} [props.onCloseMenu] 關閉作者選單。
 * @param {(postId: string) => void | Promise<void>} [props.onDelete] 刪除文章。
 * @param {(postId: string) => void} [props.onEdit] 編輯文章。
 * @param {(postId: string) => void | Promise<void>} [props.onLike] 按讚文章。
 * @param {(postId: string) => void | Promise<void>} [props.onToggleFavorite] 收藏文章。
 * @param {(post: SearchResultPost) => void | Promise<void>} [props.onViewArticleHistory] 查看文章編輯紀錄。
 * @returns {import('react').ReactElement} 搜尋結果卡片。
 */
function SearchResultCard({
  match,
  openMenuPostId,
  onToggleMenu,
  onCloseMenu,
  onDelete,
  onEdit,
  onLike,
  onToggleFavorite,
  onViewArticleHistory,
}) {
  const post = getResultPost(match);

  return (
    <PostCard
      post={post}
      openMenuPostId={openMenuPostId}
      onToggleMenu={onToggleMenu}
      onCloseMenu={onCloseMenu}
      onDelete={onDelete}
      onEdit={onEdit}
      onLike={onLike}
      onToggleFavorite={onToggleFavorite}
      onViewArticleHistory={onViewArticleHistory}
      searchSnippet={match.snippet}
      searchHighlightRanges={match.highlightRanges}
    />
  );
}

/**
 * Renders the first search-page result list slice.
 * @param {object} props Render props。
 * @param {Array<SearchResultMatch>} props.results 搜尋結果。
 * @param {string} [props.openMenuPostId] 目前展開選單的文章 ID。
 * @param {(postId: string, event: import('react').MouseEvent) => void} [props.onToggleMenu] 切換作者選單。
 * @param {() => void} [props.onCloseMenu] 關閉作者選單。
 * @param {(postId: string) => void | Promise<void>} [props.onDelete] 刪除文章。
 * @param {(postId: string) => void} [props.onEdit] 編輯文章。
 * @param {(postId: string) => void | Promise<void>} [props.onLike] 按讚文章。
 * @param {(postId: string) => void | Promise<void>} [props.onToggleFavorite] 收藏文章。
 * @param {(post: SearchResultPost) => void | Promise<void>} [props.onViewArticleHistory] 查看文章編輯紀錄。
 * @returns {import('react').ReactNode} 搜尋結果內容。
 */
function renderSearchResults({
  results,
  openMenuPostId,
  onToggleMenu,
  onCloseMenu,
  onDelete,
  onEdit,
  onLike,
  onToggleFavorite,
  onViewArticleHistory,
}) {
  return (
    <section className={styles.results} aria-label="搜尋結果">
      {results.map((match) => (
        <SearchResultCard
          key={getResultPost(match).id}
          match={match}
          openMenuPostId={openMenuPostId}
          onToggleMenu={onToggleMenu}
          onCloseMenu={onCloseMenu}
          onDelete={onDelete}
          onEdit={onEdit}
          onLike={onLike}
          onToggleFavorite={onToggleFavorite}
          onViewArticleHistory={onViewArticleHistory}
        />
      ))}
    </section>
  );
}

/**
 * 搜尋頁頂層 loading / empty / error 狀態。
 * @param {object} props Render props。
 * @param {string} props.keyword 目前搜尋關鍵字。
 * @param {string | null} props.errorMessage 錯誤訊息。
 * @param {() => void | Promise<void>} props.onRetry Retry handler。
 * @param {'loading' | 'empty' | 'error'} props.state 狀態類型。
 * @returns {import('react').ReactElement} 狀態區塊。
 */
function SearchStateBlock({ keyword, errorMessage, onRetry, state }) {
  if (state === 'loading') {
    return (
      <div className={styles.stateBlock} role="status" aria-live="polite">
        搜尋中...
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={styles.stateBlock} role="alert">
        <p>{errorMessage ?? '搜尋失敗，請稍後再試'}</p>
        <button className={styles.retryButton} type="button" onClick={() => onRetry()}>
          再試一次
        </button>
      </div>
    );
  }

  return (
    <div className={styles.stateBlock}>
      <p>找不到符合「{keyword}」的文章</p>
      <p className={styles.stateHint}>試試其他關鍵字</p>
    </div>
  );
}

/**
 * 搜尋結果列表底部 observer sentinel 與分頁回饋。
 * @param {object} props Render props。
 * @param {boolean} props.hasMore 是否還有下一頁。
 * @param {boolean} props.isLoadingNext 是否正在載入下一頁。
 * @param {string | null} props.errorMessage 錯誤訊息。
 * @param {import('react').RefObject<HTMLDivElement | null>} props.bottomRef Observer sentinel ref。
 * @param {() => void | Promise<void>} props.onRetry Retry handler。
 * @param {string} props.status 搜尋狀態。
 * @returns {import('react').ReactElement} 底部狀態。
 */
function SearchResultsFooter({
  hasMore,
  isLoadingNext,
  errorMessage,
  bottomRef,
  onRetry,
  status,
}) {
  if (isLoadingNext) {
    return (
      <div className={styles.sentinel} ref={bottomRef} role="status" aria-live="polite">
        載入更多搜尋結果
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.sentinel} ref={bottomRef} role="alert">
        <p>{errorMessage ?? '搜尋失敗，請稍後再試'}</p>
        <button className={styles.retryButton} type="button" onClick={() => onRetry()}>
          再試一次
        </button>
      </div>
    );
  }

  if (!hasMore) {
    return <div className={styles.sentinel}>已顯示全部搜尋結果</div>;
  }

  return <div className={styles.observerSentinel} ref={bottomRef} aria-hidden="true" />;
}

/**
 * 文章搜尋結果頁 UI screen。
 * @param {object} props Component props。
 * @param {object} props.runtime page runtime boundary。
 * @returns {import('react').ReactElement} 文章搜尋結果頁 UI。
 */
export default function PostsSearchPageScreen({ runtime }) {
  const {
    keyword,
    searchInput,
    setSearchInput,
    results,
    isLoading,
    status,
    errorMessage,
    isLoadingNext,
    hasMore,
    title,
    content,
    originalTitle,
    originalContent,
    editingPostId,
    isSubmitting,
    isDraftConfirmOpen,
    dialogRef,
    bottomRef,
    openMenuPostId,
    articleHistoryPost,
    articleHistoryEntries = [],
    articleHistoryError = null,
    handleSubmitSearch,
    handleRetrySearch,
    handlePressLike,
    handleToggleFavoritePost,
    handleToggleOwnerMenu,
    handleCloseOwnerMenu,
    handleEditPost,
    handleDeletePost,
    handleSubmitPost,
    handleViewArticleHistory,
    handleCloseArticleHistory,
    setTitle,
    setContent,
    handleRequestComposerClose,
    handleSaveComposerDraft,
    handleContinueEditingDraft,
    handleDiscardComposerDraft,
  } = runtime;

  /**
   * Keeps the search-page runtime draft in sync without widening PostSearchForm.
   * @param {import('react').FormEvent<HTMLDivElement>} event Change capture event。
   * @returns {void}
   */
  function handleSearchInputChange(event) {
    if (event.target instanceof HTMLInputElement) {
      setSearchInput(event.target.value);
    }
  }

  /**
   * Lets the search runtime own retained-form navigation on the search page.
   * @param {import('react').FormEvent<HTMLDivElement>} event Submit capture event。
   * @returns {void}
   */
  function handleSearchFormSubmit(event) {
    event.stopPropagation();
    handleSubmitSearch(event);
  }

  const isInitialLoading = isLoading || status === 'loading';
  const isInitialError = status === 'error' && results.length === 0;
  const isEmpty = (status === 'empty' || status === 'success') && results.length === 0;
  const hasResults = results.length > 0;

  return (
    <main className={feedStyles.feed} data-testid="post-search-feed">
      <h1 className={feedStyles.feedTitle}>搜尋文章</h1>
      <div onChangeCapture={handleSearchInputChange} onSubmitCapture={handleSearchFormSubmit}>
        <PostSearchForm key={keyword} initialKeyword={searchInput} />
      </div>

      {isInitialLoading && (
        <SearchStateBlock
          keyword={keyword}
          errorMessage={errorMessage}
          onRetry={handleRetrySearch}
          state="loading"
        />
      )}
      {isInitialError && (
        <SearchStateBlock
          keyword={keyword}
          errorMessage={errorMessage}
          onRetry={handleRetrySearch}
          state="error"
        />
      )}
      {isEmpty && (
        <SearchStateBlock
          keyword={keyword}
          errorMessage={errorMessage}
          onRetry={handleRetrySearch}
          state="empty"
        />
      )}
      {hasResults && (
        <>
          {renderSearchResults({
            results,
            openMenuPostId,
            onToggleMenu: handleToggleOwnerMenu,
            onCloseMenu: handleCloseOwnerMenu,
            onDelete: handleDeletePost,
            onEdit: handleEditPost,
            onLike: handlePressLike,
            onToggleFavorite: handleToggleFavoritePost,
            onViewArticleHistory: handleViewArticleHistory,
          })}
          <SearchResultsFooter
            hasMore={hasMore}
            isLoadingNext={isLoadingNext}
            errorMessage={errorMessage}
            bottomRef={bottomRef}
            onRetry={handleRetrySearch}
            status={status}
          />
        </>
      )}

      <ComposeModal
        dialogRef={dialogRef}
        title={title}
        content={content}
        onTitleChange={setTitle}
        onContentChange={setContent}
        onSubmit={handleSubmitPost}
        isEditing={!!editingPostId}
        originalTitle={originalTitle}
        originalContent={originalContent}
        isSubmitting={isSubmitting}
        onRequestClose={handleRequestComposerClose}
        isDraftConfirmOpen={isDraftConfirmOpen}
        onSaveDraft={handleSaveComposerDraft}
        onContinueEditing={handleContinueEditingDraft}
        onDiscardDraft={handleDiscardComposerDraft}
      />

      {articleHistoryPost && (
        <EditHistoryModal
          currentEntry={articleHistoryPost}
          history={articleHistoryEntries}
          historyError={articleHistoryError}
          onClose={handleCloseArticleHistory}
        />
      )}
    </main>
  );
}
