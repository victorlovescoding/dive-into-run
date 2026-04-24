/**
 * 發送 CWA API 請求並回傳原始 JSON。
 * @param {string} url - 完整 CWA API URL。
 * @returns {Promise<object>} CWA JSON payload。
 */
async function requestCwaJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CWA request returned ${response.status}`);
  }

  return response.json();
}

/**
 * 發送 EPA AQI API 請求並回傳原始 JSON。
 * @param {string} url - 完整 EPA API URL。
 * @returns {Promise<object>} EPA JSON payload。
 */
async function requestEpaJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EPA AQI request returned ${response.status}`);
  }

  return response.json();
}

export { requestCwaJson, requestEpaJson };
