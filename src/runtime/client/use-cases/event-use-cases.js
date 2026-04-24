import { Timestamp as FirestoreTimestamp, deleteField, serverTimestamp } from 'firebase/firestore';
import {
  buildCreateEventPayload,
  buildJoinEventPlan,
  buildLeaveEventPlan,
  filterEventsByDistanceAndSeats,
  prepareEventUpdateFields,
  sanitizeCreateEventExtra,
  toEventData,
  toEventDataList,
} from '@/service/event-service';
import {
  addEventDocument,
  deleteEventTree,
  fetchEventDocument,
  fetchJoinedParticipantDocuments,
  fetchLatestEventPage,
  fetchNextEventPage,
  fetchParticipantDocuments,
  queryEventDocumentsWithTimeValues,
  runEventParticipantTransaction,
  runEventUpdateTransaction,
} from '@/repo/client/firebase-events-repo';

export { EVENT_NOT_FOUND_MESSAGE } from '@/service/event-service';

/**
 * 建立活動。
 * @param {object} raw - UI 表單資料。
 * @param {object} [extra] - 額外欄位。
 * @returns {Promise<import('firebase/firestore').DocumentReference>} 新建立的活動文件參照。
 */
export async function createEvent(raw, extra = {}) {
  const payload = buildCreateEventPayload(raw, sanitizeCreateEventExtra(extra), serverTimestamp());
  return addEventDocument(payload);
}

/**
 * 取得最新活動列表。
 * @param {number} [limitCount] - 一次取得幾筆資料。
 * @returns {Promise<{
 *   events: import('@/service/event-service').EventData[],
 *   lastDoc: import('firebase/firestore').QueryDocumentSnapshot | null
 * }>} 活動列表與分頁 cursor。
 */
export async function fetchLatestEvents(limitCount = 10) {
  const { docs, lastDoc } = await fetchLatestEventPage(limitCount);
  return {
    events: toEventDataList(docs),
    lastDoc,
  };
}

/**
 * 混合式查詢活動。
 * @param {object} [filters] - 篩選條件。
 * @returns {Promise<import('@/service/event-service').EventData[]>} 符合條件的活動列表。
 */
export async function queryEvents(filters = {}) {
  const { startTime, endTime, ...restFilters } = filters;
  const docs = await queryEventDocumentsWithTimeValues({
    ...restFilters,
    startTimeValue: startTime ? FirestoreTimestamp.fromDate(new Date(startTime)) : undefined,
    endTimeValue: endTime ? FirestoreTimestamp.fromDate(new Date(endTime)) : undefined,
  });

  return filterEventsByDistanceAndSeats(toEventDataList(docs), filters);
}

/**
 * 取得單一活動。
 * @param {string} eventId - 活動 ID。
 * @returns {Promise<import('@/service/event-service').EventData | null>} 活動資料或 null。
 */
export async function fetchEventById(eventId) {
  if (!eventId) return null;

  const snapshot = await fetchEventDocument(eventId);
  return snapshot ? toEventData(snapshot) : null;
}

/**
 * 取得下一頁活動。
 * @param {import('firebase/firestore').QueryDocumentSnapshot} afterDoc - 上一頁 cursor。
 * @param {number} [limitCount] - 一次取得幾筆資料。
 * @returns {Promise<{
 *   events: import('@/service/event-service').EventData[],
 *   lastDoc: import('firebase/firestore').QueryDocumentSnapshot | null
 * }>} 活動列表與分頁 cursor。
 */
export async function fetchNextEvents(afterDoc, limitCount = 10) {
  if (!afterDoc) {
    return { events: [], lastDoc: null };
  }

  const { docs, lastDoc } = await fetchNextEventPage(afterDoc, limitCount);
  return {
    events: toEventDataList(docs),
    lastDoc,
  };
}

/**
 * 參加活動。
 * @param {string} eventId - 活動 ID。
 * @param {{ uid: string, name?: string, photoURL?: string }} user - 使用者資料。
 * @returns {Promise<import('@/service/event-service').JoinResult>} 執行結果。
 */
export async function joinEvent(eventId, user) {
  if (!eventId) throw new Error('joinEvent: eventId is required');
  if (!user?.uid) throw new Error('joinEvent: user.uid is required');

  return runEventParticipantTransaction(String(eventId), String(user.uid), (state) =>
    buildJoinEventPlan({
      ...state,
      user,
      eventId: String(eventId),
      joinedAtValue: serverTimestamp(),
    }),
  );
}

/**
 * 退出活動。
 * @param {string} eventId - 活動 ID。
 * @param {{ uid: string }} user - 使用者資料。
 * @returns {Promise<import('@/service/event-service').LeaveResult>} 執行結果。
 */
export async function leaveEvent(eventId, user) {
  if (!eventId) throw new Error('leaveEvent: eventId is required');
  if (!user?.uid) throw new Error('leaveEvent: user.uid is required');

  return runEventParticipantTransaction(String(eventId), String(user.uid), (state) =>
    buildLeaveEventPlan(state),
  );
}

/**
 * 取得活動參加者名單。
 * @param {string} eventId - 活動 ID。
 * @param {number} [limitCount] - 最大回傳數量。
 * @returns {Promise<object[]>} 參加者列表。
 */
export async function fetchParticipants(eventId, limitCount = 50) {
  if (!eventId) throw new Error('fetchParticipants: eventId is required');

  const docs = await fetchParticipantDocuments(eventId, limitCount);
  return docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
}

/**
 * 取得一批活動中「我是否已參加」。
 * @param {string} uid - 使用者 ID。
 * @param {string[]} eventIds - 活動 ID 列表。
 * @returns {Promise<Set<string>>} 已參加的 eventId 集合。
 */
export async function fetchMyJoinedEventsForIds(uid, eventIds) {
  if (!uid) return new Set();
  if (!Array.isArray(eventIds) || eventIds.length === 0) return new Set();

  const ids = eventIds.slice(0, 30).map(String);
  const snapshots = await fetchJoinedParticipantDocuments(uid, ids);
  const joined = new Set();

  snapshots.forEach((snapshot, index) => {
    if (snapshot.exists()) {
      joined.add(ids[index]);
    }
  });

  return joined;
}

/**
 * 更新活動資料。
 * @param {string} eventId - 活動 ID。
 * @param {object} updatedFields - 要更新的欄位。
 * @returns {Promise<{ ok: boolean }>} 更新結果。
 */
export async function updateEvent(eventId, updatedFields) {
  const deleteFieldValue =
    updatedFields &&
    typeof updatedFields === 'object' &&
    'route' in updatedFields &&
    updatedFields.route === null
      ? deleteField()
      : undefined;

  return runEventUpdateTransaction(String(eventId), (currentEventData) => ({
    result: { ok: true },
    updates: prepareEventUpdateFields(
      String(eventId),
      updatedFields,
      currentEventData,
      deleteFieldValue,
    ),
  }));
}

/**
 * 刪除活動及其子集合。
 * @param {string} eventId - 活動 ID。
 * @returns {Promise<{ ok: boolean }>} 刪除結果。
 */
export async function deleteEvent(eventId) {
  if (!eventId) throw new Error('deleteEvent: eventId is required');
  return deleteEventTree(String(eventId));
}
