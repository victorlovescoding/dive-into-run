import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useRunsPageRuntime from '@/runtime/hooks/useRunsPageRuntime';

const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const { authState, mockShowToast, mockUseContext, runsPageBoundaryMocks } =
  vi.hoisted(() => ({
    authState: {
      current: { user: null, loading: false, setUser() {} },
    },
    mockShowToast: vi.fn(),
    mockUseContext: vi.fn(),
    runsPageBoundaryMocks: {
    mockDoc: vi.fn((_db, ...segments) => ({
      type: 'doc',
      path: segments.join('/'),
      id: String(segments.at(-1) ?? ''),
    })),
    mockCollection: vi.fn((_db, ...segments) => ({
      type: 'collection',
      path: segments.join('/'),
    })),
    mockOnSnapshot: vi.fn(),
    mockQuery: vi.fn((collectionRef, ...constraints) => ({
      type: 'query',
      path: collectionRef?.path,
      constraints,
    })),
    mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
    mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
    mockLimit: vi.fn((count) => ({ type: 'limit', count })),
    mockStartAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
    mockGetDocs: vi.fn(),
    mockTimestampFromDate: vi.fn((date) => ({ toDate: () => date })),
    mockFetch: vi.fn(),
    },
  }));

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());
  mockUseContext.mockImplementation(() => authState.current);
  return {
    ...actual,
    useContext: mockUseContext,
  };
});
vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('firebase/firestore', () => ({
  doc: runsPageBoundaryMocks.mockDoc,
  collection: runsPageBoundaryMocks.mockCollection,
  onSnapshot: runsPageBoundaryMocks.mockOnSnapshot,
  query: runsPageBoundaryMocks.mockQuery,
  where: runsPageBoundaryMocks.mockWhere,
  orderBy: runsPageBoundaryMocks.mockOrderBy,
  limit: runsPageBoundaryMocks.mockLimit,
  startAfter: runsPageBoundaryMocks.mockStartAfter,
  getDocs: runsPageBoundaryMocks.mockGetDocs,
  Timestamp: {
    fromDate: runsPageBoundaryMocks.mockTimestampFromDate,
  },
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

/**
 * @typedef {object} TestUser
 * @property {string} uid - 使用者 UID。
 * @property {string | null} name - 顯示名稱。
 * @property {string | null} email - 電子郵件。
 * @property {string | null} photoURL - 頭像網址。
 * @property {string | null} bio - 自我介紹。
 * @property {() => Promise<string>} getIdToken - 取得 Firebase ID token。
 */

/**
 * 建立測試用 user fixture。
 * @param {Partial<TestUser>} [overrides] - 欄位覆寫。
 * @returns {TestUser} 使用者資料。
 */
function createUser(overrides = {}) {
  return {
    uid: 'u1',
    name: 'Runner',
    email: 'runner@example.com',
    photoURL: null,
    bio: null,
    getIdToken: vi.fn(async () => 'token-1'),
    ...overrides,
  };
}

/**
 * 建立 Strava 活動 snapshot。
 * @param {string} id - 文件 id。
 * @param {string} name - 活動名稱。
 * @returns {{ id: string, data: () => object }} snapshot。
 */
function createActivityDoc(id, name) {
  return {
    id,
    data: () => ({ uid: 'u1', stravaId: Number(id), name }),
  };
}

/**
 * 建立 lastSyncAt timestamp-like 物件。
 * @param {Date} date - 上次同步時間。
 * @returns {{ toDate: () => Date }} timestamp-like。
 */
function createTimestamp(date) {
  return { toDate: () => date };
}

/**
 * 安裝可手動 emit 的 connection listener mock。
 * @returns {{ emit: (data: object | null) => void, unsubscribe: import('vitest').Mock }} listener 控制器。
 */
function installConnectionListener() {
  const unsubscribe = vi.fn();
  const controller = {
    emit(_data) {},
    unsubscribe,
  };
  runsPageBoundaryMocks.mockOnSnapshot.mockImplementation((_ref, onNext, onError) => {
    controller.emit = (data) => {
      if (data) {
        onNext({ exists: () => true, data: () => data });
        return;
      }
      onNext({ exists: () => false });
    };
    return onError ? unsubscribe : unsubscribe;
  });
  return controller;
}

/**
 * 渲染 runtime hook，並允許切換 auth 狀態。
 * @param {{ user?: TestUser | null, loading?: boolean }} [initialAuth] - 初始 auth 狀態。
 * @returns {object} render 結果與 setAuth helper。
 */
function renderRuntime(initialAuth = {}) {
  authState.current = {
    user: initialAuth.user === undefined ? createUser() : initialAuth.user,
    loading: initialAuth.loading ?? false,
    setUser() {},
  };
  const view = renderHook(() => useRunsPageRuntime());
  return {
    ...view,
    showToast: mockShowToast,
    setAuth(nextAuth) {
      authState.current = {
        user: nextAuth.user === undefined ? authState.current.user : nextAuth.user,
        loading: nextAuth.loading ?? false,
        setUser() {},
      };
      view.rerender();
    },
  };
}

describe('useRunsPageRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockReset();
    vi.stubGlobal('fetch', runsPageBoundaryMocks.mockFetch);
    runsPageBoundaryMocks.mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('composes connection + activities and refreshes after successful sync', async () => {
    const listener = installConnectionListener();
    runsPageBoundaryMocks.mockGetDocs
      .mockResolvedValueOnce({ docs: [createActivityDoc('1', 'Morning Run')] })
      .mockResolvedValueOnce({ docs: [createActivityDoc('1', 'Morning Run')] })
      .mockResolvedValueOnce({
        docs: [createActivityDoc('1', 'Morning Run'), createActivityDoc('2', 'Recovery Jog')],
      });
    runsPageBoundaryMocks.mockFetch.mockResolvedValueOnce({ ok: true });
    const view = renderRuntime();

    await waitFor(() => expect(runsPageBoundaryMocks.mockOnSnapshot).toHaveBeenCalled());
    act(() => {
      listener.emit({ connected: true, athleteName: 'John Runner', lastSyncAt: null });
    });
    await waitFor(() => expect(view.result.current.activities).toHaveLength(1));

    expect(view.result.current.connection?.athleteName).toBe('John Runner');
    expect(view.result.current.syncButtonLabel).toBe('同步');

    await act(async () => {
      await view.result.current.handleSync();
    });
    await waitFor(() => expect(view.result.current.activities).toHaveLength(2));

    expect(runsPageBoundaryMocks.mockFetch).toHaveBeenLastCalledWith('/api/strava/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-1' },
    });
    expect(view.result.current.activities.map((activity) => activity.name)).toEqual([
      'Morning Run',
      'Recovery Jog',
    ]);
    expect(view.result.current.syncError).toBeNull();
  });

  it('refreshes activities and flips sync button to cooldown when lastSyncAt changes', async () => {
    const listener = installConnectionListener();
    runsPageBoundaryMocks.mockGetDocs
      .mockResolvedValueOnce({ docs: [createActivityDoc('1', 'Morning Run')] })
      .mockResolvedValueOnce({ docs: [createActivityDoc('1', 'Morning Run')] })
      .mockResolvedValueOnce({
        docs: [createActivityDoc('9', 'Post Sync Run')],
      });
    const view = renderRuntime();

    await waitFor(() => expect(runsPageBoundaryMocks.mockOnSnapshot).toHaveBeenCalled());
    act(() => {
      listener.emit({ connected: true, athleteName: 'John Runner', lastSyncAt: null });
    });

    await waitFor(() => expect(view.result.current.activities[0]?.name).toBe('Morning Run'));

    act(() => {
      listener.emit({
        connected: true,
        athleteName: 'John Runner',
        lastSyncAt: createTimestamp(new Date(Date.now() - 2_000)),
      });
    });

    await waitFor(() => expect(view.result.current.activities[0]?.name).toBe('Post Sync Run'));

    expect(view.result.current.syncButtonLabel).toBe('冷卻中');
    expect(view.result.current.cooldownRemaining).toBeGreaterThan(0);
  });

  it('surfaces syncError from the real sync hook when sync request fails', async () => {
    const listener = installConnectionListener();
    runsPageBoundaryMocks.mockGetDocs.mockResolvedValueOnce({ docs: [] });
    runsPageBoundaryMocks.mockFetch.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: '同步冷卻中' }),
    });
    const view = renderRuntime();

    await waitFor(() => expect(runsPageBoundaryMocks.mockOnSnapshot).toHaveBeenCalled());

    act(() => {
      listener.emit({ connected: true, athleteName: 'John Runner', lastSyncAt: null });
    });

    await waitFor(() => expect(view.result.current.activitiesLoading).toBe(false));

    await act(async () => {
      await view.result.current.handleSync();
    });

    await waitFor(() => expect(view.result.current.syncError).toBe('同步冷卻中'));
  });

  it('reacts to auth switching by loading composed data and then clearing it', async () => {
    const listener = installConnectionListener();
    runsPageBoundaryMocks.mockGetDocs
      .mockResolvedValueOnce({ docs: [createActivityDoc('1', 'Morning Run')] })
      .mockResolvedValueOnce({ docs: [createActivityDoc('1', 'Morning Run')] });
    const view = renderRuntime({ user: null, loading: false });

    expect(view.result.current.user).toBeNull();
    expect(view.result.current.connection).toBeNull();
    expect(view.result.current.activities).toEqual([]);

    view.setAuth({ user: createUser({ uid: 'u2', getIdToken: vi.fn(async () => 'token-2') }) });

    await waitFor(() => expect(runsPageBoundaryMocks.mockOnSnapshot).toHaveBeenCalled());

    act(() => {
      listener.emit({ connected: true, athleteName: 'Auth Switched Runner', lastSyncAt: null });
    });

    await waitFor(() => expect(view.result.current.activities[0]?.name).toBe('Morning Run'));

    expect(view.result.current.connection?.athleteName).toBe('Auth Switched Runner');

    view.setAuth({ user: null, loading: false });

    await waitFor(() => expect(view.result.current.activities).toEqual([]));

    expect(view.result.current.connection).toBeNull();
    expect(view.result.current.authLoading).toBe(false);
  });
});
