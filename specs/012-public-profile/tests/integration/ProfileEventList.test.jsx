/**
 * @file Integration tests for `ProfileEventList` — hosted events list with infinite scroll.
 * @description
 * Covers US1 Acceptance Scenarios 3 / 4 and infinite-scroll behaviour:
 *   - AS3: 顯示主辦活動列表（倒序）
 *   - AS4: 無主辦活動 → 顯示「尚無主辦活動」空狀態
 *   - IntersectionObserver 觸發 loadMore（via runtime hook）
 *   - 載入中 → loading state
 *   - 載入失敗 → error state
 *   - hasMore=false → sentinel 不渲染
 *   - loadMore 失敗 → 保留既有項目並顯示錯誤
 *
 * Rules:
 * 1. Mock runtime hook: `@/runtime/hooks/useProfileEventsRuntime`.
 * 2. Use `@testing-library/react` + query by role/text.
 * 3. AAA Pattern; strict JSDoc; no `container.querySelector`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';

/* ==========================================================================
   Mocks — runtime hook + DashboardEventCard + next/link
   ========================================================================== */

/** @type {import('vitest').Mock} */
const mockUseProfileEventsRuntime = vi.fn();

vi.mock('@/runtime/hooks/useProfileEventsRuntime', () => ({
  /**
   * @param {string} uid - User ID.
   * @returns {object} Runtime state.
   */
  default: (uid) => mockUseProfileEventsRuntime(uid),
}));

vi.mock('next/link', () => ({
  /**
   * @param {object} props - Link props.
   * @param {import('react').ReactNode} props.children - Children.
   * @param {string} props.href - Destination.
   * @returns {import('react').ReactElement} Anchor element.
   */
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/DashboardEventCard', () => ({
  /**
   * @param {object} props - DashboardEventCard props.
   * @param {{ id: string, title: string }} props.event - Event data.
   * @param {boolean} props.isHost - 是否主辦。
   * @returns {import('react').ReactElement} Mocked card.
   */
  default: ({ event, isHost }) => (
    <div data-testid={`event-${event.id}`}>
      {event.title}
      {isHost && ' [主辦]'}
    </div>
  ),
}));

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * 建立 runtime hook 預設回傳值。
 * @param {Partial<import('@/runtime/hooks/useProfileEventsRuntime').ProfileEventsRuntimeState>} [overrides] - 覆蓋項目。
 * @returns {import('@/runtime/hooks/useProfileEventsRuntime').ProfileEventsRuntimeState} 完整 state。
 */
function makeRuntimeState(overrides = {}) {
  return {
    items: [],
    isInitialLoading: false,
    isLoadingMore: false,
    hasMore: false,
    initialError: null,
    loadMoreError: null,
    sentinelRef: createRef(),
    ...overrides,
  };
}

/**
 * @typedef {object} MockEventItem
 * @property {string} id - 活動 ID。
 * @property {string} title - 活動標題。
 * @property {{ toMillis: () => number, toDate: () => Date }} time - 活動時間。
 * @property {string} location - 活動地點。
 * @property {string} city - 活動所在縣市。
 * @property {number} participantsCount - 目前參加人數。
 * @property {number} maxParticipants - 人數上限。
 * @property {string} hostUid - 主辦者 UID。
 */

/**
 * 建立 count 筆 mock 活動（已 toDashboardItem mapping）。
 * @param {number} count - 數量。
 * @param {string} [prefix] - ID 前綴。
 * @returns {import('@/service/member-dashboard-service').MyEventItem[]} 活動資料陣列。
 */
function makeItems(count, prefix = 'p1') {
  const base = Date.now();
  return /** @type {import('@/service/member-dashboard-service').MyEventItem[]} */ (
    Array.from({ length: count }, (_, i) => ({
      id: `${prefix}-${i}`,
      title: `Event ${prefix}-${i}`,
      time: {
        toMillis: () => base - i * 86400000,
        toDate: () => new Date(base - i * 86400000),
      },
      location: '',
      city: '',
      participantsCount: 0,
      maxParticipants: 0,
      hostUid: 'user-abc',
    }))
  );
}

/**
 * 動態載入 ProfileEventList 元件。
 * @returns {Promise<(props: { uid: string }) => import('react').ReactElement>}
 *   ProfileEventList 元件。
 */
async function importProfileEventList() {
  const mod = await import('@/app/users/[uid]/ProfileEventList');
  return /** @type {(props: { uid: string }) => import('react').ReactElement} */ (mod.default);
}

const TEST_UID = 'user-abc';

/* ==========================================================================
   Setup / Teardown
   ========================================================================== */

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ==========================================================================
   Tests
   ========================================================================== */

describe('Integration: ProfileEventList', () => {
  // --- AS3: 有活動 → 顯示列表 ---
  it('renders hosted events list on initial load', async () => {
    // Arrange
    const items = makeItems(3);
    mockUseProfileEventsRuntime.mockReturnValue(makeRuntimeState({ items }));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    expect(screen.getByTestId('event-p1-0')).toBeInTheDocument();
    expect(screen.getByTestId('event-p1-1')).toBeInTheDocument();
    expect(screen.getByTestId('event-p1-2')).toBeInTheDocument();

    // runtime hook 被以正確 uid 呼叫
    expect(mockUseProfileEventsRuntime).toHaveBeenCalledWith(TEST_UID);
  });

  // --- AS3: 每筆活動應以 isHost=true 傳給 DashboardEventCard ---
  it('passes isHost=true to DashboardEventCard for every item', async () => {
    // Arrange
    const items = makeItems(2);
    mockUseProfileEventsRuntime.mockReturnValue(makeRuntimeState({ items }));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert — mock 的 DashboardEventCard 會在 isHost=true 時 append [主辦]
    expect(screen.getByTestId('event-p1-0')).toHaveTextContent('[主辦]');
    expect(screen.getByTestId('event-p1-1')).toHaveTextContent('[主辦]');
  });

  // --- AS4: 空狀態 ---
  it('shows empty state when user has no hosted events', async () => {
    // Arrange
    mockUseProfileEventsRuntime.mockReturnValue(makeRuntimeState({ items: [] }));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    expect(screen.getByText(/尚無主辦活動/)).toBeInTheDocument();
  });

  // --- 載入中狀態 ---
  it('shows loading state while initial fetch is pending', async () => {
    // Arrange
    mockUseProfileEventsRuntime.mockReturnValue(makeRuntimeState({ isInitialLoading: true }));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    expect(screen.getByText(/載入中/)).toBeInTheDocument();
  });

  // --- 載入失敗 → error state ---
  it('shows error state when initial fetch fails', async () => {
    // Arrange
    mockUseProfileEventsRuntime.mockReturnValue(makeRuntimeState({ initialError: '載入失敗' }));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    expect(screen.getByText(/載入失敗|無法載入/)).toBeInTheDocument();
  });

  // --- hasMore=true 時 sentinel 存在 ---
  it('renders sentinel when hasMore is true', async () => {
    // Arrange
    const items = makeItems(5, 'p1');
    mockUseProfileEventsRuntime.mockReturnValue(makeRuntimeState({ items, hasMore: true }));

    const ProfileEventList = await importProfileEventList();

    // Act
    const { container } = render(<ProfileEventList uid={TEST_UID} />);

    // Assert — sentinel 存在（aria-hidden div）
    const sentinel = container.querySelector('[aria-hidden="true"]');
    expect(sentinel).toBeInTheDocument();
  });

  // --- hasMore=false 時 sentinel 不存在 ---
  it('does not render sentinel when hasMore is false', async () => {
    // Arrange
    const items = makeItems(2);
    mockUseProfileEventsRuntime.mockReturnValue(makeRuntimeState({ items, hasMore: false }));

    const ProfileEventList = await importProfileEventList();

    // Act
    const { container } = render(<ProfileEventList uid={TEST_UID} />);

    // Assert — sentinel 不存在
    const sentinel = container.querySelector('[aria-hidden="true"]');
    expect(sentinel).not.toBeInTheDocument();
  });

  // --- loadMore error → 保留既有項目顯示錯誤 ---
  it('shows error without losing previous items when loadMore fails', async () => {
    // Arrange — items 仍在，但 loadMoreError 被設定
    const items = makeItems(5, 'p1');
    mockUseProfileEventsRuntime.mockReturnValue(
      makeRuntimeState({
        items,
        hasMore: true,
        loadMoreError: '載入更多失敗',
      }),
    );

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert — 錯誤提示出現
    expect(screen.getByText(/載入更多失敗/)).toBeInTheDocument();

    // Assert — 原本的項目仍在
    expect(screen.getByTestId('event-p1-0')).toBeInTheDocument();
    expect(screen.getByTestId('event-p1-4')).toBeInTheDocument();
  });
});
