import { serverTimestamp } from 'firebase/firestore';
import { buildNotificationMessage } from '@/lib/notification-helpers';
import {
  addNotificationDocument,
  addNotificationDocuments,
  fetchDistinctCommentAuthors as fetchDistinctCommentAuthorsRepo,
  fetchDistinctEventCommentAuthors,
  fetchDistinctPostCommentAuthors,
  fetchMoreNotificationDocuments,
  fetchMoreUnreadNotificationDocuments,
  markNotificationAsRead as markNotificationAsReadDocument,
  watchNotificationDocuments,
  watchUnreadNotificationDocuments,
} from '@/repo/client/firebase-notifications-repo';
import { fetchParticipantUids } from '@/repo/client/firebase-events-repo';
import { buildNotificationDoc, toNotificationItems } from '@/service/notification-service';

/**
 * @typedef {import('@/service/notification-service').Actor} Actor
 * @typedef {import('@/service/notification-service').NotificationItem} NotificationItem
 */

/**
 * 透過 runtime 層建立「活動被修改」通知。
 * @param {string} eventId - 活動 ID。
 * @param {string} eventTitle - 活動標題。
 * @param {Actor} actor - 修改活動的使用者。
 * @returns {Promise<void>}
 */
export async function notifyEventModified(eventId, eventTitle, actor) {
  const participantUids = await fetchParticipantUids(eventId);
  const recipients = participantUids.filter((uid) => uid !== actor.uid);
  if (recipients.length === 0) return;

  const message = buildNotificationMessage('event_modified', eventTitle);
  const payloads = recipients.map((recipientUid) =>
    buildNotificationDoc({
      recipientUid,
      type: 'event_modified',
      entityType: 'event',
      entityId: eventId,
      entityTitle: eventTitle,
      commentId: null,
      message,
      actor,
      createdAtValue: serverTimestamp(),
    }),
  );

  await addNotificationDocuments(payloads);
}

/**
 * 透過 runtime 層建立「活動已取消」通知。
 * 支援舊呼叫方式（直接傳 participants）與新呼叫方式（由 runtime 自己抓 participants）。
 * @param {string} eventId - 活動 ID。
 * @param {string} eventTitle - 活動標題。
 * @param {{ uid: string }[] | Actor} participantsOrActor - 舊版 participants 或新版 actor。
 * @param {Actor} [maybeActor] - 舊版 actor。
 * @returns {Promise<void>}
 */
export async function notifyEventCancelled(eventId, eventTitle, participantsOrActor, maybeActor) {
  const hasParticipantsArray = Array.isArray(participantsOrActor);
  const actor = hasParticipantsArray ? maybeActor : participantsOrActor;
  const participants = hasParticipantsArray
    ? participantsOrActor
    : (await fetchParticipantUids(eventId)).map((uid) => ({ uid }));

  if (!actor?.uid) {
    throw new Error('notifyEventCancelled: actor is required');
  }

  const recipients = participants.filter((participant) => participant.uid !== actor.uid);
  if (recipients.length === 0) return;

  const message = buildNotificationMessage('event_cancelled', eventTitle);
  const payloads = recipients.map((participant) =>
    buildNotificationDoc({
      recipientUid: participant.uid,
      type: 'event_cancelled',
      entityType: 'event',
      entityId: eventId,
      entityTitle: eventTitle,
      commentId: null,
      message,
      actor,
      createdAtValue: serverTimestamp(),
    }),
  );

  await addNotificationDocuments(payloads);
}

/**
 * 透過 runtime 層建立「文章有新留言」通知給文章作者。
 * @param {string} postId - 文章 ID。
 * @param {string} postTitle - 文章標題。
 * @param {string} postAuthorUid - 文章作者 UID。
 * @param {string} commentId - 留言 ID。
 * @param {Actor} actor - 留言者。
 * @returns {Promise<void>}
 */
export async function notifyPostNewComment(postId, postTitle, postAuthorUid, commentId, actor) {
  if (actor.uid === postAuthorUid) return;

  const message = buildNotificationMessage('post_new_comment', postTitle);
  await addNotificationDocument(
    buildNotificationDoc({
      recipientUid: postAuthorUid,
      type: 'post_new_comment',
      entityType: 'post',
      entityId: postId,
      entityTitle: postTitle,
      commentId,
      message,
      actor,
      createdAtValue: serverTimestamp(),
    }),
  );
}

/**
 * 查詢 comments subcollection 中所有不重複的 authorUid。
 * @param {import('firebase/firestore').CollectionReference} commentsRef - comments collection reference。
 * @returns {Promise<string[]>} 不重複的 authorUid 陣列。
 */
export async function fetchDistinctCommentAuthors(commentsRef) {
  return fetchDistinctCommentAuthorsRepo(commentsRef);
}

/**
 * 文章跟帖通知：通知曾在該文章留言的使用者（排除留言者本人與文章作者）。
 * @param {string} postId - 文章 ID。
 * @param {string} postTitle - 文章標題。
 * @param {string} postAuthorUid - 文章作者 UID（排除對象）。
 * @param {string} commentId - 新留言 ID。
 * @param {Actor} actor - 留言者。
 * @returns {Promise<void>}
 */
export async function notifyPostCommentReply(postId, postTitle, postAuthorUid, commentId, actor) {
  const authors = await fetchDistinctPostCommentAuthors(postId);
  const recipients = authors.filter((uid) => uid !== actor.uid && uid !== postAuthorUid);
  if (recipients.length === 0) return;

  const message = buildNotificationMessage('post_comment_reply', postTitle);
  const payloads = recipients.map((uid) =>
    buildNotificationDoc({
      recipientUid: uid,
      type: 'post_comment_reply',
      entityType: 'post',
      entityId: postId,
      entityTitle: postTitle,
      commentId,
      message,
      actor,
      createdAtValue: serverTimestamp(),
    }),
  );

  await addNotificationDocuments(payloads);
}

/**
 * 活動留言通知：一次處理主揪人/參加者/跟帖者三種通知，含去重。
 * @param {string} eventId - 活動 ID。
 * @param {string} eventTitle - 活動標題。
 * @param {string} hostUid - 主揪人 UID。
 * @param {string} commentId - 新留言 ID。
 * @param {Actor} actor - 留言者。
 * @returns {Promise<void>}
 */
export async function notifyEventNewComment(eventId, eventTitle, hostUid, commentId, actor) {
  const notifiedSet = new Set([actor.uid]);

  const payloads = [];
  const hostRecipients = hostUid && !notifiedSet.has(hostUid) ? [hostUid] : [];
  if (hostRecipients.length > 0) {
    const message = buildNotificationMessage('event_host_comment', eventTitle);
    payloads.push(
      ...hostRecipients.map((recipientUid) =>
        buildNotificationDoc({
          recipientUid,
          type: 'event_host_comment',
          entityType: 'event',
          entityId: eventId,
          entityTitle: eventTitle,
          commentId,
          message,
          actor,
          createdAtValue: serverTimestamp(),
        }),
      ),
    );
    hostRecipients.forEach((recipientUid) => notifiedSet.add(recipientUid));
  }

  const participantUids = await fetchParticipantUids(eventId);
  const participantRecipients = participantUids.filter((uid) => !notifiedSet.has(uid));
  if (participantRecipients.length > 0) {
    const message = buildNotificationMessage('event_participant_comment', eventTitle);
    payloads.push(
      ...participantRecipients.map((recipientUid) =>
        buildNotificationDoc({
          recipientUid,
          type: 'event_participant_comment',
          entityType: 'event',
          entityId: eventId,
          entityTitle: eventTitle,
          commentId,
          message,
          actor,
          createdAtValue: serverTimestamp(),
        }),
      ),
    );
    participantRecipients.forEach((recipientUid) => notifiedSet.add(recipientUid));
  }

  const commentAuthors = await fetchDistinctEventCommentAuthors(eventId);
  const commenterRecipients = commentAuthors.filter((uid) => !notifiedSet.has(uid));
  if (commenterRecipients.length > 0) {
    const message = buildNotificationMessage('event_comment_reply', eventTitle);
    payloads.push(
      ...commenterRecipients.map((recipientUid) =>
        buildNotificationDoc({
          recipientUid,
          type: 'event_comment_reply',
          entityType: 'event',
          entityId: eventId,
          entityTitle: eventTitle,
          commentId,
          message,
          actor,
          createdAtValue: serverTimestamp(),
        }),
      ),
    );
  }

  if (payloads.length === 0) return;
  await addNotificationDocuments(payloads);
}

/**
 * 監聽使用者最新通知（即時更新）。
 * @param {string} uid - 使用者 UID。
 * @param {(notifications: NotificationItem[], lastDoc?: import('firebase/firestore').QueryDocumentSnapshot | null) => void} onNext - 完整列表回呼。
 * @param {(error: Error) => void} onError - 錯誤回呼。
 * @param {(newNotifications: NotificationItem[]) => void} [onNew] - 新增通知回呼。
 * @returns {() => void} 退訂函式。
 */
export function watchNotifications(uid, onNext, onError, onNew) {
  return watchNotificationDocuments(
    uid,
    (docs, lastDoc) => onNext(toNotificationItems(docs), lastDoc),
    onError,
    onNew
      ? (docs) => onNew(toNotificationItems(docs))
      : undefined,
  );
}

/**
 * 監聽使用者未讀通知（即時更新），用於未讀計數與「未讀」分頁。
 * @param {string} uid - 使用者 UID。
 * @param {(notifications: NotificationItem[], lastDoc?: import('firebase/firestore').QueryDocumentSnapshot | null) => void} onNext - 資料回呼。
 * @param {(error: Error) => void} onError - 錯誤回呼。
 * @returns {() => void} 退訂函式。
 */
export function watchUnreadNotifications(uid, onNext, onError) {
  return watchUnreadNotificationDocuments(uid, (docs, lastDoc) => onNext(toNotificationItems(docs), lastDoc), onError);
}

/**
 * 載入更多通知（分頁查詢）。
 * @param {string} uid - 使用者 UID。
 * @param {import('firebase/firestore').QueryDocumentSnapshot} afterDoc - 分頁游標。
 * @param {number} [limitCount] - 每頁筆數，預設 5。
 * @returns {Promise<{ notifications: NotificationItem[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot | null }>} 分頁結果。
 */
export async function fetchMoreNotifications(uid, afterDoc, limitCount) {
  const { docs, lastDoc } = await fetchMoreNotificationDocuments(uid, afterDoc, limitCount);
  return {
    notifications: toNotificationItems(docs),
    lastDoc,
  };
}

/**
 * 載入更多未讀通知（分頁查詢）。
 * @param {string} uid - 使用者 UID。
 * @param {import('firebase/firestore').QueryDocumentSnapshot} afterDoc - 分頁游標。
 * @param {number} [limitCount] - 每頁筆數，預設 5。
 * @returns {Promise<{ notifications: NotificationItem[], lastDoc: import('firebase/firestore').QueryDocumentSnapshot | null }>} 分頁結果。
 */
export async function fetchMoreUnreadNotifications(uid, afterDoc, limitCount) {
  const { docs, lastDoc } = await fetchMoreUnreadNotificationDocuments(uid, afterDoc, limitCount);
  return {
    notifications: toNotificationItems(docs),
    lastDoc,
  };
}

/**
 * 標記單則通知為已讀。
 * @param {string} notificationId - 通知 document ID。
 * @returns {Promise<void>}
 */
export async function markNotificationAsRead(notificationId) {
  return markNotificationAsReadDocument(notificationId);
}
