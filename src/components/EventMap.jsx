// src/components/EventMap.jsx
import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-geosearch/dist/geosearch.css';
import L from 'leaflet';
import 'leaflet-draw';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import polyline from '@mapbox/polyline';

// Fix for default icon issues with Webpack
// @ts-expect-error Leaflet prototype manipulation
// eslint-disable-next-line no-underscore-dangle -- Leaflet 內部：已知 Webpack icon 修復
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'leaflet/images/marker-icon-2x.png',
  iconUrl: 'leaflet/images/marker-icon.png',
  shadowUrl: 'leaflet/images/marker-shadow.png',
});

/**
 * 從 FeatureGroup 收集所有 Polyline 座標，每條線獨立一個子陣列。
 * @param {L.FeatureGroup} featureGroup - 包含 polyline 的圖層群組。
 * @returns {Array<Array<{lat: number, lng: number}>>|null} 多段座標，無圖層回傳 null。
 */
function collectAllCoords(featureGroup) {
  /** @type {Array<Array<{lat: number, lng: number}>>} */
  const all = [];
  featureGroup.eachLayer((layer) => {
    if (layer instanceof L.Polyline) {
      const latlngs = /** @type {L.LatLng[]} */ (layer.getLatLngs());
      const coords = latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }));
      if (coords.length > 0) all.push(coords);
    }
  });
  return all.length > 0 ? all : null;
}

// Draw mode: Leaflet.draw integration
/**
 * Leaflet.draw 繪圖控制器，支援載入既有路線作為可編輯 polyline。
 * @param {object} props - 元件屬性。
 * @param {(coords: Array<Array<{lat: number, lng: number}>>|null) => void} props.onRouteDrawn - 路線變更回呼。
 * @param {string[]} [props.initialEncodedPolylines] - 既有路線的 encoded polyline 陣列，進入 draw 模式時載入。
 * @returns {null} 不渲染任何 DOM。
 */
function DrawControl({ onRouteDrawn, initialEncodedPolylines }) {
  const map = useMap();

  useEffect(() => {
    const editableLayers = new L.FeatureGroup();
    map.addLayer(editableLayers);

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: editableLayers,
        remove: true,
      },
      draw: {
        polygon: false,
        marker: false,
        circlemarker: false,
        rectangle: false,
        circle: false,
        polyline: {
          shapeOptions: {
            color: '#f00',
            weight: 5,
            opacity: 0.7,
          },
        },
      },
    });

    map.addControl(drawControl);

    // 載入既有路線到 editableLayers，使其可編輯
    if (Array.isArray(initialEncodedPolylines) && initialEncodedPolylines.length > 0) {
      try {
        /** @type {L.LatLngBounds[]} */
        const allBounds = [];
        initialEncodedPolylines.forEach((encoded) => {
          const decoded = polyline.decode(encoded);
          const latlngs = decoded.map(([lat, lng]) => L.latLng(lat, lng));
          const line = L.polyline(latlngs, { color: '#f00', weight: 5, opacity: 0.7 });
          editableLayers.addLayer(line);
          if (latlngs.length > 0) allBounds.push(line.getBounds());
        });
        if (allBounds.length > 0) {
          const combined = allBounds.reduce((acc, b) => acc.extend(b));
          map.fitBounds(combined, { padding: [18, 18] });
        }
      } catch (err) {
        console.error('Failed to load initial routes for editing:', err);
      }
    }

    const handleCreated = (e) => {
      const { layer } = e;
      editableLayers.addLayer(layer);
      if (typeof onRouteDrawn === 'function') {
        onRouteDrawn(collectAllCoords(editableLayers));
      }
    };

    const handleEdited = () => {
      if (typeof onRouteDrawn === 'function') {
        onRouteDrawn(collectAllCoords(editableLayers));
      }
    };

    const handleDeleted = () => {
      if (typeof onRouteDrawn === 'function') {
        onRouteDrawn(collectAllCoords(editableLayers));
      }
    };

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, handleEdited);
    map.on(L.Draw.Event.DELETED, handleDeleted);

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(editableLayers);
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
      map.off(L.Draw.Event.DELETED, handleDeleted);
    };
  }, [map, onRouteDrawn, initialEncodedPolylines]);

  return null;
}

// Draw mode: search bar
/**
 * 地圖搜尋欄位，使用 OpenStreetMap 提供地點搜尋。
 * @returns {null} 不渲染任何 DOM。
 */
function SearchField() {
  const map = useMap();

  useEffect(() => {
    const provider = new OpenStreetMapProvider();

    // @ts-expect-error leaflet-geosearch types issue
    const searchControl = new GeoSearchControl({
      provider,
      style: 'bar',
      showMarker: false,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      keepResult: true,
      searchLabel: '輸入地點搜尋...',
    });

    map.addControl(searchControl);

    return () => {
      map.removeControl(searchControl);
    };
  }, [map]);

  return null;
}

// View mode: render route polylines + fit bounds
/**
 * 顯示多條路線的唯讀檢視元件。
 * @param {object} props - 元件屬性。
 * @param {string[]} props.encodedPolylines - encoded polyline 字串陣列。
 * @param {object} [props.bbox] - 邊界範圍。
 * @returns {null} 不渲染任何 DOM。
 */
function RouteViewer({ encodedPolylines, bbox }) {
  const map = useMap();

  const allLines = useMemo(() => {
    if (!Array.isArray(encodedPolylines) || encodedPolylines.length === 0) return null;
    try {
      return encodedPolylines
        .map((encoded) => polyline.decode(encoded).map(([lat, lng]) => [lat, lng]))
        .filter((coords) => coords.length > 0);
    } catch (e) {
      console.error('decode polylines failed:', e);
      return null;
    }
  }, [encodedPolylines]);

  useEffect(() => {
    if (!allLines || allLines.length === 0) return undefined;

    const layers = allLines.map((latlngs) =>
      L.polyline(latlngs, { color: '#f00', weight: 5, opacity: 0.8 }).addTo(map),
    );

    // 優先用 bbox fitBounds（更快），沒有 bbox 才用線段本身
    try {
      if (bbox && typeof bbox === 'object') {
        const sw = L.latLng(bbox.minLat, bbox.minLng);
        const ne = L.latLng(bbox.maxLat, bbox.maxLng);
        map.fitBounds(L.latLngBounds(sw, ne), { padding: [18, 18] });
      } else {
        const combined = layers.reduce(
          (acc, line) => acc.extend(line.getBounds()),
          layers[0].getBounds(),
        );
        map.fitBounds(combined, { padding: [18, 18] });
      }
    } catch {
      // 忽略 fit 失敗
    }

    return () => {
      layers.forEach((layer) => map.removeLayer(layer));
    };
  }, [map, allLines, bbox]);

  return null;
}

/**
 * 活動地圖元件，支援繪製（draw）和檢視（view）模式。
 * @param {object} props - 元件屬性。
 * @param {'draw'|'view'} [props.mode] - 地圖模式。
 * @param {(coords: Array<Array<{lat: number, lng: number}>>|null) => void} [props.onRouteDrawn] - draw 模式路線變更回呼。
 * @param {string[]} [props.encodedPolylines] - view 模式用的 encoded polyline 陣列。
 * @param {string[]} [props.initialEncodedPolylines] - draw 模式用的既有路線 encoded polyline 陣列。
 * @param {object} [props.bbox] - 邊界範圍。
 * @param {number} [props.height] - 地圖高度（px）。
 * @returns {React.JSX.Element} 地圖元件。
 */
export default function EventMap({
  mode = 'draw',
  onRouteDrawn,
  encodedPolylines,
  initialEncodedPolylines,
  bbox,
  height = 500,
}) {
  const taipeiCenter = /** @type {[number, number]} */ ([25.033964, 121.564468]);

  const mapStyle = {
    height: `${height}px`,
    width: '100%',
    borderRadius: '8px',
    zIndex: 0,
  };

  return (
    <MapContainer center={taipeiCenter} zoom={13} scrollWheelZoom style={mapStyle}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {mode === 'draw' && (
        <>
          <SearchField />
          <DrawControl
            onRouteDrawn={onRouteDrawn}
            initialEncodedPolylines={initialEncodedPolylines}
          />
        </>
      )}

      {mode === 'view' && <RouteViewer encodedPolylines={encodedPolylines} bbox={bbox} />}
    </MapContainer>
  );
}
