'use client';

import Link from 'next/link';
import styles from './ProfileScreen.module.css';

/**
 * profile page UI screen。
 * @param {object} props - Component props。
 * @param {object} props.runtime - profile runtime boundary。
 * @param {import('react').ReactNode} props.header - profile header slot。
 * @param {import('react').ReactNode} props.statsSection - profile stats slot。
 * @param {import('react').ReactNode} props.eventList - profile event list slot。
 * @returns {import('react').ReactElement} profile UI。
 */
export default function ProfileScreen({ runtime, header, statsSection, eventList }) {
  return (
    <main className={styles.container}>
      {runtime.isSelf && (
        <aside className={styles.selfBanner} aria-label="這是你的公開檔案">
          <span className={styles.selfBannerText}>這是你的公開檔案</span>
          <Link className={styles.selfBannerLink} href="/member">
            編輯個人資料
          </Link>
        </aside>
      )}
      {header}
      {runtime.isStatsLoading && <p className={styles.loadingText}>載入中...</p>}
      {runtime.statsError && !runtime.isStatsLoading && (
        <p className={styles.errorText}>{runtime.statsError}</p>
      )}
      {statsSection}
      {eventList}
    </main>
  );
}
