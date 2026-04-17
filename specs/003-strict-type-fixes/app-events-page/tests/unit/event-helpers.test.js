import { describe, it, expect } from 'vitest';
import {
  formatPace,
  toNumber,
  chunkArray,
  getRemainingSeats,
  buildRoutePayload,
} from '@/lib/event-helpers';

/**
 * @typedef {object} MockEvent
 * @property {number} maxParticipants - The maximum number of participants.
 * @property {number} [participantsCount] - The current number of participants.
 */

describe('event-helpers unit tests', () => {
  describe('formatPace', () => {
    it('should format seconds into mm:ss format', () => {
      expect(formatPace(300)).toBe('05:00');
      expect(formatPace(366)).toBe('06:06');
    });

    it('should handle numeric strings', () => {
      expect(formatPace('300')).toBe('05:00');
    });

    it('should return fallback text for invalid input', () => {
      expect(formatPace(null, 'N/A')).toBe('N/A');
      expect(formatPace(undefined, '--')).toBe('--');
      expect(formatPace(0, 'N/A')).toBe('00:00');
    });
  });

  describe('toNumber', () => {
    it('should convert strings to numbers', () => {
      expect(toNumber('123')).toBe(123);
      expect(toNumber('12.3')).toBe(12.3);
    });

    it('should return 0 for invalid input', () => {
      expect(toNumber(null)).toBe(0);
      expect(toNumber(undefined)).toBe(0);
      expect(toNumber('abc')).toBe(0);
    });
  });

  describe('chunkArray', () => {
    it('should split array into chunks of specified size', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(chunkArray(arr, 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunkArray(arr, 3)).toEqual([
        [1, 2, 3],
        [4, 5],
      ]);
    });

    it('should return empty array for empty input', () => {
      expect(chunkArray([], 2)).toEqual([]);
      expect(chunkArray(null, 2)).toEqual([]);
    });
  });

  describe('getRemainingSeats', () => {
    it('should calculate remaining seats correctly', () => {
      const event = { maxParticipants: 10, participantsCount: 4 };
      expect(getRemainingSeats(/** @type {*} */ (event))).toBe(6);
    });

    it('should return 0 if full or oversubscribed', () => {
      const event = { maxParticipants: 10, participantsCount: 12 };
      expect(getRemainingSeats(/** @type {*} */ (event))).toBe(0);
    });

    it('should handle missing participantsCount', () => {
      const event = { maxParticipants: 10 };
      expect(getRemainingSeats(/** @type {*} */ (event))).toBe(10);
    });
  });

  describe('buildRoutePayload', () => {
    it('should build payload from coordinates', () => {
      const coords = [
        [
          { lat: 1, lng: 2 },
          { lat: 3, lng: 4 },
        ],
      ];
      const result = buildRoutePayload(coords);
      expect(result).toBeDefined();
      if (result) {
        expect(result.pointsCount).toBe(2);
        expect(result.bbox).toEqual({
          minLat: 1,
          minLng: 2,
          maxLat: 3,
          maxLng: 4,
        });
      }
    });

    it('should return null for empty coordinates', () => {
      expect(buildRoutePayload([])).toBeNull();
      expect(buildRoutePayload(null)).toBeNull();
    });
  });
});
