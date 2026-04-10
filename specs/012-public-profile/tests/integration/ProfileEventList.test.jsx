/**
 * @file Integration tests for `ProfileEventList` — hosted events list with infinite scroll.
 * @description
 * TDD RED phase — target component does NOT exist yet:
 *   `src/app/users/[uid]/ProfileEventList.jsx`
 *
 * Covers US1 Acceptance Scenarios 3 / 4 and infinite-scroll behaviour:
 *   - AS3: 顯示主辦活動列表（倒序）
 *   - AS4: 無主辦活動 → 顯示「尚無主辦活動」空狀態
 *   - IntersectionObserver 觸發 loadMore → 呼叫 getHostedEvents 帶 lastDoc
 *   - 載入中 → loading state
 *   - 載入失敗 → error state
 *   - hasMore=false → 不再觸發 loadMore
 *
 * Rules:
 * 1. Mock service layer only: `@/lib/firebase-profile`.
 * 2. Override global IntersectionObserver per-test so we can trigger it manually.
 * 3. Use `@testing-library/react` + query by role/text.
 * 4. AAA Pattern; strict JSDoc; no `container.querySelector`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { getHostedEvents } from '@/lib/firebase-profile';

/* ==========================================================================
   Mocks — service layer + DashboardEventCard + next/link
   ========================================================================== */

vi.mock('@/lib/firebase-profile', () => ({
  getHostedEvents: vi.fn(),
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

// 複用既有 DashboardEventCard 的顯示 — 但在 integration test 層級我們只需要知道
// ProfileEventList 會 render 每筆活動的 key/identifier，因此 mock 成簡單的 test id。
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

const mockedGetHostedEvents = /** @type {import('vitest').Mock} */ (
  /** @type {unknown} */ (getHostedEvents)
);

/* ==========================================================================
   IntersectionObserver override per test so we can manually trigger
   ========================================================================== */

/**
 * 已註冊的 IntersectionObserver callback。每次 beforeEach 重置，讓測試可
 * 透過 `fireIntersection()` 手動觸發。
 * @type {((entries: Array<{ isIntersecting: boolean }>) => void) | null}
 */
let intersectionCallback = null;
/** @type {import('vitest').Mock} */
let mockObserve;
/** @type {import('vitest').Mock} */
let mockDisconnect;

beforeEach(() => {
  vi.clearAllMocks();
  intersectionCallback = null;
  mockObserve = vi.fn();
  mockDisconnect = vi.fn();

  /**
   * Minimal IntersectionObserver mock — stores callback so tests can trigger it.
   * @param {(entries: Array<{ isIntersecting: boolean }>) => void} cb - Observer callback.
   */
  function MockIntersectionObserver(cb) {
    intersectionCallback = cb;
  }
  MockIntersectionObserver.prototype.observe = mockObserve;
  MockIntersectionObserver.prototype.unobserve = vi.fn();
  MockIntersectionObserver.prototype.disconnect = mockDisconnect;
  MockIntersectionObserver.prototype.takeRecords = () =>
    /** @type {IntersectionObserverEntry[]} */ ([]);

  global.IntersectionObserver = /** @type {typeof IntersectionObserver} */ (
    /** @type {unknown} */ (MockIntersectionObserver)
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * 觸發已記錄的 IntersectionObserver callback（模擬 sentinel 進入視窗）。
 */
function fireIntersection() {
  if (intersectionCallback) {
    intersectionCallback([{ isIntersecting: true }]);
  }
}

/* ==========================================================================
   Test Data
   ========================================================================== */

/**
 * @typedef {object} MockHostedEvent
 * @property {string} id - 活動 ID。
 * @property {string} title - 活動標題。
 * @property {{ toMillis: () => number, toDate: () => Date }} time - 活動時間。
 * @property {string} hostUid - 主辦者 UID。
 */

/**
 * 建立 count 筆 mock 活動，依時間遞減。
 * @param {number} count - 數量。
 * @param {string} [prefix] - ID 前綴。
 * @returns {MockHostedEvent[]} 活動資料陣列。
 */
function makeEvents(count, prefix = 'p1') {
  const base = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    title: `Event ${prefix}-${i}`,
    time: {
      toMillis: () => base - i * 86400000,
      toDate: () => new Date(base - i * 86400000),
    },
    hostUid: 'user-abc',
  }));
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
   Tests
   ========================================================================== */

describe('Integration: ProfileEventList', () => {
  // --- AS3: 有活動 → 顯示列表 ---
  it('renders hosted events list on initial load', async () => {
    // Arrange
    const events = makeEvents(3);
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: events,
      lastDoc: {},
      hasMore: false,
    });

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('event-p1-0')).toBeInTheDocument();
    });
    expect(screen.getByTestId('event-p1-1')).toBeInTheDocument();
    expect(screen.getByTestId('event-p1-2')).toBeInTheDocument();

    // 首次呼叫應該是「沒 lastDoc」
    expect(mockedGetHostedEvents).toHaveBeenCalledTimes(1);
    expect(mockedGetHostedEvents).toHaveBeenCalledWith(
      TEST_UID,
      expect.not.objectContaining({ lastDoc: expect.anything() }),
    );
  });

  // --- AS3: 每筆活動應以 isHost=true 傳給 DashboardEventCard ---
  it('passes isHost=true to DashboardEventCard for every item', async () => {
    // Arrange
    const events = makeEvents(2);
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: events,
      lastDoc: {},
      hasMore: false,
    });

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert — mock 的 DashboardEventCard 會在 isHost=true 時 append [主辦]
    await waitFor(() => {
      expect(screen.getByTestId('event-p1-0')).toHaveTextContent('[主辦]');
    });
    expect(screen.getByTestId('event-p1-1')).toHaveTextContent('[主辦]');
  });

  // --- AS4: 空狀態 ---
  it('shows empty state when user has no hosted events', async () => {
    // Arrange
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: [],
      lastDoc: null,
      hasMore: false,
    });

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/尚無主辦活動/)).toBeInTheDocument();
    });
  });

  // --- 載入中狀態 ---
  it('shows loading state while initial fetch is pending', async () => {
    // Arrange — fetch hangs
    mockedGetHostedEvents.mockImplementationOnce(() => new Promise(() => {}));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/載入中/)).toBeInTheDocument();
    });
  });

  // --- 載入失敗 → error state ---
  it('shows error state when initial fetch fails', async () => {
    // Arrange
    mockedGetHostedEvents.mockRejectedValueOnce(new Error('network down'));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/載入失敗|無法載入/)).toBeInTheDocument();
    });
  });

  // --- IntersectionObserver 觸發 loadMore ---
  it('loads next page when IntersectionObserver fires and hasMore=true', async () => {
    // Arrange — 首頁回傳 hasMore=true
    const page1 = makeEvents(5, 'p1');
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: page1,
      lastDoc: { __cursor: 'page1-last' },
      hasMore: true,
    });

    const ProfileEventList = await importProfileEventList();
    render(<ProfileEventList uid={TEST_UID} />);

    await waitFor(() => {
      expect(screen.getByTestId('event-p1-0')).toBeInTheDocument();
    });

    // Arrange — 準備下一頁 response
    const page2 = makeEvents(3, 'p2');
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: page2,
      lastDoc: { __cursor: 'page2-last' },
      hasMore: false,
    });

    // Act — 觸發 sentinel intersection
    fireIntersection();

    // Assert — 第二次呼叫應帶 lastDoc
    await waitFor(() => {
      expect(mockedGetHostedEvents).toHaveBeenCalledTimes(2);
    });
    expect(mockedGetHostedEvents.mock.calls[1][1]).toMatchObject({
      lastDoc: { __cursor: 'page1-last' },
    });

    // Assert — 新一頁的項目 append 到列表
    await waitFor(() => {
      expect(screen.getByTestId('event-p2-0')).toBeInTheDocument();
    });
    expect(screen.getByTestId('event-p1-0')).toBeInTheDocument();
  });

  // --- hasMore=false 時不再觸發 loadMore ---
  it('does not fetch more when hasMore is false', async () => {
    // Arrange — 首次回傳 hasMore=false
    const events = makeEvents(2);
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: events,
      lastDoc: null,
      hasMore: false,
    });

    const ProfileEventList = await importProfileEventList();

    render(<ProfileEventList uid={TEST_UID} />);

    await waitFor(() => {
      expect(screen.getByTestId('event-p1-0')).toBeInTheDocument();
    });

    // Act — 強制觸發 intersection（即使 sentinel 不該存在）
    fireIntersection();

    // 等一個 microtask flush
    await Promise.resolve();

    // Assert — 不會再呼叫第二次
    expect(mockedGetHostedEvents).toHaveBeenCalledTimes(1);
  });

  // --- loadMore 失敗 → 顯示錯誤且不 crash ---
  it('shows error without losing previous items when loadMore fails', async () => {
    // Arrange — page1 成功 hasMore=true
    const page1 = makeEvents(5, 'p1');
    mockedGetHostedEvents.mockResolvedValueOnce({
      items: page1,
      lastDoc: { __cursor: 'page1-last' },
      hasMore: true,
    });

    const ProfileEventList = await importProfileEventList();
    render(<ProfileEventList uid={TEST_UID} />);

    await waitFor(() => {
      expect(screen.getByTestId('event-p1-0')).toBeInTheDocument();
    });

    // Arrange — page2 失敗
    mockedGetHostedEvents.mockRejectedValueOnce(new Error('page2 failed'));

    // Act
    fireIntersection();

    // Assert — 原本的項目還在
    await waitFor(() => {
      expect(mockedGetHostedEvents).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId('event-p1-0')).toBeInTheDocument();
    expect(screen.getByTestId('event-p1-4')).toBeInTheDocument();

    // 應顯示載入更多失敗的提示
    await waitFor(() => {
      expect(screen.getByText(/載入更多失敗|載入失敗|無法載入/)).toBeInTheDocument();
    });
  });
});
