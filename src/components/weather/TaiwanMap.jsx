'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { MapContainer, GeoJSON, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { feature } from 'topojson-client';
import countiesData from '@/data/geo/counties.json';
import townsData from '@/data/geo/towns.json';
import { ISLAND_MARKERS } from '@/lib/weather-helpers';
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
const FIT_PADDING = /** @type {[number, number]} */ ([20, 20]);
const MAP_BG = '#F7FCFE';
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
      try {
        const layer = L.geoJSON(geojsonData);
        map.fitBounds(layer.getBounds(), { padding: FIT_PADDING });
      } catch {
        // Leaflet 在 jsdom 等非瀏覽器環境可能不可用
      }
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
  // #region GeoJSON conversion (memoized)
  const countiesGeoJson = useMemo(
    () =>
      /** @type {import('geojson').FeatureCollection} */ (
        feature(countiesData, countiesData.objects.counties)
      ),
    [],
  );

  const townsGeoJson = useMemo(() => {
    if (!selectedCountyCode) return null;
    const allTowns = /** @type {import('geojson').FeatureCollection} */ (
      feature(townsData, townsData.objects.towns)
    );
    return {
      ...allTowns,
      features: allTowns.features.filter((f) => f.properties?.COUNTYCODE === selectedCountyCode),
    };
  }, [selectedCountyCode]);
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
   * 處理小離島 CircleMarker 的 hover in。
   * @param {L.LeafletMouseEvent} e - Leaflet mouse event。
   */
  const handleIslandMouseOver = useCallback((e) => {
    /** @type {L.CircleMarker} */ (e.target).setStyle(ISLAND_HOVER_STYLE);
  }, []);

  /**
   * 處理小離島 CircleMarker 的 hover out。
   * @param {L.LeafletMouseEvent} e - Leaflet mouse event。
   */
  const handleIslandMouseOut = useCallback((e) => {
    /** @type {L.CircleMarker} */ (e.target).setStyle(ISLAND_RESET_STYLE);
  }, []);
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
        style={{ width: '100%', height: '100%', background: MAP_BG }}
      >
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

        {mapLayer === 'overview' &&
          ISLAND_MARKERS.map((island) => (
            <CircleMarker
              key={island.id}
              center={[island.lat, island.lng]}
              radius={8}
              pathOptions={ISLAND_STYLE}
              eventHandlers={{
                click: () => onIslandClick(island.targetCounty, island.targetTownship),
                mouseover: handleIslandMouseOver,
                mouseout: handleIslandMouseOut,
              }}
            >
              <Tooltip direction="top" permanent>
                {island.displayName}
              </Tooltip>
            </CircleMarker>
          ))}
      </MapContainer>
    </div>
  );
}

export default TaiwanMap;
// #endregion
