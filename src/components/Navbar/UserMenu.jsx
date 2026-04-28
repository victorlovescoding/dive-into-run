'use client';

import Image from 'next/image';
import { signInWithGoogle } from '@/lib/firebase-auth-helpers';
import styles from './Navbar.module.css';

/**
 * 桌面版使用者區塊，含登入按鈕、頭像與下拉選單。
 * @param {object} props - UserMenu 元件屬性。
 * @param {boolean} props.isDropdownOpen - dropdown 是否開啟。
 * @param {import('react').RefObject<HTMLDivElement | null>} props.dropdownRef - dropdown 容器 ref。
 * @param {import('react').RefObject<HTMLButtonElement | null>} props.avatarButtonRef - avatar 按鈕 ref。
 * @param {() => void} props.toggleDropdown - 切換 dropdown 開關。
 * @param {() => Promise<void>} props.handleSignOut - 登出處理函式。
 * @param {object | null} props.user - 目前登入使用者。
 * @param {boolean} props.loading - 認證載入狀態。
 * @returns {import('react').JSX.Element} UserMenu 元件。
 */
export default function UserMenu({
  isDropdownOpen,
  dropdownRef,
  avatarButtonRef,
  toggleDropdown,
  handleSignOut,
  user,
  loading,
}) {
  return (
    <div className={styles.userSection} ref={dropdownRef}>
      {loading && <div className={styles.skeleton} data-testid="user-menu-skeleton" />}
      {!loading && !user && (
        <button
          type="button"
          className={styles.loginButton}
          onClick={() => signInWithGoogle()?.catch(() => {})}
        >
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
                role="img"
                aria-label="預設使用者頭像"
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
  );
}
