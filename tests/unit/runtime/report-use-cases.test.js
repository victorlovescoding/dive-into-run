import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReportAuthMock, createReportPostTarget } from '../../_helpers/report-ui-mocks.jsx';

/**
 * 匯入 client report use-cases。
 * @returns {Promise<typeof import('@/runtime/client/use-cases/report-use-cases')>} module。
 */
async function getReportUseCases() {
  return import('@/runtime/client/use-cases/report-use-cases');
}

/**
 * 建立 fetch Response-like double。
 * @param {number} status - HTTP status。
 * @param {Record<string, unknown>} body - JSON body。
 * @returns {{ ok: boolean, status: number, json: () => Promise<Record<string, unknown>> }} Response double。
 */
function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('submitReport', () => {
  it('posts the report payload with the Firebase ID token and maps success copy', async () => {
    const { submitReport } = await getReportUseCases();
    const { auth, currentUser } = createReportAuthMock({ token: 'token-123' });
    const target = createReportPostTarget();
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        ok: true,
        reportId: 'report-1',
        status: 'open',
        message: 'server copy should not be required',
      }),
    );

    const result = await submitReport({
      auth,
      currentUser,
      fetchImpl,
      ...target,
      reason: 'spam',
      details: '  補充說明  ',
    });

    expect(currentUser?.getIdToken).toHaveBeenCalledWith();
    expect(fetchImpl).toHaveBeenCalledWith('/api/reports', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetType: 'post',
        target: { postId: 'post-report-1' },
        reason: 'spam',
        details: '補充說明',
        sourcePath: '/posts/post-report-1',
      }),
    });
    expect(result).toEqual({
      ok: true,
      status: 201,
      code: null,
      reportId: 'report-1',
      message: '已收到你的檢舉，我們會進行審查。',
    });
  });

  it.each([
    [409, 'duplicate_report', '你已經檢舉過這則內容。'],
    [403, 'self_report_forbidden', '不能檢舉自己的內容。'],
    [500, 'internal_error', '檢舉送出失敗，請稍後再試。'],
  ])('maps %s %s to the stable user-facing message', async (status, code, message) => {
    const { submitReport } = await getReportUseCases();
    const { auth, currentUser } = createReportAuthMock();
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(status, {
        ok: false,
        code,
        message: 'server message',
      }),
    );

    const result = await submitReport({
      auth,
      currentUser,
      fetchImpl,
      ...createReportPostTarget(),
      reason: 'spam',
      details: '',
    });

    expect(result).toMatchObject({
      ok: false,
      status,
      code,
      message,
    });
  });

  it('returns generic unauthenticated mapping without calling fetch when no ID token exists', async () => {
    const { submitReport } = await getReportUseCases();
    const { auth, currentUser } = createReportAuthMock({ authenticated: false });
    const fetchImpl = vi.fn();

    const result = await submitReport({
      auth,
      currentUser,
      fetchImpl,
      ...createReportPostTarget(),
      reason: 'spam',
      details: '',
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      status: 401,
      code: 'unauthenticated',
      reportId: null,
      message: '檢舉送出失敗，請稍後再試。',
    });
  });
});
