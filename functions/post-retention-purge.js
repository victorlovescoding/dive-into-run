'use strict';

const MAX_BATCH_WRITES = 499;
const DEFAULT_LOGGER = Object.freeze({
  info: () => undefined,
});

/**
 * Check whether a Firestore-like snapshot exists.
 * @param {object | null | undefined} snapshot - Firestore document snapshot.
 * @returns {boolean} Whether the snapshot exists.
 */
function documentExists(snapshot) {
  if (!snapshot) {
    return false;
  }

  if (typeof snapshot.exists === 'function') {
    return snapshot.exists();
  }

  return snapshot.exists !== false;
}

/**
 * Check whether a Firestore-like snapshot carries a soft-delete marker.
 * @param {object | null | undefined} snapshot - Firestore document snapshot.
 * @returns {boolean} Whether the snapshot data has `deletedAt`.
 */
function isSoftDeletedSnapshot(snapshot) {
  const data = typeof snapshot?.data === 'function' ? snapshot.data() : null;
  return !!data && Object.prototype.hasOwnProperty.call(data, 'deletedAt');
}

/**
 * Return a Firestore-like document path when one is available.
 * @param {object | null | undefined} snapshot - Firestore document snapshot.
 * @returns {string | null} Firestore document path.
 */
function getDocumentPath(snapshot) {
  const path = snapshot?.ref?.path;
  return typeof path === 'string' && path.length > 0 ? path : null;
}

/**
 * Return the parent post path for a post comment snapshot.
 * @param {object | null | undefined} snapshot - Comment document snapshot.
 * @returns {string | null} Parent post document path.
 */
function getCommentParentPostPath(snapshot) {
  const path = snapshot?.ref?.parent?.parent?.path;
  return typeof path === 'string' && path.length > 0 ? path : null;
}

/**
 * Check whether a path is a root post document path.
 * @param {string | null} path - Firestore document path.
 * @returns {boolean} Whether the path points to `posts/{postId}`.
 */
function isRootPostPath(path) {
  return typeof path === 'string' && /^posts\/[^/]+$/.test(path);
}

/**
 * Read docs from a Firestore-like query.
 * @param {{ get: () => Promise<{ docs?: Array<object> }> }} query - Firestore query.
 * @returns {Promise<Array<object>>} Query docs.
 */
async function getQueryDocs(query) {
  const querySnapshot = await query.get();
  const { docs = [] } = querySnapshot || {};
  return docs;
}

/**
 * Read a post's child comments and likes.
 * @param {object} postDoc - Post document snapshot.
 * @returns {Promise<{ postDoc: object, comments: Array<object>, likes: Array<object> }>} Post tree.
 */
async function readPostTree(postDoc) {
  const commentsQuery = postDoc?.ref?.collection?.('comments');
  const likesQuery = postDoc?.ref?.collection?.('likes');
  const [comments, likes] = await Promise.all([
    commentsQuery ? getQueryDocs(commentsQuery) : Promise.resolve([]),
    likesQuery ? getQueryDocs(likesQuery) : Promise.resolve([]),
  ]);

  return { postDoc, comments, likes };
}

/**
 * Build a mutable delete collector that tracks purge counts.
 * @returns {{
 *   readonly refs: Array<object>,
 *   queue: (snapshot: object, countKey: 'posts' | 'comments' | 'likes') => void,
 *   skip: () => void,
 *   counts: () => { posts: number, comments: number, likes: number, skips: number },
 * }} Delete collector.
 */
function createDeleteCollector() {
  const refs = [];
  let posts = 0;
  let comments = 0;
  let likes = 0;
  let skips = 0;

  return {
    get refs() {
      return refs;
    },

    queue(snapshot, countKey) {
      if (!documentExists(snapshot) || !snapshot.ref) {
        skips += 1;
        return;
      }

      refs.push(snapshot.ref);

      if (countKey === 'posts') {
        posts += 1;
      } else if (countKey === 'comments') {
        comments += 1;
      } else if (countKey === 'likes') {
        likes += 1;
      } else {
        throw new Error(`Unknown purge count key: ${countKey}`);
      }
    },

    skip() {
      skips += 1;
    },

    counts() {
      return { posts, comments, likes, skips };
    },
  };
}

/**
 * Queue deletes for every document in an expired post tree.
 * @param {ReturnType<typeof createDeleteCollector>} collector - Delete collector.
 * @param {{ postDoc: object, comments: Array<object>, likes: Array<object> }} tree - Post tree.
 */
function queuePostTreeDeletes(collector, tree) {
  tree.comments.forEach((commentDoc) => {
    collector.queue(commentDoc, 'comments');
  });
  tree.likes.forEach((likeDoc) => {
    collector.queue(likeDoc, 'likes');
  });
  collector.queue(tree.postDoc, 'posts');
}

/**
 * Queue deletes for expired standalone comments.
 * @param {ReturnType<typeof createDeleteCollector>} collector - Delete collector.
 * @param {Array<object>} commentDocs - Expired comment snapshots.
 * @param {Set<string>} purgedPostPaths - Post paths already queued for tree purge.
 */
function queueStandaloneCommentDeletes(collector, commentDocs, purgedPostPaths) {
  commentDocs.forEach((commentDoc) => {
    if (!documentExists(commentDoc) || !commentDoc.ref) {
      collector.skip();
      return;
    }

    const parentPostPath = getCommentParentPostPath(commentDoc);
    if (
      !isRootPostPath(parentPostPath) ||
      purgedPostPaths.has(parentPostPath) ||
      !isSoftDeletedSnapshot(commentDoc)
    ) {
      collector.skip();
      return;
    }

    collector.queue(commentDoc, 'comments');
  });
}

/**
 * Commit queued deletes in batches below Firestore's 500-write limit.
 * @param {{ batch: () => { delete: (ref: object) => void, commit: () => Promise<void> } }} firestore
 * Firestore adapter.
 * @param {Array<object>} refs - Document refs queued for deletion.
 * @returns {Promise<void>} Resolves after all commits finish.
 */
async function commitDeletes(firestore, refs) {
  if (refs.length === 0) {
    return;
  }

  const batches = [];
  let batch = firestore.batch();
  let writeCount = 0;

  refs.forEach((ref) => {
    if (writeCount >= MAX_BATCH_WRITES) {
      batches.push(batch);
      batch = firestore.batch();
      writeCount = 0;
    }

    batch.delete(ref);
    writeCount += 1;
  });

  if (writeCount > 0) {
    batches.push(batch);
  }

  await batches.reduce(
    (previousCommit, pendingBatch) => previousCommit.then(() => pendingBatch.commit()),
    Promise.resolve(),
  );
}

/**
 * Purge expired soft-deleted posts and comments.
 * @param {{
 *   firestore: {
 *     collection: (name: string) => {
 *       where: (field: string, comparator: string, value: unknown) => {
 *         get: () => Promise<{ docs?: Array<object> }>,
 *       },
 *     },
 *     collectionGroup: (name: string) => {
 *       where: (field: string, comparator: string, value: unknown) => {
 *         get: () => Promise<{ docs?: Array<object> }>,
 *       },
 *     },
 *     batch: () => { delete: (ref: object) => void, commit: () => Promise<void> },
 *   },
 *   logger?: { info?: (message: string, data?: object) => void },
 *   now?: unknown,
 * }} options - Purge dependencies.
 * @returns {Promise<{ posts: number, comments: number, likes: number, skips: number }>} Purge counts.
 */
async function purgeExpiredPostRetention(options) {
  const { firestore, logger = DEFAULT_LOGGER, now = new Date() } = options || {};

  if (!firestore) {
    throw new Error('purgeExpiredPostRetention: firestore is required');
  }

  const [postDocs, commentDocs] = await Promise.all([
    getQueryDocs(firestore.collection('posts').where('deletedPurgeAt', '<=', now)),
    getQueryDocs(firestore.collectionGroup('comments').where('deletedPurgeAt', '<=', now)),
  ]);
  const collector = createDeleteCollector();
  const purgedPostPaths = new Set();
  const postDocsToPurge = [];

  postDocs.forEach((postDoc) => {
    if (!documentExists(postDoc)) {
      postDocsToPurge.push(postDoc);
      return;
    }

    if (!isSoftDeletedSnapshot(postDoc)) {
      collector.skip();
      return;
    }

    const postPath = getDocumentPath(postDoc);
    if (postPath) {
      purgedPostPaths.add(postPath);
    }
    postDocsToPurge.push(postDoc);
  });

  const postTrees = await Promise.all(postDocsToPurge.map((postDoc) => readPostTree(postDoc)));

  postTrees.forEach((tree) => {
    queuePostTreeDeletes(collector, tree);
  });
  queueStandaloneCommentDeletes(collector, commentDocs, purgedPostPaths);

  await commitDeletes(firestore, collector.refs);

  const counts = collector.counts();
  if (typeof logger.info === 'function') {
    logger.info('post retention purge completed', { counts });
  }

  return counts;
}

module.exports = {
  MAX_BATCH_WRITES,
  purgeExpiredPostRetention,
};
