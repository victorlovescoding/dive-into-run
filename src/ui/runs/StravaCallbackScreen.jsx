'use client';

import Link from 'next/link';
import styles from '@/app/runs/callback/callback.module.css';

/**
 * strava callback UI screen。
 * @param {object} props - Component props。
 * @param {{ status: 'loading' | 'error', errorMessage?: string, message: string }} props.runtime - callback runtime boundary。
 * @returns {import('react').ReactElement} callback UI。
 */
export default function StravaCallbackScreen({ runtime }) {
  if (runtime.status === 'error') {
    return (
      <div className={styles.container}>
        <p className={styles.errorMessage} role="alert">
          {runtime.errorMessage}
        </p>
        <Link href="/runs" className={styles.link}>
          返回跑步頁面
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.spinner} role="status" aria-label="載入中" />
      <p className={styles.message}>{runtime.message}</p>
    </div>
  );
}
