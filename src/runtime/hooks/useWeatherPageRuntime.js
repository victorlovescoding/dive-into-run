'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchWeather } from '@/repo/client/weather-api-repo';
import {
  addFavorite,
  getFavorites,
  isFavorited,
  removeFavorite,
} from '@/repo/client/firebase-weather-favorites-repo';
import {
  findIslandMarkerByTarget,
  loadLastLocation,
  readWeatherLocationFromUrl,
  saveLastLocation,
  syncWeatherLocationToUrl,
} from '@/runtime/client/use-cases/weather-location-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { useToast } from '@/runtime/providers/ToastProvider';

/**
 * @typedef {object} SelectedLocation
 * @property {string} countyCode - 縣市代碼。
 * @property {string} countyName - 縣市名。
 * @property {string | null} townshipCode - 鄉鎮代碼。
 * @property {string | null} townshipName - 鄉鎮名。
 * @property {string | null} displaySuffix - 龜山島等特殊後綴。
 */

/**
 * @typedef {'idle' | 'loading' | 'success' | 'error'} WeatherStatus
 */

/**
 * @typedef {object} FavoriteStatus
 * @property {boolean} favorited - 是否已收藏。
 * @property {string | null} docId - 收藏文件 ID。
 */

/**
 * @typedef {object} WeatherGeoLookup
 * @property {Record<string, string>} countyCodeByName - countyName -> countyCode lookup.
 * @property {Record<string, string>} countyNameByCode - countyCode -> countyName lookup.
 * @property {Record<string, { townshipName: string, countyCode: string, countyName: string }>} townshipByCode - townshipCode lookup.
 */

/**
 * @typedef {import('@/components/weather/FavoritesBar').FavoriteItem} FavoriteItem
 * @typedef {import('@/components/weather/FavoritesBar').WeatherSummaryData} WeatherSummaryData
 */

/** @type {FavoriteStatus} */
const DEFAULT_FAVORITE_STATUS = Object.freeze({ favorited: false, docId: null });

/**
 * 將 location 正規化為頁面使用的 shape。
 * @param {SelectedLocation} location - 原始地點資料。
 * @returns {SelectedLocation} 正規化後地點。
 */
function normalizeSelectedLocation(location) {
  return {
    countyCode: location.countyCode,
    countyName: location.countyName,
    townshipCode: location.townshipCode ?? null,
    townshipName: location.townshipName ?? null,
    displaySuffix: location.displaySuffix ?? null,
  };
}

/**
 * 比對兩個地點是否指向同一收藏目標。
 * @param {{ countyCode: string, townshipCode: string | null } | null | undefined} left - 左側地點。
 * @param {{ countyCode: string, townshipCode: string | null } | null | undefined} right - 右側地點。
 * @returns {boolean} 是否相同。
 */
function isSameLocation(left, right) {
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
 * 天氣頁 runtime orchestration。
 * @param {WeatherGeoLookup} geoLookup - 由 thin entry 注入的地理 lookup。
 * @returns {object} runtime state 與 handlers。
 */
export default function useWeatherPageRuntime(geoLookup) {
  const { user, loading } = useContext(AuthContext);
  const { showToast } = useToast();

  /** @type {[SelectedLocation | null, import('react').Dispatch<import('react').SetStateAction<SelectedLocation | null>>]} */
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapLayer, setMapLayer] = useState('overview');
  const [weatherState, setWeatherState] = useState(/** @type {WeatherStatus} */ ('idle'));
  const [weatherData, setWeatherData] = useState(
    /** @type {import('@/types/weather-types').WeatherInfo | null} */ (null),
  );
  const [favorites, setFavorites] = useState(/** @type {FavoriteItem[]} */ ([]));
  const [favSummaries, setFavSummaries] = useState(
    /** @type {Record<string, WeatherSummaryData>} */ ({}),
  );
  const [currentFavStatus, setCurrentFavStatus] = useState(
    /** @type {FavoriteStatus} */ (DEFAULT_FAVORITE_STATUS),
  );
  const [isFavoriteMutating, setIsFavoriteMutating] = useState(false);

  const abortRef = useRef(/** @type {AbortController | null} */ (null));
  const cardPanelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const hasHydratedInitialLocationRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  /**
   * 從 code-based location 還原完整名稱。
   * @param {{ countyCode: string, countyName?: string, townshipCode: string | null, townshipName?: string | null, displaySuffix?: string | null }} location - 待解析的地點資料。
   * @returns {SelectedLocation | null} 完整地點資料。
   */
  const resolveLocation = useCallback(
    (location) => {
      const countyCode = location.countyCode ?? '';
      const countyName = location.countyName || geoLookup.countyNameByCode[countyCode] || '';
      if (!countyName) return null;

      const townshipCode = location.townshipCode ?? null;
      let townshipName = location.townshipName ?? null;
      let resolvedCountyCode = countyCode || geoLookup.countyCodeByName[countyName] || '';

      if (townshipCode && !townshipName) {
        const township = geoLookup.townshipByCode[townshipCode];
        townshipName = township?.townshipName || null;
        resolvedCountyCode = township?.countyCode || resolvedCountyCode;
      }

      return normalizeSelectedLocation({
        countyCode: resolvedCountyCode,
        countyName,
        townshipCode,
        townshipName,
        displaySuffix: location.displaySuffix ?? null,
      });
    },
    [geoLookup],
  );

  /**
   * 取得指定地點的天氣資料（含前次請求取消）。
   * @param {string} countyName - 縣市名。
   * @param {string | null} townshipName - 鄉鎮名。
   * @returns {Promise<void>}
   */
  const fetchLocationWeather = useCallback(async (countyName, townshipName) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isMountedRef.current) {
      setWeatherState('loading');
    }

    try {
      const data = await fetchWeather({
        county: countyName,
        township: townshipName,
        signal: controller.signal,
      });

      if (!isMountedRef.current || controller.signal.aborted) return;

      setWeatherData(data);
      setWeatherState('success');

      if (window.innerWidth < 768 && cardPanelRef.current) {
        cardPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (error) {
      if (!isMountedRef.current || controller.signal.aborted) return;
      if (/** @type {Error} */ (error).name !== 'AbortError') {
        setWeatherState('error');
      }
    }
  }, []);

  /**
   * 把地點設成目前選取值並載入天氣。
   * @param {SelectedLocation} location - 目標地點。
   * @returns {Promise<void>}
   */
  const selectLocation = useCallback(
    async (location) => {
      const normalizedLocation = normalizeSelectedLocation(location);
      setSelectedLocation(normalizedLocation);
      setMapLayer('county');
      await fetchLocationWeather(normalizedLocation.countyName, normalizedLocation.townshipName);
    },
    [fetchLocationWeather],
  );

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

  const handleCountyClick = useCallback(
    (countyCode, countyName) =>
      selectLocation({
        countyCode,
        countyName,
        townshipCode: null,
        townshipName: null,
        displaySuffix: null,
      }),
    [selectLocation],
  );

  const handleTownshipClick = useCallback(
    (townshipCode, townshipName, countyCode, countyName) =>
      selectLocation({
        countyCode,
        countyName,
        townshipCode,
        townshipName,
        displaySuffix: selectedLocation?.displaySuffix ?? null,
      }),
    [selectLocation, selectedLocation?.displaySuffix],
  );

  const handleIslandClick = useCallback(
    (targetCounty, targetTownship) => {
      const island = findIslandMarkerByTarget(targetCounty, targetTownship);
      const countyCode = geoLookup.countyCodeByName[targetCounty] ?? '';

      return selectLocation({
        countyCode,
        countyName: targetCounty,
        townshipCode: null,
        townshipName: targetTownship,
        displaySuffix: island?.displaySuffix ?? null,
      });
    },
    [geoLookup, selectLocation],
  );

  const handleRetry = useCallback(() => {
    if (!selectedLocation) return Promise.resolve();
    return fetchLocationWeather(selectedLocation.countyName, selectedLocation.townshipName);
  }, [fetchLocationWeather, selectedLocation]);

  const handleBackToOverview = useCallback(() => {
    abortRef.current?.abort();
    setSelectedLocation(null);
    setMapLayer('overview');
    setWeatherState('idle');
    setWeatherData(null);
    setCurrentFavStatus(DEFAULT_FAVORITE_STATUS);
  }, []);

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

  useEffect(() => {
    if (!hasHydratedInitialLocationRef.current) return;
    syncWeatherLocationToUrl(selectedLocation);
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedLocation) {
      saveLastLocation(selectedLocation);
    }
  }, [selectedLocation]);

  useEffect(() => {
    loadFavorites().catch(() => {});
  }, [loadFavorites]);

  useEffect(() => {
    refreshCurrentFavoriteStatus(selectedLocation).catch(() => {});
  }, [refreshCurrentFavoriteStatus, selectedLocation]);

  useEffect(() => {
    let cancelled = false;

    /** 根據優先順序還原初始地點。 */
    async function restoreInitialLocation() {
      if (loading) return;

      const restoreAndSelect = async (location) => {
        const resolvedLocation = resolveLocation(location);
        if (!resolvedLocation || cancelled) return false;

        hasHydratedInitialLocationRef.current = true;
        await selectLocation(resolvedLocation);
        return true;
      };

      const fromUrl = readWeatherLocationFromUrl();
      if (fromUrl && (await restoreAndSelect(fromUrl))) {
        return;
      }

      if (user) {
        try {
          const favoriteItems = await getFavorites(user.uid);
          if (cancelled) return;

          if (favoriteItems.length > 0) {
            const savedLocation = loadLastLocation();
            const matchedFavorite =
              savedLocation &&
              favoriteItems.find((favorite) => isSameLocation(favorite, savedLocation));

            if (matchedFavorite) {
              await restoreAndSelect(savedLocation);
              return;
            }

            const [latestFavorite] = favoriteItems;
            if (latestFavorite) {
              await restoreAndSelect(latestFavorite);
              return;
            }
          }
        } catch {
          // 收藏 restore 失敗時 fallback 到 localStorage。
        }
      }

      const savedLocation = loadLastLocation();
      if (savedLocation && (await restoreAndSelect(savedLocation))) {
        return;
      }

      hasHydratedInitialLocationRef.current = true;
    }

    restoreInitialLocation().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [loading, resolveLocation, selectLocation, user]);

  return {
    cardPanelRef,
    favorites,
    favSummaries,
    activeFavoriteId: currentFavStatus.favorited ? currentFavStatus.docId : null,
    selectedLocation,
    mapLayer,
    weatherState,
    weatherData,
    isFavoriteMutating,
    isFavorited: currentFavStatus.favorited,
    selectedCountyCode: selectedLocation?.countyCode ?? null,
    selectedTownshipCode: selectedLocation?.townshipCode ?? null,
    handleCountyClick,
    handleTownshipClick,
    handleIslandClick,
    handleRetry,
    handleBackToOverview,
    handleFavoriteToggle,
    handleFavoriteSelect,
    handleFavoriteRemove,
  };
}
