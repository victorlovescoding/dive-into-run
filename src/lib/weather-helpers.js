// #region JSDoc Type Definitions
/**
 * 小離島標示資料（硬編碼常數）。
 * @typedef {object} IslandMarker
 * @property {string} id - 唯一識別，e.g. "lanyu"。
 * @property {string} displayName - 地圖上顯示名，e.g. "蘭嶼"。
 * @property {number} lat - 緯度。
 * @property {number} lng - 經度。
 * @property {string} targetCounty - 路由目標縣市名，e.g. "臺東縣"。
 * @property {string} targetTownship - 路由目標鄉鎮名，e.g. "蘭嶼鄉"。
 * @property {string | null} displaySuffix - 特殊顯示後綴（僅龜山島有 "（含龜山島）"）。
 * @property {number | null} polygonIndex - 在 MultiPolygon 中的子多邊形索引（龜山島 = 0），null 代表整個 township 即為該島。
 */

/**
 * localStorage 儲存的地點資訊。
 * @typedef {object} StoredLocation
 * @property {string} countyCode - 縣市代碼。
 * @property {string} countyName - 縣市名。
 * @property {string | null} townshipCode - 鄉鎮代碼。
 * @property {string | null} townshipName - 鄉鎮名。
 * @property {string | null} [displaySuffix] - 龜山島後綴。
 */
// #endregion

// #region COUNTY_FORECAST_IDS
/** @type {Record<string, {threeHour: string, twelveHour: string}>} */
const COUNTY_FORECAST_IDS = {
  宜蘭縣: { threeHour: 'F-D0047-001', twelveHour: 'F-D0047-003' },
  桃園市: { threeHour: 'F-D0047-005', twelveHour: 'F-D0047-007' },
  新竹縣: { threeHour: 'F-D0047-009', twelveHour: 'F-D0047-011' },
  苗栗縣: { threeHour: 'F-D0047-013', twelveHour: 'F-D0047-015' },
  彰化縣: { threeHour: 'F-D0047-017', twelveHour: 'F-D0047-019' },
  南投縣: { threeHour: 'F-D0047-021', twelveHour: 'F-D0047-023' },
  雲林縣: { threeHour: 'F-D0047-025', twelveHour: 'F-D0047-027' },
  嘉義縣: { threeHour: 'F-D0047-029', twelveHour: 'F-D0047-031' },
  屏東縣: { threeHour: 'F-D0047-033', twelveHour: 'F-D0047-035' },
  臺東縣: { threeHour: 'F-D0047-037', twelveHour: 'F-D0047-039' },
  花蓮縣: { threeHour: 'F-D0047-041', twelveHour: 'F-D0047-043' },
  澎湖縣: { threeHour: 'F-D0047-045', twelveHour: 'F-D0047-047' },
  基隆市: { threeHour: 'F-D0047-049', twelveHour: 'F-D0047-051' },
  新竹市: { threeHour: 'F-D0047-053', twelveHour: 'F-D0047-055' },
  嘉義市: { threeHour: 'F-D0047-057', twelveHour: 'F-D0047-059' },
  臺北市: { threeHour: 'F-D0047-061', twelveHour: 'F-D0047-063' },
  高雄市: { threeHour: 'F-D0047-065', twelveHour: 'F-D0047-067' },
  新北市: { threeHour: 'F-D0047-069', twelveHour: 'F-D0047-071' },
  臺中市: { threeHour: 'F-D0047-073', twelveHour: 'F-D0047-075' },
  臺南市: { threeHour: 'F-D0047-077', twelveHour: 'F-D0047-079' },
  連江縣: { threeHour: 'F-D0047-081', twelveHour: 'F-D0047-083' },
  金門縣: { threeHour: 'F-D0047-085', twelveHour: 'F-D0047-087' },
};

/**
 * 取得縣市的 CWA 預報 dataset ID。
 * @param {string} countyName - 縣市全名，e.g. "臺北市"。
 * @returns {{ threeHour: string, twelveHour: string } | null} dataset IDs 或 null。
 */
export function getForecastIds(countyName) {
  return COUNTY_FORECAST_IDS[countyName] ?? null;
}
// #endregion

// #region ISLAND_MARKERS
/** @type {IslandMarker[]} */
export const ISLAND_MARKERS = [
  {
    id: 'lanyu',
    displayName: '蘭嶼',
    lat: 22.05,
    lng: 121.55,
    targetCounty: '臺東縣',
    targetTownship: '蘭嶼鄉',
    displaySuffix: null,
    polygonIndex: null,
  },
  {
    id: 'ludao',
    displayName: '綠島',
    lat: 22.66,
    lng: 121.49,
    targetCounty: '臺東縣',
    targetTownship: '綠島鄉',
    displaySuffix: null,
    polygonIndex: null,
  },
  {
    id: 'xiaoliuqiu',
    displayName: '小琉球',
    lat: 22.34,
    lng: 120.37,
    targetCounty: '屏東縣',
    targetTownship: '琉球鄉',
    displaySuffix: null,
    polygonIndex: null,
  },
  {
    id: 'guishandao',
    displayName: '龜山島',
    lat: 24.84,
    lng: 121.95,
    targetCounty: '宜蘭縣',
    targetTownship: '頭城鎮',
    displaySuffix: '（含龜山島）',
    polygonIndex: 0,
  },
];
// #endregion

// #region Weather icon
/**
 * 取得 CWA 天氣圖示 URL。
 * @param {string} weatherCode - 天氣代碼。
 * @param {'day' | 'night'} [period] - 日夜時段。未提供時依當前時間自動判斷。
 * @returns {string} 圖示 URL。
 */
export function getWeatherIconUrl(weatherCode, period) {
  let resolvedPeriod = period;
  if (!resolvedPeriod) {
    const hour = new Date().getHours();
    resolvedPeriod = hour >= 6 && hour < 18 ? 'day' : 'night';
  }
  const code = String(weatherCode).padStart(2, '0');
  return `https://www.cwa.gov.tw/V8/assets/img/weather_icons/weathers/svg_icon/${resolvedPeriod}/${code}.svg`;
}
// #endregion

// #region Name formatting
/**
 * 去除縣市後綴（縣/市）取得縮寫。
 * @param {string} name - 縣市全名，e.g. "臺北市"。
 * @returns {string} 縮寫，e.g. "臺北"。
 */
export function countyShort(name) {
  return name.replace(/[縣市]$/, '');
}

/**
 * 去除鄉鎮後綴（區/鄉/鎮/市）取得縮寫。
 * @param {string} name - 鄉鎮全名，e.g. "大安區"。
 * @returns {string} 縮寫，e.g. "大安"。
 */
export function townshipShort(name) {
  return name.replace(/[區鄉鎮市]$/, '');
}

/**
 * 格式化地點顯示名稱（全名）。
 * @param {string} countyName - 縣市名。
 * @param {string | null} townshipName - 鄉鎮名。
 * @param {string | null} [displaySuffix] - 顯示後綴。
 * @returns {string} 格式化名稱，e.g. "臺東縣 · 蘭嶼鄉"。
 */
export function formatLocationName(countyName, townshipName, displaySuffix) {
  if (!townshipName) return countyName;
  const base = `${countyName} · ${townshipName}`;
  return displaySuffix ? `${base}${displaySuffix}` : base;
}

/**
 * 格式化地點顯示名稱（手機版縮寫）。
 * @param {string} countyName - 縣市名。
 * @param {string | null} townshipName - 鄉鎮名。
 * @returns {string} 格式化縮寫，e.g. "臺東 · 蘭嶼"。
 */
export function formatLocationNameShort(countyName, townshipName) {
  if (!townshipName) return countyShort(countyName);
  return `${countyShort(countyName)} · ${townshipShort(townshipName)}`;
}
// #endregion

// #region URL param encode/decode
/**
 * 將地點資訊編碼為 URL query params 字串。
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
  const townshipCode = params.get('township') || null;
  return { countyCode, townshipCode };
}
// #endregion

// #region localStorage helpers
const STORAGE_KEY = 'dive-weather-last-location';

/**
 * 儲存上次查看地點到 localStorage。
 * @param {StoredLocation} location - 地點資訊。
 * @returns {void}
 */
export function saveLastLocation(location) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch {
    // localStorage 不可用（private browsing 等），靜默失敗
  }
}

/**
 * 從 localStorage 讀取上次查看地點。
 * @returns {StoredLocation | null} 地點資訊或 null。
 */
export function loadLastLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return /** @type {StoredLocation} */ (JSON.parse(raw));
  } catch {
    return null;
  }
}
// #endregion
