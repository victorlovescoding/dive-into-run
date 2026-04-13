import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchWeather } from '@/lib/weather-api';
import WeatherPage from '@/components/weather/WeatherPage';

// --- Mock topojson-client ---
vi.mock('topojson-client', () => ({
  feature: vi.fn(() => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          COUNTYNAME: '臺北市',
          COUNTYCODE: '63000',
          COUNTYENG: 'Taipei City',
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
          COUNTYENG: 'New Taipei City',
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
    ],
  })),
}));

// --- Mock GeoJSON data ---
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

// --- Mock react-leaflet with interactive GeoJSON + CircleMarker ---
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  GeoJSON: ({ data, onEachFeature }) => {
    const features = data?.features || [];
    return (
      <div data-testid="geojson-layer">
        {features.map((f) => (
          <button
            key={f.properties.TOWNCODE || f.properties.COUNTYCODE}
            type="button"
            data-testid={`feature-${f.properties.TOWNCODE || f.properties.COUNTYCODE}`}
            onClick={() => {
              if (onEachFeature) {
                const handler = {};
                onEachFeature(f, {
                  on: (events) => Object.assign(handler, events),
                  setStyle: vi.fn(),
                });
                handler.click?.({ target: { feature: f, setStyle: vi.fn() } });
              }
            }}
          >
            {f.properties.TOWNNAME || f.properties.COUNTYNAME}
          </button>
        ))}
      </div>
    );
  },
  CircleMarker: ({ children, eventHandlers }) => (
    <button type="button" data-testid="circle-marker" onClick={eventHandlers?.click}>
      {children}
    </button>
  ),
  Tooltip: ({ children }) => <span>{children}</span>,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}));

// --- Mock next/image ---
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- test mock for next/image
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

// --- Mock weather-api.js ---
vi.mock('@/lib/weather-api', () => ({
  fetchWeather: vi.fn(),
}));

// --- Mock firebase-weather-favorites ---
vi.mock('@/lib/firebase-weather-favorites', () => ({
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  getFavorites: vi.fn().mockResolvedValue([]),
  isFavorited: vi.fn().mockResolvedValue({ favorited: false, docId: null }),
}));

// --- Mock AuthContext ---
vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: /** @type {import('react').Context<object>} */ ({
    Provider: ({ children }) => children,
    Consumer: ({ children }) => children({ user: null, loading: false }),
    _currentValue: { user: null, setUser: () => {}, loading: false },
  }),
}));

// --- Mock ToastContext ---
vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
  ToastContext: /** @type {import('react').Context<object>} */ ({
    Provider: ({ children }) => children,
  }),
}));

const mockedFetchWeather = /** @type {import('vitest').Mock} */ (fetchWeather);

/**
 * 建立測試用 WeatherInfo mock 資料。
 * @param {object} overrides - 要覆蓋的欄位。
 * @returns {import('@/lib/weather-api').WeatherInfo} 天氣資料。
 */
function makeWeatherInfo(overrides = {}) {
  return {
    locationName: '臺北市',
    locationNameShort: '臺北',
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
    ...overrides,
  };
}

describe('WeatherPage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // --- Map rendering ---
  describe('map rendering', () => {
    it('should render the map container', () => {
      render(<WeatherPage />);

      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('should render county features as interactive elements', () => {
      render(<WeatherPage />);

      expect(screen.getByText('臺北市')).toBeInTheDocument();
      expect(screen.getByText('新北市')).toBeInTheDocument();
    });
  });

  // --- Initial empty state ---
  describe('initial empty state', () => {
    it('should show empty state when no location is selected', () => {
      render(<WeatherPage />);

      expect(screen.getByText(/請先在地圖上選擇/)).toBeInTheDocument();
    });
  });

  // --- County click → loading → weather card ---
  describe('county click → weather display', () => {
    it('should fetch and display weather when a county is clicked', async () => {
      const user = userEvent.setup();
      mockedFetchWeather.mockResolvedValueOnce(makeWeatherInfo());

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-63000'));

      await screen.findByText(/28/);
      expect(screen.getByText('晴時多雲')).toBeInTheDocument();
      expect(mockedFetchWeather).toHaveBeenCalledWith(
        expect.objectContaining({ county: '臺北市' }),
      );
    });

    it('should show loading skeleton while fetching weather', async () => {
      const user = userEvent.setup();
      /** @type {((v: unknown) => void) | undefined} */
      let resolveFetch;
      mockedFetchWeather.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-63000'));

      // Empty state should be gone, skeleton should be visible
      expect(screen.queryByText(/請先在地圖上選擇/)).not.toBeInTheDocument();

      // Resolve the fetch to clean up
      resolveFetch?.(makeWeatherInfo());
      await screen.findByText(/28/);
    });
  });

  // --- Fetch failure → error state + retry ---
  describe('error state and retry', () => {
    it('should show error state and retry button on fetch failure', async () => {
      const user = userEvent.setup();
      mockedFetchWeather.mockRejectedValueOnce(new Error('Network error'));

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-63000'));

      await screen.findByText(/無法取得天氣/);
      expect(screen.getByRole('button', { name: /重試/ })).toBeInTheDocument();
    });

    it('should retry fetching when retry button is clicked', async () => {
      const user = userEvent.setup();
      mockedFetchWeather
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(makeWeatherInfo());

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-63000'));

      const retryButton = await screen.findByRole('button', { name: /重試/ });
      await user.click(retryButton);

      await screen.findByText(/28/);
      expect(screen.getByText('晴時多雲')).toBeInTheDocument();
      expect(mockedFetchWeather).toHaveBeenCalledTimes(2);
    });
  });

  // --- Quick switch cancels previous request ---
  describe('quick location switching', () => {
    it('should abort previous request when switching locations quickly', async () => {
      const user = userEvent.setup();

      // First call: hangs until aborted
      mockedFetchWeather.mockImplementationOnce(
        ({ signal }) =>
          new Promise((resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      );

      // Second call: resolves with data for 大安區
      const daanWeather = makeWeatherInfo({
        locationName: '臺北市 · 大安區',
        locationNameShort: '臺北 · 大安',
        today: {
          currentTemp: 26,
          weatherDesc: '多雲',
          weatherCode: '4',
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
      mockedFetchWeather.mockResolvedValueOnce(daanWeather);

      render(<WeatherPage />);

      // Click 臺北市 first (triggers county drill-down)
      await user.click(screen.getByTestId('feature-63000'));
      // Quickly click 大安區 township (available in drill-down layer)
      await user.click(screen.getByTestId('feature-6300300'));

      // Should show 大安區 weather, not the county-level 臺北市 weather
      await screen.findByText(/多雲/);
      expect(screen.getByText('臺北市 · 大安區')).toBeInTheDocument();
      expect(screen.queryByText('晴時多雲')).not.toBeInTheDocument();
    });
  });

  // --- Weather card displays UV/AQI as "—" when null ---
  describe('null UV/AQI display', () => {
    it('should display "—" for UV and AQI when values are null', async () => {
      const user = userEvent.setup();
      mockedFetchWeather.mockResolvedValueOnce(makeWeatherInfo());

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-63000'));

      await screen.findByText(/28/);

      // UV and AQI should show — when null
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --- Island marker click → drill-down + weather ---
  describe('island marker interaction', () => {
    it('should trigger drill-down and fetch township weather on island click', async () => {
      const user = userEvent.setup();
      const lanyuWeather = makeWeatherInfo({
        locationName: '臺東縣 · 蘭嶼鄉',
        locationNameShort: '臺東 · 蘭嶼',
      });
      mockedFetchWeather.mockResolvedValueOnce(lanyuWeather);

      render(<WeatherPage />);

      const markers = screen.getAllByTestId('circle-marker');
      await user.click(markers[0]);

      await waitFor(() => {
        expect(mockedFetchWeather).toHaveBeenCalledWith(
          expect.objectContaining({ township: expect.any(String) }),
        );
      });
    });
  });
});
