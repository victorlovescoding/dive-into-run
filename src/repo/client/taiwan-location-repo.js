import taiwanLocations from '@/config/geo/taiwan-locations';

/**
 * 取得所有台灣縣市名稱。
 * config 常數透過 repo 暴露，避免 runtime 直接依賴 config。
 * @returns {string[]} 縣市列表。
 */
export function fetchTaiwanCityNames() {
  return Object.keys(taiwanLocations);
}

/**
 * 取得某縣市底下的行政區列表。
 * @param {string} city - 縣市名稱。
 * @returns {string[]} 行政區列表。
 */
export function fetchTaiwanDistrictNames(city) {
  if (!city) return [];
  return [...(taiwanLocations[city] ?? [])];
}
