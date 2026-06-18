'use client';

import { useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './MemberPageScreen.module.css';

const DESKTOP_MEMBER_LAYOUT_QUERY = '(min-width: 940px)';

/**
 * 訂閱桌面會員版面 breakpoint 的 media query。
 * @param {() => void} onStoreChange - breakpoint 狀態變更時通知 useSyncExternalStore。
 * @returns {() => void} 取消訂閱函式。
 */
function subscribeToDesktopMemberLayout(onStoreChange) {
  if (typeof window === 'undefined') return () => {};

  const mediaQuery = window.matchMedia(DESKTOP_MEMBER_LAYOUT_QUERY);
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

/**
 * 讀取目前 viewport 是否符合桌面會員版面。
 * @returns {boolean} 符合桌面 breakpoint 時回傳 true。
 */
function getDesktopMemberLayoutSnapshot() {
  return typeof window !== 'undefined' && window.matchMedia(DESKTOP_MEMBER_LAYOUT_QUERY).matches;
}

/**
 * Server snapshot 固定為 false，讓初始會員版面從行動版 markup 開始。
 * @returns {boolean} server 端不啟用桌面會員版面。
 */
function getServerDesktopMemberLayoutSnapshot() {
  return false;
}

/**
 * 追蹤會員頁目前是否應使用桌面版面。
 * @returns {boolean} 目前 viewport 符合桌面 breakpoint 時回傳 true。
 */
function useDesktopMemberLayout() {
  return useSyncExternalStore(
    subscribeToDesktopMemberLayout,
    getDesktopMemberLayoutSnapshot,
    getServerDesktopMemberLayoutSnapshot
  );
}

/**
 * member page UI screen。
 * @param {object} props - Component props。
 * @param {object} props.runtime - member runtime boundary。
 * @param {import('react').ReactNode} props.bioEditor - bio editor slot。
 * @param {import('react').ReactNode} props.dashboardTabs - dashboard tabs slot。
 * @param {import('react').ReactNode} props.accountDeletionDangerZone - account deletion slot。
 * @returns {import('react').ReactElement} member page UI。
 */
export default function MemberPageScreen({
  runtime,
  bioEditor,
  dashboardTabs,
  accountDeletionDangerZone,
}) {
  const {
    user,
    loading,
    name,
    inputFileRef,
    onNameChange,
    triggerFilePicker,
    onAvatarFileChange,
    onSubmitNewName,
  } = runtime;
  const isDesktopLayout = useDesktopMemberLayout();

  if (loading || !user) return null;

  const userLabel = user?.name || user?.email || '跑者';
  const profilePanel = (
    <section className={styles.profilePanel} aria-labelledby="member-profile-heading">
      <p className={styles.eyebrow}>Account</p>
      <div className={styles.profileHeader}>
        <button
          type="button"
          className={styles.avatarButton}
          onClick={triggerFilePicker}
          aria-label="更新大頭貼"
        >
          <Image
            className={styles.avatarImage}
            src={user?.photoURL || '/default-avatar.png'}
            alt={user?.name || '大頭貼'}
            width={72}
            height={72}
          />
        </button>
        <input
          hidden
          type="file"
          accept="image/*"
          ref={inputFileRef}
          onChange={onAvatarFileChange}
        />
        <div className={styles.identity}>
          <h2 id="member-profile-heading" className={styles.profileHeading}>
            你好，{userLabel}
          </h2>
          {user?.email ? <p className={styles.email}>{user.email}</p> : null}
        </div>
      </div>
      <form className={styles.nameForm} onSubmit={onSubmitNewName}>
        <label className={styles.inputGroup} htmlFor="member-display-name">
          <span className={styles.label}>顯示名稱</span>
          <input
            id="member-display-name"
            className={styles.nameInput}
            type="text"
            value={name || ''}
            onChange={onNameChange}
            placeholder="輸入顯示名稱"
          />
        </label>
        <button className={styles.primaryAction} type="submit">
          變更名稱
        </button>
      </form>
      {user?.uid ? (
        <div className={styles.accountLinks}>
          <Link className={styles.secondaryLink} href={`/users/${user.uid}`}>
            查看我的公開檔案
          </Link>
          <Link className={styles.secondaryLink} href="/member/favorites">
            我的收藏
          </Link>
        </div>
      ) : null}
    </section>
  );
  const bioSlot = <div className={styles.bioSlot}>{bioEditor}</div>;
  const dashboardSlot = <div className={styles.dashboardSlot}>{dashboardTabs}</div>;
  const dangerSlot = <div className={styles.dangerSlot}>{accountDeletionDangerZone}</div>;

  return (
    <main className={styles.memberPage}>
      <div className={styles.shell}>
        <div className={styles.workspaceGrid}>
          {isDesktopLayout ? (
            <>
              <div className={styles.leftColumn}>
                {profilePanel}
                {bioSlot}
                {dangerSlot}
              </div>
              {dashboardSlot}
            </>
          ) : (
            <>
              <div className={styles.leftColumn}>
                {profilePanel}
                {bioSlot}
              </div>
              {dashboardSlot}
              {dangerSlot}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
