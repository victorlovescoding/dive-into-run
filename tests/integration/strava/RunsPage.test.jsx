import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---- SDK boundary mocks --------------------------------------------------

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  doc: vi.fn((base, ...segments) => ({
    type: 'doc',
    path: base?.path ? [base.path, ...segments].join('/') : segments.join('/'),
  })),
  query: vi.fn((collRef, ...constraints) => ({
    type: 'query',
    path: collRef?.path,
    constraints,
  })),
  where: vi.fn((field, op, value) => ({ __type: 'where', field, op, value })),
  orderBy: vi.fn((field, dir) => ({ __type: 'orderBy', field, dir })),
  limit: vi.fn((n) => ({ __type: 'limit', n })),
  startAfter: vi.fn((cursor) => ({ __type: 'startAfter', cursor })),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
}));

// ---- Component (灰區) leaf mocks，保留以隔離 leaflet / dialog -----------

vi.mock('@/components/RunsLoginGuide', () => ({
  default: () => <section aria-label="登入提示">請先登入</section>,
}));
vi.mock('@/components/RunsConnectGuide', () => ({
  default: () => <section aria-label="Strava 連結提示">連結 Strava</section>,
}));
vi.mock('@/components/RunsActivityList', () => ({
  default: ({ activities, isLoading, loadMore, hasMore, isLoadingMore }) => (
    <section aria-label="活動列表">
      {isLoading ? 'loading' : `${activities.length} activities`}
      {loadMore && <span>load more available</span>}
      {typeof hasMore === 'boolean' && <span>has more flag provided</span>}
      {typeof isLoadingMore === 'boolean' && <span>loading more flag provided</span>}
    </section>
  ),
}));
vi.mock('@/components/RunCalendarDialog', () => ({
  default: ({ open }) => (open ? <div role="dialog">calendar open</div> : null),
}));

import { onSnapshot, getDocs } from 'firebase/firestore';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import RunsPage from '@/app/runs/page';
import { renderWithAuthToast } from '../../_helpers/provider-test-helpers';

const mockedOnSnapshot = /** @type {import('vitest').Mock} */ (onSnapshot);
const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);

/**
 * 預設 onSnapshot stub：emit null connection 立刻，回 unsubscribe fn。
 * 後續測試可用 mockImplementation 覆寫以 emit 不同 connection doc。
 * @returns {void}
 */
function setupDefaultOnSnapshot() {
  mockedOnSnapshot.mockImplementation((_docRef, onNext) => {
    // emit null (no connection)
    queueMicrotask(() => onNext({ exists: () => false, data: () => null }));
    return () => {};
  });
}

/**
 * @param {{connected: boolean, athleteName: string, lastSyncAt: {toDate: () => Date} | null}} connection
 *   - connection doc payload。
 * @returns {void}
 */
function setupOnSnapshotConnected(connection) {
  mockedOnSnapshot.mockImplementation((_docRef, onNext) => {
    queueMicrotask(() => onNext({ exists: () => true, data: () => connection }));
    return () => {};
  });
}

/**
 * @param {Array<{id: string, [k: string]: unknown}>} activities - Activity rows。
 * @returns {void}
 */
function setupGetDocsActivities(activities) {
  mockedGetDocs.mockResolvedValue({
    docs: activities.map((a) => ({
      id: a.id,
      data: () => ({ ...a }),
    })),
  });
}

const mockUser = {
  uid: 'u1',
  name: 'Test',
  email: null,
  photoURL: null,
  bio: null,
  getIdToken: vi.fn().mockResolvedValue('id-token-1'),
};

/** @type {{user: object | null, loading: boolean}} */
let authValue;
/** @type {(message: string, type?: string, duration?: number) => unknown} */
let mockShowToast;

/**
 * 設定 AuthContext value。
 * @param {{user: object | null, loading: boolean}} value - Auth 值。
 * @returns {void}
 */
function setAuth(value) {
  authValue = value;
}

/**
 * 使用真實 AuthContext.Provider / ToastContext.Provider render runs page。
 * @returns {ReturnType<typeof renderWithAuthToast>} render 結果與 context spies。
 */
function renderRunsPage() {
  return renderWithAuthToast(<RunsPage />, {
    authContext: AuthContext,
    toastContext: ToastContext,
    auth: authValue,
    toast: {
      showToast: mockShowToast,
    },
  });
}

describe('RunsPage', () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let fetchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    setAuth({ user: null, loading: false });
    setupDefaultOnSnapshot();
    setupGetDocsActivities([]);
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    globalThis.fetch = /** @type {typeof globalThis.fetch} */ (/** @type {unknown} */ (fetchSpy));
    mockShowToast = /** @type {typeof mockShowToast} */ (vi.fn());
  });

  it('shows loading skeleton when auth is loading', () => {
    setAuth({ user: null, loading: true });

    renderRunsPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('請先登入')).not.toBeInTheDocument();
    expect(screen.queryByText('連結 Strava')).not.toBeInTheDocument();
  });

  it('shows RunsLoginGuide when user is not logged in', () => {
    setAuth({ user: null, loading: false });

    renderRunsPage();

    expect(screen.getByText('請先登入')).toBeInTheDocument();
    expect(screen.queryByText('連結 Strava')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '活動列表' })).not.toBeInTheDocument();
  });

  it('shows RunsConnectGuide when user is logged in but not connected', async () => {
    setAuth({ user: mockUser, loading: false });
    // default onSnapshot emits null connection

    renderRunsPage();

    await waitFor(() => {
      expect(screen.getByText('連結 Strava')).toBeInTheDocument();
    });
    expect(screen.queryByText('請先登入')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '活動列表' })).not.toBeInTheDocument();
  });

  it('shows athlete name and activity list when connected', async () => {
    setAuth({ user: mockUser, loading: false });
    setupOnSnapshotConnected({
      connected: true,
      athleteName: 'John Runner',
      lastSyncAt: null,
    });
    setupGetDocsActivities([{ id: '1' }, { id: '2' }]);

    renderRunsPage();

    await waitFor(() => {
      expect(screen.getByText('John Runner')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('region', { name: '活動列表' })).toHaveTextContent('2 activities');
    });
    expect(screen.queryByText('請先登入')).not.toBeInTheDocument();
    expect(screen.queryByText('連結 Strava')).not.toBeInTheDocument();
  });

  it('sync button calls fetch /api/strava/sync on click', async () => {
    setAuth({ user: mockUser, loading: false });
    setupOnSnapshotConnected({
      connected: true,
      athleteName: 'John',
      lastSyncAt: null,
    });

    const user = userEvent.setup();
    renderRunsPage();

    const syncBtn = await screen.findByRole('button', { name: /同步/i });
    await user.click(syncBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/strava/sync',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer id-token-1' }),
        }),
      );
    });
  });

  it('sync button is disabled during cooldown', async () => {
    setAuth({ user: mockUser, loading: false });
    // lastSyncAt = now - 255s → 300 - 255 = 45s remaining
    const lastSyncAt = { toDate: () => new Date(Date.now() - 255_000) };
    setupOnSnapshotConnected({
      connected: true,
      athleteName: 'John',
      lastSyncAt,
    });

    renderRunsPage();

    const syncButton = await screen.findByRole('button', { name: '冷卻中' });
    expect(syncButton).toBeDisabled();
    expect(screen.getByText(/秒後可再同步/)).toBeInTheDocument();
  });

  it('opens calendar when clicking calendar button', async () => {
    setAuth({ user: mockUser, loading: false });
    setupOnSnapshotConnected({
      connected: true,
      athleteName: 'John',
      lastSyncAt: null,
    });

    const user = userEvent.setup();
    renderRunsPage();

    const calBtn = await screen.findByRole('button', { name: '跑步月曆' });
    await user.click(calBtn);

    expect(screen.getByRole('dialog')).toHaveTextContent('calendar open');
  });

  it('shows disconnect button when connected', async () => {
    setAuth({ user: mockUser, loading: false });
    setupOnSnapshotConnected({
      connected: true,
      athleteName: 'John',
      lastSyncAt: null,
    });

    renderRunsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '取消連結' })).toBeInTheDocument();
    });
  });

  it('calls fetch /api/strava/disconnect when clicking disconnect button', async () => {
    setAuth({ user: mockUser, loading: false });
    setupOnSnapshotConnected({
      connected: true,
      athleteName: 'John',
      lastSyncAt: null,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderRunsPage();

    const disconnectBtn = await screen.findByRole('button', { name: '取消連結' });
    await user.click(disconnectBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/strava/disconnect',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer id-token-1' }),
        }),
      );
    });
  });

  it('shows error toast when disconnect fetch fails', async () => {
    setAuth({ user: mockUser, loading: false });
    setupOnSnapshotConnected({
      connected: true,
      athleteName: 'John',
      lastSyncAt: null,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const user = userEvent.setup();
    const { toastValue } = renderRunsPage();

    const disconnectBtn = await screen.findByRole('button', { name: '取消連結' });
    await user.click(disconnectBtn);

    await waitFor(() => {
      expect(toastValue.showToast).toHaveBeenCalledWith('取消連結失敗，請稍後再試', 'error');
    });
  });

  it('shows disconnecting state while disconnect fetch is pending', async () => {
    setAuth({ user: mockUser, loading: false });
    setupOnSnapshotConnected({
      connected: true,
      athleteName: 'John',
      lastSyncAt: null,
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // fetch never resolves → isDisconnecting stays true
    fetchSpy.mockImplementation((url) => {
      if (url === '/api/strava/disconnect') {
        return new Promise(() => {});
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const user = userEvent.setup();
    renderRunsPage();

    const disconnectBtn = await screen.findByRole('button', { name: '取消連結' });
    await user.click(disconnectBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '取消連結中…' })).toBeDisabled();
    });
  });
});
