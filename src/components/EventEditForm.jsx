/**
 * @file EventEditForm Component (Stub — TDD RED phase)
 * @description Placeholder for the event edit form.
 * Will be implemented after tests are verified as RED.
 */

/**
 * @typedef {import('@/lib/event-helpers').EventData} EventData
 */

/**
 * @typedef {object} EventEditFormProps
 * @property {EventData} event - 要編輯的活動資料（用於預填表單）。
 * @property {(data: object) => void | Promise<void>} onSubmit - 提交更新資料的回呼。
 * @property {() => void} onCancel - 取消編輯的回呼。
 * @property {boolean} [isSubmitting] - 是否正在送出更新中。
 */

/**
 * EventEditForm — stub for TDD.
 * @param {EventEditFormProps} _props - Component props.
 * @returns {null} Nothing rendered yet.
 */
export default function EventEditForm(_props) {
  return null;
}
