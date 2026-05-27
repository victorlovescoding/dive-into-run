'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { getProfileStats } from '@/service/profile-service';
import { getFollowListEmptyText } from '@/service/follow-service';
import {
  followRunner,
  getRunnerFollowStatus,
  loadFollowListPage,
  unfollowRunner,
} from '@/runtime/client/use-cases/follow-use-cases';

/**
 * @typedef {object} ProfileRuntimeUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 個人簡介。
 * @property {Date | { toDate: () => Date }} createdAt - 加入日期。
 * @property {number} [followersCount] - 粉絲數。
 * @property {number} [followingCount] - 追蹤中數。
 * @property {string} [privacy] - 隱私狀態。
 */

/**
 * @typedef {object} ProfileStatsData
 * @property {number} hostedCount - 主辦活動數量。
 * @property {number} joinedCount - 參加活動數量。
 * @property {number} followersCount - 粉絲數。
 * @property {number} followingCount - 追蹤中數。
 * @property {number | null} totalDistanceKm - 累計跑步公里數。
 */

/**
 * @typedef {'followers' | 'following'} FollowListType
 * @typedef {import('@/service/follow-service').FollowListRow} FollowListRow
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
 * Builds initial stats from the serialized server profile while client counts load.
 * @param {ProfileRuntimeUser} user - Server profile prop.
 * @returns {ProfileStatsData} Initial stats.
 */
function buildInitialStats(user) {
  return {
    hostedCount: 0,
    joinedCount: 0,
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    totalDistanceKm: null,
  };
}

/**
 * profile page runtime orchestration。
 * @param {ProfileRuntimeUser} user - server component 傳入的 profile。
 * @returns {{ profileUid: string, headerUser: ProfileRuntimeUser & { createdAt: { toDate: () => Date } }, stats: ProfileStatsData | null, isStatsLoading: boolean, statsError: string | null, isSelf: boolean, canFollow: boolean, isFollowing: boolean, isFollowLoading: boolean, followError: string | null, onToggleFollow: () => Promise<void>, followModal: { type: FollowListType | null, title: string, rows: FollowListRow[], loading: boolean, loadingMore: boolean, error: string | null, hasMore: boolean, emptyText: string }, openFollowModal: (type: FollowListType) => Promise<void>, closeFollowModal: () => void, loadMoreFollowModal: () => Promise<void> }} profile runtime state。
 */
export default function useProfileRuntime(user) {
  const [stats, setStats] = useState(/** @type {ProfileStatsData | null} */ (buildInitialStats(user)));
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(/** @type {string | null} */ (null));
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followError, setFollowError] = useState(/** @type {string | null} */ (null));
  const [followModal, setFollowModal] = useState({
    type: /** @type {FollowListType | null} */ (null),
    title: '',
    rows: /** @type {FollowListRow[]} */ ([]),
    lastDoc: /** @type {import('firebase/firestore').QueryDocumentSnapshot | null} */ (null),
    loading: false,
    loadingMore: false,
    error: /** @type {string | null} */ (null),
    hasMore: false,
    emptyText: '',
  });
  const followStatusRequestSeqRef = useRef(0);
  const followMutationRequestSeqRef = useRef(0);
  const followMutationActiveRef = useRef(false);
  const latestFollowIdentityRef = useRef({
    viewerUid: /** @type {string | null} */ (null),
    profileUid: '',
  });
  const followModalRequestSeqRef = useRef(0);
  const { user: currentUser } = useContext(AuthContext);
  const currentUserUid = currentUser?.uid ?? null;
  latestFollowIdentityRef.current = { viewerUid: currentUserUid, profileUid: user.uid };
  const isSelf = isViewingOwnProfile(currentUser, user.uid);
  const canFollow = Boolean(currentUserUid) && !isSelf;

  useEffect(() => {
    let cancelled = false;
    setIsStatsLoading(true);

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
    let cancelled = false;
    const requestId = followStatusRequestSeqRef.current + 1;
    followStatusRequestSeqRef.current = requestId;

    if (!currentUserUid || currentUserUid === user.uid) {
      followMutationActiveRef.current = false;
      setIsFollowing(false);
      setFollowError(null);
      setIsFollowLoading(false);
      return () => {
        cancelled = true;
      };
    }

    getRunnerFollowStatus({ viewerUid: currentUserUid, targetUid: user.uid })
      .then((result) => {
        if (
          !cancelled
          && followStatusRequestSeqRef.current === requestId
          && !followMutationActiveRef.current
        ) {
          setIsFollowing(result);
          setFollowError(null);
        }
      })
      .catch((error) => {
        if (cancelled || followStatusRequestSeqRef.current !== requestId) return;
        console.error('[useProfileRuntime] getRunnerFollowStatus failed:', error);
        setIsFollowing(false);
        setFollowError('無法載入追蹤狀態');
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserUid, user.uid]);

  useEffect(() => {
    followMutationRequestSeqRef.current += 1;
    followMutationActiveRef.current = false;
    setIsFollowLoading(false);
  }, [currentUserUid, user.uid]);

  /**
   * Follows or unfollows the profile owner for the current signed-in user.
   * @returns {Promise<void>} Resolves after the follow mutation attempt.
   */
  async function onToggleFollow() {
    if (!currentUser || currentUser.uid === user.uid || isFollowLoading) {
      return;
    }

    // eslint-disable-next-line no-alert -- MVP confirmation flow explicitly accepts window.confirm.
    if (isFollowing && !window.confirm('確定要取消追蹤這位跑友嗎？')) {
      return;
    }

    followStatusRequestSeqRef.current += 1;
    const requestId = followMutationRequestSeqRef.current + 1;
    followMutationRequestSeqRef.current = requestId;
    followMutationActiveRef.current = true;
    const mutationIdentity = { viewerUid: currentUser.uid, profileUid: user.uid };
    setIsFollowLoading(true);
    setFollowError(null);

    try {
      const result = isFollowing
        ? await unfollowRunner({ currentUser, targetUid: user.uid })
        : await followRunner({ currentUser, targetUid: user.uid });

      if (
        followMutationRequestSeqRef.current !== requestId
        || latestFollowIdentityRef.current.viewerUid !== mutationIdentity.viewerUid
        || latestFollowIdentityRef.current.profileUid !== mutationIdentity.profileUid
      ) return;
      setIsFollowing(result.isFollowing);
      setStats((current) =>
        current ? { ...current, followersCount: result.followersCount } : current,
      );
    } catch (error) {
      if (
        followMutationRequestSeqRef.current !== requestId
        || latestFollowIdentityRef.current.viewerUid !== mutationIdentity.viewerUid
        || latestFollowIdentityRef.current.profileUid !== mutationIdentity.profileUid
      ) return;
      console.error('[useProfileRuntime] toggle follow failed:', error);
      setFollowError(isFollowing ? '取消追蹤失敗' : '追蹤失敗');
    } finally {
      if (
        followMutationRequestSeqRef.current === requestId
        && latestFollowIdentityRef.current.viewerUid === mutationIdentity.viewerUid
        && latestFollowIdentityRef.current.profileUid === mutationIdentity.profileUid
      ) {
        followMutationActiveRef.current = false;
        setIsFollowLoading(false);
      }
    }
  }

  /**
   * Opens a follower/following modal and loads its first page.
   * @param {FollowListType} type - Follow modal type.
   * @returns {Promise<void>} Resolves after the first page load attempt.
   */
  async function openFollowModal(type) {
    const title = type === 'followers' ? '粉絲' : '追蹤中';
    const requestId = followModalRequestSeqRef.current + 1;
    followModalRequestSeqRef.current = requestId;
    setFollowModal({
      type,
      title,
      rows: [],
      lastDoc: null,
      loading: true,
      loadingMore: false,
      error: null,
      hasMore: false,
      emptyText: getFollowListEmptyText(type),
    });

    try {
      const result = await loadFollowListPage({ profileUid: user.uid, type });
      if (followModalRequestSeqRef.current !== requestId) return;
      setFollowModal({
        type,
        title,
        rows: result.rows,
        lastDoc: result.lastDoc,
        loading: false,
        loadingMore: false,
        error: null,
        hasMore: result.hasMore,
        emptyText: getFollowListEmptyText(type),
      });
    } catch (error) {
      if (followModalRequestSeqRef.current !== requestId) return;
      console.error('[useProfileRuntime] load follow modal failed:', error);
      setFollowModal((current) => ({
        ...current,
        loading: false,
        loadingMore: false,
        error: '無法載入名單',
      }));
    }
  }

  /**
   * Closes the follower/following modal and clears transient list state.
   * @returns {void}
   */
  function closeFollowModal() {
    followModalRequestSeqRef.current += 1;
    setFollowModal((current) => ({
      ...current,
      type: null,
      rows: [],
      lastDoc: null,
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: false,
    }));
  }

  /**
   * Loads the next follower/following modal page.
   * @returns {Promise<void>} Resolves after the pagination attempt.
   */
  async function loadMoreFollowModal() {
    if (!followModal.type || followModal.loading || followModal.loadingMore || !followModal.hasMore) {
      return;
    }

    const { type, lastDoc } = followModal;
    const requestId = followModalRequestSeqRef.current + 1;
    followModalRequestSeqRef.current = requestId;
    setFollowModal((current) => ({ ...current, loadingMore: true, error: null }));

    try {
      const result = await loadFollowListPage({ profileUid: user.uid, type, lastDoc });
      if (followModalRequestSeqRef.current !== requestId) return;
      setFollowModal((current) => {
        if (current.type !== type) return current;
        return {
          ...current,
          rows: [...current.rows, ...result.rows],
          lastDoc: result.lastDoc,
          loadingMore: false,
          hasMore: result.hasMore,
        };
      });
    } catch (error) {
      if (followModalRequestSeqRef.current !== requestId) return;
      console.error('[useProfileRuntime] load more follow modal failed:', error);
      setFollowModal((current) => {
        if (current.type !== type) return current;
        return {
          ...current,
          loadingMore: false,
          error: '無法載入更多名單',
        };
      });
    }
  }

  return {
    profileUid: user.uid,
    headerUser: { ...user, createdAt: toCreatedAtAdapter(user.createdAt) },
    stats,
    isStatsLoading,
    statsError,
    isSelf,
    canFollow,
    isFollowing,
    isFollowLoading,
    followError,
    onToggleFollow,
    followModal,
    openFollowModal,
    closeFollowModal,
    loadMoreFollowModal,
  };
}
