import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import useWeatherPageRuntime from '@/runtime/hooks/useWeatherPageRuntime';
import {
  COUNTY_LOCATION,
  createFavorite,
  createSnapshot,
  createWeatherPayload,
  GEO_LOOKUP,
  TOWNSHIP_LOCATION,
  USER,
} from '../../_helpers/use-weather-page-runtime-test-helpers';

const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const firestoreState = vi.hoisted(() => ({ favorites: [], nextDocId: 1 }));
const {
  authState,
  firestoreMocks,
  mockFetch,
  mockShowToast,
  mockUseContext,
} = vi.hoisted(() => ({
  authState: {
    current: { user: null, loading: false, setUser() {} },
  },
  firestoreMocks: {
    collection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
    doc: vi.fn((_db, ...segments) => ({ type: 'doc', path: segments.join('/') })),
    query: vi.fn((source, ...constraints) => ({ source, constraints })),
    where: vi.fn((field, op, value) => ({ field, op, value })),
    orderBy: vi.fn((field, direction) => ({ field, direction })),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    deleteDoc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  },
  mockFetch: vi.fn(),
  mockShowToast: vi.fn(),
  mockUseContext: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());
  mockUseContext.mockImplementation(() => authState.current);
  return {
    ...actual,
    useContext: mockUseContext,
  };
});

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

/** @returns {Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>} storage stub。 */
function createStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

/**
 * @param {{ user?: typeof USER | null }} [options] - render options。
 * @returns {object} renderHook view with toast spy。
 */
function renderTarget(options = {}) {
  authState.current = {
    user: options.user ?? USER,
    loading: false,
    setUser() {},
  };
  const view = renderHook(() => useWeatherPageRuntime(GEO_LOOKUP));
  return { ...view, showToast: mockShowToast };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockShowToast.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', createStorage());
  window.history.replaceState({}, '', '/weather');
  firestoreState.favorites = [];
  firestoreState.nextDocId = 1;

  firestoreMocks.getDocs.mockImplementation(async (target) => {
    const path = target.source?.path ?? target.path ?? '';
    if (!path.endsWith('weatherFavorites')) {
      return createSnapshot([]);
    }

    const countyCode = target.constraints?.find((item) => item.field === 'countyCode')?.value;
    const townshipCode =
      target.constraints?.find((item) => item.field === 'townshipCode')?.value ?? null;

    if (countyCode) {
      return createSnapshot(
        firestoreState.favorites.filter(
          (favorite) =>
            favorite.countyCode === countyCode &&
            (favorite.townshipCode ?? null) === townshipCode,
        ),
      );
    }

    return createSnapshot(firestoreState.favorites);
  });

  firestoreMocks.addDoc.mockImplementation(async (_collectionRef, payload) => {
    const id = `fav-${firestoreState.nextDocId++}`;
    firestoreState.favorites.unshift({ id, ...payload });
    return { id };
  });

  firestoreMocks.deleteDoc.mockImplementation(async (docRef) => {
    const docId = docRef.path.split('/').at(-1);
    firestoreState.favorites = firestoreState.favorites.filter((favorite) => favorite.id !== docId);
  });

  mockFetch.mockImplementation(async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url, 'http://localhost');
    const county = url.searchParams.get('county') ?? '';
    const township = url.searchParams.get('township');
    const payload =
      county === '新北市' && township === '板橋區'
        ? createWeatherPayload('新北市 · 板橋區', '11', 26)
        : createWeatherPayload(county, '02', 30);
    return new Response(JSON.stringify(payload), { status: 200 });
  });
});

describe('useWeatherPageRuntime', () => {
  it('restores the latest favorite on initial load and exposes favorites integration state', async () => {
    firestoreState.favorites = [createFavorite('fav-latest', COUNTY_LOCATION)];
    const { result } = renderTarget();

    await waitFor(() => {
      expect(result.current.activeFavoriteId).toBe('fav-latest');
    });

    expect(result.current.selectedLocation).toEqual(COUNTY_LOCATION);
    expect(result.current.favorites.map((favorite) => favorite.id)).toEqual(['fav-latest']);
    expect(result.current.weatherState).toBe('success');
    expect(result.current.activeFavoriteId).toBe('fav-latest');
    expect(result.current.favSummaries['fav-latest']).toEqual({ weatherCode: '02', currentTemp: 30 });
    expect(window.location.search).toBe('?county=63000');
  });

  it('prefers URL location over favorites when hydrating initial state', async () => {
    firestoreState.favorites = [
      createFavorite('fav-county', COUNTY_LOCATION),
      createFavorite('fav-township', TOWNSHIP_LOCATION),
    ];
    window.history.replaceState({}, '', '/weather?county=65000&township=65000010');
    const { result } = renderTarget();

    await waitFor(() => {
      expect(result.current.activeFavoriteId).toBe('fav-township');
    });

    expect(result.current.selectedLocation).toEqual(TOWNSHIP_LOCATION);
    expect(result.current.weatherData?.locationName).toBe('新北市 · 板橋區');
    expect(result.current.selectedTownshipCode).toBe('65000010');
    expect(result.current.activeFavoriteId).toBe('fav-township');
  });

  it('updates county and township filters through the real selection handlers', async () => {
    const { result } = renderTarget({ user: null });

    await act(async () => {
      await result.current.handleCountyClick('63000', '臺北市');
    });
    await waitFor(() => {
      expect(result.current.selectedCountyCode).toBe('63000');
    });

    await act(async () => {
      await result.current.handleTownshipClick('65000010', '板橋區', '65000', '新北市');
    });

    await waitFor(() => {
      expect(result.current.selectedTownshipCode).toBe('65000010');
    });
    expect(result.current.mapLayer).toBe('county');
    expect(result.current.weatherData?.locationName).toBe('新北市 · 板橋區');
  });

  it('enters error state on fetch failure and recovers through retry', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createWeatherPayload('臺北市', '02', 30)), { status: 200 }),
      );
    const { result } = renderTarget({ user: null });

    await act(async () => {
      await result.current.handleCountyClick('63000', '臺北市');
    });
    await waitFor(() => {
      expect(result.current.weatherState).toBe('error');
    });

    await act(async () => {
      await result.current.handleRetry();
    });

    await waitFor(() => {
      expect(result.current.weatherState).toBe('success');
    });
    expect(result.current.weatherData?.locationName).toBe('臺北市');
  });
});
