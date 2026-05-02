import { render } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * @typedef {object} AuthContextValue
 * @property {object | null} user - Auth user object.
 * @property {(user: object | null) => void} setUser - Auth user setter.
 * @property {boolean} loading - Auth loading state.
 */

/**
 * @typedef {object} ToastContextValue
 * @property {unknown[]} toasts - Toast items.
 * @property {(message: string, type?: string, duration?: number) => unknown} showToast - Toast spy/no-op.
 * @property {(id: string) => void} removeToast - Toast removal spy/no-op.
 */

/**
 * @typedef {object} AuthToastProviderProps
 * @property {import('react').ReactNode} children - 測試目標。
 * @property {import('react').Context<AuthContextValue>} authContext - AuthContext object.
 * @property {import('react').Context<ToastContextValue | undefined>} toastContext - ToastContext object.
 * @property {AuthContextValue} authValue - AuthContext 測試值。
 * @property {ToastContextValue} toastValue - ToastContext 測試值。
 */

/**
 * @typedef {object} AuthToastRenderOptions
 * @property {import('react').Context<AuthContextValue>} authContext - AuthContext object.
 * @property {import('react').Context<ToastContextValue | undefined>} toastContext - ToastContext object.
 * @property {Partial<AuthContextValue>} [auth] - 覆寫 AuthContext 測試值。
 * @property {Partial<ToastContextValue>} [toast] - 覆寫 ToastContext 測試值。
 */

/**
 * 建立 AuthContext.Provider 的測試值；不啟動真實 AuthProvider watcher。
 * @param {Partial<AuthContextValue>} [overrides] - 覆寫欄位。
 * @returns {AuthContextValue} AuthContext 測試值。
 */
export function createTestAuthContextValue(overrides = {}) {
  return {
    user: null,
    setUser: vi.fn(),
    loading: false,
    ...overrides,
  };
}

/**
 * 建立 ToastContext.Provider 的 spy/no-op 測試值。
 * @param {Partial<ToastContextValue>} [overrides] - 覆寫欄位。
 * @returns {ToastContextValue} ToastContext 測試值。
 */
export function createTestToastContextValue(overrides = {}) {
  return {
    toasts: [],
    showToast: vi.fn(),
    removeToast: vi.fn(),
    ...overrides,
  };
}

/**
 * 只包真實 AuthContext / ToastContext，讓測試可直接 assert 回傳的 spies。
 * @param {AuthToastProviderProps} props - Provider props。
 * @returns {import('react').ReactElement} Provider tree。
 */
export function AuthToastTestProviders({
  children,
  authContext,
  toastContext,
  authValue,
  toastValue,
}) {
  const AuthProvider = authContext.Provider;
  const ToastProvider = toastContext.Provider;

  return (
    <AuthProvider value={authValue}>
      <ToastProvider value={toastValue}>{children}</ToastProvider>
    </AuthProvider>
  );
}

/**
 * 用 AuthContext.Provider + ToastContext.Provider render 測試目標。
 * @param {import('react').ReactElement} ui - 測試目標。
 * @param {AuthToastRenderOptions} options - context value 與覆寫。
 * @returns {import('@testing-library/react').RenderResult & {
 *   authValue: AuthContextValue,
 *   toastValue: ToastContextValue
 * }} render 結果與可 assert 的 context spies。
 */
export function renderWithAuthToast(ui, options) {
  const authValue = createTestAuthContextValue(options.auth);
  const toastValue = createTestToastContextValue(options.toast);

  return {
    ...render(
      <AuthToastTestProviders
        authContext={options.authContext}
        authValue={authValue}
        toastContext={options.toastContext}
        toastValue={toastValue}
      >
        {ui}
      </AuthToastTestProviders>,
    ),
    authValue,
    toastValue,
  };
}
