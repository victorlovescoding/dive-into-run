/* eslint-disable max-lines -- Detail screen owns post body, comments, composer, and modal wiring. */
'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import CommentCard from '@/components/CommentCard';
import CommentEditModal from '@/components/CommentEditModal';
import CommentHistoryModal from '@/components/CommentHistoryModal';
import CommentInput from '@/components/CommentInput';
import ComposeModal from '@/components/ComposeModal';
import CopyLinkButton from '@/components/CopyLinkButton';
import EditHistoryModal from '@/components/EditHistoryModal';
import FavoriteLoginContinuationDialog from '@/components/FavoriteLoginContinuationDialog';
import PostCard from '@/components/PostCard';
import PostCardSkeleton from '@/components/PostCardSkeleton';
import ReportDialog from '@/components/reports/ReportDialog';
import ShareButton from '@/components/ShareButton';
import styles from './PostDetailScreen.module.css';

/**
 * 判斷 ShareButton 是否會走原生分享路徑。
 * 條件需與 ShareButton 內部的 native-share 分支一致，避免桌面環境顯示重複複製入口。
 * @returns {boolean} 支援原生分享且主要 pointer 為 coarse 時回傳 true。
 */
function supportsShareButtonNativeShare() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

/**
 * 原生分享支援度在此頁只需 snapshot；提供給 useSyncExternalStore。
 * @returns {() => void} no-op unsubscribe。
 */
function subscribeToShareSupport() {
  return () => {};
}

/**
 * Server snapshot 固定為 false，避免 hydration 期間產生不一致 markup。
 * @returns {boolean} server 端不渲染原生分享按鈕。
 */
function getServerShareSupportSnapshot() {
  return false;
}

/**
 * 文章詳情頁 meta row 右側複製 / 分享群組。
 * @param {object} props - 元件 props。
 * @param {string} props.title - 分享標題。
 * @param {string} props.url - 文章網址。
 * @returns {import('react').ReactElement} 文章動作群組。
 */
function PostDetailActions({ title, url }) {
  const canNativeShare = useSyncExternalStore(
    subscribeToShareSupport,
    supportsShareButtonNativeShare,
    getServerShareSupportSnapshot,
  );

  return (
    <div className={styles.postActionGroup}>
      <CopyLinkButton url={url} />
      {canNativeShare && <ShareButton title={title} url={url} />}
    </div>
  );
}

/**
 * 將 post-detail runtime 留言物件映射為 CommentCard 期望的格式。
 * @param {object} commentItem - 原始留言物件。
 * @param {string} commentItem.id - 留言 ID。
 * @param {string} commentItem.authorUid - 留言者 UID。
 * @param {string} [commentItem.authorName] - 留言者名稱。
 * @param {string} [commentItem.authorImgURL] - 留言者頭像 URL。
 * @param {string} [commentItem.authorPhotoURL] - 已正規化的留言者頭像 URL。
 * @param {string} [commentItem.comment] - 文章留言原始內容欄位。
 * @param {string} [commentItem.content] - 共用留言 UI 內容欄位。
 * @param {import('firebase/firestore').Timestamp | null} commentItem.createdAt - 建立時間。
 * @param {import('firebase/firestore').Timestamp | null} [commentItem.updatedAt] - 更新時間。
 * @param {boolean} [commentItem.isEdited] - 是否曾被編輯。
 * @returns {import('@/service/event-comment-service').CommentData} CommentCard 格式資料。
 */
function mapToCommentCardData(commentItem) {
  return {
    id: commentItem.id,
    authorUid: commentItem.authorUid,
    authorName: commentItem.authorName ?? '使用者',
    authorPhotoURL: commentItem.authorPhotoURL ?? commentItem.authorImgURL,
    content: commentItem.content ?? commentItem.comment ?? '',
    createdAt: commentItem.createdAt,
    updatedAt: commentItem.updatedAt ?? null,
    isEdited: commentItem.isEdited ?? false,
  };
}

/**
 * 文章詳情頁 UI screen。
 * @param {object} props - 元件 props。
 * @param {string} props.postId - 文章 ID。
 * @param {object} props.runtime - 由 runtime boundary 提供的 state 與 handlers。
 * @returns {import('react').ReactElement} 詳情頁 UI。
 */
export default function PostDetailScreen({ postId: _postId, runtime }) {
  const {
    user,
    post,
    loading,
    error,
    shareUrl,
    comments,
    pinnedComment,
    visibleComments,
    highlightedCommentId,
    editingComment: runtimeEditingComment,
    historyComment,
    historyEntries,
    historyError,
    articleHistoryPost,
    articleHistoryEntries,
    articleHistoryError,
    isUpdating: runtimeIsCommentUpdating,
    updateError: runtimeCommentUpdateError,
    title,
    content,
    originalTitle,
    originalContent,
    isSubmitting,
    isDraftConfirmOpen,
    reportDialogTarget,
    dialogState,
    isLoadingNext,
    openMenuPostId,
    dialogRef,
    bottomRef,
    setTitle,
    setContent,
    handleToggleMenu,
    handleCloseMenu,
    handleOpenEdit,
    handleRequestComposerClose,
    handleSaveComposerDraft,
    handleContinueEditingDraft,
    handleDiscardComposerDraft,
    handleSubmitPost,
    handleDeletePost,
    handleToggleLike,
    handleToggleFavoritePost,
    confirmContinuation,
    cancelContinuation,
    closeContinuation,
    handleEditComment,
    handleEditSave,
    handleEditCancel,
    handleDeleteComment,
    handleViewHistory,
    handleCloseHistory,
    handleViewArticleHistory,
    handleCloseArticleHistory,
    handleOpenReportDialog,
    handleCloseReportDialog,
    handleReportResult,
    handleSubmitComment,
  } = runtime;

  const [localEditingComment, setLocalEditingComment] = useState(null);
  const [localIsUpdating, setLocalIsUpdating] = useState(false);
  const [localUpdateError, setLocalUpdateError] = useState(null);

  const activeEditingComment = runtimeEditingComment ?? localEditingComment;
  const activeIsUpdating = runtimeEditingComment ? !!runtimeIsCommentUpdating : localIsUpdating;
  const activeUpdateError = runtimeEditingComment
    ? runtimeCommentUpdateError ?? null
    : localUpdateError;
  const activeHistoryComment = historyComment ? mapToCommentCardData(historyComment) : null;
  const shouldRenderCommentComposer = !!user;
  const renderedComments = visibleComments ?? comments;
  const detailContainerClassName = shouldRenderCommentComposer
    ? `${styles.detailContainer} ${styles.detailWithComposerReserve}`
    : styles.detailContainer;
  const commentsSectionClassName = shouldRenderCommentComposer
    ? `${styles.commentsSection} ${styles.commentsWithComposerReserve}`
    : styles.commentsSection;
  const reportDialogPayload = reportDialogTarget
    ? {
        targetType: reportDialogTarget.targetType,
        target:
          reportDialogTarget.targetType === 'postComment'
            ? { postId: reportDialogTarget.postId, commentId: reportDialogTarget.commentId }
            : { postId: reportDialogTarget.postId },
        preview:
          reportDialogTarget.targetType === 'postComment'
            ? reportDialogTarget.target?.content ?? ''
            : reportDialogTarget.target?.title ?? '',
        sourcePath:
          reportDialogTarget.targetType === 'postComment' && reportDialogTarget.isNotificationTarget
            ? `/posts/${reportDialogTarget.postId}?commentId=${reportDialogTarget.commentId}`
            : `/posts/${reportDialogTarget.postId}`,
      }
    : null;
  const handleReportPost =
    user && handleOpenReportDialog
      ? (targetPost) =>
          handleOpenReportDialog({
            targetType: 'post',
            postId: targetPost.id,
            target: targetPost,
          })
      : undefined;
  const handleReportComment =
    user && handleOpenReportDialog && post
      ? (targetComment) =>
          handleOpenReportDialog({
            targetType: 'postComment',
            postId: post.id,
            commentId: targetComment.id,
            isNotificationTarget: targetComment.id === pinnedComment?.id,
            target: targetComment,
          })
      : undefined;

  const handleOpenCommentEdit = useCallback(
    (currentComment) => {
      setLocalEditingComment(currentComment);
      setLocalUpdateError(null);
      handleEditComment(currentComment.id);
    },
    [handleEditComment],
  );

  const handleSaveCommentEdit = useCallback(
    async (newContent) => {
      if (!activeEditingComment) return;

      if (handleEditSave) {
        const didSave = await handleEditSave(newContent);
        if (didSave !== false) {
          setLocalEditingComment(null);
          setLocalUpdateError(null);
        }
        return;
      }

      setLocalIsUpdating(true);
      setLocalUpdateError(null);
      try {
        const didSave = await handleEditComment(activeEditingComment.id, newContent);
        if (didSave === false) {
          setLocalUpdateError('更新失敗，請再試一次');
          return;
        }
        setLocalEditingComment(null);
      } catch {
        setLocalUpdateError('更新失敗，請再試一次');
      } finally {
        setLocalIsUpdating(false);
      }
    },
    [activeEditingComment, handleEditComment, handleEditSave],
  );

  const handleCancelCommentEdit = useCallback(() => {
    handleEditCancel?.();
    setLocalEditingComment(null);
    setLocalUpdateError(null);
  }, [handleEditCancel]);

  return (
    <div className={detailContainerClassName}>
      <Link href="/posts" className={styles.backLink}>
        ← 回到文章列表
      </Link>

      {loading && (
        <div className={styles.statusRow} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <span>正在載入文章詳情…</span>
        </div>
      )}

      {error && (
        <div className={styles.errorCard} role="alert">
          {error}
        </div>
      )}

      {!loading && !error && post && (
        <>
          <PostCard
            post={post}
            truncate={false}
            openMenuPostId={openMenuPostId}
            onToggleMenu={handleToggleMenu}
            onCloseMenu={handleCloseMenu}
            onEdit={handleOpenEdit}
            onDelete={handleDeletePost}
            onLike={handleToggleLike}
            onToggleFavorite={handleToggleFavoritePost}
            onViewArticleHistory={handleViewArticleHistory}
            onReport={handleReportPost}
          >
            <PostDetailActions title={post.title} url={shareUrl} />
          </PostCard>

          <section className={commentsSectionClassName} aria-label="文章留言">
            <h3 className={styles.commentsTitle}>留言 ({post.commentsCount ?? 0})</h3>
            {pinnedComment && (
              <div className={styles.pinnedComment}>
                <span className={styles.pinnedLabel}>通知中的留言</span>
                <CommentCard
                  comment={mapToCommentCardData(pinnedComment)}
                  isOwner={!!pinnedComment.isAuthor || user?.uid === pinnedComment.authorUid}
                  isHighlighted={pinnedComment.id === highlightedCommentId}
                  onEdit={(currentComment) => {
                    handleOpenCommentEdit(currentComment);
                  }}
                  onDelete={(currentComment) => {
                    handleDeleteComment(currentComment.id);
                  }}
                  onViewHistory={handleViewHistory}
                  onReport={handleReportComment}
                />
              </div>
            )}
            {renderedComments.map((commentItem) => (
              <CommentCard
                key={commentItem.id}
                comment={mapToCommentCardData(commentItem)}
                isOwner={!!commentItem.isAuthor || user?.uid === commentItem.authorUid}
                isHighlighted={commentItem.id === highlightedCommentId}
                onEdit={(currentComment) => {
                  handleOpenCommentEdit(currentComment);
                }}
                onDelete={(currentComment) => {
                  handleDeleteComment(currentComment.id);
                }}
                onViewHistory={handleViewHistory}
                onReport={handleReportComment}
              />
            ))}
          </section>

          {shouldRenderCommentComposer && (
            <CommentInput
              user={user}
              onSubmit={handleSubmitComment}
              isSubmitting={isSubmitting}
              className={styles.postComposer}
            />
          )}

          {activeEditingComment && (
            <CommentEditModal
              comment={activeEditingComment}
              isUpdating={activeIsUpdating}
              updateError={activeUpdateError}
              onSave={handleSaveCommentEdit}
              onCancel={handleCancelCommentEdit}
            />
          )}

          {activeHistoryComment && (
            <CommentHistoryModal
              comment={activeHistoryComment}
              history={historyEntries}
              historyError={historyError}
              onClose={handleCloseHistory}
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

          <ComposeModal
            dialogRef={dialogRef}
            title={title}
            content={content}
            onTitleChange={setTitle}
            onContentChange={setContent}
            onSubmit={handleSubmitPost}
            isEditing
            originalTitle={originalTitle}
            originalContent={originalContent}
            isSubmitting={isSubmitting}
            onRequestClose={handleRequestComposerClose}
            isDraftConfirmOpen={isDraftConfirmOpen}
            onSaveDraft={handleSaveComposerDraft}
            onContinueEditing={handleContinueEditingDraft}
            onDiscardDraft={handleDiscardComposerDraft}
          />

          {reportDialogPayload && (
            <ReportDialog
              isOpen
              currentUser={user}
              targetType={reportDialogPayload.targetType}
              target={reportDialogPayload.target}
              preview={reportDialogPayload.preview}
              sourcePath={reportDialogPayload.sourcePath}
              onClose={handleCloseReportDialog}
              onResult={handleReportResult}
            />
          )}

          {isLoadingNext && <PostCardSkeleton count={1} />}
          <div ref={bottomRef} className={styles.scrollSentinel} />
        </>
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
