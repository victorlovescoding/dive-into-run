import { NextResponse } from 'next/server';
import { getForecastIds, formatLocationName, formatLocationNameShort } from '@/lib/weather-helpers';

// #region JSDoc Type Definitions
/**
 * @typedef {object} UvInfo
 * @property {number} value - UV 指數數值。
 * @property {string} level - 等級文字，e.g. "中量級"。
 */

/**
 * @typedef {object} AqiInfo
 * @property {number} value - AQI 數值。
 * @property {string} status - 等級文字，e.g. "良好"。
 */

/**
 * @typedef {object} TodayWeather
 * @property {number} currentTemp - 當前氣溫。
 * @property {string} weatherDesc - 天氣狀況文字。
 * @property {string} weatherCode - 天氣代碼。
 * @property {number} morningTemp - 早上氣溫。
 * @property {number} eveningTemp - 晚上氣溫。
 * @property {number} rainProb - 降雨機率 (0-100)。
 * @property {number} humidity - 相對濕度 (0-100)。
 * @property {UvInfo | null} uv - 紫外線指數。
 * @property {AqiInfo | null} aqi - 空氣品質。
 */

/**
 * @typedef {object} TomorrowWeather
 * @property {string} weatherDesc - 天氣狀況文字。
 * @property {string} weatherCode - 天氣代碼。
 * @property {number} morningTemp - 早上氣溫。
 * @property {number} eveningTemp - 晚上氣溫。
 * @property {number} rainProb - 降雨機率。
 * @property {number} humidity - 相對濕度。
 * @property {UvInfo | null} uv - 紫外線指數。
 */

/**
 * @typedef {object} WeatherInfo
 * @property {string} locationName - 地點全名。
 * @property {string} locationNameShort - 手機版縮寫。
 * @property {TodayWeather} today - 今日天氣。
 * @property {TomorrowWeather} tomorrow - 明日天氣。
 */
// #endregion

const CWA_BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore';
const EPA_AQI_URL = 'https://data.moenv.gov.tw/api/v2/aqx_p_432';

/** F-C0032 不含濕度欄位，使用台灣年均相對濕度作為合理預設值。 */
const COUNTY_DEFAULT_HUMIDITY = 70;

// #region CWA fetch helpers
/**
 * 呼叫 CWA API 並回傳 JSON。
 * @param {string} datasetId - CWA dataset ID。
 * @param {string} paramKey - 地點參數名 ("locationName" 或 "LocationName")。
 * @param {string} locationValue - 地點名稱。
 * @returns {Promise<object>} CWA API 回應 JSON。
 */
async function fetchCwa(datasetId, paramKey, locationValue) {
  const url = `${CWA_BASE}/${datasetId}?Authorization=${process.env.CWA_API_KEY}&${paramKey}=${encodeURIComponent(locationValue)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CWA ${datasetId} returned ${res.status}`);
  }
  return res.json();
}

/**
 * 呼叫 EPA AQI API 並回傳 JSON。
 * @returns {Promise<object>} EPA API 回應 JSON。
 */
async function fetchEpaAqi() {
  const url = `${EPA_AQI_URL}?api_key=${process.env.EPA_API_KEY}&format=json&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`EPA AQI returned ${res.status}`);
  }
  return res.json();
}
// #endregion

// #region Time helpers
/**
 * 判斷時段是否包含當前時間。
 * @param {string} startTime - ISO 時間字串。
 * @param {string} endTime - ISO 時間字串。
 * @param {Date} now - 當前時間。
 * @returns {boolean} 是否在時段內。
 */
function isPeriodCurrent(startTime, endTime, now) {
  return new Date(startTime) <= now && now < new Date(endTime);
}

/**
 * 判斷時段是否開始於明天。
 * @param {string} startTime - ISO 時間字串。
 * @param {Date} now - 當前時間。
 * @returns {boolean} 是否為明日時段。
 */
function isPeriodTomorrow(startTime, now) {
  const start = new Date(startTime);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    start.getDate() === tomorrow.getDate() &&
    start.getMonth() === tomorrow.getMonth() &&
    start.getFullYear() === tomorrow.getFullYear()
  );
}

/**
 * 判斷時段是否為白天（06:00-18:00 開始）。
 * @param {string} startTime - ISO 時間字串。
 * @returns {boolean} 是否為白天時段。
 */
function isDaytimePeriod(startTime) {
  const hour = new Date(startTime).getHours();
  return hour >= 6 && hour < 18;
}
// #endregion

// #region UV extraction
/**
 * 從 F-D0047 偶數 ID 回應中提取 UV 資訊。
 * @param {object | null} uvData - UV API 回應。
 * @param {string | null} township - 鄉鎮名（null 時取第一筆）。
 * @param {Date} now - 當前時間。
 * @param {boolean} isTomorrow - 是否取明天的資料。
 * @returns {UvInfo | null} UV 資訊或 null。
 */
function extractUvInfo(uvData, township, now, isTomorrow) {
  if (!uvData) return null;

  try {
    const locations = uvData?.records?.Locations?.[0]?.Location;
    if (!locations?.length) return null;

    const location = township
      ? locations.find((/** @type {object} */ loc) => loc.LocationName === township)
      : locations[0];
    if (!location) return null;

    const uvElement = location.WeatherElement?.find(
      (/** @type {object} */ el) => el.ElementName === 'UVIndex',
    );
    const uvLevelElement = location.WeatherElement?.find(
      (/** @type {object} */ el) => el.ElementName === 'UVExposureLevel',
    );

    if (!uvElement?.Time?.length) return null;

    // Find matching time period
    let periodIndex = 0;
    for (let i = 0; i < uvElement.Time.length; i += 1) {
      const { StartTime } = uvElement.Time[i];
      if (isTomorrow && isPeriodTomorrow(StartTime, now)) {
        periodIndex = i;
        break;
      }
      if (!isTomorrow) {
        const endTime = uvElement.Time[i].EndTime;
        if (isPeriodCurrent(StartTime, endTime, now)) {
          periodIndex = i;
          break;
        }
        if (new Date(StartTime) > now) {
          periodIndex = i;
          break;
        }
      }
    }

    const value = Number(uvElement.Time[periodIndex]?.ElementValue?.[0]?.Value);
    const level = uvLevelElement?.Time?.[periodIndex]?.ElementValue?.[0]?.Value ?? '';

    if (Number.isNaN(value)) return null;

    return { value, level };
  } catch {
    return null;
  }
}
// #endregion

// #region AQI extraction
/**
 * 從 EPA 回應中提取指定縣市的 AQI。
 * @param {object} epaData - EPA API 回應。
 * @param {string} county - 縣市名。
 * @returns {AqiInfo | null} AQI 資訊或 null。
 */
function extractAqi(epaData, county) {
  try {
    const records = epaData?.records;
    if (!records?.length) return null;

    const station = records.find((/** @type {object} */ r) => r.County === county);
    if (!station) return null;

    const value = Number(station.AQI);
    if (Number.isNaN(value)) return null;

    return { value, status: station.Status ?? '' };
  } catch {
    return null;
  }
}
// #endregion

// #region County-level normalization (F-C0032-001)
/**
 * 從 F-C0032-001 回應中找出指定 element。
 * @param {Array<object>} elements - weatherElement 陣列。
 * @param {string} name - element 名稱。
 * @returns {object | undefined} 找到的 element。
 */
function findCountyElement(elements, name) {
  return elements.find((/** @type {object} */ el) => el.elementName === name);
}

/**
 * 從 F-C0032 時段中取值。
 * @param {object} element - weatherElement 物件。
 * @param {number} index - 時段索引。
 * @returns {string} 參數值。
 */
function getCountyTimeValue(element, index) {
  return element?.time?.[index]?.parameter?.parameterName ?? '';
}

/**
 * 從 F-C0032 時段中取數值。
 * @param {object} element - weatherElement 物件。
 * @param {number} index - 時段索引。
 * @returns {number} 數值。
 */
function getCountyTimeNumber(element, index) {
  return Number(element?.time?.[index]?.parameter?.parameterName ?? 0);
}

/**
 * 正規化 F-C0032-001 縣市預報為 WeatherInfo。
 * @param {object} cwaData - CWA API 回應。
 * @param {object | null} uvData - UV API 回應。
 * @param {AqiInfo | null} aqiInfo - AQI 資訊。
 * @param {string} county - 縣市名。
 * @returns {WeatherInfo} 正規化天氣資訊。
 */
function normalizeCountyWeather(cwaData, uvData, aqiInfo, county) {
  const location = cwaData?.records?.location?.[0];
  if (!location) {
    throw new Error('No county weather data found');
  }

  const elements = location.weatherElement;
  const wx = findCountyElement(elements, 'Wx');
  const pop = findCountyElement(elements, 'PoP');
  const minT = findCountyElement(elements, 'MinT');
  const maxT = findCountyElement(elements, 'MaxT');

  const now = new Date();
  let todayIndex = 0;
  let tomorrowIndex = -1;

  if (wx?.time) {
    for (let i = 0; i < wx.time.length; i += 1) {
      const { startTime, endTime } = wx.time[i];
      if (isPeriodCurrent(startTime, endTime, now)) {
        todayIndex = i;
        break;
      }
      if (new Date(startTime) > now) {
        todayIndex = i;
        break;
      }
    }
    for (let i = todayIndex + 1; i < wx.time.length; i += 1) {
      if (isPeriodTomorrow(wx.time[i].startTime, now)) {
        tomorrowIndex = i;
        break;
      }
    }
  }

  if (tomorrowIndex === -1) {
    tomorrowIndex = Math.min(todayIndex + 1, (wx?.time?.length ?? 1) - 1);
  }

  const weatherCode = wx?.time?.[todayIndex]?.parameter?.parameterValue ?? '';
  const tomorrowWeatherCode = wx?.time?.[tomorrowIndex]?.parameter?.parameterValue ?? '';

  const uvInfo = extractUvInfo(uvData, null, now, false);
  const tomorrowUvInfo = extractUvInfo(uvData, null, now, true);

  return {
    locationName: formatLocationName(county, null, null),
    locationNameShort: formatLocationNameShort(county, null),
    today: {
      currentTemp: getCountyTimeNumber(maxT, todayIndex),
      weatherDesc: getCountyTimeValue(wx, todayIndex),
      weatherCode,
      morningTemp: getCountyTimeNumber(maxT, todayIndex),
      eveningTemp: getCountyTimeNumber(minT, todayIndex),
      rainProb: getCountyTimeNumber(pop, todayIndex),
      humidity: COUNTY_DEFAULT_HUMIDITY,
      uv: uvInfo,
      aqi: aqiInfo,
    },
    tomorrow: {
      weatherDesc: getCountyTimeValue(wx, tomorrowIndex),
      weatherCode: tomorrowWeatherCode,
      morningTemp: getCountyTimeNumber(maxT, tomorrowIndex),
      eveningTemp: getCountyTimeNumber(minT, tomorrowIndex),
      rainProb: getCountyTimeNumber(pop, tomorrowIndex),
      humidity: COUNTY_DEFAULT_HUMIDITY,
      uv: tomorrowUvInfo,
    },
  };
}
// #endregion

// #region Township-level normalization (F-D0047)
/**
 * 從 F-D0047 回應中找出指定 WeatherElement。
 * @param {Array<object>} elements - WeatherElement 陣列。
 * @param {string} name - element 名稱。
 * @returns {object | undefined} 找到的 element。
 */
function findTownshipElement(elements, name) {
  return elements.find((/** @type {object} */ el) => el.ElementName === name);
}

/**
 * 從 F-D0047 時段中取值。
 * @param {object} element - WeatherElement 物件。
 * @param {number} index - 時段索引。
 * @returns {string} ElementValue 或空字串。
 */
function getTownshipTimeValue(element, index) {
  return element?.Time?.[index]?.ElementValue?.[0]?.Value ?? '';
}

/**
 * 從 F-D0047 時段中取數值。
 * @param {object} element - WeatherElement 物件。
 * @param {number} index - 時段索引。
 * @returns {number} 數值。
 */
function getTownshipTimeNumber(element, index) {
  return Number(element?.Time?.[index]?.ElementValue?.[0]?.Value ?? 0);
}

/**
 * 正規化 F-D0047 鄉鎮預報為 WeatherInfo。
 * @param {object} cwaData - CWA 3hr API 回應。
 * @param {object | null} uvData - UV 12hr API 回應。
 * @param {AqiInfo | null} aqiInfo - AQI 資訊。
 * @param {string} county - 縣市名。
 * @param {string} township - 鄉鎮名。
 * @returns {WeatherInfo} 正規化天氣資訊。
 */
function normalizeTownshipWeather(cwaData, uvData, aqiInfo, county, township) {
  const location = cwaData?.records?.Locations?.[0]?.Location?.[0];
  if (!location) {
    throw new Error('No township weather data found');
  }

  const elements = location.WeatherElement;
  const temp = findTownshipElement(elements, 'Temperature');
  const humidity = findTownshipElement(elements, 'RelativeHumidity');
  const pop = findTownshipElement(elements, 'ProbabilityOfPrecipitation');
  const weather = findTownshipElement(elements, 'Weather');
  const weatherCodeEl = findTownshipElement(elements, 'WeatherCode');

  const now = new Date();
  let todayIndex = 0;
  let todayNightIndex = -1;
  let tomorrowDayIndex = -1;
  let tomorrowNightIndex = -1;

  if (temp?.Time) {
    for (let i = 0; i < temp.Time.length; i += 1) {
      const { StartTime, EndTime } = temp.Time[i];
      if (isPeriodCurrent(StartTime, EndTime, now)) {
        todayIndex = i;
        break;
      }
      if (new Date(StartTime) > now) {
        todayIndex = i;
        break;
      }
    }

    for (let i = todayIndex + 1; i < temp.Time.length; i += 1) {
      const { StartTime } = temp.Time[i];
      if (!isDaytimePeriod(StartTime) && !isPeriodTomorrow(StartTime, now)) {
        todayNightIndex = i;
        break;
      }
      if (isPeriodTomorrow(StartTime, now)) break;
    }

    for (let i = todayIndex + 1; i < temp.Time.length; i += 1) {
      const { StartTime } = temp.Time[i];
      if (isPeriodTomorrow(StartTime, now)) {
        if (isDaytimePeriod(StartTime) && tomorrowDayIndex === -1) {
          tomorrowDayIndex = i;
        }
        if (!isDaytimePeriod(StartTime) && tomorrowNightIndex === -1) {
          tomorrowNightIndex = i;
        }
      }
    }
  }

  if (todayNightIndex === -1) todayNightIndex = todayIndex;
  if (tomorrowDayIndex === -1) {
    tomorrowDayIndex = Math.min(todayIndex + 1, (temp?.Time?.length ?? 1) - 1);
  }
  if (tomorrowNightIndex === -1) tomorrowNightIndex = tomorrowDayIndex;

  const uvInfo = extractUvInfo(uvData, township, now, false);
  const tomorrowUvInfo = extractUvInfo(uvData, township, now, true);

  return {
    locationName: formatLocationName(county, township, null),
    locationNameShort: formatLocationNameShort(county, township),
    today: {
      currentTemp: getTownshipTimeNumber(temp, todayIndex),
      weatherDesc: getTownshipTimeValue(weather, todayIndex),
      weatherCode: getTownshipTimeValue(weatherCodeEl, todayIndex),
      morningTemp: getTownshipTimeNumber(temp, todayIndex),
      eveningTemp: getTownshipTimeNumber(temp, todayNightIndex),
      rainProb: getTownshipTimeNumber(pop, todayIndex),
      humidity: getTownshipTimeNumber(humidity, todayIndex),
      uv: uvInfo,
      aqi: aqiInfo,
    },
    tomorrow: {
      weatherDesc: getTownshipTimeValue(weather, tomorrowDayIndex),
      weatherCode: getTownshipTimeValue(weatherCodeEl, tomorrowDayIndex),
      morningTemp: getTownshipTimeNumber(temp, tomorrowDayIndex),
      eveningTemp: getTownshipTimeNumber(temp, tomorrowNightIndex),
      rainProb: getTownshipTimeNumber(pop, tomorrowDayIndex),
      humidity: getTownshipTimeNumber(humidity, tomorrowDayIndex),
      uv: tomorrowUvInfo,
    },
  };
}
// #endregion

// #region GET handler
/**
 * 天氣 API Route — 代理 CWA 及 EPA API，正規化為 WeatherInfo 格式。
 * @param {Request} request - GET 請求，query params: county (必填), township (選填)。
 * @returns {Promise<NextResponse>} JSON 回應 { ok, data } 或錯誤。
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get('county');
  const township = searchParams.get('township');

  if (!county) {
    return NextResponse.json(
      { ok: false, error: 'Missing required parameter: county' },
      { status: 400 },
    );
  }

  const forecastIds = getForecastIds(county);
  if (!forecastIds) {
    return NextResponse.json({ ok: false, error: `Unknown county: ${county}` }, { status: 400 });
  }

  try {
    if (township) {
      // Township-level: F-D0047 odd (3hr) + even (12hr UV) + EPA
      const [cwaData, uvData, epaData] = await Promise.all([
        fetchCwa(forecastIds.threeHour, 'LocationName', township),
        fetchCwa(forecastIds.twelveHour, 'LocationName', township).catch(() => null),
        fetchEpaAqi().catch(() => null),
      ]);

      const aqiInfo = epaData ? extractAqi(epaData, county) : null;
      const weatherInfo = normalizeTownshipWeather(cwaData, uvData, aqiInfo, county, township);

      return NextResponse.json(
        { ok: true, data: weatherInfo },
        {
          headers: {
            'Cache-Control': 's-maxage=600, stale-while-revalidate=300',
          },
        },
      );
    }

    // County-level: F-C0032-001 + F-D0047 even (UV) + EPA
    const [cwaData, uvData, epaData] = await Promise.all([
      fetchCwa('F-C0032-001', 'locationName', county),
      fetchCwa(forecastIds.twelveHour, 'LocationName', county).catch(() => null),
      fetchEpaAqi().catch(() => null),
    ]);

    const aqiInfo = epaData ? extractAqi(epaData, county) : null;
    const weatherInfo = normalizeCountyWeather(cwaData, uvData, aqiInfo, county);

    return NextResponse.json(
      { ok: true, data: weatherInfo },
      {
        headers: {
          'Cache-Control': 's-maxage=600, stale-while-revalidate=300',
        },
      },
    );
  } catch (err) {
    console.error('Weather API error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to fetch weather data' }, { status: 502 });
  }
}
// #endregion
