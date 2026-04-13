/**
 * 共用天氣資料型別定義 — route.js / weather-api.js / WeatherCard.jsx 共用。
 */

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
 * @property {string} weatherCode - 天氣代碼（圖示選擇用）。
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
 * @property {string} locationName - 地點全名，e.g. "臺東縣 · 蘭嶼鄉"。
 * @property {string} locationNameShort - 手機版縮寫，e.g. "臺東 · 蘭嶼"。
 * @property {TodayWeather} today - 今日天氣。
 * @property {TomorrowWeather} tomorrow - 明日天氣。
 */

export {};
