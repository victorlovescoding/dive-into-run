import Link from 'next/link';
import { formatDateTime } from '@/lib/event-helpers';
import styles from './DashboardEventCard.module.css';

/**
 * 判斷活動是否為即將到來（尚未結束）。
 * @param {import('firebase/firestore').Timestamp} time - 活動舉辦時間。
 * @returns {boolean} 若活動時間在未來回傳 true。
 */
function isUpcoming(time) {
  return time.toMillis() > Date.now();
}

/**
 * 活動卡片元件。
 * @param {object} props - 元件屬性。
 *@param {import('@/lib/firebase-member').MyEventItem} props.event - 活動資料。
 * @param {boolean} props.isHost - 是否為主辦者。
 * @returns {import('react').ReactElement} 活動卡片。
 */
export default function DashboardEventCard({ event, isHost }) {
  const { id, title, time, location, city, participantsCount } = event;
  const dateTimeStr = formatDateTime(time);
  const upcoming = isUpcoming(time);
  const statusLabel = upcoming ? '即將到來' : '已結束';
  const statusClass = upcoming ? styles.upcomingBadge : styles.endedBadge;

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <Link href={`/events/${id}`} className={styles.title}>
          {title}
        </Link>
        {isHost && <span className={`${styles.badge} ${styles.hostBadge}`}>主辦</span>}
        <span className={`${styles.badge} ${statusClass}`}>{statusLabel}</span>
      </div>
      <div className={styles.meta}>
        <span>{dateTimeStr}</span>
        <span>
          {city} {location}
        </span>
        <span>{participantsCount} 人已報名</span>
      </div>
    </article>
  );
}
