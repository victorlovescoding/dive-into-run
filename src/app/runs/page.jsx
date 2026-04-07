'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import useStravaConnection from '@/hooks/useStravaConnection';
import useStravaActivities from '@/hooks/useStravaActivities';
import useStravaSync from '@/hooks/useStravaSync';
import RunsLoginGuide from '@/components/RunsLoginGuide';
import RunsConnectGuide from '@/components/RunsConnectGuide';
import RunsActivityList from '@/components/RunsActivityList';
import CalendarIcon from '@/components/icons/CalendarIcon';
import RunCalendarDialog from '@/components/RunCalendarDialog';
import styles from './runs.module.css';

/**
 * Strava 跑步紀錄主頁面 — orchestrator。
 * 依據驗證與連結狀態決定顯示登入引導、連結引導或活動列表。
 * @returns {import('react').ReactElement} 頁面元件。
 */
export default function RunsPage() {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [disconnectError, setDisconnectError] = useState(/** @type {string | null} */ (null));
  const { user, loading: authLoading } = useContext(AuthContext);
  const { connection } = useStravaConnection();
  const {
    activities,
    isLoading: activitiesLoading,
    error: activitiesError,
    loadMore,
    hasMore,
    isLoadingMore,
    refresh,
  } = useStravaActivities();
  const {
    sync,
    isSyncing,
    cooldownRemaining,
    error: syncError,
  } = useStravaSync(connection?.lastSyncAt);

  // Auto-refresh when webhook updates lastSyncAt (skip initial render)
  const lastSyncRef = useRef(connection?.lastSyncAt);
  useEffect(() => {
    if (lastSyncRef.current === connection?.lastSyncAt) return;
    lastSyncRef.current = connection?.lastSyncAt;
    refresh();
  }, [connection?.lastSyncAt, refresh]);

  /** @returns {string} 同步按鈕文字 */
  const syncButtonLabel = () => {
    if (isSyncing) return '同步中…';
    if (cooldownRemaining > 0) return '冷卻中';
    return '同步';
  };

  const handleSync = useCallback(async () => {
    const ok = await sync();
    if (ok) {
      refresh();
    }
  }, [sync, refresh]);

  const handleDisconnect = async () => {
    // eslint-disable-next-line no-alert -- T020 spec allows window.confirm for disconnect confirmation
    if (!window.confirm('確定要取消連結 Strava 嗎？這會刪除所有跑步紀錄。')) {
      return;
    }
    setIsDisconnecting(true);
    setDisconnectError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/strava/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setDisconnectError('取消連結失敗，請稍後再試');
      }
    } catch {
      setDisconnectError('取消連結失敗，請稍後再試');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} role="status" aria-label="載入中">
          載入中…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <RunsLoginGuide />
      </div>
    );
  }

  if (!connection?.connected) {
    return (
      <div className={styles.container}>
        <RunsConnectGuide />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.athleteName}>{connection.athleteName}</span>
        <div>
          <button
            type="button"
            className={styles.calendarButton}
            onClick={() => setCalendarOpen(true)}
            aria-label="跑步月曆"
          >
            <CalendarIcon size={18} />
          </button>
          <button
            type="button"
            className={styles.syncButton}
            disabled={cooldownRemaining > 0 || isSyncing}
            onClick={handleSync}
          >
            {syncButtonLabel()}
          </button>
          {cooldownRemaining > 0 && (
            <span className={styles.cooldownText}>{cooldownRemaining} 秒後可再同步</span>
          )}
          <button
            type="button"
            className={styles.disconnectButton}
            disabled={isDisconnecting}
            onClick={handleDisconnect}
          >
            {isDisconnecting ? '取消連結中…' : '取消連結'}
          </button>
        </div>
      </div>
      {syncError && (
        <p className={styles.syncError} role="alert">
          {syncError}
        </p>
      )}
      {disconnectError && (
        <p className={styles.syncError} role="alert">
          {disconnectError}
        </p>
      )}
      <RunsActivityList
        activities={activities}
        isLoading={activitiesLoading}
        error={activitiesError}
        loadMore={loadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
      />
      <RunCalendarDialog open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </div>
  );
}
