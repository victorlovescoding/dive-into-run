'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './Toast.module.css';

/**
 * @typedef {'success' | 'error' | 'info'} ToastType
 */

/**
 * @typedef {object} ToastItemAction
 * @property {string} label - 顯示在 action 按鈕上的文字。
 * @property {() => void} callback - 使用者點擊 action 時執行的回呼。
 */

/**
 * @typedef {object} ToastItem
 * @property {string} id - 唯一識別碼。
 * @property {string} message - 顯示給使用者的訊息文字。
 * @property {ToastType} type - Toast 等級，決定視覺樣式與 ARIA role。
 * @property {number} createdAt - 建立時間戳。
 * @property {ToastItemAction} [action] - 可選的單一 toast 操作，例如復原。
 * @property {ToastItemAction[]} [actions] - 可選的多個 toast 操作。
 */

/** @type {number} 自動消失延遲（毫秒）。 */
const AUTO_DISMISS_MS = 3000;
/** @type {number} 有操作按鈕時的自動消失延遲（毫秒）。 */
const ACTION_AUTO_DISMISS_MS = 8000;

/**
 * 根據 toast type 回傳對應的 ARIA role。
 * @param {ToastType} type - Toast 類型。
 * @returns {'alert' | 'status'} ARIA role 字串。
 */
function getAriaRole(type) {
  return type === 'error' ? 'alert' : 'status';
}

/**
 * 單一 Toast 通知元件。
 * @param {object} props - 元件屬性。
 * @param {ToastItem} props.toast - Toast 資料。
 * @param {(id: string) => void} props.onClose - 關閉回呼。
 * @returns {import('react').ReactElement} Toast 元件。
 */
export default function Toast({ toast, onClose }) {
  const { id, message, type, action, actions } = toast;
  const renderedActions = actions?.length ? actions : action ? [action] : [];
  const autoDismissMs =
    renderedActions.length > 0 ? ACTION_AUTO_DISMISS_MS : AUTO_DISMISS_MS;

  const [animState, setAnimState] = useState('entering');

  // 進入動畫：mount 後切換到 visible
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setAnimState('visible');
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleClose = useCallback(() => {
    onClose(id);
  }, [id, onClose]);

  // 自動消失：success/info 會自動關閉；有操作按鈕時給使用者更長反應時間。
  useEffect(() => {
    if (type === 'error') return undefined;

    const timerId = setTimeout(() => {
      handleClose();
    }, autoDismissMs);

    return () => clearTimeout(timerId);
  }, [type, handleClose, autoDismissMs]);

  const className = [styles.toast, styles[type], styles[animState]].join(' ');

  return (
    <div className={className} role={getAriaRole(type)}>
      <span className={styles.message}>{message}</span>
      {renderedActions.map((toastAction) => (
        <button
          key={toastAction.label}
          type="button"
          className={styles.actionButton}
          onClick={() => {
            toastAction.callback();
          }}
        >
          {toastAction.label}
        </button>
      ))}
      <button
        type="button"
        className={styles.closeButton}
        aria-label="關閉通知"
        onClick={handleClose}
      >
        &times;
      </button>
    </div>
  );
}
