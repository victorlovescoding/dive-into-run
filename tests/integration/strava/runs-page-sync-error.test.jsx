import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---- Provider / SDK boundary mocks --------------------------------------

const { mockAuthValue, mockShowToast } = vi.hoisted(() => ({
  mockAuthValue: { user: null, loading: false, setUser: () => {} },
  mockShowToast: { fn: null },
}));

vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  const ctx = createContext(mockAuthValue);
  return { AuthContext: ctx, default: ctx };
});

vi.mock('@/runtime/providers/AuthProvider', async () => {
  const { useContext } = await import('react');
  const { AuthContext } = await import('@/contexts/AuthContext');
  return {
    AuthContext,
    default: ({ children }) => children,
    useAuth: () => useContext(AuthContext),
  };
});

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast.fn || (() => {}) }),
  default: ({ children }) => children,
}));

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
import RunsPage from '@/app/runs/page';

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

describe('RunsPage sync error handling', () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let fetchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthValue.user = mockUser;
    mockAuthValue.loading = false;

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
    mockShowToast.fn = vi.fn();
  });

  it('should display sync error message when sync fetch returns ok=false', async () => {
    // /api/strava/sync returns ok:false with custom error → useStravaSync.error 設為訊息
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({ error: '同步失敗，請稍後再試' }),
    });

    const user = userEvent.setup();
    render(<RunsPage />);

    const syncBtn = await screen.findByRole('button', { name: /同步/i });
    await user.click(syncBtn);

    await waitFor(() => {
      expect(screen.getByText('同步失敗，請稍後再試')).toBeInTheDocument();
    });
  });

  it('should still display cached activities when sync fails', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({ error: '同步失敗，請稍後再試' }),
    });

    const user = userEvent.setup();
    render(<RunsPage />);

    // cached activities render once getDocs resolves
    await waitFor(() => {
      expect(screen.getByText('晨跑 5K')).toBeInTheDocument();
    });
    expect(screen.getByText('河濱慢跑')).toBeInTheDocument();

    const syncBtn = await screen.findByRole('button', { name: /同步/i });
    await user.click(syncBtn);

    await waitFor(() => {
      expect(screen.getByText('同步失敗，請稍後再試')).toBeInTheDocument();
    });
    // 失敗後 cached activities 仍存在
    expect(screen.getByText('晨跑 5K')).toBeInTheDocument();
    expect(screen.getByText('河濱慢跑')).toBeInTheDocument();
  });

  it('should not display sync error when sync succeeds', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({}) });

    const user = userEvent.setup();
    render(<RunsPage />);

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
