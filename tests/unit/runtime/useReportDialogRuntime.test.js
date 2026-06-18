// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useReportDialogRuntime from '@/runtime/hooks/useReportDialogRuntime';
import { createReportAuthMock, createReportPostTarget } from '../../_helpers/report-ui-mocks.jsx';

/**
 * 建立可手動 resolve 的 promise。
 * @returns {{ promise: Promise<unknown>, resolve: (value: unknown) => void }}
 *   Deferred promise。
 */
function createDeferred() {
  /** @type {(value: unknown) => void} */
  let resolve = () => {};
  const promise = new Promise((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

/**
 * 渲染 report dialog runtime。
 * @param {object} [overrides] - 覆寫 hook 參數。
 * @returns {ReturnType<typeof renderHook>} hook view。
 */
function renderReportRuntime(overrides = {}) {
  const authMock = createReportAuthMock();
  const target = createReportPostTarget();
  const submitReportUseCase = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    code: null,
    reportId: 'report-1',
    message: '已收到你的檢舉，我們會進行審查。',
  });

  return renderHook(() =>
    useReportDialogRuntime({
      ...authMock,
      ...target,
      submitReportUseCase,
      ...overrides,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useReportDialogRuntime', () => {
  it('blocks submit until a reason is selected', async () => {
    const submitReportUseCase = vi.fn();
    const { result } = renderReportRuntime({ submitReportUseCase });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(submitReportUseCase).not.toHaveBeenCalled();
    expect(result.current.errors.reason).toBe('請選擇檢舉原因。');
  });

  it('requires details when reason is other', async () => {
    const submitReportUseCase = vi.fn();
    const { result } = renderReportRuntime({ submitReportUseCase });

    act(() => {
      result.current.setReason('other');
      result.current.setDetails('   ');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(submitReportUseCase).not.toHaveBeenCalled();
    expect(result.current.errors.details).toBe('請填寫補充說明。');
  });

  it('blocks details longer than 500 characters', async () => {
    const submitReportUseCase = vi.fn();
    const { result } = renderReportRuntime({ submitReportUseCase });

    act(() => {
      result.current.setReason('spam');
      result.current.setDetails('x'.repeat(501));
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(submitReportUseCase).not.toHaveBeenCalled();
    expect(result.current.errors.details).toBe('補充說明最多 500 字。');
  });

  it('allows blank details for non-other reasons and trims details before submit', async () => {
    const submitReportUseCase = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      code: null,
      reportId: 'report-1',
      message: '已收到你的檢舉，我們會進行審查。',
    });
    const { result } = renderReportRuntime({ submitReportUseCase });

    act(() => {
      result.current.setReason('spam');
      result.current.setDetails('   ');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(submitReportUseCase).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'spam',
        details: '',
      }),
    );
    expect(result.current.resultMessage).toBe('已收到你的檢舉，我們會進行審查。');
  });

  it('guards pending submit to one request while still allowing close', async () => {
    const deferred = createDeferred();
    const submitReportUseCase = vi.fn().mockReturnValue(deferred.promise);
    const onClose = vi.fn();
    const { result } = renderReportRuntime({ submitReportUseCase, onClose });

    act(() => {
      result.current.setReason('spam');
    });
    let firstSubmit = /** @type {Promise<unknown> | null} */ (null);
    await act(async () => {
      firstSubmit = result.current.handleSubmit();
    });

    expect(result.current.isPending).toBe(true);

    await act(async () => {
      const secondSubmit = result.current.handleSubmit();
      result.current.handleClose();

      expect(onClose).toHaveBeenCalledWith();
      expect(submitReportUseCase).toHaveBeenLastCalledWith(
        expect.objectContaining({
          reason: 'spam',
          targetType: 'post',
        }),
      );

      deferred.resolve({
        ok: true,
        status: 201,
        code: null,
        reportId: 'report-1',
        message: '已收到你的檢舉，我們會進行審查。',
      });
      await firstSubmit;
      await secondSubmit;
    });

    expect(result.current.isPending).toBe(false);
  });
});
