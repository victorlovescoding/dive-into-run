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
import {
  fetchMoreNotifications,
  fetchMoreUnreadNotifications,
  markNotificationAsRead,
  watchNotifications,
  watchUnreadNotifications,
} from '@/runtime/client/use-cases/notification-use-cases';
import { AuthContext } from './AuthProvider';
import { ToastContext } from './ToastProvider';

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
 * 將 Firestore Timestamp 或 JS Date 轉為毫秒數，用於排序比較。
 * @param {import('firebase/firestore').Timestamp | Date | null | undefined} ts - 時間戳記。
 * @returns {number} 毫秒數，無法取得時回傳 0。
 */
function toMillis(ts) {
  if (!ts) return 0;
  if ('toMillis' in ts && typeof ts.toMillis === 'function') {
    return /** @type {import('firebase/firestore').Timestamp} */ (ts).toMillis();
  }
  if (ts instanceof Date) {
    return ts.getTime();
  }
  return 0;
}

/**
 * 提供通知狀態的 Context Provider。
 * @param {object} props - 元件 props。
 * @param {import('react').ReactNode} props.children - 子元件。
 * @returns {import('react').ReactElement} NotificationContext Provider。
 */
export default function NotificationProvider({ children }) {
  const [unreadNotifications, setUnreadNotifications] = useState(
    /** @type {import('@/service/notification-service').NotificationItem[]} */ ([]),
  );
  const [notificationsMap, setNotificationsMap] = useState(
    /** @type {Map<string, import('@/service/notification-service').NotificationItem>} */ (
      new Map()
    ),
  );
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(/** @type {'all'|'unread'} */ ('all'));
  const [listenerCursor, setListenerCursor] = useState(
    /** @type {import('firebase/firestore').QueryDocumentSnapshot | null} */ (null),
  );
  const [paginationCursor, setPaginationCursor] = useState(
    /** @type {import('firebase/firestore').QueryDocumentSnapshot | null} */ (null),
  );
  const [hasMoreAll, setHasMoreAll] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoadedMoreAll, setHasLoadedMoreAll] = useState(false);
  const [hasLoadedMoreUnread, setHasLoadedMoreUnread] = useState(false);
  const [unreadDisplayCount, setUnreadDisplayCount] = useState(5);
  const [unreadListenerCursor, setUnreadListenerCursor] = useState(
    /** @type {import('firebase/firestore').QueryDocumentSnapshot | null} */ (null),
  );
  const [unreadPaginationCursor, setUnreadPaginationCursor] = useState(
    /** @type {import('firebase/firestore').QueryDocumentSnapshot | null} */ (null),
  );
  const [unreadServerExhausted, setUnreadServerExhausted] = useState(false);
  const [extraUnreadNotifications, setExtraUnreadNotifications] = useState(
    /** @type {import('@/service/notification-service').NotificationItem[]} */ ([]),
  );
  const [toastQueue, setToastQueue] = useState(
    /** @type {{ id: string, message: string }[]} */ ([]),
  );
  const [currentToast, setCurrentToast] = useState(
    /** @type {{ id: string, message: string } | null} */ (null),
  );

  const { user } = useContext(AuthContext);
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast;

  const bellButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const isPanelOpenRef = useRef(false);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen;
  }, [isPanelOpen]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const unsubUnread = watchUnreadNotifications(
      user.uid,
      (items, lastDoc) => {
        setUnreadNotifications(items);
        if (lastDoc) setUnreadListenerCursor(lastDoc);
      },
      (err) => {
        console.error('watchUnreadNotifications error:', err);
        showToastRef.current?.('通知載入失敗', 'error');
      },
    );

    const unsubAll = watchNotifications(
      user.uid,
      (items, rawLastDoc) => {
        setNotificationsMap((prev) => {
          const next = new Map(prev);
          items.forEach((item) => next.set(item.id, item));
          return next;
        });
        if (rawLastDoc) setListenerCursor(rawLastDoc);
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
      setNotificationsMap(new Map());
      setIsPanelOpen(false);
      setListenerCursor(null);
      setPaginationCursor(null);
      setHasMoreAll(false);
      setHasLoadedMoreAll(false);
      setHasLoadedMoreUnread(false);
      setUnreadDisplayCount(5);
      setUnreadListenerCursor(null);
      setUnreadPaginationCursor(null);
      setUnreadServerExhausted(false);
      setExtraUnreadNotifications([]);
    };
  }, [user]);

  useEffect(() => {
    if (currentToast || toastQueue.length === 0) return;

    const [next, ...rest] = toastQueue;
    setCurrentToast(next);
    setToastQueue(rest);
  }, [currentToast, toastQueue]);

  useEffect(() => {
    if (!currentToast) return undefined;

    const timer = setTimeout(() => {
      setCurrentToast(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [currentToast]);

  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    bellButtonRef.current?.focus();
  }, []);

  const markAsRead = useCallback(
    /**
     * 標記單則通知已讀（含 optimistic update）。
     * @param {string} notificationId - 通知 ID。
     * @returns {Promise<void>}
     */
    async (notificationId) => {
      setNotificationsMap((prev) => {
        const entry = prev.get(notificationId);
        if (!entry) return prev;
        const next = new Map(prev);
        next.set(notificationId, { ...entry, read: true });
        return next;
      });
      setUnreadNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setExtraUnreadNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      await markNotificationAsRead(notificationId);
    },
    [],
  );

  const displayedNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      const listenerSlice = unreadNotifications.slice(0, unreadDisplayCount);
      const listenerIds = new Set(listenerSlice.map((n) => n.id));
      const extraFiltered = extraUnreadNotifications.filter((n) => !listenerIds.has(n.id));
      return [...listenerSlice, ...extraFiltered];
    }

    return Array.from(notificationsMap.values()).sort(
      (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
    );
  }, [
    activeTab,
    notificationsMap,
    unreadNotifications,
    unreadDisplayCount,
    extraUnreadNotifications,
  ]);

  const hasMore = useMemo(() => {
    if (activeTab === 'unread') {
      if (unreadDisplayCount < unreadNotifications.length) return true;
      if (unreadNotifications.length >= 100 && !unreadServerExhausted) return true;
      return false;
    }

    return hasMoreAll;
  }, [
    activeTab,
    hasMoreAll,
    unreadDisplayCount,
    unreadNotifications.length,
    unreadServerExhausted,
  ]);

  const hasLoadedMore = useMemo(
    () => (activeTab === 'unread' ? hasLoadedMoreUnread : hasLoadedMoreAll),
    [activeTab, hasLoadedMoreUnread, hasLoadedMoreAll],
  );

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !user) return;

    if (activeTab === 'unread') {
      if (unreadDisplayCount < unreadNotifications.length) {
        setUnreadDisplayCount((prev) => prev + 5);
        return;
      }

      const cursor = unreadPaginationCursor ?? unreadListenerCursor;
      if (!cursor) return;

      setIsLoadingMore(true);
      try {
        const result = await fetchMoreUnreadNotifications(user.uid, cursor, 5);
        setExtraUnreadNotifications((prev) => [...prev, ...result.notifications]);
        if (result.lastDoc) setUnreadPaginationCursor(result.lastDoc);
        if (result.notifications.length < 5) setUnreadServerExhausted(true);
        setHasLoadedMoreUnread(true);
      } finally {
        setIsLoadingMore(false);
      }
      return;
    }

    const cursor = paginationCursor ?? listenerCursor;
    if (!cursor) return;

    setIsLoadingMore(true);
    try {
      const result = await fetchMoreNotifications(user.uid, cursor, 5);
      setNotificationsMap((prev) => {
        const next = new Map(prev);
        result.notifications.forEach((item) => next.set(item.id, item));
        return next;
      });
      if (result.lastDoc) setPaginationCursor(result.lastDoc);
      if (result.notifications.length < 5) setHasMoreAll(false);
      setHasLoadedMoreAll(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    user,
    activeTab,
    unreadDisplayCount,
    unreadNotifications.length,
    unreadPaginationCursor,
    unreadListenerCursor,
    paginationCursor,
    listenerCursor,
  ]);

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
      bellButtonRef,
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
