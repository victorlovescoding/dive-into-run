import {
  addDoc,
  collection,
  Timestamp,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase-client';

// 將 UI 表單送出的 raw data 正規化成 Firestore 友善的 payload
// 用意：把資料型別與資料清潔集中在 data layer，避免 UI 重複做轉換
/**
 * 將 UI 表單送出的 raw data 正規化成 Firestore 友善的 payload。
 * 用意：把資料型別與資料清潔集中在 data layer，避免 UI 重複做轉換。
 * @param {object} raw - 來自 UI 表單的原始資料物件。
 * @param {string} raw.time - 活動時間 ISO 字串。
 * @param {string} raw.registrationDeadline - 報名截止時間 ISO 字串。
 * @param {string|number} raw.distanceKm - 距離（公里）。
 * @param {string|number} [raw.maxParticipants] - 人數上限，預設 2。
 * @param {string|number} raw.paceMinutes - 配速（分鐘）。
 * @param {string|number} raw.paceSeconds - 配速（秒數）。
 * @param {unknown} [raw.planRoute] - 路線規劃（未使用，將被濾除）。
 * @returns {object} 正規化後的 Firestore payload，包含 Timestamp 物件與計算後的 paceSec。
 * @throws {Error} 若必要欄位遺失或格式不正確。
 */
export function normalizeEventPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('normalizeEventPayload: raw payload is required');
  }

  // 1) time / registrationDeadline：datetime-local 字串 -> Timestamp
  const timeDate = new Date(raw.time);
  const deadlineDate = new Date(raw.registrationDeadline);

  if (Number.isNaN(timeDate.getTime()) || Number.isNaN(deadlineDate.getTime())) {
    throw new Error('活動時間或報名截止時間格式不正確');
  }

  const time = Timestamp.fromDate(timeDate);
  const registrationDeadline = Timestamp.fromDate(deadlineDate);

  // 2) distanceKm / maxParticipants：字串 -> number
  const distanceKm = Number(raw.distanceKm);
  const maxParticipants = Number(raw.maxParticipants ?? 2);

  if (Number.isNaN(distanceKm) || distanceKm <= 0) {
    throw new Error('距離（公里）請輸入有效數字');
  }

  if (Number.isNaN(maxParticipants) || maxParticipants < 2) {
    throw new Error('人數上限請輸入 2 以上的有效數字');
  }

  // 3) pace：UI 用下拉（分鐘/秒），Firestore 只存 paceSec（number）
  //    - 建立活動前在 data layer 統一轉換，避免 UI 到處重複算
  //    - paceSec 代表「每公里配速的秒數」
  const {
    planRoute: _planRoute, // eslint-disable-line no-unused-vars
    paceMinutes, paceSeconds, ...rest
  } = raw;

  const paceMin = Number(paceMinutes);
  const paceSecPart = Number(paceSeconds);

  if (!Number.isFinite(paceMin) || paceMin <= 0) {
    throw new Error('配速（分鐘）請選擇有效數字');
  }

  if (!Number.isFinite(paceSecPart) || paceSecPart < 0 || paceSecPart > 59) {
    throw new Error('配速（秒）請選擇 00–59');
  }

  const paceSec = paceMin * 60 + paceSecPart;

  return {
    ...rest,
    time,
    registrationDeadline,
    distanceKm,
    maxParticipants,
    paceSec,
  };
}

/**
 * 建立活動（寫入 Firestore）。
 * @param {object} raw - UI 表單資料 (例如 from Object.fromEntries)。
 * @param {object} [extra] - 由 UI 組裝的額外欄位（例如 host/route 等）。
 * @param {unknown} [extra.pace] - 濾除欄位。
 * @param {unknown} [extra.paceText] - 濾除欄位。
 * @param {unknown} [extra.paceMinutes] - 濾除欄位。
 * @param {unknown} [extra.paceSeconds] - 濾除欄位。
 * @param {unknown} [extra.paceSec] - 濾除欄位 (避免衝突)。
 * @returns {Promise<import('firebase/firestore').DocumentReference>} 新建立的活動文件參照。
 */
export async function createEvent(raw, extra = {}) {
  // ✅ 安全起見：不讓 UI 傳進來的字串 pace 混進資料庫（Firestore 只存 paceSec）
  /* eslint-disable no-unused-vars */
  const {
    pace: _pace,
    paceText: _paceText,
    paceMinutes: _paceMinutes,
    paceSeconds: _paceSeconds,
    paceSec: _paceSec,
    ...extraRest
  } = extra || {};
  /* eslint-enable no-unused-vars */

  const payload = {
    ...normalizeEventPayload(raw),
    ...extraRest,
    // ✅ 改用伺服器時間：避免使用者裝置時間不準造成排序怪異
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'events'), payload);
  return docRef;
}

/**
 * 取得最新的活動列表（依 createdAt 由新到舊）。
 * 用意：讓 UI 不直接碰 Firestore 查詢，統一走 data layer。
 * @param {number} [limitCount] - 一次取得幾筆資料。
 * @returns {Promise<{
 *   events: object[],
 *   lastDoc: import('firebase/firestore').QueryDocumentSnapshot|null
 * }>} 活動列表與分頁 cursor。
 */
export async function fetchLatestEvents(limitCount = 10) {
  const q = query(
    collection(db, 'events'),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );

  const snap = await getDocs(q);
  const events = snap.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));

  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { events, lastDoc };
}

/**
 * 混合式查詢活動 (MVP)。
 * 1. Firestore 層級: city, district, time (範圍)。
 * 2. 記憶體層級: distanceKm (容差), remainingSeats。
 * @param {object} [filters] - 篩選條件。
 * @param {string} [filters.city] - 縣市。
 * @param {string} [filters.district] - 行政區。
 * @param {string} [filters.startTime] - 開始時間 (ISO)。
 * @param {string} [filters.endTime] - 結束時間 (ISO)。
 * @param {number|string} [filters.minDistance] - 最小距離。
 * @param {number|string} [filters.maxDistance] - 最大距離。
 * @param {boolean} [filters.hasSeatsOnly] - 是否只顯示有名額的活動。
 * @returns {Promise<object[]>} 符合條件的活動列表。
 */
export async function queryEvents(filters = {}) {
  const {
    city,
    district,
    startTime,
    endTime,
    minDistance,
    maxDistance,
    hasSeatsOnly,
  } = filters;

  const constraints = [collection(db, 'events')];

  // --- Stage 1: Firestore Queries (Time Range Only) ---
  // 為了避免複雜的複合索引問題 (如 city + time 索引)，我們將地點篩選移至記憶體 (Stage 2)
  // 這樣只需要 time 的單欄位索引即可運作。對於 MVP 資料量來說，這是可接受的折衷。

  // 時間篩選
  if (startTime) {
    constraints.push(where('time', '>=', Timestamp.fromDate(new Date(startTime))));
  }
  if (endTime) {
    constraints.push(where('time', '<=', Timestamp.fromDate(new Date(endTime))));
  }

  // 排序：預設依活動時間 (time) 由新到舊 (desc)
  constraints.push(orderBy('time', 'desc'));
  constraints.push(limit(50));

  const q = query(...constraints);
  const snap = await getDocs(q);
  let results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // --- Stage 2: In-Memory Filtering (Secondary Filters) ---

  // 0. 地點篩選 (精確比對)
  if (city) {
    results = results.filter((ev) => ev.city === city);
  }
  if (district) {
    results = results.filter((ev) => ev.district === district);
  }

  // 1. 距離篩選 (±0.5km 寬容度)
  if (minDistance !== undefined && minDistance !== '' && minDistance !== null) {
    const min = Number(minDistance) - 0.5;
    results = results.filter((ev) => Number(ev.distanceKm || 0) >= min);
  }
  if (maxDistance !== undefined && maxDistance !== '' && maxDistance !== null) {
    const max = Number(maxDistance) + 0.5;
    results = results.filter((ev) => Number(ev.distanceKm || 0) <= max);
  }

  // 2. 名額篩選
  if (hasSeatsOnly) {
    results = results.filter((ev) => {
      // 若資料庫沒存 remainingSeats (舊資料)，則用 max - count 計算
      const seats = typeof ev.remainingSeats === 'number'
        ? ev.remainingSeats
        : Number(ev.maxParticipants || 0) - Number(ev.participantsCount || 0);
      return seats > 0;
    });
  }

  return results;
}

/**
 * 取得單一活動（用 eventId 讀 events/{id}）。
 * @param {string} eventId - 活動 ID。
 * @returns {Promise<object|null>} 活動資料（包含 ID），若找不到則回傳 null。
 */
export async function fetchEventById(eventId) {
  if (!eventId) return null;

  const ref = doc(db, 'events', String(eventId));
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * 取得下一頁活動（依 createdAt 由新到舊）。
 * @param {import('firebase/firestore').QueryDocumentSnapshot} afterDoc - 上一頁最後一筆的 Snapshot（分頁游標）。
 * @param {number} [limitCount] - 一次取得幾筆資料。
 * @returns {Promise<{
 *   events: object[],
 *   lastDoc: import('firebase/firestore').QueryDocumentSnapshot|null
 * }>} 活動列表與分頁 cursor。
 */
export async function fetchNextEvents(afterDoc, limitCount = 10) {
  if (!afterDoc) {
    return { events: [], lastDoc: null };
  }

  const q = query(
    collection(db, 'events'),
    orderBy('createdAt', 'desc'),
    startAfter(afterDoc),
    limit(limitCount),
  );

  const snap = await getDocs(q);
  const events = snap.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));

  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { events, lastDoc };
}

// ====== 參加活動 / 退出活動（transaction，避免多人搶名額超賣） ======

/**
 * 參加活動。
 * - 於 events/{eventId}/participants/{uid} 建立參加者資料。
 * - 使用 Transaction 更新 remainingSeats 與 participantsCount。
 * @param {string} eventId - 活動 ID。
 * @param {object} user - 使用者物件。
 * @param {string} user.uid - 使用者 ID。
 * @param {string} [user.name] - 使用者名稱。
 * @param {string} [user.photoURL] - 使用者大頭貼。
 * @returns {Promise<{ok: boolean, status: 'joined'|'already_joined'|'full'}>} 執行結果。
 */
export async function joinEvent(eventId, user) {
  if (!eventId) throw new Error('joinEvent: eventId is required');
  if (!user?.uid) throw new Error('joinEvent: user.uid is required');

  const eid = String(eventId);
  const eventRef = doc(db, 'events', eid);
  const participantRef = doc(db, 'events', eid, 'participants', String(user.uid));

  const result = await runTransaction(db, async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error('活動不存在');
    }

    const eventData = eventSnap.data();

    const maxParticipants = Number(eventData.maxParticipants ?? 0);
    const participantsCount = Number(eventData.participantsCount ?? 0);

    // remainingSeats 若還沒建立（舊資料），用 maxParticipants - participantsCount 推導一次
    let { remainingSeats } = eventData;
    if (typeof remainingSeats !== 'number') {
      remainingSeats = Math.max(0, maxParticipants - participantsCount);
    }

    const pSnap = await tx.get(participantRef);
    if (pSnap.exists()) {
      return { ok: true, status: 'already_joined' };
    }

    if (remainingSeats <= 0) {
      return { ok: false, status: 'full' };
    }

    tx.set(participantRef, {
      uid: String(user.uid),
      name: String(user.name ?? ''),
      photoURL: String(user.photoURL ?? ''),
      eventId: eid,
      joinedAt: serverTimestamp(),
    });

    tx.update(eventRef, {
      remainingSeats: remainingSeats - 1,
      participantsCount: participantsCount + 1,
    });

    return { ok: true, status: 'joined' };
  });

  return result;
}

/**
 * 退出活動。
 * - 刪除 events/{eventId}/participants/{uid}。
 * - 使用 Transaction 更新 remainingSeats 與 participantsCount。
 * @param {string} eventId - 活動 ID。
 * @param {object} user - 使用者物件。
 * @param {string} user.uid - 使用者 ID。
 * @returns {Promise<{ok: boolean, status: 'left'|'not_joined'}>} 執行結果。
 */
export async function leaveEvent(eventId, user) {
  if (!eventId) throw new Error('leaveEvent: eventId is required');
  if (!user?.uid) throw new Error('leaveEvent: user.uid is required');

  const eid = String(eventId);
  const eventRef = doc(db, 'events', eid);
  const participantRef = doc(db, 'events', eid, 'participants', String(user.uid));

  const result = await runTransaction(db, async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error('活動不存在');
    }

    const eventData = eventSnap.data();

    const maxParticipants = Number(eventData.maxParticipants ?? 0);
    const participantsCount = Number(eventData.participantsCount ?? 0);

    let { remainingSeats } = eventData;
    if (typeof remainingSeats !== 'number') {
      remainingSeats = Math.max(0, maxParticipants - participantsCount);
    }

    const pSnap = await tx.get(participantRef);
    if (!pSnap.exists()) {
      return { ok: true, status: 'not_joined' };
    }

    tx.delete(participantRef);

    // 防呆：不讓 seats 超過 maxParticipants、count 變負
    const nextRemaining = Math.min(maxParticipants, remainingSeats + 1);
    const nextCount = Math.max(0, participantsCount - 1);

    tx.update(eventRef, {
      remainingSeats: nextRemaining,
      participantsCount: nextCount,
    });

    return { ok: true, status: 'left' };
  });

  return result;
}

/**
 * 取得某個活動的參加者名單。
 * @param {string} eventId - 活動 ID。
 * @param {number} [limitCount] - 最大回傳數量。
 * @returns {Promise<object[]>} 參加者列表 Array<{ uid, name, photoURL, eventId, joinedAt }>。
 */
export async function fetchParticipants(eventId, limitCount = 50) {
  if (!eventId) throw new Error('fetchParticipants: eventId is required');

  const eid = String(eventId);

  const q = query(
    collection(db, 'events', eid, 'participants'),
    orderBy('joinedAt', 'desc'),
    limit(limitCount),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/**
 * 取得「我在這批 eventIds 裡面哪些已經參加」。
 * 用意：events 列表一次抓 10 筆活動時，避免 N+1 查詢。
 * @param {string} uid - 使用者 ID。
 * @param {string[]} eventIds - 活動 ID 列表。
 * @returns {Promise<Set<string>>} 已參加的 eventId 集合。
 */
export async function fetchMyJoinedEventsForIds(uid, eventIds) {
  if (!uid) return new Set();
  if (!Array.isArray(eventIds) || eventIds.length === 0) return new Set();

  // 最多只查 30 個（你的 events 列表一次也才 10 個，綽綽有餘）
  const ids = eventIds.slice(0, 30).map(String);

  // ✅ 不用 collectionGroup：直接讀 events/{eventId}/participants/{uid}
  // 這樣規則只需要管 events/{eventId}/participants/{uid} 這條路徑就好，避免 collectionGroup 權限/索引問題。
  const snaps = await Promise.all(
    ids.map((eid) => getDoc(doc(db, 'events', eid, 'participants', String(uid)))),
  );

  const joined = new Set();
  snaps.forEach((snap, idx) => {
    if (snap.exists()) joined.add(ids[idx]);
  });

  return joined;
}
