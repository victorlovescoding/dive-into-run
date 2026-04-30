import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  createEventDetailEvent,
  createEventDetailParticipationProps,
  createJoinedByUserDispatcher,
  createParticipantFixture,
  createParticipantsSnapshot,
  eventDetailParticipationBoundaryMocks,
} from '../../_helpers/use-event-detail-participation-test-helpers';

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

/**
 * 動態載入 hook，確保 helper 內的 boundary mocks 先完成註冊。
 * @param {object} initialProps - renderHook 初始 props。
 * @returns {Promise<import('@testing-library/react').RenderHookResult<any, any>>} render 結果。
 */
/**
 * @param {ReturnType<typeof createEventDetailParticipationProps>} initialProps - hook 初始 props。
 * @returns {Promise<import('@testing-library/react').RenderHookResult<any, any>>} render 結果。
 */
async function renderEventDetailParticipationHook(initialProps) {
  const { default: useEventDetailParticipation } = await import(
    '@/runtime/hooks/useEventDetailParticipation'
  );
  return renderHook((props) => useEventDetailParticipation(props), { initialProps });
}

describe('useEventDetailParticipation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes remaining seats from fetched participants and exposes can_join state', async () => {
    const participants = [
      createParticipantFixture({ id: 'u2', uid: 'u2', name: 'Runner 2' }),
      createParticipantFixture({ id: 'u3', uid: 'u3', name: 'Runner 3' }),
      createParticipantFixture({ id: 'u4', uid: 'u4', name: 'Runner 4' }),
    ];
    eventDetailParticipationBoundaryMocks.mockGetDocs.mockResolvedValueOnce(
      createParticipantsSnapshot(participants),
    );
    eventDetailParticipationBoundaryMocks.mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
    });
    const props = createEventDetailParticipationProps({
      event: createEventDetailEvent({
        participantsCount: undefined,
        remainingSeats: undefined,
        maxParticipants: 5,
        hostUid: 'host-1',
      }),
      user: { uid: 'viewer-1', name: 'Viewer', photoURL: '' },
    });
    const { result } = await renderEventDetailParticipationHook(props);

    await waitFor(() => expect(result.current.participants).toHaveLength(3));

    expect(result.current.remainingSeats).toBe(2);
    expect(result.current.participationState).toBe('can_join');
    expect(result.current.isJoined).toBe(false);
    expect(eventDetailParticipationBoundaryMocks.mockGetDoc).toHaveBeenLastCalledWith({
      type: 'doc',
      path: 'events/event-1/participants/viewer-1',
      id: 'viewer-1',
    });
  });

  it('marks participationState as deadline_passed when registration deadline is over', async () => {
    eventDetailParticipationBoundaryMocks.mockGetDocs.mockResolvedValueOnce(
      createParticipantsSnapshot([]),
    );
    eventDetailParticipationBoundaryMocks.mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
    });
    const props = createEventDetailParticipationProps({
      event: createEventDetailEvent({
        registrationDeadline: new Date(Date.now() - 60_000).toISOString(),
        remainingSeats: 4,
      }),
      user: { uid: 'viewer-1', name: 'Viewer', photoURL: '' },
    });
    const { result } = await renderEventDetailParticipationHook(props);

    await waitFor(() => expect(result.current.participantsLoading).toBe(false));

    expect(result.current.participationState).toBe('deadline_passed');
    expect(result.current.remainingSeats).toBe(4);
  });

  it('returns login_required and skips joined lookup when user is missing', async () => {
    eventDetailParticipationBoundaryMocks.mockGetDocs.mockResolvedValueOnce(
      createParticipantsSnapshot([]),
    );
    const props = createEventDetailParticipationProps({
      event: createEventDetailEvent(),
      user: null,
    });
    const { result } = await renderEventDetailParticipationHook(props);

    await waitFor(() => expect(result.current.participantsLoading).toBe(false));

    expect(result.current.participationState).toBe('login_required');
    expect(eventDetailParticipationBoundaryMocks.mockGetDoc).not.toHaveBeenCalled();
  });

  it('surfaces participantsError when refreshParticipants fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    eventDetailParticipationBoundaryMocks.mockGetDocs.mockRejectedValueOnce(new Error('boom'));
    eventDetailParticipationBoundaryMocks.mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
    });
    const props = createEventDetailParticipationProps({
      event: createEventDetailEvent(),
    });
    const { result } = await renderEventDetailParticipationHook(props);

    await waitFor(() =>
      expect(result.current.participantsError).toBe('讀取參加名單失敗，請稍後再試'),
    );

    expect(result.current.participants).toEqual([]);
    expect(result.current.participantsLoading).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it('resets joined state when the viewing user changes', async () => {
    eventDetailParticipationBoundaryMocks.mockGetDocs.mockResolvedValue(
      createParticipantsSnapshot([]),
    );
    eventDetailParticipationBoundaryMocks.mockGetDoc.mockImplementation(
      createJoinedByUserDispatcher({
        'viewer-1': ['event-1'],
        'viewer-2': [],
      }),
    );
    const initialProps = createEventDetailParticipationProps({
      event: createEventDetailEvent(),
      user: { uid: 'viewer-1', name: 'Viewer 1', photoURL: '' },
    });
    const { result, rerender } = await renderEventDetailParticipationHook(initialProps);

    await waitFor(() => expect(result.current.isJoined).toBe(true));

    rerender({
      ...initialProps,
      user: { uid: 'viewer-2', name: 'Viewer 2', photoURL: '' },
    });

    await waitFor(() => expect(result.current.isJoined).toBe(false));

    expect(eventDetailParticipationBoundaryMocks.mockGetDoc).toHaveBeenCalledWith({
      type: 'doc',
      path: 'events/event-1/participants/viewer-1',
      id: 'viewer-1',
    });
    expect(eventDetailParticipationBoundaryMocks.mockGetDoc).toHaveBeenCalledWith({
      type: 'doc',
      path: 'events/event-1/participants/viewer-2',
      id: 'viewer-2',
    });
  });

  it('cleans overlay listeners after closing the participants panel', async () => {
    eventDetailParticipationBoundaryMocks.mockGetDocs.mockResolvedValue(
      createParticipantsSnapshot([]),
    );
    eventDetailParticipationBoundaryMocks.mockGetDoc.mockResolvedValue({
      exists: () => false,
    });
    const props = createEventDetailParticipationProps({
      event: createEventDetailEvent(),
    });
    const { result } = await renderEventDetailParticipationHook(props);
    const overlay = document.createElement('div');
    const overlayAddSpy = vi.spyOn(overlay, 'addEventListener');
    const overlayRemoveSpy = vi.spyOn(overlay, 'removeEventListener');
    const documentAddSpy = vi.spyOn(document, 'addEventListener');
    const documentRemoveSpy = vi.spyOn(document, 'removeEventListener');

    act(() => {
      result.current.participantsOverlayRef.current = overlay;
    });
    await act(async () => {
      await result.current.handleOpenParticipants();
    });

    await waitFor(() => expect(documentAddSpy).toHaveBeenCalled());

    const clickHandler = overlayAddSpy.mock.calls.find(([type]) => type === 'click')?.[1];
    const keydownHandler = documentAddSpy.mock.calls.find(([type]) => type === 'keydown')?.[1];

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await waitFor(() => expect(result.current.isParticipantsOpen).toBe(false));

    expect(overlayRemoveSpy).toHaveBeenCalledWith('click', clickHandler);
    expect(documentRemoveSpy).toHaveBeenCalledWith('keydown', keydownHandler);
  });
});
