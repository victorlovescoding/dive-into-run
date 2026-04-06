import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '@/lib/firebase-client';

const COOLDOWN_SECONDS = 3600; // 1 hour

/**
 * @typedef {object} UseStravaSyncReturn
 * @property {() => Promise<void>} sync - 觸發 Strava 同步。
 * @property {boolean} isSyncing - 是否正在同步中。
 * @property {number} cooldownRemaining - 距離冷卻結束的秒數，0 表示可同步。
 * @property {string | null} error - 同步失敗訊息。
 */

/**
 * 計算從 lastSyncAt 到現在的剩餘冷卻秒數。
 * @param {{ toDate: () => Date } | null} lastSyncAt - 上次同步的 Firestore Timestamp-like 物件。
 * @returns {number} 剩餘冷卻秒數，最小為 0。
 */
function calcRemaining(lastSyncAt) {
  if (!lastSyncAt) return 0;
  const elapsed = Math.floor((Date.now() - lastSyncAt.toDate().getTime()) / 1000);
  return Math.max(COOLDOWN_SECONDS - elapsed, 0);
}

/**
 * 管理 Strava 同步呼叫、冷卻倒數及錯誤狀態的 custom hook。
 * @param {{ toDate: () => Date } | null} lastSyncAt - 上次同步的 Firestore Timestamp-like 物件，null 表示從未同步。
 * @returns {UseStravaSyncReturn} 同步狀態與操作。
 */
export default function useStravaSync(lastSyncAt) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(() => calcRemaining(lastSyncAt));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const isSyncingRef = useRef(false);

  // Cooldown countdown interval
  useEffect(() => {
    setCooldownRemaining(calcRemaining(lastSyncAt));

    if (!lastSyncAt) return undefined;

    const interval = setInterval(() => {
      const remaining = calcRemaining(lastSyncAt);
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [lastSyncAt]);

  /**
   * 觸發 Strava 同步 API。
   */
  const sync = useCallback(async () => {
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/strava/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '同步失敗，請稍後再試');
      }
    } catch {
      setError('同步失敗，請稍後再試');
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  return { sync, isSyncing, cooldownRemaining, error };
}
