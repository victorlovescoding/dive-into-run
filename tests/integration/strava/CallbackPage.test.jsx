import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSearchParams, mockRouter } = vi.hoisted(() => ({
  mockSearchParams: { get: vi.fn() },
  mockRouter: { replace: vi.fn(), push: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => mockRouter,
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
    this.setCustomParameters = vi.fn();
  }),
  connectAuthEmulator: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  signInWithPopup: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  connectStorageEmulator: vi.fn(),
}));

import { AuthContext } from '@/runtime/providers/AuthProvider';
import CallbackPage from '@/app/runs/callback/page';
import { createTestAuthContextValue } from '../../_helpers/provider-test-helpers';

/**
 * 建立符合 AuthContextValue user 契約的測試使用者。
 * @param {Partial<NonNullable<import('@/runtime/providers/AuthProvider').AuthContextValue['user']>>} [overrides] - 使用者欄位覆寫。
 * @returns {NonNullable<import('@/runtime/providers/AuthProvider').AuthContextValue['user']>} 測試使用者。
 */
function createTestUser(overrides = {}) {
  return {
    uid: 'user-1',
    name: 'Test User',
    email: null,
    photoURL: null,
    bio: null,
    getIdToken: vi.fn().mockResolvedValue('id-token-1'),
    ...overrides,
  };
}

/**
 * 包入指定 AuthContext value 的 wrapper render。
 * @param {Partial<import('@/runtime/providers/AuthProvider').AuthContextValue>} authValue - AuthContext 測試值覆寫。
 * @returns {ReturnType<typeof render>} render result。
 */
function renderWithAuth(authValue) {
  const value = createTestAuthContextValue(authValue);
  return render(
    <AuthContext.Provider value={value}>
      <CallbackPage />
    </AuthContext.Provider>,
  );
}

describe('CallbackPage', () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let fetchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.get.mockReturnValue(null);
    fetchSpy = vi.fn();
    globalThis.fetch = /** @type {typeof globalThis.fetch} */ (/** @type {unknown} */ (fetchSpy));
  });

  it('loading 狀態：authLoading 中且 fetch 永不 resolve 時顯示連結中訊息', async () => {
    // 有 code 且 user 已登入但 fetch 永不 resolve → status 留在 loading
    mockSearchParams.get.mockImplementation((key) => (key === 'code' ? 'auth-code-123' : null));
    fetchSpy.mockReturnValue(new Promise(() => {})); // never resolve

    renderWithAuth({
      user: createTestUser(),
      loading: false,
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('正在連結 Strava 帳號...')).toBeInTheDocument();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    // 確認真實 runtime 用正確的 endpoint + headers
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/strava/callback',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer id-token-1',
        }),
      }),
    );
  });

  it('授權失敗：URL 含 error 時顯示「未取得授權碼」', () => {
    mockSearchParams.get.mockImplementation((key) => (key === 'error' ? 'access_denied' : null));

    renderWithAuth({
      user: createTestUser({ getIdToken: vi.fn() }),
      loading: false,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('授權失敗：未取得授權碼。');
  });

  it('連結失敗：未登入且不在判斷中時顯示「請先登入」', () => {
    mockSearchParams.get.mockImplementation((key) => (key === 'code' ? 'auth-code-123' : null));

    renderWithAuth({ user: null, loading: false });

    expect(screen.getByRole('alert')).toHaveTextContent('連結失敗：請先登入。');
  });

  it('連結失敗：fetch ok=false 時顯示伺服器錯誤訊息', async () => {
    mockSearchParams.get.mockImplementation((key) => (key === 'code' ? 'auth-code-123' : null));
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    renderWithAuth({
      user: createTestUser(),
      loading: false,
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('連結失敗：伺服器回應錯誤，請稍後再試。');
    });
  });
});
