'use client';

import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import styles from './NotificationBell.module.css';

/**
 * 通知鈴鐺按鈕，顯示未讀數量 badge 並切換通知面板。
 * @returns {import('react').JSX.Element | null} NotificationBell 元件，未登入時回傳 null。
 */
export default function NotificationBell() {
  const { user } = useContext(AuthContext);
  const { unreadCount, isPanelOpen, togglePanel } = useContext(NotificationContext);

  if (!user) return null;

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);
  const ariaLabel = unreadCount > 0 ? `通知，${unreadCount} 則未讀` : '通知';

  return (
    <button
      type="button"
      className={styles.bellButton}
      aria-label={ariaLabel}
      aria-expanded={isPanelOpen}
      aria-controls="notification-panel"
      onClick={togglePanel}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        aria-hidden="true"
        data-filled={String(isPanelOpen)}
      >
        {isPanelOpen ? (
          <path
            d="M12 2C7.58 2 4 5.58 4 10v4.17l-1.71 1.71A1 1 0 003 17h18a1 1 0 00.71-1.71L20 14.17V10c0-4.42-3.58-8-8-8zm0 20a2 2 0 002-2h-4a2 2 0 002 2z"
            fill="currentColor"
          />
        ) : (
          <path
            d="M12 2C7.58 2 4 5.58 4 10v4.17l-1.71 1.71A1 1 0 003 17h18a1 1 0 00.71-1.71L20 14.17V10c0-4.42-3.58-8-8-8zm0 20a2 2 0 002-2h-4a2 2 0 002 2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        )}
      </svg>
      {unreadCount > 0 && <span className={styles.badge}>{displayCount}</span>}
    </button>
  );
}
