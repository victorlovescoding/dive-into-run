'use client';

import { useState, useRef, useCallback, useMemo, useEffect, useContext } from 'react';
import { feature } from 'topojson-client';
import TaiwanMap from './TaiwanMap';
import WeatherCard from './WeatherCard';
import WeatherCardEmpty from './WeatherCardEmpty';
import WeatherCardSkeleton from './WeatherCardSkeleton';
import WeatherCardError from './WeatherCardError';
import BackToOverviewButton from './BackToOverviewButton';
import FavoriteButton from './FavoriteButton';
import FavoritesBar from './FavoritesBar';
import { fetchWeather } from '@/lib/weather-api';
import { getFavorites, isFavorited, removeFavorite } from '@/lib/firebase-weather-favorites';
import {
  ISLAND_MARKERS,
  encodeLocationParams,
  decodeLocationParams,
  saveLastLocation,
  loadLastLocation,
} from '@/lib/weather-helpers';
import { AuthContext } from '@/contexts/AuthContext';
import countiesData from '@/data/geo/counties.json';
import townsData from '@/data/geo/towns.json';
import styles from './weather.module.css';

// #region Types
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
// #endregion

// #region Code lookup tables (module-level, built once)
/**
 * 建立 countyName → countyCode 對照表（含 臺/台 雙向映射）。
 * @returns {Record<string, string>} 名稱對代碼的映射。
 */
function buildCountyCodeLookup() {
  const geoJson = /** @type {import('geojson').FeatureCollection} */ (
    feature(countiesData, countiesData.objects.counties)
  );
  /** @type {Record<string, string>} */
  const lookup = {};
  geoJson.features.forEach((feat) => {
    const name = feat.properties?.COUNTYNAME ?? '';
    const code = feat.properties?.COUNTYCODE ?? '';
    lookup[name] = code;
    if (name.includes('台')) {
      lookup[name.replace(/台/g, '臺')] = code;
    }
    if (name.includes('臺')) {
      lookup[name.replace(/臺/g, '台')] = code;
    }
  });
  return lookup;
}

/**
 * 建立 countyCode → countyName 反查表。
 * @returns {Record<string, string>} 代碼對名稱的映射。
 */
function buildCountyNameByCode() {
  const geoJson = /** @type {import('geojson').FeatureCollection} */ (
    feature(countiesData, countiesData.objects.counties)
  );
  /** @type {Record<string, string>} */
  const lookup = {};
  geoJson.features.forEach((feat) => {
    const code = feat.properties?.COUNTYCODE ?? '';
    const name = feat.properties?.COUNTYNAME ?? '';
    lookup[code] = name;
  });
  return lookup;
}

/**
 * 建立 townshipCode → { townshipName, countyCode, countyName } 反查表。
 * @returns {Record<string, { townshipName: string, countyCode: string, countyName: string }>} 鄉鎮反查。
 */
function buildTownshipLookupByCode() {
  const geoJson = /** @type {import('geojson').FeatureCollection} */ (
    feature(townsData, townsData.objects.towns)
  );
  /** @type {Record<string, { townshipName: string, countyCode: string, countyName: string }>} */
  const lookup = {};
  geoJson.features.forEach((feat) => {
    const townCode = feat.properties?.TOWNCODE ?? '';
    const townName = feat.properties?.TOWNNAME ?? '';
    const cCode = feat.properties?.COUNTYCODE ?? '';
    const cName = feat.properties?.COUNTYNAME ?? '';
    lookup[townCode] = { townshipName: townName, countyCode: cCode, countyName: cName };
  });
  return lookup;
}

const COUNTY_CODE_LOOKUP = buildCountyCodeLookup();
const COUNTY_NAME_BY_CODE = buildCountyNameByCode();
const TOWNSHIP_LOOKUP_BY_CODE = buildTownshipLookupByCode();
// #endregion

/**
 * 天氣頁面主容器 — 管理地圖互動、天氣資料載入與顯示狀態。
 * @returns {import('react').JSX.Element} 天氣頁面。
 */
export default function WeatherPage() {
  // #region State
  const { user } = useContext(AuthContext);
  /** @type {[SelectedLocation | null, import('react').Dispatch<import('react').SetStateAction<SelectedLocation | null>>]} */
  const [selectedLocation, setSelectedLocation] = useState(null);
  /** @type {[string, import('react').Dispatch<import('react').SetStateAction<string>>]} */
  const [mapLayer, setMapLayer] = useState('overview');
  /** @type {[WeatherStatus, import('react').Dispatch<import('react').SetStateAction<WeatherStatus>>]} */
  const [weatherState, setWeatherState] = useState(/** @type {WeatherStatus} */ ('idle'));
  /** @type {[import('@/lib/weather-api').WeatherInfo | null, import('react').Dispatch<import('react').SetStateAction<import('@/lib/weather-api').WeatherInfo | null>>]} */
  const [weatherData, setWeatherData] = useState(null);
  /** @type {[Array<import('./FavoritesBar').FavoriteItem>, import('react').Dispatch<import('react').SetStateAction<Array<import('./FavoritesBar').FavoriteItem>>>]} */
  const [favorites, setFavorites] = useState([]);
  /** @type {[Record<string, import('./FavoritesBar').WeatherSummaryData>, import('react').Dispatch<import('react').SetStateAction<Record<string, import('./FavoritesBar').WeatherSummaryData>>>]} */
  const [favSummaries, setFavSummaries] = useState({});
  const [currentFavStatus, setCurrentFavStatus] = useState({
    favorited: false,
    docId: /** @type {string | null} */ (null),
  });
  // #endregion

  // #region Refs
  /** @type {import('react').MutableRefObject<AbortController | null>} */
  const abortRef = useRef(null);
  /** @type {import('react').RefObject<HTMLDivElement | null>} */
  const cardPanelRef = useRef(null);
  // #endregion

  // #region Fetch helper
  /**
   * 取得指定地點的天氣資料（含前次請求取消）。
   * @param {string} county - 縣市名。
   * @param {string | null} township - 鄉鎮名。
   */
  const fetchLocationWeather = useCallback(async (county, township) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setWeatherState('loading');

    try {
      const data = await fetchWeather({
        county,
        township,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setWeatherData(data);
        setWeatherState('success');
        // 手機版 smooth scroll 到天氣卡 (FR-042)
        if (window.innerWidth < 768 && cardPanelRef.current) {
          cardPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } catch (err) {
      if (/** @type {Error} */ (err).name !== 'AbortError') {
        setWeatherState('error');
      }
    }
  }, []);
  // #endregion

  // #region Callbacks
  /**
   * 從儲存的地點資訊還原頁面狀態（URL params 或 localStorage）。
   * @param {{ countyCode: string, countyName?: string, townshipCode: string | null, townshipName?: string | null, displaySuffix?: string | null }} location - 地點資訊。
   */
  const restoreLocation = useCallback(
    (location) => {
      const { countyCode, townshipCode } = location;
      const countyName = location.countyName || COUNTY_NAME_BY_CODE[countyCode] || '';
      if (!countyName) return;

      let townshipName = location.townshipName || null;
      if (townshipCode && !townshipName) {
        const townInfo = TOWNSHIP_LOOKUP_BY_CODE[townshipCode];
        townshipName = townInfo?.townshipName || null;
      }

      setSelectedLocation({
        countyCode,
        countyName,
        townshipCode: townshipCode || null,
        townshipName,
        displaySuffix: location.displaySuffix || null,
      });
      setMapLayer('county');
      fetchLocationWeather(countyName, townshipName);
    },
    [fetchLocationWeather],
  );
  // #endregion

  // #region Handlers
  const handleCountyClick = useCallback(
    (/** @type {string} */ countyCode, /** @type {string} */ countyName) => {
      setSelectedLocation({
        countyCode,
        countyName,
        townshipCode: null,
        townshipName: null,
        displaySuffix: null,
      });
      setMapLayer('county');
      fetchLocationWeather(countyName, null);
    },
    [fetchLocationWeather],
  );

  const handleTownshipClick = useCallback(
    (
      /** @type {string} */ townshipCode,
      /** @type {string} */ townshipName,
      /** @type {string} */ countyCode,
      /** @type {string} */ countyName,
    ) => {
      setSelectedLocation((prev) => ({
        countyCode: prev?.countyCode ?? countyCode,
        countyName: prev?.countyName ?? countyName,
        townshipCode,
        townshipName,
        displaySuffix: prev?.displaySuffix ?? null,
      }));
      fetchLocationWeather(countyName, townshipName);
    },
    [fetchLocationWeather],
  );

  const handleIslandClick = useCallback(
    (/** @type {string} */ targetCounty, /** @type {string} */ targetTownship) => {
      const island = ISLAND_MARKERS.find(
        (m) => m.targetCounty === targetCounty && m.targetTownship === targetTownship,
      );
      const countyCode = COUNTY_CODE_LOOKUP[targetCounty] ?? '';

      setSelectedLocation({
        countyCode,
        countyName: targetCounty,
        townshipCode: null,
        townshipName: targetTownship,
        displaySuffix: island?.displaySuffix ?? null,
      });
      setMapLayer('county');
      fetchLocationWeather(targetCounty, targetTownship);
    },
    [fetchLocationWeather],
  );

  const handleRetry = useCallback(() => {
    if (!selectedLocation) return;
    const { countyName, townshipName } = selectedLocation;
    fetchLocationWeather(countyName, townshipName);
  }, [selectedLocation, fetchLocationWeather]);

  /** 回到全台總覽 — 清空選擇、中止請求、重置狀態 (FR-061)。 */
  const handleBackToOverview = useCallback(() => {
    setSelectedLocation(null);
    setMapLayer('overview');
    setWeatherState('idle');
    setWeatherData(null);
    if (abortRef.current) {
      abortRef.current.abort();
    }
    // URL params 會被 selectedLocation useEffect 自動清除
  }, []);

  // #region Favorites callbacks
  /**
   * 載入使用者收藏清單及各收藏的天氣摘要。
   * @returns {Promise<void>}
   */
  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setFavSummaries({});
      return;
    }
    try {
      const favs = await getFavorites(user.uid);
      setFavorites(favs);
      const summaryEntries = await Promise.all(
        favs.map(async (fav) => {
          try {
            const data = await fetchWeather({
              county: fav.countyName,
              township: fav.townshipName,
            });
            return [
              fav.id,
              { weatherCode: data.today.weatherCode, currentTemp: data.today.currentTemp },
            ];
          } catch {
            return [fav.id, { weatherCode: '', currentTemp: null }];
          }
        }),
      );
      setFavSummaries(Object.fromEntries(summaryEntries));
    } catch {
      // 靜默失敗 — 收藏是次要功能
    }
  }, [user]);

  /** 收藏/取消收藏後重新載入列表與狀態。 */
  const handleFavoriteToggle = useCallback(() => {
    loadFavorites();
    if (user && selectedLocation) {
      isFavorited(user.uid, selectedLocation.countyCode, selectedLocation.townshipCode)
        .then(setCurrentFavStatus)
        .catch(() => setCurrentFavStatus({ favorited: false, docId: null }));
    }
  }, [user, selectedLocation, loadFavorites]);

  /**
   * 點擊收藏項 → 切換地圖 + 載入天氣。
   * @param {import('./FavoritesBar').FavoriteItem} fav - 收藏項。
   */
  const handleFavoriteSelect = useCallback(
    (fav) => {
      setSelectedLocation({
        countyCode: fav.countyCode,
        countyName: fav.countyName,
        townshipCode: fav.townshipCode,
        townshipName: fav.townshipName,
        displaySuffix: fav.displaySuffix ?? null,
      });
      setMapLayer('county');
      fetchLocationWeather(fav.countyName, fav.townshipName);
    },
    [fetchLocationWeather],
  );

  /**
   * 從收藏列刪除收藏項。
   * @param {import('./FavoritesBar').FavoriteItem} fav - 收藏項。
   * @returns {Promise<void>}
   */
  const handleFavoriteRemove = useCallback(
    async (fav) => {
      if (!user) return;
      try {
        await removeFavorite(user.uid, fav.id);
        loadFavorites();
        if (
          selectedLocation?.countyCode === fav.countyCode &&
          selectedLocation?.townshipCode === fav.townshipCode
        ) {
          setCurrentFavStatus({ favorited: false, docId: null });
        }
      } catch {
        // 靜默
      }
    },
    [user, selectedLocation, loadFavorites],
  );
  // #endregion

  // #region Effects
  // URL state sync — 每次 selectedLocation 改變時同步到 URL (FR-059)
  useEffect(() => {
    if (!selectedLocation) {
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.toString());
      return;
    }
    const { countyCode, townshipCode } = selectedLocation;
    const params = encodeLocationParams(countyCode, townshipCode);
    const url = new URL(window.location.href);
    url.search = params;
    window.history.replaceState({}, '', url.toString());
  }, [selectedLocation]);

  // localStorage 儲存 — 每次 selectedLocation 改變時保存 (FR-063)
  useEffect(() => {
    if (selectedLocation) {
      saveLastLocation(selectedLocation);
    }
  }, [selectedLocation]);

  // 載入收藏清單 — user 變化時重新載入
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) {
          setFavorites([]);
          setFavSummaries({});
        }
        return;
      }
      try {
        const favs = await getFavorites(user.uid);
        if (cancelled) return;
        setFavorites(favs);
        const summaryEntries = await Promise.all(
          favs.map(async (fav) => {
            try {
              const data = await fetchWeather({
                county: fav.countyName,
                township: fav.townshipName,
              });
              return [
                fav.id,
                { weatherCode: data.today.weatherCode, currentTemp: data.today.currentTemp },
              ];
            } catch {
              return [fav.id, { weatherCode: '', currentTemp: null }];
            }
          }),
        );
        if (!cancelled) {
          setFavSummaries(Object.fromEntries(summaryEntries));
        }
      } catch {
        // 靜默失敗 — 收藏是次要功能
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // 檢查當前地點收藏狀態
  useEffect(() => {
    const defaultStatus = { favorited: false, docId: /** @type {string | null} */ (null) };
    if (!user || !selectedLocation) {
      Promise.resolve(defaultStatus).then(setCurrentFavStatus);
      return;
    }
    const { countyCode, townshipCode } = selectedLocation;
    isFavorited(user.uid, countyCode, townshipCode)
      .then(setCurrentFavStatus)
      .catch(() => setCurrentFavStatus(defaultStatus));
  }, [user, selectedLocation]);

  // Mount: 從 URL params / 收藏 / localStorage 還原初始狀態 (FR-060, FR-064a, T029)
  useEffect(() => {
    /** 根據優先順序還原初始地點。 */
    async function restoreInitial() {
      // 1. URL params 最優先
      const params = new URLSearchParams(window.location.search);
      const fromUrl = decodeLocationParams(params);
      if (fromUrl) {
        restoreLocation(fromUrl);
        return;
      }

      // 2. 有登入 → 嘗試收藏比對
      if (user) {
        try {
          const favs = await getFavorites(user.uid);
          if (favs.length > 0) {
            const saved = loadLastLocation();
            const match =
              saved &&
              favs.find(
                (f) => f.countyCode === saved.countyCode && f.townshipCode === saved.townshipCode,
              );
            if (match) {
              restoreLocation(saved);
              return;
            }
            // 否則顯示最新收藏
            const first = favs[0];
            restoreLocation({
              countyCode: first.countyCode,
              countyName: first.countyName,
              townshipCode: first.townshipCode,
              townshipName: first.townshipName,
              displaySuffix: first.displaySuffix ?? null,
            });
            return;
          }
        } catch {
          // fallthrough to localStorage
        }
      }

      // 3. localStorage
      const saved = loadLastLocation();
      if (saved) {
        restoreLocation(saved);
      }
    }

    restoreInitial();
  }, [user, restoreLocation]);
  // #endregion

  // #region Render helpers
  const selectedCountyCode = useMemo(
    () => selectedLocation?.countyCode ?? null,
    [selectedLocation],
  );
  const selectedTownshipCode = useMemo(
    () => selectedLocation?.townshipCode ?? null,
    [selectedLocation],
  );

  /**
   * 根據 weatherState 渲染對應的天氣卡片。
   * @returns {import('react').JSX.Element | null} 天氣卡片元件。
   */
  function renderWeatherCard() {
    if (weatherState === 'idle') return <WeatherCardEmpty />;
    if (weatherState === 'loading') return <WeatherCardSkeleton />;
    if (weatherState === 'error') return <WeatherCardError onRetry={handleRetry} />;
    if (weatherState === 'success' && weatherData) {
      return (
        <WeatherCard
          locationName={weatherData.locationName}
          today={weatherData.today}
          tomorrow={weatherData.tomorrow}
        />
      );
    }
    return null;
  }
  // #endregion

  return (
    <div className={styles.weatherRoot}>
      <div className={styles.pageLayout}>
        <div ref={cardPanelRef} className={styles.cardPanel}>
          {favorites.length > 0 && (
            <FavoritesBar
              favorites={favorites}
              summaries={favSummaries}
              activeId={currentFavStatus.favorited ? currentFavStatus.docId : null}
              onSelect={handleFavoriteSelect}
              onRemove={handleFavoriteRemove}
            />
          )}
          <div style={{ position: 'relative' }}>
            {renderWeatherCard()}
            {weatherState === 'success' && (
              <FavoriteButton
                location={selectedLocation}
                isFavorited={currentFavStatus.favorited}
                favoriteDocId={currentFavStatus.docId}
                onToggle={handleFavoriteToggle}
              />
            )}
          </div>
        </div>
        <div className={styles.mapPanel}>
          {mapLayer === 'county' && <BackToOverviewButton onClick={handleBackToOverview} />}
          <TaiwanMap
            mapLayer={/** @type {'overview' | 'county'} */ (mapLayer)}
            selectedCountyCode={selectedCountyCode}
            selectedTownshipCode={selectedTownshipCode}
            onCountyClick={handleCountyClick}
            onTownshipClick={handleTownshipClick}
            onIslandClick={handleIslandClick}
          />
        </div>
      </div>
    </div>
  );
}
