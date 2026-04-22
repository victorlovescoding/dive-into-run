import Image from 'next/image';
import { getWeatherIconUrl } from '@/lib/weather-helpers';
import styles from './weather.module.css';

/** @typedef {import('@/types/weather-types').TodayWeather} TodayWeather */
/** @typedef {import('@/types/weather-types').TomorrowWeather} TomorrowWeather */

// #region Helpers

/**
 * 格式化指標數值，null 時顯示 "—"。
 * @param {number | null | undefined} value - 數值。
 * @param {string} [suffix] - 後綴，e.g. "%"。
 * @returns {string} 格式化後的字串。
 */
function formatMetric(value, suffix = '') {
  if (value == null) return '\u2014';
  return `${value}${suffix}`;
}

/**
 * 判斷當前是否為白天（06:00-18:00）。
 * @returns {'day' | 'night'} 日夜時段。
 */
function getCurrentPeriod() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}
// #endregion

// #region Sub-components
/**
 * 今日四項天氣指標（降雨/濕度/UV/AQI）。
 * @param {object} props - 元件屬性。
 * @param {TodayWeather} props.today - 今日天氣資料。
 * @returns {import('react').JSX.Element} 指標列。
 */
function TodayMetrics({ today }) {
  const { rainProb, humidity, uv, aqi } = today;
  return (
    <div className={styles.metricsRow}>
      <div className={styles.metricItem}>
        <div className={styles.metricValue}>{formatMetric(rainProb, '%')}</div>
        <div className={styles.metricLabel}>降雨</div>
      </div>
      <div className={styles.metricItem}>
        <div className={styles.metricValue}>{formatMetric(humidity, '%')}</div>
        <div className={styles.metricLabel}>濕度</div>
      </div>
      <div className={styles.metricItem}>
        <div className={styles.metricValue}>{uv ? formatMetric(uv.value) : '\u2014'}</div>
        <div className={styles.metricLabel}>紫外線</div>
      </div>
      <div className={styles.metricItem}>
        <div className={styles.metricValue}>{aqi ? formatMetric(aqi.value) : '\u2014'}</div>
        <div className={styles.metricLabel}>AQI</div>
      </div>
    </div>
  );
}

/**
 * 明日天氣摘要區塊。
 * @param {object} props - 元件屬性。
 * @param {TomorrowWeather} props.tomorrow - 明日天氣資料。
 * @returns {import('react').JSX.Element} 明日區塊。
 */
function TomorrowSection({ tomorrow }) {
  const period = getCurrentPeriod();
  const iconUrl = getWeatherIconUrl(tomorrow.weatherCode, period);
  const { morningTemp, eveningTemp, rainProb, humidity, uv } = tomorrow;
  const uvText = uv ? `${uv.value} ${uv.level}` : '\u2014';

  return (
    <div className={styles.tomorrowSection}>
      <div className={styles.tomorrowTitle}>明日</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Image
          className={styles.weatherIcon}
          src={iconUrl}
          alt={tomorrow.weatherDesc}
          width={32}
          height={32}
          style={{ width: 32, height: 32 }}
          unoptimized
        />
        <span>{tomorrow.weatherDesc}</span>
        <span className={styles.tempItem}>
          <span aria-hidden="true">{'\u2600\uFE0F'}</span>
          <span className="sr-only">早上</span> {morningTemp}°
        </span>
        <span className={styles.tempItem}>
          <span aria-hidden="true">{'\uD83C\uDF19'}</span>
          <span className="sr-only">晚上</span> {eveningTemp}°
        </span>
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: 0.8 }}>
        降雨 {formatMetric(rainProb, '%')} · 濕度 {formatMetric(humidity, '%')} · UV {uvText}
      </div>
    </div>
  );
}
// #endregion

/**
 * 天氣資訊卡 — 顯示今日完整天氣 + 明日摘要。
 * @param {object} props - 元件屬性。
 * @param {string} props.locationName - 地點全名。
 * @param {TodayWeather} props.today - 今日天氣。
 * @param {TomorrowWeather} props.tomorrow - 明日天氣。
 * @returns {import('react').JSX.Element} 天氣卡元件。
 */
export default function WeatherCard({ locationName, today, tomorrow }) {
  const period = getCurrentPeriod();
  const iconUrl = getWeatherIconUrl(today.weatherCode, period);

  return (
    <div className={styles.weatherCard} style={{ position: 'relative' }}>
      <div className={styles.locationName}>{locationName}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
        <Image
          className={styles.weatherIcon}
          src={iconUrl}
          alt={today.weatherDesc}
          width={64}
          height={64}
          unoptimized
        />
        <div className={styles.temperature} data-testid="current-temperature">
          {today.currentTemp}°
        </div>
      </div>

      <div className={styles.weatherDesc}>{today.weatherDesc}</div>

      <div className={styles.tempRange}>
        <span className={styles.tempItem}>
          <span aria-hidden="true">{'\u2600\uFE0F'}</span>
          <span className="sr-only">早上</span> {today.morningTemp}°
        </span>
        <span className={styles.tempItem}>
          <span aria-hidden="true">{'\uD83C\uDF19'}</span>
          <span className="sr-only">晚上</span> {today.eveningTemp}°
        </span>
      </div>

      <TodayMetrics today={today} />
      <TomorrowSection tomorrow={tomorrow} />
    </div>
  );
}
