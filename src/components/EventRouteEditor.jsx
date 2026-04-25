'use client';

import dynamic from 'next/dynamic';
import { normalizeRoutePolylines, countTotalPoints } from '@/lib/event-helpers';
import styles from './EventEditForm.module.css';

const EventMap = dynamic(() => import('@/components/EventMap'), { ssr: false });

/**
 * @typedef {import('@/lib/event-helpers').RoutePayload} RoutePayload
 */

/**
 * @typedef {object} EventRouteEditorProps
 * @property {'view'|'none'|'draw'} routeMode - 目前路線編輯模式。
 * @property {RoutePayload|null|undefined} route - 原始活動路線資料。
 * @property {boolean} routeCleared - 是否已清除路線。
 * @property {Array<Array<{lat: number, lng: number}>>|null} editedRouteCoordinates - 使用者繪製的新路線座標。
 * @property {(mode: 'view'|'none'|'draw') => void} onModeChange - 路線模式切換回呼。
 * @property {(cleared: boolean) => void} onRouteClearedChange - 路線清除狀態變更回呼。
 * @property {(coords: Array<Array<{lat: number, lng: number}>>|null) => void} onRouteDrawn - 路線繪製完成回呼。
 * @property {(coords: Array<Array<{lat: number, lng: number}>>|null) => void} onEditedRouteChange - 編輯路線座標變更回呼。
 */

/**
 * EventRouteEditor — 活動路線編輯區塊，支援 view / none / draw 三種模式切換。
 * @param {EventRouteEditorProps} props - Component props.
 * @returns {import('react').ReactElement} 路線編輯區塊元件。
 */
export default function EventRouteEditor({
  routeMode,
  route,
  routeCleared,
  editedRouteCoordinates,
  onModeChange,
  onRouteClearedChange,
  onRouteDrawn,
  onEditedRouteChange,
}) {
  return (
    <div className={styles.formGroup}>
      <div className={styles.routeSectionLabel}>活動路線</div>

      {routeMode === 'view' && route && (
        <>
          <div className={styles.routeStatusText}>
            已設定路線（
            {route.pointsCount ?? '?'} 點）
          </div>
          <div className={styles.mapContainer}>
            <EventMap
              mode="view"
              encodedPolylines={normalizeRoutePolylines(route)}
              bbox={route.bbox}
              height={320}
            />
          </div>
          <div className={styles.routeActions}>
            <button
              type="button"
              className={styles.routeButton}
              onClick={() => {
                onModeChange('draw');
                onEditedRouteChange(null);
              }}
            >
              重新繪製路線
            </button>
            <button
              type="button"
              className={styles.routeButton}
              onClick={() => {
                onRouteClearedChange(true);
                onEditedRouteChange(null);
                onModeChange('none');
              }}
            >
              清除路線
            </button>
          </div>
        </>
      )}

      {routeMode === 'none' && (
        <>
          <div className={styles.routeStatusText}>
            {routeCleared ? '路線已清除' : '此活動未設定路線'}
          </div>
          <div className={styles.routeActions}>
            <button
              type="button"
              className={styles.routeButton}
              onClick={() => {
                onModeChange('draw');
                onEditedRouteChange(null);
              }}
            >
              {routeCleared ? '重新繪製路線' : '新增路線'}
            </button>
            {routeCleared && (
              <button
                type="button"
                className={styles.routeButton}
                onClick={() => {
                  onRouteClearedChange(false);
                  onModeChange(route ? 'view' : 'none');
                }}
              >
                復原清除
              </button>
            )}
          </div>
        </>
      )}

      {routeMode === 'draw' && (
        <>
          {editedRouteCoordinates ? (
            <div className={styles.routeStatusText}>
              路線已更新（
              {countTotalPoints(editedRouteCoordinates)} 點）
            </div>
          ) : (
            <div className={styles.routeStatusText}>
              {!routeCleared && route
                ? `編輯既有路線（${route.pointsCount ?? '?'} 點）`
                : '請在地圖上繪製路線'}
            </div>
          )}
          <div className={styles.mapContainer}>
            <EventMap
              mode="draw"
              onRouteDrawn={onRouteDrawn}
              initialEncodedPolylines={routeCleared ? undefined : normalizeRoutePolylines(route)}
              height={320}
            />
          </div>
          <div className={styles.routeActions}>
            <button
              type="button"
              className={styles.routeButton}
              onClick={() => {
                onEditedRouteChange(null);
                const fallbackMode = routeCleared || !route ? 'none' : 'view';
                onModeChange(fallbackMode);
              }}
            >
              取消繪製
            </button>
          </div>
        </>
      )}
    </div>
  );
}
