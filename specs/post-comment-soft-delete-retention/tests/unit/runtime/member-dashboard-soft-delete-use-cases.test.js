import { beforeEach, describe, expect, it, vi } from 'vitest';

const memberRepoMocks = vi.hoisted(() => ({
  fetchParticipantEventIdsByUid: vi.fn(),
  fetchHostedEventIdsByUid: vi.fn(),
  fetchEventDocumentsByIds: vi.fn(),
  fetchPostDocumentsPageByAuthorUid: vi.fn(),
  fetchCommentDocumentsPageByAuthorUid: vi.fn(),
  fetchParentTitlesByRefs: vi.fn(),
}));
const clientConfigMocks = vi.hoisted(() => ({
  currentUser: {
    uid: 'user-1',
    getIdToken: vi.fn(),
  },
}));
const memberCommentsRouteMocks = vi.hoisted(() => ({
  verifyMemberCommentsAuthToken: vi.fn(),
  memberCommentsRunner: vi.fn(),
}));

vi.mock('@/repo/client/firebase-member-repo', () => memberRepoMocks);
vi.mock('@/config/client/firebase-client', () => ({
  auth: {
    get currentUser() {
      return clientConfigMocks.currentUser;
    },
  },
  db: {},
}));
vi.mock('@/config/server/firebase-admin-app', () => ({ adminDb: {} }));
vi.mock('@/runtime/server/use-cases/member-comments-server-use-cases', () => memberCommentsRouteMocks);

/**
 * Build a normalized member post document with cursor metadata.
 * @param {string} id - Document ID.
 * @param {object} data - Document payload.
 * @returns {{ id: string, data: object, cursor: object }} Member repo document.
 */
function postDocument(id, data) {
  return {
    id,
    data,
    cursor: { kind: 'cursor', id },
  };
}

/**
 * Build a normalized member comment document with cursor metadata.
 * @param {string} id - Comment document ID.
 * @param {object} data - Comment payload.
 * @returns {{ id: string, source: 'post', parentId: string, data: object, cursor: object }} Member comment document.
 */
function commentDocument(id, data) {
  return {
    id,
    source: 'post',
    parentId: `parent-${id}`,
    data,
    cursor: { kind: 'cursor', id },
  };
}

describe('member dashboard soft delete use-case pagination', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('fetchMyPosts advances past deleted raw records and returns the last included active cursor', async () => {
    const active1 = postDocument('active-1', { title: 'Active 1', postAt: { seconds: 4 } });
    const deleted1 = postDocument('deleted-1', {
      title: 'Deleted 1',
      postAt: { seconds: 3 },
      deletedAt: { seconds: 1 },
    });
    const active2 = postDocument('active-2', { title: 'Active 2', postAt: { seconds: 2 } });
    const active3 = postDocument('active-3', { title: 'Active 3', postAt: { seconds: 1 } });

    memberRepoMocks.fetchPostDocumentsPageByAuthorUid
      .mockResolvedValueOnce({ documents: [active1, deleted1], lastDoc: deleted1.cursor })
      .mockResolvedValueOnce({ documents: [active2, active3], lastDoc: active3.cursor });

    const { fetchMyPosts } = await import('@/runtime/client/use-cases/member-dashboard-use-cases');
    const result = await fetchMyPosts('user-1', { pageSize: 2 });

    expect(result.items.map((item) => item.id)).toEqual(['active-1', 'active-2']);
    expect(result.lastDoc).toBe(active2.cursor);
    expect(memberRepoMocks.fetchPostDocumentsPageByAuthorUid).toHaveBeenNthCalledWith(2, 'user-1', {
      afterDoc: deleted1.cursor,
      pageSize: 2,
    });
  });

  it('fetchMyComments advances past deleted raw records and resolves titles only for returned active comments', async () => {
    const active1 = commentDocument('active-1', {
      comment: 'Active 1',
      createdAt: { seconds: 4 },
    });
    const deleted1 = commentDocument('deleted-1', {
      comment: 'Deleted 1',
      createdAt: { seconds: 3 },
      deletedAt: { seconds: 1 },
    });
    const active2 = commentDocument('active-2', {
      comment: 'Active 2',
      createdAt: { seconds: 2 },
    });
    const active3 = commentDocument('active-3', {
      comment: 'Active 3',
      createdAt: { seconds: 1 },
    });

    memberRepoMocks.fetchCommentDocumentsPageByAuthorUid
      .mockResolvedValueOnce({ documents: [active1, deleted1], lastDoc: deleted1.cursor })
      .mockResolvedValueOnce({ documents: [active2, active3], lastDoc: active3.cursor });
    memberRepoMocks.fetchParentTitlesByRefs.mockResolvedValueOnce([
      { parentId: 'parent-active-1', title: 'Post 1' },
      { parentId: 'parent-active-2', title: 'Post 2' },
    ]);

    const { fetchMyComments } = await import('@/runtime/client/use-cases/member-dashboard-use-cases');
    const result = await fetchMyComments('user-1', { pageSize: 2 });

    expect(result.items.map((item) => item.id)).toEqual(['active-1', 'active-2']);
    expect(result.lastDoc).toBe(active2.cursor);
    expect(memberRepoMocks.fetchCommentDocumentsPageByAuthorUid).toHaveBeenNthCalledWith(
      2,
      'user-1',
      {
        afterDoc: deleted1.cursor,
        pageSize: 2,
      },
    );
    expect(memberRepoMocks.fetchParentTitlesByRefs).toHaveBeenCalledWith([
      { parentId: 'parent-active-1', source: 'post' },
      { parentId: 'parent-active-2', source: 'post' },
    ]);
  });
});

describe('member dashboard comments API client boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    clientConfigMocks.currentUser.uid = 'user-1';
    clientConfigMocks.currentUser.getIdToken.mockResolvedValue('id-token-1');
  });

  it('fetches member comments through the server API with a Firebase ID token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [
          {
            id: 'comment-1',
            source: 'post',
            parentId: 'post-1',
            parentTitle: 'Post 1',
            data: { comment: 'Visible', createdAt: '2026-05-28T02:00:00.000Z' },
            cursor: 'posts/post-1/comments/comment-1',
          },
        ],
        lastDoc: 'posts/post-1/comments/comment-1',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const actualRepo =
      /** @type {typeof import('@/repo/client/firebase-member-repo')} */ (
        await vi.importActual('@/repo/client/firebase-member-repo')
      );
    const result = await actualRepo.fetchCommentDocumentsPageByAuthorUid('user-1', {
      afterDoc: 'posts/post-0/comments/comment-0',
      pageSize: 2,
    });

    expect(clientConfigMocks.currentUser.getIdToken).toHaveBeenCalledOnce();
    const cursor = encodeURIComponent('posts/post-0/comments/comment-0');
    expect(fetchMock).toHaveBeenCalledWith(`/api/member/comments?pageSize=2&cursor=${cursor}`, {
      headers: { Authorization: 'Bearer id-token-1' },
    });
    expect(result.documents).toHaveLength(1);
    expect(result.lastDoc).toBe('posts/post-1/comments/comment-1');
  });

  it('rejects member comment API reads for a different uid', async () => {
    const actualRepo =
      /** @type {typeof import('@/repo/client/firebase-member-repo')} */ (
        await vi.importActual('@/repo/client/firebase-member-repo')
      );

    await expect(actualRepo.fetchCommentDocumentsPageByAuthorUid('other-user')).rejects.toThrow(
      'Member comments request requires the signed-in user',
    );
  });
});

describe('member comments API route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('requires a Firebase bearer token', async () => {
    memberCommentsRouteMocks.verifyMemberCommentsAuthToken.mockResolvedValue(null);

    const { GET } = await import('@/app/api/member/comments/route');
    const response = await GET(new Request('https://example.test/api/member/comments'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(memberCommentsRouteMocks.memberCommentsRunner).not.toHaveBeenCalled();
  });

  it('runs the member comments server use case for the authenticated uid', async () => {
    memberCommentsRouteMocks.verifyMemberCommentsAuthToken.mockResolvedValue('user-1');
    memberCommentsRouteMocks.memberCommentsRunner.mockResolvedValue({
      status: 200,
      body: { documents: [], lastDoc: null },
    });

    const { GET } = await import('@/app/api/member/comments/route');
    const response = await GET(
      new Request('https://example.test/api/member/comments?pageSize=2&cursor=cursor-1', {
        headers: { Authorization: 'Bearer id-token-1' },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ documents: [], lastDoc: null });
    expect(memberCommentsRouteMocks.memberCommentsRunner).toHaveBeenCalledWith({
      uid: 'user-1',
      url: new URL('https://example.test/api/member/comments?pageSize=2&cursor=cursor-1'),
    });
  });

  it('returns server-use-case cursor errors as HTTP 400', async () => {
    memberCommentsRouteMocks.verifyMemberCommentsAuthToken.mockResolvedValue('user-1');
    memberCommentsRouteMocks.memberCommentsRunner.mockResolvedValue({
      status: 400,
      body: { error: 'Invalid cursor' },
    });

    const { GET } = await import('@/app/api/member/comments/route');
    const response = await GET(
      new Request('https://example.test/api/member/comments?cursor=users%2Fuser-1%2Fprivate%2Fx', {
        headers: { Authorization: 'Bearer id-token-1' },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid cursor' });
  });
});

/**
 * Builds a timestamp-like value for server serialization tests.
 * @param {string} isoString - ISO date string.
 * @returns {{ toDate: () => Date }} Timestamp-like object.
 */
function timestamp(isoString) {
  return { toDate: () => new Date(isoString) };
}

/**
 * Builds a fake Admin SDK parent ref.
 * @param {'posts' | 'events'} collectionId - Parent collection id.
 * @param {string} id - Parent document id.
 * @returns {{ id: string, path: string, parent: { id: string } }} Parent ref.
 */
function parentRef(collectionId, id) {
  return { id, path: `${collectionId}/${id}`, parent: { id: collectionId } };
}

/**
 * Builds a fake Admin SDK document snapshot.
 * @param {boolean} exists - Whether the document exists.
 * @param {Record<string, unknown>} [data] - Snapshot payload.
 * @returns {{ exists: boolean, data: () => Record<string, unknown> }} Snapshot.
 */
function parentSnapshot(exists, data = {}) {
  return { exists, data: () => data };
}

/**
 * Builds a fake Admin SDK collectionGroup comment snapshot.
 * @param {string} id - Comment id.
 * @param {{ id: string, path: string, parent: { id: string } }} parent - Parent doc ref.
 * @param {Record<string, unknown>} data - Comment payload.
 * @returns {{ id: string, exists: boolean, ref: { path: string, parent: { parent: object } }, data: () => Record<string, unknown> }} Comment snapshot.
 */
function commentSnapshot(id, parent, data) {
  return {
    id,
    exists: true,
    ref: {
      path: `${parent.path}/comments/${id}`,
      parent: { parent },
    },
    data: () => data,
  };
}

describe('member comments server filtering', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('excludes deleted comments and comments under deleted posts while keeping event comments', async () => {
    const { buildVisibleMemberCommentDocuments } = await import(
      '@/repo/server/firebase-member-comments-server-repo'
    );

    const postParent = parentRef('posts', 'active-post');
    const deletedPostParent = parentRef('posts', 'deleted-post');
    const eventParent = parentRef('events', 'event-1');
    const parentSnapshots = new Map([
      [postParent.path, parentSnapshot(true, { title: 'Active post' })],
      [
        deletedPostParent.path,
        parentSnapshot(true, {
          title: 'Deleted post',
          deletedAt: timestamp('2026-05-28T00:00:00.000Z'),
        }),
      ],
      [eventParent.path, parentSnapshot(true, { title: 'Event title' })],
    ]);

    const documents = await buildVisibleMemberCommentDocuments(
      [
        commentSnapshot('deleted-comment', postParent, {
          authorUid: 'user-1',
          comment: 'hidden',
          createdAt: timestamp('2026-05-28T04:00:00.000Z'),
          deletedAt: timestamp('2026-05-28T04:30:00.000Z'),
        }),
        commentSnapshot('deleted-post-comment', deletedPostParent, {
          authorUid: 'user-1',
          comment: 'hidden by parent',
          createdAt: timestamp('2026-05-28T03:00:00.000Z'),
        }),
        commentSnapshot('active-post-comment', postParent, {
          authorUid: 'user-1',
          comment: 'visible post',
          createdAt: timestamp('2026-05-28T02:00:00.000Z'),
        }),
        commentSnapshot('event-comment', eventParent, {
          authorUid: 'user-1',
          content: 'visible event',
          createdAt: timestamp('2026-05-28T01:00:00.000Z'),
        }),
      ],
      {
        fetchParentSnapshot: async (ref) => parentSnapshots.get(ref.path) ?? parentSnapshot(false),
      },
    );

    expect(documents.map((document) => document.id)).toEqual([
      'active-post-comment',
      'event-comment',
    ]);
    expect(documents[0]).toMatchObject({
      source: 'post',
      parentId: 'active-post',
      parentTitle: 'Active post',
      cursor: 'posts/active-post/comments/active-post-comment',
      data: {
        comment: 'visible post',
        createdAt: '2026-05-28T02:00:00.000Z',
      },
    });
    expect(documents[1]).toMatchObject({
      source: 'event',
      parentId: 'event-1',
      parentTitle: 'Event title',
      data: {
        content: 'visible event',
        createdAt: '2026-05-28T01:00:00.000Z',
      },
    });
  });

  it('rejects non-comment and cross-user cursors before running the raw query', async () => {
    const {
      InvalidMemberCommentsCursorError,
      fetchVisibleMemberCommentDocumentsPage,
    } = await import('@/repo/server/firebase-member-comments-server-repo');
    const fetchCursorSnapshot = vi.fn();
    const fetchRawCommentPage = vi.fn();

    await expect(
      fetchVisibleMemberCommentDocumentsPage({
        uid: 'user-1',
        afterCursor: 'users/user-1/private/doc-1',
        pageSize: 2,
        rawReadBudget: 4,
        fetchCursorSnapshot,
        fetchRawCommentPage,
        fetchParentSnapshot: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(InvalidMemberCommentsCursorError);
    expect(fetchCursorSnapshot).not.toHaveBeenCalled();
    expect(fetchRawCommentPage).not.toHaveBeenCalled();

    fetchCursorSnapshot.mockResolvedValueOnce(
      commentSnapshot('comment-1', parentRef('posts', 'post-1'), {
        authorUid: 'other-user',
        comment: 'not yours',
        createdAt: timestamp('2026-05-28T05:00:00.000Z'),
      }),
    );

    await expect(
      fetchVisibleMemberCommentDocumentsPage({
        uid: 'user-1',
        afterCursor: 'posts/post-1/comments/comment-1',
        pageSize: 2,
        rawReadBudget: 4,
        fetchCursorSnapshot,
        fetchRawCommentPage,
        fetchParentSnapshot: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(InvalidMemberCommentsCursorError);
    expect(fetchCursorSnapshot).toHaveBeenCalledWith('posts/post-1/comments/comment-1');
    expect(fetchRawCommentPage).not.toHaveBeenCalled();
  });

  it('stops scanning at the raw read budget and resumes without skipping active comments', async () => {
    const { fetchVisibleMemberCommentDocumentsPage } = await import(
      '@/repo/server/firebase-member-comments-server-repo'
    );
    const postParent = parentRef('posts', 'post-1');
    const rawSnapshots = [
      commentSnapshot('deleted-1', postParent, {
        authorUid: 'user-1',
        comment: 'deleted 1',
        createdAt: timestamp('2026-05-28T06:00:00.000Z'),
        deletedAt: timestamp('2026-05-28T06:01:00.000Z'),
      }),
      commentSnapshot('deleted-2', postParent, {
        authorUid: 'user-1',
        comment: 'deleted 2',
        createdAt: timestamp('2026-05-28T05:00:00.000Z'),
        deletedAt: timestamp('2026-05-28T05:01:00.000Z'),
      }),
      commentSnapshot('deleted-3', postParent, {
        authorUid: 'user-1',
        comment: 'deleted 3',
        createdAt: timestamp('2026-05-28T04:00:00.000Z'),
        deletedAt: timestamp('2026-05-28T04:01:00.000Z'),
      }),
      commentSnapshot('deleted-4', postParent, {
        authorUid: 'user-1',
        comment: 'deleted 4',
        createdAt: timestamp('2026-05-28T03:00:00.000Z'),
        deletedAt: timestamp('2026-05-28T03:01:00.000Z'),
      }),
      commentSnapshot('active-1', postParent, {
        authorUid: 'user-1',
        comment: 'active 1',
        createdAt: timestamp('2026-05-28T02:00:00.000Z'),
      }),
      commentSnapshot('active-2', postParent, {
        authorUid: 'user-1',
        comment: 'active 2',
        createdAt: timestamp('2026-05-28T01:00:00.000Z'),
      }),
    ];
    const fetchCursorSnapshot = vi.fn(async (cursor) =>
      rawSnapshots.find((snapshot) => snapshot.ref.path === cursor),
    );
    const fetchRawCommentPage = vi.fn(async ({ afterSnapshot, pageSize }) => {
      const startIndex = afterSnapshot
        ? rawSnapshots.findIndex((snapshot) => snapshot.ref.path === afterSnapshot.ref.path) + 1
        : 0;
      return rawSnapshots.slice(startIndex, startIndex + pageSize);
    });
    const fetchParentSnapshot = vi.fn(async () =>
      parentSnapshot(true, {
        title: 'Post 1',
      }),
    );

    const firstPage = await fetchVisibleMemberCommentDocumentsPage({
      uid: 'user-1',
      afterCursor: null,
      pageSize: 2,
      rawReadBudget: 4,
      fetchCursorSnapshot,
      fetchRawCommentPage,
      fetchParentSnapshot,
    });

    expect(firstPage.documents).toEqual([]);
    expect(firstPage.lastDoc).toBe('posts/post-1/comments/deleted-4');
    expect(fetchRawCommentPage).toHaveBeenCalledTimes(2);

    const secondPage = await fetchVisibleMemberCommentDocumentsPage({
      uid: 'user-1',
      afterCursor: firstPage.lastDoc,
      pageSize: 2,
      rawReadBudget: 4,
      fetchCursorSnapshot,
      fetchRawCommentPage,
      fetchParentSnapshot,
    });

    expect(secondPage.documents.map((document) => document.id)).toEqual(['active-1', 'active-2']);
    expect(secondPage.lastDoc).toBe('posts/post-1/comments/active-2');
    expect(fetchCursorSnapshot).toHaveBeenCalledWith('posts/post-1/comments/deleted-4');
  });
});
