'use client';

import { useCallback, useContext, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationContext } from '@/contexts/NotificationContext';
import { getNotificationLink } from '@/lib/notification-helpers';
import NotificationItem from './NotificationItem';
import styles from './NotificationPanel.module.css';

/**
 * 通知下拉面板，含通知列表。
 * @returns {import('react').JSX.Element | null} 面板元件（面板關閉時回傳 null）。
 */
export default function NotificationPanel() {
  // Context
  const {
    notifications,
    isPanelOpen,
    closePanel,
    markAsRead,
    activeTab,
    setActiveTab,
    hasMore,
    isLoadingMore,
    hasLoadedMore,
    loadMore,
  } = useContext(NotificationContext);

  // Router
  const router = useRouter();

  // Refs
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const sentinelRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  // Effects — outside click close
  useEffect(() => {
    if (!isPanelOpen) return undefined;

    /** @param {MouseEvent} e - mousedown 事件。 */
    const handleMouseDown = (e) => {
      const { target } = e;
      const node = /** @type {Node} */ (target);

      if (panelRef.current && !panelRef.current.contains(node)) {
        // 不關閉：點擊鈴鐺按鈕本身（它有自己的 toggle 邏輯）
        const bellButton = document.querySelector('[aria-controls="notification-panel"]');
        if (bellButton && bellButton.contains(node)) return;

        closePanel();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isPanelOpen, closePanel]);

  // Effects — IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!hasLoadedMore || !hasMore || isLoadingMore || !sentinelRef.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '100px' },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasLoadedMore, hasMore, isLoadingMore, loadMore]);

  // Handlers
  /**
   * 處理通知項目點擊：標記已讀、導航、關閉面板。
   * @param {import('@/lib/notification-helpers').NotificationItem} notification - 通知資料。
   */
  const handleItemClick = useCallback(
    (notification) => {
      markAsRead(notification.id);
      router.push(getNotificationLink(notification));
      closePanel();
    },
    [markAsRead, router, closePanel],
  );

  if (!isPanelOpen) return null;

  const isEmpty = notifications.length === 0;
  const emptyMessage = activeTab === 'unread' ? '沒有未讀通知' : '目前沒有通知';
  const showLoadMoreButton = hasMore && !hasLoadedMore && notifications.length >= 5;
  const showSentinel = hasLoadedMore && hasMore;

  return (
    <div
      id="notification-panel"
      ref={panelRef}
      role="region"
      aria-label="通知面板"
      className={styles.panel}
    >
      <div className={styles.header}>通知</div>
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          className={activeTab === 'all' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setActiveTab('all')}
        >
          全部
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'unread'}
          className={activeTab === 'unread' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setActiveTab('unread')}
        >
          未讀
        </button>
      </div>
      {isEmpty ? (
        <p className={styles.emptyState}>{emptyMessage}</p>
      ) : (
        <ul className={styles.list}>
          {notifications.map((n) => (
            <li key={n.id}>
              <NotificationItem notification={n} onClick={() => handleItemClick(n)} />
            </li>
          ))}
        </ul>
      )}
      {showLoadMoreButton && (
        <button
          type="button"
          className={styles.loadMoreButton}
          onClick={loadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? '載入中...' : '查看先前通知'}
        </button>
      )}
      {showSentinel && <div ref={sentinelRef} className={styles.sentinel} />}
    </div>
  );
}
