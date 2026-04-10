'use client';

import styles from './PublicProfile.module.css';

/**
 * @typedef {object} ProfileStatsData
 * @property {number} hostedCount - 主辦活動數量。
 * @property {number} joinedCount - 參加活動數量。
 * @property {number | null} totalDistanceKm - 累計跑步公里數；`null` 代表未連結 Strava，
 *   此時整個公里數欄位完全隱藏（依 spec clarification 2026-04-09）。
 */

/**
 * 將公里數數值正規化為顯示字串，並保留 `42.7` / `100` 這類人類可讀格式。
 *
 * 設計：
 * 1. 若小數點後第一位為 0（例如 `100.0`），直接顯示整數以避免拖尾零。
 * 2. 若有小數，保留一位小數（符合 Strava 原生顯示精度）。
 * 3. 0 km 仍會顯示 `0 km`（這裡不做「隱藏」處理，隱藏交給父層判斷 null）。
 * @param {number} km - 公里數。
 * @returns {string} 顯示字串（含單位）。
 */
function formatKilometers(km) {
  const rounded = Math.round(km * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} km`;
}

/**
 * 公開檔案統計卡片：呈現開團數 / 參團數 / 累計公里數三欄。
 *
 * 設計重點：
 * 1. `totalDistanceKm === null` 時整個累計公里欄位不渲染（連 label 都不輸出），
 *    確保 UI 不會暴露「未連結 Strava」的狀態給其他使用者。
 * 2. `totalDistanceKm === 0` 時顯示 `0 km`（使用者已連結 Strava 但沒紀錄）。
 * 3. count 欄位即使為 0 也顯示 `0`（不隱藏）。
 * @param {object} props - 元件屬性。
 * @param {ProfileStatsData} props.stats - 統計數據。
 * @returns {import('react').ReactElement} 統計卡片。
 */
export default function ProfileStats({ stats }) {
  const { hostedCount, joinedCount, totalDistanceKm } = stats;
  const showDistance = totalDistanceKm !== null;
  const distanceText = showDistance ? formatKilometers(totalDistanceKm) : '';

  return (
    <section className={styles.stats} aria-label="使用者統計">
      <div className={styles.statItem}>
        <span className={styles.statValue}>{hostedCount}</span>
        <span className={styles.statLabel}>開團數</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statValue}>{joinedCount}</span>
        <span className={styles.statLabel}>參團數</span>
      </div>
      {showDistance && (
        <div className={styles.statItem}>
          <span className={styles.statValue}>{distanceText}</span>
          <span className={styles.statLabel}>累計距離</span>
        </div>
      )}
    </section>
  );
}
