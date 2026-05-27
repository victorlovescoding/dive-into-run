'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import CommentCard from '@/components/CommentCard';
import ComposeModal from '@/components/ComposeModal';
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
 * @param {string} commentItem.comment - 留言內容。
 * @param {import('firebase/firestore').Timestamp} commentItem.createdAt - 建立時間。
 * @returns {import('@/service/event-comment-service').CommentData} CommentCard 格式資料。
 */
function mapToCommentCardData(commentItem) {
  return {
    id: commentItem.id,
    authorUid: commentItem.authorUid,
    authorName: commentItem.authorName ?? '使用者',
    authorPhotoURL: commentItem.authorImgURL,
    content: commentItem.comment,
    createdAt: commentItem.createdAt,
    updatedAt: null,
    isEdited: false,
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
    comment,
    title,
    content,
    originalTitle,
    originalContent,
    isSubmitting,
    isLoadingNext,
    openMenuPostId,
    dialogRef,
    bottomRef,
    setTitle,
    setContent,
    handleToggleMenu,
    handleCloseMenu,
    handleOpenEdit,
    handleSubmitPost,
    handleDeletePost,
    handleToggleLike,
    handleToggleFavoritePost,
    handleEditComment,
    handleDeleteComment,
    handleSubmitComment,
    handleCommentChange,
  } = runtime;

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
                  handleEditComment(currentComment.id);
                }}
                onDelete={(currentComment) => {
                  handleDeleteComment(currentComment.id);
                }}
              />
            ))}
          </section>

          <form onSubmit={handleSubmitComment} className={styles.commentForm}>
            {user?.photoURL && (
              <Image
                src={user.photoURL}
                alt={`${user?.name ?? '使用者'}的大頭貼`}
                width={36}
                height={36}
                className={styles.commentAvatar}
              />
            )}
            <input
              type="text"
              placeholder="留言"
              aria-label="留言"
              value={comment}
              onChange={handleCommentChange}
              className={styles.commentInput}
            />
            <button type="submit" className={styles.commentSubmit}>
              送出
            </button>
          </form>

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
          />

          {isLoadingNext && <PostCardSkeleton count={1} />}
          <div ref={bottomRef} className={styles.scrollSentinel} />
        </>
      )}
    </div>
  );
}
