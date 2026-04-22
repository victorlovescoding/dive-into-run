import {
  ISLAND_MARKERS,
  findIslandMarker,
  getWeatherIconUrl,
  formatLocationName,
  formatLocationNameShort,
} from '@/service/weather-location-service';
import {
  saveStoredWeatherLocation,
  loadStoredWeatherLocation,
} from '@/repo/client/weather-location-storage-repo';

export { ISLAND_MARKERS, getWeatherIconUrl, formatLocationName, formatLocationNameShort };

/**
 * @typedef {import('@/service/weather-location-service').StoredLocation} StoredLocation
 */

/**
 * 將地點資訊編碼為 URL query params 字串。
 * URL state 屬於 browser persistence，因此放在 runtime。
 * @param {string} countyCode - 縣市代碼。
 * @param {string | null} townshipCode - 鄉鎮代碼。
 * @returns {string} query string，e.g. "county=63000&township=63000060"。
 */
export function encodeLocationParams(countyCode, townshipCode) {
  const params = new URLSearchParams({ county: countyCode });
  if (townshipCode) {
    params.set('township', townshipCode);
  }
  return params.toString();
}

/**
 * 從 URL query params 解析地點資訊。
 * @param {URLSearchParams} params - URL search params。
 * @returns {{ countyCode: string, townshipCode: string | null } | null} 解析結果或 null。
 */
export function decodeLocationParams(params) {
  const countyCode = params.get('county');
  if (!countyCode) return null;

  return {
    countyCode,
    townshipCode: params.get('township') || null,
  };
}

/**
 * 依目前 URL search 還原 weather location。
 * @param {string} [search] - 測試用 query string override。
 * @returns {{ countyCode: string, townshipCode: string | null } | null} 解析結果。
 */
export function readWeatherLocationFromUrl(search = globalThis.window?.location?.search ?? '') {
  return decodeLocationParams(new URLSearchParams(search));
}

/**
 * 把目前 weather location 寫回瀏覽器 URL。
 * @param {{ countyCode: string, townshipCode: string | null } | null} location - 目前選取地點。
 * @param {object} [options] - 測試用 browser override。
 * @param {string} [options.currentHref] - 目前網址。
 * @param {Pick<History, 'replaceState'>} [options.history] - history override。
 * @returns {string} 寫回後的完整 URL。
 */
export function syncWeatherLocationToUrl(
  location,
  {
    currentHref = globalThis.window?.location?.href ?? 'http://localhost/',
    history = globalThis.window?.history,
  } = {},
) {
  const url = new URL(currentHref);
  url.search = location
    ? encodeLocationParams(location.countyCode, location.townshipCode)
    : '';
  history?.replaceState({}, '', url.toString());
  return url.toString();
}

/**
 * 儲存上次查看地點。
 * @param {StoredLocation} location - 地點資訊。
 * @returns {void}
 */
export function saveLastLocation(location) {
  saveStoredWeatherLocation(location);
}

/**
 * 載入上次查看地點。
 * @returns {StoredLocation | null} 地點資訊。
 */
export function loadLastLocation() {
  return loadStoredWeatherLocation();
}

/**
 * 查找指定縣市/鄉鎮對應的離島 marker。
 * @param {string} countyName - 目標縣市。
 * @param {string} townshipName - 目標鄉鎮。
 * @returns {import('@/service/weather-location-service').IslandMarker | null} 離島 marker。
 */
export function findIslandMarkerByTarget(countyName, townshipName) {
  return findIslandMarker(countyName, townshipName);
}
