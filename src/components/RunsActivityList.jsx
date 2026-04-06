import { useRef, useEffect } from 'react';
import RunsActivityCard from '@/components/RunsActivityCard';
import styles from './RunsActivityList.module.css';

/**
 * @typedef {object} RunsActivityListProps
 * @property {import('@/components/RunsActivityCard').StravaActivityShape[]} activities - 活動列表。
 * @property {boolean} isLoading - 是否載入中。
 * @property {string | null} error - 錯誤訊息，null 表示無錯誤。
 * @property {() => void} [loadMore] - 載入更多活動的回呼函式。
 * @property {boolean} [hasMore] - 是否還有更多活動可載入。
 * @property {boolean} [isLoadingMore] - 是否正在載入更多活動。
 */

const noop = () => {};

/**
 * RunsActivityList — 跑步活動列表元件。
 * 依據 isLoading / error / activities 狀態依序顯示 loading skeleton、錯誤訊息、空狀態或活動卡片。
 * 支援 infinite scroll：當 sentinel 進入視窗時自動呼叫 loadMore。
 * @param {RunsActivityListProps} props - Component props.
 * @returns {import('react').ReactElement} 活動列表元件。
 */
export default function RunsActivityList({
  activities,
  isLoading,
  error,
  loadMore = noop,
  hasMore = true,
  isLoadingMore = false,
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '0px 0px 300px 0px', threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (isLoading) {
    return (
      <div className={styles.loading} role="status">
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
        <p className={styles.loadingText}>載入中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error} role="alert">
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>目前沒有跑步紀錄，去跑一趟吧！</p>
      </div>
    );
  }

  const showEndMessage = !hasMore && activities.length > 0;

  return (
    <>
      <ul className={styles.list}>
        {activities.map((activity) => (
          <li key={activity.stravaId} className={styles.item}>
            <RunsActivityCard activity={activity} />
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinelRef} data-testid="sentinel" />}
      {isLoadingMore && (
        <p className={styles.loadingMoreText} role="status">
          載入中...
        </p>
      )}
      {showEndMessage && <p className={styles.endMessage}>已載入全部紀錄</p>}
    </>
  );
}
