'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { decodePolyline } from '@/lib/strava-helpers';
import styles from './RunsRouteMap.module.css';

/**
 * 自動 fit bounds 到 polyline 範圍的內部元件。
 * @param {object} props - 元件 props。
 * @param {number[][]} props.coords - 座標陣列 [[lat, lng], ...]。
 * @returns {null} 不渲染任何 DOM。
 */
function FitBounds({ coords }) {
  const map = useMap();

  useEffect(() => {
    if (coords.length > 0) {
      map.fitBounds(/** @type {import('leaflet').LatLngBoundsExpression} */ (coords));
    }
  }, [map, coords]);

  return null;
}

/**
 * 路線地圖內部元件，渲染 Leaflet 地圖與 polyline 路線。
 * @param {object} props - 元件 props。
 * @param {string | null | undefined} props.summaryPolyline - Google Encoded Polyline 字串。
 * @returns {import('react').ReactElement} Leaflet 地圖或空 div。
 */
export default function RunsRouteMapInner({ summaryPolyline }) {
  const coords = decodePolyline(summaryPolyline);

  if (coords.length === 0) {
    return <div />;
  }

  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={coords[0]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={coords} color="#3b82f6" weight={4} />
        <FitBounds coords={coords} />
      </MapContainer>
    </div>
  );
}
