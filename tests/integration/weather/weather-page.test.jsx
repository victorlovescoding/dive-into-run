/**
 * @file Integration tests for `WeatherPage` thin entry.
 * @description
 * Drives the real `useWeatherPageRuntime` (no fake hook) against:
 *   - mocked `global.fetch` for `/api/weather` (success / error / signal-aware)
 *   - mocked `firebase/firestore` SDK (favorites query empty)
 *   - real `AuthContext.Provider` value (no logged-in user)
 *   - real `ToastContext.Provider` no-op value
 *   - third-party leaflet / topojson-client / next/image (jsdom safety)
 *   - `@/data/geo/*` topology fixtures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeatherPage from '@/components/weather/WeatherPage';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import { renderWithAuthToast } from '../../_helpers/provider-test-helpers';
import { createWeatherPayload } from '../../_helpers/use-weather-page-runtime-test-helpers';

/* ==========================================================================
   Module mocks.
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
            properties: { COUNTYNAME: '臺北市', COUNTYCODE: '63000' },
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
  MapContainer: ({ children }) => <div>{children}</div>,
  GeoJSON: ({ data, onEachFeature }) => {
    const features = data?.features || [];
    return (
      <div>
        {features.map((feature) => {
          const featureKey = feature.properties.islandId
            ? `island-${feature.properties.islandId}`
            : `feature-${feature.properties.TOWNCODE || feature.properties.COUNTYCODE}`;
          const label = feature.properties.islandId
            ? feature.properties.targetTownship
            : feature.properties.TOWNNAME || feature.properties.COUNTYNAME;

          return (
            <button
              key={featureKey}
              type="button"
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
 * @typedef {object} FetchControls
 * @property {() => void} setError - 把下次 /api/weather 改成回 ok=false。
 * @property {() => void} setSuccess - 把下次 /api/weather 改回成功。
 * @property {import('vitest').Mock} fetchMock - 內部 fetch mock，用於 spy。
 */

/**
 * 安裝 /api/weather fetch mock，依 URL 的 county / township 分流回不同 fixture。
 * @returns {FetchControls} 操作介面。
 */
function installWeatherFetch() {
  let nextResponse = /** @type {'success' | 'error'} */ ('success');

  const fetchMock = vi.fn(async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const params = new URL(url, 'http://localhost').searchParams;
    const county = params.get('county') ?? '臺北市';
    const township = params.get('township');

    if (init?.signal?.aborted) {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }

    if (nextResponse === 'error') {
      nextResponse = 'success';
      return new Response(JSON.stringify({ ok: false, error: 'mocked failure' }), {
        status: 500,
      });
    }

    let weatherDesc = '晴時多雲';
    let currentTemp = 28;
    let locationName = township ? `${county} · ${township}` : county;
    if (township === '蘭嶼鄉') {
      weatherDesc = '晴時多雲';
      currentTemp = 27;
      locationName = `${county} · ${township}`;
    }

    return new Response(
      JSON.stringify(createWeatherPayload(locationName, '2', currentTemp, { weatherDesc })),
      { status: 200 },
    );
  });

  vi.stubGlobal('fetch', fetchMock);

  return {
    setError() {
      nextResponse = 'error';
    },
    setSuccess() {
      nextResponse = 'success';
    },
    fetchMock,
  };
}

/**
 * 用真實 AuthContext / ToastContext provider value render WeatherPage。
 * @returns {ReturnType<typeof renderWithAuthToast>} render 結果。
 */
function renderWeatherPage() {
  return renderWithAuthToast(<WeatherPage />, {
    authContext: AuthContext,
    toastContext: ToastContext,
  });
}

/* ==========================================================================
   Tests
   ========================================================================== */

describe('WeatherPage integration', () => {
  /** @type {FetchControls} */
  let fetchControls;

  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMock.getDocs.mockResolvedValue({ docs: [], empty: true, size: 0 });
    fetchControls = installWeatherFetch();
    globalThis.localStorage?.clear?.();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the map container and county features', () => {
    renderWeatherPage();

    expect(screen.getByRole('application', { name: '台灣互動地圖' })).toBeInTheDocument();
    expect(screen.getByText('臺北市')).toBeInTheDocument();
    expect(screen.getByText('新北市')).toBeInTheDocument();
  });

  it('shows empty state when no location is selected', () => {
    renderWeatherPage();

    expect(screen.getByText(/請先在地圖上選擇/)).toBeInTheDocument();
  });

  it('updates the weather card when a county is clicked', async () => {
    const user = userEvent.setup();
    renderWeatherPage();

    await user.click(screen.getByRole('button', { name: '臺北市' }));

    expect(await screen.findByText('晴時多雲')).toBeInTheDocument();
    expect(screen.getByText('臺北市')).toBeInTheDocument();
    expect(screen.getByText('28°')).toBeInTheDocument();
    await waitFor(() => {
      const calls = fetchControls.fetchMock.mock.calls.map((call) => String(call[0]));
      expect(calls.some((url) => url.includes('county=%E8%87%BA%E5%8C%97%E5%B8%82'))).toBe(true);
    });
  });

  it('renders loading skeleton while the fetch is in-flight', async () => {
    /** @type {(value: Response) => void} */
    let resolveFetch = () => {};
    fetchControls.fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const user = userEvent.setup();
    renderWeatherPage();
    await user.click(screen.getByRole('button', { name: '臺北市' }));

    expect(await screen.findByLabelText('天氣資料載入中')).toBeInTheDocument();

    resolveFetch(
      new Response(
        JSON.stringify(createWeatherPayload('臺北市', '2', 28, { weatherDesc: '晴時多雲' })),
        { status: 200 },
      ),
    );
    await screen.findByText('晴時多雲');
  });

  it('shows the error state and recovers via retry', async () => {
    fetchControls.setError();
    const user = userEvent.setup();
    renderWeatherPage();

    await user.click(screen.getByRole('button', { name: '臺北市' }));
    const retryButton = await screen.findByRole('button', { name: /重試/ });

    await user.click(retryButton);

    expect(await screen.findByText('晴時多雲')).toBeInTheDocument();
  });

  it('triggers island click handler and updates weather card', async () => {
    const user = userEvent.setup();
    renderWeatherPage();

    await user.click(screen.getByRole('button', { name: '蘭嶼鄉' }));

    expect(await screen.findByText('臺東縣 · 蘭嶼鄉')).toBeInTheDocument();
  });
});
