import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import useEditHistoryModal from './useEditHistoryModal';

const targetEntry = {
  id: 'entry-1',
  content: 'Current content',
  updatedAt: { seconds: 20, nanoseconds: 0 },
};

/**
 * 建立可手動 resolve/reject 的 Promise。
 * @returns {{ promise: Promise<Array<object>>, resolve: (value: Array<object>) => void, reject: (error: Error) => void }} deferred promise。
 */
function createHistoryDeferred() {
  /** @type {(value: Array<object>) => void} */
  let resolvePromise = () => {};
  /** @type {(error: Error) => void} */
  let rejectPromise = () => {};
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEditHistoryModal', () => {
  test('opens the modal and stores loaded history entries', async () => {
    const historyEntries = [{ id: 'history-1', content: 'Previous content' }];
    const loadHistory = vi.fn().mockResolvedValueOnce(historyEntries);
    const view = renderHook(() =>
      useEditHistoryModal({
        loadHistory,
        loadErrorMessage: '載入編輯記錄失敗',
      }),
    );

    await act(async () => {
      await view.result.current.handleViewHistory(targetEntry);
    });

    expect(loadHistory).toHaveBeenCalledWith(targetEntry);
    expect(view.result.current.historyTarget).toBe(targetEntry);
    expect(view.result.current.historyEntries).toEqual(historyEntries);
    expect(view.result.current.historyError).toBeNull();
    expect(view.result.current.isHistoryOpen).toBe(true);
  });

  test('keeps the modal open with an error after load failure', async () => {
    const loadHistory = vi.fn().mockRejectedValueOnce(new Error('failed'));
    const view = renderHook(() =>
      useEditHistoryModal({
        loadHistory,
        loadErrorMessage: '載入編輯記錄失敗',
      }),
    );

    await act(async () => {
      await view.result.current.handleViewHistory(targetEntry);
    });

    expect(view.result.current.historyTarget).toBe(targetEntry);
    expect(view.result.current.historyEntries).toEqual([]);
    expect(view.result.current.historyError).toBe('載入編輯記錄失敗');
    expect(view.result.current.isHistoryOpen).toBe(true);
  });

  test('resets target, entries, and error on close', async () => {
    const loadHistory = vi.fn().mockResolvedValueOnce([{ id: 'history-1' }]);
    const view = renderHook(() =>
      useEditHistoryModal({
        loadHistory,
        loadErrorMessage: '載入編輯記錄失敗',
      }),
    );

    await act(async () => {
      await view.result.current.handleViewHistory(targetEntry);
    });
    act(() => {
      view.result.current.handleCloseHistory();
    });

    expect(view.result.current.historyTarget).toBeNull();
    expect(view.result.current.historyEntries).toEqual([]);
    expect(view.result.current.historyError).toBeNull();
    expect(view.result.current.isHistoryOpen).toBe(false);
  });

  test('does not repopulate state when a pending load resolves after close', async () => {
    const deferred = createHistoryDeferred();
    const loadHistory = vi.fn().mockReturnValueOnce(deferred.promise);
    const view = renderHook(() =>
      useEditHistoryModal({
        loadHistory,
        loadErrorMessage: '載入編輯記錄失敗',
      }),
    );
    /** @type {Promise<void>} */
    let pendingLoad = Promise.resolve();

    act(() => {
      pendingLoad = view.result.current.handleViewHistory(targetEntry);
    });
    act(() => {
      view.result.current.handleCloseHistory();
    });
    await act(async () => {
      deferred.resolve([{ id: 'stale-history', content: 'Stale content' }]);
      await pendingLoad;
    });

    expect(view.result.current.historyTarget).toBeNull();
    expect(view.result.current.historyEntries).toEqual([]);
    expect(view.result.current.historyError).toBeNull();
    expect(view.result.current.isHistoryOpen).toBe(false);
  });

  test('ignores older load results after a newer target is opened', async () => {
    const firstTarget = targetEntry;
    const secondTarget = {
      id: 'entry-2',
      content: 'Second content',
      updatedAt: { seconds: 30, nanoseconds: 0 },
    };
    const firstDeferred = createHistoryDeferred();
    const secondDeferred = createHistoryDeferred();
    const secondHistory = [{ id: 'second-history', content: 'Second history' }];
    const loadHistory = vi
      .fn()
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);
    const view = renderHook(() =>
      useEditHistoryModal({
        loadHistory,
        loadErrorMessage: '載入編輯記錄失敗',
      }),
    );
    /** @type {Promise<void>} */
    let firstPendingLoad = Promise.resolve();
    /** @type {Promise<void>} */
    let secondPendingLoad = Promise.resolve();

    act(() => {
      firstPendingLoad = view.result.current.handleViewHistory(firstTarget);
    });
    act(() => {
      secondPendingLoad = view.result.current.handleViewHistory(secondTarget);
    });
    await act(async () => {
      secondDeferred.resolve(secondHistory);
      await secondPendingLoad;
    });
    await act(async () => {
      firstDeferred.resolve([{ id: 'first-history', content: 'First history' }]);
      await firstPendingLoad;
    });

    expect(loadHistory).toHaveBeenNthCalledWith(1, firstTarget);
    expect(loadHistory).toHaveBeenNthCalledWith(2, secondTarget);
    expect(view.result.current.historyTarget).toBe(secondTarget);
    expect(view.result.current.historyEntries).toEqual(secondHistory);
    expect(view.result.current.historyError).toBeNull();
    expect(view.result.current.isHistoryOpen).toBe(true);
  });
});
