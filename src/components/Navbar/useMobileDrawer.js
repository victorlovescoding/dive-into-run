'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * @typedef {object} MobileDrawerReturn
 * @property {boolean} isDrawerOpen - drawer 是否開啟。
 * @property {import('react').RefObject<HTMLButtonElement | null>} hamburgerRef - hamburger 按鈕 ref。
 * @property {import('react').RefObject<HTMLButtonElement | null>} closeButtonRef - drawer 關閉按鈕 ref。
 * @property {() => void} toggleDrawer - 切換 drawer 開關。
 * @property {() => void} closeDrawer - 關閉 drawer。
 * @property {(e: import('react').MouseEvent<HTMLAnchorElement>) => void} handleLinkClick - drawer 內連結點擊處理。
 */

/**
 * 管理行動版 drawer 的狀態、效果與事件處理。
 * @returns {MobileDrawerReturn} drawer 相關狀態與操作。
 */
export default function useMobileDrawer() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const hamburgerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const closeButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const closedByPopState = useRef(false);
  const isTransitioning = useRef(false);
  const router = useRouter();

  /** 鎖定 body scroll。 */
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  /** drawer 關閉後重置 closedByPopState flag。 */
  useEffect(() => {
    if (!isDrawerOpen) {
      closedByPopState.current = false;
    }
  }, [isDrawerOpen]);

  /** 桌面寬度時自動關閉 drawer。 */
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    /**
     * 當 viewport 變為桌面寬度時自動關閉 drawer。
     * @param {MediaQueryListEvent} e - media query change 事件。
     */
    const handleChange = (e) => {
      if (e.matches && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [isDrawerOpen]);

  /** Escape 鍵關閉 drawer。 */
  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    /**
     * 處理 Escape 鍵事件。
     * @param {KeyboardEvent} e - 鍵盤事件。
     */
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
        if (!closedByPopState.current) {
          window.history.back();
        }
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  /** 開啟 drawer 時 focus close button。 */
  useEffect(() => {
    if (isDrawerOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isDrawerOpen]);

  /** 瀏覽器返回鍵關閉 drawer。 */
  useEffect(() => {
    if (!isDrawerOpen) return undefined;

    window.history.pushState({ drawerOpen: true }, '');

    /** 處理 popstate 事件（瀏覽器返回鍵）。 */
    const handlePopState = () => {
      closedByPopState.current = true;
      setIsDrawerOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDrawerOpen]);

  /** 切換 drawer 開關（含 transition guard 防止快速連點）。 */
  const toggleDrawer = useCallback(() => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    setIsDrawerOpen((prev) => !prev);
    setTimeout(() => {
      isTransitioning.current = false;
    }, 300);
  }, []);

  /** 關閉 drawer 並將 focus 移回 hamburger。 */
  const closeDrawer = useCallback(() => {
    if (!isDrawerOpen) return;
    setIsDrawerOpen(false);
    if (!closedByPopState.current) {
      window.history.back();
    }
    hamburgerRef.current?.focus();
  }, [isDrawerOpen]);

  /** 點擊 drawer 內的連結後關閉 drawer 並導航。 */
  const handleLinkClick = useCallback(
    (e) => {
      e.preventDefault();
      const href = /** @type {HTMLAnchorElement} */ (e.currentTarget).getAttribute('href');
      closedByPopState.current = true;
      setIsDrawerOpen(false);
      router.replace(href);
    },
    [router],
  );

  return {
    isDrawerOpen,
    hamburgerRef,
    closeButtonRef,
    toggleDrawer,
    closeDrawer,
    handleLinkClick,
  };
}
