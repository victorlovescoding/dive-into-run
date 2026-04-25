import { useState, useMemo, useCallback } from 'react';
import { buildRoutePayload } from '@/service/event-service';

/**
 * @typedef {import('@/service/event-service').EventData} EventData
 * @typedef {{toDate: () => Date}} FirestoreTimestamp
 */

/**
 * @typedef {object} EventEditFormState
 * @property {string} formTitle - 活動名稱。
 * @property {(v: string) => void} setFormTitle - 設定活動名稱。
 * @property {string} formTime - 活動時間（datetime-local 格式）。
 * @property {(v: string) => void} setFormTime - 設定活動時間。
 * @property {string} formDeadline - 報名截止時間（datetime-local 格式）。
 * @property {(v: string) => void} setFormDeadline - 設定報名截止時間。
 * @property {string} formMeetPlace - 集合地點。
 * @property {(v: string) => void} setFormMeetPlace - 設定集合地點。
 * @property {string} formDistance - 距離（公里）字串。
 * @property {(v: string) => void} setFormDistance - 設定距離。
 * @property {string} formMaxParticipants - 人數上限字串。
 * @property {(v: string) => void} setFormMaxParticipants - 設定人數上限。
 * @property {string} formPaceMin - 配速（分鐘）。
 * @property {(v: string) => void} setFormPaceMin - 設定配速分鐘。
 * @property {string} formPaceSec - 配速（秒）。
 * @property {(v: string) => void} setFormPaceSec - 設定配速秒。
 * @property {string} formDescription - 活動說明。
 * @property {(v: string) => void} setFormDescription - 設定活動說明。
 * @property {string} formCity - 縣市。
 * @property {(v: string) => void} setFormCity - 設定縣市。
 * @property {string} formDistrict - 區域。
 * @property {(v: string) => void} setFormDistrict - 設定區域。
 * @property {string} formRunType - 跑步類型。
 * @property {(v: string) => void} setFormRunType - 設定跑步類型。
 * @property {'view'|'none'|'draw'} routeMode - 路線編輯模式。
 * @property {(v: 'view'|'none'|'draw') => void} setRouteMode - 設定路線編輯模式。
 * @property {Array<Array<{lat: number, lng: number}>>|null} editedRouteCoordinates - 編輯後的路線座標。
 * @property {(coords: Array<Array<{lat: number, lng: number}>>|null) => void} setEditedRouteCoordinates - 設定編輯後的路線座標。
 * @property {boolean} routeCleared - 是否已清除路線。
 * @property {(v: boolean) => void} setRouteCleared - 設定路線清除狀態。
 * @property {(coords: Array<Array<{lat: number, lng: number}>>|null) => void} handleRouteDrawn - 處理路線繪製完成的回呼。
 * @property {boolean} isDirty - 表單是否有任何欄位被變更。
 * @property {() => Record<string, unknown>} buildChanges - 收集有變更的欄位，回傳變更物件。
 * @property {number} maxParticipantsMin - 人數上限最小值（不可低於目前已報名人數）。
 */

/** 配速（分鐘）選項：02–20 分 */
const PACE_MINUTES = [...Array(19)].map((_, i) => String(i + 2).padStart(2, '0'));

/** 配速（秒）選項：00–59 秒 */
const PACE_SECONDS = [...Array(60).keys()].map((s) => String(s).padStart(2, '0'));

/**
 * 將 Firestore Timestamp 或任意值轉為 datetime-local input 的格式（YYYY-MM-DDTHH:mm，本地時間）。
 * @param {FirestoreTimestamp|string|null|undefined} value - 時間值。
 * @returns {string} datetime-local 格式字串，無法解析時回傳空字串。
 */
function toDatetimeLocal(value) {
  if (!value) return '';
  const val = /** @type {{ toDate?: () => Date }} */ (value);
  const date =
    typeof val.toDate === 'function' ? val.toDate() : new Date(/** @type {string} */ (value));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 從 paceSec 推算初始配速字串。
 * @param {number} paceSec - 每公里配速秒數。
 * @returns {{ paceMinStr: string, paceSecStr: string }} 配速分鐘和秒的字串。
 */
function deriveInitialPace(paceSec) {
  const totalSec = Number(paceSec || 0);
  const paceMinStr = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const paceSecStr = String(totalSec % 60).padStart(2, '0');
  return { paceMinStr, paceSecStr };
}

/**
 * 管理活動編輯表單的所有 state、dirty detection 和輔助函式。
 * @param {EventData} event - 要編輯的活動資料（用於預填表單與 dirty 比對）。
 * @returns {EventEditFormState} 表單狀態、setter、dirty 狀態與輔助值。
 */
export default function useEventEditForm(event) {
  const { paceMinStr: initPaceMin, paceSecStr: initPaceSec } = deriveInitialPace(event.paceSec);

  const [formTitle, setFormTitle] = useState(String(event.title || ''));
  const [formTime, setFormTime] = useState(toDatetimeLocal(event.time));
  const [formDeadline, setFormDeadline] = useState(toDatetimeLocal(event.registrationDeadline));
  const [formMeetPlace, setFormMeetPlace] = useState(String(event.meetPlace || ''));
  const [formDistance, setFormDistance] = useState(String(event.distanceKm ?? ''));
  const [formMaxParticipants, setFormMaxParticipants] = useState(
    String(event.maxParticipants ?? ''),
  );
  const [formPaceMin, setFormPaceMin] = useState(initPaceMin);
  const [formPaceSec, setFormPaceSec] = useState(initPaceSec);
  const [formDescription, setFormDescription] = useState(String(event.description || ''));
  const [formCity, setFormCity] = useState(String(event.city || ''));
  const [formDistrict, setFormDistrict] = useState(String(event.district || ''));
  const [formRunType, setFormRunType] = useState(String(event.runType || ''));

  // 路線編輯 state
  const [routeMode, setRouteMode] = useState(
    /** @type {'view'|'none'|'draw'} */ (event.route ? 'view' : 'none'),
  );
  const [editedRouteCoordinates, setEditedRouteCoordinates] = useState(
    /** @type {Array<Array<{lat: number, lng: number}>>|null} */ (null),
  );
  const [routeCleared, setRouteCleared] = useState(false);

  /** @type {(coords: Array<Array<{lat: number, lng: number}>>|null) => void} */
  const handleRouteDrawn = useCallback((coords) => {
    setEditedRouteCoordinates(coords);
    if (coords) {
      setRouteCleared(false);
    }
  }, []);

  // 計算 dirty 狀態（shallow compare）— useMemo 避免每次 render 重算（event prop 只在開啟/關閉時改變）
  const {
    origTitle,
    origTime,
    origDeadline,
    origMeetPlace,
    origDistance,
    origMaxParticipants,
    origPaceMin,
    origPaceSec,
    origDescription,
    origCity,
    origDistrict,
    origRunType,
  } = useMemo(() => {
    const { paceMinStr, paceSecStr } = deriveInitialPace(event.paceSec);
    return {
      origTitle: String(event.title || ''),
      origTime: toDatetimeLocal(event.time),
      origDeadline: toDatetimeLocal(event.registrationDeadline),
      origMeetPlace: String(event.meetPlace || ''),
      origDistance: String(event.distanceKm ?? ''),
      origMaxParticipants: String(event.maxParticipants ?? ''),
      origPaceMin: paceMinStr,
      origPaceSec: paceSecStr,
      origDescription: String(event.description || ''),
      origCity: String(event.city || ''),
      origDistrict: String(event.district || ''),
      origRunType: String(event.runType || ''),
    };
  }, [event]);

  const isRouteDirty = (routeCleared && Boolean(event.route)) || editedRouteCoordinates !== null;

  const isDirty =
    formTitle !== origTitle ||
    formTime !== origTime ||
    formDeadline !== origDeadline ||
    formMeetPlace !== origMeetPlace ||
    formDistance !== origDistance ||
    formMaxParticipants !== origMaxParticipants ||
    formPaceMin !== origPaceMin ||
    formPaceSec !== origPaceSec ||
    formDescription !== origDescription ||
    formCity !== origCity ||
    formDistrict !== origDistrict ||
    formRunType !== origRunType ||
    isRouteDirty;

  const maxParticipantsMin = Math.max(Number(event.participantsCount || 0), 2);

  /**
   * 收集有變更的欄位，回傳包含 event.id 與所有 dirty 欄位的物件。
   * @returns {Record<string, unknown>} 變更物件。
   */
  function buildChanges() {
    /** @type {Record<string, unknown>} */
    const changes = { id: event.id };

    if (formTitle !== origTitle) changes.title = formTitle;
    if (formTime !== origTime) changes.time = formTime;
    if (formDeadline !== origDeadline) changes.registrationDeadline = formDeadline;
    if (formMeetPlace !== origMeetPlace) changes.meetPlace = formMeetPlace;
    if (formDistance !== origDistance) changes.distanceKm = Number(formDistance);
    if (formMaxParticipants !== origMaxParticipants)
      changes.maxParticipants = Number(formMaxParticipants);
    if (formPaceMin !== origPaceMin || formPaceSec !== origPaceSec) {
      changes.paceSec = Number(formPaceMin) * 60 + Number(formPaceSec);
    }
    if (formDescription !== origDescription) changes.description = formDescription;
    if (formCity !== origCity) changes.city = formCity;
    if (formDistrict !== origDistrict) changes.district = formDistrict;
    if (formRunType !== origRunType) changes.runType = formRunType;

    if (isRouteDirty) {
      if (routeCleared && !editedRouteCoordinates) {
        changes.route = null;
      } else if (editedRouteCoordinates) {
        changes.route = buildRoutePayload(editedRouteCoordinates);
      }
    }

    return changes;
  }

  return {
    formTitle,
    setFormTitle,
    formTime,
    setFormTime,
    formDeadline,
    setFormDeadline,
    formMeetPlace,
    setFormMeetPlace,
    formDistance,
    setFormDistance,
    formMaxParticipants,
    setFormMaxParticipants,
    formPaceMin,
    setFormPaceMin,
    formPaceSec,
    setFormPaceSec,
    formDescription,
    setFormDescription,
    formCity,
    setFormCity,
    formDistrict,
    setFormDistrict,
    formRunType,
    setFormRunType,
    routeMode,
    setRouteMode,
    editedRouteCoordinates,
    setEditedRouteCoordinates,
    routeCleared,
    setRouteCleared,
    handleRouteDrawn,
    isDirty,
    buildChanges,
    maxParticipantsMin,
  };
}

export { PACE_MINUTES, PACE_SECONDS, toDatetimeLocal, deriveInitialPace };
