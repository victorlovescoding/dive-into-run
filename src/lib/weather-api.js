/** @typedef {import('@/types/weather-types').WeatherInfo} WeatherInfo */

/**
 * 從 /api/weather 取得天氣資訊。
 * @param {object} options - 查詢選項。
 * @param {string} options.county - 縣市全名，e.g. "臺北市"。
 * @param {string | null} [options.township] - 鄉鎮全名，e.g. "板橋區"。
 * @param {AbortSignal} [options.signal] - AbortController signal，用於取消請求。
 * @returns {Promise<WeatherInfo>} 天氣資訊。
 * @throws {Error} 當 API 回傳錯誤或網路失敗時。
 */
export async function fetchWeather({ county, township, signal }) {
  const params = new URLSearchParams({ county });
  if (township) {
    params.set('township', township);
  }

  const res = await fetch(`/api/weather?${params.toString()}`, { signal });
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error || 'Failed to fetch weather data');
  }

  return json.data;
}
