'use client';

import styles from './weather.module.css';

/**
 * 收藏按鈕元件。
 * 只負責 render 與點擊事件轉發，不直接依賴 auth / toast / service。
 * @param {object} props - 元件屬性。
 * @param {boolean} props.isFavorited - 目前是否已收藏。
 * @param {boolean} [props.isLoading] - 是否處於 mutation 中。
 * @param {() => void | Promise<void>} props.onClick - 點擊後的 handler。
 * @returns {import('react').JSX.Element} 收藏按鈕。
 */
export default function FavoriteButton({ isFavorited, isLoading = false, onClick }) {
  return (
    <button
      type="button"
      className={styles.favoriteButton}
      onClick={onClick}
      disabled={isLoading}
      aria-label={isFavorited ? '取消收藏' : '加入收藏'}
    >
      <svg
        className={isFavorited ? styles.favoriteIconActive : styles.favoriteIcon}
        viewBox="0 0 24 24"
        fill={isFavorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
