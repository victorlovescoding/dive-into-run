'use client';

import { useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import NotificationBell from '@/components/Notifications/NotificationBell';
import NotificationPanel from '@/components/Notifications/NotificationPanel';
import useMobileDrawer from './useMobileDrawer';
import useUserMenu from './useUserMenu';
import MobileDrawer from './MobileDrawer';
import UserMenu from './UserMenu';
import { NAV_ITEMS, isActivePath } from './nav-constants';
import styles from './Navbar.module.css';

/**
 * 響應式導覽列元件，含行動版 drawer 與桌面版連結列。
 * @returns {import('react').JSX.Element} Navbar 元件。
 */
export default function Navbar() {
  const { user, loading } = useContext(AuthContext);
  const pathname = usePathname();
  const { isDrawerOpen, hamburgerRef, closeButtonRef, toggleDrawer, closeDrawer, handleLinkClick } =
    useMobileDrawer();
  const { isDropdownOpen, dropdownRef, avatarButtonRef, toggleDropdown, handleSignOut } =
    useUserMenu();

  const hamburgerLabel = isDrawerOpen ? '關閉導覽選單' : '開啟導覽選單';
  const hamburgerClass = isDrawerOpen
    ? `${styles.hamburger} ${styles.hamburgerOpen}`
    : styles.hamburger;

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

        {user && (
          <div className={styles.bellWrapper}>
            <NotificationBell />
            <NotificationPanel />
          </div>
        )}

        <UserMenu
          isDropdownOpen={isDropdownOpen}
          dropdownRef={dropdownRef}
          avatarButtonRef={avatarButtonRef}
          toggleDropdown={toggleDropdown}
          handleSignOut={handleSignOut}
          user={user}
          loading={loading}
        />
      </nav>

      {/* Overlay + Drawer OUTSIDE nav (z-index constraint) */}
      <MobileDrawer
        isDrawerOpen={isDrawerOpen}
        closeButtonRef={closeButtonRef}
        closeDrawer={closeDrawer}
        handleLinkClick={handleLinkClick}
        pathname={pathname}
        user={user}
        loading={loading}
      />
    </>
  );
}

export { isActivePath, NAV_ITEMS };
