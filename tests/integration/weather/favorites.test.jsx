/**
 * @file Integration tests for weather favorites flow.
 * @description
 * Drives real `useWeatherPageRuntime` + `useWeatherFavorites` against:
 *   - mocked `firebase/firestore` SDK (favorite CRUD via `addFavorite` / `getFavorites` /
 *     `isFavorited` / `removeFavorite` paths in `firebase-weather-favorites-repo`)
 *   - mocked `global.fetch` for `/api/weather` (county-level success payload)
 *   - real `AuthContext.Provider` value (toggle login state per-test via `setAuthUser`)
 *   - real `ToastContext.Provider` value with a spy for toast assertions
 *
 * `topojson-client`, `@/data/geo/*`, `react-leaflet`, `next/image`, `leaflet` stay
 * mocked because jsdom can't render Leaflet and the real geo files are huge.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeatherPage from '@/components/weather/WeatherPage';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import { renderWithAuthToast } from '../../_helpers/provider-test-helpers';
import {
  COUNTY_LOCATION,
  TOWNSHIP_LOCATION,
  createFavorite,
  createWeatherFavoritesGetDocsHandler,
  createWeatherPayload,
} from '../../_helpers/use-weather-page-runtime-test-helpers';

/* ==========================================================================
   Hoisted shared state (mock factories pick these up before module init).
   ========================================================================== */

const mockShowToast = vi.fn();

/** @type {{ user: { uid: string, name: string | null, email: string | null, photoURL: string | null, bio: string | null, getIdToken: () => Promise<string> } | null }} */
const authState = { user: null };

/**
 * 設定登入使用者；null 代表登出。
 * @param {string | null} uid - 使用者 UID 或 null。
 * @returns {void}
 */
function setAuthUser(uid) {
  authState.user = uid
    ? {
        uid,
        name: 'Test User',
        email: 't@example.com',
        photoURL: null,
        bio: null,
        getIdToken: async () => 'token',
      }
    : null;
}

/* ==========================================================================
   Module mocks — provider + SDK boundary + jsdom-unsafe third-party.
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
  feature: vi.fn(() => ({
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
  MapContainer: ({ children }) => <div>{children}</div>,
  GeoJSON: ({ data, onEachFeature }) => {
    const features = data?.features || [];
    return (
      <div>
        {features.map((feature) => (
          <button
            key={feature.properties.COUNTYCODE}
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

vi.mock('@/config/client/firebase-client', () => ({ db: { app: 'test-firestore' } }));

const firestoreMock = vi.hoisted(() => ({
  collection: vi.fn((db, ...segments) => ({ type: 'collection', db, path: segments.join('/') })),
  doc: vi.fn((db, ...segments) => ({ type: 'doc', db, path: segments.join('/') })),
  query: vi.fn((source, ...constraints) => ({ type: 'query', source, constraints })),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => firestoreMock);

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * 用目前 authState 包 AuthContext.Provider 後 render WeatherPage。
 * @returns {ReturnType<typeof render>} render result。
 */
function renderWeatherPage() {
  return renderWithAuthToast(<WeatherPage />, {
    authContext: AuthContext,
    toastContext: ToastContext,
    auth: { user: authState.user },
    toast: { showToast: mockShowToast },
  });
}

/**
 * 安裝 fetch mock — county / township 都吃同一份成功 payload，因為 favorites
 * loadFavorites 會對每筆 favorite 打 `/api/weather` 取摘要。
 * @returns {void}
 */
function installWeatherFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      const params = new URL(url, 'http://localhost').searchParams;
      const township = params.get('township');
      const county = params.get('county') ?? '臺北市';
      const locationName = township ? `${county} · ${township}` : county;
      return new Response(
        JSON.stringify(createWeatherPayload(locationName, '2', 28, { weatherDesc: '晴時多雲' })),
        { status: 200 },
      );
    }),
  );
}

/* ==========================================================================
   Tests
   ========================================================================== */

const mockFavorites = [
  createFavorite('fav-1', COUNTY_LOCATION),
  createFavorite('fav-2', TOWNSHIP_LOCATION),
];

describe('Favorites integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthUser(null);
    installWeatherFetch();
    globalThis.localStorage?.clear?.();
    window.history.replaceState({}, '', '/');
    firestoreMock.getDocs.mockImplementation(createWeatherFavoritesGetDocsHandler([]));
    firestoreMock.addDoc.mockResolvedValue({ id: 'new-doc-id' });
    firestoreMock.deleteDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('unauthenticated user', () => {
    it('should show toast when clicking favorite without login', async () => {
      const user = userEvent.setup();
      renderWeatherPage();
      await user.click(screen.getByRole('button', { name: '臺北市' }));
      await screen.findByRole('button', { name: /加入收藏/i });

      await user.click(screen.getByRole('button', { name: /加入收藏/i }));

      expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/登入/), 'info');
      expect(firestoreMock.addDoc).not.toHaveBeenCalled();
    });
  });

  describe('authenticated user — add favorite', () => {
    it('should add favorite and show filled icon on click', async () => {
      setAuthUser('test-uid');
      const user = userEvent.setup();
      renderWeatherPage();
      await user.click(screen.getByRole('button', { name: '臺北市' }));
      await screen.findByRole('button', { name: /加入收藏/i });

      await user.click(screen.getByRole('button', { name: /加入收藏/i }));

      await waitFor(() => {
        expect(firestoreMock.addDoc).toHaveBeenCalled();
      });
      const [collectionRef, payload] = firestoreMock.addDoc.mock.calls[0];
      expect(collectionRef.path).toBe('users/test-uid/weatherFavorites');
      expect(payload).toMatchObject({ countyCode: '63000', countyName: '臺北市' });
      expect(await screen.findByRole('button', { name: /取消收藏/i })).toBeInTheDocument();
    });
  });

  describe('authenticated user — remove favorite', () => {
    it('should remove favorite and show empty icon', async () => {
      setAuthUser('test-uid');
      const initialFavorites = [createFavorite('existing-doc', COUNTY_LOCATION)];
      firestoreMock.getDocs.mockImplementation(createWeatherFavoritesGetDocsHandler(initialFavorites));

      const user = userEvent.setup();
      renderWeatherPage();
      await user.click(screen.getByRole('button', { name: '臺北市' }));
      // 等到 isFavorited 把按鈕切到「取消收藏」
      await screen.findByRole('button', { name: /取消收藏/i });

      // 移除前先把 favorites 清掉，讓 reload 後不顯示 chip
      firestoreMock.getDocs.mockImplementation(createWeatherFavoritesGetDocsHandler([]));
      await user.click(screen.getByRole('button', { name: /取消收藏/i }));

      await waitFor(() => {
        expect(firestoreMock.deleteDoc).toHaveBeenCalled();
      });
      const docArg = firestoreMock.deleteDoc.mock.calls[0][0];
      expect(docArg.path).toBe('users/test-uid/weatherFavorites/existing-doc');
      expect(await screen.findByRole('button', { name: /加入收藏/i })).toBeInTheDocument();
    });
  });

  describe('favorites bar rendering', () => {
    it('should render favorite chips from runtime state', async () => {
      setAuthUser('test-uid');
      firestoreMock.getDocs.mockImplementation(createWeatherFavoritesGetDocsHandler(mockFavorites));

      renderWeatherPage();

      expect(await screen.findByText('臺北')).toBeInTheDocument();
      expect(await screen.findByText(/板橋/)).toBeInTheDocument();
    });
  });

  describe('clicking favorite chip', () => {
    it('should update card when clicking a favorite chip', async () => {
      setAuthUser('test-uid');
      firestoreMock.getDocs.mockImplementation(createWeatherFavoritesGetDocsHandler(mockFavorites));

      const user = userEvent.setup();
      renderWeatherPage();

      const chip = await screen.findByRole('button', { name: /切換到新北.*板橋/i });
      await user.click(chip);

      expect(await screen.findByText('新北市 · 板橋區')).toBeInTheDocument();
    });
  });

  describe('removing favorite via chip button', () => {
    it('should remove chip and call removeFavorite on click', async () => {
      setAuthUser('test-uid');
      let currentFavorites = mockFavorites.slice();
      firestoreMock.getDocs.mockImplementation((arg) =>
        createWeatherFavoritesGetDocsHandler(currentFavorites)(arg),
      );

      const user = userEvent.setup();
      renderWeatherPage();

      await screen.findByText(/板橋/);
      const removeBtn = await screen.findByRole('button', { name: /移除.*板橋.*收藏/ });

      // 模擬 firestore 在後續 reload 時已移除該筆
      firestoreMock.deleteDoc.mockImplementationOnce(async () => {
        currentFavorites = currentFavorites.filter((favorite) => favorite.id !== 'fav-2');
      });
      await user.click(removeBtn);

      await waitFor(() => {
        expect(firestoreMock.deleteDoc).toHaveBeenCalled();
      });
      const docArg = firestoreMock.deleteDoc.mock.calls[0][0];
      expect(docArg.path).toBe('users/test-uid/weatherFavorites/fav-2');
      await waitFor(() => {
        expect(screen.queryByText(/板橋/)).not.toBeInTheDocument();
      });
    });
  });

  describe('optimistic update rollback', () => {
    it('should rollback UI and show error toast when add favorite fails', async () => {
      setAuthUser('test-uid');
      firestoreMock.addDoc.mockRejectedValueOnce(new Error('write failed'));

      const user = userEvent.setup();
      renderWeatherPage();
      await user.click(screen.getByRole('button', { name: '臺北市' }));
      await screen.findByRole('button', { name: /加入收藏/i });

      await user.click(screen.getByRole('button', { name: /加入收藏/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /加入收藏/i })).toBeInTheDocument();
      });
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/失敗|稍後/), 'error');
    });
  });
});
