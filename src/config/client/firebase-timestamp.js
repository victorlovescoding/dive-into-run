import { Timestamp } from 'firebase/firestore';

/**
 * 建立 Firestore Timestamp，讓 UI/runtime 層不需直接依賴 Firebase SDK。
 * @param {Date} value - 要轉換的日期物件。
 * @returns {Timestamp} Firestore Timestamp。
 */
export function createFirestoreTimestamp(value) {
  return Timestamp.fromDate(value);
}

/**
 * 取得目前時間的 Firestore Timestamp。
 * @returns {Timestamp} 目前時間戳記。
 */
export function getCurrentFirestoreTimestamp() {
  return Timestamp.now();
}
