'use client';

import { useCallback, useContext, useMemo, useState } from 'react';
import { isPendingDeletionAccount } from '@/config/account-deletion';
import {
  cancelAccountDeletion,
  signOutUser,
} from '@/runtime/client/use-cases/account-deletion-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import styles from './AccountDeletionGate.module.css';

/**
 * Formats a Firestore Timestamp-like value for pending deletion UI.
 * @param {unknown} value - Date, ISO string, or Firestore Timestamp.
 * @returns {string} Human-readable date string.
 */
function formatScheduledFor(value) {
  if (!value) return '尚未取得排程時間';
  if (typeof value === 'string') return new Date(value).toLocaleString('zh-TW');
  if (value instanceof Date) return value.toLocaleString('zh-TW');
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('zh-TW');
  }
  return '尚未取得排程時間';
}

/**
 * @param {object} props - Component props.
 * @param {import('react').ReactNode} props.children - App content.
 * @returns {import('react').ReactElement} Account deletion gate.
 */
export default function AccountDeletionGate({ children }) {
  const { user, loading } = useContext(AuthContext);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const scheduledForText = useMemo(
    () => formatScheduledFor(user?.deletionScheduledFor),
    [user?.deletionScheduledFor],
  );

  const onCancelDeletion = useCallback(async () => {
    if (!user || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await cancelAccountDeletion(user);
      showToast('刪除排程已取消', 'success');
    } catch (cancelError) {
      console.error(cancelError);
      const message =
        cancelError instanceof Error ? cancelError.message : '取消刪除排程失敗，請稍後再試';
      setError(message);
      showToast('取消刪除排程失敗，請稍後再試', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [showToast, submitting, user]);

  const onSignOut = useCallback(async () => {
    await signOutUser();
  }, []);

  if (loading) {
    return (
      <main className={styles.shell} role="status" aria-live="polite">
        <section className={styles.panel}>
          <p className={styles.copy}>載入帳號狀態...</p>
        </section>
      </main>
    );
  }

  if (!isPendingDeletionAccount(user?.accountStatus)) {
    return <>{children}</>;
  }

  return (
    <main className={styles.shell}>
      <section className={styles.panel} aria-labelledby="pending-deletion-title">
        <p className={styles.eyebrow}>帳號刪除已排程</p>
        <h1 id="pending-deletion-title" className={styles.title}>
          你的帳號正在等待永久刪除
        </h1>
        <p className={styles.copy}>
          目前公開檔案與公開內容已隱藏。等待期內可以取消刪除；期滿後資料會由排程清理，無法復原。
        </p>
        <div className={styles.schedule}>
          <span className={styles.scheduleLabel}>預計永久刪除時間</span>
          <span className={styles.scheduleValue}>{scheduledForText}</span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onCancelDeletion}
            disabled={submitting}
          >
            {submitting ? '取消中...' : '取消刪除'}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onSignOut}
            disabled={submitting}
          >
            登出
          </button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    </main>
  );
}
