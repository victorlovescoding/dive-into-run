// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useMemberFavoritesRuntime from '../../../src/runtime/hooks/useMemberFavoritesRuntime';
import { AuthContext } from '../../../src/runtime/providers/AuthProvider';

const mocks = vi.hoisted(() => ({
  loadContentFavoritesWithTargets: vi.fn(),
  markMemberAuthGateToastPending: vi.fn(),
  replace: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('../../../src/runtime/providers/AuthProvider', async () => {
  const { createContext } = await vi.importActual('react');
  return {
    AuthContext: createContext({ user: null, setUser: () => {}, loading: true }),
  };
});

vi.mock('../../../src/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../../src/runtime/member-auth-gate-toast', () => ({
  markMemberAuthGateToastPending: mocks.markMemberAuthGateToastPending,
}));

vi.mock('../../../src/runtime/client/use-cases/content-favorite-use-cases', () => ({
  addContentFavorite: vi.fn(),
  FAVORITE_CONTENT_TYPES: { POST: 'post', EVENT: 'event' },
  loadContentFavoritesWithTargets: mocks.loadContentFavoritesWithTargets,
  removeContentFavorite: vi.fn(),
}));

const user = {
  uid: 'runner-1',
  name: 'Runner One',
  email: 'runner@example.test',
  photoURL: null,
  bio: null,
  accountStatus: 'active',
  deletionScheduledFor: null,
  getIdToken: vi.fn(),
};

/**
 * Renders member favorites runtime with auth context values.
 * @param {{ authUser?: typeof user | null, loading?: boolean }} [options] - Auth options.
 * @returns {ReturnType<typeof renderHook>} Rendered hook utilities.
 */
function renderUseMemberFavoritesRuntime({ authUser = user, loading = false } = {}) {
  return renderHook(() => useMemberFavoritesRuntime(), {
    wrapper: ({ children }) => (
      <AuthContext.Provider value={{ user: authUser, setUser: vi.fn(), loading }}>
        {children}
      </AuthContext.Provider>
    ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadContentFavoritesWithTargets.mockResolvedValue([]);
});

describe('useMemberFavoritesRuntime auth gate', () => {
  it('redirects unauthenticated visitors without loading a fake empty favorites list', async () => {
    const { result } = renderUseMemberFavoritesRuntime({ authUser: null });

    await waitFor(() => {
      expect(mocks.markMemberAuthGateToastPending).toHaveBeenLastCalledWith();
    });

    expect(mocks.replace).toHaveBeenCalledWith('/');
    expect(mocks.loadContentFavoritesWithTargets).not.toHaveBeenCalled();
    expect(result.current.canRender).toBe(false);
  });

  it('loads favorites for authenticated visitors', async () => {
    mocks.loadContentFavoritesWithTargets.mockResolvedValue([
      { type: 'post', targetId: 'post-1', target: { title: '收藏文章' } },
    ]);

    const { result } = renderUseMemberFavoritesRuntime();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    expect(result.current.canRender).toBe(true);
    expect(mocks.loadContentFavoritesWithTargets).toHaveBeenCalledWith({
      uid: 'runner-1',
      type: 'post',
    });
  });
});
