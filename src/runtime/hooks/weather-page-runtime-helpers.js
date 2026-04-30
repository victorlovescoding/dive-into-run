/**
 * @typedef {object} SelectedLocation
 * @property {string} countyCode - 縣市代碼。
 * @property {string} countyName - 縣市名。
 * @property {string | null} townshipCode - 鄉鎮代碼。
 * @property {string | null} townshipName - 鄉鎮名。
 * @property {string | null} displaySuffix - 龜山島等特殊後綴。
 */

/**
 * @typedef {object} WeatherGeoLookup
 * @property {Record<string, string>} countyCodeByName - countyName -> countyCode lookup.
 * @property {Record<string, string>} countyNameByCode - countyCode -> countyName lookup.
 * @property {Record<string, { townshipName: string, countyCode: string, countyName: string }>} townshipByCode - townshipCode lookup.
 */

/**
 * 將 location 正規化為頁面使用的 shape。
 * @param {SelectedLocation} location - 原始地點資料。
 * @returns {SelectedLocation} 正規化後地點。
 */
export function normalizeSelectedLocation(location) {
  return {
    countyCode: location.countyCode,
    countyName: location.countyName,
    townshipCode: location.townshipCode ?? null,
    townshipName: location.townshipName ?? null,
    displaySuffix: location.displaySuffix ?? null,
  };
}

/**
 * 從 code-based location 還原完整名稱。
 * @param {{ countyCode: string, countyName?: string, townshipCode: string | null, townshipName?: string | null, displaySuffix?: string | null }} location - 待解析的地點資料。
 * @param {WeatherGeoLookup} geoLookup - 地理 lookup。
 * @returns {SelectedLocation | null} 完整地點資料。
 */
export function resolveWeatherLocation(location, geoLookup) {
  const countyCode = location.countyCode ?? '';
  const countyName = location.countyName || geoLookup.countyNameByCode[countyCode] || '';
  if (!countyName) return null;

  const townshipCode = location.townshipCode ?? null;
  let townshipName = location.townshipName ?? null;
  let resolvedCountyCode = countyCode || geoLookup.countyCodeByName[countyName] || '';

  if (townshipCode && !townshipName) {
    const township = geoLookup.townshipByCode[townshipCode];
    townshipName = township?.townshipName || null;
    resolvedCountyCode = township?.countyCode || resolvedCountyCode;
  }

  return normalizeSelectedLocation({
    countyCode: resolvedCountyCode,
    countyName,
    townshipCode,
    townshipName,
    displaySuffix: location.displaySuffix ?? null,
  });
}
