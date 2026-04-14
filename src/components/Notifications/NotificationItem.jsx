'use client';

import { useState } from 'react';
import Image from 'next/image';
import { formatRelativeTime } from '@/lib/notification-helpers';
import styles from './NotificationItem.module.css';

/**
 * 單則通知列（頭像 + 訊息 + 時間 + 未讀圓點）。
 * @param {object} props - 元件 props。
 * @param {import('@/lib/notification-helpers').NotificationItem} props.notification - 通知資料。
 * @param {() => void} props.onClick - 點擊回呼。
 * @returns {import('react').JSX.Element} 通知列元件。
 */
export default function NotificationItem({ notification, onClick }) {
  const [avatarError, setAvatarError] = useState(false);

  const { actorName, actorPhotoURL, message, read, createdAt } = notification;
  const initial = actorName ? actorName.charAt(0).toUpperCase() : '?';
  const timeText = formatRelativeTime(createdAt);
  const showAvatar = actorPhotoURL && !avatarError;

  /** 圖片載入失敗時切換為預設頭像。 */
  const handleAvatarError = () => {
    setAvatarError(true);
  };

  return (
    <button type="button" className={styles.item} onClick={onClick}>
      {showAvatar ? (
        <Image
          src={actorPhotoURL}
          alt={`${actorName} 的頭像`}
          width={40}
          height={40}
          className={styles.avatar}
          onError={handleAvatarError}
        />
      ) : (
        <span className={styles.defaultAvatar} aria-hidden="true">
          {initial}
        </span>
      )}
      <span className={styles.content}>
        <span className={styles.message}>{message}</span>
        <span className={styles.time}>{timeText}</span>
      </span>
      {!read && <span className={styles.unreadDot} />}
    </button>
  );
}
