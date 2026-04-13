'use client';

import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { addFavorite, removeFavorite } from '@/lib/firebase-weather-favorites';
import styles from './weather.module.css';

/**
 * @typedef {object} FavoriteLocation
 * @property {string} countyCode - 縣市代碼。
 * @property {string} countyName - 縣市名。
 * @property {string | null} townshipCode - 鄉鎮代碼。
 * @property {string | null} townshipName - 鄉鎮名。
 * @property {string | null} [displaySuffix] - 龜山島後綴。
 */

/**
 * 收藏按鈕元件 — 書籤 icon 空心/實心 toggle，樂觀更新 + 失敗回滾。
 * @param {object} props - 元件屬性。
 * @param {FavoriteLocation | null} props.location - 當前地點（null 時隱藏按鈕）。
 * @param {boolean} props.isFavorited - 目前是否已收藏。
 * @param {string | null} props.favoriteDocId - 已收藏的 Firestore doc ID。
 * @param {() => void} props.onToggle - 收藏/取消收藏後的回呼。
 * @returns {import('react').JSX.Element | null} 收藏按鈕或 null。
 */
export default function FavoriteButton({ location, isFavorited: isFav, favoriteDocId, onToggle }) {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();

  const [optimisticFav, setOptimisticFav] = useState(isFav);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOptimisticFav(isFav);
  }, [isFav]);

  /**
   * 處理收藏/取消收藏點擊 — 樂觀更新 UI，失敗則回滾。
   * @returns {Promise<void>}
   */
  async function handleClick() {
    if (!user) {
      showToast('請先登入才能收藏', 'info');
      return;
    }
    if (loading || !location) return;

    setLoading(true);
    const wasFav = optimisticFav;

    setOptimisticFav(!wasFav);

    try {
      if (wasFav && favoriteDocId) {
        await removeFavorite(user.uid, favoriteDocId);
        showToast('已取消收藏', 'success');
      } else {
        await addFavorite(user.uid, location);
        showToast('已收藏', 'success');
      }
      onToggle();
    } catch {
      setOptimisticFav(wasFav);
      showToast('操作失敗，請稍後再試', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!location) return null;

  return (
    <button
      type="button"
      className={styles.favoriteButton}
      onClick={handleClick}
      disabled={loading}
      aria-label={optimisticFav ? '取消收藏' : '加入收藏'}
    >
      <svg
        className={optimisticFav ? styles.favoriteIconActive : styles.favoriteIcon}
        viewBox="0 0 24 24"
        fill={optimisticFav ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
