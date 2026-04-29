/**
 * @file Firestore Rules critical path coverage for posts likes.
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collectionGroup, getDocs } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  authenticatedDb,
  cleanupRulesTestEnvironment,
  clearFirestore,
  createRulesTestEnvironment,
  seedFirestore,
  unauthenticatedDb,
} from './_helpers/rules-test-env.js';

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

/**
 * Seeds a post document used as the parent for likes.
 * @param {string} postId - Post document ID.
 * @param {string} authorUid - Post author UID.
 * @returns {Promise<void>} Resolves after the post is seeded.
 */
async function seedPost(postId, authorUid) {
  await seedFirestore(testEnv, async (db) => {
    await db.doc(`posts/${postId}`).set({
      authorUid,
      commentsCount: 0,
      content: 'Post body',
      likesCount: 0,
      postAt: new Date('2026-04-29T00:00:00.000Z'),
      title: `Post ${postId}`,
    });
  });
}

/**
 * Seeds a post and one nested like document.
 * @param {string} postId - Post document ID.
 * @param {string} postAuthorUid - Post author UID.
 * @param {string} likeUid - Like document ID and owner UID.
 * @returns {Promise<void>} Resolves after the like is seeded.
 */
async function seedPostLike(postId, postAuthorUid, likeUid) {
  await seedFirestore(testEnv, async (db) => {
    await db.doc(`posts/${postId}`).set({
      authorUid: postAuthorUid,
      commentsCount: 0,
      content: 'Post body',
      likesCount: 1,
      postAt: new Date('2026-04-29T00:00:00.000Z'),
      title: `Post ${postId}`,
    });
    await db.doc(`posts/${postId}/likes/${likeUid}`).set({
      createdAt: new Date('2026-04-29T00:01:00.000Z'),
      postId,
      uid: likeUid,
    });
  });
}

beforeAll(async () => {
  testEnv = await createRulesTestEnvironment();
});

beforeEach(async () => {
  await clearFirestore(testEnv);
});

afterAll(async () => {
  await cleanupRulesTestEnvironment(testEnv);
});

describe('posts likes Firestore rules', () => {
  it('denies unauthenticated collectionGroup likes reads', async () => {
    await seedPostLike('p1', 'author-uid', 'liker-uid');
    const db = unauthenticatedDb(testEnv);

    await assertFails(getDocs(collectionGroup(db, 'likes')));
  });

  it('allows signed-in collectionGroup likes reads', async () => {
    await seedPostLike('p1', 'author-uid', 'liker-uid');
    const db = authenticatedDb(testEnv, 'reader-uid');

    await assertSucceeds(getDocs(collectionGroup(db, 'likes')));
  });

  it('allows authenticated users to create their own like document', async () => {
    await seedPost('p1', 'author-uid');
    const db = authenticatedDb(testEnv, 'liker-uid');

    await assertSucceeds(
      db.doc('posts/p1/likes/liker-uid').set({
        createdAt: new Date('2026-04-29T00:02:00.000Z'),
        postId: 'p1',
        uid: 'liker-uid',
      }),
    );
  });

  it('denies authenticated users creating another uid like document', async () => {
    await seedPost('p1', 'author-uid');
    const db = authenticatedDb(testEnv, 'liker-uid');

    await assertFails(
      db.doc('posts/p1/likes/other-uid').set({
        createdAt: new Date('2026-04-29T00:02:00.000Z'),
        postId: 'p1',
        uid: 'other-uid',
      }),
    );
  });

  it('denies non-author authenticated users deleting another uid like document', async () => {
    await seedPostLike('p1', 'author-uid', 'other-uid');
    const db = authenticatedDb(testEnv, 'liker-uid');

    await assertFails(db.doc('posts/p1/likes/other-uid').delete());
  });

  it('allows like owners to delete their own like document', async () => {
    await seedPostLike('p1', 'author-uid', 'liker-uid');
    const db = authenticatedDb(testEnv, 'liker-uid');

    await assertSucceeds(db.doc('posts/p1/likes/liker-uid').delete());
  });

  it('allows post authors to cascade delete another user like document', async () => {
    await seedPostLike('p1', 'author-uid', 'liker-uid');
    const db = authenticatedDb(testEnv, 'author-uid');

    await assertSucceeds(db.doc('posts/p1/likes/liker-uid').delete());
  });

  it('denies unrelated signed-in users deleting another user like document', async () => {
    await seedPostLike('p1', 'author-uid', 'liker-uid');
    const db = authenticatedDb(testEnv, 'unrelated-uid');

    await assertFails(db.doc('posts/p1/likes/liker-uid').delete());
  });
});
