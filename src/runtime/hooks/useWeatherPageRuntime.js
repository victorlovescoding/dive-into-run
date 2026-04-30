'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchWeather } from '@/repo/client/weather-api-repo';
import { getFavorites } from '@/repo/client/firebase-weather-favorites-repo';
import {
  findIslandMarkerByTarget,
  loadLastLocation,
  readWeatherLocationFromUrl,
  saveLastLocation,
  syncWeatherLocationToUrl,
} from '@/runtime/client/use-cases/weather-location-use-cases';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import useWeatherFavorites, { isSameLocation } from '@/runtime/hooks/useWeatherFavorites';
import {
  normalizeSelectedLocation,
  resolveWeatherLocation,
} from '@/runtime/hooks/weather-page-runtime-helpers';

/**
 * @typedef {import('@/runtime/hooks/weather-page-runtime-helpers').SelectedLocation} SelectedLocation
 */

/**
 * @typedef {'idle' | 'loading' | 'success' | 'error'} WeatherStatus
 */

/**
 * @typedef {import('@/runtime/hooks/weather-page-runtime-helpers').WeatherGeoLookup} WeatherGeoLookup
 */

/**
 * 天氣頁 runtime orchestration。
 * @param {WeatherGeoLookup} geoLookup - 由 thin entry 注入的地理 lookup。
 * @returns {object} runtime state 與 handlers。
 */
export default function useWeatherPageRuntime(geoLookup) {
  const { user, loading } = useContext(AuthContext);

  /** @type {[SelectedLocation | null, import('react').Dispatch<import('react').SetStateAction<SelectedLocation | null>>]} */
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapLayer, setMapLayer] = useState('overview');
  const [weatherState, setWeatherState] = useState(/** @type {WeatherStatus} */ ('idle'));
  const [weatherData, setWeatherData] = useState(
    /** @type {import('@/types/weather-types').WeatherInfo | null} */ (null),
  );

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

  const resolveLocation = useCallback(
    (location) => resolveWeatherLocation(location, geoLookup),
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

  const {
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
  } = useWeatherFavorites({ selectedLocation, user, selectLocation });

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
    resetFavoriteStatus();
  }, [resetFavoriteStatus]);

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
