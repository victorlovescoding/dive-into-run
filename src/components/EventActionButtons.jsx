/**
 * @file EventActionButtons Component
 * @description
 * Isolated component for handling Join/Leave event actions.
 * Extracted from the main events page to reduce complexity and improve testability.
 */

import React from 'react';
import { getRemainingSeats } from '@/lib/event-helpers';
import styles from './EventActionButtons.module.css';

/**
 * @typedef {import('@/lib/event-helpers').EventData} EventData
 */

/**
 * @typedef {object} User
 * @property {string} uid - The unique identifier for the user.
 */

/**
 * @typedef {object} EventActionButtonsProps
 * @property {EventData} event - The event data object.
 * @property {User|null} user - The current authenticated user or null if not logged in.
 * @property {(ev: EventData, e: React.MouseEvent) => Promise<void>|void} onJoin
 * - Callback for joining the event.
 * @property {(ev: EventData, e: React.MouseEvent) => Promise<void>|void} onLeave
 * - Callback for leaving the event.
 * @property {string|boolean} isPending
 * - Loading state for the current event ('joining', 'leaving', or false).
 * @property {boolean} isCreating - Global state indicating if an event is being created.
 * @property {boolean} isFormOpen - Global state indicating if the creation form is open.
 * @property {Set<string>} myJoinedEventIds - Set of event IDs the user has already joined.
 */

/**
 * EventActionButtons Component
 * @param {EventActionButtonsProps} props - The component props.
 * @returns {React.ReactElement|null} The rendered action buttons or null.
 */
export default function EventActionButtons({
  event,
  user,
  onJoin,
  onLeave,
  isPending,
  isCreating,
  isFormOpen,
  myJoinedEventIds,
}) {
  if (!user?.uid) {
    return <div className={styles.helperText}>加入活動前請先登入</div>;
  }

  if (event.hostUid === user.uid) {
    return null;
  }

  const eventId = String(event.id);
  const joined = myJoinedEventIds.has(eventId);
  const remaining = getRemainingSeats(event);
  const isDisabled = Boolean(isPending) || isCreating || isFormOpen;

  if (joined) {
    return (
      <button
        type="button"
        className={`${styles.submitButton} ${styles.leaveButton}`}
        onClick={(e) => onLeave(event, e)}
        disabled={isDisabled}
      >
        {isPending === 'leaving' ? (
          <span className={styles.spinnerLabel}>
            <div className={`${styles.spinner} ${styles.buttonSpinner}`} />
            取消中…
          </span>
        ) : (
          '退出活動'
        )}
      </button>
    );
  }

  if (remaining <= 0) {
    return (
      <button
        type="button"
        className={`${styles.submitButton} ${styles.soldOutButton}`}
        disabled
        aria-disabled="true"
      >
        已額滿
      </button>
    );
  }

  return (
    <button
      type="button"
      className={styles.submitButton}
      onClick={(e) => onJoin(event, e)}
      disabled={isDisabled}
    >
      {isPending === 'joining' ? (
        <span className={styles.spinnerLabel}>
          <div className={`${styles.spinner} ${styles.buttonSpinner}`} />
          報名中…
        </span>
      ) : (
        '參加活動'
      )}
    </button>
  );
}
