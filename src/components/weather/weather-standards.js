/**
 * @typedef {'uv' | 'aqi'} WeatherStandardMetric
 */

/**
 * @typedef {object} WeatherStandardRow
 * @property {string} id - Stable row identifier for rendering and tests.
 * @property {string} rangeLabel - User-facing official range label.
 * @property {number} min - Inclusive minimum value.
 * @property {number} max - Inclusive maximum value.
 * @property {string} label - Official level/status label.
 */

export const UV_STANDARD_SOURCE_URL =
  'https://opendata.cwa.gov.tw/opendatadoc/insrtuction/CWA_Data_Standard.pdf';
export const AQI_STANDARD_SOURCE_URL =
  'https://airtw.moenv.gov.tw/CHT/Information/Standard/AirQualityIndicatorNew.aspx';

export const WEATHER_STANDARD_SOURCE_URLS = Object.freeze({
  uv: UV_STANDARD_SOURCE_URL,
  aqi: AQI_STANDARD_SOURCE_URL,
});

/** @type {ReadonlyArray<WeatherStandardRow>} */
export const UV_STANDARD_ROWS = Object.freeze([
  { id: 'uv-0-2', rangeLabel: '0-2', min: 0, max: 2, label: '低量級' },
  { id: 'uv-3-5', rangeLabel: '3-5', min: 3, max: 5, label: '中量級' },
  { id: 'uv-6-7', rangeLabel: '6-7', min: 6, max: 7, label: '高量級' },
  { id: 'uv-8-10', rangeLabel: '8-10', min: 8, max: 10, label: '過量級' },
  {
    id: 'uv-11-plus',
    rangeLabel: '11+',
    min: 11,
    max: Number.POSITIVE_INFINITY,
    label: '危險級',
  },
]);

/** @type {ReadonlyArray<WeatherStandardRow>} */
export const AQI_STANDARD_ROWS = Object.freeze([
  { id: 'aqi-0-50', rangeLabel: '0-50', min: 0, max: 50, label: '良好' },
  { id: 'aqi-51-100', rangeLabel: '51-100', min: 51, max: 100, label: '普通' },
  {
    id: 'aqi-101-150',
    rangeLabel: '101-150',
    min: 101,
    max: 150,
    label: '對敏感族群不健康',
  },
  {
    id: 'aqi-151-200',
    rangeLabel: '151-200',
    min: 151,
    max: 200,
    label: '對所有族群不健康',
  },
  {
    id: 'aqi-201-300',
    rangeLabel: '201-300',
    min: 201,
    max: 300,
    label: '非常不健康',
  },
  { id: 'aqi-301-400', rangeLabel: '301-400', min: 301, max: 400, label: '危害' },
  { id: 'aqi-401-500', rangeLabel: '401-500', min: 401, max: 500, label: '危害' },
]);

/** @type {Readonly<Record<WeatherStandardMetric, ReadonlyArray<WeatherStandardRow>>>} */
const STANDARD_ROWS_BY_METRIC = Object.freeze({
  uv: UV_STANDARD_ROWS,
  aqi: AQI_STANDARD_ROWS,
});

/** @type {Readonly<Record<WeatherStandardMetric, Readonly<Record<string, string>>>>} */
const WEATHER_METRIC_ADVICE = Object.freeze({
  uv: Object.freeze({
    低量級: '可正常跑，留意補水',
    中量級: '補防曬，避開正午',
    高量級: '改清晨/傍晚，縮短曝曬',
    過量級: '改清晨/傍晚，縮短曝曬',
    危險級: '優先室內或避開曝曬',
  }),
  aqi: Object.freeze({
    良好: '可正常跑，留意體感',
    普通: '可正常跑，敏感者留意體感',
    對敏感族群不健康: '降低強度，敏感者改室內',
    對所有族群不健康: '縮短戶外時間，室內優先',
    非常不健康: '改室內，延後戶外跑',
    危害: '改室內，延後戶外跑',
  }),
});

/**
 * Returns the official standard row containing the current metric value.
 * @param {string} metric - Weather metric key.
 * @param {unknown} value - Current metric value.
 * @returns {WeatherStandardRow | null} Matching row, or null when unavailable.
 */
export function getCurrentStandardRow(metric, value) {
  if (metric !== 'uv' && metric !== 'aqi') {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return (
    STANDARD_ROWS_BY_METRIC[metric].find((row) => value >= row.min && value <= row.max) ?? null
  );
}

/**
 * Returns conservative one-line running advice for a displayed level/status.
 * @param {string} metric - Weather metric key.
 * @param {string | null | undefined} levelOrStatus - Official level/status label.
 * @returns {string} Advice copy, or an empty string for unknown inputs.
 */
export function getWeatherMetricAdvice(metric, levelOrStatus) {
  if ((metric !== 'uv' && metric !== 'aqi') || levelOrStatus == null) {
    return '';
  }

  return WEATHER_METRIC_ADVICE[metric][levelOrStatus] ?? '';
}
