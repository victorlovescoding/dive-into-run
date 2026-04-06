import { formatDistance, formatPace, formatDuration } from '@/lib/strava-helpers';
import RunsRouteMap from '@/components/RunsRouteMap';
import styles from './RunsActivityCard.module.css';

/**
 * @typedef {object} StravaActivityShape
 * @property {string} id - Firestore document ID。
 * @property {string} uid - 使用者 UID。
 * @property {number} stravaId - Strava activity ID。
 * @property {string} name - 活動名稱。
 * @property {string} type - 活動類型（如 "Run"）。
 * @property {number} distanceMeters - 距離（公尺）。
 * @property {number} movingTimeSec - 移動時間（秒）。
 * @property {{ toDate: () => Date }} startDate - 活動開始時間（Firestore Timestamp）。
 * @property {string} startDateLocal - 活動本地開始時間 ISO 字串。
 * @property {string | null} summaryPolyline - 路線 polyline 編碼字串。
 * @property {number} averageSpeed - 平均速度（m/s）。
 * @property {{ toDate: () => Date }} syncedAt - 同步時間（Firestore Timestamp）。
 */

/**
 * @typedef {object} RunsActivityCardProps
 * @property {StravaActivityShape} activity - Strava 活動資料。
 */

/**
 * 從 startDateLocal 提取日期部分 (YYYY-MM-DD)。
 * @param {string} startDateLocal - ISO 格式本地時間字串。
 * @returns {string} 日期字串，如 "2026-04-01"。
 */
function extractDate(startDateLocal) {
  return startDateLocal.slice(0, 10);
}

/**
 * RunsActivityCard — 單筆跑步活動卡片。
 * 顯示活動名稱、日期、距離/配速/時間三欄統計，以及路線地圖（如有 polyline）。
 * @param {RunsActivityCardProps} props - Component props.
 * @returns {import('react').ReactElement} 活動卡片元件。
 */
export default function RunsActivityCard({ activity }) {
  const distance = formatDistance(activity.distanceMeters);
  const pace = formatPace(activity.movingTimeSec, activity.distanceMeters);
  const duration = formatDuration(activity.movingTimeSec);
  const dateStr = extractDate(activity.startDateLocal);
  const hasRoute = Boolean(activity.summaryPolyline);

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.name}>{activity.name}</h3>
        <time className={styles.date} dateTime={activity.startDateLocal}>
          {dateStr}
        </time>
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>距離</span>
          <span className={styles.statValue}>{distance}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>配速</span>
          <span className={styles.statValue}>{pace}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>時間</span>
          <span className={styles.statValue}>{duration}</span>
        </div>
      </div>

      {hasRoute && <RunsRouteMap summaryPolyline={activity.summaryPolyline} />}
    </article>
  );
}
