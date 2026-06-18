import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REPORT_TARGET_DATA, createReportPayload } from '../../_helpers/report-fixtures';

const mocks = vi.hoisted(() => {
  const firestore = vi.fn();
  firestore.FieldValue = {
    serverTimestamp: vi.fn(),
  };

  return {
    json: vi.fn((body, init = {}) => ({
      body,
      status: init.status ?? 200,
      headers: init.headers ?? {},
      async json() {
        return body;
      },
    })),
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

vi.mock('next/server', () => ({
  NextResponse: {
    json: mocks.json,
  },
}));

vi.mock('firebase-admin', () => ({
  default: mocks.admin,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.apps.length = 0;
  mocks.admin.firestore.mockReturnValue(mocks.adminDb);
  mocks.admin.auth.mockReturnValue(mocks.adminAuth);
  mocks.admin.firestore.FieldValue.serverTimestamp.mockReturnValue({ serverTimestamp: true });
  mocks.adminAuth.verifyIdToken.mockResolvedValue({ uid: 'uid_reporter' });
  mocks.createReport.mockResolvedValue(undefined);
  mocks.adminDb.doc.mockImplementation((path) => ({
    get: vi.fn().mockResolvedValue(adminSnapshot(path, REPORT_TARGET_DATA.post)),
  }));
  mocks.adminDb.collection.mockReturnValue({
    doc: vi.fn(() => ({
      create: mocks.createReport,
    })),
  });
});

describe('POST /api/reports route', () => {
  it('parses JSON and returns the delegated server result', async () => {
    const { POST } = await import('@/app/api/reports/route');
    const request = new Request('https://example.test/api/reports', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: JSON.stringify(createReportPayload()),
    });

    const response = await POST(request);

    expect(mocks.adminAuth.verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(mocks.createReport).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      ok: true,
      status: 'open',
      message: '已收到你的檢舉，我們會進行審查。',
    });
  });

  it('maps malformed JSON to invalid_request 400 before server work', async () => {
    const { POST } = await import('@/app/api/reports/route');
    const request = new Request('https://example.test/api/reports', {
      method: 'POST',
      body: '{not-json',
    });

    const response = await POST(request);

    expect(mocks.adminAuth.verifyIdToken).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      code: 'invalid_request',
      message: '檢舉送出失敗，請稍後再試。',
    });
  });

  it('maps unexpected route adapter errors to generic 500', async () => {
    const { POST } = await import('@/app/api/reports/route');
    const request = {
      json: vi.fn().mockResolvedValue(createReportPayload()),
      headers: {
        get: vi.fn(() => {
          throw new Error('headers unavailable');
        }),
      },
    };

    const response = await POST(/** @type {Request} */ (request));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      ok: false,
      code: 'internal_error',
      message: '檢舉送出失敗，請稍後再試。',
    });
  });
});
