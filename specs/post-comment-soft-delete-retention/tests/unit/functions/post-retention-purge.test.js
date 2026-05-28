import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const requireFunctionModule = createRequire(import.meta.url);
const { purgeExpiredPostRetention } = requireFunctionModule(
  '../../../../../functions/post-retention-purge.js',
);

/**
 * Extract whether a Firestore-like snapshot exists.
 * @param {object} snapshot - Firestore document snapshot double.
 * @returns {boolean} Whether the snapshot exists.
 */
function snapshotExists(snapshot) {
  return typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists !== false;
}

class FakeQuery {
  /**
   * @param {Array<object>} docs - Firestore snapshot doubles.
   */
  constructor(docs) {
    this.docs = docs;
    this.whereCalls = [];
  }

  /**
   * Store a Firestore-like where clause.
   * @param {string} field - Queried field.
   * @param {string} comparator - Query comparator.
   * @param {unknown} value - Query value.
   * @returns {FakeQuery} This query.
   */
  where(field, comparator, value) {
    this.whereCalls.push([field, comparator, value]);
    return this;
  }

  /**
   * Return snapshots matching the stored deletedPurgeAt upper-bound query.
   * @returns {Promise<{docs: Array<object>}>} Query snapshot double.
   */
  async get() {
    const deletedPurgeAtQuery = this.whereCalls.find(
      ([field, comparator]) => field === 'deletedPurgeAt' && comparator === '<=',
    );

    if (!deletedPurgeAtQuery) {
      return { docs: this.docs };
    }

    const [, , now] = deletedPurgeAtQuery;
    return {
      docs: this.docs.filter((doc) => {
        const data = typeof doc.data === 'function' ? doc.data() : {};
        return data.deletedPurgeAt <= now;
      }),
    };
  }
}

class FakeBatch {
  /**
   * @param {FakeFirestore} firestore - Owning fake Firestore instance.
   * @param {number} index - Batch creation index.
   */
  constructor(firestore, index) {
    this.firestore = firestore;
    this.index = index;
    this.deletes = [];
  }

  /**
   * Queue a Firestore-like delete write.
   * @param {FakeDocumentRef} ref - Firestore document ref double.
   */
  delete(ref) {
    this.deletes.push(ref);
  }

  /**
   * Commit queued writes and mark refs missing for rerun checks.
   * @returns {Promise<void>} Resolves when writes are recorded.
   */
  async commit() {
    if (this.firestore.failingBatchIndexes.has(this.index)) {
      throw new Error(`Batch ${this.index} failed`);
    }

    this.firestore.committedBatches.push(this.deletes.map((ref) => ref.path));
    for (const ref of this.deletes) {
      ref.exists = false;
    }
  }
}

class FakeDocumentRef {
  /**
   * @param {string} path - Firestore document path.
   * @param {string} id - Firestore document ID.
   */
  constructor(path, id) {
    this.path = path;
    this.id = id;
    this.exists = true;
    this.subcollections = new Map();
    this.parent = null;
  }

  /**
   * Return a Firestore-like subcollection query.
   * @param {string} name - Subcollection name.
   * @returns {FakeQuery} Query double.
   */
  collection(name) {
    const docs = this.subcollections.get(name) ?? [];
    return new FakeQuery(docs);
  }
}

class FakeFirestore {
  /**
   * @param {{
   *   posts?: Array<object>,
   *   comments?: Array<object>,
   *   failingBatchIndexes?: Array<number>,
   * }} options - Seed docs.
   */
  constructor({ posts = [], comments = [], failingBatchIndexes = [] } = {}) {
    this.postsQuery = new FakeQuery(posts);
    this.commentsQuery = new FakeQuery(comments);
    this.committedBatches = [];
    this.createdBatchCount = 0;
    this.failingBatchIndexes = new Set(failingBatchIndexes);
  }

  /**
   * Return a root collection query.
   * @param {string} name - Collection name.
   * @returns {FakeQuery} Query double.
   */
  collection(name) {
    if (name !== 'posts') {
      throw new Error(`Unexpected collection: ${name}`);
    }

    return this.postsQuery;
  }

  /**
   * Return a collection group query.
   * @param {string} name - Collection group name.
   * @returns {FakeQuery} Query double.
   */
  collectionGroup(name) {
    if (name !== 'comments') {
      throw new Error(`Unexpected collection group: ${name}`);
    }

    return this.commentsQuery;
  }

  /**
   * Return a Firestore-like write batch.
   * @returns {FakeBatch} Batch double.
   */
  batch() {
    const batch = new FakeBatch(this, this.createdBatchCount);
    this.createdBatchCount += 1;
    return batch;
  }
}

/**
 * Build a Firestore-like document snapshot.
 * @param {FakeDocumentRef} ref - Firestore document ref double.
 * @param {object} data - Firestore document data.
 * @returns {object} Snapshot double.
 */
function snapshot(ref, data) {
  return {
    id: ref.id,
    ref,
    get exists() {
      return ref.exists;
    },
    data: () => data,
  };
}

/**
 * Build a child snapshot under a post.
 * @param {FakeDocumentRef} postRef - Parent post ref.
 * @param {string} collectionName - Child collection name.
 * @param {string} id - Child document ID.
 * @param {object} data - Child document data.
 * @param {boolean} exists - Whether the child exists.
 * @returns {object} Child snapshot double.
 */
function childSnapshot(postRef, collectionName, id, data, exists = true) {
  const collectionRef = {
    id: collectionName,
    path: `${postRef.path}/${collectionName}`,
    parent: postRef,
  };
  const ref = new FakeDocumentRef(`${collectionRef.path}/${id}`, id);
  ref.exists = exists;
  ref.parent = collectionRef;
  return snapshot(ref, data);
}

/**
 * Build a post snapshot with fake comments and likes.
 * @param {string} postId - Post ID.
 * @param {object} data - Post document data.
 * @param {{ comments?: Array<object>, likes?: Array<object>, exists?: boolean }} options - Children.
 * @returns {object} Post snapshot double.
 */
function postSnapshot(postId, data, { comments = [], likes = [], exists = true } = {}) {
  const ref = new FakeDocumentRef(`posts/${postId}`, postId);
  ref.exists = exists;
  ref.subcollections.set(
    'comments',
    comments.map(({ id, data: commentData, exists: commentExists = true }) =>
      childSnapshot(ref, 'comments', id, commentData, commentExists),
    ),
  );
  ref.subcollections.set(
    'likes',
    likes.map(({ id, data: likeData, exists: likeExists = true }) =>
      childSnapshot(ref, 'likes', id, likeData, likeExists),
    ),
  );
  return snapshot(ref, data);
}

/**
 * Build a standalone comment snapshot from a parent post ID.
 * @param {string} postId - Parent post ID.
 * @param {string} commentId - Comment ID.
 * @param {object} data - Comment data.
 * @param {boolean} [exists] - Whether the comment exists.
 * @returns {object} Comment snapshot double.
 */
function standaloneCommentSnapshot(postId, commentId, data, exists = true) {
  const postRef = new FakeDocumentRef(`posts/${postId}`, postId);
  return childSnapshot(postRef, 'comments', commentId, data, exists);
}

/**
 * Build a non-post collection group comment snapshot.
 * @param {string} eventId - Parent event ID.
 * @param {string} commentId - Comment ID.
 * @param {object} data - Comment data.
 * @returns {object} Event comment snapshot double.
 */
function eventCommentSnapshot(eventId, commentId, data) {
  const eventRef = new FakeDocumentRef(`events/${eventId}`, eventId);
  return childSnapshot(eventRef, 'comments', commentId, data);
}

describe('post retention purge core', () => {
  it('uses a Firebase-supported Node runtime and synced lockfile metadata', async () => {
    const functionsPackage = requireFunctionModule('../../../../../functions/package.json');
    const functionsPackageLock = requireFunctionModule('../../../../../functions/package-lock.json');

    expect(functionsPackage.engines.node).toBe('22');
    expect(functionsPackageLock.packages[''].engines.node).toBe('22');
  });

  it('configures the collection-group index used by standalone comment purge', () => {
    const firestoreIndexes = requireFunctionModule('../../../../../firestore.indexes.json');
    const deletedPurgeAtOverride = firestoreIndexes.fieldOverrides.find(
      (override) =>
        override.collectionGroup === 'comments' && override.fieldPath === 'deletedPurgeAt',
    );

    expect(deletedPurgeAtOverride).toBeDefined();
    expect(deletedPurgeAtOverride.indexes).toEqual(
      expect.arrayContaining([{ order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' }]),
    );
  });

  it('purges expired post trees and standalone comments while skipping comments under purged posts', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const future = new Date('2026-08-28T00:00:00.000Z');
    const expiredPost = postSnapshot(
      'post-expired',
      { deletedAt: expired, deletedPurgeAt: expired },
      {
        comments: [
          { id: 'comment-1', data: { deletedPurgeAt: expired } },
          { id: 'comment-2', data: { deletedPurgeAt: expired } },
        ],
        likes: [{ id: 'like-1', data: {} }],
      },
    );
    const futurePost = postSnapshot('post-future', { deletedAt: expired, deletedPurgeAt: future });
    const standaloneActivePostComment = standaloneCommentSnapshot('post-active', 'comment-3', {
      deletedAt: expired,
      deletedPurgeAt: expired,
    });
    const standalonePurgedPostComment = standaloneCommentSnapshot('post-expired', 'comment-4', {
      deletedAt: expired,
      deletedPurgeAt: expired,
    });
    const futureStandaloneComment = standaloneCommentSnapshot('post-active', 'comment-5', {
      deletedAt: expired,
      deletedPurgeAt: future,
    });
    const firestore = new FakeFirestore({
      posts: [expiredPost, futurePost],
      comments: [standaloneActivePostComment, standalonePurgedPostComment, futureStandaloneComment],
    });
    const logger = { info: vi.fn() };

    const counts = await purgeExpiredPostRetention({ firestore, logger, now });

    expect(counts).toEqual({ posts: 1, comments: 3, likes: 1, skips: 1 });
    expect(firestore.postsQuery.whereCalls).toEqual([['deletedPurgeAt', '<=', now]]);
    expect(firestore.commentsQuery.whereCalls).toEqual([['deletedPurgeAt', '<=', now]]);
    expect(firestore.committedBatches.flat()).toEqual([
      'posts/post-expired/comments/comment-1',
      'posts/post-expired/comments/comment-2',
      'posts/post-expired/likes/like-1',
      'posts/post-expired',
      'posts/post-active/comments/comment-3',
    ]);
    expect(snapshotExists(expiredPost)).toBe(false);
    expect(snapshotExists(futurePost)).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('post retention purge completed', { counts });
  });

  it('re-runs successfully when previously returned documents are now missing', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const expiredPost = postSnapshot(
      'post-expired',
      { deletedAt: expired, deletedPurgeAt: expired },
      {
        comments: [{ id: 'comment-1', data: { deletedPurgeAt: expired } }],
        likes: [{ id: 'like-1', data: {} }],
      },
    );
    const standaloneComment = standaloneCommentSnapshot('post-active', 'comment-2', {
      deletedAt: expired,
      deletedPurgeAt: expired,
    });
    const firestore = new FakeFirestore({
      posts: [expiredPost],
      comments: [standaloneComment],
    });
    const logger = { info: vi.fn() };

    await purgeExpiredPostRetention({ firestore, logger, now });
    const counts = await purgeExpiredPostRetention({ firestore, logger, now });

    expect(counts).toEqual({ posts: 0, comments: 0, likes: 0, skips: 4 });
    expect(firestore.committedBatches).toHaveLength(1);
    expect(logger.info).toHaveBeenLastCalledWith('post retention purge completed', { counts });
  });

  it('keeps every commit batch below the Firestore 500 write limit', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const comments = Array.from({ length: 499 }, (_, index) => ({
      id: `comment-${index}`,
      data: { deletedPurgeAt: expired },
    }));
    const firestore = new FakeFirestore({
      posts: [postSnapshot('post-big', { deletedAt: expired, deletedPurgeAt: expired }, { comments })],
    });
    const logger = { info: vi.fn() };

    const counts = await purgeExpiredPostRetention({ firestore, logger, now });

    expect(counts).toEqual({ posts: 1, comments: 499, likes: 0, skips: 0 });
    expect(firestore.committedBatches.map((batch) => batch.length)).toEqual([499, 1]);
    expect(firestore.committedBatches.every((batch) => batch.length < 500)).toBe(true);
  });

  it('does not commit a later parent-post batch when an earlier child batch fails', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const comments = Array.from({ length: 499 }, (_, index) => ({
      id: `comment-${index}`,
      data: { deletedPurgeAt: expired },
    }));
    const expiredPost = postSnapshot(
      'post-large',
      { deletedAt: expired, deletedPurgeAt: expired },
      { comments },
    );
    const firestore = new FakeFirestore({
      posts: [expiredPost],
      failingBatchIndexes: [0],
    });
    const logger = { info: vi.fn() };

    await expect(purgeExpiredPostRetention({ firestore, logger, now })).rejects.toThrow(
      'Batch 0 failed',
    );

    expect(snapshotExists(expiredPost)).toBe(true);
    expect(firestore.committedBatches).toEqual([]);
  });

  it('skips expired comments from non-post collection groups', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const eventComment = eventCommentSnapshot('event-1', 'comment-1', {
      deletedAt: expired,
      deletedPurgeAt: expired,
    });
    const firestore = new FakeFirestore({ comments: [eventComment] });
    const logger = { info: vi.fn() };

    const counts = await purgeExpiredPostRetention({ firestore, logger, now });

    expect(counts).toEqual({ posts: 0, comments: 0, likes: 0, skips: 1 });
    expect(snapshotExists(eventComment)).toBe(true);
    expect(firestore.committedBatches).toEqual([]);
  });

  it('skips expired posts missing deletedAt without deleting their children', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const stalePost = postSnapshot(
      'post-stale',
      { deletedPurgeAt: expired },
      {
        comments: [{ id: 'comment-1', data: { deletedPurgeAt: expired } }],
        likes: [{ id: 'like-1', data: {} }],
      },
    );
    const firestore = new FakeFirestore({ posts: [stalePost] });
    const logger = { info: vi.fn() };

    const counts = await purgeExpiredPostRetention({ firestore, logger, now });

    expect(counts).toEqual({ posts: 0, comments: 0, likes: 0, skips: 1 });
    expect(snapshotExists(stalePost)).toBe(true);
    expect(snapshotExists(stalePost.ref.collection('comments').docs[0])).toBe(true);
    expect(snapshotExists(stalePost.ref.collection('likes').docs[0])).toBe(true);
    expect(firestore.committedBatches).toEqual([]);
  });

  it('skips expired standalone post comments missing deletedAt', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const staleComment = standaloneCommentSnapshot('post-active', 'comment-1', {
      deletedPurgeAt: expired,
    });
    const firestore = new FakeFirestore({ comments: [staleComment] });
    const logger = { info: vi.fn() };

    const counts = await purgeExpiredPostRetention({ firestore, logger, now });

    expect(counts).toEqual({ posts: 0, comments: 0, likes: 0, skips: 1 });
    expect(snapshotExists(staleComment)).toBe(true);
    expect(firestore.committedBatches).toEqual([]);
  });
});
