import { formatCommentTime, formatCommentTimeFull } from '@/lib/event-helpers';
import CommentCardMenu from './CommentCardMenu';
import styles from './CommentCard.module.css';

/**
 * @typedef {object} CommentCardProps
 * @property {import('@/lib/firebase-comments').CommentData} comment - 留言資料。
 * @property {boolean} isOwner - 是否為留言作者。
 * @property {boolean} isHighlighted - 是否高亮顯示。
 * @property {(comment: import('@/lib/firebase-comments').CommentData) => void} [onEdit] - 編輯回呼。
 * @property {(comment: import('@/lib/firebase-comments').CommentData) => void} [onDelete] - 刪除回呼。
 * @property {(comment: import('@/lib/firebase-comments').CommentData) => void} [onViewHistory] - 查看編輯記錄回呼。
 */

/**
 * CommentCard — 單則留言卡片（display-only 版本）。
 * 顯示留言者頭像、名稱、時間與留言內容。
 * @param {CommentCardProps} props - Component props.
 * @returns {import('react').ReactElement} 留言卡片元件。
 */
export default function CommentCard({
  comment,
  isOwner,
  isHighlighted,
  onEdit,
  onDelete,
  onViewHistory,
}) {
  // Avatar: 36px circle. If no photoURL, show first char of authorName on purple bg
  const hasPhoto = comment.authorPhotoURL && comment.authorPhotoURL.trim() !== '';
  const initial = comment.authorName ? comment.authorName.charAt(0) : '?';

  // Time formatting
  const timeText = formatCommentTime(comment.createdAt);
  const timeFullText = formatCommentTimeFull(comment.createdAt);
  const isoString = comment.createdAt?.toDate ? comment.createdAt.toDate().toISOString() : '';

  return (
    <article className={`${styles.card} ${isHighlighted ? styles.highlighted : ''}`}>
      <div className={styles.headerRow}>
        <div className={styles.header}>
          {hasPhoto ? (
            <img src={comment.authorPhotoURL} alt="" className={styles.avatar} />
          ) : (
            <div className={styles.avatarFallback}>{initial}</div>
          )}
          <div className={styles.meta}>
            <span className={styles.authorName}>{comment.authorName}</span>
            <time dateTime={isoString} title={timeFullText} className={styles.time}>
              {timeText}
            </time>
            {comment.isEdited && (
              <button
                type="button"
                className={styles.editedBadge}
                aria-label="查看編輯記錄"
                onClick={() => onViewHistory?.(comment)}
              >
                已編輯
              </button>
            )}
          </div>
        </div>
        {isOwner && (
          <CommentCardMenu onEdit={() => onEdit?.(comment)} onDelete={() => onDelete?.(comment)} />
        )}
      </div>
      <p className={styles.content}>{comment.content}</p>
    </article>
  );
}
