/**
 * @file Integration Test for OAuth Callback Page
 * @description
 * TDD RED phase — tests for src/app/runs/callback/page.jsx (not yet created).
 * Verifies the OAuth callback flow: reading search params, calling the API,
 * handling loading/success/error states.
 *
 * Test Cases:
 * 1. shows error when searchParams has error param
 * 2. shows error when code is missing
 * 3. shows loading state while calling API
 * 4. redirects to /runs on success
 * 5. shows error message on API failure
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. Use `@testing-library/react` for components.
 * 3. NEVER `fireEvent` — use `user-event` if interaction needed.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 * 6. AAA Pattern (Arrange, Act, Assert) is mandatory.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthContext } from '@/contexts/AuthContext';

// --- Mock next/navigation ---
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace }),
}));

// --- Mock firebase-client auth ---
const mockGetIdToken = vi.fn().mockResolvedValue('mock-id-token');

vi.mock('@/lib/firebase-client', () => ({
  auth: {
    currentUser: {
      getIdToken: (...args) => mockGetIdToken(...args),
    },
  },
}));

// --- Mock global fetch ---
vi.stubGlobal('fetch', vi.fn());
const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);

/* ==========================================================================
   Type Definitions
   ========================================================================== */

/**
 * @typedef {object} MockUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 使用者名稱。
 * @property {string} email - 使用者信箱。
 * @property {string} photoURL - 使用者大頭貼 URL。
 */

/* ==========================================================================
   Helper Functions
   ========================================================================== */

/**
 * 建立預設的 mock user 資料。
 * @param {Partial<MockUser>} [overrides] - 要覆蓋的欄位。
 * @returns {MockUser} Mock user。
 */
function createMockUser(overrides = {}) {
  return {
    uid: 'user-1',
    name: 'Alice',
    email: 'alice@test.com',
    photoURL: 'https://example.com/alice.jpg',
    ...overrides,
  };
}

/**
 * 以 AuthContext.Provider 包裝 UI 並 render。
 * @param {import('react').ReactElement} ui - 要 render 的元素。
 * @param {{ user?: object | null, loading?: boolean }} [options] - Auth 選項。
 * @returns {import('@testing-library/react').RenderResult} Render 結果。
 */
function renderWithAuth(ui, { user = null, loading = false } = {}) {
  return render(
    <AuthContext.Provider value={{ user, setUser: vi.fn(), loading }}>{ui}</AuthContext.Provider>,
  );
}

/* ==========================================================================
   Lazy import — so vi.mock() is hoisted before module loads
   ========================================================================== */

/** @returns {Promise<{ default: import('react').ComponentType }>} Callback page module. */
async function importCallbackPage() {
  return import('@/app/runs/callback/page');
}

/* ==========================================================================
   Tests
   ========================================================================== */

describe('CallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockGetIdToken.mockResolvedValue('mock-id-token');
    mockedFetch.mockReset();
  });

  it('shows error when searchParams has error param', async () => {
    // Arrange
    mockSearchParams = new URLSearchParams({ error: 'access_denied' });
    const { default: CallbackPage } = await importCallbackPage();

    // Act
    renderWithAuth(<CallbackPage />, { user: createMockUser() });

    // Assert
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/授權失敗/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /返回/ })).toHaveAttribute('href', '/runs');
  });

  it('shows error when code is missing', async () => {
    // Arrange — no code, no error in params
    mockSearchParams = new URLSearchParams();
    const { default: CallbackPage } = await importCallbackPage();

    // Act
    renderWithAuth(<CallbackPage />, { user: createMockUser() });

    // Assert
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/授權失敗/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /返回/ })).toHaveAttribute('href', '/runs');
  });

  it('shows loading state while calling API', async () => {
    // Arrange — code present, fetch never resolves
    mockSearchParams = new URLSearchParams({ code: 'valid-code' });
    mockedFetch.mockReturnValue(new Promise(() => {})); // never resolves
    const { default: CallbackPage } = await importCallbackPage();

    // Act
    renderWithAuth(<CallbackPage />, { user: createMockUser() });

    // Assert
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('calls API with correct params and redirects on success', async () => {
    // Arrange
    mockSearchParams = new URLSearchParams({ code: 'valid-code' });
    mockedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, athleteName: 'John Doe', syncedCount: 5 }),
    });
    const { default: CallbackPage } = await importCallbackPage();

    // Act
    renderWithAuth(<CallbackPage />, { user: createMockUser() });

    // Assert
    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/strava/callback',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-id-token',
          }),
          body: JSON.stringify({ code: 'valid-code' }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/runs');
    });
  });

  it('shows error message on API failure', async () => {
    // Arrange
    mockSearchParams = new URLSearchParams({ code: 'bad-code' });
    mockedFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid authorization code' }),
    });
    const { default: CallbackPage } = await importCallbackPage();

    // Act
    renderWithAuth(<CallbackPage />, { user: createMockUser() });

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/連結失敗/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /返回/ })).toHaveAttribute('href', '/runs');
  });
});
