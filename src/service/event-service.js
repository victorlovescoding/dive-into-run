import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';

export { EVENT_NOT_FOUND_MESSAGE } from '@/types/not-found-messages';

/**
 * @typedef {import('firebase/firestore').Timestamp} Timestamp
 */

/**
 * @typedef {object} EventData
 * @property {string} [id] - Firestore 文件 ID。
 * @property {string} city - 活動所在縣市。
 * @property {string} district - 活動所在行政區。
 * @property {Timestamp} time - 活動開始時間。
 * @property {Timestamp} registrationDeadline - 報名截止時間。
 * @property {number} distanceKm - 跑步距離（公里）。
 * @property {number} maxParticipants - 人數上限。
 * @property {number} [participantsCount] - 目前報名人數。
 * @property {number} [remainingSeats] - 剩餘名額。
 * @property {number} paceSec - 每公里配速（秒）。
 * @property {Timestamp} [createdAt] - 活動建立時間。
 * @property {string} [hostUid] - 主辦者 UID。
 * @property {string} [title] - 活動標題。
 * @property {string} [location] - 活動地點名稱。
 * @property {string} [description] - 活動描述。
 * @property {string} [routeImage] - 路線圖片 URL。
 */

/**
 * @typedef {object} JoinResult
 * @property {boolean} ok - 操作是否成功。
 * @property {'joined'|'already_joined'|'full'} status - 參加結果狀態。
 */

/**
 * @typedef {object} LeaveResult
 * @property {boolean} ok - 操作是否成功。
 * @property {'left'|'not_joined'} status - 退出結果狀態。
 */

/**
 * 將 UI 表單送出的 raw data 正規化成 Firestore 友善的 payload。
 * @param {object} raw - 來自 UI 表單的原始資料物件。
 * @param {string} raw.time - 活動時間 ISO 字串。
 * @param {string} raw.registrationDeadline - 報名截止時間 ISO 字串。
 * @param {string|number} raw.distanceKm - 距離（公里）。
 * @param {string|number} [raw.maxParticipants] - 人數上限，預設 2。
 * @param {string|number} raw.paceMinutes - 配速（分鐘）。
 * @param {string|number} raw.paceSeconds - 配速（秒數）。
 * @param {unknown} [raw.planRoute] - 路線規劃（未使用，將被濾除）。
 * @returns {object} 正規化後的 Firestore payload。
 * @throws {Error} 若必要欄位遺失或格式不正確。
 */
export function normalizeEventPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('normalizeEventPayload: raw payload is required');
  }

  const timeDate = new Date(raw.time);
  const deadlineDate = new Date(raw.registrationDeadline);

  if (Number.isNaN(timeDate.getTime()) || Number.isNaN(deadlineDate.getTime())) {
    throw new Error('活動時間或報名截止時間格式不正確');
  }

  if (deadlineDate >= timeDate) {
    throw new Error('報名截止時間必須在活動開始時間之前');
  }

  const time = FirestoreTimestamp.fromDate(timeDate);
  const registrationDeadline = FirestoreTimestamp.fromDate(deadlineDate);

  const distanceKm = Number(raw.distanceKm);
  const maxParticipants = Number(raw.maxParticipants ?? 2);

  if (Number.isNaN(distanceKm) || distanceKm <= 0) {
    throw new Error('距離（公里）請輸入有效數字');
  }

  if (Number.isNaN(maxParticipants) || maxParticipants < 2) {
    throw new Error('人數上限請輸入 2 以上的有效數字');
  }

  const rest = { ...raw };
  delete rest.planRoute;
  delete rest.paceMinutes;
  delete rest.paceSeconds;

  const { paceMinutes, paceSeconds } = raw;

  const paceMin = Number(paceMinutes);
  const paceSecPart = Number(paceSeconds);

  if (!Number.isFinite(paceMin) || paceMin <= 0) {
    throw new Error('配速（分鐘）請選擇有效數字');
  }

  if (!Number.isFinite(paceSecPart) || paceSecPart < 0 || paceSecPart > 59) {
    throw new Error('配速（秒）請選擇 00–59');
  }

  return {
    ...rest,
    time,
    registrationDeadline,
    distanceKm,
    maxParticipants,
    paceSec: paceMin * 60 + paceSecPart,
  };
}

/**
 * 清掉 UI 層不該直接寫入 Firestore 的多餘欄位。
 * @param {object} [extra] - UI 組裝的額外欄位。
 * @returns {object} 清洗後可 merge 的額外 payload。
 */
export function sanitizeCreateEventExtra(extra = {}) {
  const extraRest = { ...(extra || {}) };
  delete extraRest.pace;
  delete extraRest.paceText;
  delete extraRest.paceMinutes;
  delete extraRest.paceSeconds;
  delete extraRest.paceSec;

  return extraRest;
}

/**
 * 建立活動寫入 payload。
 * @param {object} raw - UI 表單資料。
 * @param {object} extraRest - 已清洗的額外欄位。
 * @param {unknown} createdAtValue - 由 runtime 注入的 createdAt 值。
 * @returns {object} Firestore event payload。
 */
export function buildCreateEventPayload(raw, extraRest, createdAtValue) {
  const normalized = normalizeEventPayload(raw);

  return {
    ...normalized,
    ...extraRest,
    createdAt: createdAtValue,
    participantsCount: 0,
    remainingSeats: normalized.maxParticipants,
  };
}

/**
 * 將 Firestore snapshot 正規化成 UI 使用的 event object。
 * @param {{ id: string, data: () => object }} snapshot - Firestore 文件快照。
 * @returns {EventData} event object。
 */
export function toEventData(snapshot) {
  return /** @type {EventData} */ ({
    id: snapshot.id,
    ...snapshot.data(),
  });
}

/**
 * 將多筆 Firestore snapshot 正規化成 event array。
 * @param {Array<{ id: string, data: () => object }>} snapshots - Firestore 文件快照列表。
 * @returns {EventData[]} event array。
 */
export function toEventDataList(snapshots) {
  return snapshots.map((snapshot) => toEventData(snapshot));
}

/**
 * 混合式查詢的第二階段 in-memory 過濾。
 * @param {EventData[]} events - Firestore 已初步過濾完成的活動列表。
 * @param {object} [filters] - 篩選條件。
 * @param {number|string} [filters.minDistance] - 最小距離。
 * @param {number|string} [filters.maxDistance] - 最大距離。
 * @param {boolean} [filters.hasSeatsOnly] - 是否只顯示有名額的活動。
 * @returns {EventData[]} 過濾後結果。
 */
export function filterEventsByDistanceAndSeats(events, filters = {}) {
  const { minDistance, maxDistance, hasSeatsOnly } = filters;
  let results = [...events];

  if (minDistance !== undefined && minDistance !== '' && minDistance !== null) {
    const min = Number(minDistance) - 0.5;
    results = results.filter((ev) => Number(ev.distanceKm || 0) >= min);
  }

  if (maxDistance !== undefined && maxDistance !== '' && maxDistance !== null) {
    const max = Number(maxDistance) + 0.5;
    results = results.filter((ev) => Number(ev.distanceKm || 0) <= max);
  }

  if (hasSeatsOnly) {
    results = results.filter((ev) => {
      const seats =
        typeof ev.remainingSeats === 'number'
          ? ev.remainingSeats
          : Number(ev.maxParticipants || 0) - Number(ev.participantsCount || 0);
      return seats > 0;
    });
  }

  return results;
}

/**
 * 建立 join event 的 transaction plan。
 * @param {object} params - 目前 event 與 participant 狀態。
 * @param {object} params.eventData - 活動文件資料。
 * @param {boolean} params.participantExists - 使用者是否已參加。
 * @param {{ uid: string, name?: string, photoURL?: string }} params.user - 使用者資料。
 * @param {string} params.eventId - 活動 ID。
 * @param {unknown} params.joinedAtValue - 由 runtime 注入的 joinedAt 值。
 * @returns {{ result: JoinResult, participantCreate?: object, eventUpdates?: object }} transaction plan。
 */
export function buildJoinEventPlan({ eventData, participantExists, user, eventId, joinedAtValue }) {
  const maxParticipants = Number(eventData.maxParticipants ?? 0);
  const participantsCount = Number(eventData.participantsCount ?? 0);
  const remainingSeats =
    typeof eventData.remainingSeats === 'number'
      ? eventData.remainingSeats
      : Math.max(0, maxParticipants - participantsCount);

  if (participantExists) {
    return {
      result: { ok: true, status: 'already_joined' },
    };
  }

  if (remainingSeats <= 0) {
    return {
      result: { ok: false, status: 'full' },
    };
  }

  return {
    result: { ok: true, status: 'joined' },
    participantCreate: {
      uid: String(user.uid),
      name: String(user.name ?? ''),
      photoURL: String(user.photoURL ?? ''),
      eventId,
      joinedAt: joinedAtValue,
    },
    eventUpdates: {
      remainingSeats: remainingSeats - 1,
      participantsCount: participantsCount + 1,
    },
  };
}

/**
 * 建立 leave event 的 transaction plan。
 * @param {object} params - 目前 event 與 participant 狀態。
 * @param {object} params.eventData - 活動文件資料。
 * @param {boolean} params.participantExists - 使用者是否已參加。
 * @returns {{ result: LeaveResult, participantDelete?: true, eventUpdates?: object }} transaction plan。
 */
export function buildLeaveEventPlan({ eventData, participantExists }) {
  const maxParticipants = Number(eventData.maxParticipants ?? 0);
  const participantsCount = Number(eventData.participantsCount ?? 0);
  const remainingSeats =
    typeof eventData.remainingSeats === 'number'
      ? eventData.remainingSeats
      : Math.max(0, maxParticipants - participantsCount);

  if (!participantExists) {
    return {
      result: { ok: true, status: 'not_joined' },
    };
  }

  return {
    result: { ok: true, status: 'left' },
    participantDelete: true,
    eventUpdates: {
      remainingSeats: Math.min(maxParticipants, remainingSeats + 1),
      participantsCount: Math.max(0, participantsCount - 1),
    },
  };
}

/**
 * 建立 update event transaction 的 payload。
 * @param {string} eventId - 活動 ID。
 * @param {object} updatedFields - 要更新的欄位。
 * @param {object} currentEventData - 目前活動文件資料。
 * @param {unknown} [deleteFieldValue] - 由 runtime 注入的 delete sentinel。
 * @returns {object} 可直接 tx.update 的 payload。
 */
export function prepareEventUpdateFields(
  eventId,
  updatedFields,
  currentEventData,
  deleteFieldValue,
) {
  if (!eventId) throw new Error('updateEvent: eventId is required');
  if (
    !updatedFields ||
    typeof updatedFields !== 'object' ||
    Array.isArray(updatedFields) ||
    Object.keys(updatedFields).length === 0
  ) {
    throw new Error('updateEvent: updatedFields must be a non-empty object');
  }

  const updates = { ...updatedFields };

  if (typeof updates.time === 'string' && updates.time) {
    updates.time = FirestoreTimestamp.fromDate(new Date(updates.time));
  }

  if (typeof updates.registrationDeadline === 'string' && updates.registrationDeadline) {
    updates.registrationDeadline = FirestoreTimestamp.fromDate(
      new Date(updates.registrationDeadline),
    );
  }

  if ('time' in updates || 'registrationDeadline' in updates) {
    const effectiveTime = updates.time ?? currentEventData.time;
    const effectiveDeadline = updates.registrationDeadline ?? currentEventData.registrationDeadline;

    if (effectiveDeadline.toDate().getTime() >= effectiveTime.toDate().getTime()) {
      throw new Error('報名截止時間必須在活動開始時間之前');
    }
  }

  if ('route' in updates && updates.route === null && deleteFieldValue !== undefined) {
    updates.route = deleteFieldValue;
  }

  if ('maxParticipants' in updatedFields) {
    const newMax = Number(updatedFields.maxParticipants);
    const participantsCount = Number(currentEventData.participantsCount ?? 0);

    if (newMax < participantsCount) {
      throw new Error('人數上限不能低於目前的報名人數');
    }

    updates.remainingSeats = newMax - participantsCount;
  }

  return updates;
}
