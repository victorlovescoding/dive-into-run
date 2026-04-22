'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { usePathname } from 'next/navigation';

const MAX_TOASTS = 5;

/**
 * @typedef {object} ToastItem
 * @property {string} id - 唯一識別碼。
 * @property {string} message - 顯示訊息。
 * @property {'success' | 'error' | 'info'} type - Toast 類型。
 * @property {number} createdAt - 建立時間戳。
 */

/**
 * @typedef {object} ToastAction
 * @property {'ADD' | 'REMOVE' | 'CLEAR_ALL'} type - Action 類型。
 * @property {ToastItem | string} [payload] - Action 資料（ADD 為 ToastItem，REMOVE 為 id）。
 */

/**
 * @typedef {object} ToastContextValue
 * @property {ToastItem[]} toasts - 目前的 toast 佇列。
 * @property {(message: string, type?: 'success' | 'error' | 'info') => void} showToast - 新增 toast。
 * @property {(id: string) => void} removeToast - 移除指定 toast。
 */

export const ToastContext = /** @type {import('react').Context<ToastContextValue | undefined>} */ (
  createContext(undefined)
);

/**
 * Toast 佇列的 reducer。
 * @param {ToastItem[]} state - 目前佇列。
 * @param {ToastAction} action - 要處理的 action。
 * @returns {ToastItem[]} 新佇列。
 */
export function toastReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const next = [...state, /** @type {ToastItem} */ (action.payload)];
      return next.length > MAX_TOASTS ? next.slice(1) : next;
    }
    case 'REMOVE':
      return state.filter((t) => t.id !== /** @type {string} */ (action.payload));
    case 'CLEAR_ALL':
      return [];
    default:
      return state;
  }
}

/**
 * 提供 Toast 通知功能的 Context Provider。
 * @param {object} props - 元件 props。
 * @param {import('react').ReactNode} props.children - 子元件。
 * @returns {import('react').ReactElement} ToastContext Provider。
 */
export default function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const pathname = usePathname();

  useEffect(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, [pathname]);

  const showToast = useCallback(
    /**
     * 新增一筆 toast 通知。
     * @param {string} message - 顯示訊息。
     * @param {'success' | 'error' | 'info'} [type] - Toast 類型，預設 'success'。
     */
    (message, type = 'success') => {
      /** @type {ToastItem} */
      const toast = {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        message,
        type,
        createdAt: Date.now(),
      };
      dispatch({ type: 'ADD', payload: toast });
    },
    [],
  );

  const removeToast = useCallback(
    /**
     * 移除指定 id 的 toast。
     * @param {string} id - 要移除的 toast id。
     */
    (id) => {
      dispatch({ type: 'REMOVE', payload: id });
    },
    [],
  );

  const value = useMemo(
    () => ({ toasts, showToast, removeToast }),
    [toasts, showToast, removeToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * 取得 Toast context 的 custom hook。
 * @returns {ToastContextValue} Toast context value。
 * @throws {Error} 在 ToastProvider 外使用時拋出錯誤。
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
