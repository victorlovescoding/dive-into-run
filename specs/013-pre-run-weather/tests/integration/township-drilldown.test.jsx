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
            properties: { COUNTYNAME: '新北市', COUNTYCODE: '65000' },
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
            TOWNNAME: '板橋區',
            TOWNCODE: '65000010',
            COUNTYCODE: '65000',
            COUNTYNAME: '新北市',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [121.4, 25.0],
                [121.45, 25.0],
                [121.45, 25.05],
                [121.4, 25.0],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            TOWNNAME: '中和區',
            TOWNCODE: '65000020',
            COUNTYCODE: '65000',
            COUNTYNAME: '新北市',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [121.45, 25.0],
                [121.5, 25.0],
                [121.5, 25.05],
                [121.45, 25.0],
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
        {features.map((feature) => (
          <button
            key={feature.properties.TOWNCODE || feature.properties.COUNTYCODE}
            type="button"
            data-testid={`feature-${feature.properties.TOWNCODE || feature.properties.COUNTYCODE}`}
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
            {feature.properties.TOWNNAME || feature.properties.COUNTYNAME}
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
        mapLayer: 'county',
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
          today: buildToday('多雲', 27),
          tomorrow: buildTomorrow(),
        },
      }));
    }, []);

    const handleTownshipClick = React.useCallback(
      (townshipCode, townshipName, countyCode, countyName) => {
        runtimeCalls.townshipClick(townshipCode, townshipName, countyCode, countyName);
        setState((prev) => ({
          ...prev,
          mapLayer: 'county',
          selectedCountyCode: countyCode,
          selectedTownshipCode: townshipCode,
          selectedLocation: {
            countyCode,
            countyName,
            townshipCode,
            townshipName,
            displaySuffix: null,
          },
          weatherState: 'success',
          weatherData: {
            locationName: `${countyName} · ${townshipName}`,
            today: buildToday(townshipCode === '65000010' ? '晴時多雲' : '陰時多雲', townshipCode === '65000010' ? 28 : 26),
            tomorrow: buildTomorrow(),
          },
        }));
      },
      [],
    );

    const handleBackToOverview = React.useCallback(() => {
      runtimeCalls.back();
      setState((prev) => ({
        ...prev,
        mapLayer: 'overview',
        selectedCountyCode: null,
        selectedTownshipCode: null,
        selectedLocation: null,
        weatherState: 'idle',
        weatherData: null,
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
      handleTownshipClick,
      handleIslandClick: vi.fn(),
      handleRetry: vi.fn(),
      handleBackToOverview,
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

describe('Township drill-down integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRuntimeScenario();
  });

  it('shows township features after clicking a county', async () => {
    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByTestId('feature-65000'));

    await waitFor(() => {
      expect(runtimeCalls.countyClick).toHaveBeenCalledWith('65000', '新北市');
    });
    expect(screen.getByText('板橋區')).toBeInTheDocument();
    expect(screen.getByText('中和區')).toBeInTheDocument();
    expect(screen.getByText('新北市')).toBeInTheDocument();
  });

  it('updates weather when a township is clicked', async () => {
    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByTestId('feature-65000'));
    await user.click(await screen.findByTestId('feature-65000010'));

    await waitFor(() => {
      expect(runtimeCalls.townshipClick).toHaveBeenCalledWith(
        '65000010',
        '板橋區',
        '65000',
        '新北市',
      );
    });
    expect(screen.getByText('新北市 · 板橋區')).toBeInTheDocument();
    expect(screen.getByText('晴時多雲')).toBeInTheDocument();
  });

  it('updates weather when switching between townships', async () => {
    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByTestId('feature-65000'));
    await user.click(await screen.findByTestId('feature-65000010'));
    await user.click(screen.getByTestId('feature-65000020'));

    await waitFor(() => {
      expect(runtimeCalls.townshipClick).toHaveBeenLastCalledWith(
        '65000020',
        '中和區',
        '65000',
        '新北市',
      );
    });
    expect(screen.getByText('新北市 · 中和區')).toBeInTheDocument();
    expect(screen.getByText('陰時多雲')).toBeInTheDocument();
  });

  it('returns to overview when clicking back button', async () => {
    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByTestId('feature-65000'));
    await user.click(screen.getByRole('button', { name: /全台總覽/ }));

    await waitFor(() => {
      expect(runtimeCalls.back).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('新北市')).toBeInTheDocument();
    expect(screen.queryByText('板橋區')).not.toBeInTheDocument();
  });
});
