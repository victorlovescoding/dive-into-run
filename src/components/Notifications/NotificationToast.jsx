'use client';

import { useContext } from 'react';
import { NotificationContext } from '@/contexts/NotificationContext';
import styles from './NotificationToast.module.css';

/**
 * 新通知 toast 提示。一次顯示一則，5 秒後自動消失。
 * @returns {import('react').JSX.Element | null} Toast 元件（無待顯示時回傳 null）。
 */
export default function NotificationToast() {
  const { currentToast } = useContext(NotificationContext);

  if (!currentToast) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {currentToast.message}
    </div>
  );
}
