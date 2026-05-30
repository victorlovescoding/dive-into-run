import { useId } from 'react';
import Image from 'next/image';
import { getWeatherIconUrl } from '@/runtime/client/use-cases/weather-location-use-cases';
import styles from './weather.module.css';
import { getWeatherMetricAdvice } from './weather-standards';

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
 * Simple today metric cell.
 * @param {object} props - 元件屬性。
 * @param {string} props.id - Stable test id suffix.
 * @param {string} props.value - Display value.
 * @param {string} props.label - Display label.
 * @returns {import('react').JSX.Element} Metric cell.
 */
function MetricCell({ id, value, label }) {
  return (
    <div className={styles.metricItem} data-testid={`weather-metric-${id}`}>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricLabel}>{label}</div>
    </div>
  );
}

/**
 * Enhanced UV/AQI metric cell with closed standards entry point.
 * @param {object} props - 元件屬性。
 * @param {'uv' | 'aqi'} props.metric - Standards metric key.
 * @param {string} props.label - Display label.
 * @param {number} props.value - Display value.
 * @param {string} props.levelOrStatus - Official level/status from weather data.
 * @param {string} props.infoButtonLabel - Accessible info button label.
 * @param {string} props.controlId - Stable per-card controlled overlay id.
 * @returns {import('react').JSX.Element} Enhanced metric cell.
 */
function WeatherStandardMetric({ metric, label, value, levelOrStatus, infoButtonLabel, controlId }) {
  const advice = getWeatherMetricAdvice(metric, levelOrStatus);

  return (
    <div className={styles.enhancedMetricItem} data-testid={`weather-metric-${metric}`}>
      <div className={styles.enhancedMetricHeader}>
        <div>
          <div className={styles.metricValue}>{formatMetric(value)}</div>
          <div className={styles.metricLabel}>{label}</div>
        </div>
        <button
          type="button"
          className={styles.metricInfoButton}
          aria-label={infoButtonLabel}
          aria-controls={controlId}
          aria-expanded="false"
        >
          <span aria-hidden="true">i</span>
        </button>
      </div>
      <div className={styles.metricStandardText}>{levelOrStatus}</div>
      {advice ? <div className={styles.metricAdvice}>{advice}</div> : null}
    </div>
  );
}

/**
 * 今日四項天氣指標（降雨/濕度/UV/AQI）。
 * @param {object} props - 元件屬性。
 * @param {TodayWeather} props.today - 今日天氣資料。
 * @param {{ uv: string, aqi: string }} props.standardControlIds - Per-card overlay ids.
 * @returns {import('react').JSX.Element} 指標列。
 */
function TodayMetrics({ today, standardControlIds }) {
  const { rainProb, humidity, uv, aqi } = today;
  return (
    <div className={styles.metricsRow}>
      <MetricCell id="rain" value={formatMetric(rainProb, '%')} label="降雨" />
      <MetricCell id="humidity" value={formatMetric(humidity, '%')} label="濕度" />
      {uv ? (
        <WeatherStandardMetric
          metric="uv"
          label="紫外線"
          value={uv.value}
          levelOrStatus={uv.level}
          infoButtonLabel="查看紫外線等級說明"
          controlId={standardControlIds.uv}
        />
      ) : (
        <MetricCell id="uv" value={'\u2014'} label="紫外線" />
      )}
      {aqi ? (
        <WeatherStandardMetric
          metric="aqi"
          label="AQI"
          value={aqi.value}
          levelOrStatus={aqi.status}
          infoButtonLabel="查看 AQI 等級說明"
          controlId={standardControlIds.aqi}
        />
      ) : (
        <MetricCell id="aqi" value={'\u2014'} label="AQI" />
      )}
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
  const standardControlIdBase = useId();
  const period = getCurrentPeriod();
  const iconUrl = getWeatherIconUrl(today.weatherCode, period);
  const standardControlIds = {
    uv: `${standardControlIdBase}-weather-standard-popover-uv`,
    aqi: `${standardControlIdBase}-weather-standard-popover-aqi`,
  };

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

      <TodayMetrics today={today} standardControlIds={standardControlIds} />
      <TomorrowSection tomorrow={tomorrow} />
    </div>
  );
}
