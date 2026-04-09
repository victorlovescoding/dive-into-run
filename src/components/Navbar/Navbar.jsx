'use client';

import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import { signInWithGoogle, signOutUser } from '@/lib/firebase-auth-helpers';
import styles from './Navbar.module.css';

/**
 * @typedef {object} NavItem
 * @property {string} href - 路由路徑。
 * @property {string} label - 顯示文字。
 */

/** @type {NavItem[]} */
const NAV_ITEMS = [
  { href: '/', label: '回首頁' },
  { href: '/member', label: '會員頁面' },
  { href: '/posts', label: '文章' },
  { href: '/events', label: '揪團頁面' },
  { href: '/runs', label: '跑步' },
];

/**
 * 判斷導覽連結是否為目前頁面。
 * @param {string} pathname - 目前路由路徑。
 * @param {string} href - 導覽連結路徑。
 * @returns {boolean} 是否為 active 狀態。
 */
function isActivePath(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

/**
 * 響應式導覽列元件，含行動版 drawer 與桌面版連結列。
 * @returns {import('react').JSX.Element} Navbar 元件。
 */
export default function Navbar() {
  // -- State --
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // -- Context --
  const { user, loading } = useContext(AuthContext);
  const pathname = usePathname();
  const router = useRouter();

  // -- Refs --
  const hamburgerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const closeButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const dropdownRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const avatarButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const closedByPopState = useRef(false);
  const isTransitioning = useRef(false);

  // -- Effects --

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
          history.back();
        }
        closedByPopState.current = false;
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

    history.pushState({ drawerOpen: true }, '');

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

  // -- Handlers --

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
    setIsDrawerOpen(false);
    if (!closedByPopState.current) {
      history.back();
    }
    closedByPopState.current = false;
    hamburgerRef.current?.focus();
  }, []);

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

  /** 切換 dropdown 開關。 */
  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  /** 登出並關閉 dropdown。 */
  const handleSignOut = useCallback(async () => {
    setIsDropdownOpen(false);
    await signOutUser();
  }, []);

  // -- Derived --
  const hamburgerLabel = isDrawerOpen ? '關閉導覽選單' : '開啟導覽選單';
  const hamburgerClass = isDrawerOpen
    ? `${styles.hamburger} ${styles.hamburgerOpen}`
    : styles.hamburger;
  const drawerClass = isDrawerOpen ? `${styles.drawer} ${styles.drawerOpen}` : styles.drawer;
  const overlayClass = isDrawerOpen ? `${styles.overlay} ${styles.overlayVisible}` : styles.overlay;

  return (
    <>
      <nav className={styles.navbar} aria-label="主要導覽">
        <Link href="/" className={styles.brand}>
          Dive Into Run
        </Link>

        {/* Hamburger (mobile only) */}
        <button
          ref={hamburgerRef}
          type="button"
          className={hamburgerClass}
          aria-controls="mobile-drawer"
          aria-expanded={isDrawerOpen}
          aria-label={hamburgerLabel}
          onClick={toggleDrawer}
        >
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
        </button>

        {/* Desktop links */}
        <ul className={styles.desktopLinks}>
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const linkClass = active ? `${styles.link} ${styles.linkActive}` : styles.link;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={linkClass}
                  {...(active ? { 'aria-current': 'page' } : {})}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* User section (desktop) */}
        <div className={styles.userSection} ref={dropdownRef}>
          {loading && <div className={styles.skeleton} />}
          {!loading && !user && (
            <button type="button" className={styles.loginButton} onClick={signInWithGoogle}>
              登入
            </button>
          )}
          {!loading && user && (
            <>
              <button
                ref={avatarButtonRef}
                type="button"
                className={styles.avatar}
                onClick={toggleDropdown}
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
                aria-label="使用者選單"
              >
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt="使用者頭像"
                    width={32}
                    height={32}
                    className={styles.avatarImage}
                  />
                ) : (
                  <svg
                    viewBox="0 0 32 32"
                    width="32"
                    height="32"
                    className={styles.avatarImage}
                    aria-hidden="true"
                  >
                    <circle cx="16" cy="16" r="16" fill="#e5e7eb" />
                    <circle cx="16" cy="12" r="5" fill="#9ca3af" />
                    <path d="M6 28c0-5.5 4.5-10 10-10s10 4.5 10 10" fill="#9ca3af" />
                  </svg>
                )}
              </button>
              <ul
                role="menu"
                className={
                  isDropdownOpen ? `${styles.dropdown} ${styles.dropdownOpen}` : styles.dropdown
                }
              >
                <li>
                  <button type="button" role="menuitem" onClick={handleSignOut}>
                    登出
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>
      </nav>

      {/* Overlay */}
      <div className={overlayClass} onClick={closeDrawer} aria-hidden="true" />

      {/* Drawer (mobile) */}
      <div
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="導覽選單"
        className={drawerClass}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.drawerClose}
          aria-label="關閉導覽選單"
          onClick={closeDrawer}
        >
          ✕
        </button>

        <div className={styles.drawerLinks}>
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const linkClass = active
              ? `${styles.drawerLink} ${styles.drawerLinkActive}`
              : styles.drawerLink;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass}
                onClick={handleLinkClick}
                {...(active ? { 'aria-current': 'page' } : {})}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Auth section */}
        <div className={styles.drawerAuth}>
          {!loading && !user && (
            <button type="button" className={styles.loginButton} onClick={signInWithGoogle}>
              登入
            </button>
          )}
          {!loading && user && (
            <div className={styles.drawerUserInfo}>
              <span className={styles.drawerUserName}>{user.name}</span>
              <button type="button" className={styles.loginButton} onClick={signOutUser}>
                登出
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export { isActivePath, NAV_ITEMS };
