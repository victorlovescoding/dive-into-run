import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { createDeferred } from '../../_helpers/runtime-hook-test-helpers';
import {
  createEventDoc,
  createEventsFilterHarness,
  renderEventsFilterHook,
} from '../../_helpers/use-events-filter-test-helpers';

const {
  mockCollection,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockGetDocs,
  mockTimestampFromDate,
} = vi.hoisted(() => ({
  mockCollection: vi.fn((_db, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  mockQuery: vi.fn((collectionRef, ...constraints) => ({
    type: 'query',
    path: collectionRef?.path,
    constraints,
  })),
  mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockLimit: vi.fn((count) => ({ type: 'limit', count })),
  mockGetDocs: vi.fn(),
  mockTimestampFromDate: vi.fn((date) => ({
    type: 'timestamp',
    millis: date instanceof Date ? date.getTime() : 0,
    toDate: () => date,
  })),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: vi.fn((_db, ...segments) => ({ type: 'doc', path: segments.join('/'), id: String(segments.at(-1) ?? '') })),
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  getDocs: mockGetDocs,
  Timestamp: {
    fromDate: mockTimestampFromDate,
  },
  deleteField: vi.fn(() => ({ type: 'deleteField' })),
  serverTimestamp: vi.fn(() => ({ type: 'serverTimestamp' })),
  startAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  runTransaction: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

/**
 * 動態載入 hook，避免測試間 module cache 汙染。
 * @returns {Promise<typeof import('@/runtime/hooks/useEventsFilter').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useEventsFilter')).default;
}

describe('useEventsFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes initial state and only opens filter when parent form is closed', async () => {
    const useEventsFilter = await loadHook();
    const blockedHarness = createEventsFilterHarness({ isFormOpen: true });
    const openHarness = createEventsFilterHarness();
    const { result: blockedResult } = renderEventsFilterHook(useEventsFilter, blockedHarness);
    const { result: openResult } = renderEventsFilterHook(useEventsFilter, openHarness);

    act(() => {
      blockedResult.current.handleOpenFilter();
      openResult.current.handleOpenFilter();
    });

    expect(openResult.current.filterCity).toBe('');
    expect(openResult.current.filterDistrictOptions).toEqual([]);
    expect(openResult.current.isFilteredResults).toBe(false);
    expect(openResult.current.isFiltering).toBe(false);
    expect(openResult.current.cityOptions).toContain('臺北市');
    expect(blockedResult.current.isFilterOpen).toBe(false);
    expect(openResult.current.isFilterOpen).toBe(true);
  });

  it('changing city resets district and rebuilds district options', async () => {
    const useEventsFilter = await loadHook();
    const harness = createEventsFilterHarness();
    const { result } = renderEventsFilterHook(useEventsFilter, harness);

    act(() => {
      result.current.setFilterDistrict('信義區');
    });
    expect(result.current.filterDistrict).toBe('信義區');

    act(() => {
      result.current.handleFilterCityChange('臺北市');
    });

    expect(result.current.filterCity).toBe('臺北市');
    expect(result.current.filterDistrict).toBe('');
    expect(result.current.filterDistrictOptions).toContain('信義區');
    expect(result.current.filterDistrictOptions).toContain('大安區');
  });

  it('handleSearchFilters builds firestore query with city + district + time bounds', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        createEventDoc('e1', {
          city: '臺北市',
          district: '信義區',
          distanceKm: 10,
          maxParticipants: 10,
          participantsCount: 2,
          remainingSeats: 8,
        }),
      ],
    });

    const useEventsFilter = await loadHook();
    const harness = createEventsFilterHarness();
    const { result } = renderEventsFilterHook(useEventsFilter, harness);

    act(() => {
      result.current.handleFilterCityChange('臺北市');
      result.current.setFilterDistrict('信義區');
      result.current.setFilterTimeStart('2026-05-01T00:00');
      result.current.setFilterTimeEnd('2026-05-31T23:59');
    });

    await act(async () => {
      await result.current.handleSearchFilters();
    });

    const lastQueryCall = mockQuery.mock.calls.at(-1);
    expect(lastQueryCall).toBeDefined();
    const constraints = lastQueryCall?.slice(1) ?? [];

    expect(constraints).toContainEqual(
      expect.objectContaining({ type: 'where', field: 'city', value: '臺北市' }),
    );
    expect(constraints).toContainEqual(
      expect.objectContaining({ type: 'where', field: 'district', value: '信義區' }),
    );
    expect(constraints).toContainEqual(
      expect.objectContaining({ type: 'where', field: 'time', op: '>=' }),
    );
    expect(constraints).toContainEqual(
      expect.objectContaining({ type: 'where', field: 'time', op: '<=' }),
    );
    expect(constraints).toContainEqual(expect.objectContaining({ type: 'orderBy', field: 'time' }));
    expect(constraints).toContainEqual(expect.objectContaining({ type: 'limit', count: 50 }));
    expect(harness.setEvents).toHaveBeenCalled();
    expect(harness.setCursor).toHaveBeenLastCalledWith(null);
    expect(harness.setHasMore).toHaveBeenLastCalledWith(false);
    expect(result.current.isFilteredResults).toBe(true);
    expect(result.current.isFiltering).toBe(false);
    expect(result.current.isFilterOpen).toBe(false);
  });

  it('applies in-memory distance filter from service layer', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        createEventDoc('short', {
          distanceKm: 3,
          maxParticipants: 10,
          participantsCount: 0,
          remainingSeats: 10,
        }),
        createEventDoc('long', {
          distanceKm: 12,
          maxParticipants: 10,
          participantsCount: 0,
          remainingSeats: 10,
        }),
      ],
    });

    const useEventsFilter = await loadHook();
    const harness = createEventsFilterHarness();
    const { result } = renderEventsFilterHook(useEventsFilter, harness);

    act(() => {
      result.current.setFilterDistanceMin('10');
      result.current.setFilterDistanceMax('15');
    });

    await act(async () => {
      await result.current.handleSearchFilters();
    });

    const lastSetEventsCall = harness.setEvents.mock.calls.at(-1);
    const passedEvents = /** @type {Array<{ id: string }>} */ (lastSetEventsCall?.[0]);
    expect(passedEvents.map((event) => event.id)).toEqual(['long']);
  });

  it('handleSearchFilters reports load error and stops filtering on failure', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore down'));
    const useEventsFilter = await loadHook();
    const harness = createEventsFilterHarness();
    const { result } = renderEventsFilterHook(useEventsFilter, harness);

    await act(async () => {
      await result.current.handleSearchFilters();
    });

    expect(harness.setLoadError).toHaveBeenLastCalledWith('搜尋失敗，請稍後再試');
    expect(result.current.isFiltering).toBe(false);
    expect(result.current.isFilteredResults).toBe(false);
    expect(harness.setEvents).not.toHaveBeenCalled();
  });

  it('handleClearFilters wipes all filter inputs and reloads latest page', async () => {
    const useEventsFilter = await loadHook();
    const harness = createEventsFilterHarness();
    const { result } = renderEventsFilterHook(useEventsFilter, harness);

    act(() => {
      result.current.handleFilterCityChange('臺北市');
      result.current.setFilterDistrict('信義區');
      result.current.setFilterTimeStart('2026-05-01T00:00');
      result.current.setFilterTimeEnd('2026-05-31T23:59');
      result.current.setFilterDistanceMin('5');
      result.current.setFilterDistanceMax('15');
      result.current.setFilterHasSeatsOnly(true);
    });

    await act(async () => {
      await result.current.handleClearFilters();
    });

    expect(result.current.filterCity).toBe('');
    expect(result.current.filterDistrict).toBe('');
    expect(result.current.filterTimeStart).toBe('');
    expect(result.current.filterTimeEnd).toBe('');
    expect(result.current.filterDistanceMin).toBe('');
    expect(result.current.filterDistanceMax).toBe('');
    expect(result.current.filterHasSeatsOnly).toBe(false);
    expect(result.current.isFilteredResults).toBe(false);
    expect(harness.loadLatestPage).toHaveBeenLastCalledWith({ replaceExisting: true });
  });

  it('does not setEvents after unmount when search resolves late', async () => {
    const deferred = createDeferred();
    mockGetDocs.mockImplementationOnce(() => deferred.promise);

    const useEventsFilter = await loadHook();
    const harness = createEventsFilterHarness();
    const { result, unmount } = renderEventsFilterHook(useEventsFilter, harness);

    /** @type {Promise<void> | undefined} */
    let searchPromise;
    act(() => {
      searchPromise = result.current.handleSearchFilters();
    });

    await waitFor(() => {
      expect(result.current.isFiltering).toBe(true);
    });

    unmount();

    await act(async () => {
      deferred.resolve({
        docs: [
          createEventDoc('late', {
            distanceKm: 5,
            maxParticipants: 8,
            participantsCount: 0,
            remainingSeats: 8,
          }),
        ],
      });
      await deferred.promise;
      await searchPromise;
    });

    expect(harness.setEvents).not.toHaveBeenCalled();
    expect(harness.setCursor).not.toHaveBeenCalled();
    expect(harness.setHasMore).not.toHaveBeenCalled();
  });
});
