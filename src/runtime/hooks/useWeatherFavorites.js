'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWeather } from '@/repo/client/weather-api-repo';
import {
  addFavorite,
  getFavorites,
  isFavorited,
  removeFavorite,
} from '@/repo/client/firebase-weather-favorites-repo';
import { useToast } from '@/runtime/providers/ToastProvider';

/**
 * @typedef {import('@/components/weather/FavoritesBar').FavoriteItem} FavoriteItem
 * @typedef {import('@/components/weather/FavoritesBar').WeatherSummaryData} WeatherSummaryData
 */

/**
 * @typedef {object} SelectedLocation
 * @property {string} countyCode - 縣市代碼。
 * @property {string} countyName - 縣市名。
 * @property {string | null} townshipCode - 鄉鎮代碼。
 * @property {string | null} townshipName - 鄉鎮名。
 * @property {string | null} displaySuffix - 龜山島等特殊後綴。
 */

/**
 * @typedef {object} FavoriteStatus
 * @property {boolean} favorited - 是否已收藏。
 * @property {string | null} docId - 收藏文件 ID。
 */

/**
 * @typedef {object} UseWeatherFavoritesReturn
 * @property {FavoriteItem[]} favorites - 使用者收藏清單。
 * @property {Record<string, WeatherSummaryData>} favSummaries - 各收藏項的天氣摘要。
 * @property {FavoriteStatus} currentFavStatus - 目前地點的收藏狀態。
 * @property {boolean} isFavoriteMutating - 是否正在新增/移除收藏。
 * @property {() => Promise<FavoriteItem[]>} loadFavorites - 載入使用者收藏清單與摘要。
 * @property {(location: SelectedLocation | null) => Promise<void>} refreshCurrentFavoriteStatus - 重新查詢目前地點的收藏狀態。
 * @property {() => Promise<void>} handleFavoriteToggle - 切換目前地點的收藏狀態。
 * @property {(favorite: FavoriteItem) => Promise<void>} handleFavoriteSelect - 點選收藏項時觸發地點切換。
 * @property {(favorite: FavoriteItem) => Promise<void>} handleFavoriteRemove - 移除收藏項。
 * @property {() => void} resetFavoriteStatus - 重置收藏狀態為預設值。
 */

/** @type {FavoriteStatus} */
const DEFAULT_FAVORITE_STATUS = Object.freeze({ favorited: false, docId: null });

/**
 * 比對兩個地點是否指向同一收藏目標。
 * @param {{ countyCode: string, townshipCode: string | null } | null | undefined} left - 左側地點。
 * @param {{ countyCode: string, townshipCode: string | null } | null | undefined} right - 右側地點。
 * @returns {boolean} 是否相同。
 */
export function isSameLocation(left, right) {
  return (
    !!left &&
    !!right &&
    left.countyCode === right.countyCode &&
    left.townshipCode === right.townshipCode
  );
}

/**
 * 將天氣資料縮成收藏列摘要。
 * @param {import('@/types/weather-types').WeatherInfo} weatherData - 完整天氣資料。
 * @returns {WeatherSummaryData} 收藏列摘要。
 */
function buildFavoriteSummary(weatherData) {
  return {
    weatherCode: weatherData.today.weatherCode,
    currentTemp: weatherData.today.currentTemp,
  };
}

/**
 * 天氣收藏相關狀態與操作。
 * @param {object} params - 傳入參數。
 * @param {SelectedLocation | null} params.selectedLocation - 目前選取的地點。
 * @param {import('@/runtime/providers/AuthProvider').AuthContextValue['user']} params.user - 目前登入的使用者。
 * @param {(location: SelectedLocation) => Promise<void>} params.selectLocation - 選取地點並載入天氣的函式。
 * @returns {UseWeatherFavoritesReturn} 收藏狀態與操作。
 */
export default function useWeatherFavorites({ selectedLocation, user, selectLocation }) {
  const { showToast } = useToast();

  const [favorites, setFavorites] = useState(/** @type {FavoriteItem[]} */ ([]));
  const [favSummaries, setFavSummaries] = useState(
    /** @type {Record<string, WeatherSummaryData>} */ ({}),
  );
  const [currentFavStatus, setCurrentFavStatus] = useState(
    /** @type {FavoriteStatus} */ (DEFAULT_FAVORITE_STATUS),
  );
  const [isFavoriteMutating, setIsFavoriteMutating] = useState(false);

  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * 重置收藏狀態為預設值。
   * @returns {void}
   */
  const resetFavoriteStatus = useCallback(() => {
    setCurrentFavStatus(DEFAULT_FAVORITE_STATUS);
  }, []);

  /**
   * 載入使用者收藏清單與摘要。
   * @returns {Promise<FavoriteItem[]>} 收藏清單。
   */
  const loadFavorites = useCallback(async () => {
    if (!user) {
      if (isMountedRef.current) {
        setFavorites([]);
        setFavSummaries({});
        setCurrentFavStatus(DEFAULT_FAVORITE_STATUS);
      }
      return [];
    }

    try {
      const favoriteItems = await getFavorites(user.uid);
      const summaryEntries = await Promise.all(
        favoriteItems.map(async (favorite) => {
          try {
            const data = await fetchWeather({
              county: favorite.countyName,
              township: favorite.townshipName,
            });
            return [favorite.id, buildFavoriteSummary(data)];
          } catch {
            return [favorite.id, { weatherCode: '', currentTemp: null }];
          }
        }),
      );

      if (isMountedRef.current) {
        setFavorites(favoriteItems);
        setFavSummaries(Object.fromEntries(summaryEntries));
      }

      return favoriteItems;
    } catch {
      return [];
    }
  }, [user]);

  /**
   * 重新查詢目前地點的收藏狀態。
   * @param {SelectedLocation | null} location - 目前地點。
   * @returns {Promise<void>}
   */
  const refreshCurrentFavoriteStatus = useCallback(
    async (location) => {
      if (!user || !location) {
        if (isMountedRef.current) {
          setCurrentFavStatus(DEFAULT_FAVORITE_STATUS);
        }
        return;
      }

      try {
        const favoriteStatus = await isFavorited(
          user.uid,
          location.countyCode,
          location.townshipCode,
        );
        if (isMountedRef.current) {
          setCurrentFavStatus(favoriteStatus);
        }
      } catch {
        if (isMountedRef.current) {
          setCurrentFavStatus(DEFAULT_FAVORITE_STATUS);
        }
      }
    },
    [user],
  );

  /**
   * 切換目前地點的收藏狀態。
   * @returns {Promise<void>}
   */
  const handleFavoriteToggle = useCallback(async () => {
    if (!selectedLocation) return;
    if (!user) {
      showToast('請先登入才能收藏', 'info');
      return;
    }
    if (isFavoriteMutating) return;

    const previousStatus = currentFavStatus;
    setIsFavoriteMutating(true);
    setCurrentFavStatus((status) => ({ ...status, favorited: !status.favorited }));

    try {
      if (previousStatus.favorited && previousStatus.docId) {
        await removeFavorite(user.uid, previousStatus.docId);
        if (isMountedRef.current) {
          setCurrentFavStatus(DEFAULT_FAVORITE_STATUS);
        }
        showToast('已取消收藏', 'success');
      } else {
        const favoriteDocId = await addFavorite(user.uid, selectedLocation);
        if (isMountedRef.current) {
          setCurrentFavStatus({ favorited: true, docId: favoriteDocId });
        }
        showToast('已收藏', 'success');
      }

      await loadFavorites();
    } catch {
      if (isMountedRef.current) {
        setCurrentFavStatus(previousStatus);
      }
      showToast('操作失敗，請稍後再試', 'error');
    } finally {
      if (isMountedRef.current) {
        setIsFavoriteMutating(false);
      }
    }
  }, [currentFavStatus, isFavoriteMutating, loadFavorites, selectedLocation, showToast, user]);

  /**
   * 點選收藏項時切換到該地點。
   * @param {FavoriteItem} favorite - 被點選的收藏項。
   * @returns {Promise<void>}
   */
  const handleFavoriteSelect = useCallback(
    (favorite) =>
      selectLocation({
        countyCode: favorite.countyCode,
        countyName: favorite.countyName,
        townshipCode: favorite.townshipCode,
        townshipName: favorite.townshipName,
        displaySuffix: favorite.displaySuffix ?? null,
      }),
    [selectLocation],
  );

  /**
   * 移除指定收藏項。
   * @param {FavoriteItem} favorite - 要移除的收藏項。
   * @returns {Promise<void>}
   */
  const handleFavoriteRemove = useCallback(
    async (favorite) => {
      if (!user) return;

      try {
        await removeFavorite(user.uid, favorite.id);
        await loadFavorites();

        if (isSameLocation(selectedLocation, favorite) && isMountedRef.current) {
          setCurrentFavStatus(DEFAULT_FAVORITE_STATUS);
        }
      } catch {
        // 收藏列刪除失敗維持靜默，避免干擾主流程。
      }
    },
    [loadFavorites, selectedLocation, user],
  );

  return {
    favorites,
    favSummaries,
    currentFavStatus,
    isFavoriteMutating,
    loadFavorites,
    refreshCurrentFavoriteStatus,
    handleFavoriteToggle,
    handleFavoriteSelect,
    handleFavoriteRemove,
    resetFavoriteStatus,
  };
}
