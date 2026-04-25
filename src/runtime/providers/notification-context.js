import { createContext, useContext } from 'react';

/**
 * @typedef {object} NotificationContextValue
 * @property {number} unreadCount - 未讀通知數量。
 * @property {import('@/service/notification-service').NotificationItem[]} notifications - 目前顯示的通知列表。
 * @property {boolean} isPanelOpen - 通知面板是否開啟。
 * @property {() => void} togglePanel - 切換面板開關。
 * @property {() => void} closePanel - 關閉面板。
 * @property {'all'|'unread'} activeTab - 目前分頁標籤。
 * @property {(tab: 'all'|'unread') => void} setActiveTab - 切換分頁。
 * @property {(notificationId: string) => Promise<void>} markAsRead - 標記單則通知已讀。
 * @property {boolean} hasMore - 是否有更多通知可載入。
 * @property {boolean} isLoadingMore - 是否正在載入更多。
 * @property {boolean} hasLoadedMore - 是否已執行過查看先前通知。
 * @property {() => Promise<void>} loadMore - 載入更多通知。
 * @property {{ id: string, message: string } | null} currentToast - 目前顯示的 toast。
 * @property {import('react').RefObject<HTMLButtonElement | null>} bellButtonRef - 鈴鐺按鈕 ref，用於 focus restore。
 */

/** @type {NotificationContextValue} */
const defaultValue = {
  unreadCount: 0,
  notifications: [],
  isPanelOpen: false,
  togglePanel: () => {},
  activeTab: 'all',
  setActiveTab: () => {},
  closePanel: () => {},
  markAsRead: async () => {},
  hasMore: false,
  isLoadingMore: false,
  hasLoadedMore: false,
  loadMore: async () => {},
  currentToast: null,
  bellButtonRef: { current: null },
};

export const NotificationContext =
  /** @type {import('react').Context<NotificationContextValue>} */ (createContext(defaultValue));

/**
 * 取得 NotificationContext 的便利 hook，避免重複 useContext 呼叫。
 * @returns {NotificationContextValue} 目前的通知 context value。
 */
export function useNotificationContext() {
  return useContext(NotificationContext);
}

export { defaultValue as notificationDefaultValue };
