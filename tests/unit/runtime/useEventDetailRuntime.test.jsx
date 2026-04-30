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

describe('useEventDetailRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockReset();
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
});
