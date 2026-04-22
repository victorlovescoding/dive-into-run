import {
  addDoc,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';
import { EVENT_NOT_FOUND_MESSAGE } from '@/service/event-service';

/**
 * @typedef {import('firebase/firestore').QueryConstraint} QueryConstraint
 * @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot
 */

/**
 * 新增活動文件。
 * @param {object} payload - Firestore event payload。
 * @returns {Promise<import('firebase/firestore').DocumentReference>} 新文件參照。
 */
export async function addEventDocument(payload) {
  return addDoc(collection(db, 'events'), payload);
}

/**
 * 取得最新活動頁。
 * @param {number} limitCount - 每頁數量。
 * @returns {Promise<{ docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null }>} 查詢結果。
 */
export async function fetchLatestEventPage(limitCount) {
  const snapshot = await getDocs(
    query(collection(db, 'events'), orderBy('time', 'desc'), limit(limitCount)),
  );

  return {
    docs: snapshot.docs,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 查詢活動文件。
 * @param {object} [filters] - 查詢條件。
 * @returns {Promise<QueryDocumentSnapshot[]>} 查詢到的文件列表。
 */
export async function queryEventDocuments(filters = {}) {
  const { city, district, startTime, endTime } = filters;
  const eventsRef = collection(db, 'events');
  /** @type {QueryConstraint[]} */
  const constraints = [];

  if (city) {
    constraints.push(where('city', '==', city));
    if (district) {
      constraints.push(where('district', '==', district));
    }
  }

  if (startTime) {
    constraints.push(where('time', '>=', new Date(startTime)));
  }
  if (endTime) {
    constraints.push(where('time', '<=', new Date(endTime)));
  }

  constraints.push(orderBy('time', 'desc'));
  constraints.push(limit(50));

  const snapshot = await getDocs(query(eventsRef, ...constraints));
  return snapshot.docs;
}

/**
 * 以 Firestore Timestamp 版本查詢活動文件。
 * 供 runtime 先把 time filter 正規化後再呼叫。
 * @param {object} [filters] - Firestore-ready 查詢條件。
 * @param {unknown} [filters.startTimeValue] - `time >=` 的 Firestore-compatible 值。
 * @param {unknown} [filters.endTimeValue] - `time <=` 的 Firestore-compatible 值。
 * @param {string} [filters.city] - 縣市。
 * @param {string} [filters.district] - 行政區。
 * @returns {Promise<QueryDocumentSnapshot[]>} 查詢到的文件列表。
 */
export async function queryEventDocumentsWithTimeValues(filters = {}) {
  const { city, district, startTimeValue, endTimeValue } = filters;
  const eventsRef = collection(db, 'events');
  /** @type {QueryConstraint[]} */
  const constraints = [];

  if (city) {
    constraints.push(where('city', '==', city));
    if (district) {
      constraints.push(where('district', '==', district));
    }
  }

  if (startTimeValue) {
    constraints.push(where('time', '>=', startTimeValue));
  }
  if (endTimeValue) {
    constraints.push(where('time', '<=', endTimeValue));
  }

  constraints.push(orderBy('time', 'desc'));
  constraints.push(limit(50));

  const snapshot = await getDocs(query(eventsRef, ...constraints));
  return snapshot.docs;
}

/**
 * 取得單一活動文件。
 * @param {string} eventId - 活動 ID。
 * @returns {Promise<import('firebase/firestore').DocumentSnapshot | null>} 文件快照或 null。
 */
export async function fetchEventDocument(eventId) {
  const snapshot = await getDoc(doc(db, 'events', String(eventId)));
  return snapshot.exists() ? snapshot : null;
}

/**
 * 取得下一頁活動。
 * @param {QueryDocumentSnapshot} afterDoc - 上一頁最後一筆文件。
 * @param {number} limitCount - 每頁數量。
 * @returns {Promise<{ docs: QueryDocumentSnapshot[], lastDoc: QueryDocumentSnapshot | null }>} 查詢結果。
 */
export async function fetchNextEventPage(afterDoc, limitCount) {
  const snapshot = await getDocs(
    query(collection(db, 'events'), orderBy('time', 'desc'), startAfter(afterDoc), limit(limitCount)),
  );

  return {
    docs: snapshot.docs,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

/**
 * 在 transaction 中處理 participant 與 event counter 更新。
 * @template T
 * @param {string} eventId - 活動 ID。
 * @param {string} uid - 使用者 UID。
 * @param {(params: { eventData: object, participantExists: boolean }) => {
 *   result: T,
 *   participantCreate?: object,
 *   participantDelete?: true,
 *   eventUpdates?: object,
 * }} buildPlan - 根據目前狀態建立 transaction plan。
 * @returns {Promise<T>} transaction 結果。
 */
export async function runEventParticipantTransaction(eventId, uid, buildPlan) {
  const eventRef = doc(db, 'events', String(eventId));
  const participantRef = doc(db, 'events', String(eventId), 'participants', String(uid));

  return runTransaction(db, async (tx) => {
    const eventSnapshot = await tx.get(eventRef);
    if (!eventSnapshot.exists()) {
      throw new Error(EVENT_NOT_FOUND_MESSAGE);
    }

    const participantSnapshot = await tx.get(participantRef);
    const plan = buildPlan({
      eventData: eventSnapshot.data(),
      participantExists: participantSnapshot.exists(),
    });

    if (plan.participantCreate) {
      tx.set(participantRef, plan.participantCreate);
    }

    if (plan.participantDelete) {
      tx.delete(participantRef);
    }

    if (plan.eventUpdates) {
      tx.update(eventRef, plan.eventUpdates);
    }

    return plan.result;
  });
}

/**
 * 取得活動參加者文件。
 * @param {string} eventId - 活動 ID。
 * @param {number} limitCount - 最大回傳數量。
 * @returns {Promise<QueryDocumentSnapshot[]>} 參加者文件列表。
 */
export async function fetchParticipantDocuments(eventId, limitCount) {
  const snapshot = await getDocs(
    query(
      collection(db, 'events', String(eventId), 'participants'),
      orderBy('joinedAt', 'desc'),
      limit(limitCount),
    ),
  );

  return snapshot.docs;
}

/**
 * 取得活動參加者 UID 列表。
 * @param {string} eventId - 活動 ID。
 * @param {number} [limitCount] - 最大回傳數量。
 * @returns {Promise<string[]>} 參加者 UID 列表。
 */
export async function fetchParticipantUids(eventId, limitCount = 50) {
  const docs = await fetchParticipantDocuments(eventId, limitCount);
  return docs.map((snapshot) => snapshot.data().uid || snapshot.id);
}

/**
 * 取得一批活動中「我是否已參加」的文件快照。
 * @param {string} uid - 使用者 UID。
 * @param {string[]} eventIds - 活動 ID 列表。
 * @returns {Promise<import('firebase/firestore').DocumentSnapshot[]>} participant 文件快照列表。
 */
export async function fetchJoinedParticipantDocuments(uid, eventIds) {
  const ids = eventIds.slice(0, 30).map(String);
  return Promise.all(
    ids.map((eventId) => getDoc(doc(db, 'events', eventId, 'participants', String(uid)))),
  );
}

/**
 * 在 transaction 中更新活動文件。
 * @template T
 * @param {string} eventId - 活動 ID。
 * @param {(currentEventData: object) => { result: T, updates: object }} buildPlan - 更新計畫。
 * @returns {Promise<T>} 更新結果。
 */
export async function runEventUpdateTransaction(eventId, buildPlan) {
  const eventRef = doc(db, 'events', String(eventId));

  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(eventRef);
    if (!snapshot.exists()) {
      throw new Error(EVENT_NOT_FOUND_MESSAGE);
    }

    const plan = buildPlan(snapshot.data());
    tx.update(eventRef, plan.updates);
    return plan.result;
  });
}

/**
 * 刪除活動及其 participants/comments/history 子樹。
 * @param {string} eventId - 活動 ID。
 * @returns {Promise<{ ok: boolean }>} 刪除結果。
 */
export async function deleteEventTree(eventId) {
  const eventRef = doc(db, 'events', String(eventId));
  const eventSnapshot = await getDoc(eventRef);

  if (!eventSnapshot.exists()) {
    throw new Error(EVENT_NOT_FOUND_MESSAGE);
  }

  const participantsSnapshot = await getDocs(collection(db, 'events', String(eventId), 'participants'));
  const commentsSnapshot = await getDocs(collection(db, 'events', String(eventId), 'comments'));
  const historySnapshots = await Promise.all(
    commentsSnapshot.docs.map((commentDoc) =>
      getDocs(collection(db, 'events', String(eventId), 'comments', commentDoc.id, 'history')),
    ),
  );

  const batch = writeBatch(db);

  historySnapshots.forEach((historySnapshot) => {
    historySnapshot.docs.forEach((historyDoc) => batch.delete(historyDoc.ref));
  });

  commentsSnapshot.docs.forEach((commentDoc) => batch.delete(commentDoc.ref));
  participantsSnapshot.docs.forEach((participantDoc) => batch.delete(participantDoc.ref));
  batch.delete(eventRef);

  await batch.commit();
  return { ok: true };
}
