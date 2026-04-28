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
  const { unreadCount, isPanelOpen, togglePanel, bellButtonRef } = useContext(NotificationContext);

  if (!user) return null;

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);
  const ariaLabel = unreadCount > 0 ? `通知，${displayCount} 則未讀` : '通知';

  return (
    <button
      ref={bellButtonRef}
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
        role="img"
        aria-label="通知鈴鐺圖示"
        data-filled={String(isPanelOpen)}
      >
        <path
          d={
            isPanelOpen
              ? 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'
              : 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z'
          }
          fill="currentColor"
        />
      </svg>
      {unreadCount > 0 && <span className={styles.badge}>{displayCount}</span>}
    </button>
  );
}
