import styles from './weather.module.css';

/**
 * 天氣卡空狀態 — 尚未選擇地區時的引導提示。
 * @returns {import('react').JSX.Element} 空狀態元件。
 */
export default function WeatherCardEmpty() {
  return (
    <div className={styles.weatherCard}>
      <div className={styles.emptyState}>
        <svg
          className={styles.emptyIcon}
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Simple map pin + cloud icon — Soft Sky style */}
          <circle cx="40" cy="32" r="16" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M40 48 L40 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="40" cy="64" r="3" fill="currentColor" />
          <path
            d="M20 20 Q25 12 35 14 Q38 6 48 8 Q58 10 58 20 Q64 20 64 26 Q64 32 56 32 L24 32 Q16 32 16 26 Q16 20 20 20Z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            opacity="0.4"
          />
        </svg>
        <p className={styles.emptyText}>請先在地圖上選擇想查詢的地區</p>
      </div>
    </div>
  );
}
