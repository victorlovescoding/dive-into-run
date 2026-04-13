import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchWeather } from '@/lib/weather-api';
import WeatherPage from '@/components/weather/WeatherPage';

// #region Mocks

// --- Mock topojson-client: returns counties or townships based on objects key ---
vi.mock('topojson-client', () => ({
  feature: vi.fn((topo, objects) => {
    if (objects === topo?.objects?.counties) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { COUNTYNAME: '新北市', COUNTYCODE: '65000', COUNTYENG: 'New Taipei City' },
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
    // towns — 新北市 townships
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

// --- Mock leaflet (used by TaiwanMap's FitBoundsHelper) ---
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

// --- Mock react-leaflet: renders features as clickable buttons ---
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  GeoJSON: ({ data, onEachFeature }) => {
    const features = data?.features || [];
    return (
      <div data-testid="geojson-layer">
        {features.map((f) => {
          const name = f.properties.TOWNNAME || f.properties.COUNTYNAME;
          const code = f.properties.TOWNCODE || f.properties.COUNTYCODE;
          return (
            <button
              key={code}
              type="button"
              data-testid={`feature-${code}`}
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
              {name}
            </button>
          );
        })}
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

// #endregion

// #region Test data
const mockNewTaipeiWeather = {
  locationName: '新北市',
  locationNameShort: '新北',
  today: {
    currentTemp: 27,
    weatherDesc: '多雲',
    weatherCode: '4',
    morningTemp: 29,
    eveningTemp: 23,
    rainProb: 20,
    humidity: 75,
    uv: null,
    aqi: null,
  },
  tomorrow: {
    weatherDesc: '陰',
    weatherCode: '7',
    morningTemp: 28,
    eveningTemp: 22,
    rainProb: 40,
    humidity: 80,
    uv: null,
  },
};

const mockBanqiaoWeather = {
  locationName: '新北市 · 板橋區',
  locationNameShort: '新北 · 板橋',
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

const mockZhongheWeather = {
  locationName: '新北市 · 中和區',
  locationNameShort: '新北 · 中和',
  today: {
    currentTemp: 26,
    weatherDesc: '陰時多雲',
    weatherCode: '6',
    morningTemp: 28,
    eveningTemp: 22,
    rainProb: 30,
    humidity: 78,
    uv: null,
    aqi: null,
  },
  tomorrow: {
    weatherDesc: '陰',
    weatherCode: '7',
    morningTemp: 27,
    eveningTemp: 21,
    rainProb: 50,
    humidity: 82,
    uv: null,
  },
};
// #endregion

describe('Township drill-down integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset URL to clean state
    window.history.replaceState({}, '', '/weather');
  });

  afterEach(() => {
    localStorage.clear();
  });

  // --- 1. County click → drill-down to township layer ---
  describe('county click → drill-down to townships', () => {
    it('should render township features after clicking a county', async () => {
      const user = userEvent.setup();
      mockedFetchWeather.mockResolvedValueOnce(mockNewTaipeiWeather);

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-65000'));

      // Township features should appear after drill-down
      await waitFor(() => {
        expect(screen.getByText('板橋區')).toBeInTheDocument();
        expect(screen.getByText('中和區')).toBeInTheDocument();
      });
    });

    it('should show county-level weather after drill-down', async () => {
      const user = userEvent.setup();
      mockedFetchWeather.mockResolvedValueOnce(mockNewTaipeiWeather);

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-65000'));

      // Weather card shows county-level weather
      await screen.findByText('27', { exact: false });
      expect(screen.getByText('多雲')).toBeInTheDocument();
      expect(mockedFetchWeather).toHaveBeenCalledWith(
        expect.objectContaining({ county: '新北市' }),
      );
    });
  });

  // --- 2. Township click → selected + weather update ---
  describe('township click → weather update', () => {
    it('should fetch township weather when a township is clicked', async () => {
      const user = userEvent.setup();
      mockedFetchWeather
        .mockResolvedValueOnce(mockNewTaipeiWeather)
        .mockResolvedValueOnce(mockBanqiaoWeather);

      render(<WeatherPage />);

      // Drill-down to 新北市
      await user.click(screen.getByTestId('feature-65000'));
      await screen.findByText('27', { exact: false });

      // Click 板橋區
      await user.click(screen.getByTestId('feature-65000010'));

      await screen.findByText('28', { exact: false });
      expect(screen.getByText('晴時多雲')).toBeInTheDocument();
      expect(mockedFetchWeather).toHaveBeenLastCalledWith(
        expect.objectContaining({ county: '新北市', township: '板橋區' }),
      );
    });
  });

  // --- 3. Switch township → previous deselected ---
  describe('switch between townships', () => {
    it('should update weather when switching from one township to another', async () => {
      const user = userEvent.setup();
      mockedFetchWeather
        .mockResolvedValueOnce(mockNewTaipeiWeather)
        .mockResolvedValueOnce(mockBanqiaoWeather)
        .mockResolvedValueOnce(mockZhongheWeather);

      render(<WeatherPage />);

      // Drill-down to 新北市
      await user.click(screen.getByTestId('feature-65000'));
      await screen.findByText('27', { exact: false });

      // Click 板橋區
      await user.click(screen.getByTestId('feature-65000010'));
      await screen.findByText('28', { exact: false });

      // Switch to 中和區
      await user.click(screen.getByTestId('feature-65000020'));
      await screen.findByText('26', { exact: false });
      expect(screen.getByText('陰時多雲')).toBeInTheDocument();
      expect(mockedFetchWeather).toHaveBeenCalledTimes(3);
    });
  });

  // --- 4. No township selected → county weather (FR-016) ---
  describe('no township selected shows county weather', () => {
    it('should display county-level weather when no township is selected', async () => {
      const user = userEvent.setup();
      mockedFetchWeather.mockResolvedValueOnce(mockNewTaipeiWeather);

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-65000'));

      // Should show county weather, not empty state
      await screen.findByText('27', { exact: false });
      expect(screen.getByText('新北市')).toBeInTheDocument();
      expect(screen.queryByText(/請先在地圖上選擇/)).not.toBeInTheDocument();
    });
  });

  // --- 5. BackToOverview button → back to overview ---
  describe('BackToOverview returns to overview', () => {
    it('should show BackToOverview button when in county layer', async () => {
      const user = userEvent.setup();
      mockedFetchWeather.mockResolvedValueOnce(mockNewTaipeiWeather);

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-65000'));
      await screen.findByText('27', { exact: false });

      // BackToOverview button should be visible
      expect(screen.getByRole('button', { name: /全台總覽/ })).toBeInTheDocument();
    });

    it('should return to overview when BackToOverview is clicked', async () => {
      const user = userEvent.setup();
      mockedFetchWeather.mockResolvedValueOnce(mockNewTaipeiWeather);

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-65000'));
      await screen.findByText('27', { exact: false });

      // Click BackToOverview
      await user.click(screen.getByRole('button', { name: /全台總覽/ }));

      // Should be back at overview — county features visible, empty/previous state
      await waitFor(() => {
        expect(screen.getByText('新北市')).toBeInTheDocument();
        expect(screen.queryByText('板橋區')).not.toBeInTheDocument();
      });
    });
  });

  // --- 6. URL params sync ---
  describe('URL params synchronization', () => {
    it('should update URL params when drilling down and selecting township', async () => {
      const user = userEvent.setup();
      mockedFetchWeather
        .mockResolvedValueOnce(mockNewTaipeiWeather)
        .mockResolvedValueOnce(mockBanqiaoWeather);

      render(<WeatherPage />);

      // Drill-down to 新北市
      await user.click(screen.getByTestId('feature-65000'));
      await screen.findByText('27', { exact: false });

      // Select 板橋區
      await user.click(screen.getByTestId('feature-65000010'));
      await screen.findByText('28', { exact: false });

      // URL should contain county and township params
      await waitFor(() => {
        const params = new URLSearchParams(window.location.search);
        expect(params.get('county')).toBeTruthy();
        expect(params.get('township')).toBeTruthy();
      });
    });

    it('should clear URL params when returning to overview', async () => {
      const user = userEvent.setup();
      mockedFetchWeather.mockResolvedValueOnce(mockNewTaipeiWeather);

      render(<WeatherPage />);
      await user.click(screen.getByTestId('feature-65000'));
      await screen.findByText('27', { exact: false });

      // Back to overview
      await user.click(screen.getByRole('button', { name: /全台總覽/ }));

      await waitFor(() => {
        const params = new URLSearchParams(window.location.search);
        expect(params.get('county')).toBeNull();
        expect(params.get('township')).toBeNull();
      });
    });
  });

  // --- 7. localStorage save/restore ---
  describe('localStorage persistence', () => {
    it('should save selected location to localStorage', async () => {
      const user = userEvent.setup();
      mockedFetchWeather
        .mockResolvedValueOnce(mockNewTaipeiWeather)
        .mockResolvedValueOnce(mockBanqiaoWeather);

      render(<WeatherPage />);

      // Drill-down + select township
      await user.click(screen.getByTestId('feature-65000'));
      await screen.findByText('27', { exact: false });
      await user.click(screen.getByTestId('feature-65000010'));
      await screen.findByText('28', { exact: false });

      // localStorage should have saved location
      await waitFor(() => {
        const stored = localStorage.getItem('dive-weather-last-location');
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(/** @type {string} */ (stored));
        expect(parsed.countyName).toBe('新北市');
        expect(parsed.townshipName).toBe('板橋區');
      });
    });

    it('should restore last location from localStorage on mount', async () => {
      // Pre-seed localStorage
      localStorage.setItem(
        'dive-weather-last-location',
        JSON.stringify({
          countyCode: '65000',
          countyName: '新北市',
          townshipCode: '65000010',
          townshipName: '板橋區',
        }),
      );
      mockedFetchWeather.mockResolvedValueOnce(mockBanqiaoWeather);

      render(<WeatherPage />);

      // Should auto-load 板橋區 weather from stored location
      await waitFor(() => {
        expect(mockedFetchWeather).toHaveBeenCalledWith(
          expect.objectContaining({ county: '新北市', township: '板橋區' }),
        );
      });
    });
  });
});
