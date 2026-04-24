'use client';

import { Fragment } from 'react';
import DashboardCommentCard from '@/components/DashboardCommentCard';
import DashboardEventCard from '@/components/DashboardEventCard';
import DashboardPostCard from '@/components/DashboardPostCard';
import styles from '@/components/DashboardTabs.module.css';

/**
 * 依 tab 類型渲染卡片列表。
 * @param {object} props - 元件 props。
 * @param {object[]} props.items - 清單資料。
 * @param {number} props.tabIndex - 目前 tab index。
 * @param {Set<string> | undefined} props.hostedIds - events tab 主辦清單。
 * @returns {import('react').ReactElement} 卡片列表。
 */
function ItemList({ items, tabIndex, hostedIds }) {
  if (tabIndex === 0) {
    const events = /** @type {import('@/service/member-dashboard-service').MyEventItem[]} */ (
      items
    );
    return (
      <>
        {events.map((event) => (
          <Fragment key={event.id}>
            <DashboardEventCard event={event} isHost={hostedIds?.has(event.id) ?? false} />
          </Fragment>
        ))}
      </>
    );
  }

  if (tabIndex === 1) {
    const posts = /** @type {import('@/service/post-service').Post[]} */ (items);
    return (
      <>
        {posts.map((post) => (
          <Fragment key={post.id}>
            <DashboardPostCard post={post} />
          </Fragment>
        ))}
      </>
    );
  }

  const comments = /** @type {import('@/service/member-dashboard-service').MyCommentItem[]} */ (
    items
  );
  return (
    <>
      {comments.map((comment) => (
        <Fragment key={comment.id}>
          <DashboardCommentCard comment={comment} />
        </Fragment>
      ))}
    </>
  );
}

/**
 * 單一 tab panel 的 render-only UI。
 * @param {object} props - 元件 props。
 * @param {import('@/runtime/hooks/useDashboardTab').UseDashboardTabReturn} props.tab - 單一 tab runtime state。
 * @param {number} props.tabIndex - tab index。
 * @param {string} props.emptyText - empty state 文案。
 * @param {Set<string> | undefined} props.hostedIds - events tab 主辦清單。
 * @returns {import('react').ReactElement} panel 內容。
 */
function TabPanel({ tab, tabIndex, emptyText, hostedIds }) {
  const {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    retry,
    loadMoreError,
    retryLoadMore,
    sentinelRef,
  } = tab;

  if (isLoading) {
    return <p className={styles.loading}>載入中…</p>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>{error}</p>
        <button type="button" onClick={retry}>
          重試
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className={styles.empty}>{emptyText}</p>;
  }

  return (
    <div className={styles.cardList}>
      <ItemList items={items} tabIndex={tabIndex} hostedIds={hostedIds} />
      <div ref={sentinelRef} />
      {isLoadingMore && <p className={styles.loadingMore}>載入更多...</p>}
      {loadMoreError && (
        <div className={styles.error}>
          <p>{loadMoreError}</p>
          <button type="button" onClick={retryLoadMore}>
            重試
          </button>
        </div>
      )}
      {!hasMore && items.length > 0 && <p className={styles.endHint}>已顯示全部</p>}
    </div>
  );
}

/**
 * Dashboard tabs UI screen。
 * @param {object} props - 元件 props。
 * @param {object} props.runtime - Dashboard page-level runtime。
 * @returns {import('react').ReactElement} Dashboard tabs UI。
 */
export default function DashboardTabsScreen({ runtime }) {
  const { activeTab, tabs, selectTab, handleTabKeyDown } = runtime;

  return (
    <div className={styles.container}>
      <div className={styles.tabBar} role="tablist">
        {tabs.map((tabConfig, index) => (
          <button
            key={tabConfig.id}
            role="tab"
            id={tabConfig.id}
            aria-selected={activeTab === index}
            aria-controls={tabConfig.panelId}
            className={activeTab === index ? styles.tabActive : styles.tab}
            onClick={() => selectTab(index)}
            onKeyDown={handleTabKeyDown}
            tabIndex={activeTab === index ? 0 : -1}
            type="button"
          >
            {tabConfig.label}
          </button>
        ))}
      </div>

      {tabs.map((tabConfig, index) => (
        <div
          key={tabConfig.panelId}
          role="tabpanel"
          id={tabConfig.panelId}
          aria-labelledby={tabConfig.id}
          style={activeTab !== index ? { display: 'none' } : undefined}
        >
          <TabPanel
            tab={tabConfig.tab}
            tabIndex={index}
            emptyText={tabConfig.emptyText}
            hostedIds={tabConfig.hostedIds}
          />
        </div>
      ))}
    </div>
  );
}
