'use client';

import RunsActivityList from '@/components/RunsActivityList';
import RunsConnectGuide from '@/components/RunsConnectGuide';
import RunCalendarDialog from '@/components/RunCalendarDialog';
import RunsLoginGuide from '@/components/RunsLoginGuide';
import CalendarIcon from '@/components/icons/CalendarIcon';
import styles from '@/app/runs/runs.module.css';

/**
 * runs page UI screen。
 * @param {object} props - Component props。
 * @param {object} props.runtime - page runtime boundary。
 * @returns {import('react').ReactElement} runs page UI。
 */
export default function RunsPageScreen({ runtime }) {
  const {
    authLoading,
    user,
    connection,
    activities,
    activitiesLoading,
    activitiesError,
    loadMore,
    hasMore,
    isLoadingMore,
    calendarOpen,
    openCalendar,
    closeCalendar,
    syncButtonLabel,
    handleSync,
    cooldownRemaining,
    isSyncing,
    isDisconnecting,
    handleDisconnect,
    syncError,
  } = runtime;

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
            onClick={openCalendar}
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
            {syncButtonLabel}
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
      <RunsActivityList
        activities={activities}
        isLoading={activitiesLoading}
        error={activitiesError}
        loadMore={loadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
      />
      {calendarOpen && <RunCalendarDialog open={calendarOpen} onClose={closeCalendar} />}
    </div>
  );
}
