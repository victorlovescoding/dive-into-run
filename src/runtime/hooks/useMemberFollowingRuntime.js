'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';
import {
  listRunnerFollows,
  unfollowRunner,
} from '@/runtime/client/use-cases/follow-use-cases';

const LOAD_ERROR_MESSAGE = '追蹤跑友載入失敗，請稍後再試';
const UNFOLLOW_SUCCESS_MESSAGE = '已取消追蹤';
const UNFOLLOW_ERROR_MESSAGE = '取消追蹤失敗，請稍後再試';

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
 * @property {(row: MemberFollowingRow) => Promise<void>} unfollow - Row-level unfollow handler.
 */

/**
 * Normalizes follow rows into the member screen shape.
 * @param {Array<{ uid: string, name?: string, photoURL?: string, createdAt: unknown }>} rows - Follow use-case rows.
 * @returns {MemberFollowingRow[]} Member following rows.
 */
function normalizeRows(rows) {
  return rows
    .filter((row) => typeof row.uid === 'string' && row.uid.trim() !== '')
    .map((row) => ({
      uid: row.uid,
      name: row.name || row.uid,
      photoURL: row.photoURL || '',
      createdAt: row.createdAt,
    }));
}

/**
 * Member following page runtime orchestration.
 * @returns {MemberFollowingRuntime} Following list state and mutation handlers.
 */
export default function useMemberFollowingRuntime() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const { showToast } = useToast();
  const uid = user?.uid;
  const [items, setItems] = useState(/** @type {MemberFollowingRow[]} */ ([]));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingTargetUid, setPendingTargetUid] = useState(
    /** @type {string | null} */ (null),
  );
  const itemsRef = useRef(items);
  const requestIdRef = useRef(0);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadFollowing = useCallback(async () => {
    if (authLoading) {
      setIsLoading(true);
      setError('');
      return;
    }

    if (!uid) {
      requestIdRef.current += 1;
      setItems([]);
      setIsLoading(false);
      setError('');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError('');

    try {
      const rows = await listRunnerFollows({ uid, direction: 'following' });
      if (requestIdRef.current !== requestId) return;
      setItems(normalizeRows(rows));
    } catch (loadError) {
      if (requestIdRef.current !== requestId) return;
      console.error(loadError);
      setItems([]);
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [authLoading, uid]);

  useEffect(() => {
    loadFollowing();
  }, [loadFollowing]);

  const unfollow = useCallback(
    async (row) => {
      if (!uid || !row?.uid || pendingTargetUid) return;

      const previousItems = itemsRef.current;
      const targetUid = row.uid;
      setPendingTargetUid(targetUid);
      setItems(previousItems.filter((item) => item.uid !== targetUid));

      try {
        await unfollowRunner({ followerUid: uid, targetUid });
        showToast(UNFOLLOW_SUCCESS_MESSAGE, 'success');
      } catch (unfollowError) {
        console.error(unfollowError);
        setItems(previousItems);
        showToast(UNFOLLOW_ERROR_MESSAGE, 'error');
      } finally {
        setPendingTargetUid(null);
      }
    },
    [pendingTargetUid, showToast, uid],
  );

  return {
    items,
    followingCount: items.length,
    isLoading,
    error,
    authLoading,
    requiresSignIn: !authLoading && !uid,
    pendingTargetUid,
    unfollow,
  };
}
