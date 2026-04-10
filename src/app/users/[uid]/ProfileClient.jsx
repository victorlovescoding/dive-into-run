'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { getProfileStats } from '@/lib/firebase-profile';
import ProfileHeader from '@/app/users/[uid]/ProfileHeader';
import ProfileStats from '@/app/users/[uid]/ProfileStats';
import ProfileEventList from '@/app/users/[uid]/ProfileEventList';
import styles from './PublicProfile.module.css';

/**
 * @typedef {object} ProfileClientUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 個人簡介（可選）。
 * @property {Date | { toDate: () => Date }} createdAt - 加入日期，可能是：
 *   (1) Server Component 序列化傳進來的 `Date` 實例；
 *   (2) 測試／Client SDK 情境下已經是 Firestore 風格的 `{ toDate() }` 物件。
 */

/**
 * @typedef {object} ProfileStatsData
 * @property {number} hostedCount - 主辦活動數量。
 * @property {number} joinedCount - 參加活動數量。
 * @property {number | null} totalDistanceKm - 累計跑步公里數（`null` = 未連結 Strava）。
 */

/**
 * 將不同型態的 `createdAt` 正規化成 `ProfileHeader` 期待的
 * `{ toDate: () => Date }` 形狀。
 *
 * 為什麼需要這個 adapter：Server Component（`page.jsx`）無法將
 * `{ toDate: Function }` 作為 prop 傳給 Client Component（function 不能
 * 跨越 RSC boundary 序列化），所以在 server 端我們傳 `Date` 實例；
 * 測試則直接傳 Firestore 風格的 `{ toDate() }` stub。這個 adapter 讓兩種
 * 輸入都能被 `ProfileHeader` 以同一 API 消費。
 * @param {Date | { toDate: () => Date }} createdAt - 原始 createdAt。
 * @returns {{ toDate: () => Date }} 正規化後的 Firestore-like wrapper。
 */
function toCreatedAtAdapter(createdAt) {
  if (createdAt && typeof (/** @type {{ toDate?: unknown }} */ (createdAt).toDate) === 'function') {
    return /** @type {{ toDate: () => Date }} */ (createdAt);
  }
  if (createdAt instanceof Date) {
    return { toDate: () => createdAt };
  }
  throw new Error('ProfileClient.toCreatedAtAdapter: unsupported createdAt shape');
}

/**
 * 判斷目前登入者是否就是這個公開檔案的擁有者。
 *
 * 抽成 helper 是為了讓 JSX 維持 view-only（憲法 IX No Logic in JSX），
 * 並且把 `currentUser` 可能為 `null` 的 narrow 邏輯集中在這裡，避免在
 * render path 內出現 `?.` 鏈式判斷。
 * @param {{ uid: string } | null | undefined} currentUser - AuthContext 的 user。
 * @param {string} profileUid - 此檔案頁面對應的 uid。
 * @returns {boolean} 兩者 uid 相同則為 true。
 */
function isViewingOwnProfile(currentUser, profileUid) {
  if (!currentUser) return false;
  return currentUser.uid === profileUid;
}

/**
 * 公開檔案頁面的 client-side orchestrator。
 *
 * 責任：
 * 1. 接收 `page.jsx` (Server Component) 傳來的 `user` prop，正規化 `createdAt`
 *    之後轉交給 `ProfileHeader`。
 * 2. mount 時呼叫 `getProfileStats(user.uid)` 載入統計數據，管理 loading /
 *    error state。統計載入中顯示「載入中」，失敗顯示「無法載入」。
 * 3. `ProfileEventList` 因為自帶 loading/error/empty state 不需要父層管理，
 *    直接傳 `uid` 讓它自己 fetch。
 * 4. (US4) 比對 `AuthContext.user.uid` 與檔案 uid，若為本人則 render「這是
 *    你的公開檔案」banner，並提供「編輯個人資料」連結導向 `/member`。
 * @param {object} props - 元件屬性。
 * @param {ProfileClientUser} props.user - 已載入的公開檔案資料。
 * @returns {import('react').ReactElement} 公開檔案完整 UI。
 */
export default function ProfileClient({ user }) {
  // --- State ---
  const [stats, setStats] = useState(/** @type {ProfileStatsData | null} */ (null));
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(/** @type {string | null} */ (null));

  // --- Context ---
  const { user: currentUser } = useContext(AuthContext);

  // --- Derived ---
  // ProfileClient 是 root client component，`user` prop 的 reference 在元件
  // lifetime 內穩定，且 ProfileHeader 沒被 React.memo 包，不需要 useMemo。
  const headerUser = { ...user, createdAt: toCreatedAtAdapter(user.createdAt) };

  const isSelf = isViewingOwnProfile(currentUser, user.uid);

  // --- Effects ---
  // 只在 mount（或 uid 變更）時觸發一次統計載入；`isStatsLoading` 初始值已是
  // `true`，因此不需要在 effect body 同步 reset state（避免觸發 react-hooks/
  // set-state-in-effect lint 警告與不必要的 cascading render）。
  useEffect(() => {
    let cancelled = false;

    getProfileStats(user.uid)
      .then((result) => {
        if (cancelled) return;
        setStats(result);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[ProfileClient] getProfileStats failed:', err);
        setStatsError('無法載入統計');
      })
      .finally(() => {
        if (!cancelled) setIsStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  return (
    <main className={styles.container}>
      {isSelf && (
        <aside className={styles.selfBanner} aria-label="這是你的公開檔案">
          <span className={styles.selfBannerText}>這是你的公開檔案</span>
          <Link className={styles.selfBannerLink} href="/member">
            編輯個人資料
          </Link>
        </aside>
      )}

      <ProfileHeader user={headerUser} />

      {isStatsLoading && <p className={styles.loadingText}>載入中...</p>}

      {statsError && !isStatsLoading && <p className={styles.errorText}>{statsError}</p>}

      {stats && !isStatsLoading && !statsError && <ProfileStats stats={stats} />}

      <ProfileEventList uid={user.uid} />
    </main>
  );
}
