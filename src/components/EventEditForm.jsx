'use client';

import { useState, useMemo } from 'react';
import styles from './EventEditForm.module.css';

/**
 * @typedef {import('@/lib/event-helpers').EventData} EventData
 */

/**
 * @typedef {object} EventEditFormProps
 * @property {EventData} event - 要編輯的活動資料（用於預填表單）。
 * @property {(data: object) => void | Promise<void>} onSubmit - 提交更新資料的回呼。
 * @property {() => void} onCancel - 取消編輯的回呼。
 * @property {boolean} [isSubmitting] - 是否正在送出更新中。
 */

/**
 * 將 Firestore Timestamp 或任意值轉為 datetime-local input 的格式（YYYY-MM-DDTHH:mm，本地時間）。
 * @param {import('@/lib/event-helpers').FirestoreTimestamp|string|null|undefined} value - 時間值。
 * @returns {string} datetime-local 格式字串，無法解析時回傳空字串。
 */
function toDatetimeLocal(value) {
  if (!value) return '';
  const val = /** @type {any} */ (value);
  const date = typeof val.toDate === 'function' ? val.toDate() : new Date(/** @type {string} */ (value));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 配速（分鐘）選項：02–20 分 */
const PACE_MINUTES = [...Array(19)].map((_, i) => String(i + 2).padStart(2, '0'));

/** 配速（秒）選項：00–59 秒 */
const PACE_SECONDS = [...Array(60).keys()].map((s) => String(s).padStart(2, '0'));

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
 * EventEditForm — 活動編輯表單，預填現有資料並支援 dirty detection。
 * 僅在至少一個欄位有所變更時，「編輯完成」按鈕才可點擊。
 * @param {EventEditFormProps} props - Component props.
 * @returns {import('react').ReactElement} 活動編輯表單元件。
 */
export default function EventEditForm({
  event,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) {
  const { paceMinStr: initPaceMin, paceSecStr: initPaceSec } = deriveInitialPace(event.paceSec);

  const [formTitle, setFormTitle] = useState(String(event.title || ''));
  const [formTime, setFormTime] = useState(toDatetimeLocal(event.time));
  const [formDeadline, setFormDeadline] = useState(toDatetimeLocal(event.registrationDeadline));
  const [formMeetPlace, setFormMeetPlace] = useState(String(event.meetPlace || ''));
  const [formDistance, setFormDistance] = useState(String(event.distanceKm ?? ''));
  const [formMaxParticipants, setFormMaxParticipants] = useState(String(event.maxParticipants ?? ''));
  const [formPaceMin, setFormPaceMin] = useState(initPaceMin);
  const [formPaceSec, setFormPaceSec] = useState(initPaceSec);
  const [formDescription, setFormDescription] = useState(String(event.description || ''));

  // 計算 dirty 狀態（shallow compare）— useMemo 避免每次 render 重算（event prop 只在開啟/關閉時改變）
  const {
    origTitle, origTime, origDeadline, origMeetPlace,
    origDistance, origMaxParticipants, origPaceMin, origPaceSec, origDescription,
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
    };
  }, [event]);

  const isDirty = (
    formTitle !== origTitle
    || formTime !== origTime
    || formDeadline !== origDeadline
    || formMeetPlace !== origMeetPlace
    || formDistance !== origDistance
    || formMaxParticipants !== origMaxParticipants
    || formPaceMin !== origPaceMin
    || formPaceSec !== origPaceSec
    || formDescription !== origDescription
  );

  const maxParticipantsMin = Math.max(Number(event.participantsCount || 0), 2);

  /**
   * 處理表單送出，收集有變更的欄位並呼叫 onSubmit。
   * @param {import('react').FormEvent<HTMLFormElement>} e - 表單事件。
   */
  function handleSubmit(e) {
    e.preventDefault();

    /** @type {Record<string, unknown>} */
    const changes = { id: event.id };

    if (formTitle !== origTitle) changes.title = formTitle;
    if (formTime !== origTime) changes.time = formTime;
    if (formDeadline !== origDeadline) changes.registrationDeadline = formDeadline;
    if (formMeetPlace !== origMeetPlace) changes.meetPlace = formMeetPlace;
    if (formDistance !== origDistance) changes.distanceKm = Number(formDistance);
    if (formMaxParticipants !== origMaxParticipants) changes.maxParticipants = Number(formMaxParticipants);
    if (formPaceMin !== origPaceMin || formPaceSec !== origPaceSec) {
      changes.paceSec = Number(formPaceMin) * 60 + Number(formPaceSec);
    }
    if (formDescription !== origDescription) changes.description = formDescription;

    onSubmit(changes);
  }

  return (
    <form className={styles.googleFormCard} onSubmit={handleSubmit}>
      <div className={styles.formHeaderAccent} />

      <div className={styles.formHeader}>
        <h2>編輯活動</h2>
        <p className={styles.formDescription}>修改活動資訊，僅變更的欄位會被更新</p>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="edit-title">
          活動名稱
          <input
            id="edit-title"
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="edit-time">
          活動時間
          <input
            id="edit-time"
            type="datetime-local"
            value={formTime}
            onChange={(e) => setFormTime(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="edit-registrationDeadline">
          報名截止時間
          <input
            id="edit-registrationDeadline"
            type="datetime-local"
            value={formDeadline}
            onChange={(e) => setFormDeadline(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="edit-meetPlace">
          集合地點
          <input
            id="edit-meetPlace"
            type="text"
            value={formMeetPlace}
            onChange={(e) => setFormMeetPlace(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="edit-distanceKm">
          距離（公里）
          <input
            id="edit-distanceKm"
            type="number"
            min={0.1}
            step={0.1}
            value={formDistance}
            onChange={(e) => setFormDistance(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.formGroup}>
        <div className={styles.paceRow}>
          <div>
            <label htmlFor="edit-paceMinutes">
              配速（分）
              <select
                id="edit-paceMinutes"
                className={styles.selectField}
                value={formPaceMin}
                onChange={(e) => setFormPaceMin(e.target.value)}
              >
                {PACE_MINUTES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label htmlFor="edit-paceSeconds">
              配速（秒）
              <select
                id="edit-paceSeconds"
                className={styles.selectField}
                value={formPaceSec}
                onChange={(e) => setFormPaceSec(e.target.value)}
              >
                {PACE_SECONDS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="edit-maxParticipants">
          人數上限
          <input
            id="edit-maxParticipants"
            type="number"
            min={maxParticipantsMin}
            value={formMaxParticipants}
            onChange={(e) => setFormMaxParticipants(e.target.value)}
          />
        </label>
        <small className={styles.helperText}>
          最低不可低於目前已報名人數（
          {maxParticipantsMin}
          人）
        </small>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="edit-description">
          活動說明
          <textarea
            id="edit-description"
            className={styles.textareaField}
            rows={4}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          取消編輯
        </button>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={!isDirty || !!isSubmitting}
        >
          {isSubmitting ? '編輯中…' : '編輯完成'}
        </button>
      </div>
    </form>
  );
}
