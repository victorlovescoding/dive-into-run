/* eslint-disable jsdoc/require-jsdoc, no-await-in-loop, no-param-reassign -- finalizer cleanup helpers are internal and must serialize deletes. */
const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { logger, setGlobalOptions } = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const {
  createResendEmailClient,
  sendEventReminderEmails: sendEventReminderEmailsCore,
} = require('./event-reminder-email');
const { purgeExpiredEventRetention: purgeExpiredEventRetentionCore } = require('./event-retention-purge');
const { purgeExpiredPostRetention: purgeExpiredPostRetentionCore } = require('./post-retention-purge');

const DELETE_BATCH_LIMIT = 250;
const FINALIZER_LIMIT = 5;
const REQUEST_STATUS_PENDING = 'pending';
const REQUEST_STATUS_FAILED = 'failed';
const REQUEST_STATUS_FINALIZING = 'finalizing';
const DELETED_ACTOR_UID = 'deleted-user';
const DELETED_ACTOR_NAME = '已刪除使用者';
let functionsParams;

try {
  functionsParams = require('firebase-functions/params');
} catch (error) {
  const isMissingParamsModule =
    error?.code === 'MODULE_NOT_FOUND' &&
    error?.message?.includes('firebase-functions/params');
  const isVitestRun = process.env.VITEST || process.env.NODE_ENV === 'test';

  if (!isMissingParamsModule || !isVitestRun) {
    throw error;
  }

  functionsParams = {
    defineSecret: (name) => ({ value: () => process.env[name] || '' }),
    defineString: (name) => ({ value: () => process.env[name] || '' }),
  };
}

const { defineSecret, defineString } = functionsParams;
const resendApiKey = defineSecret('RESEND_API_KEY');
const reminderEmailFrom = defineString('REMINDER_EMAIL_FROM');
const publicAppBaseUrl = defineString('PUBLIC_APP_BASE_URL');

setGlobalOptions({ maxInstances: 10 });

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();
function getStorageBucket() {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return bucketName ? getStorage().bucket(bucketName) : getStorage().bucket();
}

function createBatchState() {
  return { batch: db.batch(), count: 0 };
}

async function flushBatchState(batchState) {
  if (batchState.count === 0) return;
  await batchState.batch.commit();
  batchState.batch = db.batch();
  batchState.count = 0;
}

async function ensureBatchCapacity(batchState, writesToAdd = 1) {
  if (batchState.count + writesToAdd > DELETE_BATCH_LIMIT) {
    await flushBatchState(batchState);
  }
}

async function deleteCollectionReference(collectionRef) {
  let snapshot = await collectionRef.limit(DELETE_BATCH_LIMIT).get();

  while (!snapshot.empty) {
    const batchState = createBatchState();
    snapshot.docs.forEach((docSnapshot) => {
      batchState.batch.delete(docSnapshot.ref);
      batchState.count += 1;
    });
    await flushBatchState(batchState);
    snapshot = await collectionRef.limit(DELETE_BATCH_LIMIT).get();
  }
}

async function deleteCommentsCollectionWithHistory(commentsRef) {
  let snapshot = await commentsRef.limit(DELETE_BATCH_LIMIT).get();

  while (!snapshot.empty) {
    for (const commentDoc of snapshot.docs) {
      await deleteCollectionReference(commentDoc.ref.collection('history'));
    }

    const batchState = createBatchState();
    snapshot.docs.forEach((commentDoc) => {
      batchState.batch.delete(commentDoc.ref);
      batchState.count += 1;
    });
    await flushBatchState(batchState);
    snapshot = await commentsRef.limit(DELETE_BATCH_LIMIT).get();
  }
}

async function deletePostTree(postDoc) {
  await deleteCollectionReference(postDoc.ref.collection('likes'));
  await deleteCommentsCollectionWithHistory(postDoc.ref.collection('comments'));
  await postDoc.ref.delete();
}

async function deleteEventTree(eventDoc) {
  await deleteCollectionReference(eventDoc.ref.collection('participants'));
  await deleteCommentsCollectionWithHistory(eventDoc.ref.collection('comments'));
  await deleteCollectionReference(eventDoc.ref.collection('history'));
  await eventDoc.ref.delete();
}

async function deleteQueryTrees(queryRef, deleteTree) {
  let snapshot = await queryRef.limit(DELETE_BATCH_LIMIT).get();

  while (!snapshot.empty) {
    for (const docSnapshot of snapshot.docs) {
      await deleteTree(docSnapshot);
    }
    snapshot = await queryRef.limit(DELETE_BATCH_LIMIT).get();
  }
}

async function deleteAuthoredComments(uid) {
  let snapshot = await db
    .collectionGroup('comments')
    .where('authorUid', '==', uid)
    .limit(DELETE_BATCH_LIMIT)
    .get();

  while (!snapshot.empty) {
    const batchState = createBatchState();

    for (const commentDoc of snapshot.docs) {
      await deleteCollectionReference(commentDoc.ref.collection('history'));
      const parentRef = commentDoc.ref.parent.parent;
      await ensureBatchCapacity(batchState, parentRef?.parent?.id === 'posts' ? 2 : 1);
      batchState.batch.delete(commentDoc.ref);
      batchState.count += 1;

      if (parentRef?.parent?.id === 'posts') {
        batchState.batch.update(parentRef, {
          commentsCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        batchState.count += 1;
      }
    }

    await flushBatchState(batchState);
    snapshot = await db
      .collectionGroup('comments')
      .where('authorUid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteUserLikes(uid) {
  let snapshot = await db
    .collectionGroup('likes')
    .where('uid', '==', uid)
    .limit(DELETE_BATCH_LIMIT)
    .get();

  while (!snapshot.empty) {
    const batchState = createBatchState();

    for (const likeDoc of snapshot.docs) {
      const parentRef = likeDoc.ref.parent.parent;
      await ensureBatchCapacity(batchState, parentRef ? 2 : 1);
      batchState.batch.delete(likeDoc.ref);
      batchState.count += 1;

      if (parentRef) {
        batchState.batch.update(parentRef, {
          likesCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        batchState.count += 1;
      }
    }

    await flushBatchState(batchState);
    snapshot = await db
      .collectionGroup('likes')
      .where('uid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteUserParticipantDocs(uid) {
  let snapshot = await db
    .collectionGroup('participants')
    .where('uid', '==', uid)
    .limit(DELETE_BATCH_LIMIT)
    .get();

  while (!snapshot.empty) {
    const batchState = createBatchState();

    for (const participantDoc of snapshot.docs) {
      const eventRef = participantDoc.ref.parent.parent;
      await ensureBatchCapacity(batchState, eventRef ? 2 : 1);
      batchState.batch.delete(participantDoc.ref);
      batchState.count += 1;

      if (eventRef) {
        batchState.batch.update(eventRef, {
          participantsCount: FieldValue.increment(-1),
          remainingSeats: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        batchState.count += 1;
      }
    }

    await flushBatchState(batchState);
    snapshot = await db
      .collectionGroup('participants')
      .where('uid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteFollowMirrors(uid) {
  const userRef = db.collection('users').doc(uid);
  const [followingSnapshot, followersSnapshot] = await Promise.all([
    userRef.collection('following').get(),
    userRef.collection('followers').get(),
  ]);
  const batchState = createBatchState();

  for (const followingDoc of followingSnapshot.docs) {
    const targetUid = String(followingDoc.data().uid || followingDoc.id);
    await ensureBatchCapacity(batchState, 2);
    batchState.batch.delete(db.collection('users').doc(targetUid).collection('followers').doc(uid));
    batchState.batch.set(
      db.collection('users').doc(targetUid),
      { followersCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    batchState.count += 2;
  }

  for (const followerDoc of followersSnapshot.docs) {
    const followerUid = String(followerDoc.data().uid || followerDoc.id);
    await ensureBatchCapacity(batchState, 2);
    batchState.batch.delete(db.collection('users').doc(followerUid).collection('following').doc(uid));
    batchState.batch.set(
      db.collection('users').doc(followerUid),
      { followingCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    batchState.count += 2;
  }

  await flushBatchState(batchState);
}

async function deleteUserSubcollections(uid) {
  const userRef = db.collection('users').doc(uid);
  const names = ['weatherFavorites', 'favoritePosts', 'favoriteEvents', 'followers', 'following'];

  for (const name of names) {
    await deleteCollectionReference(userRef.collection(name));
  }
}

async function deleteUserNotifications(uid) {
  let snapshot = await db
    .collection('notifications')
    .where('recipientUid', '==', uid)
    .limit(DELETE_BATCH_LIMIT)
    .get();

  while (!snapshot.empty) {
    const batchState = createBatchState();
    snapshot.docs.forEach((notificationDoc) => {
      batchState.batch.delete(notificationDoc.ref);
      batchState.count += 1;
    });
    await flushBatchState(batchState);
    snapshot = await db
      .collection('notifications')
      .where('recipientUid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function anonymizeRemainingActorNotifications(uid) {
  let snapshot = await db
    .collection('notifications')
    .where('actorUid', '==', uid)
    .limit(DELETE_BATCH_LIMIT)
    .get();

  while (!snapshot.empty) {
    const batchState = createBatchState();
    snapshot.docs.forEach((notificationDoc) => {
      batchState.batch.update(notificationDoc.ref, {
        actorUid: DELETED_ACTOR_UID,
        actorName: DELETED_ACTOR_NAME,
        actorPhotoURL: '',
        actorDeleted: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batchState.count += 1;
    });
    await flushBatchState(batchState);
    snapshot = await db
      .collection('notifications')
      .where('actorUid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteUserStravaData(uid) {
  await Promise.all([
    db.collection('stravaTokens').doc(uid).delete(),
    db.collection('stravaConnections').doc(uid).delete(),
  ]);

  let snapshot = await db
    .collection('stravaActivities')
    .where('uid', '==', uid)
    .limit(DELETE_BATCH_LIMIT)
    .get();

  while (!snapshot.empty) {
    const batchState = createBatchState();
    snapshot.docs.forEach((activityDoc) => {
      batchState.batch.delete(activityDoc.ref);
      batchState.count += 1;
    });
    await flushBatchState(batchState);
    snapshot = await db
      .collection('stravaActivities')
      .where('uid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteAuthUser(uid) {
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }
  }
}

async function deleteAccountDeletionRequestTree(uid) {
  const requestRef = db.collection('accountDeletionRequests').doc(uid);
  await deleteCollectionReference(requestRef.collection('restoreItems'));
  await requestRef.delete();
}

function isDeletionRequestReadyForFinalization(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.finalizationBlocked === true) return false;
  if (data.status === REQUEST_STATUS_PENDING || data.status === REQUEST_STATUS_FINALIZING) {
    return true;
  }

  return data.status === REQUEST_STATUS_FAILED && Boolean(data.finalizeStartedAt);
}

async function finalizeAccountDeletion(uid) {
  const requestRef = db.collection('accountDeletionRequests').doc(uid);
  const requestSnapshot = await requestRef.get();

  if (!requestSnapshot.exists) {
    return { status: 'missing' };
  }

  if (!isDeletionRequestReadyForFinalization(requestSnapshot.data() || {})) {
    return { status: 'not_ready' };
  }

  await requestRef.set(
    {
      status: REQUEST_STATUS_FINALIZING,
      finalizeStartedAt: FieldValue.serverTimestamp(),
      lastError: null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  try {
    await deleteQueryTrees(db.collection('posts').where('authorUid', '==', uid), deletePostTree);
    await deleteQueryTrees(db.collection('events').where('hostUid', '==', uid), deleteEventTree);
    await deleteAuthoredComments(uid);
    await deleteUserLikes(uid);
    await deleteUserParticipantDocs(uid);
    await deleteFollowMirrors(uid);
    await deleteUserSubcollections(uid);
    await deleteUserNotifications(uid);
    await anonymizeRemainingActorNotifications(uid);
    await deleteUserStravaData(uid);
    await getStorageBucket().deleteFiles({ prefix: `users/${uid}/`, force: true });
    await db.collection('users').doc(uid).delete();
    await deleteAuthUser(uid);
    await deleteAccountDeletionRequestTree(uid);
    return { status: 'finalized' };
  } catch (error) {
    await requestRef.set(
      {
        status: REQUEST_STATUS_FAILED,
        failureStage: 'finalization',
        finalizationBlocked: FieldValue.delete(),
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }
}

async function fetchDueRequestsByStatus(status, now, limitCount) {
  return db
    .collection('accountDeletionRequests')
    .where('status', '==', status)
    .where('scheduledFor', '<=', now)
    .limit(limitCount)
    .get();
}

async function finalizeDueRequests(limitCount = FINALIZER_LIMIT) {
  const now = Timestamp.fromDate(new Date());
  const pendingSnapshot = await fetchDueRequestsByStatus(REQUEST_STATUS_PENDING, now, limitCount);
  const remainingLimit = Math.max(0, limitCount - pendingSnapshot.size);
  const failedSnapshot =
    remainingLimit > 0
      ? await fetchDueRequestsByStatus(REQUEST_STATUS_FAILED, now, remainingLimit)
      : { docs: [] };
  const dueDocs = [...pendingSnapshot.docs, ...failedSnapshot.docs];
  const processed = [];
  const skipped = [];
  const failed = [];

  for (const requestDoc of dueDocs) {
    try {
      const result = await finalizeAccountDeletion(requestDoc.id);
      if (result.status === 'finalized') {
        processed.push(requestDoc.id);
      } else {
        skipped.push({ uid: requestDoc.id, status: result.status });
      }
    } catch (error) {
      failed.push({
        uid: requestDoc.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { processed, skipped, failed };
}

exports.finalizeAccountDeletions = onSchedule('every 24 hours', async () => {
  const result = await finalizeDueRequests();
  logger.info('Account deletion finalizer completed', result);
});

/**
 * Run the scheduled post retention purge.
 * @returns {Promise<void>} Resolves after purge work completes.
 */
async function runScheduledPostRetentionPurge() {
  const counts = await purgeExpiredPostRetentionCore({
    firestore: db,
    logger,
    now: Timestamp.now(),
  });

  logger.info('scheduled post retention purge finished', { counts });
}

exports.purgeExpiredPostRetention = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'Asia/Taipei',
  },
  runScheduledPostRetentionPurge,
);

/**
 * Run the scheduled event retention purge.
 * @returns {Promise<void>} Resolves after purge work completes.
 */
async function runScheduledEventRetentionPurge() {
  const counts = await purgeExpiredEventRetentionCore({
    firestore: db,
    logger,
    now: Timestamp.now(),
  });

  logger.info('scheduled event retention purge finished', { counts });
}

exports.purgeExpiredEventRetention = onSchedule(
  {
    schedule: 'every day 03:30',
    timeZone: 'Asia/Taipei',
  },
  runScheduledEventRetentionPurge,
);

/**
 * Run the scheduled event reminder email scan.
 * @returns {Promise<void>} Resolves after reminder work completes.
 */
async function runScheduledEventReminderEmails() {
  const now = Timestamp.now();
  const runId = now.toDate().toISOString();
  const fromEmail = reminderEmailFrom.value();
  const config = {
    emailFrom: fromEmail,
    fromEmail,
    publicAppBaseUrl: publicAppBaseUrl.value(),
    resendApiKey: resendApiKey.value(),
  };
  const counts = await sendEventReminderEmailsCore({
    config,
    emailClient: createResendEmailClient({ apiKey: config.resendApiKey }),
    firestore: db,
    logger,
    now,
    runId,
  });

  logger.info('scheduled event reminder email finished', { counts, runId });
}

exports.sendEventReminderEmails = onSchedule(
  {
    schedule: 'every 15 minutes',
    secrets: [resendApiKey],
    timeZone: 'Asia/Taipei',
  },
  runScheduledEventReminderEmails,
);
