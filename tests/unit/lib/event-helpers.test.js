import { describe, it, expect } from 'vitest';
import {
  countTotalPoints,
  formatDateTime,
  formatCommentTime,
  formatCommentTimeFull,
  formatPace,
  toNumber,
  toMs,
  chunkArray,
} from '@/lib/event-helpers';

describe('event-helpers unit tests', () => {
  describe('formatDateTime', () => {
    it('formats Firestore timestamp-like values', () => {
      const value = {
        toDate: () => new Date('2026-04-23T08:30:00'),
      };

      expect(formatDateTime(value)).toBe('2026-04-23 08:30');
    });

    it('keeps string values readable', () => {
      expect(formatDateTime('2026-04-23T08:30')).toBe('2026-04-23 08:30');
    });
  });

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

  describe('toMs', () => {
    it('converts strings and Firestore timestamp-like values', () => {
      const value = {
        toDate: () => new Date('2026-04-23T08:30:00'),
      };

      expect(toMs('2026-04-23T08:30:00')).toBe(new Date('2026-04-23T08:30:00').getTime());
      expect(toMs(value)).toBe(new Date('2026-04-23T08:30:00').getTime());
    });

    it('returns null for invalid values', () => {
      expect(toMs('bad-time')).toBeNull();
      expect(toMs(null)).toBeNull();
      expect(toMs(undefined)).toBeNull();
    });
  });

  describe('countTotalPoints', () => {
    it('counts points across all segments', () => {
      expect(
        countTotalPoints([
          [
            { lat: 1, lng: 2 },
            { lat: 3, lng: 4 },
          ],
          [{ lat: 5, lng: 6 }],
        ]),
      ).toBe(3);
    });

    it('returns 0 for non-array values', () => {
      expect(countTotalPoints(null)).toBe(0);
    });
  });

  describe('comment time formatters', () => {
    const value = {
      toDate: () => new Date('2026-04-23T08:30:00'),
    };

    it('formats short comment time', () => {
      expect(formatCommentTime(value)).toBe('4/23 08:30');
    });

    it('formats full comment time', () => {
      expect(formatCommentTimeFull(value)).toBe('2026年4月23日 08:30');
    });
  });
});
