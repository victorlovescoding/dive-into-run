'use client';

import { buildEventScanSummary } from './event-list-scanning';
import styles from './EventsPageScreen.module.css';

const STATUS_TONE_CLASS = {
  started: styles.eventStatusStarted,
  closed: styles.eventStatusClosed,
  full: styles.eventStatusFull,
  open: styles.eventStatusOpen,
};

/**
 * 活動卡片的掃描摘要，讓列表可快速判斷狀態、類型與名額。
 * @param {object} props - Component props。
 * @param {object} props.event - 活動資料。
 * @param {(event: object) => number} props.getRemainingSeats - 剩餘名額計算器。
 * @returns {import('react').ReactElement} 卡片掃描摘要。
 */
export default function EventCardScanSummary({ event, getRemainingSeats }) {
  const summary = buildEventScanSummary(event, getRemainingSeats);
  const { capacity, runType, status } = summary;
  const eventTitle = String(/** @type {{ title?: unknown }} */ (event).title || '活動');

  return (
    <div className={styles.eventScanSummary}>
      <div className={styles.eventChipRow} aria-label={`${eventTitle} 掃描標籤`}>
        <span className={`${styles.eventStatusChip} ${STATUS_TONE_CLASS[status.tone]}`}>
          {status.label}
        </span>
        {runType && <span className={styles.eventRunTypeChip}>{runType}</span>}
      </div>

      {capacity && (
        <div className={styles.eventCapacityBlock}>
          <div className={styles.eventCapacityText}>
            <span>名額</span>
            <strong>
              剩 {capacity.remainingSeats} / {capacity.maxParticipants} 名
            </strong>
          </div>
          <div
            className={styles.eventCapacityTrack}
            role="progressbar"
            aria-label={`${eventTitle}名額使用狀態`}
            aria-valuemin={0}
            aria-valuemax={capacity.maxParticipants}
            aria-valuenow={capacity.joinedCount}
            aria-valuetext={`已報名 ${capacity.joinedCount} 名，剩 ${capacity.remainingSeats} 名`}
          >
            <div
              className={styles.eventCapacityFill}
              style={{ width: `${capacity.usagePercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
