import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeatherPage from '@/components/weather/WeatherPage';

const { runtimeScenario, mockAddFavorite, mockRemoveFavorite, mockShowToast, mockSelectFavorite } =
  vi.hoisted(() => ({
    runtimeScenario: {
      userLoggedIn: false,
      favorites: [],
      favSummaries: {},
      weatherState: 'idle',
      weatherData: null,
      selectedLocation: null,
      currentFavStatus: { favorited: false, docId: null },
      toggleShouldFail: false,
      nextFavoriteDocId: 'new-doc-id',
    },
    mockAddFavorite: vi.fn(),
    mockRemoveFavorite: vi.fn(),
    mockShowToast: vi.fn(),
    mockSelectFavorite: vi.fn(),
  }));

vi.mock('topojson-client', () => ({
  feature: vi.fn(() => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          COUNTYNAME: '臺北市',
          COUNTYCODE: '63000',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [121.5, 25.0],
              [121.6, 25.0],
              [121.6, 25.1],
              [121.5, 25.0],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          COUNTYNAME: '新北市',
          COUNTYCODE: '65000',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [121.4, 24.9],
              [121.5, 24.9],
              [121.5, 25.0],
              [121.4, 24.9],
            ],
          ],
        },
      },
    ],
  })),
}));

vi.mock('@/data/geo/counties.json', () => ({
  default: {
    type: 'Topology',
    objects: { counties: { type: 'GeometryCollection', geometries: [] } },
  },
}));

vi.mock('@/data/geo/towns.json', () => ({
  default: {
    type: 'Topology',
    objects: { towns: { type: 'GeometryCollection', geometries: [] } },
  },
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, unoptimized: _unoptimized, ...props }) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  GeoJSON: ({ data, onEachFeature }) => {
    const features = data?.features || [];
    return (
      <div data-testid="geojson-layer">
        {features.map((feature) => (
          <button
            key={feature.properties.COUNTYCODE}
            type="button"
            data-testid={`feature-${feature.properties.COUNTYCODE}`}
            onClick={() => {
              if (onEachFeature) {
                const handler = {};
                onEachFeature(feature, {
                  on: (events) => Object.assign(handler, events),
                  setStyle: vi.fn(),
                });
                handler.click?.({ target: { feature, setStyle: vi.fn() } });
              }
            }}
          >
            {feature.properties.COUNTYNAME}
          </button>
        ))}
      </div>
    );
  },
  useMap: () => ({
    fitBounds: vi.fn(),
    setView: vi.fn(),
    getContainer: () => ({ style: {} }),
    invalidateSize: vi.fn(),
  }),
}));

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast, removeToast: vi.fn(), toasts: [] }),
  ToastContext: /** @type {import('react').Context<object>} */ ({
    Provider: ({ children }) => children,
  }),
}));

vi.mock('@/runtime/hooks/useWeatherPageRuntime', async () => {
  const React = await import('react');

  /**
   * @returns {object} Mocked runtime for thin-entry WeatherPage integration tests.
   */
  function useMockWeatherPageRuntime() {
    const [favorites, setFavorites] = React.useState(runtimeScenario.favorites);
    const [favSummaries, setFavSummaries] = React.useState(runtimeScenario.favSummaries);
    const [selectedLocation, setSelectedLocation] = React.useState(
      runtimeScenario.selectedLocation,
    );
    const [weatherState, setWeatherState] = React.useState(runtimeScenario.weatherState);
    const [weatherData, setWeatherData] = React.useState(runtimeScenario.weatherData);
    const [currentFavStatus, setCurrentFavStatus] = React.useState(
      runtimeScenario.currentFavStatus,
    );
    const [isFavoriteMutating, setIsFavoriteMutating] = React.useState(false);
    const cardPanelRef = React.useRef(null);

    const handleCountyClick = React.useCallback((countyCode, countyName) => {
      setSelectedLocation({
        countyCode,
        countyName,
        townshipCode: null,
        townshipName: null,
        displaySuffix: null,
      });
      setWeatherData({
        locationName: countyName,
        today: {
          currentTemp: 28,
          weatherDesc: '晴時多雲',
          weatherCode: '2',
          morningTemp: 30,
          eveningTemp: 24,
          rainProb: 10,
          humidity: 72,
          uv: null,
          aqi: null,
        },
        tomorrow: {
          weatherDesc: '多雲',
          weatherCode: '4',
          morningTemp: 29,
          eveningTemp: 23,
          rainProb: 30,
          humidity: 78,
          uv: null,
        },
      });
      setWeatherState('success');
      setCurrentFavStatus({ favorited: false, docId: null });
    }, []);

    const handleFavoriteToggle = React.useCallback(async () => {
      if (!selectedLocation) return;

      if (!runtimeScenario.userLoggedIn) {
        mockShowToast('請先登入才能收藏', 'info');
        return;
      }

      setIsFavoriteMutating(true);
      const previousStatus = currentFavStatus;

      if (runtimeScenario.toggleShouldFail) {
        setCurrentFavStatus(previousStatus);
        mockShowToast('操作失敗，請稍後再試', 'error');
        setIsFavoriteMutating(false);
        return;
      }

      if (previousStatus.favorited && previousStatus.docId) {
        mockRemoveFavorite('test-uid', previousStatus.docId);
        setCurrentFavStatus({ favorited: false, docId: null });
        setFavorites((prev) => prev.filter((favorite) => favorite.id !== previousStatus.docId));
        mockShowToast('已取消收藏', 'success');
      } else {
        const favorite = {
          id: runtimeScenario.nextFavoriteDocId,
          countyCode: selectedLocation.countyCode,
          countyName: selectedLocation.countyName,
          townshipCode: selectedLocation.townshipCode,
          townshipName: selectedLocation.townshipName,
          displaySuffix: selectedLocation.displaySuffix ?? null,
        };

        mockAddFavorite('test-uid', favorite);
        setCurrentFavStatus({ favorited: true, docId: favorite.id });
        setFavorites((prev) => [...prev, favorite]);
        setFavSummaries((prev) => ({
          ...prev,
          [favorite.id]: { weatherCode: '2', currentTemp: 28 },
        }));
        mockShowToast('已收藏', 'success');
      }

      setIsFavoriteMutating(false);
    }, [currentFavStatus, selectedLocation]);

    const handleFavoriteSelect = React.useCallback((favorite) => {
      mockSelectFavorite(favorite);
      setSelectedLocation({
        countyCode: favorite.countyCode,
        countyName: favorite.countyName,
        townshipCode: favorite.townshipCode,
        townshipName: favorite.townshipName,
        displaySuffix: favorite.displaySuffix ?? null,
      });
      setCurrentFavStatus({ favorited: true, docId: favorite.id });
      setWeatherData({
        locationName: favorite.townshipName
          ? `${favorite.countyName} · ${favorite.townshipName}`
          : favorite.countyName,
        today: {
          currentTemp: favorite.id === 'fav-2' ? 26 : 28,
          weatherDesc: favorite.id === 'fav-2' ? '多雲' : '晴時多雲',
          weatherCode: favorite.id === 'fav-2' ? '4' : '2',
          morningTemp: 27,
          eveningTemp: 22,
          rainProb: 20,
          humidity: 75,
          uv: null,
          aqi: null,
        },
        tomorrow: {
          weatherDesc: '陰天',
          weatherCode: '7',
          morningTemp: 27,
          eveningTemp: 21,
          rainProb: 40,
          humidity: 80,
          uv: null,
        },
      });
      setWeatherState('success');
    }, []);

    const handleFavoriteRemove = React.useCallback((favorite) => {
      mockRemoveFavorite('test-uid', favorite.id);
      setFavorites((prev) => prev.filter((item) => item.id !== favorite.id));
    }, []);

    return {
      cardPanelRef,
      favorites,
      favSummaries,
      activeFavoriteId: currentFavStatus.favorited ? currentFavStatus.docId : null,
      selectedLocation,
      mapLayer: 'overview',
      weatherState,
      weatherData,
      isFavoriteMutating,
      isFavorited: currentFavStatus.favorited,
      selectedCountyCode: selectedLocation?.countyCode ?? null,
      selectedTownshipCode: selectedLocation?.townshipCode ?? null,
      handleCountyClick,
      handleTownshipClick: vi.fn(),
      handleIslandClick: vi.fn(),
      handleRetry: vi.fn(),
      handleBackToOverview: vi.fn(),
      handleFavoriteToggle,
      handleFavoriteSelect,
      handleFavoriteRemove,
    };
  }

  return {
    default: useMockWeatherPageRuntime,
  };
});

const mockFavorites = [
  {
    id: 'fav-1',
    countyCode: '63000',
    countyName: '臺北市',
    townshipCode: null,
    townshipName: null,
    displaySuffix: null,
  },
  {
    id: 'fav-2',
    countyCode: '65000',
    countyName: '新北市',
    townshipCode: '65000010',
    townshipName: '板橋區',
    displaySuffix: null,
  },
];

/**
 * 重置 mocked runtime scenario。
 * @returns {void}
 */
function resetRuntimeScenario() {
  runtimeScenario.userLoggedIn = false;
  runtimeScenario.favorites = [];
  runtimeScenario.favSummaries = {};
  runtimeScenario.weatherState = 'idle';
  runtimeScenario.weatherData = null;
  runtimeScenario.selectedLocation = null;
  runtimeScenario.currentFavStatus = { favorited: false, docId: null };
  runtimeScenario.toggleShouldFail = false;
  runtimeScenario.nextFavoriteDocId = 'new-doc-id';
}

/**
 * 先透過地圖選取臺北市，讓 favorite button 進入可互動狀態。
 * @param {{ user: ReturnType<typeof userEvent.setup> }} options - 測試選項。
 * @returns {Promise<void>}
 */
async function renderAndSelectTaipei({ user }) {
  render(<WeatherPage />);
  await user.click(screen.getByTestId('feature-63000'));
  await screen.findByRole('button', { name: /加入收藏/i });
}

describe('Favorites integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRuntimeScenario();
  });

  describe('unauthenticated user', () => {
    it('should show toast when clicking favorite without login', async () => {
      const user = userEvent.setup();
      await renderAndSelectTaipei({ user });

      await user.click(screen.getByRole('button', { name: /加入收藏/i }));

      expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/登入/), 'info');
      expect(mockAddFavorite).not.toHaveBeenCalled();
    });
  });

  describe('authenticated user — add favorite', () => {
    it('should add favorite and show filled icon on click', async () => {
      runtimeScenario.userLoggedIn = true;
      const user = userEvent.setup();
      await renderAndSelectTaipei({ user });

      await user.click(screen.getByRole('button', { name: /加入收藏/i }));

      await waitFor(() => {
        expect(mockAddFavorite).toHaveBeenCalledWith(
          'test-uid',
          expect.objectContaining({ countyName: '臺北市' }),
        );
      });
      expect(screen.getByRole('button', { name: /取消收藏/i })).toBeInTheDocument();
    });
  });

  describe('authenticated user — remove favorite', () => {
    it('should remove favorite and show empty icon', async () => {
      runtimeScenario.userLoggedIn = true;
      runtimeScenario.weatherState = 'success';
      runtimeScenario.weatherData = {
        locationName: '臺北市',
        today: {
          currentTemp: 28,
          weatherDesc: '晴時多雲',
          weatherCode: '2',
          morningTemp: 30,
          eveningTemp: 24,
          rainProb: 10,
          humidity: 72,
          uv: null,
          aqi: null,
        },
        tomorrow: {
          weatherDesc: '多雲',
          weatherCode: '4',
          morningTemp: 29,
          eveningTemp: 23,
          rainProb: 30,
          humidity: 78,
          uv: null,
        },
      };
      runtimeScenario.selectedLocation = {
        countyCode: '63000',
        countyName: '臺北市',
        townshipCode: null,
        townshipName: null,
        displaySuffix: null,
      };
      runtimeScenario.currentFavStatus = { favorited: true, docId: 'existing-doc' };
      runtimeScenario.favorites = [
        {
          id: 'existing-doc',
          countyCode: '63000',
          countyName: '臺北市',
          townshipCode: null,
          townshipName: null,
          displaySuffix: null,
        },
      ];
      runtimeScenario.favSummaries = {
        'existing-doc': { weatherCode: '2', currentTemp: 28 },
      };

      const user = userEvent.setup();
      render(<WeatherPage />);

      await user.click(screen.getByRole('button', { name: /取消收藏/i }));

      await waitFor(() => {
        expect(mockRemoveFavorite).toHaveBeenCalledWith('test-uid', 'existing-doc');
      });
      expect(screen.getByRole('button', { name: /加入收藏/i })).toBeInTheDocument();
    });
  });

  describe('favorites bar rendering', () => {
    it('should render favorite chips from runtime state', async () => {
      runtimeScenario.userLoggedIn = true;
      runtimeScenario.favorites = mockFavorites;
      runtimeScenario.favSummaries = {
        'fav-1': { weatherCode: '2', currentTemp: 28 },
        'fav-2': { weatherCode: '4', currentTemp: 26 },
      };

      render(<WeatherPage />);

      await waitFor(() => {
        expect(screen.getByText('臺北')).toBeInTheDocument();
      });
      expect(screen.getByText(/板橋/)).toBeInTheDocument();
    });
  });

  describe('clicking favorite chip', () => {
    it('should update card when clicking a favorite chip', async () => {
      runtimeScenario.userLoggedIn = true;
      runtimeScenario.favorites = mockFavorites;
      runtimeScenario.favSummaries = {
        'fav-1': { weatherCode: '2', currentTemp: 28 },
        'fav-2': { weatherCode: '4', currentTemp: 26 },
      };

      const user = userEvent.setup();
      render(<WeatherPage />);

      await user.click(await screen.findByRole('button', { name: /切換到新北.*板橋/i }));

      await waitFor(() => {
        expect(mockSelectFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 'fav-2' }));
      });
      expect(screen.getByText('新北市 · 板橋區')).toBeInTheDocument();
    });
  });

  describe('removing favorite via chip button', () => {
    it('should remove chip and call removeFavorite on click', async () => {
      runtimeScenario.userLoggedIn = true;
      runtimeScenario.favorites = mockFavorites;
      runtimeScenario.favSummaries = {
        'fav-1': { weatherCode: '2', currentTemp: 28 },
        'fav-2': { weatherCode: '4', currentTemp: 26 },
      };

      const user = userEvent.setup();
      render(<WeatherPage />);

      await screen.findByText(/板橋/);
      const removeBtn = await screen.findByRole('button', { name: /移除.*板橋.*收藏/ });

      await user.click(removeBtn);

      await waitFor(() => {
        expect(mockRemoveFavorite).toHaveBeenCalledWith('test-uid', 'fav-2');
      });
      expect(screen.queryByText(/板橋/)).not.toBeInTheDocument();
    });
  });

  describe('optimistic update rollback', () => {
    it('should rollback UI and show error toast when add favorite fails', async () => {
      runtimeScenario.userLoggedIn = true;
      runtimeScenario.toggleShouldFail = true;

      const user = userEvent.setup();
      await renderAndSelectTaipei({ user });

      await user.click(screen.getByRole('button', { name: /加入收藏/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /加入收藏/i })).toBeInTheDocument();
      });
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/失敗|稍後/), 'error');
    });
  });
});
