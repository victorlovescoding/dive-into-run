import {
  getForecastIds,
  formatLocationName,
  formatLocationNameShort,
} from '@/service/weather-location-service';
import { requestCwaJson, requestEpaJson } from '@/repo/server/weather-api-repo';

/** @typedef {import('@/types/weather-types').UvInfo} UvInfo */
/** @typedef {import('@/types/weather-types').AqiInfo} AqiInfo */
/** @typedef {import('@/types/weather-types').WeatherInfo} WeatherInfo */

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

const CWA_BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore';
const EPA_AQI_URL = 'https://data.moenv.gov.tw/api/v2/aqx_p_432';
const COUNTY_DEFAULT_HUMIDITY = 70;

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
 * @param {unknown} error 要判斷的錯誤物件。
 * @returns {number} 對應的 HTTP 狀態碼。
 */
function getWeatherForecastErrorStatus(error) {
  return error instanceof WeatherForecastError ? error.statusCode : 502;
}

/**
 * @param {unknown} error 要轉成 client response 的錯誤物件。
 * @returns {string} 可安全公開的錯誤訊息。
 */
function getWeatherForecastPublicErrorMessage(error) {
  const status = getWeatherForecastErrorStatus(error);
  if (status < 500 && error instanceof Error) {
    return error.message;
  }

  return 'Failed to fetch weather data';
}

/**
 * @param {'CWA_API_KEY' | 'EPA_API_KEY'} envName - 必填 upstream API key 環境變數名。
 * @returns {string} 已去空白的 API key。
 */
function getRequiredApiKey(envName) {
  const value = process.env[envName]?.trim();
  if (!value) {
    throw new WeatherForecastError(500, `Missing required server env: ${envName}`);
  }

  return value;
}

/**
 * @returns {{ cwaApiKey: string, epaApiKey: string }} 已驗證的 upstream API keys。
 */
function getUpstreamApiKeys() {
  return {
    cwaApiKey: getRequiredApiKey('CWA_API_KEY'),
    epaApiKey: getRequiredApiKey('EPA_API_KEY'),
  };
}

/**
 * @param {string | null | undefined} county 使用者輸入的縣市名稱。
 * @returns {string} 正規化後的縣市名稱。
 */
function normalizeCounty(county) {
  return (county ?? '').trim().replace(/台/g, '臺');
}

/**
 * @param {string | null | undefined} township 使用者輸入的鄉鎮名稱。
 * @returns {string | null} 正規化後的鄉鎮名稱，若空值則回傳 `null`。
 */
function normalizeTownship(township) {
  const normalized = (township ?? '').trim().replace(/台/g, '臺');
  return normalized || null;
}

/**
 * @param {string} datasetId CWA dataset id。
 * @param {string | null} paramKey 要附加的查詢參數名稱。
 * @param {string | null} locationValue 要附加的地點參數值。
 * @param {string} apiKey 已驗證的 CWA API key。
 * @returns {string} 完整的 CWA request URL。
 */
function buildCwaUrl(datasetId, paramKey, locationValue, apiKey) {
  const url = new URL(`${CWA_BASE}/${datasetId}`);
  url.searchParams.set('Authorization', apiKey);
  if (paramKey && locationValue) {
    url.searchParams.set(paramKey, locationValue);
  }

  return url.toString();
}

/**
 * @param {string} apiKey 已驗證的 EPA API key。
 * @returns {string} 完整的 EPA AQI request URL。
 */
function buildEpaUrl(apiKey) {
  const url = new URL(EPA_AQI_URL);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1000');
  return url.toString();
}

/**
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
 * @param {string | undefined} startTime 時段開始時間。
 * @param {string | undefined} endTime 時段結束時間。
 * @param {Date} now 目前比較基準時間。
 * @returns {boolean} 此時段是否涵蓋目前時間。
 */
function isPeriodCurrent(startTime, endTime, now) {
  return new Date(String(startTime)) <= now && now < new Date(String(endTime));
}

/**
 * @param {string | undefined} startTime 要判斷的開始時間。
 * @param {Date} now 目前比較基準時間。
 * @returns {boolean} 該開始時間是否落在明天。
 */
function isPeriodTomorrow(startTime, now) {
  const start = new Date(String(startTime));
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    start.getDate() === tomorrow.getDate() &&
    start.getMonth() === tomorrow.getMonth() &&
    start.getFullYear() === tomorrow.getFullYear()
  );
}

/**
 * @param {string | undefined} startTime 要判斷的開始時間。
 * @returns {boolean} 該開始時間是否屬於白天時段。
 */
function isDaytimePeriod(startTime) {
  const hour = new Date(String(startTime)).getHours();
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

/**
 * @param {CountyForecastResponse} cwaData 縣市層級的 CWA response。
 * @param {TownshipForecastResponse | null} uvData UV dataset response。
 * @param {AqiInfo | null} aqiInfo 該縣市的 AQI 資訊。
 * @param {string} county 已正規化的縣市名稱。
 * @param {Date} now 目前比較基準時間。
 * @returns {WeatherInfo} 縣市模式的標準化天氣資料。
 */
function normalizeCountyWeather(cwaData, uvData, aqiInfo, county, now) {
  const location = cwaData.records?.location?.[0];
  if (!location) {
    throw new Error('No county weather data found');
  }

  const elements = location.weatherElement;
  const weather = findCountyElement(elements, 'Wx');
  const rain = findCountyElement(elements, 'PoP');
  const minTemp = findCountyElement(elements, 'MinT');
  const maxTemp = findCountyElement(elements, 'MaxT');

  let todayIndex = 0;
  let tomorrowIndex = -1;

  for (let index = 0; index < (weather?.time?.length ?? 0); index += 1) {
    const { startTime, endTime } = weather.time[index];
    if (isPeriodCurrent(startTime, endTime, now)) {
      todayIndex = index;
      break;
    }

    if (new Date(startTime) > now) {
      todayIndex = index;
      break;
    }
  }

  for (let index = todayIndex + 1; index < (weather?.time?.length ?? 0); index += 1) {
    if (isPeriodTomorrow(weather?.time?.[index]?.startTime, now)) {
      tomorrowIndex = index;
      break;
    }
  }

  if (tomorrowIndex === -1) {
    tomorrowIndex = Math.min(todayIndex + 1, (weather?.time?.length ?? 1) - 1);
  }

  return {
    locationName: formatLocationName(county, null, null),
    locationNameShort: formatLocationNameShort(county, null),
    today: {
      currentTemp: getCountyTimeNumber(maxTemp, todayIndex),
      weatherDesc: getCountyTimeValue(weather, todayIndex),
      weatherCode: weather?.time?.[todayIndex]?.parameter?.parameterValue ?? '',
      morningTemp: getCountyTimeNumber(maxTemp, todayIndex),
      eveningTemp: getCountyTimeNumber(minTemp, todayIndex),
      rainProb: getCountyTimeNumber(rain, todayIndex),
      humidity: COUNTY_DEFAULT_HUMIDITY,
      uv: extractUvInfo(uvData, county, now, false),
      aqi: aqiInfo,
    },
    tomorrow: {
      weatherDesc: getCountyTimeValue(weather, tomorrowIndex),
      weatherCode: weather?.time?.[tomorrowIndex]?.parameter?.parameterValue ?? '',
      morningTemp: getCountyTimeNumber(maxTemp, tomorrowIndex),
      eveningTemp: getCountyTimeNumber(minTemp, tomorrowIndex),
      rainProb: getCountyTimeNumber(rain, tomorrowIndex),
      humidity: COUNTY_DEFAULT_HUMIDITY,
      uv: extractUvInfo(uvData, county, now, true),
    },
  };
}

/**
 * @param {TownshipForecastResponse} cwaData 鄉鎮層級的 CWA response。
 * @param {TownshipForecastResponse | null} uvData UV dataset response。
 * @param {AqiInfo | null} aqiInfo 該縣市的 AQI 資訊。
 * @param {string} county 已正規化的縣市名稱。
 * @param {string} township 已正規化的鄉鎮名稱。
 * @param {Date} now 目前比較基準時間。
 * @returns {WeatherInfo} 鄉鎮模式的標準化天氣資料。
 */
function normalizeTownshipWeather(cwaData, uvData, aqiInfo, county, township, now) {
  const locations = cwaData.records?.Locations?.[0]?.Location;
  const location = locations?.find((item) => item.LocationName === township);
  if (!location) {
    throw new Error(`No township weather data found for: ${township}`);
  }

  const elements = location.WeatherElement;
  const temp = findTownshipElement(elements, '溫度');
  const humidity = findTownshipElement(elements, '相對濕度');
  const rain = findTownshipElement(elements, '3小時降雨機率');
  const weather = findTownshipElement(elements, '天氣現象');

  let todayIndex = 0;
  let todayNightIndex = -1;
  let tomorrowDayIndex = -1;
  let tomorrowNightIndex = -1;

  for (let index = 0; index < (temp?.Time?.length ?? 0); index += 1) {
    const entry = temp.Time[index];
    if (entry.DataTime) {
      if (new Date(entry.DataTime) <= now) {
        todayIndex = index;
      } else {
        break;
      }
    } else {
      if (isPeriodCurrent(entry.StartTime, entry.EndTime, now)) {
        todayIndex = index;
        break;
      }

      if (new Date(String(entry.StartTime)) > now) {
        todayIndex = index;
        break;
      }
    }
  }

  for (let index = todayIndex + 1; index < (temp?.Time?.length ?? 0); index += 1) {
    const startTime = getTownshipEntryStart(temp.Time[index]);
    if (!isDaytimePeriod(startTime) && !isPeriodTomorrow(startTime, now)) {
      todayNightIndex = index;
      break;
    }
    if (isPeriodTomorrow(startTime, now)) break;
  }

  for (let index = todayIndex + 1; index < (temp?.Time?.length ?? 0); index += 1) {
    const startTime = getTownshipEntryStart(temp.Time[index]);
    if (!isPeriodTomorrow(startTime, now)) continue;
    if (isDaytimePeriod(startTime) && tomorrowDayIndex === -1) {
      tomorrowDayIndex = index;
    }
    if (!isDaytimePeriod(startTime) && tomorrowNightIndex === -1) {
      tomorrowNightIndex = index;
    }
  }

  if (todayNightIndex === -1) todayNightIndex = todayIndex;
  if (tomorrowDayIndex === -1) {
    tomorrowDayIndex = Math.min(todayIndex + 1, (temp?.Time?.length ?? 1) - 1);
  }
  if (tomorrowNightIndex === -1) tomorrowNightIndex = tomorrowDayIndex;

  return {
    locationName: formatLocationName(county, township, null),
    locationNameShort: formatLocationNameShort(county, township),
    today: {
      currentTemp: getTownshipTimeNumber(temp, todayIndex, 'Temperature'),
      weatherDesc: getTownshipTimeValue(weather, todayIndex, 'Weather'),
      weatherCode: getTownshipTimeValue(weather, todayIndex, 'WeatherCode'),
      morningTemp: getTownshipTimeNumber(temp, todayIndex, 'Temperature'),
      eveningTemp: getTownshipTimeNumber(temp, todayNightIndex, 'Temperature'),
      rainProb: getTownshipTimeNumber(rain, todayIndex, 'ProbabilityOfPrecipitation'),
      humidity: getTownshipTimeNumber(humidity, todayIndex, 'RelativeHumidity'),
      uv: extractUvInfo(uvData, township, now, false),
      aqi: aqiInfo,
    },
    tomorrow: {
      weatherDesc: getTownshipTimeValue(weather, tomorrowDayIndex, 'Weather'),
      weatherCode: getTownshipTimeValue(weather, tomorrowDayIndex, 'WeatherCode'),
      morningTemp: getTownshipTimeNumber(temp, tomorrowDayIndex, 'Temperature'),
      eveningTemp: getTownshipTimeNumber(temp, tomorrowNightIndex, 'Temperature'),
      rainProb: getTownshipTimeNumber(rain, tomorrowDayIndex, 'ProbabilityOfPrecipitation'),
      humidity: getTownshipTimeNumber(humidity, tomorrowDayIndex, 'RelativeHumidity'),
      uv: extractUvInfo(uvData, township, now, true),
    },
  };
}

/**
 * @param {object} params 取得縣市天氣所需的請求參數。
 * @param {string} params.county 已正規化的縣市名稱。
 * @param {{ threeHour: string, twelveHour: string }} params.forecastIds 該縣市對應的 forecast dataset ids。
 * @param {Date} params.now 目前比較基準時間。
 * @param {{ cwaApiKey: string, epaApiKey: string }} params.apiKeys 已驗證的 upstream API keys。
 * @returns {Promise<WeatherInfo>} 縣市模式的標準化天氣資料。
 */
async function getCountyWeatherForecast({ county, forecastIds, now, apiKeys }) {
  const [countyData, uvData, epaData] = await Promise.all([
    requestCwaJson(buildCwaUrl('F-C0032-001', 'locationName', county, apiKeys.cwaApiKey)),
    requestCwaJson(buildCwaUrl(forecastIds.twelveHour, null, null, apiKeys.cwaApiKey)).catch(
      () => null,
    ),
    requestEpaJson(buildEpaUrl(apiKeys.epaApiKey)).catch(() => null),
  ]);

  return normalizeCountyWeather(
    /** @type {CountyForecastResponse} */ (countyData),
    /** @type {TownshipForecastResponse | null} */ (uvData),
    extractAqi(/** @type {EpaAqiResponse | null} */ (epaData), county),
    county,
    now,
  );
}

/**
 * @param {object} params 取得鄉鎮天氣所需的請求參數。
 * @param {string} params.county 已正規化的縣市名稱。
 * @param {string} params.township 已正規化的鄉鎮名稱。
 * @param {{ threeHour: string, twelveHour: string }} params.forecastIds 該縣市對應的 forecast dataset ids。
 * @param {Date} params.now 目前比較基準時間。
 * @param {{ cwaApiKey: string, epaApiKey: string }} params.apiKeys 已驗證的 upstream API keys。
 * @returns {Promise<WeatherInfo>} 鄉鎮模式的標準化天氣資料。
 */
async function getTownshipWeatherForecast({ county, township, forecastIds, now, apiKeys }) {
  const [townshipData, uvData, epaData] = await Promise.all([
    requestCwaJson(buildCwaUrl(forecastIds.threeHour, 'LocationName', township, apiKeys.cwaApiKey)),
    requestCwaJson(
      buildCwaUrl(forecastIds.twelveHour, 'LocationName', township, apiKeys.cwaApiKey),
    ).catch(() => null),
    requestEpaJson(buildEpaUrl(apiKeys.epaApiKey)).catch(() => null),
  ]);

  return normalizeTownshipWeather(
    /** @type {TownshipForecastResponse} */ (townshipData),
    /** @type {TownshipForecastResponse | null} */ (uvData),
    extractAqi(/** @type {EpaAqiResponse | null} */ (epaData), county),
    county,
    township,
    now,
  );
}

/**
 * @param {{ county: string | null, township?: string | null, now?: Date }} params route 傳入的查詢參數與可覆寫時間。
 * @returns {Promise<WeatherInfo>} 標準化後的 weather forecast payload。
 */
async function getWeatherForecast({ county, township = null, now = new Date() }) {
  const { county: resolvedCounty, forecastIds } = resolveForecastRequest(county);
  const resolvedTownship = normalizeTownship(township);

  try {
    const apiKeys = getUpstreamApiKeys();
    if (resolvedTownship) {
      return await getTownshipWeatherForecast({
        county: resolvedCounty,
        township: resolvedTownship,
        forecastIds,
        now,
        apiKeys,
      });
    }

    return await getCountyWeatherForecast({ county: resolvedCounty, forecastIds, now, apiKeys });
  } catch (error) {
    if (error instanceof WeatherForecastError) throw error;
    throw new WeatherForecastError(502, 'Failed to fetch weather data', error);
  }
}

export {
  WeatherForecastError,
  getWeatherForecastErrorStatus,
  getWeatherForecastPublicErrorMessage,
};
export default getWeatherForecast;
