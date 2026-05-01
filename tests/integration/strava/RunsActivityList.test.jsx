import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RunsActivityList from '@/components/RunsActivityList';
import { createStravaFirestoreActivity } from '../../_helpers/strava-fixtures';

vi.mock('@/components/RunsActivityCard', () => ({
  default: ({ activity }) => <article aria-label={activity.name}>{activity.name}</article>,
}));

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
      createStravaFirestoreActivity({ stravaId: 111, name: '晨跑' }),
      createStravaFirestoreActivity({ stravaId: 222, name: '夜跑', id: 'act-2' }),
    ];

    render(<RunsActivityList activities={activities} isLoading={false} error={null} />);

    expect(screen.getByRole('article', { name: '晨跑' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: '夜跑' })).toBeInTheDocument();
  });

  describe('infinite scroll', () => {
    /** @type {((entries: IntersectionObserverEntry[]) => void) | null} */
    let intersectionCallback;

    beforeEach(() => {
      intersectionCallback = null;
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          /** @param {(entries: IntersectionObserverEntry[]) => void} callback - intersection observer callback。 */
          constructor(callback) {
            intersectionCallback = callback;
          }
          observe = vi.fn();
          disconnect = vi.fn();
          unobserve = vi.fn();
        },
      );
    });

    it('renders sentinel div when hasMore is true', () => {
      const activities = [createStravaFirestoreActivity()];

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
      const activities = [createStravaFirestoreActivity()];

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

      expect(loadMore).toHaveBeenCalled();
    });

    it('shows loading spinner when isLoadingMore is true', () => {
      const activities = [createStravaFirestoreActivity()];

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
      const activities = [createStravaFirestoreActivity()];

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
