import Image from 'next/image';
import {
  formatLocationNameShort,
  getWeatherIconUrl,
} from '@/runtime/client/use-cases/weather-location-use-cases';
import styles from './weather.module.css';

// #region Types
/**
 * @typedef {object} FavoriteItem
 * @property {string} id - Firestore doc ID。
 * @property {string} countyCode - 縣市代碼。
 * @property {string} countyName - 縣市名。
 * @property {string | null} townshipCode - 鄉鎮代碼。
 * @property {string | null} townshipName - 鄉鎮名。
 * @property {string | null} displaySuffix - 後綴。
 */

/**
 * @typedef {object} WeatherSummaryData
 * @property {string} weatherCode - 天氣代碼（圖示用）。
 * @property {number | null} currentTemp - 當前氣溫。
 */
// #endregion

/**
 * 收藏區塊 — 桌面版縱向列表 / 手機版橫向可捲動 chips。
 * @param {object} props - 元件屬性。
 * @param {FavoriteItem[]} props.favorites - 收藏清單。
 * @param {Record<string, WeatherSummaryData>} props.summaries - 各收藏的天氣摘要（key = doc id）。
 * @param {string | null} props.activeId - 當前選中的收藏 ID（高亮用）。
 * @param {(fav: FavoriteItem) => void} props.onSelect - 點擊收藏項回呼。
 * @param {(fav: FavoriteItem) => void} props.onRemove - 點擊移除回呼。
 * @returns {import('react').JSX.Element | null} 收藏區塊或 null。
 */
export default function FavoritesBar({ favorites, summaries, activeId, onSelect, onRemove }) {
  if (!favorites.length) return null;

  return (
    <div className={styles.favoritesBar} role="list" aria-label="收藏地點">
      {favorites.map((fav) => {
        const summary = summaries[fav.id];
        const name = formatLocationNameShort(fav.countyName, fav.townshipName);
        const isActive = fav.id === activeId;

        return (
          <div
            key={fav.id}
            className={isActive ? styles.favoriteChipActive : styles.favoriteChip}
            role="listitem"
          >
            <button
              type="button"
              className={styles.chipSelectButton}
              onClick={() => onSelect(fav)}
              aria-label={`切換到${name}`}
            >
              {summary?.weatherCode && (
                <Image
                  className={styles.chipIcon}
                  src={getWeatherIconUrl(summary.weatherCode)}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                />
              )}
              <span className={styles.chipName}>{name}</span>
              {summary?.currentTemp != null && (
                <span className={styles.chipTemp}>
                  {summary.currentTemp}
                  &deg;
                </span>
              )}
            </button>
            <button
              type="button"
              className={styles.chipRemove}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(fav);
              }}
              aria-label={`移除${name}收藏`}
            >
              &#10005;
            </button>
          </div>
        );
      })}
    </div>
  );
}
