// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEventsPageRuntime from '../../../src/runtime/hooks/useEventsPageRuntime';
import { AuthContext } from '../../../src/runtime/providers/AuthProvider';

const mocks = vi.hoisted(() => ({
  addContentFavorite: vi.fn(),
  fetchLatestEvents: vi.fn(),
  fetchNextEvents: vi.fn(),
  getFavoritedTargetIds: vi.fn(),
  queryEvents: vi.fn(),
  removeContentFavorite: vi.fn(),
  replace: vi.fn(),
  showToast: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
}));

vi.mock('../../../src/runtime/providers/AuthProvider', async () => {
  const { createContext } = await vi.importActual('react');
  return {
    AuthContext: createContext({ user: null, setUser: () => {}, loading: true }),
  };
});

vi.mock('../../../src/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../../src/runtime/client/use-cases/event-use-cases', () => ({
  fetchLatestEvents: mocks.fetchLatestEvents,
  fetchNextEvents: mocks.fetchNextEvents,
  queryEvents: mocks.queryEvents,
}));

vi.mock('../../../src/runtime/client/use-cases/content-favorite-use-cases', () => ({
  addContentFavorite: mocks.addContentFavorite,
  FAVORITE_CONTENT_TYPES: { EVENT: 'event' },
  getFavoritedTargetIds: mocks.getFavoritedTargetIds,
  removeContentFavorite: mocks.removeContentFavorite,
}));

vi.mock('../../../src/lib/firebase-auth-helpers', () => ({
  signInWithGoogle: mocks.signInWithGoogle,
}));

vi.mock('../../../src/runtime/hooks/useEventMutations', () => ({
  default: () => ({
    draftFormData: null,
    isCreating: false,
  }),
}));

vi.mock('../../../src/runtime/hooks/useEventParticipation', () => ({
  default: () => ({}),
}));

const user = {
  uid: 'runner-1',
  name: 'Runner One',
  email: 'runner@example.test',
  photoURL: 'https://example.test/runner.png',
  bio: null,
  accountStatus: 'active',
  deletionScheduledFor: null,
  getIdToken: vi.fn(),
};

const startedEvent = {
  id: 'started-1',
  title: '已開始河濱跑',
  city: '台北市',
  district: '中正區',
  distance: 5,
  maxParticipants: 8,
  participantsCount: 3,
  time: '2026-01-01T10:00:00.000Z',
  registrationDeadline: '2025-12-31T10:00:00.000Z',
};

const futureEvent = {
  id: 'future-1',
  title: '未來山路跑',
  city: '台北市',
  district: '大安區',
  distance: 12,
  maxParticipants: 10,
  participantsCount: 4,
  time: '2026-12-01T10:00:00.000Z',
  registrationDeadline: '2026-11-30T10:00:00.000Z',
};

/**
 * Render events page runtime with stable auth and toast collaborators.
 * @param {{ authUser?: typeof user | null }} [options] - Render options.
 * @returns {ReturnType<typeof renderHook> & {
 *   setAuthUser: (nextUser: typeof user | null) => void
 * }} Rendered events page runtime hook.
 */
function renderUseEventsPageRuntime({ authUser = user } = {}) {
  let currentAuthUser = authUser;
  const utils = renderHook(() => useEventsPageRuntime(), {
    wrapper: ({ children }) => (
      <AuthContext.Provider value={{ user: currentAuthUser, setUser: vi.fn(), loading: false }}>
        {children}
      </AuthContext.Provider>
    ),
  });

  return {
    ...utils,
    setAuthUser(nextUser) {
      currentAuthUser = nextUser;
      utils.rerender();
    },
  };
}

/**
 * Creates a controllable promise for race-condition assertions.
 * @template T
 * @returns {{
 *   promise: Promise<T>,
 *   resolve: (value: T | PromiseLike<T>) => void,
 *   reject: (reason?: unknown) => void
 * }} Deferred promise controls.
 */
function createDeferred() {
  /** @type {(value: unknown) => void} */
  let resolve = () => {};
  /** @type {(reason?: unknown) => void} */
  let reject = () => {};
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchLatestEvents.mockResolvedValue({
    events: [startedEvent, futureEvent],
    lastDoc: 'latest-cursor',
    hasMore: true,
  });
  mocks.fetchNextEvents.mockResolvedValue({
    events: [],
    lastDoc: null,
    hasMore: false,
  });
  mocks.getFavoritedTargetIds.mockResolvedValue(new Set(['started-1']));
  mocks.queryEvents.mockResolvedValue([]);
  mocks.signInWithGoogle.mockResolvedValue({
    user: { uid: 'runner-after-google' },
  });
});

describe('useEventsPageRuntime started event list regressions', () => {
  it('keeps started events in the latest list and favorite lookup without changing list order', async () => {
    const { result } = renderUseEventsPageRuntime();

    await waitFor(() => {
      expect(result.current.events.map((event) => event.id)).toEqual(['started-1', 'future-1']);
    });

    expect(mocks.fetchLatestEvents).toHaveBeenCalledWith(10);
    await waitFor(() => {
      expect(mocks.getFavoritedTargetIds).toHaveBeenCalledWith({
        uid: 'runner-1',
        type: 'event',
        targetIds: ['started-1', 'future-1'],
      });
    });
    expect(result.current.events[0]).toBe(startedEvent);
    expect(result.current.favoriteEventIds.has('started-1')).toBe(true);
  });

  it('keeps started events in filter search results with the returned ordering intact', async () => {
    mocks.queryEvents.mockResolvedValueOnce([futureEvent, startedEvent]);
    const { result } = renderUseEventsPageRuntime();

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });

    act(() => {
      result.current.handleFilterCityChange('台北市');
      result.current.setFilterDistanceMin('5');
      result.current.setFilterHasSeatsOnly(true);
    });
    await act(async () => {
      await result.current.handleSearchFilters();
    });

    expect(mocks.queryEvents).toHaveBeenCalledWith({
      city: '台北市',
      district: '',
      startTime: '',
      endTime: '',
      minDistance: '5',
      maxDistance: '',
      hasSeatsOnly: true,
    });
    expect(result.current.events.map((event) => event.id)).toEqual(['future-1', 'started-1']);
    expect(result.current.isFilteredResults).toBe(true);
    expect(result.current.hasMore).toBe(false);
  });

  it('keeps started events when loading more and preserves page merge order', async () => {
    const nextStartedEvent = {
      ...startedEvent,
      id: 'started-2',
      title: '已開始夜跑',
    };
    mocks.fetchNextEvents.mockResolvedValueOnce({
      events: [nextStartedEvent],
      lastDoc: 'next-cursor',
      hasMore: false,
    });
    const { result } = renderUseEventsPageRuntime();

    await waitFor(() => {
      expect(result.current.events.map((event) => event.id)).toEqual(['started-1', 'future-1']);
    });
    await act(async () => {
      await result.current.loadMore();
    });

    expect(mocks.fetchNextEvents).toHaveBeenCalledWith('latest-cursor', 10);
    expect(result.current.events.map((event) => event.id)).toEqual([
      'started-1',
      'future-1',
      'started-2',
    ]);
    expect(result.current.hasMore).toBe(false);
  });
});

describe('useEventsPageRuntime favorite login continuation', () => {
  it('opens the event continuation dialog for unauthenticated favorite clicks without toast', async () => {
    const { result } = renderUseEventsPageRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.events.map((event) => event.id)).toEqual(['started-1', 'future-1']);
    });
    await act(async () => {
      await result.current.handleToggleFavoriteEvent('future-1');
    });

    expect(result.current.dialogState).toMatchObject({
      isOpen: true,
      contentType: 'event',
      body: '登入後會自動將這個活動加入收藏。',
      isSubmitting: false,
    });
    expect(mocks.showToast).not.toHaveBeenCalledWith('請先登入才能收藏', 'info');
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(mocks.addContentFavorite).not.toHaveBeenCalled();
  });

  it('patches only the clicked event as favorited after continuation success', async () => {
    const { result } = renderUseEventsPageRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.events.map((event) => event.id)).toEqual(['started-1', 'future-1']);
    });
    await act(async () => {
      await result.current.handleToggleFavoriteEvent('future-1');
    });
    await act(async () => {
      await result.current.confirmContinuation();
    });

    expect(mocks.signInWithGoogle).toHaveBeenCalled();
    expect(mocks.addContentFavorite).toHaveBeenCalledWith({
      uid: 'runner-after-google',
      type: 'event',
      targetId: 'future-1',
    });
    expect(result.current.favoriteEventIds.has('future-1')).toBe(true);
    expect(result.current.favoriteEventIds.has('started-1')).toBe(false);
    expect(mocks.showToast).toHaveBeenCalledWith('登入成功，已加入收藏', 'success');
  });

  it('keeps the continuation favorite when signed-in sync returns stale empty ids after add success', async () => {
    const pendingAddFavorite = createDeferred();
    const staleSignedInSync = createDeferred();
    mocks.addContentFavorite.mockReturnValueOnce(pendingAddFavorite.promise);
    mocks.getFavoritedTargetIds.mockReturnValueOnce(staleSignedInSync.promise);

    const { result, setAuthUser } = renderUseEventsPageRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.events.map((event) => event.id)).toEqual(['started-1', 'future-1']);
    });
    await act(async () => {
      await result.current.handleToggleFavoriteEvent('future-1');
    });

    /** @type {Promise<void>} */
    let confirmPromise;
    act(() => {
      confirmPromise = result.current.confirmContinuation();
    });

    act(() => {
      setAuthUser({ ...user, uid: 'runner-after-google' });
    });
    await waitFor(() => {
      expect(mocks.getFavoritedTargetIds).toHaveBeenCalledWith({
        uid: 'runner-after-google',
        type: 'event',
        targetIds: ['started-1', 'future-1'],
      });
    });

    await act(async () => {
      pendingAddFavorite.resolve(undefined);
      await confirmPromise;
    });
    expect(result.current.favoriteEventIds.has('future-1')).toBe(true);

    await act(async () => {
      staleSignedInSync.resolve(new Set());
      await staleSignedInSync.promise;
    });

    expect(result.current.favoriteEventIds.has('future-1')).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith('登入成功，已加入收藏', 'success');
  });
});

describe('useEventsPageRuntime signed-in favorite regressions', () => {
  it('keeps signed-in add favorite on the existing branch without opening continuation', async () => {
    const { result } = renderUseEventsPageRuntime();

    await waitFor(() => {
      expect(result.current.favoriteEventIds.has('started-1')).toBe(true);
    });
    await act(async () => {
      await result.current.handleToggleFavoriteEvent('future-1');
    });

    expect(mocks.addContentFavorite).toHaveBeenCalledWith({
      uid: 'runner-1',
      type: 'event',
      targetId: 'future-1',
    });
    expect(mocks.removeContentFavorite).not.toHaveBeenCalled();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(result.current.favoriteEventIds.has('future-1')).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith('已加入收藏', 'success');
  });

  it('keeps signed-in remove favorite on the existing branch without opening continuation', async () => {
    const { result } = renderUseEventsPageRuntime();

    await waitFor(() => {
      expect(result.current.favoriteEventIds.has('started-1')).toBe(true);
    });
    await act(async () => {
      await result.current.handleToggleFavoriteEvent('started-1');
    });

    expect(mocks.removeContentFavorite).toHaveBeenCalledWith({
      uid: 'runner-1',
      type: 'event',
      targetId: 'started-1',
    });
    expect(mocks.addContentFavorite).not.toHaveBeenCalled();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(result.current.favoriteEventIds.has('started-1')).toBe(false);
    expect(mocks.showToast).toHaveBeenCalledWith('已取消收藏', 'success');
  });
});
