/**
 * @typedef {object} BuildCommentEditHistoryPayloadOptions
 * @property {string} newText - 使用者輸入的新留言文字，會先 trim。
 * @property {string} oldText - 目前已儲存、即將被 history 保存的留言文字。
 * @property {string} currentTextField - 主留言文件保存目前文字的欄位名稱。
 * @property {unknown} updatedAtValue - 由 runtime 注入的 editedAt/updatedAt 值。
 * @property {string} [fieldLabel] - 驗證錯誤訊息使用的欄位名稱。
 * @property {string} [functionName] - 驗證錯誤訊息使用的呼叫函式名稱。
 * @property {number} [maxLength] - trim 後新文字的最大允許長度。
 */

/**
 * 建立留言編輯 transaction 需要的 history payload 與主文件更新 payload。
 * @param {BuildCommentEditHistoryPayloadOptions} options - payload 生成選項。
 * @returns {{ historyPayload: object, commentUpdate: object }} transaction payload。
 */
export default function buildCommentEditHistoryPayload({
  newText,
  oldText,
  currentTextField,
  updatedAtValue,
  fieldLabel = 'content',
  functionName = 'updateComment',
  maxLength,
}) {
  const trimmed = (newText ?? '').trim();

  if (!trimmed) {
    throw new Error(`${functionName}: ${fieldLabel} is required`);
  }

  if (typeof maxLength === 'number' && trimmed.length > maxLength) {
    throw new Error(`${functionName}: ${fieldLabel} exceeds ${maxLength} characters`);
  }

  if (trimmed === oldText) {
    throw new Error(`${functionName}: content unchanged`);
  }

  return {
    historyPayload: {
      content: oldText,
      editedAt: updatedAtValue,
    },
    commentUpdate: {
      [currentTextField]: trimmed,
      updatedAt: updatedAtValue,
      isEdited: true,
    },
  };
}
