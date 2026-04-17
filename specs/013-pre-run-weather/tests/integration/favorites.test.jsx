import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

// --- Mock next/image ---
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

// --- Mock react-leaflet ---
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
  useMap: () => ({
    fitBounds: vi.fn(),
    setView: vi.fn(),
    getContainer: () => ({ style: {} }),
    invalidateSize: vi.fn(),
  }),
}));

// --- Mock weather-api.js ---
vi.mock('@/lib/weather-api', () => ({
  fetchWeather: vi.fn(),
}));

// --- Mock firebase-weather-favorites ---
vi.mock('@/lib/firebase-weather-favorites', () => ({
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  getFavorites: vi.fn(),
  isFavorited: vi.fn(),
}));

import {
  addFavorite,
  removeFavorite,
  getFavorites,
  isFavorited,
} from '@/lib/firebase-weather-favorites';

const mockedFetchWeather = /** @type {import('vitest').Mock} */ (fetchWeather);
const mockedAddFavorite = /** @type {import('vitest').Mock} */ (addFavorite);
const mockedRemoveFavorite = /** @type {import('vitest').Mock} */ (removeFavorite);
const mockedGetFavorites = /** @type {import('vitest').Mock} */ (getFavorites);
const mockedIsFavorited = /** @type {import('vitest').Mock} */ (isFavorited);

// --- Hoisted values for mock factories (vi.mock is hoisted above all imports) ---
const { authValue, mockShowToast } = vi.hoisted(() => ({
  /** @type {{ user: { uid: string } | null, setUser: () => void, loading: boolean }} */
  authValue: { user: null, setUser: () => {}, loading: false },
  mockShowToast: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: /** @type {import('react').Context<object>} */ ({
    Provider: ({ children }) => children,
    Consumer: ({ children }) => children(authValue),
    _currentValue: authValue,
  }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast, removeToast: vi.fn(), toasts: [] }),
  ToastContext: /** @type {import('react').Context<object>} */ ({
    Provider: ({ children }) => children,
  }),
}));

// #region Test Data

/**
 * 建立測試用 WeatherInfo mock 資料。
 * @param {object} [overrides] - 要覆蓋的欄位。
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

const mockFavorites = [
  {
    id: 'fav-1',
    countyCode: '63000',
    countyName: '臺北市',
    townshipCode: null,
    townshipName: null,
    displaySuffix: null,
    createdAt: { seconds: 1000 },
  },
  {
    id: 'fav-2',
    countyCode: '65000',
    countyName: '新北市',
    townshipCode: '65000010',
    townshipName: '板橋區',
    displaySuffix: null,
    createdAt: { seconds: 900 },
  },
];

// #endregion

/**
 * 渲染 WeatherPage 並選取臺北市使天氣卡出現。
 * @param {object} [opts] - 選項。
 * @param {ReturnType<typeof userEvent.setup>} [opts.user] - userEvent instance。
 * @returns {Promise<void>} 渲染完成。
 */
async function renderAndSelectTaipei({ user } = {}) {
  mockedFetchWeather.mockResolvedValueOnce(makeWeatherInfo());
  render(<WeatherPage />);
  if (user) {
    await user.click(screen.getByTestId('feature-63000'));
    await screen.findByText(/28/);
  }
}

describe('Favorites integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authValue.user = null;
    mockedGetFavorites.mockResolvedValue([]);
    mockedIsFavorited.mockResolvedValue({ favorited: false, docId: null });
    mockedAddFavorite.mockResolvedValue('new-doc-id');
    mockedRemoveFavorite.mockResolvedValue(undefined);
  });

  // --- 1. 未登入點收藏 → toast 提示 ---
  describe('unauthenticated user', () => {
    it('should show toast when clicking favorite without login', async () => {
      const user = userEvent.setup();
      await renderAndSelectTaipei({ user });

      const favoriteBtn = screen.getByRole('button', { name: /收藏/i });
      await user.click(favoriteBtn);

      expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/登入/), expect.anything());
      expect(mockedAddFavorite).not.toHaveBeenCalled();
    });
  });

  // --- 2. 已登入收藏 → icon 填滿 + toast ---
  describe('authenticated user — add favorite', () => {
    it('should add favorite and show filled icon on click', async () => {
      authValue.user = { uid: 'test-uid' };
      const user = userEvent.setup();
      mockedIsFavorited.mockResolvedValue({ favorited: false, docId: null });
      await renderAndSelectTaipei({ user });

      const favoriteBtn = screen.getByRole('button', { name: /收藏/i });
      await user.click(favoriteBtn);

      await waitFor(() => {
        expect(mockedAddFavorite).toHaveBeenCalledWith(
          'test-uid',
          expect.objectContaining({ countyName: '臺北市' }),
        );
      });

      // Icon should change to filled state (optimistic update)
      expect(screen.getByRole('button', { name: /取消收藏/i })).toBeInTheDocument();
    });
  });

  // --- 3. 取消收藏 → icon 空心 + toast ---
  describe('authenticated user — remove favorite', () => {
    it('should remove favorite and show empty icon', async () => {
      authValue.user = { uid: 'test-uid' };
      const user = userEvent.setup();
      mockedIsFavorited.mockResolvedValue({ favorited: true, docId: 'existing-doc' });
      await renderAndSelectTaipei({ user });

      // Should initially show filled icon
      const favoriteBtn = await screen.findByRole('button', { name: /取消收藏/i });
      await user.click(favoriteBtn);

      await waitFor(() => {
        expect(mockedRemoveFavorite).toHaveBeenCalledWith('test-uid', 'existing-doc');
      });

      // Icon should revert to empty (optimistic update)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /加入收藏/i })).toBeInTheDocument();
      });
    });
  });

  // --- 4. 收藏區塊顯示 ---
  describe('favorites bar rendering', () => {
    it('should render favorite chips from getFavorites', async () => {
      authValue.user = { uid: 'test-uid' };
      mockedGetFavorites.mockResolvedValue(mockFavorites);
      // loadFavorites 會對每個 fav 呼叫 fetchWeather 取摘要
      mockedFetchWeather.mockResolvedValue(makeWeatherInfo());
      render(<WeatherPage />);

      // FavoritesBar uses formatLocationNameShort: 臺北市 → 臺北, 新北市+板橋區 → 新北 · 板橋
      await waitFor(() => {
        expect(screen.getByText('臺北')).toBeInTheDocument();
      });
      expect(screen.getByText(/板橋/)).toBeInTheDocument();
    });
  });

  // --- 5. 點收藏項 → 地圖切換 + 天氣更新 ---
  describe('clicking favorite chip', () => {
    it('should fetch weather and update card when clicking a favorite chip', async () => {
      authValue.user = { uid: 'test-uid' };
      const user = userEvent.setup();
      const banqiaoWeather = makeWeatherInfo({
        locationName: '新北市 · 板橋區',
        locationNameShort: '新北 · 板橋',
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
      mockedGetFavorites.mockResolvedValue(mockFavorites);
      // loadFavorites fetches summaries, then chip click fetches card weather
      mockedFetchWeather.mockResolvedValue(makeWeatherInfo());
      render(<WeatherPage />);

      // Wait for favorites to render (formatLocationNameShort: 新北 · 板橋)
      const chipButton = await screen.findByText(/板橋/);
      // Now set specific mock for the chip click fetch
      mockedFetchWeather.mockResolvedValueOnce(banqiaoWeather);
      await user.click(chipButton);

      // Should fetch weather for 板橋區
      await waitFor(() => {
        expect(mockedFetchWeather).toHaveBeenCalledWith(
          expect.objectContaining({
            county: '新北市',
            township: '板橋區',
          }),
        );
      });

      // Weather card should update
      await screen.findByText('新北市 · 板橋區');
    });
  });

  // --- 6. ✕ 移除收藏 → 區塊更新 ---
  describe('removing favorite via chip ✕ button', () => {
    it('should remove chip and call removeFavorite on ✕ click', async () => {
      authValue.user = { uid: 'test-uid' };
      const user = userEvent.setup();
      mockedGetFavorites.mockResolvedValue(mockFavorites);
      mockedFetchWeather.mockResolvedValue(makeWeatherInfo());
      render(<WeatherPage />);

      // Wait for favorites to render (formatLocationNameShort: 新北 · 板橋)
      await screen.findByText(/板橋/);

      // Find and click ✕ button on 板橋 chip — aria-label is "移除新北 · 板橋收藏"
      const chipContainer =
        screen.getByText(/板橋/).closest('[class*="Chip"]') ||
        screen.getByText(/板橋/).closest('[class*="chip"]');
      const removeBtn = within(/** @type {HTMLElement} */ (chipContainer)).getByRole('button', {
        name: /移除/i,
      });

      // After remove, getFavorites should return only the first fav
      mockedGetFavorites.mockResolvedValueOnce([mockFavorites[0]]);
      await user.click(removeBtn);

      await waitFor(() => {
        expect(mockedRemoveFavorite).toHaveBeenCalledWith('test-uid', 'fav-2');
      });

      // Chip should be removed after loadFavorites re-runs
      await waitFor(() => {
        expect(screen.queryByText(/板橋/)).not.toBeInTheDocument();
      });
    });
  });

  // --- 7. 樂觀更新失敗回滾 ---
  describe('optimistic update rollback', () => {
    it('should rollback UI and show error toast when addFavorite fails', async () => {
      authValue.user = { uid: 'test-uid' };
      const user = userEvent.setup();
      mockedAddFavorite.mockRejectedValueOnce(new Error('Firestore error'));
      mockedIsFavorited.mockResolvedValue({ favorited: false, docId: null });
      await renderAndSelectTaipei({ user });

      const favoriteBtn = screen.getByRole('button', { name: /加入收藏/i });
      await user.click(favoriteBtn);

      // Optimistic: icon should briefly fill, then rollback to empty
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /加入收藏/i })).toBeInTheDocument();
      });

      // Error toast should be shown — FavoriteButton calls showToast('操作失敗，請稍後再試', 'error')
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/失敗|稍後/), 'error');
    });
  });
});
