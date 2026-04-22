// 這個檔案專門處理 Firebase Storage 相關操作（大頭貼壓縮上傳、下載網址取得）
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/client/firebase-client';

// 把拿到的檔案壓縮並且傳到Storage，最後呼叫 getDownloadURL(ref) 拿到檔案的網址
/**
 * 壓縮並上傳使用者大頭貼至 Firebase Storage，回傳附帶快取破壞參數的下載網址。
 * @param {File} file - 使用者選取的圖片檔案。
 * @param {string} uid - 使用者 UID。
 * @returns {Promise<string>} 含快取破壞參數的圖片下載網址。
 */
export async function uploadUserAvatar(file, uid) {
  // File解碼成bitmap
  const imageBitmap = await window.createImageBitmap(file);
  // 用ImageBitmap來把圖片畫到canvas上
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const maxSize = 512;
  const originWidth = imageBitmap.width;
  const originHeight = imageBitmap.height;
  let targetWidth = originWidth;
  let targetHeight = originHeight;
  // 如果大於 maxSize，就等比例縮小
  if (originWidth > originHeight) {
    if (originWidth > maxSize) {
      targetWidth = maxSize;
      targetHeight = Math.round(originHeight * (maxSize / originWidth));
    }
  } else if (originHeight > maxSize) {
    targetHeight = maxSize;
    targetWidth = Math.round(originWidth * (maxSize / originHeight));
  }
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  // 壓縮畫質
  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  // 轉回去blob並且壓縮檔案來暫存
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b)
        resolve(b); // 成功 → 把結果交給 resolve
      else reject(new Error('toBlob 失敗')); // 失敗 → 交給 reject
    });
  });
  // 固定檔名覆蓋，避免累積舊檔
  const storageRef = ref(storage, `users/${uid}/avatar.png`);
  // 先確保上傳完成，再取下載網址
  await uploadBytes(storageRef, blob, { contentType: 'image/png' });
  console.warn('Uploaded a blob or file!');
  const url = await getDownloadURL(storageRef);
  // 加版本參數，擊穿瀏覽器/CDN 快取
  const bustUrl = `${url + (url.includes('?') ? '&' : '?')}v=${Date.now()}`;
  return bustUrl;
}
