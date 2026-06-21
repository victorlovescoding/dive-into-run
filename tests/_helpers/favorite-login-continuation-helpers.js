import { vi } from 'vitest';

export const FAVORITE_LOGIN_TEST_COPY = Object.freeze({
  title: '登入後即可收藏',
  eventBody: '登入後會自動將這個活動加入收藏。',
  postBody: '登入後會自動將這篇文章加入收藏。',
  primaryLabel: '使用 Google 登入',
  secondaryLabel: '稍後再說',
});

/**
 * Creates a favorite continuation request fixture.
 * @param {object} [overrides] - Request overrides.
 * @returns {{ contentType: string, targetId: string }} Favorite continuation request.
 */
export function createFavoriteContinuationRequest(overrides = {}) {
  return {
    contentType: 'event',
    targetId: 'event-1',
    ...overrides,
  };
}

/**
 * Creates a normalized favorite continuation intent fixture.
 * @param {object} [overrides] - Intent overrides.
 * @returns {{ contentType: string, targetId: string, copyKind: string, status: string, createdAtMs: number }}
 *   Favorite continuation intent.
 */
export function createFavoriteContinuationIntent(overrides = {}) {
  return {
    contentType: 'event',
    targetId: 'event-1',
    copyKind: 'event',
    status: 'open',
    createdAtMs: 1700000000000,
    ...overrides,
  };
}

/**
 * Creates the dialog state passed to the reusable dialog.
 * @param {object} [overrides] - Dialog state overrides.
 * @returns {{
 *   isOpen: boolean,
 *   contentType: string,
 *   title: string,
 *   body: string,
 *   primaryLabel: string,
 *   secondaryLabel: string,
 *   isSubmitting: boolean
 * }} Dialog render state.
 */
export function createFavoriteLoginDialogState(overrides = {}) {
  return {
    isOpen: true,
    contentType: 'event',
    title: FAVORITE_LOGIN_TEST_COPY.title,
    body: FAVORITE_LOGIN_TEST_COPY.eventBody,
    primaryLabel: FAVORITE_LOGIN_TEST_COPY.primaryLabel,
    secondaryLabel: FAVORITE_LOGIN_TEST_COPY.secondaryLabel,
    isSubmitting: false,
    ...overrides,
  };
}

/**
 * Creates a Firebase UserCredential-like Google auth result.
 * @param {object} [options] - Auth result options.
 * @param {string | null} [options.uid] - Signed-in uid, or null for missing uid.
 * @returns {{ user: { uid: string, displayName: string } | null }} Auth result.
 */
export function createGoogleAuthResult({ uid = 'runner-uid' } = {}) {
  return {
    user: uid
      ? {
        uid,
        displayName: 'Runner One',
      }
      : null,
  };
}

/**
 * Creates toast spy used by continuation hook tests.
 * @returns {import('vitest').Mock} Toast spy.
 */
export function createToastSpy() {
  return vi.fn();
}

/**
 * Creates success and failure callbacks used by continuation hook tests.
 * @returns {{ onFavoriteAdded: import('vitest').Mock, onFavoriteAddFailed: import('vitest').Mock }}
 *   Callback spies.
 */
export function createFavoriteContinuationCallbacks() {
  return {
    onFavoriteAdded: vi.fn(),
    onFavoriteAddFailed: vi.fn(),
  };
}

/**
 * Creates a manually controlled promise for pending-state assertions.
 * @returns {{
 *   promise: Promise<unknown>,
 *   resolve: (value: unknown) => void,
 *   reject: (reason?: unknown) => void
 * }} Deferred promise controls.
 */
export function createDeferred() {
  /** @type {(value: unknown) => void} */
  let resolve;
  /** @type {(reason?: unknown) => void} */
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}
