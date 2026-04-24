import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeatherPage from '@/components/weather/WeatherPage';

const { runtimeScenario, runtimeCalls } = vi.hoisted(() => ({
  runtimeScenario: {
    mapLayer: 'overview',
    selectedCountyCode: null,
    selectedTownshipCode: null,
    selectedLocation: null,
    weatherState: 'idle',
    weatherData: null,
  },
  runtimeCalls: {
    countyClick: vi.fn(),
    townshipClick: vi.fn(),
    islandClick: vi.fn(),
    retry: vi.fn(),
    back: vi.fn(),
  },
}));

vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}

    disconnect() {}
  },
);

vi.mock('leaflet', () => ({
  default: {
    geoJSON: vi.fn(() => ({
      getBounds: vi.fn(() => [
        [24, 121],
        [25, 122],
      ]),
    })),
  },
}));

vi.mock('topojson-client', () => ({
  feature: vi.fn((topo, objects) => {
    if (objects === topo?.objects?.counties) {
      return {
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
      };
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            COUNTYNAME: '臺北市',
            COUNTYCODE: '63000',
            TOWNNAME: '大安區',
            TOWNCODE: '6300300',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [121.53, 25.02],
                [121.55, 25.02],
                [121.55, 25.04],
                [121.53, 25.02],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            COUNTYNAME: '臺東縣',
            COUNTYCODE: '10014',
            TOWNNAME: '蘭嶼鄉',
            TOWNCODE: '1001411',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [121.5, 22.0],
                [121.6, 22.0],
                [121.6, 22.1],
                [121.5, 22.0],
              ],
            ],
          },
        },
      ],
    };
  }),
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
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  GeoJSON: ({ data, onEachFeature }) => {
    const features = data?.features || [];
    return (
      <div data-testid="geojson-layer">
        {features.map((feature) => {
          const testId = feature.properties.islandId
            ? `island-${feature.properties.islandId}`
            : `feature-${feature.properties.TOWNCODE || feature.properties.COUNTYCODE}`;
          const label = feature.properties.islandId
            ? feature.properties.targetTownship
            : feature.properties.TOWNNAME || feature.properties.COUNTYNAME;

          return (
            <button
              key={testId}
              type="button"
              data-testid={testId}
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
              {label}
            </button>
          );
        })}
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

vi.mock('@/runtime/hooks/useWeatherPageRuntime', async () => {
  const React = await import('react');

  /**
   * 建立今日天氣資料。
   * @param {string} weatherDesc - 天氣描述。
   * @param {number} currentTemp - 當前溫度。
   * @returns {import('@/types/weather-types').TodayWeather} 今日天氣。
   */
  function buildToday(weatherDesc, currentTemp) {
    return {
      currentTemp,
      weatherDesc,
      weatherCode: '2',
      morningTemp: currentTemp + 2,
      eveningTemp: currentTemp - 4,
      rainProb: 10,
      humidity: 72,
      uv: null,
      aqi: null,
    };
  }

  /**
   * 建立明日天氣資料。
   * @returns {import('@/types/weather-types').TomorrowWeather} 明日天氣。
   */
  function buildTomorrow() {
    return {
      weatherDesc: '多雲',
      weatherCode: '4',
      morningTemp: 29,
      eveningTemp: 23,
      rainProb: 30,
      humidity: 78,
      uv: null,
    };
  }

  /**
   * mocked weather page runtime。
   * @returns {object} runtime state 與 handlers。
   */
  function useMockWeatherPageRuntime() {
    const [state, setState] = React.useState(runtimeScenario);
    const cardPanelRef = React.useRef(null);

    const handleCountyClick = React.useCallback((countyCode, countyName) => {
      runtimeCalls.countyClick(countyCode, countyName);
      setState((prev) => ({
        ...prev,
        mapLayer: countyCode === '63000' ? 'county' : 'overview',
        selectedCountyCode: countyCode,
        selectedTownshipCode: null,
        selectedLocation: {
          countyCode,
          countyName,
          townshipCode: null,
          townshipName: null,
          displaySuffix: null,
        },
        weatherState: 'success',
        weatherData: {
          locationName: countyName,
          today: buildToday('晴時多雲', 28),
          tomorrow: buildTomorrow(),
        },
      }));
    }, []);

    const handleIslandClick = React.useCallback((countyName, townshipName) => {
      runtimeCalls.islandClick(countyName, townshipName);
      setState((prev) => ({
        ...prev,
        mapLayer: 'county',
        selectedCountyCode: '10014',
        selectedTownshipCode: null,
        selectedLocation: {
          countyCode: '10014',
          countyName,
          townshipCode: null,
          townshipName,
          displaySuffix: '（含離島）',
        },
        weatherState: 'success',
        weatherData: {
          locationName: `${countyName} · ${townshipName}`,
          today: buildToday('晴時多雲', 27),
          tomorrow: buildTomorrow(),
        },
      }));
    }, []);

    const handleRetry = React.useCallback(() => {
      runtimeCalls.retry();
      setState((prev) => ({
        ...prev,
        weatherState: 'success',
        weatherData: {
          locationName: prev.selectedLocation?.countyName ?? '臺北市',
          today: buildToday('晴時多雲', 28),
          tomorrow: buildTomorrow(),
        },
      }));
    }, []);

    return {
      cardPanelRef,
      favorites: [],
      favSummaries: {},
      activeFavoriteId: null,
      selectedLocation: state.selectedLocation,
      mapLayer: /** @type {'overview' | 'county'} */ (state.mapLayer),
      weatherState: /** @type {'idle' | 'loading' | 'success' | 'error'} */ (state.weatherState),
      weatherData: state.weatherData,
      isFavoriteMutating: false,
      isFavorited: false,
      selectedCountyCode: state.selectedCountyCode,
      selectedTownshipCode: state.selectedTownshipCode,
      handleCountyClick,
      handleTownshipClick: runtimeCalls.townshipClick,
      handleIslandClick,
      handleRetry,
      handleBackToOverview: runtimeCalls.back,
      handleFavoriteToggle: vi.fn(),
      handleFavoriteSelect: vi.fn(),
      handleFavoriteRemove: vi.fn(),
    };
  }

  return {
    default: useMockWeatherPageRuntime,
  };
});

/**
 * 重置 runtime scenario。
 * @returns {void}
 */
function resetRuntimeScenario() {
  runtimeScenario.mapLayer = 'overview';
  runtimeScenario.selectedCountyCode = null;
  runtimeScenario.selectedTownshipCode = null;
  runtimeScenario.selectedLocation = null;
  runtimeScenario.weatherState = 'idle';
  runtimeScenario.weatherData = null;
}

describe('WeatherPage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRuntimeScenario();
  });

  it('renders the map container and county features', () => {
    render(<WeatherPage />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByText('臺北市')).toBeInTheDocument();
    expect(screen.getByText('新北市')).toBeInTheDocument();
  });

  it('shows empty state when no location is selected', () => {
    render(<WeatherPage />);

    expect(screen.getByText(/請先在地圖上選擇/)).toBeInTheDocument();
  });

  it('updates the weather card when a county is clicked', async () => {
    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByTestId('feature-63000'));

    await waitFor(() => {
      expect(runtimeCalls.countyClick).toHaveBeenCalledWith('63000', '臺北市');
    });
    expect(screen.getByText('臺北市')).toBeInTheDocument();
    expect(screen.getByText('晴時多雲')).toBeInTheDocument();
    expect(screen.getByTestId('current-temperature')).toHaveTextContent('28°');
  });

  it('renders loading skeleton when runtime state is loading', () => {
    runtimeScenario.weatherState = 'loading';
    runtimeScenario.selectedLocation = {
      countyCode: '63000',
      countyName: '臺北市',
      townshipCode: null,
      townshipName: null,
      displaySuffix: null,
    };

    render(<WeatherPage />);

    expect(screen.queryByText(/請先在地圖上選擇/)).not.toBeInTheDocument();
    expect(document.querySelector('[class*="skeleton"]')).toBeTruthy();
  });

  it('calls retry handler from error state', async () => {
    runtimeScenario.weatherState = 'error';
    runtimeScenario.selectedLocation = {
      countyCode: '63000',
      countyName: '臺北市',
      townshipCode: null,
      townshipName: null,
      displaySuffix: null,
    };

    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByRole('button', { name: /重試/ }));

    await waitFor(() => {
      expect(runtimeCalls.retry).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('晴時多雲')).toBeInTheDocument();
  });

  it('triggers island click handler and updates weather card', async () => {
    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByTestId('island-lanyu'));

    await waitFor(() => {
      expect(runtimeCalls.islandClick).toHaveBeenCalledWith('臺東縣', '蘭嶼鄉');
    });
    expect(screen.getByText('臺東縣 · 蘭嶼鄉')).toBeInTheDocument();
  });
});
