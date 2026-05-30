'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from './MemberPageScreen.module.css';

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
    name,
    inputFileRef,
    onNameChange,
    triggerFilePicker,
    onAvatarFileChange,
    onSubmitNewName,
  } = runtime;
  const userLabel = user?.name || user?.email || '跑者';

  return (
    <main className={styles.memberPage}>
      <div className={styles.shell}>
        <div className={styles.workspaceGrid}>
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
          <div className={styles.bioSlot}>{bioEditor}</div>
          <div className={styles.dashboardSlot}>{dashboardTabs}</div>
          <div className={styles.dangerSlot}>{accountDeletionDangerZone}</div>
        </div>
      </div>
    </main>
  );
}
