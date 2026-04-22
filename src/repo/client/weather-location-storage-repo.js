const STORAGE_KEY = 'dive-weather-last-location';

/**
 * @typedef {import('@/service/weather-location-service').StoredLocation} StoredLocation
 */

/**
 * 儲存上次查看地點到 localStorage。
 * side effect 留在 repo，讓上層只處理 location state。
 * @param {StoredLocation} location - 地點資訊。
 * @param {Pick<Storage, 'setItem'>} [storage] - 測試用 storage override。
 * @returns {void}
 */
export function saveStoredWeatherLocation(location, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch {
    // localStorage 不可用（private browsing 等），靜默失敗
  }
}

/**
 * 從 localStorage 讀取上次查看地點。
 * @param {Pick<Storage, 'getItem'>} [storage] - 測試用 storage override。
 * @returns {StoredLocation | null} 地點資訊或 null。
 */
export function loadStoredWeatherLocation(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return /** @type {StoredLocation} */ (JSON.parse(raw));
  } catch {
    return null;
  }
}
