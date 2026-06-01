import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AccountDeletionGate from './AccountDeletionGate';
import { AuthContext } from './AuthProvider';
import { ToastContext } from './ToastProvider';

vi.mock('@/runtime/client/use-cases/account-deletion-use-cases', () => ({
  cancelAccountDeletion: vi.fn(),
  signOutUser: vi.fn(),
}));

vi.mock('@/runtime/client/use-cases/auth-use-cases', () => ({
  default: vi.fn(() => () => {}),
}));

/**
 * Renders the gate with focused provider doubles.
 * @param {object} [params] - Auth context overrides.
 * @param {boolean} [params.loading] - Auth loading state.
 * @param {import('./AuthProvider').AuthContextValue['user']} [params.user] - Auth user value.
 * @returns {void}
 */
function renderGate({ loading = true, user = null } = {}) {
  render(
    <AuthContext.Provider value={{ user, setUser: vi.fn(), loading }}>
      <ToastContext.Provider value={{ toasts: [], showToast: vi.fn(), removeToast: vi.fn() }}>
        <AccountDeletionGate>
          <div>App content</div>
        </AccountDeletionGate>
      </ToastContext.Provider>
    </AuthContext.Provider>,
  );
}

describe('AccountDeletionGate loading state', () => {
  it('renders an accessible visual loader without the old visible loading copy', () => {
    renderGate();

    const status = screen.getByRole('status', { name: '正在確認帳號狀態' });

    expect(status).toBeInTheDocument();
    expect(screen.queryByText('載入帳號狀態...')).not.toBeInTheDocument();
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('account-gate-runner-dot')).toHaveLength(1);
    expect(screen.getAllByTestId('account-gate-pulse-dot')).toHaveLength(3);
  });
});
