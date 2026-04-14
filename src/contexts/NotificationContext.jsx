'use client';

import {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { ToastContext } from '@/contexts/ToastContext';
import {
  watchNotifications,
  watchUnreadNotifications,
  markNotificationAsRead,
  fetchMoreNotifications,
} from '@/lib/firebase-notifications';

/**
 * @typedef {object} NotificationContextValue
 * @property {number} unreadCount - 未讀通知數量。
 * @property {import('@/lib/notification-helpers').NotificationItem[]} notifications - 目前顯示的通知列表。
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
};

export const NotificationContext =
  /** @type {import('react').Context<NotificationContextValue>} */ (createContext(defaultValue));

/**
 * 提供通知狀態的 Context Provider。
 * @param {object} props - 元件 props。
 * @param {import('react').ReactNode} props.children - 子元件。
 * @returns {import('react').ReactElement} NotificationContext Provider。
 */
export default function NotificationProvider({ children }) {
  // State
  const [unreadNotifications, setUnreadNotifications] = useState(
    /** @type {import('@/lib/notification-helpers').NotificationItem[]} */ ([]),
  );
  const [notifications, setNotifications] = useState(
    /** @type {import('@/lib/notification-helpers').NotificationItem[]} */ ([]),
  );
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(/** @type {'all'|'unread'} */ ('all'));
  const [extraNotifications, setExtraNotifications] = useState(
    /** @type {import('@/lib/notification-helpers').NotificationItem[]} */ ([]),
  );
  const [lastDoc, setLastDoc] = useState(
    /** @type {import('firebase/firestore').QueryDocumentSnapshot | null} */ (null),
  );
  const [hasMoreAll, setHasMoreAll] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  const [toastQueue, setToastQueue] = useState(
    /** @type {{ id: string, message: string }[]} */ ([]),
  );
  const [currentToast, setCurrentToast] = useState(
    /** @type {{ id: string, message: string } | null} */ (null),
  );

  // Context
  const { user } = useContext(AuthContext);
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast;

  // Refs
  const isPanelOpenRef = useRef(false);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  // 同步 ref 以避免 onSnapshot callback 的 closure 過期
  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen;
  }, [isPanelOpen]);

  // 設定 / 清除通知 listeners，依 user 變化
  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const unsubUnread = watchUnreadNotifications(
      user.uid,
      (items) => {
        setUnreadNotifications(items);
      },
      (err) => {
        console.error('watchUnreadNotifications error:', err);
        showToastRef.current?.('通知載入失敗', 'error');
      },
    );

    const unsubAll = watchNotifications(
      user.uid,
      (items, rawLastDoc) => {
        setNotifications(items);
        if (rawLastDoc) setLastDoc(rawLastDoc);
        setHasMoreAll(items.length >= 5);
      },
      (err) => {
        console.error('watchNotifications error:', err);
        showToastRef.current?.('通知載入失敗', 'error');
      },
      (newNotifications) => {
        if (isPanelOpenRef.current) return;

        const toasts = newNotifications.map((n) => ({
          id: n.id || String(Date.now()),
          message: n.message,
        }));
        setToastQueue((prev) => [...prev, ...toasts]);
      },
    );

    return () => {
      unsubUnread();
      unsubAll();
      setUnreadNotifications([]);
      setNotifications([]);
      setIsPanelOpen(false);
      setExtraNotifications([]);
      setHasMoreAll(false);
      setHasLoadedMore(false);
    };
  }, [user]);

  // Toast dequeue — 當無 currentToast 且 queue 有項目時，取出下一則
  useEffect(() => {
    if (currentToast || toastQueue.length === 0) return;

    const [next, ...rest] = toastQueue;
    setCurrentToast(next);
    setToastQueue(rest);
  }, [currentToast, toastQueue]);

  // Toast auto-dismiss — currentToast 顯示 5 秒後自動清除
  useEffect(() => {
    if (!currentToast) return undefined;

    const timer = setTimeout(() => {
      setCurrentToast(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [currentToast]);

  // Handlers
  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const markAsRead = useCallback(
    /**
     * 標記單則通知已讀（含 optimistic update）。
     * @param {string} notificationId - 通知 ID。
     * @returns {Promise<void>}
     */
    async (notificationId) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      setUnreadNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      await markNotificationAsRead(notificationId);
    },
    [],
  );

  const displayedNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return unreadNotifications.slice(0, 5);
    }
    return [...notifications, ...extraNotifications];
  }, [activeTab, notifications, unreadNotifications, extraNotifications]);

  const hasMore = useMemo(() => {
    if (activeTab === 'unread') {
      return false;
    }
    return hasMoreAll;
  }, [activeTab, hasMoreAll]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !user || !lastDoc) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchMoreNotifications(user.uid, lastDoc, 5);
      setExtraNotifications((prev) => [...prev, ...result.notifications]);
      if (result.lastDoc) setLastDoc(result.lastDoc);
      if (result.notifications.length < 5) setHasMoreAll(false);
      setHasLoadedMore(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, user, lastDoc]);

  const value = useMemo(
    () => ({
      unreadCount: unreadNotifications.length,
      notifications: displayedNotifications,
      isPanelOpen,
      activeTab,
      setActiveTab,
      togglePanel,
      closePanel,
      markAsRead,
      hasMore,
      isLoadingMore,
      hasLoadedMore,
      loadMore,
      currentToast,
    }),
    [
      unreadNotifications.length,
      displayedNotifications,
      isPanelOpen,
      activeTab,
      togglePanel,
      closePanel,
      markAsRead,
      hasMore,
      isLoadingMore,
      hasLoadedMore,
      loadMore,
      currentToast,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
