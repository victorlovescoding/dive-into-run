'use client';

import UserLink from '@/components/UserLink';
import styles from './PublicProfile.module.css';

/**
 * Public follow-list modal for profile follower/following rows.
 * @param {object} props - Component props.
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {string} props.title - Modal title.
 * @param {Array<{ uid: string, name: string, photoURL: string }>} props.rows - Public rows.
 * @param {boolean} props.isLoading - Whether rows are loading.
 * @param {string | null} props.error - Load error.
 * @param {() => void} props.onClose - Close handler.
 * @returns {import('react').ReactElement | null} Follow list dialog.
 */
export default function FollowListModal({ isOpen, title, rows, isLoading, error, onClose }) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button type="button" className={styles.modalCloseButton} onClick={onClose}>
            關閉
          </button>
        </div>
        {isLoading && <p className={styles.modalStatus}>載入中...</p>}
        {error && !isLoading && <p className={styles.modalError}>{error}</p>}
        {!isLoading && !error && rows.length === 0 && (
          <p className={styles.modalStatus}>目前沒有名單</p>
        )}
        {!isLoading && !error && rows.length > 0 && (
          <ul className={styles.followList}>
            {rows.map((row) => (
              <li key={row.uid} className={styles.followListItem} aria-label={row.name}>
                <UserLink uid={row.uid} name={row.name} photoURL={row.photoURL} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
