import { createRef, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import '@testing-library/jest-dom/vitest';
import DashboardTabsScreen from '@/ui/member/DashboardTabsScreen';

vi.mock('next/link', () => ({
  /**
   * Test-safe Next Link replacement.
   * @param {object} props - Link props.
   * @param {import('react').ReactNode} props.children - Link children.
   * @param {string} props.href - Link target.
   * @returns {import('react').ReactElement} Anchor element.
   */
  default({ children, href }) {
    return <a href={href}>{children}</a>;
  },
}));

/** @typedef {import('@/runtime/hooks/useDashboardTab').UseDashboardTabReturn} UseDashboardTabReturn */

const TAB_PANEL_INDEX_BY_NAME = new Map([
  ['我的活動', 0],
  ['我的文章', 1],
  ['我的留言', 2],
]);

/**
 * @typedef {object} DashboardTabConfig
 * @property {string} id - Tab id.
 * @property {string} panelId - Controlled panel id.
 * @property {string} label - Tab label.
 * @property {string} emptyText - Empty state copy.
 * @property {UseDashboardTabReturn} tab - Rendered tab state.
 * @property {Set<string> | undefined} [hostedIds] - Hosted event ids.
 */

/**
 * @typedef {object} DashboardRuntimeFixture
 * @property {number} activeTab - Active tab index.
 * @property {DashboardTabConfig[]} tabs - Dashboard tab configs.
 * @property {(index: number) => void} selectTab - Tab selection handler.
 * @property {(event: import('react').KeyboardEvent) => void} handleTabKeyDown - Keyboard handler.
 */

/**
 * 建立一個假的 Firestore Timestamp。
 * @param {number} year - 年。
 * @param {number} monthIndex - 0-based 月份。
 * @param {number} day - 日。
 * @param {number} hour - 時。
 * @param {number} minute - 分。
 * @returns {import('firebase/firestore').Timestamp} 假 Timestamp。
 */
function fakeTimestamp(year, monthIndex, day, hour, minute) {
  const date = new Date(year, monthIndex, day, hour, minute);

  return Timestamp.fromDate(date);
}

/**
 * 建立 dashboard tab state。
 * @param {Partial<UseDashboardTabReturn>} [overrides] - 覆蓋預設 tab state。
 * @returns {UseDashboardTabReturn} Tab state。
 */
function makeTab(overrides = {}) {
  return {
    items: [],
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: null,
    retry: vi.fn(),
    loadMoreError: null,
    retryLoadMore: vi.fn(),
    sentinelRef: createRef(),
    prevResult: null,
    ...overrides,
  };
}

/**
 * 建立文章資料。
 * @param {Partial<import('@/service/post-service').Post>} [overrides] - 覆蓋欄位。
 * @returns {import('@/service/post-service').Post} Dashboard post。
 */
function makePost(overrides = {}) {
  return {
    id: 'post-1',
    authorUid: 'runner-1',
    title: '河濱配速筆記',
    content: '今天把節奏跑拆成三段。',
    postAt: fakeTimestamp(2026, 4, 2, 7, 30),
    likesCount: 8,
    commentsCount: 2,
    ...overrides,
  };
}

/**
 * 建立留言資料。
 * @param {Partial<import('@/service/member-dashboard-service').MyCommentItem>} [overrides] - 覆蓋欄位。
 * @returns {import('@/service/member-dashboard-service').MyCommentItem} Dashboard comment。
 */
function makeComment(overrides = {}) {
  return {
    id: 'comment-1',
    source: 'event',
    parentId: 'event-1',
    parentTitle: '週末長跑團',
    text: '我也想參加這場練跑。',
    createdAt: fakeTimestamp(2026, 4, 2, 9, 10),
    ...overrides,
  };
}

/**
 * 建立 DashboardTabsScreen runtime fixture。
 * @param {object} [options] - Runtime fixture options.
 * @param {number} [options.activeTab] - Active tab index.
 * @param {Partial<UseDashboardTabReturn>} [options.eventsTab] - Events tab overrides.
 * @param {Partial<UseDashboardTabReturn>} [options.postsTab] - Posts tab overrides.
 * @param {Partial<UseDashboardTabReturn>} [options.commentsTab] - Comments tab overrides.
 * @param {(index: number) => void} [options.selectTab] - Tab selection handler.
 * @param {(event: import('react').KeyboardEvent) => void} [options.handleTabKeyDown] - Keyboard handler.
 * @returns {DashboardRuntimeFixture} Runtime fixture.
 */
function makeRuntime(options = {}) {
  const {
    activeTab = 0,
    eventsTab = {},
    postsTab = {},
    commentsTab = {},
    selectTab = vi.fn(),
    handleTabKeyDown = vi.fn(),
  } = options;

  return {
    activeTab,
    selectTab,
    handleTabKeyDown,
    tabs: [
      {
        id: 'tab-events',
        panelId: 'panel-events',
        label: '我的活動',
        emptyText: '尚未參加任何活動',
        tab: makeTab(eventsTab),
        hostedIds: new Set(),
      },
      {
        id: 'tab-posts',
        panelId: 'panel-posts',
        label: '我的文章',
        emptyText: '尚未發表任何文章',
        tab: makeTab(postsTab),
        hostedIds: undefined,
      },
      {
        id: 'tab-comments',
        panelId: 'panel-comments',
        label: '我的留言',
        emptyText: '尚未留過任何言',
        tab: makeTab(commentsTab),
        hostedIds: undefined,
      },
    ],
  };
}

/**
 * 以 tab label 找到對應 panel。
 * @param {string} tabName - Tab label.
 * @returns {HTMLElement} Controlled panel element.
 */
function getPanelForTab(tabName) {
  const panelIndex = TAB_PANEL_INDEX_BY_NAME.get(tabName);
  const panels = screen.getAllByRole('tabpanel', { hidden: true });

  if (panelIndex === undefined || !panels[panelIndex]) {
    throw new Error(`Missing panel for ${tabName}`);
  }

  return panels[panelIndex];
}

/**
 * DashboardTabsScreen test harness with stateful tab selection.
 * @param {object} props - Harness props.
 * @param {import('vitest').Mock} props.onSelectTab - Boundary spy for tab selection.
 * @returns {import('react').ReactElement} Harness element.
 */
function StatefulDashboardTabsScreen({ onSelectTab }) {
  const [activeTab, setActiveTab] = useState(0);

  const runtime = makeRuntime({
    activeTab,
    postsTab: { items: [makePost()] },
    commentsTab: { items: [makeComment()] },
    selectTab: (index) => {
      onSelectTab(index);
      setActiveTab(index);
    },
  });

  return <DashboardTabsScreen runtime={runtime} />;
}

describe('DashboardTabsScreen', () => {
  it('switches the visible panel when a tab is selected', async () => {
    // Arrange
    const user = userEvent.setup();
    const onSelectTab = vi.fn();

    render(<StatefulDashboardTabsScreen onSelectTab={onSelectTab} />);

    const eventsPanel = getPanelForTab('我的活動');
    const postsPanel = getPanelForTab('我的文章');
    const commentsPanel = getPanelForTab('我的留言');

    // Act
    await user.click(screen.getByRole('tab', { name: '我的文章' }));

    // Assert
    expect(onSelectTab).toHaveBeenCalledWith(1);
    expect(screen.getByRole('tab', { name: '我的文章' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(eventsPanel).not.toBeVisible();
    expect(postsPanel).toBeVisible();
    expect(within(postsPanel).getByRole('link', { name: '河濱配速筆記' })).toHaveAttribute(
      'href',
      '/posts/post-1',
    );

    // Act
    await user.click(screen.getByRole('tab', { name: '我的留言' }));

    // Assert
    expect(onSelectTab).toHaveBeenCalledWith(2);
    expect(postsPanel).not.toBeVisible();
    expect(commentsPanel).toBeVisible();
    expect(within(commentsPanel).getByRole('link', { name: '週末長跑團' })).toHaveAttribute(
      'href',
      '/events/event-1',
    );
  });

  it('renders posts loading-more and comments end states from literal runtime props', () => {
    // Arrange
    const runtime = makeRuntime({
      activeTab: 1,
      postsTab: {
        items: [makePost({ title: '間歇課表紀錄', id: 'post-interval' })],
        isLoadingMore: true,
        hasMore: true,
      },
      commentsTab: {
        items: [makeComment({ text: '收操路線很清楚。' })],
        hasMore: false,
      },
    });

    // Act
    render(<DashboardTabsScreen runtime={runtime} />);

    // Assert
    const postsPanel = getPanelForTab('我的文章');
    const commentsPanel = getPanelForTab('我的留言');

    expect(postsPanel).toBeVisible();
    expect(within(postsPanel).getByRole('link', { name: '間歇課表紀錄' })).toHaveAttribute(
      'href',
      '/posts/post-interval',
    );
    expect(within(postsPanel).getByText('載入更多...')).toBeInTheDocument();
    expect(commentsPanel).not.toBeVisible();

    expect(within(commentsPanel).getByText('收操路線很清楚。')).toBeInTheDocument();
    expect(within(commentsPanel).getByText('已顯示全部')).toBeInTheDocument();
  });

  it('calls retry handlers for initial and load-more errors', async () => {
    // Arrange
    const user = userEvent.setup();
    const retry = vi.fn();
    const retryLoadMore = vi.fn();
    const runtime = makeRuntime({
      activeTab: 1,
      postsTab: {
        error: '文章載入失敗',
        retry,
      },
      commentsTab: {
        items: [makeComment()],
        loadMoreError: '留言載入更多失敗',
        retryLoadMore,
      },
    });

    const view = render(<DashboardTabsScreen runtime={runtime} />);

    const postsPanel = getPanelForTab('我的文章');

    // Act
    await user.click(within(postsPanel).getByRole('button', { name: '重試' }));

    // Assert
    expect(within(postsPanel).getByText('文章載入失敗')).toBeInTheDocument();
    expect(retry).toHaveBeenCalled();

    // Act
    view.rerender(
      <DashboardTabsScreen
        runtime={makeRuntime({
          activeTab: 2,
          commentsTab: {
            items: [makeComment()],
            loadMoreError: '留言載入更多失敗',
            retryLoadMore,
          },
        })}
      />,
    );

    const commentsPanel = getPanelForTab('我的留言');
    await user.click(within(commentsPanel).getByRole('button', { name: '重試' }));

    // Assert
    expect(commentsPanel).toBeVisible();
    expect(within(commentsPanel).getByText('留言載入更多失敗')).toBeInTheDocument();
    expect(retryLoadMore).toHaveBeenCalled();
  });
});
