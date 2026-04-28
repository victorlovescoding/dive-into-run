'use client';

import ComposeModal from '@/components/ComposeModal';
import ComposePrompt from '@/components/ComposePrompt';
import PostCard from '@/components/PostCard';
import PostCardSkeleton from '@/components/PostCardSkeleton';
import styles from '@/app/posts/posts.module.css';

/**
 * 渲染文章列表或空狀態。
 * @param {object} props - Render props。
 * @param {boolean} props.isLoading - 是否初始載入中。
 * @param {Array<object>} props.posts - 文章列表。
 * @param {string} props.openMenuPostId - 目前展開選單的文章 ID。
 * @param {(postId: string, event: import('react').MouseEvent) => void} props.onToggleMenu - 切換選單。
 * @param {(postId?: string) => void} props.onEdit - 開啟新增/編輯 modal。
 * @param {(postId: string) => void | Promise<void>} props.onDelete - 刪除文章。
 * @param {(postId: string) => void | Promise<void>} props.onLike - 按讚文章。
 * @returns {import('react').ReactNode} 文章列表內容。
 */
function renderPostList({
  isLoading,
  posts,
  openMenuPostId,
  onToggleMenu,
  onEdit,
  onDelete,
  onLike,
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
      onEdit={onEdit}
      onDelete={onDelete}
      onLike={onLike}
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
    dialogRef,
    bottomRef,
    setTitle,
    setContent,
    handleComposeButton,
    handlePressLike,
    handleToggleOwnerMenu,
    handleDeletePost,
    handleSubmitPost,
  } = runtime;

  return (
    <div className={styles.feed} data-testid="post-feed">
      <h1 className={styles.feedTitle}>文章河道</h1>
      {user && <ComposePrompt userPhotoURL={user.photoURL} onClick={handleComposeButton} />}

      {renderPostList({
        isLoading,
        posts,
        openMenuPostId,
        onToggleMenu: handleToggleOwnerMenu,
        onEdit: handleComposeButton,
        onDelete: handleDeletePost,
        onLike: handlePressLike,
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
      />
    </div>
  );
}
