import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import useStravaCallbackRuntime from '@/runtime/hooks/useStravaCallbackRuntime';

const MISSING_CODE_MESSAGE = '授權失敗：未取得授權碼。';
const LOGIN_REQUIRED_MESSAGE = '連結失敗：請先登入。';
const SERVER_ERROR_MESSAGE = '連結失敗：伺服器回應錯誤，請稍後再試。';
const NETWORK_ERROR_MESSAGE = '連結失敗：網路錯誤，請稍後再試。';
const { authState, mockReplace, mockSearchParamGet, mockUseContext } = vi.hoisted(() => {
  Object.assign(process.env, {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'auth.test.example.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'storage.test.example.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:1234567890:web:test',
  });
  return {
    authState: {
      current: { user: null, loading: false, setUser() {} },
    },
    mockReplace: vi.fn(),
    mockSearchParamGet: vi.fn(),
    mockUseContext: vi.fn(),
  };
});

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());
  mockUseContext.mockImplementation(() => authState.current);
  return {
    ...actual,
    useContext: mockUseContext,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));
vi.stubGlobal('fetch', vi.fn());
/** @type {import('vitest').Mock} */
const useRouterMock = /** @type {any} */ (useRouter);
/** @type {import('vitest').Mock} */
const useSearchParamsMock = /** @type {any} */ (useSearchParams);
/** @type {import('vitest').Mock} */
const fetchMock = /** @type {any} */ (globalThis.fetch);
/**
 * @typedef {object} TestUser
 * @property {string} uid - 使用者 uid。
 * @property {string | null} name - 使用者名稱。
 * @property {string | null} email - 使用者 email。
 * @property {string | null} photoURL - 使用者頭像。
 * @property {string | null} bio - 使用者 bio。
 * @property {() => Promise<string>} getIdToken - 取得 id token。
 */
/**
 * @typedef {object} TestAuthState
 * @property {TestUser | null} user - AuthContext user。
 * @property {boolean} loading - AuthContext loading。
 */
/**
 * @typedef {object} DeferredResponse
 * @property {Promise<{ ok: boolean, json: () => Promise<object> }>} promise - 延後 resolve 的 fetch promise。
 * @property {(value: { ok: boolean, json: () => Promise<object> }) => void} resolve - resolve 函式。
 */
/**
 * 設定 search params fixture。
 * @param {{ code?: string | null, error?: string | null }} params - callback query params。
 * @returns {void}
 */
function setSearchParams(params) {
  mockSearchParamGet.mockImplementation((key) => (key === 'code' ? (params.code ?? null) : (params.error ?? null)));
}
/**
 * 建立測試用使用者。
 * @param {string} uid - 使用者 uid。
 * @param {string} token - getIdToken 回傳值。
 * @returns {TestUser} 測試使用者。
 */
function createUser(uid, token) {
  return {
    uid,
    name: `User ${uid}`,
    email: `${uid}@example.com`,
    photoURL: null,
    bio: null,
    getIdToken: vi.fn(async () => token),
  };
}
/**
 * 建立 AuthContext value。
 * @param {Partial<TestAuthState>} [overrides] - 覆寫 user / loading。
 * @returns {{ user: TestUser | null, setUser: () => void, loading: boolean }} context value。
 */
function createAuthValue(overrides = {}) {
  return {
    user: null,
    loading: false,
    setUser() {},
    ...overrides,
  };
}
/**
 * 渲染 hook 並允許後續切換 auth 狀態。
 * @param {Partial<TestAuthState>} [initialAuth] - 初始 auth 狀態。
 * @returns {object} render result。
 */
function renderRuntime(initialAuth = {}) {
  authState.current = createAuthValue(initialAuth);
  const view = renderHook(() => useStravaCallbackRuntime());
  return {
    ...view,
    setAuth(nextAuth) {
      authState.current = createAuthValue(nextAuth);
      view.rerender();
    },
  };
}
/**
 * 建立 fetch response。
 * @param {boolean} ok - response.ok。
 * @returns {{ ok: boolean, json: () => Promise<object> }} fetch response。
 */
function createResponse(ok) {
  return { ok, json: async () => ({}) };
}
/**
 * 建立可手動 resolve 的 fetch promise。
 * @returns {DeferredResponse} deferred response。
 */
function createDeferredResponse() {
  /** @type {(value: { ok: boolean, json: () => Promise<object> }) => void} */
  let resolve = () => {};
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
describe('useStravaCallbackRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReplace.mockReset();
    mockSearchParamGet.mockReset();
    fetchMock.mockReset();
    useRouterMock.mockReturnValue({ replace: mockReplace });
    useSearchParamsMock.mockReturnValue({ get: mockSearchParamGet });
    setSearchParams({});
  });
  it('shows error when error query param exists', () => {
    setSearchParams({ error: 'access_denied' });
    const { result } = renderRuntime({ user: createUser('user-1', 'token-1') });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(MISSING_CODE_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('treats missing code as an error', () => {
    const { result } = renderRuntime({ user: createUser('user-1', 'token-1') });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(MISSING_CODE_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('shows login required when auth is settled without a user', () => {
    setSearchParams({ code: 'oauth-code' });
    const { result } = renderRuntime({ user: null, loading: false });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(LOGIN_REQUIRED_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('keeps loading and does not fetch while auth is still loading', () => {
    setSearchParams({ code: 'oauth-code' });
    const { result } = renderRuntime({ user: null, loading: true });
    expect(result.current.status).toBe('loading');
    expect(result.current.errorMessage).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('posts the code and redirects to /runs on success', async () => {
    setSearchParams({ code: 'oauth-code' });
    fetchMock.mockResolvedValueOnce(createResponse(true));
    const user = createUser('user-1', 'token-1');
    const { result } = renderRuntime({ user });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/runs');
    });
    expect(user.getIdToken).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/strava/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-1',
      },
      body: JSON.stringify({ code: 'oauth-code' }),
    });
    expect(result.current.status).toBe('loading');
    expect(result.current.errorMessage).toBe('');
  });
  it('shows a server error when fetch resolves with ok=false', async () => {
    setSearchParams({ code: 'oauth-code' });
    fetchMock.mockResolvedValueOnce(createResponse(false));
    const { result } = renderRuntime({ user: createUser('user-1', 'token-1') });
    await waitFor(() => {
      expect(result.current.errorMessage).toBe(SERVER_ERROR_MESSAGE);
    });
    expect(result.current.status).toBe('error');
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('shows a network error when fetch throws', async () => {
    setSearchParams({ code: 'oauth-code' });
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderRuntime({ user: createUser('user-1', 'token-1') });
    await waitFor(() => {
      expect(result.current.errorMessage).toBe(NETWORK_ERROR_MESSAGE);
    });
    expect(result.current.status).toBe('error');
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('retries when requestKey changes after a previous failure', async () => {
    setSearchParams({ code: 'oauth-code' });
    fetchMock
      .mockResolvedValueOnce(createResponse(false))
      .mockResolvedValueOnce(createResponse(true));
    const view = renderRuntime({ user: createUser('user-1', 'token-1') });
    await waitFor(() => {
      expect(view.result.current.errorMessage).toBe(SERVER_ERROR_MESSAGE);
    });
    expect(mockReplace).not.toHaveBeenCalled();
    view.setAuth({ user: createUser('user-2', 'token-2') });
    await waitFor(() => {
      expect(fetchMock.mock.calls[1]).toBeDefined();
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/runs');
    });

    expect(fetchMock.mock.calls[1][1]).toEqual({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-2',
      },
      body: JSON.stringify({ code: 'oauth-code' }),
    });
  });
  it('does not surface async failure after unmount', async () => {
    setSearchParams({ code: 'oauth-code' });
    const deferred = createDeferredResponse();
    fetchMock.mockReturnValueOnce(deferred.promise);
    const { result, unmount } = renderRuntime({ user: createUser('user-1', 'token-1') });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    unmount();
    await act(async () => {
      deferred.resolve(createResponse(false));
      await deferred.promise;
    });

    expect(result.current.status).toBe('loading');
    expect(result.current.errorMessage).toBe('');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
