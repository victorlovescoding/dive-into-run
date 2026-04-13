/**
 * Module-level GeoJSON 快取 — TopoJSON → GeoJSON 轉換只做一次，所有消費者共用。
 *
 * towns.json 是 53,000+ 行，feature() 每次呼叫都做完整轉換。
 * 透過 module-level export，整個 app 只解析一次。
 */
import { feature } from 'topojson-client';
import countiesData from '@/data/geo/counties.json';
import townsData from '@/data/geo/towns.json';

/** @type {import('geojson').FeatureCollection} */
export const countiesGeoJson = /** @type {import('geojson').FeatureCollection} */ (
  feature(countiesData, countiesData.objects.counties)
);

/** @type {import('geojson').FeatureCollection} */
export const townsGeoJson = /** @type {import('geojson').FeatureCollection} */ (
  feature(townsData, townsData.objects.towns)
);
