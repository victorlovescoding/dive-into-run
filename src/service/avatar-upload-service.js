export const AVATAR_MAX_SIZE = 512;

/**
 * 根據原始圖片尺寸，計算壓到最大邊後的輸出尺寸。
 * @param {number} width - 原始寬度。
 * @param {number} height - 原始高度。
 * @param {number} [maxSize] - 最大邊長。
 * @returns {{ width: number, height: number }} 輸出尺寸。
 */
export function resolveAvatarImageSize(width, height, maxSize = AVATAR_MAX_SIZE) {
  let targetWidth = width;
  let targetHeight = height;

  if (width > height) {
    if (width > maxSize) {
      targetWidth = maxSize;
      targetHeight = Math.round(height * (maxSize / width));
    }
  } else if (height > maxSize) {
    targetHeight = maxSize;
    targetWidth = Math.round(width * (maxSize / height));
  }

  return { width: targetWidth, height: targetHeight };
}

/**
 * 對 Storage 下載網址附加 cache-bust 參數。
 * @param {string} url - 原始下載網址。
 * @param {number} version - 版本戳記。
 * @returns {string} 含 cache-bust 參數的網址。
 */
export function appendCacheBust(url, version) {
  return `${url}${url.includes('?') ? '&' : '?'}v=${version}`;
}
