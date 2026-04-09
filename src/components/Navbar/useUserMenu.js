'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { signOutUser } from '@/lib/firebase-auth-helpers';

/**
 * @typedef {object} UserMenuReturn
 * @property {boolean} isDropdownOpen - dropdown 是否開啟。
 * @property {import('react').RefObject<HTMLDivElement | null>} dropdownRef - dropdown 容器 ref。
 * @property {import('react').RefObject<HTMLButtonElement | null>} avatarButtonRef - avatar 按鈕 ref。
 * @property {() => void} toggleDropdown - 切換 dropdown 開關。
 * @property {() => Promise<void>} handleSignOut - 登出處理。
 */

/**
 * 管理桌面版使用者下拉選單的狀態、效果與事件處理。
 * @returns {UserMenuReturn} dropdown 相關狀態與操作。
 */
export default function useUserMenu() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const avatarButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));

  /** 點擊外部關閉 dropdown。 */
  useEffect(() => {
    if (!isDropdownOpen) return undefined;
    /**
     * 點擊 dropdown 外部時關閉 dropdown。
     * @param {MouseEvent} e - 滑鼠事件。
     */
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(/** @type {Node} */ (e.target))) {
        setIsDropdownOpen(false);
        avatarButtonRef.current?.focus();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isDropdownOpen]);

  /** Escape 鍵關閉 dropdown。 */
  useEffect(() => {
    if (!isDropdownOpen) return undefined;
    /**
     * 處理 dropdown 的 Escape 鍵事件。
     * @param {KeyboardEvent} e - 鍵盤事件。
     */
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        avatarButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen]);

  /** 開啟 dropdown 時 focus 第一個 menu item。 */
  useEffect(() => {
    if (isDropdownOpen) {
      const firstItem = dropdownRef.current?.querySelector('[role="menuitem"]');
      /** @type {HTMLElement | null} */ (firstItem)?.focus();
    }
  }, [isDropdownOpen]);

  /** 切換 dropdown 開關。 */
  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  /** 登出並關閉 dropdown。 */
  const handleSignOut = useCallback(async () => {
    setIsDropdownOpen(false);
    await signOutUser();
  }, []);

  return {
    isDropdownOpen,
    dropdownRef,
    avatarButtonRef,
    toggleDropdown,
    handleSignOut,
  };
}
