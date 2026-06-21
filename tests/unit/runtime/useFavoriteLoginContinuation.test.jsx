// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useFavoriteLoginContinuation from '@/runtime/hooks/useFavoriteLoginContinuation';
import { FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS } from '@/runtime/client/use-cases/favorite-login-continuation-use-cases';
import {
  createDeferred,
  createFavoriteContinuationCallbacks,
  createGoogleAuthResult,
  createToastSpy,
  FAVORITE_LOGIN_TEST_COPY,
} from '../../_helpers/favorite-login-continuation-helpers';

/**
 * Renders the favorite login continuation hook with stable spies.
 * @param {object} [overrides] - Hook option overrides.
 * @returns {ReturnType<typeof renderHook> & {
 *   showToast: import('vitest').Mock,
 *   onFavoriteAdded: import('vitest').Mock,
 *   onFavoriteAddFailed: import('vitest').Mock,
 *   runContinuation: import('vitest').Mock
 * }} Rendered hook utilities.
 */
function renderUseFavoriteLoginContinuation(overrides = {}) {
  const showToast = createToastSpy();
  const callbacks = createFavoriteContinuationCallbacks();
  const runContinuation = vi.fn();
  const view = renderHook(() =>
    useFavoriteLoginContinuation({
      showToast,
      ...callbacks,
      runContinuation,
      ...overrides,
    }),
  );

  return { ...view, showToast, ...callbacks, runContinuation };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFavoriteLoginContinuation open and close state', () => {
  it('opens event and post dialog render state without starting Google sign-in', () => {
    const { result, runContinuation } = renderUseFavoriteLoginContinuation();

    act(() => {
      result.current.openContinuation({ contentType: 'event', targetId: ' event-1 ' });
    });
    expect(result.current.dialogState).toMatchObject({
      isOpen: true,
      contentType: 'event',
      title: FAVORITE_LOGIN_TEST_COPY.title,
      body: FAVORITE_LOGIN_TEST_COPY.eventBody,
      primaryLabel: FAVORITE_LOGIN_TEST_COPY.primaryLabel,
      secondaryLabel: FAVORITE_LOGIN_TEST_COPY.secondaryLabel,
      isSubmitting: false,
    });
    expect(runContinuation).not.toHaveBeenCalled();

    act(() => {
      result.current.cancelContinuation();
      result.current.openContinuation({ contentType: 'post', targetId: 'post-1' });
    });
    expect(result.current.dialogState).toMatchObject({
      isOpen: true,
      contentType: 'post',
      body: FAVORITE_LOGIN_TEST_COPY.postBody,
    });
  });

  it('clears intent on cancel and close without toast or auth work', () => {
    const { result, runContinuation, showToast } = renderUseFavoriteLoginContinuation();

    act(() => {
      result.current.openContinuation({ contentType: 'event', targetId: 'event-1' });
      result.current.cancelContinuation();
    });
    expect(result.current.dialogState.isOpen).toBe(false);

    act(() => {
      result.current.openContinuation({ contentType: 'post', targetId: 'post-1' });
      result.current.closeContinuation();
    });
    expect(result.current.dialogState.isOpen).toBe(false);
    expect(runContinuation).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('keeps the first intent when another open request arrives before completion', () => {
    const { result } = renderUseFavoriteLoginContinuation();

    act(() => {
      result.current.openContinuation({ contentType: 'event', targetId: 'event-1' });
      result.current.openContinuation({ contentType: 'post', targetId: 'post-2' });
    });

    expect(result.current.dialogState).toMatchObject({
      contentType: 'event',
      body: FAVORITE_LOGIN_TEST_COPY.eventBody,
    });
  });

  it.each([
    ['cancel', 'cancelContinuation'],
    ['close', 'closeContinuation'],
  ])('ignores late continuation results after %s while pending', async (_label, handlerName) => {
    const deferred = createDeferred();
    const { result, showToast, onFavoriteAdded, onFavoriteAddFailed, runContinuation } =
      renderUseFavoriteLoginContinuation();
    runContinuation.mockReturnValueOnce(deferred.promise);

    act(() => {
      result.current.openContinuation({ contentType: 'event', targetId: 'event-1' });
    });

    /** @type {Promise<void>} */
    let confirmPromise;
    act(() => {
      confirmPromise = result.current.confirmContinuation();
    });
    expect(result.current.dialogState.isSubmitting).toBe(true);

    act(() => {
      result.current[handlerName]();
    });
    expect(result.current.dialogState.isOpen).toBe(false);

    await act(async () => {
      deferred.resolve({
        kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADDED,
        contentType: 'event',
        targetId: 'event-1',
        uid: 'runner-uid',
      });
      await confirmPromise;
    });

    expect(onFavoriteAdded).not.toHaveBeenCalled();
    expect(onFavoriteAddFailed).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it.each([
    ['cancel', 'cancelContinuation'],
    ['close', 'closeContinuation'],
  ])('aborts production-like continuation side effects after %s while pending', async (
    _label,
    handlerName,
  ) => {
    const signInDeferred = createDeferred();
    const addFavorite = vi.fn().mockResolvedValue(undefined);
    const runContinuation = vi.fn(async (request, { signal } = {}) => {
      const authResult = await signInDeferred.promise;
      if (signal?.aborted) {
        return {
          kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_CANCELLED,
          contentType: request.contentType,
          targetId: request.targetId,
          uid: null,
        };
      }

      await addFavorite({
        uid: authResult.user.uid,
        type: request.contentType,
        targetId: request.targetId,
      });
      return {
        kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADDED,
        contentType: request.contentType,
        targetId: request.targetId,
        uid: authResult.user.uid,
      };
    });
    const { result, showToast, onFavoriteAdded, onFavoriteAddFailed } =
      renderUseFavoriteLoginContinuation({ runContinuation });

    act(() => {
      result.current.openContinuation({ contentType: 'event', targetId: 'event-1' });
    });

    /** @type {Promise<void>} */
    let confirmPromise;
    act(() => {
      confirmPromise = result.current.confirmContinuation();
    });
    expect(result.current.dialogState.isSubmitting).toBe(true);

    act(() => {
      result.current[handlerName]();
    });

    await act(async () => {
      signInDeferred.resolve(createGoogleAuthResult({ uid: 'runner-uid' }));
      await confirmPromise;
    });

    expect(addFavorite).not.toHaveBeenCalled();
    expect(onFavoriteAdded).not.toHaveBeenCalled();
    expect(onFavoriteAddFailed).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe('useFavoriteLoginContinuation confirm flow', () => {
  it('ignores duplicate confirm requests while the first confirmation is pending', async () => {
    const deferred = createDeferred();
    const { result, showToast, onFavoriteAdded, runContinuation } =
      renderUseFavoriteLoginContinuation();
    runContinuation.mockReturnValue(deferred.promise);

    act(() => {
      result.current.openContinuation({ contentType: 'post', targetId: 'post-1' });
    });

    /** @type {Promise<void>} */
    let firstConfirmPromise;
    /** @type {Promise<void>} */
    let secondConfirmPromise;
    act(() => {
      firstConfirmPromise = result.current.confirmContinuation();
      secondConfirmPromise = result.current.confirmContinuation();
    });

    expect(result.current.dialogState).toMatchObject({
      isOpen: true,
      contentType: 'post',
      isSubmitting: true,
    });
    expect(runContinuation.mock.calls.length).toBe(1);

    await act(async () => {
      deferred.resolve({
        kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADDED,
        contentType: 'post',
        targetId: 'post-1',
        uid: 'runner-uid',
      });
      await Promise.all([firstConfirmPromise, secondConfirmPromise]);
    });

    expect(result.current.dialogState.isOpen).toBe(false);
    expect(onFavoriteAdded.mock.calls).toEqual([
      [
        {
          contentType: 'post',
          targetId: 'post-1',
        },
      ],
    ]);
    expect(showToast.mock.calls).toEqual([
      ['登入成功，已加入收藏', 'success'],
    ]);
  });

  it('exposes submitting state while confirm is pending and blocks a second pending flow', async () => {
    const deferred = createDeferred();
    const { result, runContinuation } = renderUseFavoriteLoginContinuation();
    runContinuation.mockReturnValueOnce(deferred.promise);

    act(() => {
      result.current.openContinuation({ contentType: 'event', targetId: 'event-1' });
    });

    /** @type {Promise<void>} */
    let confirmPromise;
    act(() => {
      confirmPromise = result.current.confirmContinuation();
      result.current.openContinuation({ contentType: 'post', targetId: 'post-2' });
    });

    expect(result.current.dialogState).toMatchObject({
      isOpen: true,
      contentType: 'event',
      isSubmitting: true,
    });
    expect(runContinuation.mock.calls.length).toBe(1);
    expect(runContinuation).toHaveBeenNthCalledWith(
      1,
      {
        contentType: 'event',
        targetId: 'event-1',
        copyKind: 'event',
        status: 'open',
        createdAtMs: expect.any(Number),
      },
      { signal: expect.any(AbortSignal) },
    );

    await act(async () => {
      deferred.resolve({
        kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_FAILED,
        contentType: 'event',
        targetId: 'event-1',
        uid: null,
      });
      await confirmPromise;
    });

    expect(result.current.dialogState).toMatchObject({
      isOpen: true,
      contentType: 'event',
      isSubmitting: false,
    });
  });

  it('keeps auth failures open for retry without callbacks or toast', async () => {
    const { result, showToast, onFavoriteAdded, onFavoriteAddFailed, runContinuation } =
      renderUseFavoriteLoginContinuation();
    runContinuation
      .mockResolvedValueOnce({
        kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_FAILED,
        contentType: 'event',
        targetId: 'event-1',
        uid: null,
      })
      .mockResolvedValueOnce({
        kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADDED,
        contentType: 'event',
        targetId: 'event-1',
        uid: 'runner-uid',
      });

    act(() => {
      result.current.openContinuation({ contentType: 'event', targetId: 'event-1' });
    });

    await act(async () => {
      await result.current.confirmContinuation();
    });

    expect(result.current.dialogState).toMatchObject({
      isOpen: true,
      isSubmitting: false,
    });
    expect(showToast).not.toHaveBeenCalled();
    expect(onFavoriteAdded).not.toHaveBeenCalled();
    expect(onFavoriteAddFailed).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmContinuation();
    });

    expect(result.current.dialogState.isOpen).toBe(false);
    expect(onFavoriteAdded).toHaveBeenCalledWith({
      contentType: 'event',
      targetId: 'event-1',
    });
    expect(showToast).toHaveBeenCalledWith('登入成功，已加入收藏', 'success');
  });

  it('clears on favorite success and calls the success callback', async () => {
    const { result, showToast, onFavoriteAdded, onFavoriteAddFailed, runContinuation } =
      renderUseFavoriteLoginContinuation();
    runContinuation.mockResolvedValueOnce({
      kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADDED,
      contentType: 'post',
      targetId: 'post-1',
      uid: 'runner-uid',
    });

    act(() => {
      result.current.openContinuation({ contentType: 'post', targetId: 'post-1' });
    });
    await act(async () => {
      await result.current.confirmContinuation();
    });

    expect(result.current.dialogState.isOpen).toBe(false);
    expect(onFavoriteAdded).toHaveBeenCalledWith({
      contentType: 'post',
      targetId: 'post-1',
    });
    expect(onFavoriteAddFailed).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('登入成功，已加入收藏', 'success');
  });

  it('clears on favorite add failure and calls the failure callback', async () => {
    const { result, showToast, onFavoriteAdded, onFavoriteAddFailed, runContinuation } =
      renderUseFavoriteLoginContinuation();
    runContinuation.mockResolvedValueOnce({
      kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADD_FAILED,
      contentType: 'event',
      targetId: 'event-1',
      uid: 'runner-uid',
      error: new Error('add failed'),
    });

    act(() => {
      result.current.openContinuation({ contentType: 'event', targetId: 'event-1' });
    });
    await act(async () => {
      await result.current.confirmContinuation();
    });

    expect(result.current.dialogState.isOpen).toBe(false);
    expect(onFavoriteAdded).not.toHaveBeenCalled();
    expect(onFavoriteAddFailed).toHaveBeenCalledWith({
      contentType: 'event',
      targetId: 'event-1',
    });
    expect(showToast).toHaveBeenCalledWith('收藏失敗，請稍後再試', 'error');
  });
});
