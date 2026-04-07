'use client';

import { useEffect, useRef, useState } from 'react';
import useRunCalendar from '@/hooks/useRunCalendar';
import { buildCalendarGrid, RUN_TYPE_LABELS, formatDistance } from '@/lib/strava-helpers';
import RunOutdoorIcon from '@/components/icons/RunOutdoorIcon';
import RunIndoorIcon from '@/components/icons/RunIndoorIcon';
import RunTrailIcon from '@/components/icons/RunTrailIcon';
import styles from './RunCalendarDialog.module.css';

/** @type {Record<string, typeof RunOutdoorIcon>} 活動類型對應的圖示元件。 */
const RUN_ICON_MAP = {
  Run: RunOutdoorIcon,
  VirtualRun: RunIndoorIcon,
  TrailRun: RunTrailIcon,
};

/**
 * 根據活動類型回傳對應的圖示元件。
 * @param {string} type - 活動類型。
 * @returns {typeof RunOutdoorIcon} 圖示元件。
 */
function getRunIcon(type) {
  return RUN_ICON_MAP[type] || RunOutdoorIcon;
}

/** @type {string[]} 星期標題。 */
const WEEKDAY_HEADERS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 跑步月曆 dialog 元件。
 * @param {object} props
 * @param {boolean} props.open - 是否開啟 dialog。
 * @param {() => void} props.onClose - 關閉 dialog 的回呼。
 * @returns {import('react').ReactElement} 月曆 dialog。
 */
export default function RunCalendarDialog({ open, onClose }) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());

  const { dayMap, monthSummary, isLoading, error } = useRunCalendar(currentYear, currentMonth);
  const grid = buildCalendarGrid(currentYear, currentMonth);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  /** @param {import('react').SyntheticEvent<HTMLDialogElement>} e - dialog cancel 事件。 */
  function handleCancel(e) {
    e.preventDefault();
    onClose();
  }

  /** 切換到上一個月。 */
  function handlePrevMonth() {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  /** 切換到下一個月。 */
  function handleNextMonth() {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-label="跑步月曆" onCancel={handleCancel}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.navButton}
          aria-label="上一個月"
          onClick={handlePrevMonth}
        >
          &#8249;
        </button>
        <span className={styles.title}>
          {currentYear}年{currentMonth + 1}月
        </span>
        <button
          type="button"
          className={styles.navButton}
          aria-label="下一個月"
          onClick={handleNextMonth}
        >
          &#8250;
        </button>
        <button
          type="button"
          className={styles.closeButton}
          aria-label="關閉月曆"
          onClick={onClose}
        >
          &#10005;
        </button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      {isLoading && <div className={styles.loading}>載入中...</div>}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <div className={styles.grid}>
        {grid.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className={styles.dayCell} />;
          }

          const dayActivities = dayMap.get(day);
          const cellClass = dayActivities
            ? `${styles.dayCell} ${styles.dayActive}`
            : styles.dayCell;

          return (
            <div key={day} className={cellClass}>
              <span className={styles.dayNumber}>{day}</span>
              {dayActivities &&
                dayActivities.runs.map((run) => {
                  const Icon = getRunIcon(run.type);
                  return (
                    <div key={run.type} className={styles.runEntry}>
                      <Icon size={12} />
                      <span className={styles.runDistance}>
                        {(run.totalMeters / 1000).toFixed(1)}
                      </span>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>

      {!isLoading && !error && (
        <div className={styles.footer}>
          <div className={styles.totalDistance}>
            總里程：{formatDistance(monthSummary.totalMeters)}
          </div>
          {monthSummary.byType.map((typeSummary) => (
            <span key={typeSummary.type} className={styles.typeSummary}>
              {typeSummary.label} {formatDistance(typeSummary.totalMeters)}
            </span>
          ))}
        </div>
      )}
    </dialog>
  );
}
