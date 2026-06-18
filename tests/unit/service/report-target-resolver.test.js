import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SelfReportForbiddenError,
  TargetUnavailableError,
  resolveReportTarget,
} from '@/service/report-target-resolver';
import {
  REPORT_FIXTURE_UIDS,
  REPORT_TARGET_DATA,
  createReportTargetDocument,
} from '../../_helpers/report-fixtures';

const repoMocks = vi.hoisted(() => ({
  adminDb: {
    doc: vi.fn(),
  },
}));

vi.mock('@/config/server/firebase-admin-app', () => ({
  adminDb: repoMocks.adminDb,
}));

const postIdentity = { targetType: 'post', postId: 'post_123' };
const postCommentIdentity = {
  targetType: 'postComment',
  postId: 'post_123',
  commentId: 'comment_456',
};
const eventIdentity = { targetType: 'event', eventId: 'event_123' };
const eventCommentIdentity = {
  targetType: 'eventComment',
  eventId: 'event_123',
  commentId: 'comment_456',
};

/**
 * Creates resolver document input.
 * @param {Record<string, unknown> | null} target - Target data.
 * @param {Record<string, unknown> | null} [parent] - Parent data.
 * @returns {{ target: ReturnType<typeof createReportTargetDocument>, parent: ReturnType<typeof createReportTargetDocument> }} Resolver documents.
 */
function documentsFor(target, parent = null) {
  return {
    target: createReportTargetDocument(target),
    parent: createReportTargetDocument(parent),
  };
}

/**
 * Creates an Admin SDK snapshot-like object.
 * @param {string} path - Document path.
 * @param {Record<string, unknown> | null} data - Snapshot data.
 * @returns {{ exists: boolean, id: string | undefined, ref: { path: string }, data: () => Record<string, unknown> | undefined }} Snapshot.
 */
function adminSnapshot(path, data) {
  const id = path.split('/').at(-1);
  return {
    exists: data !== null,
    id,
    ref: { path },
    data: () => data ?? undefined,
  };
}

beforeEach(() => {
  repoMocks.adminDb.doc.mockReset();
});

describe('resolveReportTarget', () => {
  it('resolves a post snapshot and strips media, profile, and reporter fields', () => {
    const snapshot = resolveReportTarget({
      targetIdentity: postIdentity,
      reporterUid: REPORT_FIXTURE_UIDS.reporter,
      targetDocuments: documentsFor(REPORT_TARGET_DATA.post),
    });

    expect(snapshot).toEqual({
      authorUid: REPORT_FIXTURE_UIDS.postAuthor,
      authorDisplayName: '文章作者',
      title: '完整文章標題',
      excerpt: expect.stringMatching(/^文章內容/),
      targetPath: '/posts/post_123',
      createdAt: 'post-created-at',
    });
    expect(snapshot.excerpt).toHaveLength(500);
    expect(snapshot).not.toHaveProperty('authorImgURL');
    expect(snapshot).not.toHaveProperty('mediaUrls');
    expect(snapshot).not.toHaveProperty('reporterUid');
  });

  it('rejects missing, soft-deleted, account-deletion-hidden, and self-report post targets', () => {
    expect(() =>
      resolveReportTarget({
        targetIdentity: postIdentity,
        reporterUid: REPORT_FIXTURE_UIDS.reporter,
        targetDocuments: documentsFor(null),
      }),
    ).toThrow(TargetUnavailableError);
    expect(() =>
      resolveReportTarget({
        targetIdentity: postIdentity,
        reporterUid: REPORT_FIXTURE_UIDS.reporter,
        targetDocuments: documentsFor({ ...REPORT_TARGET_DATA.post, deletedAt: 'deleted' }),
      }),
    ).toThrow(TargetUnavailableError);
    expect(() =>
      resolveReportTarget({
        targetIdentity: postIdentity,
        reporterUid: REPORT_FIXTURE_UIDS.reporter,
        targetDocuments: documentsFor({ ...REPORT_TARGET_DATA.post, deletedAt: null }),
      }),
    ).toThrow(TargetUnavailableError);
    expect(() =>
      resolveReportTarget({
        targetIdentity: postIdentity,
        reporterUid: REPORT_FIXTURE_UIDS.reporter,
        targetDocuments: documentsFor({ ...REPORT_TARGET_DATA.post, accountDeletionHidden: true }),
      }),
    ).toThrow(TargetUnavailableError);
    expect(() =>
      resolveReportTarget({
        targetIdentity: postIdentity,
        reporterUid: REPORT_FIXTURE_UIDS.postAuthor,
        targetDocuments: documentsFor(REPORT_TARGET_DATA.post),
      }),
    ).toThrow(SelfReportForbiddenError);
  });

  it('resolves a postComment using parent visibility and comment author for self-report', () => {
    const snapshot = resolveReportTarget({
      targetIdentity: postCommentIdentity,
      reporterUid: REPORT_FIXTURE_UIDS.postAuthor,
      targetDocuments: documentsFor(REPORT_TARGET_DATA.postComment, REPORT_TARGET_DATA.post),
    });

    expect(snapshot).toEqual({
      authorUid: REPORT_FIXTURE_UIDS.commentAuthor,
      authorDisplayName: '留言者',
      title: '完整文章標題',
      excerpt: expect.stringMatching(/^留言內容/),
      targetPath: '/posts/post_123?commentId=comment_456',
      createdAt: 'comment-created-at',
    });
    expect(snapshot.excerpt).toHaveLength(500);
    expect(() =>
      resolveReportTarget({
        targetIdentity: postCommentIdentity,
        reporterUid: REPORT_FIXTURE_UIDS.reporter,
        targetDocuments: documentsFor(REPORT_TARGET_DATA.postComment, {
          ...REPORT_TARGET_DATA.post,
          deletedAt: 'deleted',
        }),
      }),
    ).toThrow(TargetUnavailableError);
    expect(() =>
      resolveReportTarget({
        targetIdentity: postCommentIdentity,
        reporterUid: REPORT_FIXTURE_UIDS.commentAuthor,
        targetDocuments: documentsFor(REPORT_TARGET_DATA.postComment, REPORT_TARGET_DATA.post),
      }),
    ).toThrow(SelfReportForbiddenError);
  });

  it('resolves event and eventComment snapshots with event parent visibility checks', () => {
    const eventSnapshot = resolveReportTarget({
      targetIdentity: eventIdentity,
      reporterUid: REPORT_FIXTURE_UIDS.reporter,
      targetDocuments: documentsFor(REPORT_TARGET_DATA.event),
    });
    const eventCommentSnapshot = resolveReportTarget({
      targetIdentity: eventCommentIdentity,
      reporterUid: REPORT_FIXTURE_UIDS.eventHost,
      targetDocuments: documentsFor(REPORT_TARGET_DATA.eventComment, REPORT_TARGET_DATA.event),
    });

    expect(eventSnapshot).toEqual({
      authorUid: REPORT_FIXTURE_UIDS.eventHost,
      authorDisplayName: '主揪',
      title: '完整活動標題',
      excerpt: expect.stringMatching(/^活動描述/),
      targetPath: '/events/event_123',
      createdAt: 'event-created-at',
    });
    expect(eventCommentSnapshot).toEqual({
      authorUid: REPORT_FIXTURE_UIDS.eventCommentAuthor,
      authorDisplayName: '活動留言者',
      title: '完整活動標題',
      excerpt: expect.stringMatching(/^活動留言內容/),
      targetPath: '/events/event_123?commentId=comment_456',
      createdAt: 'event-comment-created-at',
    });
    expect(eventSnapshot).not.toHaveProperty('routeImage');
    expect(() =>
      resolveReportTarget({
        targetIdentity: eventCommentIdentity,
        reporterUid: REPORT_FIXTURE_UIDS.reporter,
        targetDocuments: documentsFor(REPORT_TARGET_DATA.eventComment, {
          ...REPORT_TARGET_DATA.event,
          accountDeletionHidden: true,
        }),
      }),
    ).toThrow(TargetUnavailableError);
    expect(() =>
      resolveReportTarget({
        targetIdentity: eventCommentIdentity,
        reporterUid: REPORT_FIXTURE_UIDS.eventCommentAuthor,
        targetDocuments: documentsFor(REPORT_TARGET_DATA.eventComment, REPORT_TARGET_DATA.event),
      }),
    ).toThrow(SelfReportForbiddenError);
  });
});

describe('readReportTargetDocuments', () => {
  it('reads Admin target documents for post, postComment, event, and eventComment identities', async () => {
    repoMocks.adminDb.doc.mockImplementation((path) => ({
      get: vi.fn().mockResolvedValue(adminSnapshot(path, { path })),
    }));
    const { readReportTargetDocuments } = await import(
      '@/repo/server/firebase-report-target-server-repo'
    );

    await expect(readReportTargetDocuments(postIdentity)).resolves.toMatchObject({
      target: { path: 'posts/post_123', data: { path: 'posts/post_123' } },
      parent: null,
    });
    await expect(readReportTargetDocuments(postCommentIdentity)).resolves.toMatchObject({
      parent: { path: 'posts/post_123', data: { path: 'posts/post_123' } },
      target: {
        path: 'posts/post_123/comments/comment_456',
        data: { path: 'posts/post_123/comments/comment_456' },
      },
    });
    await expect(readReportTargetDocuments(eventIdentity)).resolves.toMatchObject({
      target: { path: 'events/event_123', data: { path: 'events/event_123' } },
      parent: null,
    });
    await expect(readReportTargetDocuments(eventCommentIdentity)).resolves.toMatchObject({
      parent: { path: 'events/event_123', data: { path: 'events/event_123' } },
      target: {
        path: 'events/event_123/comments/comment_456',
        data: { path: 'events/event_123/comments/comment_456' },
      },
    });
    expect(repoMocks.adminDb.doc.mock.calls.map(([path]) => path)).toEqual([
      'posts/post_123',
      'posts/post_123',
      'posts/post_123/comments/comment_456',
      'events/event_123',
      'events/event_123',
      'events/event_123/comments/comment_456',
    ]);
  });
});
