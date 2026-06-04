/* eslint-disable jsdoc/require-jsdoc, max-lines, no-await-in-loop, no-param-reassign -- cleanup helpers are internal and must serialize Firestore batches. */
import {
  ACCOUNT_DELETION_DELETED_ACTOR_NAME,
  ACCOUNT_DELETION_DELETED_ACTOR_UID,
  ACCOUNT_DELETION_REASON,
  ACCOUNT_DELETION_REQUEST_STATUS_FAILED,
  ACCOUNT_DELETION_REQUEST_STATUS_FINALIZING,
  ACCOUNT_DELETION_REQUEST_STATUS_PENDING,
  ACCOUNT_DELETION_STATUS_ACTIVE,
  ACCOUNT_DELETION_STATUS_PENDING,
} from '@/config/account-deletion';
import {
  adminAuth,
  adminDb,
  createAdminDeleteFieldValue,
  createAdminIncrement,
  createAdminServerTimestamp,
  createAdminTimestampFromDate,
  getAdminStorageBucket,
} from '@/config/server/firebase-admin-app';

const WRITE_BATCH_LIMIT = 450;
const DELETE_BATCH_LIMIT = 250;
const FINALIZER_DEFAULT_LIMIT = 5;

const RESTORED_CONTENT_FIELDS = [
  'accountDeletionHidden',
  'accountDeletionHiddenAt',
  'accountDeletionHiddenBy',
  'accountDeletionRequestUid',
  'cancelledByAccountDeletion',
  'cancelledAt',
  'status',
  'updatedAt',
];

const RESTORED_NOTIFICATION_FIELDS = [
  'actorUid',
  'actorName',
  'actorPhotoURL',
  'actorDeleted',
  'updatedAt',
];

const USER_SUBCOLLECTIONS = [
  'weatherFavorites',
  'favoritePosts',
  'favoriteEvents',
  'followers',
  'following',
];

/**
 * @typedef {import('firebase-admin/firestore').DocumentReference} AdminDocumentReference
 * @typedef {import('firebase-admin/firestore').Query} AdminQuery
 * @typedef {import('firebase-admin/firestore').QueryDocumentSnapshot} AdminQueryDocumentSnapshot
 */

function createBatchState() {
  return {
    batch: adminDb.batch(),
    count: 0,
  };
}

async function flushBatchState(batchState) {
  if (batchState.count === 0) {
    return;
  }

  await batchState.batch.commit();
  batchState.batch = adminDb.batch();
  batchState.count = 0;
}

async function ensureBatchCapacity(batchState, writesToAdd = 1) {
  if (batchState.count + writesToAdd > WRITE_BATCH_LIMIT) {
    await flushBatchState(batchState);
  }
}

function getRequestRef(uid) {
  return adminDb.collection('accountDeletionRequests').doc(uid);
}

function getRestoreItemsRef(uid) {
  return getRequestRef(uid).collection('restoreItems');
}

function toRestoreItemId(path) {
  return Buffer.from(path).toString('base64url');
}

function getRestoreItemRef(uid, path) {
  return getRestoreItemsRef(uid).doc(toRestoreItemId(path));
}

function hasOwn(data, field) {
  return Object.prototype.hasOwnProperty.call(data, field);
}

async function addRestoreItemWrite(batchState, uid, docRef, data, fields) {
  const previousFields = {};
  const missingFields = [];

  fields.forEach((field) => {
    if (hasOwn(data, field)) {
      previousFields[field] = data[field];
    } else {
      missingFields.push(field);
    }
  });

  await ensureBatchCapacity(batchState, 1);
  batchState.batch.set(
    getRestoreItemRef(uid, docRef.path),
    {
      path: docRef.path,
      previousFields,
      missingFields,
      updatedAt: createAdminServerTimestamp(),
    },
    { merge: true },
  );
  batchState.count += 1;
}

async function addUpdateWithRestoreWrite(batchState, uid, docSnapshot, fields, updates) {
  await ensureBatchCapacity(batchState, 2);
  await addRestoreItemWrite(
    batchState,
    uid,
    docSnapshot.ref,
    /** @type {Record<string, unknown>} */ (docSnapshot.data() ?? {}),
    fields,
  );
  await ensureBatchCapacity(batchState, 1);
  batchState.batch.update(docSnapshot.ref, updates);
  batchState.count += 1;
}

function buildHiddenContentUpdates(uid) {
  return {
    accountDeletionHidden: true,
    accountDeletionHiddenAt: createAdminServerTimestamp(),
    accountDeletionHiddenBy: uid,
    accountDeletionRequestUid: uid,
    updatedAt: createAdminServerTimestamp(),
  };
}

function buildCancelledEventUpdates(uid) {
  return {
    ...buildHiddenContentUpdates(uid),
    cancelledByAccountDeletion: true,
    cancelledAt: createAdminServerTimestamp(),
    status: 'cancelled',
  };
}

function buildAnonymizedActorUpdates() {
  return {
    actorUid: ACCOUNT_DELETION_DELETED_ACTOR_UID,
    actorName: ACCOUNT_DELETION_DELETED_ACTOR_NAME,
    actorPhotoURL: '',
    actorDeleted: true,
    updatedAt: createAdminServerTimestamp(),
  };
}

function buildEventCancelledNotification({ recipientUid, eventId, eventTitle, uid }) {
  return {
    recipientUid,
    type: 'event_cancelled',
    actorUid: ACCOUNT_DELETION_DELETED_ACTOR_UID,
    actorName: ACCOUNT_DELETION_DELETED_ACTOR_NAME,
    actorPhotoURL: '',
    actorDeleted: true,
    entityType: 'event',
    entityId: eventId,
    entityTitle: eventTitle,
    commentId: null,
    message: `你所參加的『${eventTitle}』已取消`,
    read: false,
    createdAt: createAdminServerTimestamp(),
    accountDeletionRequestUid: uid,
    accountDeletionReason: ACCOUNT_DELETION_REASON,
  };
}

function timestampToIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return null;
}

function serializeDeletionRequest(uid, data) {
  if (!data) return null;

  return {
    uid,
    status: data.status ?? null,
    requestedAt: timestampToIso(data.requestedAt),
    scheduledFor: timestampToIso(data.scheduledFor),
    finalizeStartedAt: timestampToIso(data.finalizeStartedAt),
    lastError: typeof data.lastError === 'string' ? data.lastError : null,
    updatedAt: timestampToIso(data.updatedAt),
  };
}

async function getAccountDeletionRequest(uid) {
  const snapshot = await getRequestRef(uid).get();
  if (!snapshot.exists) return null;

  return serializeDeletionRequest(uid, snapshot.data() ?? {});
}

async function getAccountDeletionStatus(uid) {
  const [requestSnapshot, userSnapshot] = await Promise.all([
    getRequestRef(uid).get(),
    adminDb.collection('users').doc(uid).get(),
  ]);
  const userData = /** @type {Record<string, unknown>} */ (userSnapshot.data() ?? {});

  return {
    accountStatus:
      typeof userData.accountStatus === 'string'
        ? userData.accountStatus
        : ACCOUNT_DELETION_STATUS_ACTIVE,
    request: requestSnapshot.exists
      ? serializeDeletionRequest(uid, requestSnapshot.data() ?? {})
      : null,
  };
}

async function hideAuthoredPosts(uid) {
  const snapshot = await adminDb.collection('posts').where('authorUid', '==', uid).get();
  const batchState = createBatchState();

  for (const postDoc of snapshot.docs) {
    await addUpdateWithRestoreWrite(
      batchState,
      uid,
      postDoc,
      RESTORED_CONTENT_FIELDS,
      buildHiddenContentUpdates(uid),
    );
  }

  await flushBatchState(batchState);
}

async function hideAuthoredComments(uid) {
  const snapshot = await adminDb.collectionGroup('comments').where('authorUid', '==', uid).get();
  const batchState = createBatchState();

  for (const commentDoc of snapshot.docs) {
    await addUpdateWithRestoreWrite(
      batchState,
      uid,
      commentDoc,
      RESTORED_CONTENT_FIELDS,
      buildHiddenContentUpdates(uid),
    );
  }

  await flushBatchState(batchState);
}

async function hideHostedEventsAndNotify(uid) {
  const snapshot = await adminDb.collection('events').where('hostUid', '==', uid).get();
  const batchState = createBatchState();

  for (const eventDoc of snapshot.docs) {
    const eventData = /** @type {Record<string, unknown>} */ (eventDoc.data() ?? {});
    const eventTitle = String(eventData.title || '未命名活動');
    const participantsSnapshot = await eventDoc.ref.collection('participants').get();

    await addUpdateWithRestoreWrite(
      batchState,
      uid,
      eventDoc,
      RESTORED_CONTENT_FIELDS,
      buildCancelledEventUpdates(uid),
    );

    for (const participantDoc of participantsSnapshot.docs) {
      const participantData = /** @type {Record<string, unknown>} */ (
        participantDoc.data() ?? {}
      );
      const recipientUid = String(participantData.uid || participantDoc.id);
      if (!recipientUid || recipientUid === uid) {
        continue;
      }

      await ensureBatchCapacity(batchState, 1);
      batchState.batch.set(
        adminDb.collection('notifications').doc(),
        buildEventCancelledNotification({
          recipientUid,
          eventId: eventDoc.id,
          eventTitle,
          uid,
        }),
      );
      batchState.count += 1;
    }
  }

  await flushBatchState(batchState);
}

async function hideParticipantDocs(uid) {
  const snapshot = await adminDb.collectionGroup('participants').where('uid', '==', uid).get();
  const batchState = createBatchState();

  for (const participantDoc of snapshot.docs) {
    await addUpdateWithRestoreWrite(
      batchState,
      uid,
      participantDoc,
      RESTORED_CONTENT_FIELDS,
      buildHiddenContentUpdates(uid),
    );
  }

  await flushBatchState(batchState);
}

async function anonymizeActorNotifications(uid) {
  const snapshot = await adminDb.collection('notifications').where('actorUid', '==', uid).get();
  const batchState = createBatchState();

  for (const notificationDoc of snapshot.docs) {
    await addUpdateWithRestoreWrite(
      batchState,
      uid,
      notificationDoc,
      RESTORED_NOTIFICATION_FIELDS,
      buildAnonymizedActorUpdates(),
    );
  }

  await flushBatchState(batchState);
}

async function deleteRequestCreatedNotifications(uid) {
  const snapshot = await adminDb
    .collection('notifications')
    .where('accountDeletionRequestUid', '==', uid)
    .get();
  const batchState = createBatchState();

  for (const notificationDoc of snapshot.docs) {
    await ensureBatchCapacity(batchState, 1);
    batchState.batch.delete(notificationDoc.ref);
    batchState.count += 1;
  }

  await flushBatchState(batchState);
}

async function applyPendingDeletionSideEffects(uid) {
  await hideAuthoredPosts(uid);
  await hideAuthoredComments(uid);
  await hideHostedEventsAndNotify(uid);
  await hideParticipantDocs(uid);
  await anonymizeActorNotifications(uid);
}

async function restoreRequestSideEffects(uid) {
  const deleteFieldValue = createAdminDeleteFieldValue();
  let snapshot = await getRestoreItemsRef(uid).limit(DELETE_BATCH_LIMIT).get();

  while (!snapshot.empty) {
    const batchState = createBatchState();

    for (const restoreDoc of snapshot.docs) {
      const restoreData = /** @type {Record<string, unknown>} */ (restoreDoc.data() ?? {});
      const path = typeof restoreData.path === 'string' ? restoreData.path : null;
      if (path) {
        const previousFields = /** @type {Record<string, unknown>} */ (
          restoreData.previousFields ?? {}
        );
        const missingFields = Array.isArray(restoreData.missingFields)
          ? restoreData.missingFields
          : [];
        const restorePayload = { ...previousFields };

        missingFields.forEach((field) => {
          if (typeof field === 'string') {
            restorePayload[field] = deleteFieldValue;
          }
        });

        if (Object.keys(restorePayload).length > 0) {
          await ensureBatchCapacity(batchState, 1);
          batchState.batch.set(adminDb.doc(path), restorePayload, { merge: true });
          batchState.count += 1;
        }
      }

      await ensureBatchCapacity(batchState, 1);
      batchState.batch.delete(restoreDoc.ref);
      batchState.count += 1;
    }

    await flushBatchState(batchState);
    snapshot = await getRestoreItemsRef(uid).limit(DELETE_BATCH_LIMIT).get();
  }

  await deleteRequestCreatedNotifications(uid);
}


function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isDeletionRequestReadyForFinalization(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.finalizationBlocked === true) return false;
  if (
    data.status === ACCOUNT_DELETION_REQUEST_STATUS_PENDING ||
    data.status === ACCOUNT_DELETION_REQUEST_STATUS_FINALIZING
  ) {
    return true;
  }

  return data.status === ACCOUNT_DELETION_REQUEST_STATUS_FAILED && Boolean(data.finalizeStartedAt);
}

async function rollbackFailedPendingDeletionRequest(uid, requestRef, userRef, error) {
  let rollbackError = null;

  try {
    await restoreRequestSideEffects(uid);
  } catch (caughtRollbackError) {
    rollbackError = caughtRollbackError;
  }

  const deleteFieldValue = createAdminDeleteFieldValue();
  const batch = adminDb.batch();
  const baseErrorMessage = getErrorMessage(error);
  const lastError = rollbackError
    ? `${baseErrorMessage}; rollback failed: ${getErrorMessage(rollbackError)}`
    : baseErrorMessage;

  batch.set(
    requestRef,
    {
      status: ACCOUNT_DELETION_REQUEST_STATUS_FAILED,
      scheduledFor: deleteFieldValue,
      finalizeStartedAt: null,
      finalizationBlocked: true,
      failureStage: 'request_side_effects',
      lastError,
      updatedAt: createAdminServerTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    userRef,
    {
      accountStatus: ACCOUNT_DELETION_STATUS_ACTIVE,
      deletionRequestedAt: deleteFieldValue,
      deletionScheduledFor: deleteFieldValue,
      updatedAt: createAdminServerTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();

  if (rollbackError) {
    throw new Error(lastError);
  }
}

async function createAccountDeletionRequest(uid, scheduledForDate) {
  const requestRef = getRequestRef(uid);
  const userRef = adminDb.collection('users').doc(uid);
  const scheduledFor = createAdminTimestampFromDate(scheduledForDate);

  const transactionResult = await adminDb.runTransaction(async (transaction) => {
    const [requestSnapshot, userSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(userRef),
    ]);

    if (!userSnapshot.exists) {
      return { status: 'user_missing' };
    }

    if (requestSnapshot.exists) {
      const requestData = /** @type {Record<string, unknown>} */ (requestSnapshot.data() ?? {});
      if (
        requestData.status === ACCOUNT_DELETION_REQUEST_STATUS_PENDING ||
        requestData.status === ACCOUNT_DELETION_REQUEST_STATUS_FINALIZING
      ) {
        return { status: 'already_pending' };
      }
    }

    transaction.set(
      requestRef,
      {
        uid,
        status: ACCOUNT_DELETION_REQUEST_STATUS_PENDING,
        requestedAt: createAdminServerTimestamp(),
        scheduledFor,
        finalizeStartedAt: null,
        finalizationBlocked: createAdminDeleteFieldValue(),
        failureStage: createAdminDeleteFieldValue(),
        lastError: null,
        updatedAt: createAdminServerTimestamp(),
      },
      { merge: true },
    );
    transaction.set(
      userRef,
      {
        accountStatus: ACCOUNT_DELETION_STATUS_PENDING,
        deletionRequestedAt: createAdminServerTimestamp(),
        deletionScheduledFor: scheduledFor,
        updatedAt: createAdminServerTimestamp(),
      },
      { merge: true },
    );

    return { status: 'created' };
  });

  if (transactionResult.status === 'created') {
    try {
      await applyPendingDeletionSideEffects(uid);
    } catch (error) {
      await rollbackFailedPendingDeletionRequest(uid, requestRef, userRef, error);
      throw error;
    }
  }

  return {
    result: transactionResult.status,
    request: await getAccountDeletionRequest(uid),
  };
}

async function cancelAccountDeletionRequest(uid) {
  const requestRef = getRequestRef(uid);
  const userRef = adminDb.collection('users').doc(uid);
  const requestSnapshot = await requestRef.get();

  if (!requestSnapshot.exists) {
    return { result: 'missing' };
  }

  const requestData = /** @type {Record<string, unknown>} */ (requestSnapshot.data() ?? {});
  if (requestData.status === ACCOUNT_DELETION_REQUEST_STATUS_FINALIZING) {
    return { result: 'finalizing' };
  }

  await restoreRequestSideEffects(uid);

  const deleteFieldValue = createAdminDeleteFieldValue();
  const batch = adminDb.batch();
  batch.set(
    userRef,
    {
      accountStatus: ACCOUNT_DELETION_STATUS_ACTIVE,
      deletionRequestedAt: deleteFieldValue,
      deletionScheduledFor: deleteFieldValue,
      updatedAt: createAdminServerTimestamp(),
    },
    { merge: true },
  );
  batch.delete(requestRef);
  await batch.commit();

  return { result: 'cancelled' };
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
  await deleteCollectionReference(postDoc.ref.collection('history'));
  await deleteCommentsCollectionWithHistory(postDoc.ref.collection('comments'));
  await postDoc.ref.delete();
}

async function deleteEventTree(eventDoc) {
  await deleteCollectionReference(eventDoc.ref.collection('participants'));
  await deleteCommentsCollectionWithHistory(eventDoc.ref.collection('comments'));
  await deleteCollectionReference(eventDoc.ref.collection('history'));
  await eventDoc.ref.delete();
}

async function deleteAuthoredPosts(uid) {
  let snapshot = await adminDb
    .collection('posts')
    .where('authorUid', '==', uid)
    .limit(DELETE_BATCH_LIMIT)
    .get();

  while (!snapshot.empty) {
    for (const postDoc of snapshot.docs) {
      await deletePostTree(postDoc);
    }
    snapshot = await adminDb
      .collection('posts')
      .where('authorUid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteHostedEvents(uid) {
  let snapshot = await adminDb
    .collection('events')
    .where('hostUid', '==', uid)
    .limit(DELETE_BATCH_LIMIT)
    .get();

  while (!snapshot.empty) {
    for (const eventDoc of snapshot.docs) {
      await deleteEventTree(eventDoc);
    }
    snapshot = await adminDb
      .collection('events')
      .where('hostUid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteAuthoredComments(uid) {
  let snapshot = await adminDb
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
          commentsCount: createAdminIncrement(-1),
          updatedAt: createAdminServerTimestamp(),
        });
        batchState.count += 1;
      }
    }

    await flushBatchState(batchState);
    snapshot = await adminDb
      .collectionGroup('comments')
      .where('authorUid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteUserLikes(uid) {
  let snapshot = await adminDb
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
          likesCount: createAdminIncrement(-1),
          updatedAt: createAdminServerTimestamp(),
        });
        batchState.count += 1;
      }
    }

    await flushBatchState(batchState);
    snapshot = await adminDb
      .collectionGroup('likes')
      .where('uid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteUserParticipantDocs(uid) {
  let snapshot = await adminDb
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
          participantsCount: createAdminIncrement(-1),
          remainingSeats: createAdminIncrement(1),
          updatedAt: createAdminServerTimestamp(),
        });
        batchState.count += 1;
      }
    }

    await flushBatchState(batchState);
    snapshot = await adminDb
      .collectionGroup('participants')
      .where('uid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteFollowMirrors(uid) {
  const userRef = adminDb.collection('users').doc(uid);
  const [followingSnapshot, followersSnapshot] = await Promise.all([
    userRef.collection('following').get(),
    userRef.collection('followers').get(),
  ]);
  const batchState = createBatchState();

  for (const followingDoc of followingSnapshot.docs) {
    const targetUid = String(followingDoc.data().uid || followingDoc.id);
    await ensureBatchCapacity(batchState, 2);
    batchState.batch.delete(adminDb.collection('users').doc(targetUid).collection('followers').doc(uid));
    batchState.batch.set(
      adminDb.collection('users').doc(targetUid),
      { followersCount: createAdminIncrement(-1), updatedAt: createAdminServerTimestamp() },
      { merge: true },
    );
    batchState.count += 2;
  }

  for (const followerDoc of followersSnapshot.docs) {
    const followerUid = String(followerDoc.data().uid || followerDoc.id);
    await ensureBatchCapacity(batchState, 2);
    batchState.batch.delete(adminDb.collection('users').doc(followerUid).collection('following').doc(uid));
    batchState.batch.set(
      adminDb.collection('users').doc(followerUid),
      { followingCount: createAdminIncrement(-1), updatedAt: createAdminServerTimestamp() },
      { merge: true },
    );
    batchState.count += 2;
  }

  await flushBatchState(batchState);
}

async function deleteUserSubcollections(uid) {
  const userRef = adminDb.collection('users').doc(uid);

  for (const subcollectionName of USER_SUBCOLLECTIONS) {
    await deleteCollectionReference(userRef.collection(subcollectionName));
  }
}

async function deleteUserNotifications(uid) {
  let snapshot = await adminDb
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
    snapshot = await adminDb
      .collection('notifications')
      .where('recipientUid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function anonymizeRemainingActorNotifications(uid) {
  let snapshot = await adminDb
    .collection('notifications')
    .where('actorUid', '==', uid)
    .limit(DELETE_BATCH_LIMIT)
    .get();

  while (!snapshot.empty) {
    const batchState = createBatchState();
    snapshot.docs.forEach((notificationDoc) => {
      batchState.batch.update(notificationDoc.ref, buildAnonymizedActorUpdates());
      batchState.count += 1;
    });
    await flushBatchState(batchState);
    snapshot = await adminDb
      .collection('notifications')
      .where('actorUid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteUserStravaData(uid) {
  await Promise.all([
    adminDb.collection('stravaTokens').doc(uid).delete(),
    adminDb.collection('stravaConnections').doc(uid).delete(),
  ]);

  let snapshot = await adminDb
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
    snapshot = await adminDb
      .collection('stravaActivities')
      .where('uid', '==', uid)
      .limit(DELETE_BATCH_LIMIT)
      .get();
  }
}

async function deleteUserAvatar(uid) {
  const adminStorageBucket = getAdminStorageBucket();
  await adminStorageBucket.deleteFiles({
    prefix: `users/${uid}/`,
    force: true,
  });
}

async function deleteAuthUser(uid) {
  try {
    await adminAuth.deleteUser(uid);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }
  }
}

async function deleteAccountDeletionRequestTree(uid) {
  await deleteCollectionReference(getRestoreItemsRef(uid));
  await getRequestRef(uid).delete();
}

async function finalizeAccountDeletion(uid) {
  const requestRef = getRequestRef(uid);
  const requestSnapshot = await requestRef.get();

  if (!requestSnapshot.exists) {
    return { status: 'missing' };
  }

  const requestData = /** @type {Record<string, unknown>} */ (requestSnapshot.data() ?? {});
  if (!isDeletionRequestReadyForFinalization(requestData)) {
    return { status: 'not_ready' };
  }

  await requestRef.set(
    {
      status: ACCOUNT_DELETION_REQUEST_STATUS_FINALIZING,
      finalizeStartedAt: createAdminServerTimestamp(),
      lastError: null,
      updatedAt: createAdminServerTimestamp(),
    },
    { merge: true },
  );

  try {
    await deleteAuthoredPosts(uid);
    await deleteHostedEvents(uid);
    await deleteAuthoredComments(uid);
    await deleteUserLikes(uid);
    await deleteUserParticipantDocs(uid);
    await deleteFollowMirrors(uid);
    await deleteUserSubcollections(uid);
    await deleteUserNotifications(uid);
    await anonymizeRemainingActorNotifications(uid);
    await deleteUserStravaData(uid);
    await deleteUserAvatar(uid);
    await adminDb.collection('users').doc(uid).delete();
    await deleteAuthUser(uid);
    await deleteAccountDeletionRequestTree(uid);

    return { status: 'finalized' };
  } catch (error) {
    await requestRef.set(
      {
        status: ACCOUNT_DELETION_REQUEST_STATUS_FAILED,
        failureStage: 'finalization',
        finalizationBlocked: createAdminDeleteFieldValue(),
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: createAdminServerTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }
}

async function fetchDueRequestsByStatus(status, now, limitCount) {
  return adminDb
    .collection('accountDeletionRequests')
    .where('status', '==', status)
    .where('scheduledFor', '<=', now)
    .limit(limitCount)
    .get();
}

async function finalizeDueAccountDeletions(limitCount = FINALIZER_DEFAULT_LIMIT) {
  const now = createAdminTimestampFromDate(new Date());
  const processed = [];
  const skipped = [];
  const failed = [];
  const pendingSnapshot = await fetchDueRequestsByStatus(
    ACCOUNT_DELETION_REQUEST_STATUS_PENDING,
    now,
    limitCount,
  );
  const remainingLimit = Math.max(0, limitCount - pendingSnapshot.size);
  const failedSnapshot =
    remainingLimit > 0
      ? await fetchDueRequestsByStatus(ACCOUNT_DELETION_REQUEST_STATUS_FAILED, now, remainingLimit)
      : { docs: [] };
  const dueDocs = [...pendingSnapshot.docs, ...failedSnapshot.docs];

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

export {
  getAccountDeletionRequest,
  getAccountDeletionStatus,
  createAccountDeletionRequest,
  cancelAccountDeletionRequest,
  finalizeAccountDeletion,
  finalizeDueAccountDeletions,
};
