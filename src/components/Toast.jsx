'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './Toast.module.css';

/**
 * @typedef {'success' | 'error' | 'info'} ToastType
 */

/**
 * @typedef {object} ToastItem
 * @property {string} id - 唯一識別碼。
 * @property {string} message - 顯示給使用者的訊息文字。
 * @property {ToastType} type - Toast 等級，決定視覺樣式與 ARIA role。
 * @property {number} createdAt - 建立時間戳。
 */

/** @type {number} 自動消失延遲（毫秒）。 */
const AUTO_DISMISS_MS = 3000;

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
  const { id, message, type } = toast;

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

  // 自動消失：success/info 3 秒後呼叫 onClose
  useEffect(() => {
    if (type === 'error') return undefined;

    const timerId = setTimeout(() => {
      handleClose();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timerId);
  }, [type, handleClose]);

  const className = [styles.toast, styles[type], styles[animState]].join(' ');

  return (
    <div className={className} role={getAriaRole(type)}>
      <span className={styles.message}>{message}</span>
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
