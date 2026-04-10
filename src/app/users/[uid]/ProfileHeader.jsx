'use client';

import Image from 'next/image';
import styles from './PublicProfile.module.css';

/**
 * @typedef {object} ProfileHeaderUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 顯示名稱。
 * @property {string} photoURL - 頭像 URL（空字串代表無頭像，改用首字母 fallback）。
 * @property {string} [bio] - 個人簡介；未提供或為空字串時完全隱藏簡介區塊。
 * @property {{ toDate: () => Date }} createdAt - 加入平台日期，
 *   shape 與 Firestore Timestamp 相容（呼叫方確保 `toDate()` 可用）。
 */

/**
 * 將加入日期格式化為「YYYY 年 M 月 D 日」的正體中文字串。
 *
 * 之所以不直接用 `toLocaleDateString('zh-TW')`：不同 Node/ICU 版本在 jsdom
 * 與 CI 上可能回傳夾帶 U+200E 等不可見字元，導致測試在本機/雲端飄移。
 * 所以這裡明確用 `getFullYear` / `getMonth` / `getDate` 組合，結果穩定且
 * 符合測試期望（`/2024.*3.*15/`）。
 * @param {{ toDate: () => Date }} createdAt - Firestore Timestamp 風格物件。
 * @returns {string} 格式化後的加入日期字串，例如 `加入日期：2024 年 3 月 15 日`。
 */
function formatJoinDate(createdAt) {
  const date = createdAt.toDate();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `加入日期：${year} 年 ${month} 月 ${day} 日`;
}

/**
 * 將顯示名稱第一個字取出作為頭像 fallback 文字。
 * @param {string} name - 顯示名稱。
 * @returns {string} 首字母（若名稱為空則回傳空字串）。
 */
function getAvatarInitial(name) {
  if (typeof name !== 'string' || name.length === 0) return '';
  return name.charAt(0);
}

/**
 * 公開檔案頁首卡片：顯示頭像、名稱、簡介、加入日期。
 *
 * 設計重點：
 * 1. 頭像 fallback — 當 `photoURL` 為空字串時，渲染一個 `.avatarFallback` div
 *    顯示名稱首字，避免呼叫 `next/image` 時傳空 src 觸發錯誤，也能繞過
 *    `next/image` 在 `remotePatterns` 未設定來源時的執行期檢查。
 * 2. 簡介隱藏邏輯 — 依 clarification 2026-04-09，bio 為空字串或 undefined 時
 *    **整個區塊不渲染**，連 wrapper 都不輸出（測試用 `queryByTestId` 驗證）。
 * 3. XSS — React 自動轉義字串，bio 內含 `<script>` 會以文字呈現而非 DOM 節點。
 * @param {object} props - 元件屬性。
 * @param {ProfileHeaderUser} props.user - 公開檔案資料。
 * @returns {import('react').ReactElement} 頁首卡片。
 */
export default function ProfileHeader({ user }) {
  const { name, photoURL, bio, createdAt } = user;
  const hasAvatar = typeof photoURL === 'string' && photoURL.length > 0;
  const hasBio = typeof bio === 'string' && bio.length > 0;
  const joinDateLabel = formatJoinDate(createdAt);
  const avatarInitial = getAvatarInitial(name);

  return (
    <header className={styles.header}>
      <div className={styles.avatarWrapper}>
        {hasAvatar ? (
          <Image src={photoURL} alt={name} width={96} height={96} className={styles.avatar} />
        ) : (
          <div aria-hidden="true" className={styles.avatarFallback}>
            {avatarInitial}
          </div>
        )}
      </div>
      <div className={styles.headerText}>
        <h1 className={styles.name}>{name}</h1>
        {hasBio && (
          <p data-testid="profile-bio" className={styles.bio}>
            {bio}
          </p>
        )}
        <p className={styles.joinDate}>{joinDateLabel}</p>
      </div>
    </header>
  );
}
