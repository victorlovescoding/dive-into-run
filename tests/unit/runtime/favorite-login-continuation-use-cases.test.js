import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  runFavoriteLoginContinuation,
  FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS,
} from '@/runtime/client/use-cases/favorite-login-continuation-use-cases';
import {
  createDeferred,
  createFavoriteContinuationRequest,
  createGoogleAuthResult,
} from '../../_helpers/favorite-login-continuation-helpers';

let signIn;
let addFavorite;

beforeEach(() => {
  vi.clearAllMocks();
  signIn = vi.fn().mockResolvedValue(createGoogleAuthResult({ uid: 'runner-uid' }));
  addFavorite = vi.fn().mockResolvedValue({ targetId: 'event-1' });
});

describe('runFavoriteLoginContinuation Google auth path', () => {
  it('signs in with Google only when the continuation use case is run', async () => {
    expect(signIn).not.toHaveBeenCalled();

    const result = await runFavoriteLoginContinuation(
      createFavoriteContinuationRequest({ contentType: 'event', targetId: ' event-1 ' }),
      { signIn, addFavorite },
    );

    expect(signIn.mock.calls.length).toBe(1);
    expect(signIn.mock.calls[0]).toEqual([]);
    expect(addFavorite).toHaveBeenLastCalledWith({
      uid: 'runner-uid',
      type: 'event',
      targetId: 'event-1',
    });
    expect(result).toEqual({
      kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADDED,
      contentType: 'event',
      targetId: 'event-1',
      uid: 'runner-uid',
    });
  });

  it('does not import or call email/password auth, full login redirect, or favorite removal', async () => {
    const source = readFileSync(
      `${process.cwd()}/src/runtime/client/use-cases/favorite-login-continuation-use-cases.js`,
      'utf8',
    );

    await runFavoriteLoginContinuation(
      createFavoriteContinuationRequest({ contentType: 'post', targetId: 'post-1' }),
      { signIn, addFavorite },
    );

    expect(source).not.toMatch(/signInWithEmail|password|useRouter|router\.push|\/login/);
    expect(source).not.toMatch(/removeContentFavorite/);
  });
});

describe('runFavoriteLoginContinuation auth failure mapping', () => {
  it('does not add a favorite when cancellation happens before sign-in resolves', async () => {
    const deferred = createDeferred();
    const controller = new AbortController();
    signIn.mockReturnValueOnce(deferred.promise);

    const resultPromise = runFavoriteLoginContinuation(createFavoriteContinuationRequest(), {
      signIn,
      addFavorite,
      signal: controller.signal,
    });

    controller.abort();
    deferred.resolve(createGoogleAuthResult({ uid: 'runner-uid' }));

    await expect(resultPromise).resolves.toEqual({
      kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_CANCELLED,
      contentType: 'event',
      targetId: 'event-1',
      uid: null,
    });
    expect(addFavorite).not.toHaveBeenCalled();
  });

  it.each([
    ['popup closed', 'auth/popup-closed-by-user'],
    ['popup cancelled', 'auth/cancelled-popup-request'],
  ])('maps %s to auth-cancelled without adding a favorite', async (_label, code) => {
    signIn.mockRejectedValueOnce(Object.assign(new Error(code), { code }));

    const result = await runFavoriteLoginContinuation(createFavoriteContinuationRequest(), {
      signIn,
      addFavorite,
    });

    expect(result).toEqual({
      kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_CANCELLED,
      contentType: 'event',
      targetId: 'event-1',
      uid: null,
    });
    expect(addFavorite).not.toHaveBeenCalled();
  });

  it('maps auth rejection and missing uid to auth-failed without adding a favorite', async () => {
    signIn.mockRejectedValueOnce(new Error('network unavailable'));

    await expect(
      runFavoriteLoginContinuation(createFavoriteContinuationRequest(), { signIn, addFavorite }),
    ).resolves.toMatchObject({
        kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_FAILED,
        uid: null,
      });
    expect(addFavorite).not.toHaveBeenCalled();

    signIn.mockResolvedValueOnce(createGoogleAuthResult({ uid: null }));

    await expect(
      runFavoriteLoginContinuation(createFavoriteContinuationRequest(), { signIn, addFavorite }),
    ).resolves.toMatchObject({
        kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_FAILED,
        uid: null,
      });
    expect(addFavorite).not.toHaveBeenCalled();
  });

  it('treats a whitespace uid as auth failed without adding a favorite', async () => {
    signIn.mockResolvedValueOnce(createGoogleAuthResult({ uid: '   ' }));

    const result = await runFavoriteLoginContinuation(
      createFavoriteContinuationRequest({ contentType: 'post', targetId: 'post-1' }),
      { signIn, addFavorite },
    );

    expect(result).toEqual({
      kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.AUTH_FAILED,
      contentType: 'post',
      targetId: 'post-1',
      uid: null,
    });
    expect(addFavorite).not.toHaveBeenCalled();
  });
});

describe('runFavoriteLoginContinuation favorite add path', () => {
  it('treats repeated add of an already-favorited target as idempotent success', async () => {
    addFavorite
      .mockResolvedValueOnce({ targetId: 'post-1' })
      .mockResolvedValueOnce({ targetId: 'post-1' });

    const firstResult = await runFavoriteLoginContinuation(
      createFavoriteContinuationRequest({ contentType: 'post', targetId: 'post-1' }),
      { signIn, addFavorite },
    );
    const secondResult = await runFavoriteLoginContinuation(
      createFavoriteContinuationRequest({ contentType: 'post', targetId: 'post-1' }),
      { signIn, addFavorite },
    );

    expect(firstResult.kind).toBe(FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADDED);
    expect(secondResult.kind).toBe(FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADDED);
    expect(addFavorite.mock.calls.length).toBe(2);
    expect(addFavorite).toHaveBeenNthCalledWith(1, {
      uid: 'runner-uid',
      type: 'post',
      targetId: 'post-1',
    });
    expect(addFavorite).toHaveBeenNthCalledWith(2, {
      uid: 'runner-uid',
      type: 'post',
      targetId: 'post-1',
    });
  });

  it('maps favorite add failure without throwing and without removal fallback', async () => {
    const addError = new Error('Firestore unavailable');
    addFavorite.mockRejectedValueOnce(addError);

    const result = await runFavoriteLoginContinuation(
      createFavoriteContinuationRequest({ contentType: 'event', targetId: 'event-2' }),
      { signIn, addFavorite },
    );

    expect(result).toEqual({
      kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADD_FAILED,
      contentType: 'event',
      targetId: 'event-2',
      uid: 'runner-uid',
      error: addError,
    });
  });

  it('normalizes the add failure result after auth succeeds', async () => {
    const addError = new Error('permission denied');
    addFavorite.mockRejectedValueOnce(addError);

    const result = await runFavoriteLoginContinuation(
      createFavoriteContinuationRequest({ contentType: 'post', targetId: ' post-7 ' }),
      { signIn, addFavorite },
    );

    expect(addFavorite).toHaveBeenLastCalledWith({
      uid: 'runner-uid',
      type: 'post',
      targetId: 'post-7',
    });
    expect(result).toEqual({
      kind: FAVORITE_LOGIN_CONTINUATION_RESULT_KINDS.FAVORITE_ADD_FAILED,
      contentType: 'post',
      targetId: 'post-7',
      uid: 'runner-uid',
      error: addError,
    });
  });
});
