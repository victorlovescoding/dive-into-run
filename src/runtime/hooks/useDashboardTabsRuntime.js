'use client';

import { useCallback, useState } from 'react';
import {
  fetchMyComments,
  fetchMyEvents,
  fetchMyPosts,
} from '@/runtime/client/use-cases/member-dashboard-use-cases';
import useDashboardTab from '@/runtime/hooks/useDashboardTab';

const PAGE_SIZE = 5;

const TAB_CONFIGS = [
  { id: 'tab-events', panelId: 'panel-events', label: '我的活動', emptyText: '尚未參加任何活動' },
  { id: 'tab-posts', panelId: 'panel-posts', label: '我的文章', emptyText: '尚未發表任何文章' },
  { id: 'tab-comments', panelId: 'panel-comments', label: '我的留言', emptyText: '尚未留過任何言' },
];

/**
 * Dashboard tabs runtime orchestration。
 * @param {string} uid - 使用者 UID。
 * @returns {object} active tab state、tab configs、handlers。
 */
export default function useDashboardTabsRuntime(uid) {
  const [activeTab, setActiveTab] = useState(0);

  const eventsTab = useDashboardTab(uid, fetchMyEvents, PAGE_SIZE, activeTab === 0);
  const postsTab = useDashboardTab(uid, fetchMyPosts, PAGE_SIZE, activeTab === 1);
  const commentsTab = useDashboardTab(uid, fetchMyComments, PAGE_SIZE, activeTab === 2);

  const tabs = [
    {
      ...TAB_CONFIGS[0],
      tab: eventsTab,
      hostedIds: /** @type {{ hostedIds?: Set<string> } | null} */ (eventsTab.prevResult)?.hostedIds,
    },
    {
      ...TAB_CONFIGS[1],
      tab: postsTab,
      hostedIds: undefined,
    },
    {
      ...TAB_CONFIGS[2],
      tab: commentsTab,
      hostedIds: undefined,
    },
  ];

  const selectTab = useCallback((index) => {
    setActiveTab(index);
  }, []);

  const handleTabKeyDown = useCallback(
    /** @param {import('react').KeyboardEvent} event - 鍵盤事件。 */
    (event) => {
      const tabCount = tabs.length;
      let nextIndex = activeTab;

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          nextIndex = (activeTab + 1) % tabCount;
          break;
        case 'ArrowLeft':
          event.preventDefault();
          nextIndex = (activeTab - 1 + tabCount) % tabCount;
          break;
        case 'Home':
          event.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          nextIndex = tabCount - 1;
          break;
        default:
          return;
      }

      setActiveTab(nextIndex);
      const tabList = /** @type {HTMLElement} */ (event.currentTarget).closest('[role="tablist"]');
      const tabButtons = tabList?.querySelectorAll('[role="tab"]');
      /** @type {HTMLElement | undefined} */ (tabButtons?.[nextIndex])?.focus();
    },
    [activeTab, tabs.length],
  );

  return {
    activeTab,
    tabs,
    selectTab,
    handleTabKeyDown,
  };
}
