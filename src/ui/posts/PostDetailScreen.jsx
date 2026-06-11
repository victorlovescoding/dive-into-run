/* eslint-disable max-lines -- Detail screen owns post body, comments, composer, and modal wiring. */
'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import CommentCard from '@/components/CommentCard';
import CommentEditModal from '@/components/CommentEditModal';
import CommentHistoryModal from '@/components/CommentHistoryModal';
import CommentInput from '@/components/CommentInput';
import ComposeModal from '@/components/ComposeModal';
import EditHistoryModal from '@/components/EditHistoryModal';
import PostCard from '@/components/PostCard';
import PostCardSkeleton from '@/components/PostCardSkeleton';
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
 * 用 textarea fallback 同步複製文字。
 * @param {string} text - 要複製的文字。
 * @returns {boolean} 複製是否成功。
 */
function copyViaTextarea(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Clipboard API fallback for non-secure contexts
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * 優先用 Clipboard API 複製網址，失敗時使用 textarea fallback。
 * @param {string} url - 要複製的文章網址。
 * @returns {Promise<boolean>} 複製成功時回傳 true。
 */
async function copyPostUrl(url) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    return copyViaTextarea(url);
  }
  return copyViaTextarea(url);
}

/**
 * 重疊方塊複製 icon。
 * @returns {import('react').ReactElement} SVG icon。
 */
function CopyIcon() {
  return (
    <svg className={styles.copyIcon} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * 複製成功 check icon。
 * @returns {import('react').ReactElement} SVG icon。
 */
function CheckIcon() {
  return (
    <svg className={styles.copyIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * 文章詳情頁專用複製連結按鈕。
 * @param {object} props - 元件 props。
 * @param {string} props.url - 要複製的文章網址。
 * @returns {import('react').ReactElement} 複製連結按鈕。
 */
function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef(/** @type {number | null} */ (null));

  useEffect(() => () => {
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const didCopy = await copyPostUrl(url);
    if (!didCopy) return;

    setCopied(true);
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimeoutRef.current = null;
    }, 2000);
  }, [url]);

  const label = copied ? '已複製連結' : '複製連結';
  const icon = copied ? <CheckIcon /> : <CopyIcon />;

  return (
    <button
      type="button"
      className={`${styles.copyLinkButton}${copied ? ` ${styles.copyLinkButtonCopied}` : ''}`}
      onClick={handleCopy}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
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
    handleEditComment,
    handleEditSave,
    handleEditCancel,
    handleDeleteComment,
    handleViewHistory,
    handleCloseHistory,
    handleViewArticleHistory,
    handleCloseArticleHistory,
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
    <div className={styles.detailContainer}>
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
          >
            <PostDetailActions title={post.title} url={shareUrl} />
          </PostCard>

          <section className={styles.commentsSection}>
            <h3 className={styles.commentsTitle}>留言 ({post.commentsCount ?? 0})</h3>
            {comments.map((commentItem) => (
              <CommentCard
                key={commentItem.id}
                comment={mapToCommentCardData(commentItem)}
                isOwner={!!commentItem.isAuthor}
                isHighlighted={commentItem.id === highlightedCommentId}
                onEdit={(currentComment) => {
                  handleOpenCommentEdit(currentComment);
                }}
                onDelete={(currentComment) => {
                  handleDeleteComment(currentComment.id);
                }}
                onViewHistory={handleViewHistory}
              />
            ))}
          </section>

          {user && (
            <CommentInput user={user} onSubmit={handleSubmitComment} isSubmitting={isSubmitting} />
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

          {isLoadingNext && <PostCardSkeleton count={1} />}
          <div ref={bottomRef} className={styles.scrollSentinel} />
        </>
      )}
    </div>
  );
}
