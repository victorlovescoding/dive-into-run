/**
 * @file EventCardMenu Component (Stub — TDD RED phase)
 * @description Placeholder for the three-dot menu on event cards.
 * Will be implemented after tests are verified as RED.
 */

/**
 * @typedef {import('@/lib/event-helpers').EventData} EventData
 */

/**
 * @typedef {object} EventCardMenuProps
 * @property {EventData} event - 活動資料。
 * @property {string|null} currentUserUid - 目前登入使用者的 UID，未登入為 null。
 * @property {(ev: EventData) => void} onEdit - 點擊「編輯活動」的回呼。
 * @property {(ev: EventData) => void} onDelete - 點擊「刪除活動」的回呼。
 */

/**
 * EventCardMenu — stub for TDD.
 * @param {EventCardMenuProps} _props - Component props.
 * @returns {null} Nothing rendered yet.
 */
export default function EventCardMenu(_props) {
  return null;
}
