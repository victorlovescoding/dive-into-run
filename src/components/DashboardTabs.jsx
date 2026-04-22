'use client';

import { useState, useCallback, Fragment } from 'react';
import useDashboardTab from '@/runtime/hooks/useDashboardTab';
import {
  fetchMyEvents,
  fetchMyPosts,
  fetchMyComments,
} from '@/runtime/client/use-cases/member-dashboard-use-cases';
import DashboardEventCard from '@/components/DashboardEventCard';
import DashboardPostCard from '@/components/DashboardPostCard';
import DashboardCommentCard from '@/components/DashboardCommentCard';
import styles from './DashboardTabs.module.css';

/**
 * @typedef {object} TabConfig
 * @property {string} id - tab 的 DOM id。
 * @property {string} panelId - 對應 panel 的 DOM id。
 * @property {string} label - tab 顯示文字。
 * @property {string} emptyText - 空資料提示文字。
 */

/** @type {TabConfig[]} */
const TAB_CONFIGS = [
  { id: 'tab-events', panelId: 'panel-events', label: '我的活動', emptyText: '尚未參加任何活動' },
  { id: 'tab-posts', panelId: 'panel-posts', label: '我的文章', emptyText: '尚未發表任何文章' },
  {
    id: 'tab-comments',
    panelId: 'panel-comments',
    label: '我的留言',
    emptyText: '尚未留過任何言',
  },
];

const PAGE_SIZE = 5;

/**
 * 依 tab 索引渲染對應的 Card 元件列表。
 * @param {object} props - 元件屬性。
 * @param {object[]} props.items - 資料項目。
 * @param {number} props.tabIndex - tab 索引。
 * @param {Set<string>} [props.hostedIds] - 主辦活動 ID 集合（僅 events tab 使用）。
 * @returns {import('react').ReactElement} Card 元件。
 */
function ItemList({ items, tabIndex, hostedIds }) {
  if (tabIndex === 0) {
    const events = /** @type {import('@/lib/firebase-member').MyEventItem[]} */ (items);
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
    const posts = /** @type {import('@/lib/firebase-posts').Post[]} */ (items);
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

  const comments = /** @type {import('@/lib/firebase-member').MyCommentItem[]} */ (items);
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
 * 單一 tab panel 的內容。
 * @param {object} props - 元件屬性。
 * @param {import('@/runtime/hooks/useDashboardTab').UseDashboardTabReturn} props.tab - hook 回傳值。
 * @param {number} props.tabIndex - tab 索引（0=events, 1=posts, 2=comments）。
 * @param {string} props.emptyText - 空資料提示文字。
 * @returns {import('react').ReactElement} panel 內容。
 */
function TabPanel({ tab, tabIndex, emptyText }) {
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
    prevResult,
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
      <ItemList
        items={items}
        tabIndex={tabIndex}
        hostedIds={
          tabIndex === 0
            ? /** @type {{ hostedIds?: Set<string> }} */ (prevResult)?.hostedIds
            : undefined
        }
      />
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
 * 會員 Dashboard Tab 容器。
 * @param {object} props - 元件屬性。
 * @param {string} props.uid - 使用者 UID。
 * @returns {import('react').ReactElement} Tab 容器。
 */
export default function DashboardTabs({ uid }) {
  // --- State ---
  const [activeTab, setActiveTab] = useState(0);

  // --- Keyboard navigation (WAI-ARIA Tabs pattern) ---
  const handleTabKeyDown = useCallback(
    /** @param {import('react').KeyboardEvent} e - 鍵盤事件。 */
    (e) => {
      const tabCount = TAB_CONFIGS.length;
      let nextIndex = activeTab;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          nextIndex = (activeTab + 1) % tabCount;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          nextIndex = (activeTab - 1 + tabCount) % tabCount;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = tabCount - 1;
          break;
        default:
          return;
      }

      setActiveTab(nextIndex);
      const tabList = /** @type {HTMLElement} */ (e.currentTarget).closest('[role="tablist"]');
      const buttons = tabList?.querySelectorAll('[role="tab"]');
      /** @type {HTMLElement | undefined} */ (buttons?.[nextIndex])?.focus();
    },
    [activeTab],
  );

  // --- Custom Hooks ---
  const eventsTab = useDashboardTab(uid, fetchMyEvents, PAGE_SIZE, activeTab === 0);
  const postsTab = useDashboardTab(uid, fetchMyPosts, PAGE_SIZE, activeTab === 1);
  const commentsTab = useDashboardTab(uid, fetchMyComments, PAGE_SIZE, activeTab === 2);

  const tabs = [eventsTab, postsTab, commentsTab];

  return (
    <div className={styles.container}>
      <div className={styles.tabBar} role="tablist">
        {TAB_CONFIGS.map((config, index) => (
          <button
            key={config.id}
            role="tab"
            id={config.id}
            aria-selected={activeTab === index}
            aria-controls={config.panelId}
            className={activeTab === index ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(index)}
            onKeyDown={handleTabKeyDown}
            tabIndex={activeTab === index ? 0 : -1}
            type="button"
          >
            {config.label}
          </button>
        ))}
      </div>

      {TAB_CONFIGS.map((config, index) => (
        <div
          key={config.panelId}
          role="tabpanel"
          id={config.panelId}
          aria-labelledby={config.id}
          style={activeTab !== index ? { display: 'none' } : undefined}
        >
          <TabPanel tab={tabs[index]} tabIndex={index} emptyText={config.emptyText} />
        </div>
      ))}
    </div>
  );
}
