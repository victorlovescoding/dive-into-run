import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MEMBER_AUTH_GATE_TOAST_MESSAGE,
  MEMBER_AUTH_GATE_TOAST_STORAGE_KEY,
  consumeMemberAuthGateToastPending,
  markMemberAuthGateToastPending,
} from './member-auth-gate-toast';

/**
 * Installs a sessionStorage mock with overridable storage operations.
 * @param {Partial<Storage>} [overrides] - Storage operation overrides.
 * @returns {Storage} Mocked session storage.
 */
function mockSessionStorage(overrides = {}) {
  const storage = {
    clear: vi.fn(),
    getItem: vi.fn(() => null),
    key: vi.fn(() => null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
    length: 0,
    ...overrides,
  };

  vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(storage);
  return storage;
}

describe('member auth gate toast storage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('exports the exact login-required toast message', () => {
    expect(MEMBER_AUTH_GATE_TOAST_MESSAGE).toBe('請先登入才能進入會員中心');
  });

  it('marks and consumes one pending login-required toast', () => {
    markMemberAuthGateToastPending();

    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBe('1');
    expect(consumeMemberAuthGateToastPending()).toBe(true);
    expect(window.sessionStorage.getItem(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY)).toBeNull();
    expect(consumeMemberAuthGateToastPending()).toBe(false);
  });

  it('treats unavailable sessionStorage as no pending toast', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('sessionStorage unavailable');
    });

    expect(() => markMemberAuthGateToastPending()).not.toThrow();
    expect(consumeMemberAuthGateToastPending()).toBe(false);
  });

  it('does not throw when marking fails during the storage write', () => {
    const storage = mockSessionStorage({
      setItem: vi.fn(() => {
        throw new Error('setItem unavailable');
      }),
    });

    expect(() => markMemberAuthGateToastPending()).not.toThrow();
    expect(storage.setItem).toHaveBeenCalledWith(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY, '1');
  });

  it('returns false when checking the pending marker fails during the storage read', () => {
    const storage = mockSessionStorage({
      getItem: vi.fn(() => {
        throw new Error('getItem unavailable');
      }),
    });

    expect(consumeMemberAuthGateToastPending()).toBe(false);
    expect(storage.getItem).toHaveBeenCalledWith(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY);
  });

  it('returns false when removing the pending marker fails', () => {
    const storage = mockSessionStorage({
      getItem: vi.fn(() => '1'),
      removeItem: vi.fn(() => {
        throw new Error('removeItem unavailable');
      }),
    });

    expect(consumeMemberAuthGateToastPending()).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledWith(MEMBER_AUTH_GATE_TOAST_STORAGE_KEY);
  });
});
