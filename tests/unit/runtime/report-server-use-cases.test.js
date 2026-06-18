import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REPORT_FIXTURE_UIDS,
  REPORT_TARGET_DATA,
  createReportPayload,
  expectedReportId,
} from '../../_helpers/report-fixtures';

const adminMocks = vi.hoisted(() => {
  const firestore = vi.fn();
  firestore.FieldValue = {
    serverTimestamp: vi.fn(),
  };

  return {
    adminAuth: {
      verifyIdToken: vi.fn(),
    },
    adminDb: {
      doc: vi.fn(),
      collection: vi.fn(),
    },
    admin: {
      apps: [],
      initializeApp: vi.fn(),
      credential: {
        applicationDefault: vi.fn(() => ({ credential: true })),
      },
      firestore,
      auth: vi.fn(),
      storage: vi.fn(),
    },
    createReport: vi.fn(),
  };
});

vi.mock('firebase-admin', () => ({
  default: adminMocks.admin,
}));

/**
 * Creates an Admin SDK document snapshot.
 * @param {string} path - Document path.
 * @param {Record<string, unknown> | null} data - Snapshot data.
 * @returns {{ exists: boolean, id: string, ref: { path: string }, data: () => Record<string, unknown> | undefined }} Snapshot.
 */
function adminSnapshot(path, data) {
  return {
    exists: data !== null,
    id: path.split('/').at(-1) ?? '',
    ref: { path },
    data: () => data ?? undefined,
  };
}

/**
 * Creates a report Request.
 * @param {object} options - Request options.
 * @param {Record<string, unknown>} [options.payload] - JSON body.
 * @param {string | null} [options.token] - Bearer token.
 * @returns {Request} Request object.
 */
function createRequest({ payload = createReportPayload(), token = 'valid-token' } = {}) {
  return new Request('https://example.test/api/reports', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(payload),
  });
}

/**
 * Seeds Admin SDK document reads for report target resolution.
 * @param {Record<string, Record<string, unknown> | null>} dataByPath - Data keyed by doc path.
 */
function seedAdminDocuments(dataByPath) {
  adminMocks.adminDb.doc.mockImplementation((path) => ({
    get: vi.fn().mockResolvedValue(adminSnapshot(path, dataByPath[path] ?? null)),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  adminMocks.admin.apps.length = 0;
  adminMocks.admin.firestore.mockReturnValue(adminMocks.adminDb);
  adminMocks.admin.auth.mockReturnValue(adminMocks.adminAuth);
  adminMocks.admin.firestore.FieldValue.serverTimestamp.mockReturnValue({ serverTimestamp: true });
  adminMocks.adminAuth.verifyIdToken.mockResolvedValue({ uid: REPORT_FIXTURE_UIDS.reporter });
  adminMocks.createReport.mockResolvedValue(undefined);
  adminMocks.adminDb.collection.mockReturnValue({
    doc: vi.fn(() => ({
      create: adminMocks.createReport,
    })),
  });
  seedAdminDocuments({
    'posts/post_123': REPORT_TARGET_DATA.post,
  });
});

describe('createReportServerUseCase', () => {
  it('requires bearer auth and maps missing or invalid tokens to 401', async () => {
    const { createReportServerUseCase } = await import(
      '@/runtime/server/use-cases/report-server-use-cases'
    );

    await expect(
      createReportServerUseCase({
        request: createRequest({ token: null }),
        payload: createReportPayload(),
      }),
    ).resolves.toEqual({
      status: 401,
      body: {
        ok: false,
        code: 'unauthenticated',
        message: '檢舉送出失敗，請稍後再試。',
      },
    });

    adminMocks.adminAuth.verifyIdToken.mockRejectedValueOnce(new Error('expired'));
    await expect(
      createReportServerUseCase({
        request: createRequest({ token: 'expired-token' }),
        payload: createReportPayload(),
      }),
    ).resolves.toMatchObject({ status: 401, body: { code: 'unauthenticated' } });
  });

  it('creates a report through resolver and no-overwrite repo with success mapping', async () => {
    const { createReportServerUseCase } = await import(
      '@/runtime/server/use-cases/report-server-use-cases'
    );

    const result = await createReportServerUseCase({
      request: createRequest(),
      payload: createReportPayload({ details: '  補充說明  ' }),
    });

    const reportId = expectedReportId({
      reporterUid: REPORT_FIXTURE_UIDS.reporter,
      targetType: 'post',
      targetKey: 'posts/post_123',
    });
    expect(result).toEqual({
      status: 201,
      body: {
        ok: true,
        reportId,
        status: 'open',
        message: '已收到你的檢舉，我們會進行審查。',
      },
    });
    expect(adminMocks.adminDb.doc).toHaveBeenCalledWith('posts/post_123');
    expect(adminMocks.adminDb.collection).toHaveBeenCalledWith('reports');
    expect(adminMocks.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterUid: REPORT_FIXTURE_UIDS.reporter,
        details: '補充說明',
        status: 'open',
        targetSnapshot: expect.objectContaining({ authorUid: REPORT_FIXTURE_UIDS.postAuthor }),
      }),
    );
  });

  it('maps validation, self-report, unavailable target, duplicate, and generic failures', async () => {
    const { createReportServerUseCase } = await import(
      '@/runtime/server/use-cases/report-server-use-cases'
    );

    await expect(
      createReportServerUseCase({
        request: createRequest(),
        payload: createReportPayload({ target: { postId: 'bad/slash' } }),
      }),
    ).resolves.toMatchObject({ status: 400, body: { code: 'invalid_request' } });

    seedAdminDocuments({
      'posts/post_123': { ...REPORT_TARGET_DATA.post, authorUid: REPORT_FIXTURE_UIDS.reporter },
    });
    await expect(
      createReportServerUseCase({ request: createRequest(), payload: createReportPayload() }),
    ).resolves.toEqual({
      status: 403,
      body: {
        ok: false,
        code: 'self_report_forbidden',
        message: '不能檢舉自己的內容。',
      },
    });

    seedAdminDocuments({ 'posts/post_123': null });
    await expect(
      createReportServerUseCase({ request: createRequest(), payload: createReportPayload() }),
    ).resolves.toMatchObject({ status: 404, body: { code: 'target_unavailable' } });

    seedAdminDocuments({ 'posts/post_123': REPORT_TARGET_DATA.post });
    adminMocks.createReport.mockRejectedValueOnce(
      Object.assign(new Error('ALREADY_EXISTS'), { code: 6 }),
    );
    await expect(
      createReportServerUseCase({ request: createRequest(), payload: createReportPayload() }),
    ).resolves.toEqual({
      status: 409,
      body: {
        ok: false,
        code: 'duplicate_report',
        message: '你已經檢舉過這則內容。',
      },
    });

    adminMocks.adminDb.doc.mockImplementationOnce(() => {
      throw new Error('firestore down');
    });
    await expect(
      createReportServerUseCase({ request: createRequest(), payload: createReportPayload() }),
    ).resolves.toMatchObject({ status: 500, body: { code: 'internal_error' } });
  });
});
