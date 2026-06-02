import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

/* eslint-disable jsdoc/require-jsdoc, no-param-reassign, no-use-before-define -- local Firestore test doubles. */

const requireFunctionModule = createRequire(import.meta.url);
const { purgeExpiredEventRetention } = requireFunctionModule(
  '../../../../../functions/event-retention-purge.js',
);

function snapshotExists(snapshot) {
  return typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists !== false;
}

class FakeQuery {
  constructor(docs) {
    this.docs = docs;
    this.whereCalls = [];
  }

  where(field, comparator, value) {
    this.whereCalls.push([field, comparator, value]);
    return this;
  }

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
  constructor(firestore) {
    this.firestore = firestore;
    this.deletes = [];
  }

  delete(ref) {
    this.deletes.push(ref);
  }

  async commit() {
    this.firestore.committedBatches.push(this.deletes.map((ref) => ref.path));
    for (const ref of this.deletes) {
      ref.exists = false;
    }
  }
}

class FakeDocumentRef {
  constructor(path, id, data = {}) {
    this.path = path;
    this.id = id;
    this.exists = true;
    this.subcollections = new Map();
    this.parent = null;
    this.snapshotData = data;
  }

  collection(name) {
    const docs = this.subcollections.get(name) ?? [];
    return new FakeQuery(docs);
  }

  async get() {
    return snapshot(this, this.snapshotData);
  }
}

class FakeFirestore {
  constructor({ events = [], comments = [] } = {}) {
    this.eventsQuery = new FakeQuery(events);
    this.commentsQuery = new FakeQuery(comments);
    this.committedBatches = [];
  }

  collection(name) {
    if (name !== 'events') {
      throw new Error(`Unexpected collection: ${name}`);
    }

    return this.eventsQuery;
  }

  collectionGroup(name) {
    if (name !== 'comments') {
      throw new Error(`Unexpected collection group: ${name}`);
    }

    return this.commentsQuery;
  }

  batch() {
    return new FakeBatch(this);
  }
}

function snapshot(ref, data) {
  ref.snapshotData = data;
  return {
    id: ref.id,
    ref,
    get exists() {
      return ref.exists;
    },
    data: () => data,
  };
}

function commentHistorySnapshot(commentRef, id, data) {
  const collectionRef = {
    id: 'history',
    path: `${commentRef.path}/history`,
    parent: commentRef,
  };
  const ref = new FakeDocumentRef(`${collectionRef.path}/${id}`, id, data);
  ref.parent = collectionRef;
  return snapshot(ref, data);
}

function eventChildSnapshot(eventRef, collectionName, id, data, options = {}) {
  const { exists = true, history = [] } = options;
  const collectionRef = {
    id: collectionName,
    path: `${eventRef.path}/${collectionName}`,
    parent: eventRef,
  };
  const ref = new FakeDocumentRef(`${collectionRef.path}/${id}`, id, data);
  ref.exists = exists;
  ref.parent = collectionRef;

  if (collectionName === 'comments') {
    ref.subcollections.set(
      'history',
      history.map(({ id: historyId, data: historyData }) =>
        commentHistorySnapshot(ref, historyId, historyData),
      ),
    );
  }

  return snapshot(ref, data);
}

function eventSnapshot(eventId, data, options = {}) {
  const { comments = [], exists = true, participants = [] } = options;
  const ref = new FakeDocumentRef(`events/${eventId}`, eventId, data);
  ref.exists = exists;
  ref.subcollections.set(
    'participants',
    participants.map(({ id, data: participantData }) =>
      eventChildSnapshot(ref, 'participants', id, participantData),
    ),
  );
  ref.subcollections.set(
    'comments',
    comments.map(({ id, data: commentData, history = [] }) =>
      eventChildSnapshot(ref, 'comments', id, commentData, { history }),
    ),
  );
  return snapshot(ref, data);
}

function standaloneEventCommentSnapshot(eventDoc, commentId, data, options = {}) {
  return eventChildSnapshot(eventDoc.ref, 'comments', commentId, data, options);
}

describe('event retention purge core', () => {
  it('purges expired event trees and standalone active-parent comments with history', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const future = new Date('2026-08-28T00:00:00.000Z');
    const expiredEvent = eventSnapshot(
      'event-expired',
      { deletedAt: expired, deletedPurgeAt: expired },
      {
        participants: [
          { id: 'participant-1', data: { uid: 'runner-1' } },
          { id: 'participant-2', data: { uid: 'runner-2' } },
        ],
        comments: [
          {
            id: 'comment-1',
            data: { deletedPurgeAt: expired },
            history: [{ id: 'history-1', data: { body: 'old' } }],
          },
          { id: 'comment-2', data: { deletedPurgeAt: expired } },
        ],
      },
    );
    const futureEvent = eventSnapshot('event-future', {
      deletedAt: expired,
      deletedPurgeAt: future,
    });
    const activeEvent = eventSnapshot('event-active', { title: 'Active event' });
    const deletedParentEvent = eventSnapshot('event-deleted-parent', {
      deletedAt: expired,
      deletedPurgeAt: future,
    });
    const activeParentComment = standaloneEventCommentSnapshot(
      activeEvent,
      'comment-3',
      { deletedAt: expired, deletedPurgeAt: expired },
      { history: [{ id: 'history-2', data: { body: 'edit' } }] },
    );
    const deletedParentComment = standaloneEventCommentSnapshot(deletedParentEvent, 'comment-4', {
      deletedAt: expired,
      deletedPurgeAt: expired,
    });
    const futureComment = standaloneEventCommentSnapshot(activeEvent, 'comment-5', {
      deletedAt: expired,
      deletedPurgeAt: future,
    });
    const firestore = new FakeFirestore({
      events: [expiredEvent, futureEvent],
      comments: [activeParentComment, deletedParentComment, futureComment],
    });
    const logger = { info: vi.fn() };

    const counts = await purgeExpiredEventRetention({ firestore, logger, now });

    expect(counts).toEqual({
      events: 1,
      eventComments: 3,
      participants: 2,
      historyRecords: 2,
      skips: 1,
    });
    expect(firestore.eventsQuery.whereCalls).toEqual([['deletedPurgeAt', '<=', now]]);
    expect(firestore.commentsQuery.whereCalls).toEqual([['deletedPurgeAt', '<=', now]]);
    expect(firestore.committedBatches.flat()).toEqual([
      'events/event-expired/participants/participant-1',
      'events/event-expired/participants/participant-2',
      'events/event-expired/comments/comment-1/history/history-1',
      'events/event-expired/comments/comment-1',
      'events/event-expired/comments/comment-2',
      'events/event-expired',
      'events/event-active/comments/comment-3/history/history-2',
      'events/event-active/comments/comment-3',
    ]);
    expect(snapshotExists(expiredEvent)).toBe(false);
    expect(snapshotExists(futureEvent)).toBe(true);
    expect(snapshotExists(deletedParentComment)).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('event retention purge completed', { counts });
  });

  it('does not count collection-group comments owned by an event tree purge as skipped', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const expiredEvent = eventSnapshot(
      'event-expired',
      { deletedAt: expired, deletedPurgeAt: expired },
      {
        comments: [
          {
            id: 'comment-1',
            data: { deletedAt: expired, deletedPurgeAt: expired },
            history: [{ id: 'history-1', data: { body: 'old' } }],
          },
        ],
      },
    );
    const [treeOwnedComment] = expiredEvent.ref.collection('comments').docs;
    const firestore = new FakeFirestore({
      events: [expiredEvent],
      comments: [treeOwnedComment],
    });
    const logger = { info: vi.fn() };

    const counts = await purgeExpiredEventRetention({ firestore, logger, now });

    expect(counts).toEqual({
      events: 1,
      eventComments: 1,
      participants: 0,
      historyRecords: 1,
      skips: 0,
    });
    expect(firestore.committedBatches.flat()).toEqual([
      'events/event-expired/comments/comment-1/history/history-1',
      'events/event-expired/comments/comment-1',
      'events/event-expired',
    ]);
    expect(logger.info).toHaveBeenCalledWith('event retention purge completed', { counts });
  });

  it('re-runs successfully when previously returned documents are now missing', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const expiredEvent = eventSnapshot(
      'event-expired',
      { deletedAt: expired, deletedPurgeAt: expired },
      { participants: [{ id: 'participant-1', data: { uid: 'runner-1' } }] },
    );
    const activeEvent = eventSnapshot('event-active', { title: 'Active event' });
    const standaloneComment = standaloneEventCommentSnapshot(activeEvent, 'comment-1', {
      deletedAt: expired,
      deletedPurgeAt: expired,
    });
    const firestore = new FakeFirestore({
      events: [expiredEvent],
      comments: [standaloneComment],
    });
    const logger = { info: vi.fn() };

    await purgeExpiredEventRetention({ firestore, logger, now });
    const counts = await purgeExpiredEventRetention({ firestore, logger, now });

    expect(counts).toEqual({
      events: 0,
      eventComments: 0,
      participants: 0,
      historyRecords: 0,
      skips: 2,
    });
    expect(firestore.committedBatches).toHaveLength(1);
    expect(logger.info).toHaveBeenLastCalledWith('event retention purge completed', { counts });
  });

  it('keeps every commit batch below the Firestore 500 write limit', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const participants = Array.from({ length: 497 }, (_, index) => ({
      id: `participant-${index}`,
      data: { uid: `runner-${index}` },
    }));
    const comments = [
      {
        id: 'comment-large',
        data: { deletedPurgeAt: expired },
        history: [{ id: 'history-large', data: { body: 'old' } }],
      },
    ];
    const firestore = new FakeFirestore({
      events: [
        eventSnapshot(
          'event-large',
          { deletedAt: expired, deletedPurgeAt: expired },
          { comments, participants },
        ),
      ],
    });
    const logger = { info: vi.fn() };

    const counts = await purgeExpiredEventRetention({ firestore, logger, now });

    expect(counts).toEqual({
      events: 1,
      eventComments: 1,
      participants: 497,
      historyRecords: 1,
      skips: 0,
    });
    expect(firestore.committedBatches.map((batch) => batch.length)).toEqual([499, 1]);
    expect(firestore.committedBatches.every((batch) => batch.length < 500)).toBe(true);
  });

  it('skips expired event comments missing deletedAt or a root event parent', async () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    const expired = new Date('2026-08-26T00:00:00.000Z');
    const activeEvent = eventSnapshot('event-active', { title: 'Active event' });
    const staleComment = standaloneEventCommentSnapshot(activeEvent, 'comment-stale', {
      deletedPurgeAt: expired,
    });
    const userRef = new FakeDocumentRef('users/user-1', 'user-1');
    const nonEventComment = eventChildSnapshot(userRef, 'comments', 'comment-1', {
      deletedAt: expired,
      deletedPurgeAt: expired,
    });
    const firestore = new FakeFirestore({ comments: [staleComment, nonEventComment] });
    const logger = { info: vi.fn() };

    const counts = await purgeExpiredEventRetention({ firestore, logger, now });

    expect(counts).toEqual({
      events: 0,
      eventComments: 0,
      participants: 0,
      historyRecords: 0,
      skips: 2,
    });
    expect(snapshotExists(staleComment)).toBe(true);
    expect(snapshotExists(nonEventComment)).toBe(true);
    expect(firestore.committedBatches).toEqual([]);
  });
});
