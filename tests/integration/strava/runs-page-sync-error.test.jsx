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

// 灰區 component leaf mocks（Leaflet / dialog 在 jsdom 不可渲染）
vi.mock('@/components/RunsLoginGuide', () => ({
  default: () => <section aria-label="登入提示">請先登入</section>,
}));
vi.mock('@/components/RunsConnectGuide', () => ({
  default: () => <section aria-label="Strava 連結提示">連結 Strava</section>,
}));
vi.mock('@/components/RunsActivityList', () => ({
  default: ({ activities }) => (
    <ul aria-label="活動列表">
      {activities.map((activity) => (
        <li key={activity.id}>{activity.name}</li>
      ))}
    </ul>
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

const mockUser = {
  uid: 'u1',
  name: 'Test',
  email: null,
  photoURL: null,
  bio: null,
  getIdToken: vi.fn().mockResolvedValue('id-token-1'),
};

const cachedActivities = [
  { id: 'a1', stravaId: 100, name: '晨跑 5K' },
  { id: 'a2', stravaId: 101, name: '河濱慢跑' },
];

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

describe('RunsPage sync error handling', () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let fetchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    setAuth({ user: mockUser, loading: false });

    // connection: connected athlete
    mockedOnSnapshot.mockImplementation((_docRef, onNext) => {
      queueMicrotask(() =>
        onNext({
          exists: () => true,
          data: () => ({ connected: true, athleteName: 'John Runner', lastSyncAt: null }),
        }),
      );
      return () => {};
    });

    // activities: cached list
    mockedGetDocs.mockResolvedValue({
      docs: cachedActivities.map((a) => ({ id: a.id, data: () => ({ ...a }) })),
    });

    fetchSpy = vi.fn();
    globalThis.fetch = /** @type {typeof globalThis.fetch} */ (/** @type {unknown} */ (fetchSpy));
    mockShowToast = /** @type {typeof mockShowToast} */ (vi.fn());
  });

  it('should display sync error message when sync fetch returns ok=false', async () => {
    // /api/strava/sync returns ok:false with custom error → useStravaSync.error 設為訊息
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({ error: '同步失敗，請稍後再試' }),
    });

    const user = userEvent.setup();
    renderRunsPage();

    const syncBtn = await screen.findByRole('button', { name: /同步/i });
    await user.click(syncBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('同步失敗，請稍後再試');
    });
  });

  it('should still display cached activities when sync fails', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({ error: '同步失敗，請稍後再試' }),
    });

    const user = userEvent.setup();
    renderRunsPage();

    // cached activities render once getDocs resolves
    await waitFor(() => {
      expect(screen.getByText('晨跑 5K')).toBeInTheDocument();
    });
    expect(screen.getByText('河濱慢跑')).toBeInTheDocument();

    const syncBtn = await screen.findByRole('button', { name: /同步/i });
    await user.click(syncBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('同步失敗，請稍後再試');
    });
    // 失敗後 cached activities 仍存在
    expect(screen.getByText('晨跑 5K')).toBeInTheDocument();
    expect(screen.getByText('河濱慢跑')).toBeInTheDocument();
  });

  it('should not display sync error when sync succeeds', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({}) });

    const user = userEvent.setup();
    renderRunsPage();

    const syncBtn = await screen.findByRole('button', { name: /同步/i });
    await user.click(syncBtn);

    // 等待 sync 完成（getDocs 會被 refresh 再次呼叫）
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/strava/sync', expect.any(Object));
    });

    expect(screen.queryByText('同步失敗，請稍後再試')).not.toBeInTheDocument();
    expect(screen.queryByText(/同步失敗/)).not.toBeInTheDocument();
  });
});
