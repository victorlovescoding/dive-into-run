import { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { listenStravaConnection } from '@/lib/firebase-strava';

/**
 * @typedef {object} UseStravaConnectionReturn
 * @property {import('@/lib/firebase-strava').StravaConnection|null} connection - Strava 連結狀態，未登入或無資料時為 null。
 * @property {boolean} isLoading - 是否正在載入連結狀態。
 * @property {string|null} error - 錯誤訊息，無錯誤時為 null。
 */

/**
 * 監聽當前使用者的 Strava 連結狀態。
 * 內部使用 AuthContext 取得 uid，透過 listenStravaConnection 即時監聽，
 * unmount 時自動清理 listener。使用者未登入時直接回傳 null。
 * @returns {UseStravaConnectionReturn} 連結狀態、載入中旗標與錯誤訊息。
 */
export default function useStravaConnection() {
  const { user } = useContext(AuthContext);
  const uid = user?.uid ?? null;
  const prevUidRef = useRef(uid);

  const [connection, setConnection] = useState(
    /** @type {import('@/lib/firebase-strava').StravaConnection|null} */ (null),
  );
  const [isLoading, setIsLoading] = useState(/** @type {boolean} */ (!!uid));
  const [error, setError] = useState(/** @type {string|null} */ (null));

  // Reset state synchronously during render when uid changes (avoids setState in useEffect)
  if (prevUidRef.current !== uid) {
    prevUidRef.current = uid;
    setConnection(null);
    setIsLoading(!!uid);
    setError(null);
  }

  useEffect(() => {
    if (!uid) {
      return undefined;
    }

    /** @type {(() => void)|undefined} */
    let unsubscribe;

    try {
      unsubscribe = listenStravaConnection(uid, (data) => {
        setConnection(data);
        setIsLoading(false);
      });
    } catch {
      // Defer setState to avoid synchronous setState in effect body (react-hooks/set-state-in-effect)
      queueMicrotask(() => {
        setError('Strava 連線狀態載入失敗');
        setIsLoading(false);
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [uid]);

  return useMemo(() => ({ connection, isLoading, error }), [connection, isLoading, error]);
}
