/**
 * @typedef {object} EditHistoryField
 * @property {string} newText - 使用者輸入的新文字，會先 trim。
 * @property {string} oldText - 目前已儲存、即將被 history 保存的文字。
 * @property {string} currentTextField - 主文件保存目前文字的欄位名稱。
 * @property {string} [historyTextField] - history 文件保存舊文字的欄位名稱。
 * @property {string} [fieldLabel] - 驗證錯誤訊息使用的欄位名稱。
 * @property {number} [maxLength] - trim 後新文字的最大允許長度。
 */

/**
 * @typedef {object} BuildEditHistoryPayloadOptions
 * @property {EditHistoryField[]} fields - 要保存 history 與更新主文件的文字欄位。
 * @property {unknown} updatedAtValue - 由 runtime 注入的 editedAt/updatedAt 值。
 * @property {string} [functionName] - 驗證錯誤訊息使用的呼叫函式名稱。
 * @property {string} [unchangedMessage] - 所有欄位未變更時的錯誤訊息。
 */

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
 * 建立通用編輯 transaction 需要的 history payload 與主文件更新 payload。
 * @param {BuildEditHistoryPayloadOptions} options - payload 生成選項。
 * @returns {{ historyPayload: object, updatePayload: object }} transaction payload。
 */
export function buildEditHistoryPayload({
  fields,
  updatedAtValue,
  functionName = 'updateResource',
  unchangedMessage = 'content unchanged',
}) {
  /** @type {Record<string, unknown>} */
  const historyPayload = {};
  /** @type {Record<string, unknown>} */
  const updatePayload = {};
  let hasChangedField = false;

  for (const field of fields) {
    const {
      newText,
      oldText,
      currentTextField,
      historyTextField = currentTextField,
      fieldLabel = currentTextField,
      maxLength,
    } = field;
    const trimmed = (newText ?? '').trim();

    if (!trimmed) {
      throw new Error(`${functionName}: ${fieldLabel} is required`);
    }

    if (typeof maxLength === 'number' && trimmed.length > maxLength) {
      throw new Error(`${functionName}: ${fieldLabel} exceeds ${maxLength} characters`);
    }

    if (trimmed !== oldText) {
      hasChangedField = true;
    }

    historyPayload[historyTextField] = oldText;
    updatePayload[currentTextField] = trimmed;
  }

  if (!hasChangedField) {
    throw new Error(`${functionName}: ${unchangedMessage}`);
  }

  historyPayload.editedAt = updatedAtValue;
  updatePayload.updatedAt = updatedAtValue;
  updatePayload.isEdited = true;

  return {
    historyPayload,
    updatePayload,
  };
}

/**
 * 建立留言編輯 transaction 需要的 history payload 與主文件更新 payload。
 * @param {BuildCommentEditHistoryPayloadOptions} options - payload 生成選項。
 * @returns {{ historyPayload: object, commentUpdate: object }} transaction payload。
 */
function buildCommentEditHistoryPayload({
  newText,
  oldText,
  currentTextField,
  updatedAtValue,
  fieldLabel = 'content',
  functionName = 'updateComment',
  maxLength,
}) {
  const { historyPayload, updatePayload } = buildEditHistoryPayload({
    fields: [
      {
        newText,
        oldText,
        currentTextField,
        historyTextField: 'content',
        fieldLabel,
        maxLength,
      },
    ],
    updatedAtValue,
    functionName,
    unchangedMessage: 'content unchanged',
  });

  return {
    historyPayload,
    commentUpdate: updatePayload,
  };
}

export default buildCommentEditHistoryPayload;
