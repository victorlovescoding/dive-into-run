import { formatCommentTime, formatCommentTimeFull } from '@/lib/event-helpers';
import UserLink from './UserLink';
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
 * @property {import('react').Key} [key] - React reconciler 專用 key；同 PostCardProps 的說明，
 *   為了讓 JSDoc-based `checkJs` 不誤報 "Property 'key' does not exist" 而列出。
 */

/**
 * 將 Firestore Timestamp 轉為 ISO 字串，供 `<time dateTime>` 使用。
 * @param {import('firebase/firestore').Timestamp | null | undefined} timestamp - Firestore 時間戳。
 * @returns {string} ISO 字串，無效時回傳空字串。
 */
function toIsoString(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '';
  return timestamp.toDate().toISOString();
}

/**
 * CommentCard — 單則留言卡片（display-only 版本）。
 * 顯示留言者頭像、名稱、時間與留言內容；頭像與名稱透過 `UserLink`
 * 連結至作者的公開檔案頁面。
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
  const timeText = formatCommentTime(comment.createdAt);
  const timeFullText = formatCommentTimeFull(comment.createdAt);
  const isoString = toIsoString(comment.createdAt);

  return (
    <article className={`${styles.card} ${isHighlighted ? styles.highlighted : ''}`}>
      <div className={styles.headerRow}>
        <div className={styles.header}>
          <UserLink
            uid={comment.authorUid}
            name={comment.authorName}
            photoURL={comment.authorPhotoURL}
            size={36}
            className={styles.authorLink}
          />
          <div className={styles.meta}>
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
