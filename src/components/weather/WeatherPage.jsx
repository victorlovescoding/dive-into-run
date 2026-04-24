'use client';

import { countiesGeoJson, townsGeoJson } from '@/config/geo/weather-geo-cache';
import useWeatherPageRuntime from '@/runtime/hooks/useWeatherPageRuntime';
import WeatherPageScreen from '@/ui/weather/WeatherPageScreen';

/**
 * @typedef {object} WeatherGeoLookup
 * @property {Record<string, string>} countyCodeByName - countyName -> countyCode lookup.
 * @property {Record<string, string>} countyNameByCode - countyCode -> countyName lookup.
 * @property {Record<string, { townshipName: string, countyCode: string, countyName: string }>} townshipByCode - townshipCode lookup.
 */

/**
 * 建立 countyName -> countyCode 對照表（含 台/臺 雙向映射）。
 * lookup 依賴 geo config，因此留在 thin entry 邊界，不把 config 直接拉進 runtime。
 * @returns {Record<string, string>} 名稱對代碼映射。
 */
function buildCountyCodeLookup() {
  /** @type {Record<string, string>} */
  const lookup = {};

  countiesGeoJson.features.forEach((feature) => {
    const countyName = feature.properties?.COUNTYNAME ?? '';
    const countyCode = feature.properties?.COUNTYCODE ?? '';

    lookup[countyName] = countyCode;
    if (countyName.includes('台')) {
      lookup[countyName.replace(/台/g, '臺')] = countyCode;
    }
    if (countyName.includes('臺')) {
      lookup[countyName.replace(/臺/g, '台')] = countyCode;
    }
  });

  return lookup;
}

/**
 * 建立 countyCode -> countyName 對照表。
 * @returns {Record<string, string>} 代碼對名稱映射。
 */
function buildCountyNameByCode() {
  /** @type {Record<string, string>} */
  const lookup = {};

  countiesGeoJson.features.forEach((feature) => {
    const countyCode = feature.properties?.COUNTYCODE ?? '';
    const countyName = feature.properties?.COUNTYNAME ?? '';
    lookup[countyCode] = countyName;
  });

  return lookup;
}

/**
 * 建立 townshipCode -> township metadata 對照表。
 * @returns {WeatherGeoLookup['townshipByCode']} 鄉鎮查表。
 */
function buildTownshipLookupByCode() {
  /** @type {WeatherGeoLookup['townshipByCode']} */
  const lookup = {};

  townsGeoJson.features.forEach((feature) => {
    const townshipCode = feature.properties?.TOWNCODE ?? '';
    lookup[townshipCode] = {
      townshipName: feature.properties?.TOWNNAME ?? '',
      countyCode: feature.properties?.COUNTYCODE ?? '',
      countyName: feature.properties?.COUNTYNAME ?? '',
    };
  });

  return lookup;
}

/** @type {WeatherGeoLookup} */
const WEATHER_GEO_LOOKUP = {
  countyCodeByName: buildCountyCodeLookup(),
  countyNameByCode: buildCountyNameByCode(),
  townshipByCode: buildTownshipLookupByCode(),
};

/**
 * 天氣頁 thin client entry。
 * @returns {import('react').ReactElement} 天氣頁面。
 */
export default function WeatherPage() {
  const runtime = useWeatherPageRuntime(WEATHER_GEO_LOOKUP);

  return <WeatherPageScreen runtime={runtime} />;
}
