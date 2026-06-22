'use client';

import { useContext } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationContext } from '@/contexts/NotificationContext';
import { getNotificationLink } from '@/lib/notification-helpers';
import styles from './NotificationToast.module.css';

/**
 * 新通知 toast 提示。一次顯示一則，5 秒後自動消失。
 * @returns {import('react').JSX.Element | null} Toast 元件（無待顯示時回傳 null）。
 */
export default function NotificationToast() {
  const { currentToast, dismissNotificationToast, markAsRead } = useContext(NotificationContext);
  const router = useRouter();

  if (!currentToast) return null;

  const handleClick = () => {
    dismissNotificationToast(currentToast.id);
    markAsRead(currentToast.id).catch((err) => {
      console.error('mark notification toast as read failed:', err);
    });
    router.push(getNotificationLink(currentToast));
  };

  return (
    <button type="button" className={styles.toast} aria-live="polite" onClick={handleClick}>
      <span className={styles.message}>{currentToast.message}</span>
      <span className={styles.cta}>查看</span>
    </button>
  );
}
