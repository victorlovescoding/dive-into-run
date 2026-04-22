import {
  fetchTaiwanCityNames,
  fetchTaiwanDistrictNames,
} from '@/repo/client/taiwan-location-repo';

/**
 * 取得 events page 用的縣市選項。
 * @returns {string[]} 縣市列表。
 */
export function listTaiwanCities() {
  return fetchTaiwanCityNames();
}

/**
 * 取得指定縣市的行政區選項。
 * @param {string} city - 縣市名稱。
 * @returns {string[]} 行政區列表。
 */
export function listTaiwanDistricts(city) {
  return fetchTaiwanDistrictNames(city);
}
