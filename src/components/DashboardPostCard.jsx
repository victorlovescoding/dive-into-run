import Link from 'next/link';
import { formatDateTime } from '@/lib/event-helpers';
import styles from './DashboardPostCard.module.css';

/**
 * 文章卡片元件。
 * @param {object} props - 元件屬性。
 * @param {import('@/lib/firebase-posts').Post} props.post - 文章資料。
 * @returns {import('react').ReactElement} 文章卡片。
 */
export default function DashboardPostCard({ post }) {
  const { id, title, postAt, likesCount, commentsCount } = post;
  const formattedDate = formatDateTime(postAt);

  return (
    <article className={styles.card}>
      <h3 className={styles.title}>
        <Link className={styles.titleLink} href={`/posts/${id}`}>
          {title}
        </Link>
      </h3>
      <p className={styles.date}>{formattedDate}</p>
      <div className={styles.stats}>
        <span>{`讚 ${likesCount ?? 0}`}</span>
        <span>{`留言 ${commentsCount ?? 0}`}</span>
      </div>
    </article>
  );
}
