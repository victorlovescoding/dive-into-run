import {
  AVATAR_MAX_SIZE,
  resolveAvatarImageSize,
  appendCacheBust,
} from '@/service/avatar-upload-service';
import {
  getUserAvatarStorageRef,
  uploadAvatarBlob,
  getAvatarDownloadUrl,
} from '@/repo/client/firebase-storage-repo';

/**
 * 使用 browser APIs 產生壓縮後的 avatar blob。
 * browser side effects 留在 runtime，不下沉到 service/repo。
 * @param {File} file - 使用者選取的圖片檔案。
 * @returns {Promise<Blob>} 壓縮後的 PNG blob。
 */
export async function createCompressedAvatarBlob(file) {
  const imageBitmap = await window.createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('canvas context 取得失敗');
  }

  const { width, height } = resolveAvatarImageSize(
    imageBitmap.width,
    imageBitmap.height,
    AVATAR_MAX_SIZE,
  );

  canvas.width = width;
  canvas.height = height;
  context.drawImage(imageBitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('toBlob 失敗'));
    }, 'image/png');
  });
}

/**
 * 壓縮並上傳使用者大頭貼至 Firebase Storage，回傳附帶快取破壞參數的下載網址。
 * @param {File} file - 使用者選取的圖片檔案。
 * @param {string} uid - 使用者 UID。
 * @returns {Promise<string>} 含快取破壞參數的圖片下載網址。
 */
export async function uploadUserAvatar(file, uid) {
  const blob = await createCompressedAvatarBlob(file);
  const storageRef = getUserAvatarStorageRef(uid);

  await uploadAvatarBlob(storageRef, blob);
  const url = await getAvatarDownloadUrl(storageRef);

  return appendCacheBust(url, Date.now());
}
