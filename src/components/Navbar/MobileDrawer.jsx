'use client';

import Link from 'next/link';
import { signInWithGoogle, signOutUser } from '@/lib/firebase-auth-helpers';
import { NAV_ITEMS, isActivePath } from './nav-constants';
import styles from './Navbar.module.css';

/**
 * 行動版 drawer 元件，包含 overlay 與滑出式導覽面板。
 * 必須渲染在 nav 外部以避免 z-index stacking context 問題。
 * @param {object} props - MobileDrawer 元件屬性。
 * @param {boolean} props.isDrawerOpen - drawer 是否開啟。
 * @param {import('react').RefObject<HTMLButtonElement | null>} props.closeButtonRef - drawer 關閉按鈕 ref。
 * @param {() => void} props.closeDrawer - 關閉 drawer 處理函式。
 * @param {(e: import('react').MouseEvent<HTMLAnchorElement>) => void} props.handleLinkClick - drawer 內連結點擊處理。
 * @param {string} props.pathname - 目前路由路徑。
 * @param {object | null} props.user - 目前登入使用者。
 * @param {boolean} props.loading - 認證載入狀態。
 * @returns {import('react').JSX.Element} MobileDrawer 元件。
 */
export default function MobileDrawer({
  isDrawerOpen,
  closeButtonRef,
  closeDrawer,
  handleLinkClick,
  pathname,
  user,
  loading,
}) {
  const drawerClass = isDrawerOpen ? `${styles.drawer} ${styles.drawerOpen}` : styles.drawer;
  const overlayClass = isDrawerOpen ? `${styles.overlay} ${styles.overlayVisible}` : styles.overlay;

  return (
    <>
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
