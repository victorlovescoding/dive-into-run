'use client';

import UserLink from '@/components/UserLink';
import styles from './MemberFollowingScreen.module.css';

/**
 * @typedef {object} MemberFollowingRow
 * @property {string} uid - Followed runner UID.
 * @property {string} name - Followed runner display name.
 * @property {string} photoURL - Followed runner avatar URL.
 * @property {unknown} createdAt - Follow creation timestamp.
 */

/**
 * @typedef {object} MemberFollowingRuntime
 * @property {MemberFollowingRow[]} items - Followed runners.
 * @property {number} followingCount - Count derived from loaded rows.
 * @property {boolean} isLoading - Whether list loading is active.
 * @property {string} error - List load error message.
 * @property {boolean} authLoading - Whether auth state is loading.
 * @property {boolean} requiresSignIn - Whether the viewer must sign in.
 * @property {string | null} pendingTargetUid - Runner currently being unfollowed.
 * @property {(row: MemberFollowingRow) => void | Promise<void>} unfollow - Row-level unfollow handler.
 */

/**
 * Gets a stable display name for a following row.
 * @param {MemberFollowingRow} row - Following row.
 * @returns {string} Display name.
 */
function getRunnerName(row) {
  return row.name || row.uid;
}

/**
 * Single followed runner row.
 * @param {object} props - Component props.
 * @param {MemberFollowingRow} props.row - Followed runner row.
 * @param {string | null} props.pendingTargetUid - Pending target UID.
 * @param {(row: MemberFollowingRow) => void | Promise<void>} props.onUnfollow - Unfollow callback.
 * @returns {import('react').ReactElement} Following row.
 */
function FollowingRow({ row, pendingTargetUid, onUnfollow }) {
  const name = getRunnerName(row);
  const isPending = pendingTargetUid === row.uid;

  return (
    <article className={styles.row} aria-label={`${name} 追蹤跑友`}>
      <UserLink
        uid={row.uid}
        name={name}
        photoURL={row.photoURL}
        size={44}
        className={styles.runnerLink}
      />
      <button
        type="button"
        className={styles.unfollowButton}
        aria-label={`取消追蹤 ${name}`}
        disabled={isPending}
        onClick={() => onUnfollow(row)}
      >
        {isPending ? '取消中...' : '取消追蹤'}
      </button>
    </article>
  );
}

/**
 * Member following render-only screen.
 * @param {object} props - Component props.
 * @param {MemberFollowingRuntime} props.runtime - Member following runtime boundary.
 * @returns {import('react').ReactElement} Rendered screen.
 */
export default function MemberFollowingScreen({ runtime }) {
  if (runtime.authLoading) {
    return (
      <main className={styles.container}>
        <p className={styles.loading}>載入中…</p>
      </main>
    );
  }

  if (runtime.requiresSignIn) {
    return (
      <main className={styles.container}>
        <div className={styles.error} role="alert">
          請先登入以管理追蹤跑友
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>我的追蹤跑友</h1>
        <p className={styles.count}>{runtime.followingCount} 位追蹤中</p>
      </header>

      {runtime.isLoading && <p className={styles.loading}>載入中…</p>}

      {!runtime.isLoading && runtime.error && (
        <div className={styles.error} role="alert">
          {runtime.error}
        </div>
      )}

      {!runtime.isLoading && !runtime.error && runtime.items.length === 0 && (
        <p className={styles.empty}>尚未追蹤任何跑友</p>
      )}

      {!runtime.isLoading && !runtime.error && runtime.items.length > 0 && (
        <div className={styles.rowList}>
          {runtime.items.map((row) => (
            <FollowingRow
              key={row.uid}
              row={row}
              pendingTargetUid={runtime.pendingTargetUid}
              onUnfollow={runtime.unfollow}
            />
          ))}
        </div>
      )}
    </main>
  );
}
