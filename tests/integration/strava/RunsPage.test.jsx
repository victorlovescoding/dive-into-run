import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/runtime/hooks/useRunsPageRuntime', () => ({
  default: vi.fn(),
}));

vi.mock('@/components/RunsLoginGuide', () => ({
  default: () => <div data-testid="login-guide">請先登入</div>,
}));
vi.mock('@/components/RunsConnectGuide', () => ({
  default: () => <div data-testid="connect-guide">連結 Strava</div>,
}));
vi.mock('@/components/RunsActivityList', () => ({
  default: ({ activities, isLoading, loadMore, hasMore, isLoadingMore }) => (
    <div data-testid="activity-list">
      {isLoading ? 'loading' : `${activities.length} activities`}
      {loadMore && <span data-testid="has-load-more" />}
      {typeof hasMore === 'boolean' && <span data-testid="has-has-more" />}
      {typeof isLoadingMore === 'boolean' && <span data-testid="has-is-loading-more" />}
    </div>
  ),
}));
vi.mock('@/components/RunCalendarDialog', () => ({
  default: ({ open }) => (open ? <div data-testid="calendar-dialog">calendar open</div> : null),
}));

import useRunsPageRuntime from '@/runtime/hooks/useRunsPageRuntime';
import RunsPage from '@/app/runs/page';

const mockedUseRunsPageRuntime = /** @type {import('vitest').Mock} */ (useRunsPageRuntime);

/**
 * @typedef {object} RunsPageRuntimeMock
 * @property {boolean} authLoading - 是否為 auth 載入狀態。
 * @property {object | null} user - 當前登入使用者。
 * @property {object | null} connection - Strava 連線狀態。
 * @property {Array<object>} activities - 跑步活動列表。
 * @property {boolean} activitiesLoading - 活動列表是否載入中。
 * @property {string | null} activitiesError - 活動列表錯誤訊息。
 * @property {() => void} loadMore - 載入更多活動的 handler。
 * @property {boolean} hasMore - 是否還有下一頁。
 * @property {boolean} isLoadingMore - 是否正在載入更多活動。
 * @property {boolean} calendarOpen - 月曆 dialog 是否開啟。
 * @property {() => void} openCalendar - 開啟月曆的 handler。
 * @property {() => void} closeCalendar - 關閉月曆的 handler。
 * @property {string} syncButtonLabel - 同步按鈕顯示文字。
 * @property {() => void} handleSync - 觸發同步的 handler。
 * @property {number} cooldownRemaining - 剩餘冷卻秒數。
 * @property {boolean} isSyncing - 是否同步中。
 * @property {boolean} isDisconnecting - 是否取消連結中。
 * @property {() => void} handleDisconnect - 取消連結的 handler。
 * @property {string | null} syncError - 同步錯誤訊息。
 */

/**
 * 建立 runs page runtime mock。
 * @param {Partial<RunsPageRuntimeMock>} [overrides] - 覆蓋欄位。
 * @returns {RunsPageRuntimeMock} runtime mock。
 */
function createRuntime(overrides = {}) {
  return {
    authLoading: false,
    user: null,
    connection: null,
    activities: [],
    activitiesLoading: false,
    activitiesError: null,
    loadMore: vi.fn(),
    hasMore: true,
    isLoadingMore: false,
    calendarOpen: false,
    openCalendar: vi.fn(),
    closeCalendar: vi.fn(),
    syncButtonLabel: '同步',
    handleSync: vi.fn(),
    cooldownRemaining: 0,
    isSyncing: false,
    isDisconnecting: false,
    handleDisconnect: vi.fn(),
    syncError: null,
    ...overrides,
  };
}

describe('RunsPage', () => {
  beforeEach(() => {
    mockedUseRunsPageRuntime.mockReturnValue(createRuntime());
  });

  it('shows loading skeleton when auth is loading', () => {
    mockedUseRunsPageRuntime.mockReturnValue(createRuntime({ authLoading: true }));

    render(<RunsPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('login-guide')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connect-guide')).not.toBeInTheDocument();
  });

  it('shows RunsLoginGuide when user is not logged in', () => {
    render(<RunsPage />);

    expect(screen.getByTestId('login-guide')).toBeInTheDocument();
    expect(screen.queryByTestId('connect-guide')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-list')).not.toBeInTheDocument();
  });

  it('shows RunsConnectGuide when user is logged in but not connected', () => {
    mockedUseRunsPageRuntime.mockReturnValue(
      createRuntime({
        user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
      }),
    );

    render(<RunsPage />);

    expect(screen.getByTestId('connect-guide')).toBeInTheDocument();
    expect(screen.queryByTestId('login-guide')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-list')).not.toBeInTheDocument();
  });

  it('shows athlete name and activity list when connected', () => {
    mockedUseRunsPageRuntime.mockReturnValue(
      createRuntime({
        user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
        connection: { connected: true, athleteName: 'John Runner', lastSyncAt: null },
        activities: [{ id: '1' }, { id: '2' }],
        hasMore: false,
      }),
    );

    render(<RunsPage />);

    expect(screen.getByText('John Runner')).toBeInTheDocument();
    expect(screen.getByTestId('activity-list')).toHaveTextContent('2 activities');
    expect(screen.queryByTestId('login-guide')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connect-guide')).not.toBeInTheDocument();
  });

  it('sync button calls runtime handler on click', async () => {
    const handleSync = vi.fn();
    mockedUseRunsPageRuntime.mockReturnValue(
      createRuntime({
        user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
        connection: { connected: true, athleteName: 'John', lastSyncAt: null },
        handleSync,
      }),
    );

    const user = userEvent.setup();
    render(<RunsPage />);

    await user.click(screen.getByRole('button', { name: /同步/i }));

    expect(handleSync).toHaveBeenCalledTimes(1);
  });

  it('sync button is disabled during cooldown', () => {
    mockedUseRunsPageRuntime.mockReturnValue(
      createRuntime({
        user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
        connection: { connected: true, athleteName: 'John', lastSyncAt: null },
        cooldownRemaining: 45,
        syncButtonLabel: '冷卻中',
      }),
    );

    render(<RunsPage />);

    const syncButton = screen.getByRole('button', { name: '冷卻中' });
    expect(syncButton).toBeDisabled();
    expect(screen.getByText(/45 秒後可再同步/)).toBeInTheDocument();
  });

  it('opens calendar when clicking calendar button', async () => {
    const openCalendar = vi.fn();
    mockedUseRunsPageRuntime.mockReturnValue(
      createRuntime({
        user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
        connection: { connected: true, athleteName: 'John', lastSyncAt: null },
        openCalendar,
      }),
    );

    const user = userEvent.setup();
    render(<RunsPage />);

    await user.click(screen.getByRole('button', { name: '跑步月曆' }));

    expect(openCalendar).toHaveBeenCalledTimes(1);
  });

  it('shows disconnect button when connected', () => {
    mockedUseRunsPageRuntime.mockReturnValue(
      createRuntime({
        user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
        connection: { connected: true, athleteName: 'John', lastSyncAt: null },
      }),
    );

    render(<RunsPage />);

    expect(screen.getByRole('button', { name: '取消連結' })).toBeInTheDocument();
  });

  it('calls runtime disconnect handler on click', async () => {
    const handleDisconnect = vi.fn();
    mockedUseRunsPageRuntime.mockReturnValue(
      createRuntime({
        user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
        connection: { connected: true, athleteName: 'John', lastSyncAt: null },
        handleDisconnect,
      }),
    );

    const user = userEvent.setup();
    render(<RunsPage />);

    await user.click(screen.getByRole('button', { name: '取消連結' }));

    expect(handleDisconnect).toHaveBeenCalledTimes(1);
  });

  it('shows disconnecting state while runtime is disconnecting', () => {
    mockedUseRunsPageRuntime.mockReturnValue(
      createRuntime({
        user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
        connection: { connected: true, athleteName: 'John', lastSyncAt: null },
        isDisconnecting: true,
      }),
    );

    render(<RunsPage />);

    expect(screen.getByRole('button', { name: '取消連結中…' })).toBeDisabled();
  });
});
