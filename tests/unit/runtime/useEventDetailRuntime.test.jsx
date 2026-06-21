// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEventDetailRuntime from '../../../src/runtime/hooks/useEventDetailRuntime';
import { AuthContext } from '../../../src/runtime/providers/AuthProvider';

const mocks = vi.hoisted(() => ({
  addContentFavorite: vi.fn(),
  fetchEventById: vi.fn(),
  getFavoritedTargetIds: vi.fn(),
  push: vi.fn(),
  removeContentFavorite: vi.fn(),
  showToast: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
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
  fetchEventById: mocks.fetchEventById,
}));

vi.mock('../../../src/runtime/client/use-cases/content-favorite-use-cases', () => ({
  addContentFavorite: mocks.addContentFavorite,
  FAVORITE_CONTENT_TYPES: { EVENT: 'event' },
  getFavoritedTargetIds: mocks.getFavoritedTargetIds,
  removeContentFavorite: mocks.removeContentFavorite,
}));

vi.mock('../../../src/repo/client/firebase-auth-repo', () => ({
  signInWithGoogle: mocks.signInWithGoogle,
}));

vi.mock('../../../src/runtime/hooks/useEventDetailParticipation', () => ({
  default: () => ({
    participants: [],
    participantsLoading: false,
    participantsError: null,
    isParticipantsOpen: false,
    participantsOverlayRef: { current: null },
    pending: null,
    remainingSeats: 8,
    participationState: 'login_required',
    refreshParticipants: vi.fn(),
    handleJoin: vi.fn(),
    handleLeave: vi.fn(),
    handleOpenParticipants: vi.fn(),
    handleCloseParticipants: vi.fn(),
  }),
}));

vi.mock('../../../src/runtime/hooks/useEventDetailMutations', () => ({
  default: () => ({
    editingEvent: null,
    isUpdating: false,
    deletingEventId: null,
    isDeletingEvent: false,
    handleEditEvent: vi.fn(),
    handleEditCancel: vi.fn(),
    handleEditSubmit: vi.fn(),
    handleDeleteEventRequest: vi.fn(),
    handleDeleteCancel: vi.fn(),
    handleDeleteConfirm: vi.fn(),
    handleCommentAdded: vi.fn(),
  }),
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

const event = {
  id: 'event-1',
  title: '晨跑團',
  city: '台北市',
  district: '大安區',
  meetPlace: '森林公園',
  distanceKm: 5,
  maxParticipants: 10,
  participantsCount: 2,
  paceSec: 360,
  hostUid: 'host-1',
  hostName: '主揪',
  hostPhotoURL: '',
  time: '2026-07-01T10:00:00.000Z',
  registrationDeadline: '2026-06-30T10:00:00.000Z',
  description: '一起跑',
};

/**
 * Render event detail runtime with test auth.
 * @param {{ authUser?: typeof user | null, id?: string }} [options] - Render options.
 * @returns {ReturnType<typeof renderHook> & {
 *   setAuthUser: (nextUser: typeof user | null) => void
 * }} Rendered hook.
 */
function renderUseEventDetailRuntime({ authUser = user, id = 'event-1' } = {}) {
  let currentAuthUser = authUser;
  const utils = renderHook(() => useEventDetailRuntime(id), {
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
  mocks.fetchEventById.mockResolvedValue(event);
  mocks.getFavoritedTargetIds.mockResolvedValue(new Set());
  mocks.signInWithGoogle.mockResolvedValue({
    user: { uid: 'runner-after-google' },
  });
});

describe('useEventDetailRuntime favorite login continuation', () => {
  it('opens the event continuation dialog for unauthenticated favorite clicks without toast', async () => {
    const { result } = renderUseEventDetailRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.event?.id).toBe('event-1');
    });
    await act(async () => {
      await result.current.handleToggleFavoriteEvent();
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

  it('patches the detail favorite state after continuation success', async () => {
    const { result } = renderUseEventDetailRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.event?.id).toBe('event-1');
    });
    await act(async () => {
      await result.current.handleToggleFavoriteEvent();
    });
    await act(async () => {
      await result.current.confirmContinuation();
    });

    expect(mocks.signInWithGoogle).toHaveBeenCalled();
    expect(mocks.addContentFavorite).toHaveBeenCalledWith({
      uid: 'runner-after-google',
      type: 'event',
      targetId: 'event-1',
    });
    expect(result.current.isFavoriteEvent).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith('登入成功，已加入收藏', 'success');
  });

  it('keeps the continuation favorite when signed-in sync returns stale empty ids after add success', async () => {
    const pendingAddFavorite = createDeferred();
    const staleSignedInSync = createDeferred();
    mocks.addContentFavorite.mockReturnValueOnce(pendingAddFavorite.promise);
    mocks.getFavoritedTargetIds.mockReturnValueOnce(staleSignedInSync.promise);

    const { result, setAuthUser } = renderUseEventDetailRuntime({ authUser: null });

    await waitFor(() => {
      expect(result.current.event?.id).toBe('event-1');
    });
    await act(async () => {
      await result.current.handleToggleFavoriteEvent();
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
        targetIds: ['event-1'],
      });
    });

    await act(async () => {
      pendingAddFavorite.resolve(undefined);
      await confirmPromise;
    });
    expect(result.current.isFavoriteEvent).toBe(true);

    await act(async () => {
      staleSignedInSync.resolve(new Set());
      await staleSignedInSync.promise;
    });

    expect(result.current.isFavoriteEvent).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith('登入成功，已加入收藏', 'success');
  });
});

describe('useEventDetailRuntime signed-in favorite regressions', () => {
  it('keeps signed-in add favorite on the existing branch without opening continuation', async () => {
    const { result } = renderUseEventDetailRuntime();

    await waitFor(() => {
      expect(result.current.event?.id).toBe('event-1');
    });
    await act(async () => {
      await result.current.handleToggleFavoriteEvent();
    });

    expect(mocks.addContentFavorite).toHaveBeenCalledWith({
      uid: 'runner-1',
      type: 'event',
      targetId: 'event-1',
    });
    expect(mocks.removeContentFavorite).not.toHaveBeenCalled();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(result.current.isFavoriteEvent).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith('已加入收藏', 'success');
  });

  it('keeps signed-in remove favorite on the existing branch without opening continuation', async () => {
    mocks.getFavoritedTargetIds.mockResolvedValueOnce(new Set(['event-1']));
    const { result } = renderUseEventDetailRuntime();

    await waitFor(() => {
      expect(result.current.isFavoriteEvent).toBe(true);
    });
    await act(async () => {
      await result.current.handleToggleFavoriteEvent();
    });

    expect(mocks.removeContentFavorite).toHaveBeenCalledWith({
      uid: 'runner-1',
      type: 'event',
      targetId: 'event-1',
    });
    expect(mocks.addContentFavorite).not.toHaveBeenCalled();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
    expect(result.current.dialogState).toMatchObject({ isOpen: false });
    expect(result.current.isFavoriteEvent).toBe(false);
    expect(mocks.showToast).toHaveBeenCalledWith('已取消收藏', 'success');
  });
});
