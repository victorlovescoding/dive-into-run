import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASON_LABELS,
  REPORT_STATUS,
} from '@/constants/report-constants';
import {
  ReportValidationError,
  buildReportDocument,
  buildReportId,
  normalizeReportRequest,
} from '@/service/report-service';
import {
  REPORT_FIXTURE_UIDS,
  REPORT_REASON_LABEL_FIXTURES,
  REPORT_SERVER_OWNED_FIELDS,
  REPORT_TARGET_CASES,
  createReportPayload,
  expectedReportId,
} from '../../_helpers/report-fixtures';

const repoMocks = vi.hoisted(() => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('@/config/server/firebase-admin-app', () => ({
  adminDb: repoMocks.adminDb,
}));

const CREATED_AT = { serverTimestamp: true };
const TARGET_SNAPSHOT = Object.freeze({
  authorUid: 'target-author',
  authorDisplayName: 'Target Author',
  title: 'Snapshot title',
  excerpt: 'Snapshot excerpt',
  targetPath: '/posts/post_123',
  createdAt: 'target-created-at',
});

beforeEach(() => {
  repoMocks.adminDb.collection.mockReset();
});

describe('report domain constants', () => {
  it('defines stable reason labels and open status', () => {
    expect(REPORT_REASON_LABELS).toEqual(REPORT_REASON_LABEL_FIXTURES);
    expect(REPORT_STATUS).toEqual({ OPEN: 'open' });
    expect(REPORT_DETAILS_MAX_LENGTH).toBe(500);
  });
});

describe('normalizeReportRequest', () => {
  it('normalizes all four target identities, target keys, target paths, details, and source paths', () => {
    for (const targetCase of REPORT_TARGET_CASES) {
      const paddedTarget = Object.fromEntries(
        Object.entries(targetCase.target).map(([key, value]) => [key, `  ${value}  `]),
      );

      expect(
        normalizeReportRequest(
          createReportPayload({
            targetType: targetCase.targetType,
            target: paddedTarget,
            details: '  補充說明  ',
            sourcePath: `  ${targetCase.targetPath}  `,
          }),
        ),
      ).toEqual({
        targetType: targetCase.targetType,
        targetIdentity: targetCase.targetIdentity,
        targetKey: targetCase.targetKey,
        targetPath: targetCase.targetPath,
        reason: 'spam',
        details: '補充說明',
        sourcePath: targetCase.targetPath,
      });
    }
  });

  it('rejects empty, slash, control-character, protocol/url, script, and markup ids', () => {
    const invalidIds = [
      '',
      '   ',
      'has/slash',
      'line\nbreak',
      'https://example.test/post',
      ['java', 'script:alert(1)'].join(''),
      '<script>alert(1)</script>',
      '<b>post</b>',
    ];

    for (const postId of invalidIds) {
      expect(() => normalizeReportRequest(createReportPayload({ target: { postId } }))).toThrow(
        ReportValidationError,
      );
    }
  });

  it('rejects unsupported target types plus missing or extra target ids', () => {
    expect(() => normalizeReportRequest(createReportPayload({ targetType: 'photo' }))).toThrow(
      ReportValidationError,
    );
    expect(() => normalizeReportRequest(createReportPayload({ target: {} }))).toThrow(
      ReportValidationError,
    );
    expect(() =>
      normalizeReportRequest(
        createReportPayload({
          target: { postId: 'post_123', commentId: 'extra_comment' },
        }),
      ),
    ).toThrow(ReportValidationError);
  });

  it('rejects invalid reasons, over-limit details, and other without details', () => {
    expect(() => normalizeReportRequest(createReportPayload({ reason: 'bad_reason' }))).toThrow(
      ReportValidationError,
    );
    expect(() =>
      normalizeReportRequest(createReportPayload({ details: 'x'.repeat(REPORT_DETAILS_MAX_LENGTH + 1) })),
    ).toThrow(ReportValidationError);
    expect(() =>
      normalizeReportRequest(createReportPayload({ reason: 'other', details: '   ' })),
    ).toThrow(ReportValidationError);
    expect(normalizeReportRequest(createReportPayload({ reason: 'other', details: '  其他原因  ' }))).toMatchObject({
      reason: 'other',
      details: '其他原因',
    });
  });

  it('rejects client-supplied server-owned fields', () => {
    for (const field of REPORT_SERVER_OWNED_FIELDS) {
      expect(() =>
        normalizeReportRequest({
          ...createReportPayload(),
          [field]: field === 'status' ? 'open' : 'forged',
        }),
      ).toThrow(ReportValidationError);
    }
  });

  it('sanitizes invalid sourcePath values by falling back to the canonical targetPath', () => {
    const invalidSourcePaths = [
      undefined,
      null,
      '',
      'posts/post_123',
      '//evil.test/path',
      '/posts/post_123?next=https://evil.test',
      '/posts/post_123\nx',
      '/posts/<b>post_123</b>',
      `/posts/${'x'.repeat(1025)}`,
    ];

    for (const sourcePath of invalidSourcePaths) {
      expect(normalizeReportRequest(createReportPayload({ sourcePath })).sourcePath).toBe(
        '/posts/post_123',
      );
    }
  });
});

describe('report document shaping', () => {
  it('builds deterministic sha256 report ids from reporterUid, targetType, and targetKey', () => {
    const targetCase = REPORT_TARGET_CASES[1];
    const reportId = buildReportId({
      reporterUid: REPORT_FIXTURE_UIDS.reporter,
      targetType: targetCase.targetType,
      targetKey: targetCase.targetKey,
    });

    expect(reportId).toBe(
      expectedReportId({
        reporterUid: REPORT_FIXTURE_UIDS.reporter,
        targetType: targetCase.targetType,
        targetKey: targetCase.targetKey,
      }),
    );
    expect(reportId).toMatch(/^[a-f0-9]{64}$/);
  });

  it('creates the saved report document with only server-owned reporterUid and snapshot data', () => {
    const normalizedRequest = normalizeReportRequest(
      createReportPayload({
        details: '  補充說明  ',
      }),
    );

    const result = buildReportDocument({
      normalizedRequest,
      reporterUid: REPORT_FIXTURE_UIDS.reporter,
      targetSnapshot: TARGET_SNAPSHOT,
      createdAt: CREATED_AT,
    });

    expect(result).toEqual({
      reportId: expectedReportId({
        reporterUid: REPORT_FIXTURE_UIDS.reporter,
        targetType: 'post',
        targetKey: 'posts/post_123',
      }),
      document: {
        targetType: 'post',
        targetKey: 'posts/post_123',
        targetIdentity: { targetType: 'post', postId: 'post_123' },
        reporterUid: REPORT_FIXTURE_UIDS.reporter,
        reason: 'spam',
        details: '補充說明',
        status: 'open',
        createdAt: CREATED_AT,
        sourcePath: '/posts/post_123',
        targetSnapshot: TARGET_SNAPSHOT,
      },
    });
    expect(result.document).not.toHaveProperty('reporterDisplayName');
    expect(result.document).not.toHaveProperty('reporterProfile');
  });
});

describe('createReportDocument', () => {
  it('uses Admin create so duplicate deterministic ids do not overwrite reports', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const doc = vi.fn(() => ({ create }));
    repoMocks.adminDb.collection.mockReturnValue({ doc });
    const { createReportDocument } = await import('@/repo/server/firebase-report-server-repo');
    const normalizedRequest = normalizeReportRequest(createReportPayload());
    const { reportId, document } = buildReportDocument({
      normalizedRequest,
      reporterUid: REPORT_FIXTURE_UIDS.reporter,
      targetSnapshot: TARGET_SNAPSHOT,
      createdAt: CREATED_AT,
    });

    await expect(createReportDocument(reportId, document)).resolves.toBeUndefined();

    expect(repoMocks.adminDb.collection).toHaveBeenCalledWith('reports');
    expect(doc).toHaveBeenCalledWith(reportId);
    expect(create).toHaveBeenCalledWith(document);
  });

  it('maps Admin already-exists create failures to report_duplicate', async () => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error('ALREADY_EXISTS'), { code: 6 }));
    repoMocks.adminDb.collection.mockReturnValue({ doc: vi.fn(() => ({ create })) });
    const { createReportDocument } = await import('@/repo/server/firebase-report-server-repo');

    await expect(createReportDocument('duplicate_id', /** @type {never} */ ({}))).rejects.toMatchObject({
      code: 'report_duplicate',
      name: 'DuplicateReportError',
    });
  });
});
