import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/RunsActivityCard', () => ({
  default: ({ activity }) => <div data-testid={`card-${activity.stravaId}`}>{activity.name}</div>,
}));

import RunsActivityList from '@/components/RunsActivityList';

/**
 * 建立 mock StravaActivity 物件。
 * @param {object} [overrides] - 覆寫屬性。
 * @returns {object} mock activity。
 */
function createMockActivity(overrides = {}) {
  return {
    id: 'act-1',
    uid: 'user-1',
    stravaId: 12345,
    name: '晨跑',
    type: 'Run',
    distanceMeters: 5200,
    movingTimeSec: 1710,
    startDate: { toDate: () => new Date('2026-04-01T06:00:00') },
    startDateLocal: '2026-04-01T06:00:00',
    summaryPolyline: 'encoded',
    averageSpeed: 3.04,
    syncedAt: { toDate: () => new Date('2026-04-01T12:00:00') },
    ...overrides,
  };
}

describe('RunsActivityList', () => {
  it('shows loading skeleton when isLoading is true', () => {
    render(<RunsActivityList activities={[]} isLoading error={null} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('載入中…')).toBeInTheDocument();
  });

  it('shows error message when error is provided', () => {
    render(<RunsActivityList activities={[]} isLoading={false} error="無法載入活動資料" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('無法載入活動資料')).toBeInTheDocument();
  });

  it('shows empty state message when activities is empty array', () => {
    render(<RunsActivityList activities={[]} isLoading={false} error={null} />);

    expect(screen.getByText('目前沒有跑步紀錄，去跑一趟吧！')).toBeInTheDocument();
  });

  it('renders RunsActivityCard for each activity', () => {
    const activities = [
      createMockActivity({ stravaId: 111, name: '晨跑' }),
      createMockActivity({ stravaId: 222, name: '夜跑', id: 'act-2' }),
    ];

    render(<RunsActivityList activities={activities} isLoading={false} error={null} />);

    expect(screen.getByTestId('card-111')).toBeInTheDocument();
    expect(screen.getByTestId('card-222')).toBeInTheDocument();
    expect(screen.getByText('晨跑')).toBeInTheDocument();
    expect(screen.getByText('夜跑')).toBeInTheDocument();
  });

  describe('infinite scroll', () => {
    /** @type {((entries: IntersectionObserverEntry[]) => void) | null} */
    let intersectionCallback;

    beforeEach(() => {
      intersectionCallback = null;
      vi.stubGlobal(
        'IntersectionObserver',
        vi.fn((/** @type {(entries: IntersectionObserverEntry[]) => void} */ callback) => {
          intersectionCallback = callback;
          return {
            observe: vi.fn(),
            disconnect: vi.fn(),
            unobserve: vi.fn(),
          };
        }),
      );
    });

    it('renders sentinel div when hasMore is true', () => {
      const activities = [createMockActivity()];

      render(
        <RunsActivityList
          activities={activities}
          isLoading={false}
          error={null}
          hasMore
          loadMore={vi.fn()}
        />,
      );

      expect(screen.getByTestId('sentinel')).toBeInTheDocument();
    });

    it('calls loadMore when IntersectionObserver fires', () => {
      const loadMore = vi.fn();
      const activities = [createMockActivity()];

      render(
        <RunsActivityList
          activities={activities}
          isLoading={false}
          error={null}
          hasMore
          loadMore={loadMore}
        />,
      );

      intersectionCallback([/** @type {IntersectionObserverEntry} */ ({ isIntersecting: true })]);

      expect(loadMore).toHaveBeenCalledTimes(1);
    });

    it('shows loading spinner when isLoadingMore is true', () => {
      const activities = [createMockActivity()];

      render(
        <RunsActivityList
          activities={activities}
          isLoading={false}
          error={null}
          hasMore
          loadMore={vi.fn()}
          isLoadingMore
        />,
      );

      expect(screen.getByText('載入中...')).toBeInTheDocument();
    });

    it('shows "已載入全部紀錄" when hasMore is false and activities exist', () => {
      const activities = [createMockActivity()];

      render(
        <RunsActivityList activities={activities} isLoading={false} error={null} hasMore={false} />,
      );

      expect(screen.getByText('已載入全部紀錄')).toBeInTheDocument();
    });

    it('does not show "已載入全部紀錄" when hasMore is false and activities is empty', () => {
      render(<RunsActivityList activities={[]} isLoading={false} error={null} hasMore={false} />);

      expect(screen.queryByText('已載入全部紀錄')).not.toBeInTheDocument();
    });
  });
});
