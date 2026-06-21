'use client';

import ComposeModal from '@/components/ComposeModal';
import ComposePrompt from '@/components/ComposePrompt';
import EditHistoryModal from '@/components/EditHistoryModal';
import FavoriteLoginContinuationDialog from '@/components/FavoriteLoginContinuationDialog';
import PostCard from '@/components/PostCard';
import PostCardSkeleton from '@/components/PostCardSkeleton';
import ReportDialog from '@/components/reports/ReportDialog';
import styles from '@/app/posts/posts.module.css';
import PostSearchForm from '@/ui/posts/PostSearchForm';

/**
 * 渲染文章列表或空狀態。
 * @param {object} props - Render props。
 * @param {boolean} props.isLoading - 是否初始載入中。
 * @param {Array<object>} props.posts - 文章列表。
 * @param {string} props.openMenuPostId - 目前展開選單的文章 ID。
 * @param {(postId: string, event: import('react').MouseEvent) => void} props.onToggleMenu - 切換選單。
 * @param {() => void} props.onCloseMenu - 關閉目前展開的選單。
 * @param {(postId?: string) => void} props.onEdit - 開啟新增/編輯 modal。
 * @param {(postId: string) => void | Promise<void>} props.onDelete - 刪除文章。
 * @param {(postId: string) => void | Promise<void>} props.onLike - 按讚文章。
 * @param {(postId: string) => void | Promise<void>} props.onToggleFavorite - 收藏文章。
 * @param {(post: object) => void | Promise<void>} props.onViewArticleHistory - 查看文章編輯記錄。
 * @param {(post: object) => void | Promise<void>} [props.onReport] - 開啟文章檢舉流程。
 * @returns {import('react').ReactNode} 文章列表內容。
 */
function renderPostList({
  isLoading,
  posts,
  openMenuPostId,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onDelete,
  onLike,
  onToggleFavorite,
  onViewArticleHistory,
  onReport,
}) {
  if (isLoading) {
    return <PostCardSkeleton count={3} />;
  }

  if (posts.length === 0) {
    return <p className={styles.emptyState}>還沒有文章，成為第一個分享的人吧！</p>;
  }

  return posts.map((post) => (
    <PostCard
      key={post.id}
      post={post}
      openMenuPostId={openMenuPostId}
      onToggleMenu={onToggleMenu}
      onCloseMenu={onCloseMenu}
      onEdit={onEdit}
      onDelete={onDelete}
      onLike={onLike}
      onToggleFavorite={onToggleFavorite}
      onViewArticleHistory={onViewArticleHistory}
      onReport={onReport}
    />
  ));
}

/**
 * 文章列表頁 UI screen。
 * @param {object} props - Component props。
 * @param {object} props.runtime - page runtime boundary。
 * @returns {import('react').ReactElement} 文章列表頁 UI。
 */
export default function PostsPageScreen({ runtime }) {
  const {
    user,
    title,
    content,
    originalTitle,
    originalContent,
    isSubmitting,
    editingPostId,
    isLoading,
    posts,
    openMenuPostId,
    isLoadingNext,
    isDraftConfirmOpen,
    reportDialogTarget,
    dialogState,
    articleHistoryPost,
    articleHistoryEntries,
    articleHistoryError,
    dialogRef,
    bottomRef,
    setTitle,
    setContent,
    handleComposeButton,
    handlePressLike,
    handleToggleOwnerMenu,
    handleCloseOwnerMenu,
    handleDeletePost,
    handleSubmitPost,
    handleToggleFavoritePost,
    confirmContinuation,
    cancelContinuation,
    closeContinuation,
    handleViewArticleHistory,
    handleOpenReportDialog,
    handleCloseReportDialog,
    handleReportResult,
    handleCloseArticleHistory,
    handleRequestComposerClose,
    handleSaveComposerDraft,
    handleContinueEditingDraft,
    handleDiscardComposerDraft,
  } = runtime;
  const handleReportPost =
    user && handleOpenReportDialog
      ? (targetPost) =>
          handleOpenReportDialog({
            targetType: 'post',
            postId: targetPost.id,
            target: targetPost,
          })
      : undefined;

  return (
    <div className={styles.feed} data-testid="post-feed">
      <PostSearchForm />
      {user && <ComposePrompt userPhotoURL={user.photoURL} onClick={handleComposeButton} />}

      {renderPostList({
        isLoading,
        posts,
        openMenuPostId,
        onToggleMenu: handleToggleOwnerMenu,
        onCloseMenu: handleCloseOwnerMenu,
        onEdit: handleComposeButton,
        onDelete: handleDeletePost,
        onLike: handlePressLike,
        onToggleFavorite: handleToggleFavoritePost,
        onViewArticleHistory: handleViewArticleHistory,
        onReport: handleReportPost,
      })}

      {isLoadingNext && <PostCardSkeleton count={1} />}
      <div ref={bottomRef} className={styles.scrollSentinel} />

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

      {reportDialogTarget && (
        <ReportDialog
          isOpen
          currentUser={user}
          targetType="post"
          target={{ postId: reportDialogTarget.postId }}
          preview={reportDialogTarget.target?.title ?? ''}
          sourcePath="/posts"
          onClose={handleCloseReportDialog}
          onResult={handleReportResult}
        />
      )}

      {articleHistoryPost && (
        <EditHistoryModal
          currentEntry={articleHistoryPost}
          history={articleHistoryEntries}
          historyError={articleHistoryError}
          onClose={handleCloseArticleHistory}
        />
      )}

      <FavoriteLoginContinuationDialog
        dialogState={dialogState}
        onConfirm={confirmContinuation}
        onCancel={cancelContinuation}
        onClose={closeContinuation}
      />
    </div>
  );
}
