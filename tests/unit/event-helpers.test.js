import { describe, it, expect } from 'vitest';
import {
  buildRoutePayload,
  formatDateTime,
  formatPace,
  chunkArray,
  toNumber,
  getRemainingSeats,
  buildUserPayload,
} from '../../src/lib/event-helpers';

/**
 * @typedef {import('../../src/lib/event-helpers').RoutePoint} RoutePoint
 */

describe('event-helpers', () => {
  describe('buildRoutePayload', () => {
    it('returns null for invalid input', () => {
      expect(buildRoutePayload(null)).toBeNull();
      expect(buildRoutePayload([])).toBeNull();
      // @ts-expect-error Testing invalid input
      expect(buildRoutePayload('invalid')).toBeNull();
    });

    it('returns null if any coordinate is invalid', () => {
      const input = [{ lat: 10, lng: 10 }, { lat: 'NaN', lng: 20 }];
      // @ts-expect-error Testing mixed types that result in NaN
      expect(buildRoutePayload(input)).toBeNull();
    });

    it('calculates correct bbox and encodes polyline', () => {
      /** @type {RoutePoint[]} */
      const points = [
        { lat: 0, lng: 0 },
        { lat: 10, lng: 10 },
      ];
      const result = buildRoutePayload(points);
      expect(result).not.toBeNull();
      expect(result?.pointsCount).toBe(2);
      expect(result?.bbox).toEqual({
        minLat: 0, minLng: 0, maxLat: 10, maxLng: 10,
      });
      // Simple polyline check (encoded string for (0,0) to (10,10))
      expect(typeof result?.polyline).toBe('string');
      expect(result?.polyline.length).toBeGreaterThan(0);
    });
  });

  describe('formatDateTime', () => {
    it('returns empty string for null/undefined', () => {
      expect(formatDateTime(null)).toBe('');
      expect(formatDateTime(undefined)).toBe('');
    });

    it('replaces T with space for ISO strings', () => {
      expect(formatDateTime('2023-01-01T12:00')).toBe('2023-01-01 12:00');
    });

    it('formats Firestore Timestamp correctly', () => {
      const mockTimestamp = {
        toDate: () => new Date('2023-10-10T08:30:00'),
      };
      // @ts-expect-error Mocking Firestore Timestamp
      expect(formatDateTime(mockTimestamp)).toBe('2023-10-10 08:30');
    });
  });

  describe('formatPace', () => {
    it('formats seconds to MM:SS', () => {
      expect(formatPace(305)).toBe('5:05'); // 5min 5sec
      expect(formatPace(60)).toBe('1:00');
      expect(formatPace(9)).toBe('0:09');
    });

    it('returns fallback text for invalid input', () => {
      expect(formatPace(0, 'N/A')).toBe('N/A');
      expect(formatPace(-1, '--')).toBe('--');
      expect(formatPace(null, 'TBD')).toBe('TBD');
    });
  });

  describe('chunkArray', () => {
    it('splits array into chunks', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(chunkArray(arr, 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('returns empty array for empty input', () => {
      expect(chunkArray([], 3)).toEqual([]);
    });
  });

  describe('toNumber', () => {
    it('converts valid inputs', () => {
      expect(toNumber(123)).toBe(123);
      expect(toNumber('456')).toBe(456);
    });

    it('returns 0 for invalid inputs', () => {
      expect(toNumber(NaN)).toBe(0);
      expect(toNumber('abc')).toBe(0);
      expect(toNumber(null)).toBe(0);
      expect(toNumber(undefined)).toBe(0);
    });
  });

  describe('getRemainingSeats', () => {
    it('returns direct value if present', () => {
      // @ts-expect-error Partial Event Data
      expect(getRemainingSeats({ remainingSeats: 5 })).toBe(5);
    });

    it('calculates from max and count', () => {
      // @ts-expect-error Partial Event Data
      expect(getRemainingSeats({ maxParticipants: 10, participantsCount: 3 })).toBe(7);
    });

    it('returns 0 if overbooked', () => {
      // @ts-expect-error Partial Event Data
      expect(getRemainingSeats({ maxParticipants: 5, participantsCount: 6 })).toBe(0);
    });
  });

  describe('buildUserPayload', () => {
    it('returns null if no uid', () => {
      // @ts-expect-error Partial User
      expect(buildUserPayload({})).toBeNull();
    });

    it('extracts name from email if name missing', () => {
      // @ts-expect-error Mock User
      const user = { uid: '123', email: 'test@example.com' };
      expect(buildUserPayload(user)).toEqual({
        uid: '123',
        name: 'test',
        photoURL: '',
      });
    });

    it('uses provided name and photo', () => {
      // @ts-expect-error Mock User
      const user = { uid: '123', name: 'Alice', photoURL: 'http://img.com', email: 'a@b.com' };
      expect(buildUserPayload(user)).toEqual({
        uid: '123',
        name: 'Alice',
        photoURL: 'http://img.com',
      });
    });
  });
});
