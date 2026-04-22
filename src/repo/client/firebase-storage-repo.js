import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/client/firebase-client';

/**
 * 建立使用者大頭貼的 Firebase Storage ref。
 * @param {string} uid - 使用者 UID。
 * @returns {import('firebase/storage').StorageReference} Storage ref。
 */
export function getUserAvatarStorageRef(uid) {
  return ref(storage, `users/${uid}/avatar.png`);
}

/**
 * 上傳大頭貼 blob 到 Firebase Storage。
 * @param {import('firebase/storage').StorageReference} storageRef - 目標 storage ref。
 * @param {Blob} blob - 壓縮後的圖片 blob。
 * @returns {Promise<import('firebase/storage').UploadResult>} 上傳結果。
 */
export function uploadAvatarBlob(storageRef, blob) {
  return uploadBytes(storageRef, blob, { contentType: 'image/png' });
}

/**
 * 取得 Firebase Storage 下載網址。
 * @param {import('firebase/storage').StorageReference} storageRef - 目標 storage ref。
 * @returns {Promise<string>} 下載網址。
 */
export function getAvatarDownloadUrl(storageRef) {
  return getDownloadURL(storageRef);
}
