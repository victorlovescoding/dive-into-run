'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import useStravaActivities from '@/runtime/hooks/useStravaActivities';
import useStravaConnection from '@/runtime/hooks/useStravaConnection';
import useStravaSync from '@/runtime/hooks/useStravaSync';

const DISCONNECT_CONFIRM_MESSAGE = '確定要取消連結 Strava 嗎？這會刪除所有跑步紀錄。';
const DISCONNECT_ERROR_MESSAGE = '取消連結失敗，請稍後再試';

/**
 * runs page runtime orchestration。
 * @returns {object} runs page state 與 handlers。
 */
export default function useRunsPageRuntime() {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { showToast } = useToast();
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
  } = useStravaSync(connection?.lastSyncAt ?? null);
  const lastSyncRef = useRef(connection?.lastSyncAt ?? null);

  useEffect(() => {
    if (lastSyncRef.current === connection?.lastSyncAt) return;
    lastSyncRef.current = connection?.lastSyncAt ?? null;
    refresh();
  }, [connection?.lastSyncAt, refresh]);

  const handleSync = useCallback(async () => {
    const didSync = await sync();
    if (didSync) {
      refresh();
    }
  }, [refresh, sync]);

  const handleDisconnect = useCallback(async () => {
    // eslint-disable-next-line no-alert -- T020 spec allows window.confirm for disconnect confirmation
    if (!window.confirm(DISCONNECT_CONFIRM_MESSAGE) || !user) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/strava/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        showToast(DISCONNECT_ERROR_MESSAGE, 'error');
      }
    } catch {
      showToast(DISCONNECT_ERROR_MESSAGE, 'error');
    } finally {
      setIsDisconnecting(false);
    }
  }, [showToast, user]);

  return {
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
    openCalendar: () => setCalendarOpen(true),
    closeCalendar: () => setCalendarOpen(false),
    syncButtonLabel: isSyncing ? '同步中…' : cooldownRemaining > 0 ? '冷卻中' : '同步',
    handleSync,
    cooldownRemaining,
    isSyncing,
    isDisconnecting,
    handleDisconnect,
    syncError,
  };
}
