import {
  doc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';

/**
 * @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot
 */

/**
 * @typedef {object} StravaConnection
 * @property {boolean} connected - 是否已連結 Strava。
 * @property {number} athleteId - Strava 運動員 ID。
 * @property {string} athleteName - Strava 運動員名稱。
 * @property {import('firebase/firestore').Timestamp} connectedAt - 連結時間。
 * @property {import('firebase/firestore').Timestamp|null} lastSyncAt - 最後同步時間。
 */

/**
 * @typedef {object} StravaActivity
 * @property {string} id - Firestore 文件 ID。
 * @property {string} uid - 使用者 UID。
 * @property {number} stravaId - Strava 活動 ID。
 * @property {string} name - 活動名稱。
 * @property {string} type - 活動類型。
 * @property {number} distanceMeters - 距離（公尺）。
 * @property {number} movingTimeSec - 移動時間（秒）。
 * @property {import('firebase/firestore').Timestamp} startDate - 開始時間。
 * @property {string} startDateLocal - 當地開始時間字串。
 * @property {string|null} summaryPolyline - 路線概要 polyline。
 * @property {number} averageSpeed - 平均速度。
 * @property {import('firebase/firestore').Timestamp} syncedAt - 同步時間。
 */

/**
 * 即時監聽使用者的 Strava 連結狀態（`stravaConnections/{uid}`）。
 * @param {string} uid - 使用者 UID。
 * @param {(data: StravaConnection|null) => void} callback - 資料更新時的回呼，文件不存在時傳入 null。
 * @returns {() => void} 取消訂閱的函式。
 */
export function listenStravaConnection(uid, callback) {
  const docRef = doc(db, 'stravaConnections', uid);

  const unsub = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback(/** @type {StravaConnection} */ (snap.data()));
      } else {
        callback(null);
      }
    },
    () => {
      callback(null);
    },
  );

  return unsub;
}

/**
 * 查詢使用者的 Strava 活動（`stravaActivities` where `uid==uid`，依 `startDate` 降冪排序）。
 * @param {string} uid - 使用者 UID。
 * @param {number} pageSize - 每頁筆數。
 * @param {QueryDocumentSnapshot} [lastDoc] - 分頁游標，傳入上一頁最後一筆的 snapshot。
 * @returns {Promise<{ activities: StravaActivity[], lastDoc: QueryDocumentSnapshot|null }>} 活動列表與分頁游標。
 */
export async function getStravaActivities(uid, pageSize, lastDoc) {
  const collRef = collection(db, 'stravaActivities');

  const q = lastDoc
    ? query(
        collRef,
        where('uid', '==', uid),
        orderBy('startDate', 'desc'),
        startAfter(lastDoc),
        limit(pageSize),
      )
    : query(collRef, where('uid', '==', uid), orderBy('startDate', 'desc'), limit(pageSize));
  const snap = await getDocs(q);

  const activities = /** @type {StravaActivity[]} */ (
    snap.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    }))
  );

  const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return { activities, lastDoc: newLastDoc };
}

/**
 * 查詢指定月份的 Strava 跑步活動。
 * @param {string} uid - 使用者 UID。
 * @param {number} year - 年份。
 * @param {number} month - 月份（0-11）。
 * @returns {Promise<StravaActivity[]>} 該月份的活動列表。
 */
export async function getStravaActivitiesByMonth(uid, year, month) {
  const monthStart = Timestamp.fromDate(new Date(year, month, 1));
  const nextMonthStart = Timestamp.fromDate(new Date(year, month + 1, 1));
  const collRef = collection(db, 'stravaActivities');

  const q = query(
    collRef,
    where('uid', '==', uid),
    where('startDate', '>=', monthStart),
    where('startDate', '<', nextMonthStart),
    orderBy('startDate', 'desc'),
  );
  const snap = await getDocs(q);

  return /** @type {StravaActivity[]} */ (
    snap.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    }))
  );
}
