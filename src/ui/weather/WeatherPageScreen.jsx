'use client';

import BackToOverviewButton from '@/components/weather/BackToOverviewButton';
import FavoriteButton from '@/components/weather/FavoriteButton';
import FavoritesBar from '@/components/weather/FavoritesBar';
import TaiwanMap from '@/components/weather/TaiwanMap';
import WeatherCard from '@/components/weather/WeatherCard';
import WeatherCardEmpty from '@/components/weather/WeatherCardEmpty';
import WeatherCardError from '@/components/weather/WeatherCardError';
import WeatherCardSkeleton from '@/components/weather/WeatherCardSkeleton';
import styles from '@/components/weather/weather.module.css';

/**
 * 依照 runtime weather state 渲染卡片內容。
 * @param {object} props - Render props。
 * @param {'idle' | 'loading' | 'success' | 'error'} props.weatherState - 目前天氣狀態。
 * @param {import('@/types/weather-types').WeatherInfo | null} props.weatherData - 天氣資料。
 * @param {() => void | Promise<void>} props.onRetry - 重試 handler。
 * @returns {import('react').ReactElement | null} 天氣卡片內容。
 */
function renderWeatherCard({ weatherState, weatherData, onRetry }) {
  if (weatherState === 'idle') return <WeatherCardEmpty />;
  if (weatherState === 'loading') return <WeatherCardSkeleton />;
  if (weatherState === 'error') return <WeatherCardError onRetry={onRetry} />;
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

  return (
    <div className={styles.weatherRoot}>
      <div className={styles.pageLayout}>
        <div ref={cardPanelRef} className={styles.cardPanel}>
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
            {renderWeatherCard({ weatherState, weatherData, onRetry: handleRetry })}
            {weatherState === 'success' && selectedLocation && (
              <FavoriteButton
                isFavorited={isFavorited}
                isLoading={isFavoriteMutating}
                onClick={handleFavoriteToggle}
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
