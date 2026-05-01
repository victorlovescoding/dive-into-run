/**
 * @file Unit tests for `useRunCalendar` hook (T-P1-1-19).
 * @description
 * Mock 邊界只限 `firebase/firestore` + `@/config/client/firebase-client`。
 * `@/repo/client/firebase-strava-repo` 與 `@/service/strava-data-service` 走真實實作。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createStravaActivityDoc } from '../../_helpers/strava-fixtures';

const {
  mockUseContext,
  mockCollection,
  mockDoc,
  mockGetDocs,
  mockLimit,
  mockOnSnapshot,
  mockOrderBy,
  mockQuery,
  mockStartAfter,
  mockTimestampFromDate,
  mockWhere,
} = vi.hoisted(() => ({
  mockUseContext: vi.fn(),
  mockCollection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  mockDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockLimit: vi.fn(),
  mockOnSnapshot: vi.fn(),
  mockOrderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  mockQuery: vi.fn((collectionRef, ...constraints) => ({
    type: 'query',
    path: collectionRef?.path,
    constraints,
  })),
  mockStartAfter: vi.fn(),
  mockTimestampFromDate: vi.fn((date) => ({ __type: 'Timestamp', date })),
  mockWhere: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
}));

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());
  return { ...actual, useContext: mockUseContext };
});

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDocs: mockGetDocs,
  limit: mockLimit,
  onSnapshot: mockOnSnapshot,
  orderBy: mockOrderBy,
  query: mockQuery,
  startAfter: mockStartAfter,
  Timestamp: { fromDate: mockTimestampFromDate },
  where: mockWhere,
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db' }));

/**
 * 設定 hook 看到的 AuthContext value。
 * @param {{ uid: string, name?: string|null, email?: string|null, photoURL?: string|null }|null} user - 目前登入者。
 * @returns {void}
 */
function mockAuth(user) {
  mockUseContext.mockReturnValue({
    user: user ? { bio: null, getIdToken: () => Promise.resolve(''), ...user } : null,
    loading: false,
    setUser() {},
  });
}

/**
 * 建立可手動 resolve 的 Promise。
 * @returns {{ promise: Promise<any>, resolve: (value: any) => void }} deferred promise 控制器。
 */
function createDeferred() {
  /** @type {(value: any) => void} */
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

/**
 * 動態載入 hook，避免 module cache 汙染。
 * @returns {Promise<typeof import('@/runtime/hooks/useRunCalendar').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useRunCalendar')).default;
}

describe('useRunCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockUseContext.mockReset();
    mockGetDocs.mockReset();
    mockAuth(null);
  });

  it('loads month activities and aggregates the real day map + summary', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        createStravaActivityDoc('a1', {
          uid: 'u1',
          type: 'Run',
          distanceMeters: 5000,
          startDateLocal: '2026-04-05T07:00:00',
        }),
        createStravaActivityDoc('a2', {
          uid: 'u1',
          type: 'Run',
          distanceMeters: 3000,
          startDateLocal: '2026-04-05T19:00:00',
        }),
        createStravaActivityDoc('a3', {
          uid: 'u1',
          type: 'TrailRun',
          distanceMeters: 8000,
          startDateLocal: '2026-04-12T08:00:00',
        }),
      ],
    });
    mockAuth({ uid: 'u1', name: 'Tester', email: null, photoURL: null });

    const useRunCalendar = await loadHook();
    const { result } = renderHook(() => useRunCalendar(2026, 3));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.dayMap.get(5)).toMatchObject({
      totalMeters: 8000,
      runs: [{ type: 'Run', totalMeters: 8000 }],
    });
    expect(result.current.dayMap.get(12)?.runs).toEqual([{ type: 'TrailRun', totalMeters: 8000 }]);
    expect(result.current.monthSummary).toEqual({
      totalMeters: 16000,
      byType: [
        { type: 'Run', totalMeters: 8000, label: '戶外' },
        { type: 'TrailRun', totalMeters: 8000, label: '越野' },
      ],
    });
    expect(mockWhere).toHaveBeenCalledWith('uid', '==', 'u1');
    expect(mockWhere).toHaveBeenCalledWith(
      'startDate',
      '>=',
      expect.objectContaining({ __type: 'Timestamp' }),
    );
    expect(mockOrderBy).toHaveBeenCalledWith('startDate', 'desc');
  });

  it('returns empty state and skips Firestore when no user is signed in', async () => {
    const useRunCalendar = await loadHook();
    const { result } = renderHook(() => useRunCalendar(2026, 3));

    expect(result.current).toEqual({
      dayMap: new Map(),
      monthSummary: { totalMeters: 0, byType: [] },
      isLoading: false,
      error: null,
    });
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('surfaces the original error message after a failed query completes', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore down'));
    mockAuth({ uid: 'u3', name: 'Err', email: null, photoURL: null });

    const useRunCalendar = await loadHook();
    const { result } = renderHook(() => useRunCalendar(2026, 3));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Firestore down');
    expect(result.current.dayMap.size).toBe(0);
    expect(result.current.monthSummary).toEqual({ totalMeters: 0, byType: [] });
  });

  it('falls back to the default error message when the rejection has no message', async () => {
    mockGetDocs.mockRejectedValueOnce({});
    mockAuth({ uid: 'u4', name: 'NoMsg', email: null, photoURL: null });

    const useRunCalendar = await loadHook();
    const { result } = renderHook(() => useRunCalendar(2026, 3));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('月曆資料載入失敗');
    expect(result.current.dayMap.size).toBe(0);
  });

  it('keeps the previous dayMap while a new month is loading, then swaps to new data', async () => {
    const deferred = createDeferred();
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [
          createStravaActivityDoc('a1', {
            uid: 'u1',
            type: 'Run',
            distanceMeters: 5000,
            startDateLocal: '2026-04-10T07:00:00',
          }),
        ],
      })
      .mockImplementationOnce(() => deferred.promise);
    mockAuth({ uid: 'u1', name: 'Tester', email: null, photoURL: null });

    const useRunCalendar = await loadHook();
    const { result, rerender } = renderHook(({ year, month }) => useRunCalendar(year, month), {
      initialProps: { year: 2026, month: 3 },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.dayMap.get(10)?.totalMeters).toBe(5000);

    rerender({ year: 2026, month: 4 });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.dayMap.get(10)?.totalMeters).toBe(5000);

    await act(async () => {
      deferred.resolve({
        docs: [
          createStravaActivityDoc('a2', {
            uid: 'u1',
            type: 'VirtualRun',
            distanceMeters: 2000,
            startDateLocal: '2026-05-03T08:00:00',
          }),
        ],
      });
      await deferred.promise;
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.dayMap.get(10)).toBeUndefined();
    expect(result.current.dayMap.get(3)?.runs).toEqual([{ type: 'VirtualRun', totalMeters: 2000 }]);
    expect(result.current.monthSummary.byType).toEqual([
      { type: 'VirtualRun', totalMeters: 2000, label: '室內' },
    ]);
  });

  it('hides a stale error while retrying a different month, then clears it on success', async () => {
    const deferred = createDeferred();
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore down')).mockImplementationOnce(
      () => deferred.promise,
    );
    mockAuth({ uid: 'u5', name: 'Retry', email: null, photoURL: null });

    const useRunCalendar = await loadHook();
    const { result, rerender } = renderHook(({ year, month }) => useRunCalendar(year, month), {
      initialProps: { year: 2026, month: 3 },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Firestore down');

    rerender({ year: 2026, month: 4 });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      deferred.resolve({ docs: [] });
      await deferred.promise;
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.dayMap.size).toBe(0);
    expect(result.current.monthSummary).toEqual({ totalMeters: 0, byType: [] });
  });
});
