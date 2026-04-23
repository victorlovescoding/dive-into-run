import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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
  default: ({ activities }) => (
    <ul data-testid="activity-list">
      {activities.map((activity) => (
        <li key={activity.stravaId}>{activity.name}</li>
      ))}
    </ul>
  ),
}));
vi.mock('@/components/RunCalendarDialog', () => ({
  default: ({ open }) => (open ? <div data-testid="calendar-dialog">calendar open</div> : null),
}));

import useRunsPageRuntime from '@/runtime/hooks/useRunsPageRuntime';
import RunsPage from '@/app/runs/page';

const mockedUseRunsPageRuntime = /** @type {import('vitest').Mock} */ (useRunsPageRuntime);

/** @type {{ stravaId: string, name: string, distance: number }[]} */
const mockActivities = [
  { stravaId: '100', name: '晨跑 5K', distance: 5000 },
  { stravaId: '101', name: '河濱慢跑', distance: 8000 },
];

/**
 * @typedef {object} RunsPageRuntimeMock
 * @property {boolean} authLoading - 是否為 auth 載入狀態。
 * @property {object | null} user - 當前登入使用者。
 * @property {object | null} connection - Strava 連線狀態。
 * @property {Array<{ stravaId: string, name: string, distance: number }>} activities - 跑步活動列表。
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
    user: { uid: 'u1', name: 'Test', email: null, photoURL: null },
    connection: { connected: true, athleteName: 'John Runner', lastSyncAt: null },
    activities: mockActivities,
    activitiesLoading: false,
    activitiesError: null,
    loadMore: vi.fn(),
    hasMore: false,
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

describe('RunsPage sync error handling', () => {
  beforeEach(() => {
    mockedUseRunsPageRuntime.mockReturnValue(createRuntime());
  });

  it('should display sync error message when sync fails', () => {
    mockedUseRunsPageRuntime.mockReturnValue(createRuntime({ syncError: '同步失敗，請稍後再試' }));

    render(<RunsPage />);

    expect(screen.getByText('同步失敗，請稍後再試')).toBeInTheDocument();
  });

  it('should still display cached activities when sync fails', () => {
    mockedUseRunsPageRuntime.mockReturnValue(createRuntime({ syncError: '同步失敗，請稍後再試' }));

    render(<RunsPage />);

    expect(screen.getByText('晨跑 5K')).toBeInTheDocument();
    expect(screen.getByText('河濱慢跑')).toBeInTheDocument();
    expect(screen.getByText('同步失敗，請稍後再試')).toBeInTheDocument();
  });

  it('should not display sync error when sync succeeds', () => {
    render(<RunsPage />);

    expect(screen.queryByText('同步失敗，請稍後再試')).not.toBeInTheDocument();
    expect(screen.queryByText(/同步失敗/)).not.toBeInTheDocument();
  });
});
