'use client';

import taiwanLocations from '@/config/geo/taiwan-locations';
import useEventEditForm, { PACE_MINUTES, PACE_SECONDS } from '@/runtime/hooks/useEventEditForm';
import EventRouteEditor from '@/components/EventRouteEditor';
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
 * EventEditForm — 活動編輯表單，預填現有資料並支援 dirty detection。
 * 僅在至少一個欄位有所變更時，「編輯完成」按鈕才可點擊。
 * @param {EventEditFormProps} props - Component props.
 * @returns {import('react').ReactElement} 活動編輯表單元件。
 */
export default function EventEditForm({ event, onSubmit, onCancel, isSubmitting = false }) {
  const {
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
  } = useEventEditForm(event);

  /**
   * 處理表單送出，收集有變更的欄位並呼叫 onSubmit。
   * @param {import('react').FormEvent<HTMLFormElement>} e - 表單事件。
   */
  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(buildChanges());
  }

  return (
    <form className={styles.googleFormCard} onSubmit={handleSubmit}>
      <div className={styles.formHeaderAccent} />

      <div className={styles.formHeader}>
        <h2>編輯活動</h2>
        <p className={styles.formDescription}>修改活動資訊，僅變更的欄位會被更新</p>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="edit-hostName">
          揪團人
          <input
            id="edit-hostName"
            type="text"
            value={event.hostName || ''}
            readOnly
            aria-readonly="true"
          />
        </label>
        <small className={styles.helperText}>揪團人無法修改</small>
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
        <label className={styles.formLabel} htmlFor="edit-city">
          活動區域
          <div className={styles.flexRowGap10}>
            <select
              id="edit-city"
              className={`${styles.selectField} ${styles.flex1}`}
              value={formCity}
              onChange={(e) => {
                setFormCity(e.target.value);
                setFormDistrict('');
              }}
            >
              <option value="" disabled>
                請選擇縣市
              </option>
              {Object.keys(taiwanLocations).map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>

            <select
              id="edit-district"
              aria-label="選擇區域"
              className={`${styles.selectField} ${styles.flex1}`}
              value={formDistrict}
              onChange={(e) => setFormDistrict(e.target.value)}
            >
              <option value="" disabled>
                請選擇區域
              </option>
              {formCity &&
                taiwanLocations[formCity]?.map((/** @type {string} */ dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
            </select>
          </div>
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
        <label htmlFor="edit-runType">
          跑步類型
          <select
            id="edit-runType"
            className={styles.selectField}
            value={formRunType}
            onChange={(e) => setFormRunType(e.target.value)}
          >
            <option value="" disabled>
              請選擇跑步類型
            </option>
            <option value="easy_run">輕鬆慢跑（Easy Run）</option>
            <option value="long_run">長距離慢跑（Long Run）</option>
            <option value="tempo_run">節奏跑（Tempo Run）</option>
            <option value="interval_training">間歇訓練（Interval Training）</option>
            <option value="hill_training">坡度訓練（Hill Training）</option>
            <option value="fartlek">變速跑（Fartlek）</option>
            <option value="trail_run">越野跑（Trail Run）</option>
            <option value="social_run">休閒社交跑（Social Run）</option>
          </select>
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
                  <option key={m} value={m}>
                    {m}
                  </option>
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
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* 路線編輯區塊 */}
      <EventRouteEditor
        routeMode={routeMode}
        route={event.route}
        routeCleared={routeCleared}
        editedRouteCoordinates={editedRouteCoordinates}
        onModeChange={setRouteMode}
        onRouteClearedChange={setRouteCleared}
        onRouteDrawn={handleRouteDrawn}
        onEditedRouteChange={setEditedRouteCoordinates}
      />

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
        <button type="submit" className={styles.submitButton} disabled={!isDirty || !!isSubmitting}>
          {isSubmitting ? '編輯中…' : '編輯完成'}
        </button>
      </div>
    </form>
  );
}
