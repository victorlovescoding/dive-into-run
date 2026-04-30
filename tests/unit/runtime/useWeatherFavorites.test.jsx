import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useWeatherFavorites from '@/runtime/hooks/useWeatherFavorites';

const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const firestoreState = vi.hoisted(() => ({ favorites: [], nextDocId: 1 }));
const { firestoreMocks, mockShowToast } = vi.hoisted(() => ({
  firestoreMocks: {
    collection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
    doc: vi.fn((_db, ...segments) => ({ type: 'doc', path: segments.join('/') })),
    query: vi.fn((source, ...constraints) => ({ source, constraints })),
    where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
    orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    deleteDoc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  },
  mockShowToast: vi.fn(),
}));
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));
vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const USER = {
  uid: 'user-1',
  name: 'Test User',
  email: 'user@example.com',
  photoURL: '',
  bio: null,
  getIdToken: async () => 'token',
};
const COUNTY_LOCATION = {
  countyCode: '63000',
  countyName: '臺北市',
  townshipCode: null,
  townshipName: null,
  displaySuffix: null,
};
const TOWNSHIP_LOCATION = {
  countyCode: '65000',
  countyName: '新北市',
  townshipCode: '65000010',
  townshipName: '板橋區',
  displaySuffix: null,
};

/**
 * @param {string} id - favorite id。
 * @param {typeof COUNTY_LOCATION} location - location fixture。
 * @returns {{ id: string } & typeof COUNTY_LOCATION} favorite doc。
 */
function createFavorite(id, location) {
  return { id, ...location };
}

/**
 * @param {Array<{ id: string } & typeof COUNTY_LOCATION>} docs - favorite docs。
 * @returns {{ empty: boolean, docs: Array<{ id: string, data: () => object }> }} query snapshot。
 */
function createSnapshot(docs) {
  return {
    empty: docs.length === 0,
    docs: docs.map((favorite) => ({ id: favorite.id, data: () => favorite })),
  };
}

/**
 * @returns {{ promise: Promise<void>, resolve: () => void }} deferred。
 */
function createDeferred() {
  /** @type {(value?: void | PromiseLike<void>) => void} */
  let resolve = () => {};
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

/**
 * @param {Partial<Parameters<typeof useWeatherFavorites>[0]>} [overrides] - hook props override。
 * @returns {object} render result with hook view and spies。
 */
function renderTarget(overrides = {}) {
  const selectLocation = vi.fn().mockResolvedValue(undefined);
  const baseProps = /** @type {Parameters<typeof useWeatherFavorites>[0]} */ ({
    selectedLocation: COUNTY_LOCATION,
    user: USER,
    selectLocation,
    ...overrides,
  });
  const view = renderHook((props) => useWeatherFavorites(props), {
    initialProps: baseProps,
  });
  return { ...view, showToast: mockShowToast, selectLocation };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockShowToast.mockReset();
  vi.stubGlobal('fetch', mockFetch);
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
    const township = url.searchParams.get('township');
    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          today: {
            weatherCode: township ? '11' : '02',
            currentTemp: township ? 26 : 30,
          },
        },
      }),
      { status: 200 },
    );
  });
});

describe('useWeatherFavorites', () => {
  it('loads favorites and fetches weather summaries for each item', async () => {
    firestoreState.favorites = [
      createFavorite('fav-county', COUNTY_LOCATION),
      createFavorite('fav-township', TOWNSHIP_LOCATION),
    ];
    const { result } = renderTarget();

    await act(async () => {
      await result.current.loadFavorites();
    });

    await waitFor(() => {
      expect(result.current.favorites).toHaveLength(2);
    });
    expect(result.current.favSummaries['fav-county']).toEqual({ weatherCode: '02', currentTemp: 30 });
    expect(result.current.favSummaries['fav-township']).toEqual({ weatherCode: '11', currentTemp: 26 });
    expect(mockFetch.mock.calls).toHaveLength(2);
  });

  it('shows login toast and skips mutation when auth is missing', async () => {
    const { result, showToast } = renderTarget({ user: null });

    await act(async () => {
      await result.current.handleFavoriteToggle();
    });

    expect(showToast).toHaveBeenLastCalledWith('請先登入才能收藏', 'info');
    expect(firestoreMocks.addDoc).not.toHaveBeenCalled();
    expect(result.current.currentFavStatus).toEqual({ favorited: false, docId: null });
  });

  it('adds a favorite, reloads list, and stores fetched summary', async () => {
    const { result, showToast } = renderTarget();

    await act(async () => {
      await result.current.handleFavoriteToggle();
    });

    await waitFor(() => {
      expect(result.current.currentFavStatus.docId).toBe('fav-1');
    });
    expect(firestoreMocks.addDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'users/user-1/weatherFavorites' }),
      expect.objectContaining({ countyCode: '63000', countyName: '臺北市' }),
    );
    expect(result.current.favorites.map((favorite) => favorite.id)).toEqual(['fav-1']);
    expect(result.current.favSummaries['fav-1']).toEqual({ weatherCode: '02', currentTemp: 30 });
    expect(showToast).toHaveBeenLastCalledWith('已收藏', 'success');
  });

  it('guards against a second toggle while the first mutation is pending', async () => {
    const deferred = createDeferred();
    firestoreMocks.addDoc.mockImplementationOnce(async (_collectionRef, payload) => {
      await deferred.promise;
      firestoreState.favorites.unshift({ id: 'fav-pending', ...payload });
      return { id: 'fav-pending' };
    });
    const { result } = renderTarget();

    await act(async () => {
      result.current.handleFavoriteToggle();
    });
    await waitFor(() => {
      expect(result.current.isFavoriteMutating).toBe(true);
    });

    await act(async () => {
      await result.current.handleFavoriteToggle();
    });
    expect(firestoreMocks.addDoc.mock.calls).toHaveLength(1);

    deferred.resolve();

    await waitFor(() => {
      expect(result.current.currentFavStatus.docId).toBe('fav-pending');
    });
    expect(result.current.isFavoriteMutating).toBe(false);
  });

  it('removes a favorited location and resets status after reload', async () => {
    firestoreState.favorites = [createFavorite('fav-existing', COUNTY_LOCATION)];
    const { result, showToast } = renderTarget();

    await act(async () => {
      await result.current.loadFavorites();
      await result.current.refreshCurrentFavoriteStatus(COUNTY_LOCATION);
    });
    await waitFor(() => {
      expect(result.current.currentFavStatus).toEqual({ favorited: true, docId: 'fav-existing' });
    });

    await act(async () => {
      await result.current.handleFavoriteToggle();
    });

    await waitFor(() => {
      expect(result.current.currentFavStatus).toEqual({ favorited: false, docId: null });
    });
    expect(firestoreMocks.deleteDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'users/user-1/weatherFavorites/fav-existing' }),
    );
    expect(result.current.favorites).toEqual([]);
    expect(showToast).toHaveBeenLastCalledWith('已取消收藏', 'success');
  });
});
