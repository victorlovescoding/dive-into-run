import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePathname } from 'next/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

// 延遲 import，讓 mock 先生效
const { toastReducer, default: ToastProvider, useToast } = await import('@/contexts/ToastContext');

const mockedUsePathname = vi.mocked(usePathname);

/** @param {string} [pathname] - 模擬的 pathname。 */
function wrapper(pathname = '/') {
  mockedUsePathname.mockReturnValue(pathname);
  return function ({ children }) {
    return <ToastProvider>{children}</ToastProvider>;
  };
}

describe('toastReducer', () => {
  it('ADD action 新增 toast 到陣列', () => {
    const state = [];
    /** @type {import('@/contexts/ToastContext').ToastItem} */
    const toast = {
      id: 'abc',
      message: 'Hello',
      type: 'success',
      createdAt: Date.now(),
    };
    const result = toastReducer(state, { type: 'ADD', payload: toast });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(toast);
  });

  it('REMOVE action 移除指定 id 的 toast', () => {
    /** @type {import('@/contexts/ToastContext').ToastItem[]} */
    const state = [
      { id: '1', message: 'a', type: 'success', createdAt: 1 },
      { id: '2', message: 'b', type: 'error', createdAt: 2 },
    ];
    const result = toastReducer(state, { type: 'REMOVE', payload: '1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('CLEAR_ALL action 清空陣列', () => {
    /** @type {import('@/contexts/ToastContext').ToastItem[]} */
    const state = [
      { id: '1', message: 'a', type: 'success', createdAt: 1 },
      { id: '2', message: 'b', type: 'info', createdAt: 2 },
    ];
    const result = toastReducer(state, { type: 'CLEAR_ALL' });
    expect(result).toEqual([]);
  });

  it('ADD 超過 5 個時移除最舊', () => {
    /** @type {import('@/contexts/ToastContext').ToastItem[]} */
    const state = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      message: `msg-${i}`,
      type: /** @type {const} */ ('success'),
      createdAt: i,
    }));
    /** @type {import('@/contexts/ToastContext').ToastItem} */
    const newToast = {
      id: '5',
      message: 'msg-5',
      type: 'info',
      createdAt: 5,
    };
    const result = toastReducer(state, { type: 'ADD', payload: newToast });
    expect(result).toHaveLength(5);
    expect(result[0].id).toBe('1');
    expect(result[4].id).toBe('5');
  });
});

describe('useToast hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'mock-uuid') });
  });

  it('showToast 預設 type 為 success', () => {
    const { result } = renderHook(() => useToast(), { wrapper: wrapper() });

    act(() => {
      result.current.showToast('done');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      id: 'mock-uuid',
      message: 'done',
      type: 'success',
    });
  });

  it('showToast("msg", "error") 使用正確 type', () => {
    const { result } = renderHook(() => useToast(), { wrapper: wrapper() });

    act(() => {
      result.current.showToast('fail', 'error');
    });

    expect(result.current.toasts[0].type).toBe('error');
  });

  it('removeToast 呼叫 dispatch REMOVE', () => {
    vi.mocked(crypto.randomUUID).mockReturnValueOnce('id-1').mockReturnValueOnce('id-2');

    const { result } = renderHook(() => useToast(), { wrapper: wrapper() });

    act(() => {
      result.current.showToast('first');
      result.current.showToast('second');
    });

    act(() => {
      result.current.removeToast('id-1');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).toBe('id-2');
  });

  it('pathname 變化時清除所有 toasts', () => {
    mockedUsePathname.mockReturnValue('/page-a');
    const { result, rerender } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });

    act(() => {
      result.current.showToast('hello');
    });
    expect(result.current.toasts).toHaveLength(1);

    mockedUsePathname.mockReturnValue('/page-b');
    rerender();

    expect(result.current.toasts).toHaveLength(0);
  });
});
