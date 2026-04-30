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

vi.mock('@/runtime/providers/AuthProvider', async () => {
  const { createContext } = await import('react');
  return {
    AuthContext: createContext({ user: null, loading: true }),
    default: ({ children }) => children,
  };
});

import { AuthContext } from '@/runtime/providers/AuthProvider';
import CallbackPage from '@/app/runs/callback/page';

/**
 * 包入指定 AuthContext value 的 wrapper render。
 * @param {{user: object | null, loading: boolean}} authValue - 模擬 AuthContext value（測試只用 user/loading 兩欄）。
 * @returns {ReturnType<typeof render>} render result。
 */
function renderWithAuth(authValue) {
  // 補滿 AuthContextValue 完整 shape 以滿足 type-check（測試本身只用 user/loading）。
  const value = /** @type {import('@/runtime/providers/AuthProvider').AuthContextValue} */ (
    /** @type {unknown} */ ({ ...authValue, setUser: () => {} })
  );
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
      user: {
        uid: 'user-1',
        getIdToken: vi.fn().mockResolvedValue('id-token-1'),
      },
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
      user: { uid: 'user-1', getIdToken: vi.fn() },
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
      user: {
        uid: 'user-1',
        getIdToken: vi.fn().mockResolvedValue('id-token-1'),
      },
      loading: false,
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('連結失敗：伺服器回應錯誤，請稍後再試。');
    });
  });
});
