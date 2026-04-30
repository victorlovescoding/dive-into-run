/*
 * Service-level unit test for `@/service/auth-service`.
 *
 * 這裡允許 mock `@/repo/client/firebase-auth-repo`，目的不是測 repo 行為，
 * 而是驗證 service facade 的 named re-export 是否直接透出 repo binding。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEnsureUserProfileDocument,
  mockSubscribeToAuthChanges,
  mockWatchUserProfileDocument,
} = vi.hoisted(() => ({
  mockEnsureUserProfileDocument: vi.fn().mockResolvedValue(undefined),
  mockSubscribeToAuthChanges: vi.fn(() => vi.fn()),
  mockWatchUserProfileDocument: vi.fn(() => vi.fn()),
}));

vi.mock(import('@/repo/client/firebase-auth-repo'), () => ({
  ensureUserProfileDocument: mockEnsureUserProfileDocument,
  subscribeToAuthChanges: mockSubscribeToAuthChanges,
  watchUserProfileDocument: mockWatchUserProfileDocument,
}));

/** @type {import('vitest').Mock} */
const ensureUserProfileDocumentMock = /** @type {any} */ (mockEnsureUserProfileDocument);
/** @type {import('vitest').Mock} */
const subscribeToAuthChangesMock = /** @type {any} */ (mockSubscribeToAuthChanges);
/** @type {import('vitest').Mock} */
const watchUserProfileDocumentMock = /** @type {any} */ (mockWatchUserProfileDocument);

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * 建立模擬的 Firebase Auth user。
 * @param {object} overrides - 覆寫欄位。
 * @param {string} [overrides.uid] - 使用者 uid。
 * @param {() => Promise<string>} [overrides.getIdToken] - getIdToken thunk。
 * @returns {import('firebase/auth').User} 模擬使用者物件。
 */
function createFbUser(overrides = {}) {
  const fbUser = {
    uid: overrides.uid ?? 'uid-1',
    getIdToken: overrides.getIdToken ?? vi.fn().mockResolvedValue('id-token'),
  };
  return /** @type {import('firebase/auth').User} */ (/** @type {unknown} */ (fbUser));
}

describe('createAuthUser', () => {
  it('happy path: 完整 profileData 對齊到回傳物件', async () => {
    const { createAuthUser } = await import('@/service/auth-service');
    const getIdToken = vi.fn().mockResolvedValue('jwt-token');
    const fbUser = createFbUser({ uid: 'user-42', getIdToken });

    const result = createAuthUser(fbUser, {
      name: 'Amy',
      email: 'amy@example.com',
      photoURL: 'https://img/amy.png',
      bio: 'runner',
    });

    expect(result).toEqual({
      uid: 'user-42',
      name: 'Amy',
      email: 'amy@example.com',
      photoURL: 'https://img/amy.png',
      bio: 'runner',
      getIdToken: expect.any(Function),
    });
  });

  it('profileData 為 null：name / email / photoURL / bio 全部 fallback 為 null', async () => {
    const { createAuthUser } = await import('@/service/auth-service');
    const fbUser = createFbUser({ uid: 'user-null' });

    const result = createAuthUser(fbUser, null);

    expect(result).toEqual({
      uid: 'user-null',
      name: null,
      email: null,
      photoURL: null,
      bio: null,
      getIdToken: expect.any(Function),
    });
  });

  it('profileData 缺欄位（部分 undefined）：缺的欄位 fallback 為 null', async () => {
    const { createAuthUser } = await import('@/service/auth-service');
    const fbUser = createFbUser({ uid: 'user-partial' });

    const result = createAuthUser(fbUser, {
      name: 'Bob',
      email: 'bob@example.com',
    });

    expect(result).toEqual({
      uid: 'user-partial',
      name: 'Bob',
      email: 'bob@example.com',
      photoURL: null,
      bio: null,
      getIdToken: expect.any(Function),
    });
  });

  it('getIdToken 是 thunk，呼叫後 forward 至 fbUser.getIdToken 並回傳結果', async () => {
    const { createAuthUser } = await import('@/service/auth-service');
    const getIdToken = vi.fn().mockResolvedValue('forwarded-token');
    const fbUser = createFbUser({ uid: 'user-thunk', getIdToken });

    const result = createAuthUser(fbUser, null);

    expect(getIdToken).not.toHaveBeenCalled();

    const token = await result.getIdToken();

    expect(getIdToken).toHaveBeenCalledOnce();
    expect(getIdToken).toHaveBeenLastCalledWith();
    expect(token).toBe('forwarded-token');
  });
});

describe('auth-service re-exports', () => {
  it('ensureUserProfileDocument 直接透出 repo facade', async () => {
    const serviceModule = await import('@/service/auth-service');
    const fbUser = createFbUser({ uid: 'facade-user' });

    await serviceModule.ensureUserProfileDocument(fbUser);

    expect(serviceModule.ensureUserProfileDocument).toBe(ensureUserProfileDocumentMock);
    expect(ensureUserProfileDocumentMock).toHaveBeenCalledOnce();
    expect(ensureUserProfileDocumentMock).toHaveBeenLastCalledWith(fbUser);
  });

  it('subscribeToAuthChanges 直接透出 repo facade', async () => {
    const serviceModule = await import('@/service/auth-service');
    const callback = vi.fn();

    serviceModule.subscribeToAuthChanges(callback);

    expect(serviceModule.subscribeToAuthChanges).toBe(subscribeToAuthChangesMock);
    expect(subscribeToAuthChangesMock).toHaveBeenCalledOnce();
    expect(subscribeToAuthChangesMock).toHaveBeenLastCalledWith(callback);
  });

  it('watchUserProfileDocument 直接透出 repo facade', async () => {
    const serviceModule = await import('@/service/auth-service');
    const onData = vi.fn();
    const onError = vi.fn();

    serviceModule.watchUserProfileDocument('user-1', onData, onError);

    expect(serviceModule.watchUserProfileDocument).toBe(watchUserProfileDocumentMock);
    expect(watchUserProfileDocumentMock).toHaveBeenCalledOnce();
    expect(watchUserProfileDocumentMock).toHaveBeenLastCalledWith('user-1', onData, onError);
  });
});
