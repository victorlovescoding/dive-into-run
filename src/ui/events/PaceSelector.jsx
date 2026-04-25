import styles from './EventsPageScreen.module.css';

/**
 * @typedef {object} PaceSelectorProps
 * @property {string} [defaultPaceMinutes] - 配速分鐘預設值。
 * @property {string} [defaultPaceSeconds] - 配速秒數預設值。
 */

/**
 * 配速選擇器，包含分鐘與秒數兩個下拉選單。
 * @param {PaceSelectorProps} props - 配速選擇器所需的資料。
 * @returns {import('react').ReactElement} 配速選擇器 JSX。
 */
export default function PaceSelector({ defaultPaceMinutes, defaultPaceSeconds }) {
  return (
    <div className={styles.formGroup}>
      <div className={styles.formLabel}>目標配速（每公里）</div>
      <div className={`${styles.flexRowGap10} ${styles.flexAlignCenter}`}>
        <label htmlFor="paceMinutes" className={styles.flexAlignCenter}>
          <select
            id="paceMinutes"
            name="paceMinutes"
            className={`${styles.selectField} ${styles.centerSelect}`}
            required
            defaultValue={defaultPaceMinutes || ''}
          >
            <option value="" disabled hidden>
              分
            </option>
            {[...Array(19)].map((_, index) => {
              const value = String(index + 2).padStart(2, '0');
              return (
                <option key={value} value={value}>
                  {index + 2}
                </option>
              );
            })}
          </select>
          <span className={styles.paceUnit}>分</span>
        </label>

        <label htmlFor="paceSeconds" className={styles.flexAlignCenter}>
          <select
            id="paceSeconds"
            name="paceSeconds"
            className={`${styles.selectField} ${styles.centerSelect}`}
            required
            defaultValue={defaultPaceSeconds || ''}
          >
            <option value="" disabled hidden>
              秒
            </option>
            {[...Array(60).keys()].map((seconds) => {
              const label = String(seconds).padStart(2, '0');
              return (
                <option key={seconds} value={label}>
                  {label}
                </option>
              );
            })}
          </select>
          <span className={styles.paceUnit}>秒</span>
        </label>
      </div>
      <div className={styles.focusBorder} />
      <small className={styles.helperText}>請選擇每公里的配速時間</small>
    </div>
  );
}
