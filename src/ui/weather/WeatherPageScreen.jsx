'use client';

import { useEffect, useId, useRef, useState } from 'react';
import BackToOverviewButton from '@/components/weather/BackToOverviewButton';
import FavoriteButton from '@/components/weather/FavoriteButton';
import FavoritesBar from '@/components/weather/FavoritesBar';
import TaiwanMap from '@/components/weather/TaiwanMap';
import WeatherCard from '@/components/weather/WeatherCard';
import WeatherCardEmpty from '@/components/weather/WeatherCardEmpty';
import WeatherCardError from '@/components/weather/WeatherCardError';
import WeatherCardSkeleton from '@/components/weather/WeatherCardSkeleton';
import styles from '@/components/weather/weather.module.css';

const MOBILE_WEATHER_SHEET_MAX_WIDTH = 767;

/**
 * @returns {boolean} Whether the viewport matches the mobile bottom-sheet breakpoint.
 */
function getIsMobileWeatherSheetMode() {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_WEATHER_SHEET_MAX_WIDTH;
}

/**
 * Tracks only the presentation breakpoint used by the weather bottom sheet.
 * @returns {boolean} Whether bottom-sheet controls should be enabled.
 */
function useIsMobileWeatherSheetMode() {
  const [isMobileWeatherSheetMode, setIsMobileWeatherSheetMode] = useState(
    getIsMobileWeatherSheetMode,
  );

  useEffect(() => {
    const updateIsMobileWeatherSheetMode = () => {
      setIsMobileWeatherSheetMode(getIsMobileWeatherSheetMode());
    };

    updateIsMobileWeatherSheetMode();
    window.addEventListener('resize', updateIsMobileWeatherSheetMode);
    return () => window.removeEventListener('resize', updateIsMobileWeatherSheetMode);
  }, []);

  return isMobileWeatherSheetMode;
}

/**
 * 依照 runtime weather state 渲染卡片內容。
 * @param {object} props - Render props。
 * @param {'idle' | 'loading' | 'success' | 'error'} props.weatherState - 目前天氣狀態。
 * @param {import('@/types/weather-types').WeatherInfo | null} props.weatherData - 天氣資料。
 * @param {() => void | Promise<void>} props.onRetry - 重試 handler。
 * @param {boolean} props.isMobileStandardsSheetMode - Whether WeatherCard should render standards as a mobile sheet。
 * @param {(isOpen: boolean) => void} props.onStandardsSheetOpenChange - Standards sheet open-state callback。
 * @returns {import('react').ReactElement | null} 天氣卡片內容。
 */
function renderWeatherCard({
  weatherState,
  weatherData,
  onRetry,
  isMobileStandardsSheetMode,
  onStandardsSheetOpenChange,
}) {
  if (weatherState === 'idle') return <WeatherCardEmpty />;
  if (weatherState === 'loading') return <WeatherCardSkeleton />;
  if (weatherState === 'error') return <WeatherCardError onRetry={onRetry} />;
  if (weatherState === 'success' && weatherData) {
    return (
      <WeatherCard
        locationName={weatherData.locationName}
        today={weatherData.today}
        tomorrow={weatherData.tomorrow}
        isMobileStandardsSheetMode={isMobileStandardsSheetMode}
        onStandardsSheetOpenChange={onStandardsSheetOpenChange}
      />
    );
  }

  return null;
}

/**
 * 取得目前選取地點顯示文字。
 * @param {import('@/runtime/hooks/weather-page-runtime-helpers').SelectedLocation | null} selectedLocation - Runtime 選取地點。
 * @param {import('@/types/weather-types').WeatherInfo | null} weatherData - 已載入天氣資料。
 * @returns {string} 使用者可讀的地點名稱。
 */
function getSelectedLocationLabel(selectedLocation, weatherData) {
  if (weatherData?.locationName) return weatherData.locationName;
  if (!selectedLocation) return '';

  const { countyName, townshipName } = selectedLocation;
  return townshipName ? `${countyName} · ${townshipName}` : countyName;
}

/**
 * Mobile weather information sheet with location-scoped presentation state.
 * @param {object} props - Component props。
 * @param {import('react').Ref<HTMLElement>} props.cardPanelRef - Weather card panel ref。
 * @param {string} props.selectedLocationKey - Selected location identity。
 * @param {string} props.selectedLocationLabel - Selected location display label。
 * @param {boolean} props.isMobileWeatherSheetMode - Whether mobile sheet controls are enabled。
 * @param {boolean} props.isMobileStandardsSheetOpen - Whether the standards modal sheet is active。
 * @param {import('react').ReactNode} props.children - Weather information content。
 * @returns {import('react').ReactElement} Weather information panel。
 */
function WeatherInformationPanel({
  cardPanelRef,
  selectedLocationKey,
  selectedLocationLabel,
  isMobileWeatherSheetMode,
  isMobileStandardsSheetOpen,
  children,
}) {
  const weatherSheetContentId = useId();
  const [isWeatherSheetCollapsed, setIsWeatherSheetCollapsed] = useState(false);
  const isMobileWeatherSheetCollapsed = isMobileWeatherSheetMode && isWeatherSheetCollapsed;
  const shouldSuppressWeatherSheet = isMobileWeatherSheetMode && isMobileStandardsSheetOpen;
  const weatherSheetClassName = [
    styles.cardPanel,
    styles.weatherSheet,
    isMobileWeatherSheetCollapsed ? styles.weatherSheetCollapsed : '',
    shouldSuppressWeatherSheet ? styles.weatherSheetSuppressed : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      ref={cardPanelRef}
      className={weatherSheetClassName}
      aria-label="天氣資訊"
      aria-hidden={shouldSuppressWeatherSheet ? 'true' : undefined}
    >
      {selectedLocationKey && isMobileWeatherSheetMode && (
        <button
          type="button"
          className={styles.weatherSheetDismiss}
          aria-label={isMobileWeatherSheetCollapsed ? '展開天氣資訊' : '收合天氣資訊'}
          aria-expanded={!isMobileWeatherSheetCollapsed}
          aria-controls={weatherSheetContentId}
          onClick={() => setIsWeatherSheetCollapsed((isCollapsed) => !isCollapsed)}
        >
          <span className={styles.weatherSheetHandle} aria-hidden="true" />
        </button>
      )}
      {isMobileWeatherSheetMode && selectedLocationLabel && (
        <div>目前選取：{selectedLocationLabel}</div>
      )}
      <div
        id={weatherSheetContentId}
        data-testid="weather-sheet-content"
        hidden={isMobileWeatherSheetCollapsed}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Weather page UI screen。
 * @param {object} props - Component props。
 * @param {object} props.runtime - Weather runtime boundary。
 * @returns {import('react').ReactElement} 天氣頁面 UI。
 */
export default function WeatherPageScreen({ runtime }) {
  const {
    cardPanelRef,
    favorites,
    favSummaries,
    activeFavoriteId,
    selectedLocation,
    mapLayer,
    weatherState,
    weatherData,
    isFavoriteMutating,
    isFavorited,
    selectedCountyCode,
    selectedTownshipCode,
    handleCountyClick,
    handleTownshipClick,
    handleIslandClick,
    handleRetry,
    handleBackToOverview,
    handleFavoriteToggle,
    handleFavoriteSelect,
    handleFavoriteRemove,
  } = runtime;

  const selectedLocationKey = selectedLocation
    ? `${selectedLocation.countyCode}:${selectedLocation.townshipCode ?? ''}`
    : '';
  const selectedLocationLabel = getSelectedLocationLabel(selectedLocation, weatherData);
  const selectedLocationPresentationKey = selectedLocationKey
    ? `${selectedLocationKey}:${selectedLocationLabel}`
    : 'overview';
  const isMobileWeatherSheetMode = useIsMobileWeatherSheetMode();
  const [isMobileStandardsSheetOpen, setIsMobileStandardsSheetOpen] = useState(false);
  const pageContentRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const shouldInertPageContent = isMobileWeatherSheetMode && isMobileStandardsSheetOpen;
  const pageContentClassName = [
    styles.pageLayout,
    shouldInertPageContent ? styles.pageContentSuppressed : '',
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    const pageContentElement = pageContentRef.current;
    if (!pageContentElement) return undefined;

    const inertElement = /** @type {HTMLDivElement & { inert?: boolean }} */ (pageContentElement);
    inertElement.inert = shouldInertPageContent;
    if (shouldInertPageContent) pageContentElement.setAttribute('inert', '');
    else pageContentElement.removeAttribute('inert');

    return () => {
      inertElement.inert = false;
      pageContentElement.removeAttribute('inert');
    };
  }, [shouldInertPageContent]);

  const weatherInformationContent = (
    <>
      {favorites.length > 0 && (
        <FavoritesBar
          favorites={favorites}
          summaries={favSummaries}
          activeId={activeFavoriteId}
          onSelect={handleFavoriteSelect}
          onRemove={handleFavoriteRemove}
        />
      )}

      <div style={{ position: 'relative' }}>
        {renderWeatherCard({
          weatherState,
          weatherData,
          onRetry: handleRetry,
          isMobileStandardsSheetMode: isMobileWeatherSheetMode,
          onStandardsSheetOpenChange: setIsMobileStandardsSheetOpen,
        })}
        {weatherState === 'success' && selectedLocation && (
          <FavoriteButton
            isFavorited={isFavorited}
            isLoading={isFavoriteMutating}
            onClick={handleFavoriteToggle}
          />
        )}
      </div>
    </>
  );

  return (
    <div className={styles.weatherRoot}>
      <div
        ref={pageContentRef}
        className={pageContentClassName}
        data-testid="weather-page-content"
        aria-hidden={shouldInertPageContent ? 'true' : undefined}
      >
        <WeatherInformationPanel
          key={selectedLocationPresentationKey}
          cardPanelRef={cardPanelRef}
          selectedLocationKey={selectedLocationKey}
          selectedLocationLabel={selectedLocationLabel}
          isMobileWeatherSheetMode={isMobileWeatherSheetMode}
          isMobileStandardsSheetOpen={isMobileStandardsSheetOpen}
        >
          {weatherInformationContent}
        </WeatherInformationPanel>

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
