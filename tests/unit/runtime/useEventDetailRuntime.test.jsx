import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRuntimeEvent,
  createRuntimeParticipant,
  eventDetailRuntimeBoundaryMocks,
  installEventDetailRuntimeFirestore,
  primeJoinTransaction,
  resetEventDetailRuntimeBoundaryMocks,
} from '../../_helpers/use-event-detail-runtime-test-helpers';

const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const { authState, mockShowToast, mockUseContext } = vi.hoisted(() => ({
  authState: {
    current: { user: null, loading: false, setUser() {} },
  },
  mockShowToast: vi.fn(),
  mockUseContext: vi.fn(),
}));

const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());
  mockUseContext.mockImplementation(() => authState.current);
  return {
    ...actual,
    useContext: mockUseContext,
  };
});

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.doMock('firebase/firestore', () => ({
  addDoc: eventDetailRuntimeBoundaryMocks.mockAddDoc,
  collection: eventDetailRuntimeBoundaryMocks.mockCollection,
  deleteDoc: mockDeleteDoc,
  doc: eventDetailRuntimeBoundaryMocks.mockDoc,
  getDoc: eventDetailRuntimeBoundaryMocks.mockGetDoc,
  getDocs: eventDetailRuntimeBoundaryMocks.mockGetDocs,
  limit: eventDetailRuntimeBoundaryMocks.mockLimit,
  onSnapshot: eventDetailRuntimeBoundaryMocks.mockOnSnapshot,
  orderBy: eventDetailRuntimeBoundaryMocks.mockOrderBy,
  query: eventDetailRuntimeBoundaryMocks.mockQuery,
  runTransaction: eventDetailRuntimeBoundaryMocks.mockRunTransaction,
  serverTimestamp: eventDetailRuntimeBoundaryMocks.mockServerTimestamp,
  setDoc: mockSetDoc,
  startAfter: eventDetailRuntimeBoundaryMocks.mockStartAfter,
  updateDoc: eventDetailRuntimeBoundaryMocks.mockUpdateDoc,
  where: eventDetailRuntimeBoundaryMocks.mockWhere,
  writeBatch: eventDetailRuntimeBoundaryMocks.mockWriteBatch,
  deleteField: eventDetailRuntimeBoundaryMocks.mockDeleteField,
  Timestamp: {
    fromDate: eventDetailRuntimeBoundaryMocks.mockTimestampFromDate,
    now: eventDetailRuntimeBoundaryMocks.mockTimestampNow,
  },
}));

/**
 * 動態載入 hook，確保 helper 內的 boundary mocks 先完成註冊。
 * @param {{ id?: string, user?: object | null }} [options] - render 選項。
 * @returns {Promise<import('@testing-library/react').RenderHookResult<any, any> & { showToast: import('vitest').Mock, router: typeof eventDetailRuntimeBoundaryMocks.router }>} render 結果。
 */
/**
 * @param {{ id?: string, user?: object | null }} [options] - render 選項。
 * @returns {Promise<import('@testing-library/react').RenderHookResult<any, any> & { showToast: import('vitest').Mock, router: typeof eventDetailRuntimeBoundaryMocks.router }>} render 結果。
 */
async function renderEventDetailRuntimeHook(options = {}) {
  const { default: useEventDetailRuntime } = await import('@/runtime/hooks/useEventDetailRuntime');
  authState.current = {
    user:
      options.user === undefined
        ? {
            uid: 'u1',
            name: 'Alice',
            email: 'alice@example.com',
            photoURL: '',
            bio: null,
            getIdToken: vi.fn().mockResolvedValue('token'),
          }
        : options.user,
    setUser: vi.fn(),
    loading: false,
  };

  return {
    ...renderHook(() => useEventDetailRuntime(options.id ?? 'event-1')),
    showToast: mockShowToast,
    router: eventDetailRuntimeBoundaryMocks.router,
  };
}

/**
 * 建立 Firestore document snapshot。
 * @param {string} id - 文件 ID。
 * @param {object | null} data - 文件資料，null 表示不存在。
 * @returns {{ id: string, exists: () => boolean, data: () => object }} snapshot。
 */
function createDocSnapshot(id, data) {
  return {
    id,
    exists: () => data !== null,
    data: () => data ?? {},
  };
}

/**
 * 安裝活動詳情與收藏狀態的 Firestore stubs。
 * @param {object} options - stub 設定。
 * @param {string} options.id - 活動 ID。
 * @param {import('@/service/event-service').EventData} options.event - 活動資料。
 * @param {string[]} [options.favoriteEventIds] - 已收藏活動 ID。
 */
function installEventDetailFavoriteFirestore({ id, event, favoriteEventIds = [] }) {
  installEventDetailRuntimeFirestore({ id, event, participants: [] });
  const favorites = new Set(favoriteEventIds.map(String));

  eventDetailRuntimeBoundaryMocks.mockGetDoc.mockImplementation(async (ref) => {
    const path = String(ref?.path ?? '');
    if (path === `events/${id}`) {
      return createDocSnapshot(id, event);
    }
    if (path === `events/${id}/participants/u1`) {
      return createDocSnapshot('u1', null);
    }
    const favoriteMatch = path.match(/^users\/[^/]+\/favoriteEvents\/([^/]+)$/);
    if (favoriteMatch) {
      const eventId = favoriteMatch[1];
      return createDocSnapshot(
        eventId,
        favorites.has(eventId) ? { targetId: eventId, createdAt: `favorite-${eventId}` } : null,
      );
    }
    return createDocSnapshot(String(ref?.id ?? 'missing'), null);
  });
}

describe('useEventDetailRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockReset();
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    resetEventDetailRuntimeBoundaryMocks();
  });

  it('uses the route id to load detail and hydrate participation state', async () => {
    const id = 'route-42';
    const event = createRuntimeEvent({
      id,
      title: 'River Run',
      maxParticipants: 5,
      participantsCount: 2,
      route: {
        polylines: ['poly-a', 'poly-b'],
        pointsCount: 18,
        bbox: { minLat: 25, minLng: 121, maxLat: 25.2, maxLng: 121.2 },
      },
    });

    installEventDetailRuntimeFirestore({
      id,
      event,
      participants: [
        createRuntimeParticipant({ id: 'u2', uid: 'u2', eventId: id }),
        createRuntimeParticipant({ id: 'u3', uid: 'u3', name: 'Cara', eventId: id }),
      ],
    });

    const { result } = await renderEventDetailRuntimeHook({ id });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.participantsLoading).toBe(false);
    });

    expect(result.current.event).toMatchObject({ id, title: 'River Run' });
    expect(result.current.participants).toHaveLength(2);
    expect(result.current.statusText).toBe('報名中');
    expect(result.current.hasRoute).toBe(true);
    expect(result.current.routePolylines).toEqual(['poly-a', 'poly-b']);
    expect(result.current.routePointCount).toBe(18);
    expect(result.current.remainingSeats).toBe(3);
    expect(result.current.participationState).toBe('can_join');
    expect(result.current.shareUrl).toContain(`/events/${id}`);
    expect(
      eventDetailRuntimeBoundaryMocks.mockDoc.mock.calls.some(
        (call) => call.slice(1).join('/') === `events/${id}`,
      ),
    ).toBe(true);
  });

  it('guards empty route ids as missing events', async () => {
    const { result } = await renderEventDetailRuntimeHook({ id: '' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.event).toBeNull();
    expect(result.current.error).toBe('找不到這個活動（可能已被刪除）');
    expect(result.current.participants).toEqual([]);
    expect(result.current.participationState).toBe('unavailable');
    expect(eventDetailRuntimeBoundaryMocks.mockGetDoc).not.toHaveBeenCalled();
    expect(eventDetailRuntimeBoundaryMocks.mockGetDocs).not.toHaveBeenCalled();
  });

  it('joins through the real participation hook composition', async () => {
    const id = 'join-1';
    const event = createRuntimeEvent({
      id,
      maxParticipants: 4,
      participantsCount: 1,
      remainingSeats: 3,
    });

    installEventDetailRuntimeFirestore({
      id,
      event,
      participants: [createRuntimeParticipant({ id: 'u2', uid: 'u2', eventId: id })],
    });
    primeJoinTransaction({ event });

    const { result, showToast } = await renderEventDetailRuntimeHook({ id });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleJoin();
    });

    await waitFor(() => {
      expect(result.current.participationState).toBe('joined');
    });

    expect(result.current.event).toMatchObject({ participantsCount: 2, remainingSeats: 2 });
    expect(result.current.participants.map((participant) => participant.uid)).toContain('u1');
    expect(showToast).toHaveBeenLastCalledWith('報名成功');
    expect(eventDetailRuntimeBoundaryMocks.mockRunTransaction).toHaveBeenCalled();
  });

  it('redirects after delete through the real mutation hook composition', async () => {
    const id = 'delete-1';
    const event = createRuntimeEvent({
      id,
      participantsCount: 0,
      remainingSeats: 4,
    });

    installEventDetailRuntimeFirestore({ id, event, participants: [] });

    const { result, router } = await renderEventDetailRuntimeHook({ id });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      result.current.handleDeleteEventRequest(event);
      await result.current.handleDeleteConfirm(id);
    });

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/events?toast=活動已刪除');
    });

    expect(result.current.deletingEventId).toBeNull();
    expect(result.current.isDeletingEvent).toBe(false);
  });

  it('loads the initial event favorite state for the route id', async () => {
    const id = 'favorite-1';
    const event = createRuntimeEvent({ id });
    installEventDetailFavoriteFirestore({ id, event, favoriteEventIds: [id] });

    const { result } = await renderEventDetailRuntimeHook({ id });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.isFavoriteEvent).toBe(true);
    });
  });

  it('adds an event favorite from the detail runtime', async () => {
    const id = 'favorite-add';
    const event = createRuntimeEvent({ id });
    installEventDetailFavoriteFirestore({ id, event });

    const { result, showToast } = await renderEventDetailRuntimeHook({ id });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleToggleFavoriteEvent();
    });

    expect(result.current.isFavoriteEvent).toBe(true);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: `users/u1/favoriteEvents/${id}` }),
      expect.objectContaining({ targetId: id }),
    );
    expect(showToast).toHaveBeenLastCalledWith('已加入收藏', 'success');
  });

  it('removes an event favorite from the detail runtime', async () => {
    const id = 'favorite-remove';
    const event = createRuntimeEvent({ id });
    installEventDetailFavoriteFirestore({ id, event, favoriteEventIds: [id] });

    const { result, showToast } = await renderEventDetailRuntimeHook({ id });

    await waitFor(() => {
      expect(result.current.isFavoriteEvent).toBe(true);
    });

    await act(async () => {
      await result.current.handleToggleFavoriteEvent();
    });

    expect(result.current.isFavoriteEvent).toBe(false);
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: `users/u1/favoriteEvents/${id}` }),
    );
    expect(showToast).toHaveBeenLastCalledWith('已取消收藏', 'success');
  });

  it('rolls back the detail favorite state when adding fails', async () => {
    const id = 'favorite-add-fail';
    const event = createRuntimeEvent({ id });
    mockSetDoc.mockRejectedValueOnce(new Error('add failed'));
    installEventDetailFavoriteFirestore({ id, event });

    const { result, showToast } = await renderEventDetailRuntimeHook({ id });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleToggleFavoriteEvent();
    });

    expect(result.current.isFavoriteEvent).toBe(false);
    expect(showToast).toHaveBeenLastCalledWith('收藏失敗，請稍後再試', 'error');
  });

  it('rolls back the detail favorite state when removing fails', async () => {
    const id = 'favorite-remove-fail';
    const event = createRuntimeEvent({ id });
    mockDeleteDoc.mockRejectedValueOnce(new Error('remove failed'));
    installEventDetailFavoriteFirestore({ id, event, favoriteEventIds: [id] });

    const { result, showToast } = await renderEventDetailRuntimeHook({ id });

    await waitFor(() => {
      expect(result.current.isFavoriteEvent).toBe(true);
    });

    await act(async () => {
      await result.current.handleToggleFavoriteEvent();
    });

    expect(result.current.isFavoriteEvent).toBe(true);
    expect(showToast).toHaveBeenLastCalledWith('取消收藏失敗，請稍後再試', 'error');
  });
});
