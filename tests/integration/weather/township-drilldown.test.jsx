/**
 * @file Integration tests for township drill-down on `WeatherPage`.
 * @description
 * Verifies real `useWeatherPageRuntime` driving the page: clicking a county
 * surfaces township features and weather updates as the user drills down /
 * back. Mock boundary stays at:
 *   - `global.fetch` for `/api/weather`
 *   - `firebase/firestore` for favorites query (returns empty list)
 *   - `@/runtime/providers/AuthProvider` AuthContext (no logged-in user)
 *   - third-party leaflet / topojson-client / next/image (jsdom/runtime safety)
 *   - `@/data/geo/*` topology fixtures (real towns.json is 50k+ features)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeatherPage from '@/components/weather/WeatherPage';

/* ==========================================================================
   Hoisted shared state (mock factories pick these up before module init).
   ========================================================================== */

const { mockAuthContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return {
    mockAuthContext: createContext({
      user: null,
      setUser: () => {},
      loading: false,
    }),
  };
});

/* ==========================================================================
   Module mocks — third-party + provider boundary.
   ========================================================================== */

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

vi.mock('@/runtime/providers/AuthProvider', () => ({ AuthContext: mockAuthContext }));

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: { app: 'test-firestore' } }));

const firestoreMock = vi.hoisted(() => ({
  collection: vi.fn((db, ...segments) => ({ type: 'collection', db, path: segments.join('/') })),
  doc: vi.fn((db, ...segments) => ({ type: 'doc', db, path: segments.join('/') })),
  query: vi.fn((source, ...constraints) => ({ type: 'query', source, constraints })),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
  addDoc: vi.fn(async () => ({ id: 'noop' })),
  deleteDoc: vi.fn(async () => undefined),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => firestoreMock);

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * Build today weather payload for fetch fixture.
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
 * Build tomorrow weather payload for fetch fixture.
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
 * Build a successful /api/weather response Body shape.
 * @param {string} locationName - locationName 欄位。
 * @param {string} weatherDesc - 天氣描述。
 * @param {number} currentTemp - 當前溫度。
 * @returns {{ ok: true, data: import('@/types/weather-types').WeatherInfo }} API payload。
 */
function buildWeatherPayload(locationName, weatherDesc, currentTemp) {
  return {
    ok: true,
    data: {
      locationName,
      locationNameShort: locationName,
      today: buildToday(weatherDesc, currentTemp),
      tomorrow: buildTomorrow(),
    },
  };
}

/**
 * 安裝 fetch mock — 依 URL 的 county / township query 分流回不同 fixture。
 * @returns {import('vitest').Mock} fetch mock。
 */
function installWeatherFetch() {
  const fetchMock = vi.fn(async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    const params = new URL(url, 'http://localhost').searchParams;
    const township = params.get('township');
    const county = params.get('county');

    if (township === '板橋區') {
      return new Response(JSON.stringify(buildWeatherPayload('新北市 · 板橋區', '晴時多雲', 28)), {
        status: 200,
      });
    }
    if (township === '中和區') {
      return new Response(JSON.stringify(buildWeatherPayload('新北市 · 中和區', '陰時多雲', 26)), {
        status: 200,
      });
    }

    return new Response(JSON.stringify(buildWeatherPayload(county ?? '新北市', '多雲', 27)), {
      status: 200,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/* ==========================================================================
   Tests
   ========================================================================== */

describe('Township drill-down integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMock.getDocs.mockResolvedValue({ docs: [], empty: true, size: 0 });
    installWeatherFetch();
    globalThis.localStorage?.clear?.();
    // 重設 URL，避免上個 test 的 syncWeatherLocationToUrl 殘留影響下個 mount。
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows township features after clicking a county', async () => {
    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByTestId('feature-65000'));

    expect(await screen.findByText('板橋區')).toBeInTheDocument();
    expect(screen.getByText('中和區')).toBeInTheDocument();
    expect(screen.getByText('新北市')).toBeInTheDocument();
  });

  it('updates weather when a township is clicked', async () => {
    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByTestId('feature-65000'));
    await user.click(await screen.findByTestId('feature-65000010'));

    expect(await screen.findByText('新北市 · 板橋區')).toBeInTheDocument();
    expect(screen.getByText('晴時多雲')).toBeInTheDocument();
  });

  it('updates weather when switching between townships', async () => {
    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByTestId('feature-65000'));
    await user.click(await screen.findByTestId('feature-65000010'));
    await user.click(screen.getByTestId('feature-65000020'));

    expect(await screen.findByText('新北市 · 中和區')).toBeInTheDocument();
    expect(screen.getByText('陰時多雲')).toBeInTheDocument();
  });

  it('returns to overview when clicking back button', async () => {
    const user = userEvent.setup();
    render(<WeatherPage />);

    await user.click(screen.getByTestId('feature-65000'));
    await screen.findByText('板橋區');

    await user.click(screen.getByRole('button', { name: /全台總覽/ }));

    await waitFor(() => {
      expect(screen.queryByText('板橋區')).not.toBeInTheDocument();
    });
    expect(screen.getByText('新北市')).toBeInTheDocument();
  });
});
