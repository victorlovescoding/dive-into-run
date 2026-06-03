/* eslint @vitest/expect-expect: ["error", { "assertFunctionNames": ["expect", "assert", "assertSucceeds", "assertFails"] }] */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-test';
const RULES_PATH = 'firestore.rules';
const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/**
 * Returns an authenticated Firestore test client.
 * @param {string} uid - Authenticated uid.
 * @returns {import('firebase/firestore').Firestore} Firestore client.
 */
function dbFor(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

/**
 * Returns an unauthenticated Firestore test client.
 * @returns {import('firebase/firestore').Firestore} Firestore client.
 */
function anonymousDb() {
  return testEnv.unauthenticatedContext().firestore();
}

/**
 * Seeds Firestore with security rules disabled.
 * @param {(db: import('firebase/firestore').Firestore) => Promise<void>} seedFn - Seed callback.
 * @returns {Promise<void>} Seed completion.
 */
async function seed(seedFn) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seedFn(context.firestore());
  });
}

/**
 * Calculates a Firestore Timestamp offset by whole days.
 * @param {import('firebase/firestore').Timestamp} timestamp - Base timestamp.
 * @param {number} days - Number of days to add.
 * @returns {import('firebase/firestore').Timestamp} Offset timestamp.
 */
function addDaysToTimestamp(timestamp, days) {
  return Timestamp.fromMillis(timestamp.toMillis() + days * 24 * 60 * 60 * 1000);
}

/**
 * Builds a stale but exact retention payload.
 * @returns {import('firebase/firestore').Timestamp} Backdated delete timestamp.
 */
function staleDeletedAt() {
  return Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
}

/**
 * Builds the soft-delete payload sent by client runtime code.
 * @param {string} actorUid - Acting user uid.
 * @param {Partial<{
 *   deletedAt: import('firebase/firestore').Timestamp,
 *   deletedByUid: string,
 *   deletedPurgeAt: import('firebase/firestore').Timestamp,
 * }>} [overrides] - Field overrides.
 * @returns {{ deletedAt: import('firebase/firestore').Timestamp, deletedByUid: string, deletedPurgeAt: import('firebase/firestore').Timestamp }} Firestore update payload.
 */
function softDeletePayload(actorUid, overrides = {}) {
  const deletedAt = overrides.deletedAt ?? Timestamp.now();

  return {
    deletedAt,
    deletedByUid: overrides.deletedByUid ?? actorUid,
    deletedPurgeAt: overrides.deletedPurgeAt ?? addDaysToTimestamp(deletedAt, RETENTION_DAYS),
  };
}

/**
 * Seeds a post and one child comment.
 * @param {object} options - Seed options.
 * @param {string} options.postId - Post id.
 * @param {string} options.commentId - Comment id.
 * @param {string} options.postAuthorUid - Parent post author uid.
 * @param {string} options.commentAuthorUid - Child comment author uid.
 * @param {boolean} [options.deletedPost] - Whether the parent post is soft-deleted.
 * @param {boolean} [options.deletedComment] - Whether the parent comment is soft-deleted.
 * @returns {Promise<void>} Seed completion.
 */
async function seedPostWithComment({
  postId,
  commentId,
  postAuthorUid,
  commentAuthorUid,
  deletedPost = false,
  deletedComment = false,
}) {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, 'posts', postId), {
      authorUid: postAuthorUid,
      title: 'Morning run',
      content: 'Easy miles',
      commentsCount: 1,
      likesCount: 0,
      ...(deletedPost
        ? {
            deletedAt: Timestamp.fromDate(new Date('2026-05-28T00:00:00.000Z')),
            deletedByUid: postAuthorUid,
            deletedPurgeAt: Timestamp.fromDate(new Date('2026-08-26T00:00:00.000Z')),
          }
        : {}),
    });
    await setDoc(doc(adminDb, 'posts', postId, 'comments', commentId), {
      authorUid: commentAuthorUid,
      authorName: 'Commenter',
      authorImgURL: '',
      comment: 'Nice route',
      createdAt: Timestamp.fromDate(new Date('2026-05-28T01:00:00.000Z')),
      ...(deletedComment
        ? {
            deletedAt: Timestamp.fromDate(new Date('2026-05-28T01:30:00.000Z')),
            deletedByUid: commentAuthorUid,
            deletedPurgeAt: Timestamp.fromDate(new Date('2026-08-26T01:30:00.000Z')),
          }
        : {}),
    });
    await setDoc(doc(adminDb, 'posts', postId, 'comments', commentId, 'history', 'history-1'), {
      content: 'Before edit',
      editedAt: Timestamp.fromDate(new Date('2026-05-28T01:15:00.000Z')),
    });
  });
}

/**
 * Seeds an event with one child comment.
 * @param {object} options - Seed options.
 * @param {string} options.eventId - Event id.
 * @param {string} options.commentId - Comment id.
 * @param {string} options.hostUid - Event host uid.
 * @param {string} options.commentAuthorUid - Child comment author uid.
 * @returns {Promise<void>} Seed completion.
 */
async function seedEventWithComment({ eventId, commentId, hostUid, commentAuthorUid }) {
  await seed(async (adminDb) => {
    await setDoc(doc(adminDb, 'events', eventId), {
      hostUid,
      title: 'City run',
      time: Timestamp.fromDate(new Date('2026-05-28T10:00:00.000Z')),
      registrationDeadline: Timestamp.fromDate(new Date('2026-05-27T10:00:00.000Z')),
      distanceKm: 5,
      maxParticipants: 20,
    });
    await setDoc(doc(adminDb, 'events', eventId, 'comments', commentId), {
      authorUid: commentAuthorUid,
      authorName: 'Event Commenter',
      authorImgURL: '',
      content: 'See you there',
      createdAt: Timestamp.fromDate(new Date('2026-05-28T02:00:00.000Z')),
    });
  });
}

describe('post/comment soft-delete Firestore rules', () => {
  it('denies broad collectionGroup comment queries from client code', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(
      getDocs(query(collectionGroup(dbFor('comment-author'), 'comments'), where('authorUid', '==', 'comment-author'))),
    );
  });

  it('allows direct event comment reads', async () => {
    await seedEventWithComment({
      eventId: 'event-1',
      commentId: 'comment-1',
      hostUid: 'event-host',
      commentAuthorUid: 'event-comment-author',
    });

    await assertSucceeds(
      getDoc(doc(dbFor('event-comment-author'), 'events', 'event-1', 'comments', 'comment-1')),
    );
  });

  it('denies reading comments under a soft-deleted post', async () => {
    await seedPostWithComment({
      postId: 'deleted-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
      deletedPost: true,
    });

    await assertFails(
      getDoc(doc(dbFor('comment-author'), 'posts', 'deleted-post', 'comments', 'comment-1')),
    );
  });

  it('denies creating comments under a soft-deleted post', async () => {
    await seedPostWithComment({
      postId: 'deleted-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
      deletedPost: true,
    });

    await assertFails(
      setDoc(doc(dbFor('new-commenter'), 'posts', 'deleted-post', 'comments', 'comment-2'), {
        authorUid: 'new-commenter',
        authorName: 'New Commenter',
        authorImgURL: '',
        comment: 'Blocked',
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('allows reading post comment history under active post comments', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertSucceeds(
      getDoc(
        doc(
          anonymousDb(),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'history-1',
        ),
      ),
    );
  });

  it('allows comment authors to create valid history under active post comments', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertSucceeds(
      setDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'history-2',
        ),
        {
          content: 'Nice route',
          editedAt: serverTimestamp(),
        },
      ),
    );
  });

  it('denies post comment history create for non-authors and anonymous users', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(
      setDoc(
        doc(
          dbFor('intruder'),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'history-2',
        ),
        {
          content: 'Nice route',
          editedAt: serverTimestamp(),
        },
      ),
    );
    await assertFails(
      setDoc(
        doc(
          anonymousDb(),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'history-3',
        ),
        {
          content: 'Nice route',
          editedAt: serverTimestamp(),
        },
      ),
    );
  });

  it('denies post comment history create with invalid payloads', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(
      setDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'missing-content',
        ),
        {
          editedAt: serverTimestamp(),
        },
      ),
    );
    await assertFails(
      setDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'empty-content',
        ),
        {
          content: '',
          editedAt: serverTimestamp(),
        },
      ),
    );
    await assertFails(
      setDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'long-content',
        ),
        {
          content: 'x'.repeat(501),
          editedAt: serverTimestamp(),
        },
      ),
    );
    await assertFails(
      setDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'non-timestamp',
        ),
        {
          content: 'Nice route',
          editedAt: '2026-05-28T01:15:00.000Z',
        },
      ),
    );
    await assertFails(
      setDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'extra-field',
        ),
        {
          content: 'Nice route',
          editedAt: serverTimestamp(),
          authorUid: 'comment-author',
        },
      ),
    );
  });

  it('denies post comment history updates and deletes', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(
      updateDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'history-1',
        ),
        {
          content: 'Changed history',
        },
      ),
    );
    await assertFails(
      deleteDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'active-post',
          'comments',
          'comment-1',
          'history',
          'history-1',
        ),
      ),
    );
  });

  it('denies reading or creating history under soft-deleted posts', async () => {
    await seedPostWithComment({
      postId: 'deleted-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
      deletedPost: true,
    });

    await assertFails(
      getDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'deleted-post',
          'comments',
          'comment-1',
          'history',
          'history-1',
        ),
      ),
    );
    await assertFails(
      setDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'deleted-post',
          'comments',
          'comment-1',
          'history',
          'history-2',
        ),
        {
          content: 'Blocked edit',
          editedAt: serverTimestamp(),
        },
      ),
    );
  });

  it('denies reading or creating history under soft-deleted parent comments', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'deleted-comment',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
      deletedComment: true,
    });

    await assertFails(
      getDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'active-post',
          'comments',
          'deleted-comment',
          'history',
          'history-1',
        ),
      ),
    );
    await assertFails(
      setDoc(
        doc(
          dbFor('comment-author'),
          'posts',
          'active-post',
          'comments',
          'deleted-comment',
          'history',
          'history-2',
        ),
        {
          content: 'Blocked edit',
          editedAt: serverTimestamp(),
        },
      ),
    );
  });

  it('allows post authors to soft-delete with an exact 90-day retention window', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertSucceeds(
      updateDoc(doc(dbFor('post-author'), 'posts', 'active-post'), softDeletePayload('post-author')),
    );
  });

  it('denies post soft-delete updates with an early purge window', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    const deletedAt = Timestamp.now();

    await assertFails(
      updateDoc(
        doc(dbFor('post-author'), 'posts', 'active-post'),
        softDeletePayload('post-author', {
          deletedAt,
          deletedPurgeAt: Timestamp.fromMillis(deletedAt.toMillis() + RETENTION_MS - 1),
        }),
      ),
    );
  });

  it('denies post soft-delete updates with a backdated delete timestamp', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(
      updateDoc(
        doc(dbFor('post-author'), 'posts', 'active-post'),
        softDeletePayload('post-author', { deletedAt: staleDeletedAt() }),
      ),
    );
  });

  it('denies post soft-delete updates that also change existing post fields', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(
      updateDoc(doc(dbFor('post-author'), 'posts', 'active-post'), {
        ...softDeletePayload('post-author'),
        title: 'Changed while deleting',
      }),
    );
  });

  it('allows comment authors to soft-delete their comments with an exact 90-day retention window', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertSucceeds(
      updateDoc(
        doc(dbFor('comment-author'), 'posts', 'active-post', 'comments', 'comment-1'),
        softDeletePayload('comment-author'),
      ),
    );
  });

  it('denies post comment soft-delete updates with an early purge window', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    const deletedAt = Timestamp.now();

    await assertFails(
      updateDoc(
        doc(dbFor('comment-author'), 'posts', 'active-post', 'comments', 'comment-1'),
        softDeletePayload('comment-author', {
          deletedAt,
          deletedPurgeAt: addDaysToTimestamp(deletedAt, 1),
        }),
      ),
    );
  });

  it('denies post comment soft-delete updates with a backdated delete timestamp', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(
      updateDoc(
        doc(dbFor('comment-author'), 'posts', 'active-post', 'comments', 'comment-1'),
        softDeletePayload('comment-author', { deletedAt: staleDeletedAt() }),
      ),
    );
  });

  it('allows post authors to soft-delete comments under active posts', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertSucceeds(
      updateDoc(
        doc(dbFor('post-author'), 'posts', 'active-post', 'comments', 'comment-1'),
        softDeletePayload('post-author'),
      ),
    );
  });

  it('denies comment updates and deletes under soft-deleted posts', async () => {
    await seedPostWithComment({
      postId: 'deleted-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
      deletedPost: true,
    });

    await assertFails(
      updateDoc(
        doc(dbFor('comment-author'), 'posts', 'deleted-post', 'comments', 'comment-1'),
        softDeletePayload('comment-author'),
      ),
    );
    await assertFails(
      deleteDoc(doc(dbFor('post-author'), 'posts', 'deleted-post', 'comments', 'comment-1')),
    );
  });

  it('denies non-owners from soft-deleting posts or comments they do not own', async () => {
    await seedPostWithComment({
      postId: 'active-post',
      commentId: 'comment-1',
      postAuthorUid: 'post-author',
      commentAuthorUid: 'comment-author',
    });

    await assertFails(
      updateDoc(doc(dbFor('intruder'), 'posts', 'active-post'), softDeletePayload('intruder')),
    );
    await assertFails(
      updateDoc(
        doc(dbFor('intruder'), 'posts', 'active-post', 'comments', 'comment-1'),
        softDeletePayload('intruder'),
      ),
    );
  });
});
