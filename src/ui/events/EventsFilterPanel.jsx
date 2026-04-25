import styles from './EventsPageScreen.module.css';

/**
 * @typedef {object} EventsFilterPanelProps
 * @property {boolean} filterHasSeatsOnly - 是否只顯示還有名額的活動。
 * @property {string} filterTimeStart - 篩選活動開始時間（起）。
 * @property {string} filterTimeEnd - 篩選活動開始時間（迄）。
 * @property {string} filterDistanceMin - 篩選最小跑步距離。
 * @property {string} filterDistanceMax - 篩選最大跑步距離。
 * @property {string} filterCity - 篩選縣市。
 * @property {string} filterDistrict - 篩選區域。
 * @property {Array<string>} cityOptions - 可選縣市列表。
 * @property {Array<string>} filterDistrictOptions - 依篩選縣市產生的區域列表。
 * @property {(checked: boolean) => void} onHasSeatsOnlyChange - 切換名額篩選。
 * @property {(value: string) => void} onTimeStartChange - 變更活動開始時間（起）。
 * @property {(value: string) => void} onTimeEndChange - 變更活動開始時間（迄）。
 * @property {(value: string) => void} onDistanceMinChange - 變更最小跑步距離。
 * @property {(value: string) => void} onDistanceMaxChange - 變更最大跑步距離。
 * @property {(value: string) => void} onCityChange - 變更篩選縣市。
 * @property {(value: string) => void} onDistrictChange - 變更篩選區域。
 * @property {() => void} onClose - 關閉篩選面板。
 * @property {() => void} onClear - 清除所有篩選條件。
 * @property {() => void} onSearch - 執行篩選搜尋。
 */

/**
 * 活動篩選面板，以 overlay modal 形式呈現，包含名額、時間範圍、距離範圍、
 * 縣市/區域選擇器與清除/搜尋按鈕。本身不持有狀態，所有資料與事件處理由父元件透過 props 傳入。
 * @param {EventsFilterPanelProps} props - 篩選面板所需的資料與回呼。
 * @returns {import('react').ReactElement} 篩選面板 JSX。
 */
export default function EventsFilterPanel({
  filterHasSeatsOnly,
  filterTimeStart,
  filterTimeEnd,
  filterDistanceMin,
  filterDistanceMax,
  filterCity,
  filterDistrict,
  cityOptions,
  filterDistrictOptions,
  onHasSeatsOnlyChange,
  onTimeStartChange,
  onTimeEndChange,
  onDistanceMinChange,
  onDistanceMaxChange,
  onCityChange,
  onDistrictChange,
  onClose,
  onClear,
  onSearch,
}) {
  return (
    <div className={styles.filterOverlay}>
      <div
        className={styles.overlayBackground}
        role="button"
        aria-label="關閉篩選"
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
            onClose();
          }
        }}
        tabIndex={0}
      />
      <div className={styles.filterCard} role="dialog" aria-modal="true" aria-label="篩選活動詳情">
        <div className={styles.filterHeader}>
          <div className={styles.filterHeaderTitle}>篩選活動</div>
          <button
            type="button"
            className={styles.filterCloseButton}
            aria-label="關閉篩選"
            onClick={onClose}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className={styles.filterBody}>
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>名額狀況</div>
            <div className={styles.filterToggleRow}>
              <span className={styles.filterToggleLabel}>只顯示還有名額的活動</span>
              <label className={styles.switch} htmlFor="filterHasSeatsOnly">
                <input
                  type="checkbox"
                  id="filterHasSeatsOnly"
                  checked={filterHasSeatsOnly}
                  onChange={(event) => onHasSeatsOnlyChange(event.target.checked)}
                  aria-label="只顯示還有名額的活動"
                />
                <span className={`${styles.slider} ${styles.round}`} />
              </label>
            </div>
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>活動時間</div>
            <div className={styles.filterRow}>
              <div className={styles.filterRowItem}>
                <input
                  type="datetime-local"
                  id="filterTimeStart"
                  className={styles.filterTextField}
                  value={filterTimeStart}
                  onChange={(event) => onTimeStartChange(event.target.value)}
                  aria-label="活動開始時間（起）"
                />
              </div>
              <span className={styles.filterSeparator}>至</span>
              <div className={styles.filterRowItem}>
                <input
                  type="datetime-local"
                  id="filterTimeEnd"
                  className={styles.filterTextField}
                  value={filterTimeEnd}
                  onChange={(event) => onTimeEndChange(event.target.value)}
                  aria-label="活動開始時間（迄）"
                />
              </div>
            </div>
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>跑步距離 (km)</div>
            <div className={styles.filterRow}>
              <div className={styles.filterRowItem}>
                <input
                  type="number"
                  id="filterDistanceMin"
                  className={styles.filterTextField}
                  placeholder="最小距離"
                  aria-label="最小跑步距離"
                  min={0}
                  step={0.1}
                  value={filterDistanceMin}
                  onChange={(event) => onDistanceMinChange(event.target.value)}
                />
              </div>
              <span className={styles.filterSeparator}>-</span>
              <div className={styles.filterRowItem}>
                <input
                  type="number"
                  id="filterDistanceMax"
                  className={styles.filterTextField}
                  placeholder="最大距離"
                  aria-label="最大跑步距離"
                  min={0}
                  step={0.1}
                  value={filterDistanceMax}
                  onChange={(event) => onDistanceMaxChange(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>活動區域</div>
            <div className={styles.filterRow}>
              <label htmlFor="filterCity" className={styles.flex1}>
                <span className={styles.srOnly}>選擇縣市</span>
                <select
                  id="filterCity"
                  className={styles.selectField}
                  value={filterCity}
                  onChange={(event) => onCityChange(event.target.value)}
                >
                  <option value="">所有縣市</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="filterDistrict" className={styles.flex1}>
                <span className={styles.srOnly}>選擇區域</span>
                <select
                  id="filterDistrict"
                  className={styles.selectField}
                  value={filterDistrict}
                  onChange={(event) => onDistrictChange(event.target.value)}
                  disabled={!filterCity}
                >
                  <option value="">所有區域</option>
                  {filterDistrictOptions.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className={styles.filterActions}>
            <button type="button" className={styles.filterClearButton} onClick={onClear}>
              清除
            </button>
            <button type="button" className={styles.filterSearchButton} onClick={onSearch}>
              搜尋
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
