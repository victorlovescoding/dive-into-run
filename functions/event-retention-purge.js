'use strict';

/* eslint-disable no-await-in-loop -- standalone comment parent checks are serialized for deterministic purge ordering. */

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
 * Return the parent event path for an event comment snapshot.
 * @param {object | null | undefined} snapshot - Comment document snapshot.
 * @returns {string | null} Parent event document path.
 */
function getCommentParentEventPath(snapshot) {
  const path = snapshot?.ref?.parent?.parent?.path;
  return typeof path === 'string' && path.length > 0 ? path : null;
}

/**
 * Check whether a path is a root event document path.
 * @param {string | null} path - Firestore document path.
 * @returns {boolean} Whether the path points to `events/{eventId}`.
 */
function isRootEventPath(path) {
  return typeof path === 'string' && /^events\/[^/]+$/.test(path);
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
 * Read an event comment's history records.
 * @param {object} commentDoc - Event comment snapshot.
 * @returns {Promise<Array<object>>} History snapshots.
 */
async function readCommentHistory(commentDoc) {
  const historyQuery = commentDoc?.ref?.collection?.('history');
  return historyQuery ? getQueryDocs(historyQuery) : [];
}

/**
 * Read an event's child participants, comments, and comment histories.
 * @param {object} eventDoc - Event document snapshot.
 * @returns {Promise<{
 *   comments: Array<{ commentDoc: object, historyDocs: Array<object> }>,
 *   eventDoc: object,
 *   participants: Array<object>,
 * }>} Event tree.
 */
async function readEventTree(eventDoc) {
  const participantsQuery = eventDoc?.ref?.collection?.('participants');
  const commentsQuery = eventDoc?.ref?.collection?.('comments');
  const [participants, comments] = await Promise.all([
    participantsQuery ? getQueryDocs(participantsQuery) : Promise.resolve([]),
    commentsQuery ? getQueryDocs(commentsQuery) : Promise.resolve([]),
  ]);
  const commentsWithHistory = await Promise.all(
    comments.map(async (commentDoc) => ({
      commentDoc,
      historyDocs: await readCommentHistory(commentDoc),
    })),
  );

  return { comments: commentsWithHistory, eventDoc, participants };
}

/**
 * Build a mutable delete collector that tracks purge counts.
 * @returns {{
 *   readonly refs: Array<object>,
 *   counts: () => {
 *     events: number,
 *     eventComments: number,
 *     historyRecords: number,
 *     participants: number,
 *     skips: number,
 *   },
 *   queue: (
 *     snapshot: object,
 *     countKey: 'events' | 'eventComments' | 'historyRecords' | 'participants',
 *   ) => void,
 *   skip: () => void,
 * }} Delete collector.
 */
function createDeleteCollector() {
  const refs = [];
  let events = 0;
  let eventComments = 0;
  let historyRecords = 0;
  let participants = 0;
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

      if (countKey === 'events') {
        events += 1;
      } else if (countKey === 'eventComments') {
        eventComments += 1;
      } else if (countKey === 'historyRecords') {
        historyRecords += 1;
      } else if (countKey === 'participants') {
        participants += 1;
      } else {
        throw new Error(`Unknown purge count key: ${countKey}`);
      }
    },

    skip() {
      skips += 1;
    },

    counts() {
      return { events, eventComments, participants, historyRecords, skips };
    },
  };
}

/**
 * Queue deletes for every document in an expired event tree.
 * @param {ReturnType<typeof createDeleteCollector>} collector - Delete collector.
 * @param {{
 *   comments: Array<{ commentDoc: object, historyDocs: Array<object> }>,
 *   eventDoc: object,
 *   participants: Array<object>,
 * }} tree - Event tree.
 */
function queueEventTreeDeletes(collector, tree) {
  tree.participants.forEach((participantDoc) => {
    collector.queue(participantDoc, 'participants');
  });
  tree.comments.forEach(({ commentDoc, historyDocs }) => {
    historyDocs.forEach((historyDoc) => {
      collector.queue(historyDoc, 'historyRecords');
    });
    collector.queue(commentDoc, 'eventComments');
  });
  collector.queue(tree.eventDoc, 'events');
}

/**
 * Read a standalone event comment's parent event snapshot.
 * @param {object} commentDoc - Event comment snapshot.
 * @returns {Promise<object | null>} Parent event snapshot when available.
 */
async function readParentEvent(commentDoc) {
  const parentEventRef = commentDoc?.ref?.parent?.parent;
  return typeof parentEventRef?.get === 'function' ? parentEventRef.get() : null;
}

/**
 * Queue deletes for expired standalone event comments.
 * @param {ReturnType<typeof createDeleteCollector>} collector - Delete collector.
 * @param {Array<object>} commentDocs - Expired comment snapshots.
 * @param {Set<string>} purgedEventPaths - Event paths already queued for tree purge.
 * @returns {Promise<void>} Resolves after standalone comments are inspected.
 */
async function queueStandaloneCommentDeletes(collector, commentDocs, purgedEventPaths) {
  for (const commentDoc of commentDocs) {
    if (!documentExists(commentDoc) || !commentDoc.ref) {
      collector.skip();
      continue;
    }

    const parentEventPath = getCommentParentEventPath(commentDoc);
    if (!isRootEventPath(parentEventPath) || !isSoftDeletedSnapshot(commentDoc)) {
      collector.skip();
      continue;
    }

    if (purgedEventPaths.has(parentEventPath)) {
      continue;
    }

    const parentEventDoc = await readParentEvent(commentDoc);
    if (!documentExists(parentEventDoc) || isSoftDeletedSnapshot(parentEventDoc)) {
      collector.skip();
      continue;
    }

    const historyDocs = await readCommentHistory(commentDoc);
    historyDocs.forEach((historyDoc) => {
      collector.queue(historyDoc, 'historyRecords');
    });
    collector.queue(commentDoc, 'eventComments');
  }
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
 * Purge expired soft-deleted events and event comments.
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
 * @returns {Promise<{
 *   events: number,
 *   eventComments: number,
 *   historyRecords: number,
 *   participants: number,
 *   skips: number,
 * }>} Purge counts.
 */
async function purgeExpiredEventRetention(options) {
  const { firestore, logger = DEFAULT_LOGGER, now = new Date() } = options || {};

  if (!firestore) {
    throw new Error('purgeExpiredEventRetention: firestore is required');
  }

  const [eventDocs, commentDocs] = await Promise.all([
    getQueryDocs(firestore.collection('events').where('deletedPurgeAt', '<=', now)),
    getQueryDocs(firestore.collectionGroup('comments').where('deletedPurgeAt', '<=', now)),
  ]);
  const collector = createDeleteCollector();
  const purgedEventPaths = new Set();
  const eventDocsToPurge = [];

  eventDocs.forEach((eventDoc) => {
    if (!documentExists(eventDoc)) {
      collector.skip();
      return;
    }

    if (!isSoftDeletedSnapshot(eventDoc)) {
      collector.skip();
      return;
    }

    const eventPath = getDocumentPath(eventDoc);
    if (eventPath) {
      purgedEventPaths.add(eventPath);
    }
    eventDocsToPurge.push(eventDoc);
  });

  const eventTrees = await Promise.all(eventDocsToPurge.map((eventDoc) => readEventTree(eventDoc)));

  eventTrees.forEach((tree) => {
    queueEventTreeDeletes(collector, tree);
  });
  await queueStandaloneCommentDeletes(collector, commentDocs, purgedEventPaths);

  await commitDeletes(firestore, collector.refs);

  const counts = collector.counts();
  if (typeof logger.info === 'function') {
    logger.info('event retention purge completed', { counts });
  }

  return counts;
}

module.exports = {
  MAX_BATCH_WRITES,
  purgeExpiredEventRetention,
};
