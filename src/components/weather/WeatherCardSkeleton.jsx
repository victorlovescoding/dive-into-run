import styles from './weather.module.css';

/**
 * 天氣卡骨架佔位 — 載入中顯示 shimmer 動畫。
 * @returns {import('react').JSX.Element} 骨架元件。
 */
export default function WeatherCardSkeleton() {
  return (
    <div className={styles.weatherCard} aria-busy="true" aria-label="天氣資料載入中">
      {/* Location name skeleton */}
      <div className={styles.skeletonText} style={{ width: '40%' }} />
      {/* Temperature skeleton */}
      <div className={styles.skeletonTemp} />
      {/* Weather desc skeleton */}
      <div className={styles.skeletonText} style={{ width: '60%' }} />
      {/* Temp range skeleton */}
      <div className={styles.skeletonText} style={{ width: '50%', marginTop: '0.75rem' }} />
      {/* Metrics row skeleton */}
      <div className={styles.metricsRow}>
        <div className={styles.skeletonMetric} />
        <div className={styles.skeletonMetric} />
        <div className={styles.skeletonMetric} />
        <div className={styles.skeletonMetric} />
      </div>
      {/* Tomorrow section skeleton */}
      <div className={styles.tomorrowSection}>
        <div className={styles.skeletonText} style={{ width: '30%' }} />
        <div className={styles.skeletonText} style={{ width: '70%' }} />
      </div>
    </div>
  );
}
