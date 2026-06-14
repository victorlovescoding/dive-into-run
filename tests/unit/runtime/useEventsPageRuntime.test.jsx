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
 * @returns {ReturnType<typeof renderHook>} Rendered events page runtime hook.
 */
function renderUseEventsPageRuntime() {
  return renderHook(() => useEventsPageRuntime(), {
    wrapper: ({ children }) => (
      <AuthContext.Provider value={{ user, setUser: vi.fn(), loading: false }}>
        {children}
      </AuthContext.Provider>
    ),
  });
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
