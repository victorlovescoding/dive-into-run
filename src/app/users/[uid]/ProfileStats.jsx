'use client';

import styles from './PublicProfile.module.css';

/**
 * @typedef {object} ProfileStatsData
 * @property {number} hostedCount - 主辦活動數量。
 * @property {number} joinedCount - 參加活動數量。
 * @property {number} followersCount - 粉絲數。
 * @property {number} followingCount - 追蹤中數。
 * @property {number | null} totalDistanceKm - 累計跑步公里數。
 */

/**
 * Renders one stat cell.
 * @param {object} props - Stat props.
 * @param {number} props.value - Stat value.
 * @param {string} props.label - Stat label.
 * @param {() => void} [props.onClick] - Optional click handler.
 * @returns {import('react').ReactElement} Stat item.
 */
function StatItem({ value, label, onClick }) {
  const content = (
    <>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`${styles.statItem} ${styles.statButton}`} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={styles.statItem}>{content}</div>;
}

/**
 * 公開檔案統計：呈現開團 / 參團 / 粉絲 / 追蹤中四欄。
 * @param {object} props - 元件屬性。
 * @param {ProfileStatsData} props.stats - 統計數據。
 * @param {() => void} props.onOpenFollowers - Open followers modal.
 * @param {() => void} props.onOpenFollowing - Open following modal.
 * @returns {import('react').ReactElement} 統計卡片。
 */
export default function ProfileStats({ stats, onOpenFollowers, onOpenFollowing }) {
  const { hostedCount, joinedCount, followersCount, followingCount } = stats;

  return (
    <section className={styles.stats} aria-label="使用者統計">
      <StatItem value={hostedCount} label="開團" />
      <StatItem value={joinedCount} label="參團" />
      <StatItem value={followersCount} label="粉絲" onClick={onOpenFollowers} />
      <StatItem value={followingCount} label="追蹤中" onClick={onOpenFollowing} />
    </section>
  );
}
