import Link from 'next/link';
import { formatDateTime } from '@/lib/event-helpers';
import styles from './DashboardCommentCard.module.css';

/**
 * 根據來源類型取得 badge 顯示資訊。
 * @param {'post' | 'event'} source - 來源類型。
 * @returns {{ label: string, className: string, pathPrefix: string }} badge 資訊。
 */
function getSourceMeta(source) {
  if (source === 'event') {
    return { label: '活動', className: styles.badgeEvent, pathPrefix: '/events/' };
  }
  return { label: '文章', className: styles.badgePost, pathPrefix: '/posts/' };
}

/**
 * 留言卡片元件。
 * @param {object} props - 元件屬性。
 * @param {import('@/lib/firebase-member').MyCommentItem} props.comment - 留言資料。
 * @returns {import('react').ReactElement} 留言卡片。
 */
export default function DashboardCommentCard({ comment }) {
  const { source, parentId, parentTitle, text, createdAt } = comment;
  const { label, className: badgeClass, pathPrefix } = getSourceMeta(source);
  const formattedTime = formatDateTime(createdAt);

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <span className={`${styles.badge} ${badgeClass}`}>{label}</span>
        <Link href={`${pathPrefix}${parentId}`} className={styles.titleLink}>
          {parentTitle}
        </Link>
      </div>
      <p className={styles.lineClamp}>{text}</p>
      <p className={styles.time}>{formattedTime}</p>
    </article>
  );
}
