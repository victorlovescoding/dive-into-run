import styles from './weather.module.css';

/**
 * 天氣卡錯誤狀態 — 載入失敗時顯示錯誤提示和重試按鈕。
 * @param {object} props - 元件屬性。
 * @param {() => void} props.onRetry - 重試回呼函式。
 * @returns {import('react').JSX.Element} 錯誤狀態元件。
 */
export default function WeatherCardError({ onRetry }) {
  return (
    <div className={styles.weatherCard}>
      <div className={styles.errorState} role="alert">
        <p className={styles.errorText}>無法取得天氣資料，請稍後再試</p>
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          重試
        </button>
      </div>
    </div>
  );
}
