'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ISLAND_MARKERS } from '@/lib/weather-helpers';
import { countiesGeoJson, townsGeoJson as allTownsGeoJson } from '@/lib/weather-geo-cache';
import styles from './weather.module.css';

// #region Style constants
const DEFAULT_STYLE = {
  fillColor: '#EAF8FC',
  fillOpacity: 0.6,
  color: '#A4C3E4',
  weight: 1.5,
};

const HOVER_STYLE = {
  fillColor: '#A4C3E4',
  fillOpacity: 0.8,
};

const SELECTED_STYLE = {
  fillColor: '#5B8DB8',
  fillOpacity: 0.9,
  weight: 2,
};

const ISLAND_STYLE = {
  fillColor: '#EAF8FC',
  fillOpacity: 1,
  color: '#A4C3E4',
  weight: 2,
};

const ISLAND_HOVER_STYLE = {
  fillColor: '#A4C3E4',
};

const ISLAND_RESET_STYLE = {
  fillColor: '#EAF8FC',
};

const MAP_CENTER = /** @type {[number, number]} */ ([23.5, 121]);
const MAP_ZOOM = 7;
const FIT_PADDING = /** @type {[number, number]} */ ([10, 10]);
const MAP_BG = '#F7FCFE';
// #endregion

// #region InvalidateSizeHelper
/**
 * 監聽地圖容器尺寸變化，通知 Leaflet 重新計算並重新 fitBounds。
 * 解決 viewport resize（如手機↔電腦切換）時地圖消失、NaN 錯誤、或縮放不正確。
 * @param {object} props - 元件屬性。
 * @param {import('geojson').FeatureCollection | null} props.geojsonData - 當前顯示的 GeoJSON 資料。
 * @returns {null} 不渲染任何東西。
 */
function InvalidateSizeHelper({ geojsonData }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (geojsonData?.features?.length) {
        requestAnimationFrame(() => {
          try {
            const layer = L.geoJSON(geojsonData);
            map.fitBounds(layer.getBounds(), { padding: FIT_PADDING, animate: false });
          } catch {
            /* noop */
          }
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map, geojsonData]);

  return null;
}
// #endregion

// #region FitBoundsHelper
/**
 * 當 geojsonData 變動時，自動調整地圖 bounds。
 * @param {object} props - 元件屬性。
 * @param {import('geojson').FeatureCollection | null} props.geojsonData - GeoJSON 資料。
 * @returns {null} 不渲染任何東西。
 */
function FitBoundsHelper({ geojsonData }) {
  const map = useMap();

  useEffect(() => {
    if (geojsonData?.features?.length) {
      requestAnimationFrame(() => {
        try {
          map.invalidateSize();
          const layer = L.geoJSON(geojsonData);
          map.fitBounds(layer.getBounds(), { padding: FIT_PADDING });
        } catch {
          // Leaflet 在 jsdom 等非瀏覽器環境可能不可用
        }
      });
    }
  }, [map, geojsonData]);

  return null;
}
// #endregion

// #region TaiwanMap
/**
 * 台灣互動地圖元件。
 * @param {object} props - 元件屬性。
 * @param {'overview' | 'county'} props.mapLayer - 當前地圖層級。
 * @param {string | null} props.selectedCountyCode - 當前選中縣市代碼。
 * @param {string | null} props.selectedTownshipCode - 當前選中鄉鎮代碼。
 * @param {(countyCode: string, countyName: string) => void} props.onCountyClick - 縣市點擊回呼。
 * @param {(townshipCode: string, townshipName: string, countyCode: string, countyName: string) => void} props.onTownshipClick - 鄉鎮點擊回呼。
 * @param {(countyName: string, townshipName: string) => void} props.onIslandClick - 小離島點擊回呼。
 * @returns {import('react').ReactElement} 台灣互動地圖。
 */
function TaiwanMap({
  mapLayer,
  selectedCountyCode,
  selectedTownshipCode,
  onCountyClick,
  onTownshipClick,
  onIslandClick,
}) {
  // #region GeoJSON filtering (source data from weather-geo-cache)
  const townsGeoJson = useMemo(() => {
    if (!selectedCountyCode) return null;
    return {
      ...allTownsGeoJson,
      features: allTownsGeoJson.features.filter(
        (f) => f.properties?.COUNTYCODE === selectedCountyCode,
      ),
    };
  }, [selectedCountyCode]);

  const islandGeoJson = useMemo(() => {
    const islandFeatures = ISLAND_MARKERS.map((island) => {
      const townFeature = allTownsGeoJson.features.find(
        (f) => f.properties?.TOWNNAME === island.targetTownship,
      );
      if (!townFeature) return null;

      /** @type {import('geojson').GeoJsonProperties} */
      const props = {
        islandId: island.id,
        targetCounty: island.targetCounty,
        targetTownship: island.targetTownship,
      };

      if (island.polygonIndex != null && townFeature.geometry.type === 'MultiPolygon') {
        return /** @type {import('geojson').Feature} */ ({
          type: 'Feature',
          properties: props,
          geometry: {
            type: 'Polygon',
            coordinates: /** @type {import('geojson').MultiPolygon} */ (townFeature.geometry)
              .coordinates[island.polygonIndex],
          },
        });
      }

      return /** @type {import('geojson').Feature} */ ({
        type: 'Feature',
        properties: props,
        geometry: townFeature.geometry,
      });
    }).filter(Boolean);

    return /** @type {import('geojson').FeatureCollection} */ ({
      type: 'FeatureCollection',
      features: islandFeatures,
    });
  }, []);
  // #endregion

  // #region Event handlers
  /**
   * 綁定 overview 圖層的滑鼠/點擊事件。
   * @param {import('geojson').Feature} feat - GeoJSON feature。
   * @param {L.Layer} layer - Leaflet layer。
   */
  const onEachCounty = useCallback(
    (feat, layer) => {
      const code = feat.properties?.COUNTYCODE ?? '';
      const name = feat.properties?.COUNTYNAME ?? '';

      layer.on({
        mouseover: ({ target }) => {
          if (code !== selectedCountyCode) {
            /** @type {L.Path} */ (target).setStyle(HOVER_STYLE);
          }
        },
        mouseout: ({ target }) => {
          if (code !== selectedCountyCode) {
            /** @type {L.Path} */ (target).setStyle(DEFAULT_STYLE);
          }
        },
        click: () => {
          onCountyClick(code, name);
        },
      });
    },
    [selectedCountyCode, onCountyClick],
  );

  /**
   * 綁定 county 圖層（鄉鎮）的滑鼠/點擊事件。
   * @param {import('geojson').Feature} feat - GeoJSON feature。
   * @param {L.Layer} layer - Leaflet layer。
   */
  const onEachTownship = useCallback(
    (feat, layer) => {
      const townCode = feat.properties?.TOWNCODE ?? '';
      const townName = feat.properties?.TOWNNAME ?? '';
      const countyCode = feat.properties?.COUNTYCODE ?? '';
      const countyName = feat.properties?.COUNTYNAME ?? '';

      layer.on({
        mouseover: ({ target }) => {
          if (townCode !== selectedTownshipCode) {
            /** @type {L.Path} */ (target).setStyle(HOVER_STYLE);
          }
        },
        mouseout: ({ target }) => {
          if (townCode !== selectedTownshipCode) {
            /** @type {L.Path} */ (target).setStyle(DEFAULT_STYLE);
          }
        },
        click: () => {
          if (townCode === selectedTownshipCode) return;
          onTownshipClick(townCode, townName, countyCode, countyName);
        },
      });
    },
    [selectedTownshipCode, onTownshipClick],
  );

  /**
   * 設定各 county feature 的初始樣式。
   * @param {import('geojson').Feature} feat - GeoJSON feature。
   * @returns {L.PathOptions} Leaflet path options。
   */
  const countyStyle = useCallback(
    (feat) => {
      if (feat?.properties?.COUNTYCODE === selectedCountyCode) {
        return SELECTED_STYLE;
      }
      return DEFAULT_STYLE;
    },
    [selectedCountyCode],
  );

  /**
   * 設定各 township feature 的初始樣式。
   * @param {import('geojson').Feature} feat - GeoJSON feature。
   * @returns {L.PathOptions} Leaflet path options。
   */
  const townshipStyle = useCallback(
    (feat) => {
      if (feat?.properties?.TOWNCODE === selectedTownshipCode) {
        return SELECTED_STYLE;
      }
      return DEFAULT_STYLE;
    },
    [selectedTownshipCode],
  );

  /**
   * 綁定離島 GeoJSON 圖層的滑鼠/點擊事件。
   * @param {import('geojson').Feature} feat - GeoJSON feature。
   * @param {L.Layer} layer - Leaflet layer。
   */
  const onEachIsland = useCallback(
    (feat, layer) => {
      const targetCounty = feat.properties?.targetCounty ?? '';
      const targetTownship = feat.properties?.targetTownship ?? '';

      layer.on({
        mouseover: ({ target }) => {
          /** @type {L.Path} */ (target).setStyle(ISLAND_HOVER_STYLE);
        },
        mouseout: ({ target }) => {
          /** @type {L.Path} */ (target).setStyle(ISLAND_RESET_STYLE);
        },
        click: () => {
          onIslandClick(targetCounty, targetTownship);
        },
      });
    },
    [onIslandClick],
  );
  // #endregion

  const activeGeoJson = mapLayer === 'overview' ? countiesGeoJson : townsGeoJson;
  const layerKey = `${mapLayer}-${selectedCountyCode ?? 'none'}-${selectedTownshipCode ?? 'none'}`;

  return (
    <div className={styles.mapContainer} role="application" aria-label="台灣互動地圖">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        attributionControl={false}
        style={{ position: 'absolute', inset: 0, background: MAP_BG }}
      >
        <InvalidateSizeHelper geojsonData={activeGeoJson} />
        <FitBoundsHelper geojsonData={activeGeoJson} />

        {mapLayer === 'overview' && (
          <GeoJSON
            key={layerKey}
            data={countiesGeoJson}
            style={countyStyle}
            onEachFeature={onEachCounty}
          />
        )}

        {mapLayer === 'county' && townsGeoJson && (
          <GeoJSON
            key={layerKey}
            data={townsGeoJson}
            style={townshipStyle}
            onEachFeature={onEachTownship}
          />
        )}

        {mapLayer === 'overview' && islandGeoJson.features.length > 0 && (
          <GeoJSON
            key="islands"
            data={islandGeoJson}
            style={() => ISLAND_STYLE}
            onEachFeature={onEachIsland}
          />
        )}
      </MapContainer>
    </div>
  );
}

export default TaiwanMap;
// #endregion
