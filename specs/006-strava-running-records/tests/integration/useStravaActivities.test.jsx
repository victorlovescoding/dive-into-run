import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from '@/contexts/AuthContext';

vi.mock('@/lib/firebase-client', () => ({ db: {} }));
vi.mock('@/lib/firebase-strava', () => ({
  getStravaActivities: vi.fn(),
}));

import { getStravaActivities } from '@/lib/firebase-strava';
import useStravaActivities from '@/hooks/useStravaActivities';

const mockedGetActivities = /** @type {import('vitest').Mock} */ (getStravaActivities);

/**
 *
 */
function TestComponent() {
  const { activities, isLoading, error, loadMore, hasMore, isLoadingMore, refresh } =
    useStravaActivities();
  if (isLoading) return <div role="status">Loading</div>;
  if (error) return <div role="alert">{error}</div>;
  return (
    <div>
      <ul>
        {activities.map((a) => (
          <li key={a.stravaId}>{a.name}</li>
        ))}
      </ul>
      {isLoadingMore && <div data-testid="loading-more">載入更多中</div>}
      <div data-testid="has-more">{hasMore ? 'true' : 'false'}</div>
      <button type="button" onClick={loadMore}>
        Load More
      </button>
      <button type="button" onClick={refresh}>
        Refresh
      </button>
    </div>
  );
}

/**
 * 使用 AuthContext 包裹 TestComponent。
 * @param {{ uid: string, name: string | null, email: string | null, photoURL: string | null } | null} user - 測試用使用者物件。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderWithAuth(user = null) {
  return render(
    <AuthContext.Provider value={{ user, setUser: () => {}, loading: false }}>
      <TestComponent />
    </AuthContext.Provider>,
  );
}

describe('useStravaActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading then displays activities', async () => {
    mockedGetActivities.mockResolvedValue({
      activities: [
        { id: 'doc1', stravaId: 12345, name: '晨跑', uid: 'u1' },
        { id: 'doc2', stravaId: 67890, name: '夜跑', uid: 'u1' },
      ],
      lastDoc: null,
    });

    renderWithAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    expect(screen.getByRole('status')).toHaveTextContent('Loading');

    await waitFor(() => {
      expect(screen.getByText('晨跑')).toBeInTheDocument();
    });
    expect(screen.getByText('夜跑')).toBeInTheDocument();
    expect(mockedGetActivities).toHaveBeenCalledWith('u1', 10);
  });

  it('shows empty list when user not logged in', async () => {
    renderWithAuth(null);

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(mockedGetActivities).not.toHaveBeenCalled();
  });

  it('shows empty list when no activities returned', async () => {
    mockedGetActivities.mockResolvedValue({
      activities: [],
      lastDoc: null,
    });

    renderWithAuth({ uid: 'u2', name: 'Empty', email: null, photoURL: null });

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows error when query fails', async () => {
    mockedGetActivities.mockRejectedValue(new Error('Firestore error'));

    renderWithAuth({ uid: 'u3', name: 'Error', email: null, photoURL: null });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('活動載入失敗');
  });

  it('stores lastDoc from initial load for pagination cursor', async () => {
    const fakeCursor = { id: 'cursor1' };
    const tenActivities = Array.from({ length: 10 }, (_, i) => ({
      id: `doc${i}`,
      stravaId: i + 1,
      name: `Run ${i + 1}`,
      uid: 'u1',
    }));
    mockedGetActivities.mockResolvedValue({
      activities: tenActivities,
      lastDoc: fakeCursor,
    });

    renderWithAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    await waitFor(() => {
      expect(screen.getByText('Run 1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('has-more')).toHaveTextContent('true');
  });

  it('sets hasMore to false when lastDoc is null', async () => {
    mockedGetActivities.mockResolvedValue({
      activities: [{ id: 'doc1', stravaId: 1, name: 'Run 1', uid: 'u1' }],
      lastDoc: null,
    });

    renderWithAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    await waitFor(() => {
      expect(screen.getByText('Run 1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('has-more')).toHaveTextContent('false');
  });

  it('loadMore appends activities to existing list', async () => {
    const user = userEvent.setup();
    const fakeCursor = { id: 'cursor1' };

    mockedGetActivities.mockResolvedValueOnce({
      activities: [{ id: 'doc1', stravaId: 1, name: 'Run 1', uid: 'u1' }],
      lastDoc: fakeCursor,
    });

    renderWithAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    await waitFor(() => {
      expect(screen.getByText('Run 1')).toBeInTheDocument();
    });

    mockedGetActivities.mockResolvedValueOnce({
      activities: [{ id: 'doc2', stravaId: 2, name: 'Run 2', uid: 'u1' }],
      lastDoc: null,
    });

    await user.click(screen.getByRole('button', { name: 'Load More' }));

    await waitFor(() => {
      expect(screen.getByText('Run 2')).toBeInTheDocument();
    });

    expect(screen.getByText('Run 1')).toBeInTheDocument();
    expect(mockedGetActivities).toHaveBeenCalledWith('u1', 10, fakeCursor);
  });

  it('isLoadingMore is true during loadMore, false after', async () => {
    const user = userEvent.setup();
    const fakeCursor = { id: 'cursor1' };
    /** @type {(value: any) => void} */
    let resolveLoadMore;

    mockedGetActivities.mockResolvedValueOnce({
      activities: [{ id: 'doc1', stravaId: 1, name: 'Run 1', uid: 'u1' }],
      lastDoc: fakeCursor,
    });

    renderWithAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    await waitFor(() => {
      expect(screen.getByText('Run 1')).toBeInTheDocument();
    });

    mockedGetActivities.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLoadMore = resolve;
        }),
    );

    await user.click(screen.getByRole('button', { name: 'Load More' }));

    await waitFor(() => {
      expect(screen.getByTestId('loading-more')).toBeInTheDocument();
    });

    resolveLoadMore({
      activities: [{ id: 'doc2', stravaId: 2, name: 'Run 2', uid: 'u1' }],
      lastDoc: null,
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loading-more')).not.toBeInTheDocument();
    });
  });

  it('refresh re-fetches activities from scratch', async () => {
    const user = userEvent.setup();

    mockedGetActivities.mockResolvedValueOnce({
      activities: [{ id: 'doc1', stravaId: 1, name: 'Run 1', uid: 'u1' }],
      lastDoc: null,
    });

    renderWithAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    await waitFor(() => {
      expect(screen.getByText('Run 1')).toBeInTheDocument();
    });

    mockedGetActivities.mockResolvedValueOnce({
      activities: [
        { id: 'doc1', stravaId: 1, name: 'Run 1', uid: 'u1' },
        { id: 'doc2', stravaId: 2, name: 'Run 2', uid: 'u1' },
      ],
      lastDoc: null,
    });

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(screen.getByText('Run 2')).toBeInTheDocument();
    });

    expect(screen.getByText('Run 1')).toBeInTheDocument();
    // Initial fetch + refresh fetch, both without cursor
    expect(mockedGetActivities).toHaveBeenCalledTimes(2);
    expect(mockedGetActivities).toHaveBeenLastCalledWith('u1', 10);
  });

  it('loadMore guards against concurrent calls', async () => {
    const user = userEvent.setup();
    const fakeCursor = { id: 'cursor1' };
    /** @type {(value: any) => void} */
    let resolveLoadMore;

    mockedGetActivities.mockResolvedValueOnce({
      activities: [{ id: 'doc1', stravaId: 1, name: 'Run 1', uid: 'u1' }],
      lastDoc: fakeCursor,
    });

    renderWithAuth({ uid: 'u1', name: 'Test', email: null, photoURL: null });

    await waitFor(() => {
      expect(screen.getByText('Run 1')).toBeInTheDocument();
    });

    mockedGetActivities.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLoadMore = resolve;
        }),
    );

    await user.click(screen.getByRole('button', { name: 'Load More' }));

    await waitFor(() => {
      expect(screen.getByTestId('loading-more')).toBeInTheDocument();
    });

    // Second click while still loading - should not trigger another call
    await user.click(screen.getByRole('button', { name: 'Load More' }));

    // Only initial + one loadMore call (not two loadMore calls)
    expect(mockedGetActivities).toHaveBeenCalledTimes(2);

    resolveLoadMore({
      activities: [{ id: 'doc2', stravaId: 2, name: 'Run 2', uid: 'u1' }],
      lastDoc: null,
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loading-more')).not.toBeInTheDocument();
    });
  });
});
