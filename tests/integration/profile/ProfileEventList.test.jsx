/**
 * @file Integration tests for `ProfileEventList` — hosted events list with infinite scroll.
 * @description
 * Covers US1 Acceptance Scenarios 3 / 4 and infinite-scroll behaviour:
 *   - AS3: 顯示主辦活動列表（倒序）
 *   - AS4: 無主辦活動 → 顯示「尚無主辦活動」空狀態
 *   - IntersectionObserver 觸發 loadMore（via real runtime hook）
 *   - 載入中 → loading state
 *   - 載入失敗 → error state
 *   - hasMore=false → sentinel 不渲染
 *   - loadMore 失敗 → 保留既有項目並顯示錯誤
 *
 * Rules:
 * 1. Mock only Firebase SDK/config and browser/Next boundary.
 * 2. Use `@testing-library/react` + query by role/text.
 * 3. AAA Pattern; strict JSDoc; no `container.querySelector`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { getDocs } from 'firebase/firestore';

/* ==========================================================================
   Mocks — Firebase SDK/config + DashboardEventCard + next/link
   ========================================================================== */

const firestoreMock = vi.hoisted(() => ({
  collection: vi.fn((db, path) => ({ type: 'collection', db, path })),
  collectionGroup: vi.fn((db, path) => ({ type: 'collectionGroup', db, path })),
  doc: vi.fn((db, collectionPath, id) => ({ type: 'doc', db, collectionPath, id })),
  getCountFromServer: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((count) => ({ type: 'limit', count })),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn((source, ...constraints) => ({ source, constraints })),
  setDoc: vi.fn(),
  startAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
}));

vi.mock('firebase/firestore', () => firestoreMock);

vi.mock('@/config/client/firebase-client', () => ({
  db: { app: 'test-firestore' },
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
    <article aria-label={event.title}>
      {event.title}
      {isHost && ' [主辦]'}
    </article>
  ),
}));

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * @typedef {object} MockEventData
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
 * 建立 count 筆 mock 活動文件資料。
 * @param {number} count - 數量。
 * @param {string} [prefix] - ID 前綴。
 * @returns {MockEventData[]} 活動資料陣列。
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
    location: '',
    city: '',
    participantsCount: 0,
    maxParticipants: 0,
    hostUid: 'user-abc',
  }));
}

/**
 * 建立 Firestore query document snapshot。
 * @param {MockEventData} event - 活動資料。
 * @returns {import('firebase/firestore').QueryDocumentSnapshot} 文件 snapshot。
 */
function makeEventDoc(event) {
  const snapshot = {
    id: event.id,
    data: () => {
      const data = { ...event };
      delete data.id;
      return data;
    },
    metadata: { hasPendingWrites: false, fromCache: false },
    exists: () => true,
    get: vi.fn(),
    toJSON: () => ({}),
    ref: { id: event.id, path: `events/${event.id}` },
  };
  return /** @type {import('firebase/firestore').QueryDocumentSnapshot} */ (
    /** @type {unknown} */ (snapshot)
  );
}

/**
 * 設定下一次 getDocs 回傳活動列表。
 * @param {MockEventData[]} events - 活動資料。
 */
function mockHostedEventsPage(events) {
  firestoreMock.getDocs.mockResolvedValueOnce({
    docs: events.map(makeEventDoc),
  });
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

  const MockIntersectionObserver = vi.fn();
  MockIntersectionObserver.prototype.observe = vi.fn();
  MockIntersectionObserver.prototype.unobserve = vi.fn();
  MockIntersectionObserver.prototype.disconnect = vi.fn();
  MockIntersectionObserver.prototype.takeRecords = () =>
    /** @type {IntersectionObserverEntry[]} */ ([]);

  global.IntersectionObserver = /** @type {typeof IntersectionObserver} */ (
    /** @type {unknown} */ (MockIntersectionObserver)
  );
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
    mockHostedEventsPage(makeEvents(3));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    expect(await screen.findByRole('article', { name: 'Event p1-0' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Event p1-1' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Event p1-2' })).toBeInTheDocument();

    expect(firestoreMock.where).toHaveBeenCalledWith('hostUid', '==', TEST_UID);
  });

  // --- AS3: 每筆活動應以 isHost=true 傳給 DashboardEventCard ---
  it('passes isHost=true to DashboardEventCard for every item', async () => {
    // Arrange
    mockHostedEventsPage(makeEvents(2));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert — mock 的 DashboardEventCard 會在 isHost=true 時 append [主辦]
    expect(await screen.findByRole('article', { name: 'Event p1-0' })).toHaveTextContent('[主辦]');
    expect(screen.getByRole('article', { name: 'Event p1-1' })).toHaveTextContent('[主辦]');
  });

  // --- AS4: 空狀態 ---
  it('shows empty state when user has no hosted events', async () => {
    // Arrange
    mockHostedEventsPage([]);

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    expect(await screen.findByText(/尚無主辦活動/)).toBeInTheDocument();
  });

  // --- 載入中狀態 ---
  it('shows loading state while initial fetch is pending', async () => {
    // Arrange
    firestoreMock.getDocs.mockImplementationOnce(() => new Promise(() => {}));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    expect(screen.getByText(/載入中/)).toBeInTheDocument();
  });

  // --- 載入失敗 → error state ---
  it('shows error state when initial fetch fails', async () => {
    // Arrange
    firestoreMock.getDocs.mockRejectedValueOnce(new Error('network down'));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert
    expect(await screen.findByText(/載入失敗|無法載入/)).toBeInTheDocument();
  });

  // --- hasMore=true 時 sentinel 存在 ---
  it('renders sentinel when hasMore is true', async () => {
    // Arrange
    mockHostedEventsPage(makeEvents(6, 'p1'));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert — sentinel 是 IntersectionObserver target，aria-hidden 故無語意 role
    expect(await screen.findByTestId('profile-event-list-sentinel')).toBeInTheDocument();
  });

  // --- hasMore=false 時 sentinel 不存在 ---
  it('does not render sentinel when hasMore is false', async () => {
    // Arrange
    mockHostedEventsPage(makeEvents(2));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    // Assert — sentinel 不存在
    await screen.findByRole('article', { name: 'Event p1-0' });
    expect(screen.queryByTestId('profile-event-list-sentinel')).not.toBeInTheDocument();
  });

  // --- loadMore error → 保留既有項目顯示錯誤 ---
  it('shows error without losing previous items when loadMore fails', async () => {
    // Arrange — 第一頁有更多資料，第二頁失敗
    mockHostedEventsPage(makeEvents(6, 'p1'));
    firestoreMock.getDocs.mockRejectedValueOnce(new Error('load more failed'));

    const ProfileEventList = await importProfileEventList();

    // Act
    render(<ProfileEventList uid={TEST_UID} />);

    await screen.findByRole('article', { name: 'Event p1-0' });
    const sentinel = await screen.findByTestId('profile-event-list-sentinel');
    expect(sentinel).toBeInTheDocument();

    await waitFor(() => {
      expect(global.IntersectionObserver).toHaveBeenCalled();
    });

    const callback = /** @type {import('vitest').Mock} */ (
      /** @type {unknown} */ (global.IntersectionObserver)
    ).mock.calls[0][0];
    callback(/** @type {IntersectionObserverEntry[]} */ ([{ isIntersecting: true }]));

    // Assert — 錯誤提示出現
    expect(await screen.findByText(/載入更多失敗/)).toBeInTheDocument();

    // Assert — 原本的項目仍在
    expect(screen.getByRole('article', { name: 'Event p1-0' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Event p1-4' })).toBeInTheDocument();
    expect(getDocs).toHaveBeenCalledWith(
      expect.objectContaining({
        constraints: expect.arrayContaining([
          expect.objectContaining({
            type: 'startAfter',
          }),
        ]),
      }),
    );
  });
});
