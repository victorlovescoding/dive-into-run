import { getForecastIds } from '@/service/weather-location-service';

/** @typedef {import('@/types/weather-types').UvInfo} UvInfo */
/** @typedef {import('@/types/weather-types').AqiInfo} AqiInfo */

/**
 * @typedef {object} CountyTimePeriod
 * @property {string} startTime 此時段的開始時間。
 * @property {string} endTime 此時段的結束時間。
 * @property {{ parameterName: string, parameterValue?: string }} parameter 此時段的觀測值與代碼。
 */

/**
 * @typedef {object} CountyWeatherElement
 * @property {string} elementName CWA 的天氣元素名稱。
 * @property {CountyTimePeriod[]} time 該元素的時段資料清單。
 */

/**
 * @typedef {object} CountyLocation
 * @property {CountyWeatherElement[]} weatherElement 縣市層級的天氣元素清單。
 */

/**
 * @typedef {object} CountyForecastResponse
 * @property {{ location: CountyLocation[] }} records CWA 縣市資料的 records payload。
 */

/**
 * @typedef {object} TownshipTimePeriod
 * @property {string} [DataTime] 單點資料的資料時間。
 * @property {string} [StartTime] 區間資料的開始時間。
 * @property {string} [EndTime] 區間資料的結束時間。
 * @property {Array<Record<string, string>>} [ElementValue] 該時段的元素值清單。
 */

/**
 * @typedef {object} TownshipWeatherElement
 * @property {string} ElementName 鄉鎮層級的天氣元素名稱。
 * @property {TownshipTimePeriod[]} Time 該元素的時段資料清單。
 */

/**
 * @typedef {object} TownshipLocation
 * @property {string} [LocationName] 鄉鎮名稱。
 * @property {TownshipWeatherElement[]} WeatherElement 鄉鎮層級的天氣元素清單。
 */

/**
 * @typedef {object} TownshipForecastResponse
 * @property {{ Locations: Array<{ Location: TownshipLocation[] }> }} records CWA 鄉鎮資料的 records payload。
 */

/**
 * @typedef {object} EpaAqiStation
 * @property {string} county 測站所屬縣市。
 * @property {string} aqi 測站回傳的 AQI 數值字串。
 * @property {string} [status] 測站回傳的 AQI 狀態文字。
 */

/**
 * @typedef {object} EpaAqiResponse
 * @property {EpaAqiStation[]} records EPA AQI 資料清單。
 */

const TW_OFFSET_MS = 8 * 3600000;

class WeatherForecastError extends Error {
  /**
   * @param {number} statusCode 要回傳給 route 的 HTTP 狀態碼。
   * @param {string} message 對外暴露的錯誤訊息。
   * @param {unknown} [cause] 原始錯誤物件。
   */
  constructor(statusCode, message, cause) {
    super(message);
    this.name = 'WeatherForecastError';
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

/**
 * 將使用者輸入的縣市名稱正規化（台 → 臺、去空白）。
 * @param {string | null | undefined} county 使用者輸入的縣市名稱。
 * @returns {string} 正規化後的縣市名稱。
 */
function normalizeCounty(county) {
  return (county ?? '').trim().replace(/台/g, '臺');
}

/**
 * 將使用者輸入的鄉鎮名稱正規化（台 → 臺、去空白），空值回 null。
 * @param {string | null | undefined} township 使用者輸入的鄉鎮名稱。
 * @returns {string | null} 正規化後的鄉鎮名稱，若空值則回傳 `null`。
 */
function normalizeTownship(township) {
  const normalized = (township ?? '').trim().replace(/台/g, '臺');
  return normalized || null;
}

/**
 * 驗證並解析 county 查詢參數，回傳正規化縣市與對應 forecast dataset ids。
 * @param {string | null} county route 傳入的縣市查詢參數。
 * @returns {{ county: string, forecastIds: { threeHour: string, twelveHour: string } }} 已驗證的縣市與對應 forecast dataset ids。
 */
function resolveForecastRequest(county) {
  const normalizedCounty = normalizeCounty(county);
  if (!normalizedCounty) {
    throw new WeatherForecastError(400, 'Missing required parameter: county');
  }

  const forecastIds = getForecastIds(normalizedCounty);
  if (!forecastIds) {
    throw new WeatherForecastError(400, `Unknown county: ${normalizedCounty}`);
  }

  return { county: normalizedCounty, forecastIds };
}

/**
 * 判斷某個時段是否涵蓋目前時間。
 * @param {string | undefined} startTime 時段開始時間。
 * @param {string | undefined} endTime 時段結束時間。
 * @param {Date} now 目前比較基準時間。
 * @returns {boolean} 此時段是否涵蓋目前時間。
 */
function isPeriodCurrent(startTime, endTime, now) {
  return new Date(String(startTime)) <= now && now < new Date(String(endTime));
}

/**
 * 將日期輸入轉換為以 UTC 表示台灣本地時間的 Date（用 getUTC* 讀取台灣時間分量）。
 * @param {string | Date} input 要轉換的日期輸入。
 * @returns {Date} 以 UTC 表示台灣本地時間的 Date。
 */
function toTwDate(input) {
  return new Date(new Date(String(input)).getTime() + TW_OFFSET_MS);
}

/**
 * 判斷指定開始時間是否落在明天（以台灣時區為準）。
 * @param {string | undefined} startTime 要判斷的開始時間。
 * @param {Date} now 目前比較基準時間。
 * @returns {boolean} 該開始時間是否落在明天。
 */
function isPeriodTomorrow(startTime, now) {
  const start = toTwDate(startTime);
  const tomorrow = toTwDate(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return (
    start.getUTCDate() === tomorrow.getUTCDate() &&
    start.getUTCMonth() === tomorrow.getUTCMonth() &&
    start.getUTCFullYear() === tomorrow.getUTCFullYear()
  );
}

/**
 * 判斷指定開始時間是否屬於白天時段（06:00–18:00 台灣時間）。
 * @param {string | undefined} startTime 要判斷的開始時間。
 * @returns {boolean} 該開始時間是否屬於白天時段。
 */
function isDaytimePeriod(startTime) {
  const hour = toTwDate(startTime).getUTCHours();
  return hour >= 6 && hour < 18;
}

/**
 * @param {TownshipTimePeriod} entry 鄉鎮時段資料。
 * @returns {string} 此時段可用的開始時間字串。
 */
function getTownshipEntryStart(entry) {
  return entry.DataTime || entry.StartTime || '';
}

/**
 * @param {TownshipWeatherElement[]} elements 鄉鎮天氣元素清單。
 * @param {string} name 要查找的元素名稱。
 * @returns {TownshipWeatherElement | undefined} 對應的鄉鎮天氣元素。
 */
function findTownshipElement(elements, name) {
  return elements.find((element) => element.ElementName === name);
}

/**
 * @param {CountyWeatherElement[]} elements 縣市天氣元素清單。
 * @param {string} name 要查找的元素名稱。
 * @returns {CountyWeatherElement | undefined} 對應的縣市天氣元素。
 */
function findCountyElement(elements, name) {
  return elements.find((element) => element.elementName === name);
}

/**
 * @param {TownshipWeatherElement | undefined} element 鄉鎮天氣元素。
 * @param {number} index 要讀取的時段索引。
 * @param {string} valueKey 要讀取的欄位名稱。
 * @returns {string} 對應欄位的字串值，缺值時回傳空字串。
 */
function getTownshipTimeValue(element, index, valueKey) {
  return element?.Time?.[index]?.ElementValue?.[0]?.[valueKey] ?? '';
}

/**
 * @param {TownshipWeatherElement | undefined} element 鄉鎮天氣元素。
 * @param {number} index 要讀取的時段索引。
 * @param {string} valueKey 要讀取的欄位名稱。
 * @returns {number} 對應欄位的數值，缺值時回傳 `0`。
 */
function getTownshipTimeNumber(element, index, valueKey) {
  return Number(element?.Time?.[index]?.ElementValue?.[0]?.[valueKey] ?? 0);
}

/**
 * @param {CountyWeatherElement | undefined} element 縣市天氣元素。
 * @param {number} index 要讀取的時段索引。
 * @returns {string} 對應欄位的字串值，缺值時回傳空字串。
 */
function getCountyTimeValue(element, index) {
  return element?.time?.[index]?.parameter?.parameterName ?? '';
}

/**
 * @param {CountyWeatherElement | undefined} element 縣市天氣元素。
 * @param {number} index 要讀取的時段索引。
 * @returns {number} 對應欄位的數值，缺值時回傳 `0`。
 */
function getCountyTimeNumber(element, index) {
  return Number(element?.time?.[index]?.parameter?.parameterName ?? 0);
}

/**
 * @param {TownshipForecastResponse | null} uvData UV dataset response。
 * @param {string | null} targetLocationName 要比對的地點名稱。
 * @param {Date} now 目前比較基準時間。
 * @param {boolean} isTomorrow 是否要抓明日 UV。
 * @returns {UvInfo | null} 對應地點的 UV 資訊，無法判斷時回傳 `null`。
 */
function extractUvInfo(uvData, targetLocationName, now, isTomorrow) {
  if (!uvData) return null;

  try {
    const locations = uvData.records?.Locations?.[0]?.Location;
    if (!locations?.length) return null;

    const location = targetLocationName
      ? locations.find((item) => item.LocationName === targetLocationName)
      : locations[0];
    if (!location) {
      throw new Error(`No UV data found for location: ${targetLocationName}`);
    }

    const uvElement = location.WeatherElement?.find(
      (element) => element.ElementName === '紫外線指數',
    );
    if (!uvElement?.Time?.length) return null;

    let periodIndex = 0;
    for (let index = 0; index < uvElement.Time.length; index += 1) {
      const { StartTime, EndTime } = uvElement.Time[index];
      if (isTomorrow && isPeriodTomorrow(StartTime, now)) {
        periodIndex = index;
        break;
      }

      if (!isTomorrow) {
        if (isPeriodCurrent(StartTime, EndTime, now)) {
          periodIndex = index;
          break;
        }

        if (new Date(String(StartTime)) > now) {
          periodIndex = index;
          break;
        }
      }
    }

    const value = Number(uvElement.Time[periodIndex]?.ElementValue?.[0]?.UVIndex);
    if (Number.isNaN(value)) return null;

    return {
      value,
      level: uvElement.Time[periodIndex]?.ElementValue?.[0]?.UVExposureLevel ?? '',
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('No UV data found for location:')) {
      throw error;
    }

    return null;
  }
}

/**
 * @param {EpaAqiResponse | EpaAqiStation[] | null} epaData EPA AQI response 或 records 陣列。
 * @param {string} county 要查找的縣市名稱。
 * @returns {AqiInfo | null} 該縣市的 AQI 資訊，找不到時回傳 `null`。
 */
function extractAqi(epaData, county) {
  try {
    const records = Array.isArray(epaData) ? epaData : epaData?.records;
    if (!records?.length) return null;

    const station = records.find((item) => item.county === county);
    if (!station) return null;

    const value = Number(station.aqi);
    if (Number.isNaN(value)) return null;

    return { value, status: station.status ?? '' };
  } catch {
    return null;
  }
}

export {
  WeatherForecastError,
  normalizeCounty,
  normalizeTownship,
  resolveForecastRequest,
  isPeriodCurrent,
  toTwDate,
  isPeriodTomorrow,
  isDaytimePeriod,
  getTownshipEntryStart,
  findTownshipElement,
  findCountyElement,
  getTownshipTimeValue,
  getTownshipTimeNumber,
  getCountyTimeValue,
  getCountyTimeNumber,
  extractUvInfo,
  extractAqi,
};
