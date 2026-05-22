'use client';

import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import {
  followRunner,
  getRunnerFollowingCount,
  getRunnerFollowStatus,
  listRunnerFollows,
  unfollowRunner,
} from '@/runtime/client/use-cases/follow-use-cases';
import { getProfileStats } from '@/service/profile-service';

/**
 * @typedef {object} ProfileRuntimeUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 個人簡介。
 * @property {Date | { toDate: () => Date }} createdAt - 加入日期。
 * @property {number} [followersCount] - 公開追蹤者數量。
 */

/**
 * @typedef {object} ProfileStatsData
 * @property {number} hostedCount - 主辦活動數量。
 * @property {number} joinedCount - 參加活動數量。
 * @property {number | null} totalDistanceKm - 累計跑步公里數。
 */

/**
 * 將 createdAt 正規化成 ProfileHeader 可讀 shape。
 * @param {ProfileRuntimeUser['createdAt']} createdAt - 原始 createdAt。
 * @returns {{ toDate: () => Date }} Firestore-like wrapper。
 */
function toCreatedAtAdapter(createdAt) {
  if (createdAt && typeof (/** @type {{ toDate?: unknown }} */ (createdAt).toDate) === 'function') {
    return /** @type {{ toDate: () => Date }} */ (createdAt);
  }
  if (createdAt instanceof Date) {
    return { toDate: () => createdAt };
  }
  throw new Error('useProfileRuntime.toCreatedAtAdapter: unsupported createdAt shape');
}

/**
 * 判斷目前登入者是否在看自己的公開檔案。
 * @param {{ uid: string } | null | undefined} currentUser - 當前登入者。
 * @param {string} profileUid - profile uid。
 * @returns {boolean} 是否為本人。
 */
function isViewingOwnProfile(currentUser, profileUid) {
  if (!currentUser) return false;
  return currentUser.uid === profileUid;
}

/**
 * 將公開 followersCount 正規化為非負整數。
 * @param {unknown} count - Public profile count。
 * @returns {number} Non-negative count。
 */
function normalizeCount(count) {
  return typeof count === 'number' && count > 0 ? count : 0;
}

/**
 * 建立 follow use-case 需要的 actor profile。
 * @param {{ uid: string, name: string | null, photoURL: string | null }} user - Auth user。
 * @returns {{ uid: string, name: string, photoURL: string }} Follow actor。
 */
function toFollowActor(user) {
  return {
    uid: user.uid,
    name: user.name || '跑友',
    photoURL: user.photoURL || '',
  };
}

/**
 * profile page runtime orchestration。
 * @param {ProfileRuntimeUser} user - server component 傳入的 profile。
 * @returns {{ profileUid: string, headerUser: ProfileRuntimeUser & { createdAt: { toDate: () => Date } }, stats: ProfileStatsData | null, isStatsLoading: boolean, statsError: string | null, isSelf: boolean, followCounts: { followersCount: number, followingCount: number, isFollowingCountLoading: boolean }, followControl: { isVisible: boolean, isFollowing: boolean, isPending: boolean, label: string, onToggle: () => Promise<void> }, followListModal: { isOpen: boolean, direction: 'followers' | 'following' | null, title: string, rows: Array<{ uid: string, name: string, photoURL: string, createdAt: unknown }>, isLoading: boolean, error: string | null, open: (direction: 'followers' | 'following') => Promise<void>, close: () => void }, toastMessage: string | null, dismissToast: () => void }} profile runtime state。
 */
export default function useProfileRuntime(user) {
  const [stats, setStats] = useState(/** @type {ProfileStatsData | null} */ (null));
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(/** @type {string | null} */ (null));
  const [followersCount, setFollowersCount] = useState(() => normalizeCount(user.followersCount));
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowingCountLoading, setIsFollowingCountLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [toastMessage, setToastMessage] = useState(/** @type {string | null} */ (null));
  const [modalDirection, setModalDirection] = useState(
    /** @type {'followers' | 'following' | null} */ (null),
  );
  const [modalRows, setModalRows] = useState(
    /** @type {Array<{ uid: string, name: string, photoURL: string, createdAt: unknown }>} */ ([]),
  );
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalError, setModalError] = useState(/** @type {string | null} */ (null));
  const { user: currentUser } = useContext(AuthContext);
  const isSelf = isViewingOwnProfile(currentUser, user.uid);
  const canShowFollowControl = Boolean(currentUser && !isSelf);

  useEffect(() => {
    let cancelled = false;

    getProfileStats(user.uid)
      .then((result) => {
        if (cancelled) return;
        setStats(result);
        setStatsError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[useProfileRuntime] getProfileStats failed:', error);
        setStats(null);
        setStatsError('無法載入統計');
      })
      .finally(() => {
        if (!cancelled) {
          setIsStatsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  useEffect(() => {
    setFollowersCount(normalizeCount(user.followersCount));
  }, [user.followersCount, user.uid]);

  useEffect(() => {
    let cancelled = false;
    setIsFollowingCountLoading(true);

    getRunnerFollowingCount({ uid: user.uid })
      .then((count) => {
        if (cancelled) return;
        setFollowingCount(count);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[useProfileRuntime] getRunnerFollowingCount failed:', error);
        setFollowingCount(0);
      })
      .finally(() => {
        if (!cancelled) {
          setIsFollowingCountLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  useEffect(() => {
    let cancelled = false;

    if (!currentUser || isSelf) {
      setIsFollowing(false);
      return () => {
        cancelled = true;
      };
    }

    getRunnerFollowStatus({ followerUid: currentUser.uid, targetUid: user.uid })
      .then((status) => {
        if (!cancelled) {
          setIsFollowing(status);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[useProfileRuntime] getRunnerFollowStatus failed:', error);
          setIsFollowing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, isSelf, user.uid]);

  useEffect(() => {
    let cancelled = false;

    if (!modalDirection) {
      setModalRows([]);
      setModalError(null);
      setIsModalLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsModalLoading(true);
    setModalError(null);

    listRunnerFollows({ uid: user.uid, direction: modalDirection })
      .then((rows) => {
        if (!cancelled) {
          setModalRows(rows);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[useProfileRuntime] listRunnerFollows failed:', error);
          setModalRows([]);
          setModalError('無法載入名單');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsModalLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [modalDirection, user.uid]);

  const openFollowList = useCallback(
    async (direction) => {
      setModalDirection(direction);
    },
    [],
  );

  const closeFollowList = useCallback(() => {
    setModalDirection(null);
  }, []);

  const handleFollowToggle = useCallback(async () => {
    if (!currentUser || isSelf || isFollowPending) return;

    const nextIsFollowing = !isFollowing;
    const previousIsFollowing = isFollowing;
    const previousFollowersCount = followersCount;
    const nextFollowersCount = normalizeCount(followersCount + (nextIsFollowing ? 1 : -1));

    setIsFollowPending(true);
    setToastMessage(null);
    setIsFollowing(nextIsFollowing);
    setFollowersCount(nextFollowersCount);

    try {
      const result = nextIsFollowing
        ? await followRunner({
            follower: toFollowActor(currentUser),
            target: { uid: user.uid, name: user.name, photoURL: user.photoURL || '' },
          })
        : await unfollowRunner({ followerUid: currentUser.uid, targetUid: user.uid });

      setIsFollowing(result.following);
    } catch (error) {
      console.error('[useProfileRuntime] follow mutation failed:', error);
      setIsFollowing(previousIsFollowing);
      setFollowersCount(previousFollowersCount);
      setToastMessage(
        nextIsFollowing ? '追蹤失敗，請稍後再試。' : '取消追蹤失敗，請稍後再試。',
      );
    } finally {
      setIsFollowPending(false);
    }
  }, [
    currentUser,
    followersCount,
    isFollowPending,
    isFollowing,
    isSelf,
    user.name,
    user.photoURL,
    user.uid,
  ]);

  const followLabel = isFollowPending
    ? isFollowing
      ? '追蹤中'
      : '取消中...'
    : isFollowing
      ? '追蹤中'
      : '追蹤';
  const modalTitle = modalDirection === 'following' ? '追蹤中' : '追蹤者';

  return {
    profileUid: user.uid,
    headerUser: { ...user, createdAt: toCreatedAtAdapter(user.createdAt) },
    stats,
    isStatsLoading,
    statsError,
    isSelf,
    followCounts: {
      followersCount,
      followingCount,
      isFollowingCountLoading,
    },
    followControl: {
      isVisible: canShowFollowControl,
      isFollowing,
      isPending: isFollowPending,
      label: followLabel,
      onToggle: handleFollowToggle,
    },
    followListModal: {
      isOpen: modalDirection !== null,
      direction: modalDirection,
      title: modalTitle,
      rows: modalRows,
      isLoading: isModalLoading,
      error: modalError,
      open: openFollowList,
      close: closeFollowList,
    },
    toastMessage,
    dismissToast: () => setToastMessage(null),
  };
}
