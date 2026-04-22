'use client';

import Image from 'next/image';
import Link from 'next/link';
import CommentCard from '@/components/CommentCard';
import ComposeModal from '@/components/ComposeModal';
import PostCard from '@/components/PostCard';
import PostCardSkeleton from '@/components/PostCardSkeleton';
import ShareButton from '@/components/ShareButton';
import styles from './PostDetailScreen.module.css';

/**
 * 將 post-detail runtime 留言物件映射為 CommentCard 期望的格式。
 * @param {object} commentItem - 原始留言物件。
 * @param {string} commentItem.id - 留言 ID。
 * @param {string} commentItem.authorUid - 留言者 UID。
 * @param {string} [commentItem.authorName] - 留言者名稱。
 * @param {string} [commentItem.authorImgURL] - 留言者頭像 URL。
 * @param {string} commentItem.comment - 留言內容。
 * @param {import('firebase/firestore').Timestamp} commentItem.createdAt - 建立時間。
 * @returns {import('@/lib/firebase-comments').CommentData} CommentCard 格式資料。
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
    handleOpenEdit,
    handleSubmitPost,
    handleDeletePost,
    handleToggleLike,
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
            onEdit={handleOpenEdit}
            onDelete={handleDeletePost}
            onLike={handleToggleLike}
          >
            <ShareButton title={post.title} url={shareUrl} />
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
