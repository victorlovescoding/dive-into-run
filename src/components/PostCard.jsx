import { useState, useRef } from 'react';
import Link from 'next/link';
import UserLink from '@/components/UserLink';
import { formatRelativeTime } from '@/lib/notification-helpers';
import styles from './PostCard.module.css';

/** @type {number} 截斷字數閾值。 */
const TRUNCATE_THRESHOLD = 150;

/**
 * @typedef {object} EnrichedPost
 * @property {string} id - 文章 ID。
 * @property {string} title - 文章標題。
 * @property {string} content - 文章完整內容。
 * @property {string} authorUid - 作者 UID。
 * @property {string} [authorImgURL] - 作者頭像 URL。
 * @property {string} [authorName] - 作者顯示名稱。
 * @property {import('firebase/firestore').Timestamp} [postAt] - 發文時間。
 * @property {number} likesCount - 按讚數。
 * @property {number} commentsCount - 留言數。
 * @property {boolean} liked - 當前使用者是否已按讚。
 * @property {boolean} isAuthor - 當前使用者是否為作者。
 */

/**
 * 取得按讚按鈕的 className，已按讚時附加 liked 樣式。
 * @param {boolean} liked - 是否已按讚。
 * @returns {string} 合併後的 className。
 */
function getLikeButtonClassName(liked) {
  return liked ? `${styles.metaButton} ${styles.liked}` : styles.metaButton;
}

/**
 * 16×16 心形 SVG icon。
 * @param {object} props - Icon 屬性。
 * @param {boolean} props.filled - 是否填滿。
 * @returns {import('react').ReactElement} SVG 元素。
 */
function HeartIcon({ filled }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0
           L12 5.67l-1.06-1.06a5.5 5.5 0 0
           0-7.78 7.78l1.06 1.06L12
           21.23l7.78-7.78 1.06-1.06a5.5
           5.5 0 0 0 0-7.78z"
      />
    </svg>
  );
}

/**
 * 16×16 聊天氣泡 SVG icon。
 * @returns {import('react').ReactElement} SVG 元素。
 */
function ChatIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M21 15a2 2 0 0 1-2 2H7l-4
           4V5a2 2 0 0 1 2-2h14a2 2 0 0
           1 2 2z"
      />
    </svg>
  );
}

/**
 * 三點選單 SVG icon（⋯）。
 * @returns {import('react').ReactElement} SVG 元素。
 */
function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

/**
 * 格式化發文時間，postAt 不存在時回傳空字串。
 * @param {import('firebase/firestore').Timestamp} [postAt] - 發文時間。
 * @returns {string} 相對時間字串。
 */
function getTimeText(postAt) {
  if (!postAt) return '';
  return formatRelativeTime(postAt);
}

/**
 * 文章標題區塊，truncate 模式下為連結，否則為純文字。
 * @param {object} props - 元件屬性。
 * @param {string} props.postId - 文章 ID。
 * @param {string} props.title - 文章標題。
 * @param {boolean} props.truncate - 是否截斷模式。
 * @returns {import('react').ReactElement} 標題元素。
 */
function PostTitle({ postId, title, truncate }) {
  if (truncate) {
    return (
      <h2 className={styles.title}>
        <Link href={`/posts/${postId}`} className={styles.titleLink}>
          {title}
        </Link>
      </h2>
    );
  }
  return <h2 className={styles.title}>{title}</h2>;
}

/**
 * 留言數區塊，truncate 模式下為連結到詳文頁，否則為純 icon + count。
 * @param {object} props - 元件屬性。
 * @param {string} props.postId - 文章 ID。
 * @param {number} props.count - 留言數量。
 * @param {boolean} props.truncate - 是否截斷模式。
 * @returns {import('react').ReactElement} 留言區塊。
 */
function CommentMeta({ postId, count, truncate }) {
  if (truncate) {
    return (
      <Link href={`/posts/${postId}`} className={styles.metaLink}>
        <ChatIcon />
        <span className={styles.metaCount}>{count}</span>
      </Link>
    );
  }
  return (
    <span className={styles.metaButton}>
      <ChatIcon />
      <span className={styles.metaCount}>{count}</span>
    </span>
  );
}

/**
 * 作者操作選單（編輯 / 刪除），僅作者可見。
 * @param {object} props - 元件屬性。
 * @param {string} props.postId - 文章 ID。
 * @param {boolean} props.isOpen - 選單是否展開。
 * @param {(postId: string, e: import('react').MouseEvent) => void} props.onToggleMenu - 切換選單。
 * @param {(postId: string) => void} props.onEdit - 編輯回呼。
 * @param {(postId: string) => void} props.onDelete - 刪除回呼。
 * @returns {import('react').ReactElement} 選單元件。
 */
function OwnerMenu({ postId, isOpen, onToggleMenu, onEdit, onDelete }) {
  return (
    <div className={styles.menuWrapper}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label="更多選項"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => onToggleMenu(postId, e)}
      >
        <MoreIcon />
      </button>
      {isOpen && (
        <ul role="menu" className={styles.menuList}>
          <li>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => onEdit(postId)}
            >
              編輯
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => onDelete(postId)}
            >
              刪除
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

/**
 * @typedef {object} PostCardProps
 * @property {EnrichedPost} post - 文章資料（含 UI flags）。
 * @property {boolean} [truncate] - 是否啟用內容截斷（列表頁 true，詳文頁 false），預設 true。
 * @property {string} [openMenuPostId] - 目前展開選單的文章 ID。
 * @property {(postId: string, e: import('react').MouseEvent) => void} [onToggleMenu] - 切換選單回呼。
 * @property {(postId: string) => void} [onEdit] - 編輯回呼。
 * @property {(postId: string) => void} [onDelete] - 刪除回呼。
 * @property {(postId: string) => void} [onLike] - 按讚回呼。
 * @property {import('react').ReactNode} [children] - 額外內容（詳文頁用，如 ShareButton）。
 * @property {import('react').Key} [key] - React reconciler 專用 key；非元件內部使用的 prop，
 *   但為了讓 JSDoc-based `checkJs` 不誤報 "Property 'key' does not exist on type 'PostCardProps'"，
 *   需明確列出。後續若改用 `React.ComponentProps` / `React.PropsWithChildren` 可移除。
 */

/**
 * 社群風格文章卡片。
 * @param {PostCardProps} props - 元件屬性。
 * @returns {import('react').ReactElement} 文章卡片元件。
 */
export default function PostCard({
  post,
  truncate = true,
  openMenuPostId,
  onToggleMenu,
  onEdit,
  onDelete,
  onLike,
  children,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayName = post.authorName ?? '跑者';
  const timeText = getTimeText(post.postAt);
  const isMenuOpen = openMenuPostId === post.id;
  const likeClassName = getLikeButtonClassName(post.liked);
  const hasContent = !!post.content;
  const contentRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const needsTruncation = hasContent && truncate && post.content.length > TRUNCATE_THRESHOLD;
  const isCollapsed = needsTruncation && !isExpanded;

  /** 量測 scrollHeight 並觸發 max-height CSS transition。 */
  function handleExpand() {
    const el = contentRef.current;
    if (el) {
      el.style.maxHeight = `${el.scrollHeight}px`;
    }
    setIsExpanded(true);
  }

  /** @param {import('react').TransitionEvent<HTMLDivElement>} e - transition 結束事件。 */
  function handleTransitionEnd(e) {
    if (e.propertyName !== 'max-height') return;
    const el = contentRef.current;
    if (el) el.style.maxHeight = 'none';
  }

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.authorInfo}>
          <UserLink
            uid={post.authorUid}
            name={displayName}
            photoURL={post.authorImgURL}
            size={36}
          />
          {timeText && (
            <>
              <span className={styles.dot}>·</span>
              <span className={styles.time}>{timeText}</span>
            </>
          )}
        </div>
        {post.isAuthor && onToggleMenu && onEdit && onDelete && (
          <OwnerMenu
            postId={post.id}
            isOpen={isMenuOpen}
            onToggleMenu={onToggleMenu}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </div>

      <PostTitle postId={post.id} title={post.title} truncate={truncate} />

      {hasContent && (
        <>
          <div
            ref={contentRef}
            className={
              needsTruncation
                ? `${styles.contentWrapper}${isCollapsed ? ` ${styles.contentCollapsed}` : ''}`
                : undefined
            }
            onTransitionEnd={needsTruncation ? handleTransitionEnd : undefined}
          >
            <p className={styles.content}>{post.content}</p>
          </div>
          {isCollapsed && (
            <button type="button" className={styles.expandButton} onClick={handleExpand}>
              ……查看更多
            </button>
          )}
        </>
      )}

      <div className={styles.metaBar}>
        <button
          type="button"
          className={likeClassName}
          onClick={() => onLike?.(post.id)}
          aria-label="按讚"
          aria-pressed={post.liked}
        >
          <HeartIcon filled={post.liked} />
          <span className={styles.metaCount}>{post.likesCount}</span>
        </button>

        <CommentMeta postId={post.id} count={post.commentsCount} truncate={truncate} />
      </div>

      {children}
    </article>
  );
}
