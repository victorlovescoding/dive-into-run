'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildFavoriteLoginContinuationDialogState,
  FAVORITE_LOGIN_CONTINUATION_STATUSES,
  openFavoriteLoginContinuationIntent,
  setFavoriteLoginContinuationStatus,
} from '@/runtime/favorites/favorite-login-continuation-helpers';
import {
  FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS,
  runFavoriteLoginContinuation,
} from '@/runtime/client/use-cases/favorite-login-continuation-use-cases';

const FAVORITE_ADDED_TOAST = '登入成功，已加入收藏';
const FAVORITE_ADD_FAILED_TOAST = '收藏失敗，請稍後再試';

/**
 * @typedef {import('@/runtime/favorites/favorite-login-continuation-helpers').FavoriteLoginContinuationIntent}
 *   FavoriteLoginContinuationIntent
 * @typedef {{
 *   showToast?: (message: string, type?: string) => void,
 *   onFavoriteAdded?: (payload: { contentType: string, targetId: string }) => void,
 *   onFavoriteAddFailed?: (payload: { contentType: string, targetId: string }) => void,
 *   runContinuation?: typeof runFavoriteLoginContinuation
 * }} UseFavoriteLoginContinuationOptions
 */

/**
 * Manages the in-memory unauthenticated favorite login continuation flow.
 * @param {UseFavoriteLoginContinuationOptions} [options] - Hook collaborators.
 * @returns {{
 *   dialogState: ReturnType<typeof buildFavoriteLoginContinuationDialogState>,
 *   openContinuation: (request: { contentType: unknown, targetId: unknown }) => void,
 *   confirmContinuation: () => Promise<void>,
 *   cancelContinuation: () => void,
 *   closeContinuation: () => void
 * }} Favorite login continuation runtime.
 */
export default function useFavoriteLoginContinuation({
  showToast,
  onFavoriteAdded,
  onFavoriteAddFailed,
  runContinuation = runFavoriteLoginContinuation,
} = {}) {
  const [intent, setIntent] = useState(/** @type {FavoriteLoginContinuationIntent | null} */ (null));
  const runTokenRef = useRef(0);
  const isRunningRef = useRef(false);
  const abortControllerRef = useRef(/** @type {AbortController | null} */ (null));

  const dialogState = useMemo(
    () => buildFavoriteLoginContinuationDialogState(intent),
    [intent],
  );

  const openContinuation = useCallback((request) => {
    setIntent((currentIntent) =>
      openFavoriteLoginContinuationIntent(currentIntent, request),
    );
  }, []);

  const clearContinuation = useCallback(() => {
    runTokenRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isRunningRef.current = false;
    setIntent(null);
  }, []);

  const confirmContinuation = useCallback(async () => {
    if (
      !intent ||
      intent.status !== FAVORITE_LOGIN_CONTINUATION_STATUSES.OPEN ||
      isRunningRef.current
    ) {
      return;
    }

    const activeIntent = intent;
    const runToken = runTokenRef.current + 1;
    const abortController = new AbortController();
    runTokenRef.current = runToken;
    isRunningRef.current = true;
    abortControllerRef.current = abortController;
    setIntent((currentIntent) => {
      if (currentIntent !== activeIntent) return currentIntent;
      return setFavoriteLoginContinuationStatus(
        currentIntent,
        FAVORITE_LOGIN_CONTINUATION_STATUSES.AUTHENTICATING,
      );
    });

    let result;
    try {
      result = await runContinuation(activeIntent, { signal: abortController.signal });
    } catch {
      if (runTokenRef.current !== runToken) return;
      abortControllerRef.current = null;
      isRunningRef.current = false;
      setIntent((currentIntent) => {
        if (!currentIntent) return currentIntent;
        return setFavoriteLoginContinuationStatus(
          currentIntent,
          FAVORITE_LOGIN_CONTINUATION_STATUSES.OPEN,
        );
      });
      return;
    }

    if (runTokenRef.current !== runToken) return;

    if (
      result.kind === FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_CANCELLED ||
      result.kind === FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_FAILED
    ) {
      abortControllerRef.current = null;
      isRunningRef.current = false;
      setIntent((currentIntent) => {
        if (!currentIntent) return currentIntent;
        return setFavoriteLoginContinuationStatus(
          currentIntent,
          FAVORITE_LOGIN_CONTINUATION_STATUSES.OPEN,
        );
      });
      return;
    }

    abortControllerRef.current = null;
    isRunningRef.current = false;
    setIntent(null);

    const payload = {
      contentType: result.contentType,
      targetId: result.targetId,
    };

    if (result.kind === FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADDED) {
      onFavoriteAdded?.(payload);
      showToast?.(FAVORITE_ADDED_TOAST, 'success');
      return;
    }

    if (result.kind === FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADD_FAILED) {
      onFavoriteAddFailed?.(payload);
      showToast?.(FAVORITE_ADD_FAILED_TOAST, 'error');
    }
  }, [intent, onFavoriteAddFailed, onFavoriteAdded, runContinuation, showToast]);

  return {
    dialogState,
    openContinuation,
    confirmContinuation,
    cancelContinuation: clearContinuation,
    closeContinuation: clearContinuation,
  };
}
