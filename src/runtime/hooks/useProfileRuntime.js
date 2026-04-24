'use client';

import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { getProfileStats } from '@/service/profile-service';

/**
 * @typedef {object} ProfileRuntimeUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 個人簡介。
 * @property {Date | { toDate: () => Date }} createdAt - 加入日期。
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
 * profile page runtime orchestration。
 * @param {ProfileRuntimeUser} user - server component 傳入的 profile。
 * @returns {{ profileUid: string, headerUser: ProfileRuntimeUser & { createdAt: { toDate: () => Date } }, stats: ProfileStatsData | null, isStatsLoading: boolean, statsError: string | null, isSelf: boolean }} profile runtime state。
 */
export default function useProfileRuntime(user) {
  const [stats, setStats] = useState(/** @type {ProfileStatsData | null} */ (null));
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(/** @type {string | null} */ (null));
  const { user: currentUser } = useContext(AuthContext);

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

  return {
    profileUid: user.uid,
    headerUser: { ...user, createdAt: toCreatedAtAdapter(user.createdAt) },
    stats,
    isStatsLoading,
    statsError,
    isSelf: isViewingOwnProfile(currentUser, user.uid),
  };
}
