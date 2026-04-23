import { useState, useContext, useEffect, useCallback } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { getStravaActivities } from '@/repo/client/firebase-strava-repo';

const PAGE_SIZE = 10;

/**
 * @typedef {object} UseStravaActivitiesReturn
 * @property {import('@/repo/client/firebase-strava-repo').StravaActivity[]} activities - Strava 活動列表。
 * @property {boolean} isLoading - 是否載入中。
 * @property {string | null} error - 錯誤訊息。
 * @property {() => void} loadMore - 載入更多活動。
 * @property {boolean} hasMore - 是否還有更多活動。
 * @property {boolean} isLoadingMore - 是否正在載入更多。
 * @property {() => void} refresh - 重新載入活動列表（從頭開始）。
 */

/**
 * 取得當前登入使用者的 Strava 活動列表，支援 cursor-based pagination。
 * @returns {UseStravaActivitiesReturn} 活動狀態。
 */
export default function useStravaActivities() {
  const [activities, setActivities] = useState(
    /** @type {import('@/repo/client/firebase-strava-repo').StravaActivity[]} */ ([]),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [cursor, setCursor] = useState(
    /** @type {import('firebase/firestore').QueryDocumentSnapshot | null} */ (null),
  );
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (!user) {
      setActivities([]);
      setIsLoading(false);
      setError(null);
      setCursor(null);
      setHasMore(true);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getStravaActivities(user.uid, PAGE_SIZE)
      .then((result) => {
        if (!cancelled) {
          setActivities(result.activities);
          setCursor(result.lastDoc);
          setHasMore(result.activities.length === PAGE_SIZE);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('活動載入失敗');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, refreshCounter]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !cursor || !user) return;
    setIsLoadingMore(true);
    try {
      const result = await getStravaActivities(user.uid, PAGE_SIZE, cursor);
      setActivities((prev) => [...prev, ...result.activities]);
      setCursor(result.lastDoc);
      setHasMore(result.activities.length === PAGE_SIZE);
    } catch {
      // loadMore error — silently handled
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore, user]);

  const refresh = useCallback(() => {
    setRefreshCounter((c) => c + 1);
  }, []);

  return { activities, isLoading, error, loadMore, hasMore, isLoadingMore, refresh };
}
