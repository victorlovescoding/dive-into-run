import dynamic from 'next/dynamic';
import styles from './EventsPageScreen.module.css';
import PaceSelector from './PaceSelector';

const EventMap = dynamic(() => import('@/components/EventMap'), { ssr: false });

/**
 * @typedef {object} DraftFormData
 * @property {string} [title] - 活動名稱草稿。
 * @property {string} [time] - 活動時間草稿。
 * @property {string} [registrationDeadline] - 報名截止時間草稿。
 * @property {string} [meetPlace] - 集合地點草稿。
 * @property {string} [runType] - 跑步類型草稿。
 * @property {string} [distanceKm] - 距離草稿。
 * @property {string} [paceMinutes] - 配速分鐘草稿。
 * @property {string} [paceSeconds] - 配速秒數草稿。
 * @property {string} [planRoute] - 是否繪製路線草稿（'yes' | 'no'）。
 * @property {string} [maxParticipants] - 人數上限草稿。
 * @property {string} [description] - 活動說明草稿。
 */

/**
 * @typedef {object} EventCreateFormProps
 * @property {string} hostName - 揪團人名稱（唯讀顯示）。
 * @property {DraftFormData | null} draftFormData - 表單草稿預設值。
 * @property {string} minDateTime - datetime-local 欄位的最小值。
 * @property {string} selectedCity - 目前選取的縣市。
 * @property {string} selectedDistrict - 目前選取的區域。
 * @property {Array<string>} cityOptions - 可選縣市列表。
 * @property {Array<string>} selectedDistrictOptions - 依選取縣市產生的區域列表。
 * @property {boolean} showMap - 是否顯示路線繪製地圖。
 * @property {Array<Array<{lat: number, lng: number}>> | null} routeCoordinates - 已繪製的路線座標。
 * @property {number} routePointCount - 路線座標點數量。
 * @property {boolean} isCreating - 是否正在建立活動中。
 * @property {(event: import('react').FormEvent<HTMLFormElement>) => void} onSubmit - 表單送出處理。
 * @property {() => void} onClose - 取消 / 關閉表單處理。
 * @property {(value: string) => void} onCityChange - 縣市變更處理。
 * @property {(value: string) => void} onDistrictChange - 區域變更處理。
 * @property {() => void} onEnableRoute - 啟用路線繪製。
 * @property {() => void} onDisableRoute - 停用路線繪製。
 * @property {(coords: Array<Array<{lat: number, lng: number}>> | null) => void} onRouteDrawn - 路線繪製完成回呼。
 */

/**
 * 揪團活動建立表單，包含所有欄位（名稱、時間、地點、路線、配速、人數上限、說明）。
 * 本身不持有狀態，所有資料與事件處理由父元件透過 props 傳入。
 * @param {EventCreateFormProps} props - 表單所需的資料與回呼。
 * @returns {import('react').ReactElement} 表單 JSX。
 */
export default function EventCreateForm({
  hostName,
  draftFormData,
  minDateTime,
  selectedCity,
  selectedDistrict,
  cityOptions,
  selectedDistrictOptions,
  showMap,
  routeCoordinates,
  routePointCount,
  isCreating,
  onSubmit,
  onClose,
  onCityChange,
  onDistrictChange,
  onEnableRoute,
  onDisableRoute,
  onRouteDrawn,
}) {
  return (
    <div className={styles.formOverlay}>
      <form
        className={styles.googleFormCard}
        aria-labelledby="event-create-form-title"
        onSubmit={onSubmit}
      >
        <div className={styles.formHeaderAccent} />

        <div className={styles.formHeader}>
          <h2 id="event-create-form-title">揪團表單</h2>
          <p className={styles.formDescription}>請填寫詳細資訊讓跑友們加入</p>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="hostName">
            揪團人
            <input
              id="hostName"
              type="text"
              name="hostName"
              value={hostName}
              readOnly
              aria-readonly="true"
              placeholder="將自動帶入您的會員名稱"
            />
          </label>
          <div className={styles.focusBorder} />
          <small className={styles.helperText}>由登入帳號自動帶入，無法修改</small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="title">
            活動名稱
            <input
              id="title"
              type="text"
              name="title"
              required
              placeholder="例如：大安森林公園輕鬆跑"
              defaultValue={draftFormData?.title || ''}
            />
          </label>
          <div className={styles.focusBorder} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="time">
            活動時間
            <input
              id="time"
              type="datetime-local"
              name="time"
              min={minDateTime}
              required
              defaultValue={draftFormData?.time || ''}
            />
          </label>
          <div className={styles.focusBorder} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="registrationDeadline">
            報名截止時間
            <input
              id="registrationDeadline"
              type="datetime-local"
              name="registrationDeadline"
              min={minDateTime}
              required
              defaultValue={draftFormData?.registrationDeadline || ''}
            />
          </label>
          <div className={styles.focusBorder} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="city">
            活動區域
            <div className={styles.flexRowGap10}>
              <select
                id="city"
                name="city"
                value={selectedCity}
                onChange={(event) => onCityChange(event.target.value)}
                required
                className={`${styles.selectField} ${styles.flex1}`}
              >
                <option value="" disabled>
                  請選擇縣市
                </option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>

              <select
                id="district"
                name="district"
                aria-label="選擇區域"
                value={selectedDistrict}
                onChange={(event) => onDistrictChange(event.target.value)}
                required
                className={`${styles.selectField} ${styles.flex1}`}
              >
                <option value="" disabled>
                  請選擇區域
                </option>
                {selectedDistrictOptions.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="meetPlace">
            集合地點
            <input
              id="meetPlace"
              type="text"
              name="meetPlace"
              required
              placeholder="例如：大安森林公園 2號出口"
              defaultValue={draftFormData?.meetPlace || ''}
            />
          </label>
          <div className={styles.focusBorder} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="runType">
            跑步類型
            <select
              name="runType"
              id="runType"
              className={styles.selectField}
              required
              defaultValue={draftFormData?.runType || ''}
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
          <div className={styles.focusBorder} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="distanceKm">
            距離（公里）
            <input
              id="distanceKm"
              name="distanceKm"
              type="number"
              min={0.1}
              step={0.1}
              required
              placeholder="10"
              defaultValue={draftFormData?.distanceKm || ''}
            />
          </label>
          <div className={styles.focusBorder} />
        </div>

        <PaceSelector
          defaultPaceMinutes={draftFormData?.paceMinutes}
          defaultPaceSeconds={draftFormData?.paceSeconds}
        />

        <div className={styles.formGroup}>
          <div className={styles.formLabel}>是否需要繪製活動路線？</div>
          <div className={styles.radioGroup}>
            <label htmlFor="planRouteYes">
              <input
                type="radio"
                id="planRouteYes"
                name="planRoute"
                value="yes"
                required
                defaultChecked={draftFormData?.planRoute === 'yes'}
                onChange={onEnableRoute}
              />{' '}
              是
            </label>
            <label htmlFor="planRouteNo">
              <input
                type="radio"
                id="planRouteNo"
                name="planRoute"
                value="no"
                required
                defaultChecked={draftFormData?.planRoute === 'no'}
                onChange={onDisableRoute}
              />{' '}
              否
            </label>
          </div>
          <div className={styles.focusBorder} />
        </div>

        {showMap && (
          <div className={styles.formGroup}>
            <div className={styles.formLabel}>繪製活動路線</div>
            <EventMap onRouteDrawn={onRouteDrawn} />
            {routeCoordinates && (
              <p className={styles.helperText}>路線已繪製，包含 {routePointCount} 個點。</p>
            )}
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="maxParticipants">
            人數上限
            <input
              id="maxParticipants"
              name="maxParticipants"
              type="number"
              min={2}
              defaultValue={draftFormData?.maxParticipants || '2'}
            />
          </label>
          <div className={styles.focusBorder} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">
            活動說明
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="請說明活動內容、注意事項、集合細節等"
              className={styles.textareaField}
              defaultValue={draftFormData?.description || ''}
            />
          </label>
          <div className={styles.focusBorder} />
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isCreating}
          >
            取消
          </button>
          <button type="submit" className={styles.submitButton} disabled={isCreating}>
            {isCreating ? '建立中…' : '建立活動'}
          </button>
        </div>
      </form>
    </div>
  );
}
