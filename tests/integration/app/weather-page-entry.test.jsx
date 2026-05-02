import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Weather from '@/app/weather/page';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import { renderWithAuthToast } from '../../_helpers/provider-test-helpers';
import { createWeatherPayload } from '../../_helpers/use-weather-page-runtime-test-helpers';

const dynamicMockState = vi.hoisted(() => ({
  calls: [],
}));

vi.mock('next/dynamic', async () => {
  const React = await import('react');

  return {
    default: vi.fn((loader, options) => {
      dynamicMockState.calls.push({ loader, options });

      /**
       * jsdom-safe replacement for Next dynamic that still executes the real loader.
       * @param {Record<string, unknown>} props - Forwarded component props.
       * @returns {import('react').ReactElement} Dynamic boundary output.
       */
      function DynamicWeatherBoundary(props) {
        const [LoadedComponent, setLoadedComponent] = React.useState(null);

        React.useEffect(() => {
          let isActive = true;

          loader().then((loadedModule) => {
            if (isActive) {
              setLoadedComponent(() => loadedModule.default);
            }
          });

          return () => {
            isActive = false;
          };
        }, []);

        if (!LoadedComponent) {
          return React.createElement('div', { role: 'status' }, '正在載入天氣頁');
        }

        return React.createElement(LoadedComponent, props);
      }

      return DynamicWeatherBoundary;
    }),
  };
});

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
          const featureKey = `feature-${
            feature.properties.TOWNCODE || feature.properties.COUNTYCODE
          }`;
          const label = feature.properties.TOWNNAME || feature.properties.COUNTYNAME;

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

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
}));

vi.mock('firebase/auth', () => ({
  connectAuthEmulator: vi.fn(),
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(
    function GoogleAuthProvider() {
      this.setCustomParameters = vi.fn();
    },
  ),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  connectStorageEmulator: vi.fn(),
  getStorage: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(async () => ({ id: 'noop' })),
  collection: vi.fn((db, ...segments) => ({ type: 'collection', db, path: segments.join('/') })),
  connectFirestoreEmulator: vi.fn(),
  deleteDoc: vi.fn(async () => undefined),
  doc: vi.fn((db, ...segments) => ({ type: 'doc', db, path: segments.join('/') })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
  getFirestore: vi.fn(() => ({})),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn((source, ...constraints) => ({ type: 'query', source, constraints })),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
}));

/**
 * Render the app weather page entry with real runtime provider contexts.
 * @returns {ReturnType<typeof renderWithAuthToast>} Render result.
 */
function renderWeatherEntry() {
  return renderWithAuthToast(<Weather />, {
    authContext: AuthContext,
    toastContext: ToastContext,
  });
}

/**
 * Install a single successful `/api/weather` response.
 * @returns {import('vitest').Mock} Fetch mock for assertions.
 */
function installWeatherFetch() {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify(createWeatherPayload('臺北市', '2', 28, { weatherDesc: '晴時多雲' })),
      { status: 200 },
    ));

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

describe('weather page app entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/weather');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('configures Next dynamic for client-only weather rendering', async () => {
    const [{ loader, options }] = dynamicMockState.calls;

    const loadedModule = await loader();

    expect(options).toEqual({ ssr: false });
    expect(loadedModule.default.name).toBe('WeatherPage');
  });

  it('loads the real weather page through the app entry and handles county selection', async () => {
    const fetchMock = installWeatherFetch();
    const user = userEvent.setup();

    renderWeatherEntry();

    expect(screen.getByRole('status')).toHaveTextContent('正在載入天氣頁');
    expect(await screen.findByRole('application', { name: '台灣互動地圖' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '臺北市' }));

    expect(await screen.findByText('晴時多雲')).toBeInTheDocument();
    expect(screen.getByTestId('current-temperature')).toHaveTextContent('28°');
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(calls.some((url) => url.includes('county=%E8%87%BA%E5%8C%97%E5%B8%82'))).toBe(true);
    });
  });
});
