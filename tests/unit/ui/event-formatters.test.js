import { describe, expect, it } from 'vitest';
import {
  formatDateTime,
  formatPace,
  renderRouteLabel as formatRouteStatus,
} from '@/ui/events/event-formatters';

/**
 * 建立 `renderRouteLabel` 可接受的最小完整活動資料。
 * @param {Partial<import('@/service/event-service').EventData>} [overrides] - 測試覆寫欄位。
 * @returns {import('@/service/event-service').EventData} 活動 fixture。
 */
function createEvent(overrides = {}) {
  return {
    city: '台北市',
    district: '大安區',
    time: '2026-05-02T08:00:00+08:00',
    registrationDeadline: '2026-05-01T20:00:00+08:00',
    distanceKm: 5,
    maxParticipants: 12,
    paceSec: 360,
    ...overrides,
  };
}

/**
 * 建立最小完整 route payload。
 * @param {number} pointsCount - route 點數。
 * @returns {import('@/service/event-service').RoutePayload} route fixture。
 */
function createRoutePayload(pointsCount) {
  return {
    polylines: [],
    pointsCount,
    bbox: {
      minLat: 0,
      minLng: 0,
      maxLat: 0,
      maxLng: 0,
    },
  };
}


describe('Unit: event formatters', () => {
  describe('formatDateTime', () => {
    it('returns an empty label when no date is available', () => {
      // Arrange
      const value = null;

      // Act
      const result = formatDateTime(value);

      // Assert
      expect(result).toBe('');
    });

    it('keeps plain datetime strings readable by replacing the date separator', () => {
      // Arrange
      const value = '2026-05-02T08:05:00+08:00';

      // Act
      const result = formatDateTime(value);

      // Assert
      expect(result).toBe('2026-05-02 08:05:00+08:00');
    });

    it('formats Timestamp-like values with zero-padded local date and time parts', () => {
      // Arrange
      const value = {
        toDate: () => new Date(2026, 4, 2, 8, 5),
      };

      // Act
      const result = formatDateTime(value);

      // Assert
      expect(result).toBe('2026-05-02 08:05');
    });

    it('falls back to String(value) for non-Date object values', () => {
      // Arrange
      const value = /** @type {{ toDate?: () => Date }} */ ({});

      // Act
      const result = formatDateTime(value);

      // Assert
      expect(result).toBe('[object Object]');
    });
  });

  describe('formatPace', () => {
    it('formats numeric pace seconds into mm:ss', () => {
      // Arrange
      const paceSec = 366;

      // Act
      const result = formatPace(paceSec);

      // Assert
      expect(result).toBe('06:06');
    });

    it('formats numeric string pace seconds into mm:ss', () => {
      // Arrange
      const paceSec = '300';

      // Act
      const result = formatPace(paceSec);

      // Assert
      expect(result).toBe('05:00');
    });

    it('uses fallback text for blank and missing pace values', () => {
      // Arrange
      const fallbackText = '自由配';

      // Act
      const blankResult = formatPace('', fallbackText);
      const nullResult = formatPace(null, fallbackText);

      // Assert
      expect(blankResult).toBe(fallbackText);
      expect(nullResult).toBe(fallbackText);
    });

    it('returns an empty label for invalid pace values without fallback text', () => {
      // Arrange
      const paceSec = 'not-a-number';

      // Act
      const result = formatPace(paceSec);

      // Assert
      expect(result).toBe('');
    });

    it('uses fallback text for invalid or negative pace values', () => {
      // Arrange
      const fallbackText = '現場調整';

      // Act
      const invalidResult = formatPace('fast', fallbackText);
      const negativeResult = formatPace(-1, fallbackText);

      // Assert
      expect(invalidResult).toBe(fallbackText);
      expect(negativeResult).toBe(fallbackText);
    });
  });

  describe('renderRouteLabel', () => {
    it('counts route coordinate points across all segments', () => {
      // Arrange
      const event = createEvent({
        routeCoordinates: [
          [
            { lat: 25.033, lng: 121.565 },
            { lat: 25.034, lng: 121.566 },
          ],
          [{ lat: 25.035, lng: 121.567 }],
        ],
      });

      // Act
      const result = formatRouteStatus(event);

      // Assert
      expect(result).toBe('已設定（3 點）');
    });

    it('falls back to legacy route point counts when route coordinates are absent', () => {
      // Arrange
      const event = createEvent({
        route: createRoutePayload(7),
      });

      // Act
      const result = formatRouteStatus(event);

      // Assert
      expect(result).toBe('已設定（7 點）');
    });

    it('returns an unset route label when no route data has points', () => {
      // Arrange
      const event = createEvent({
        routeCoordinates: [],
        route: createRoutePayload(0),
      });

      // Act
      const result = formatRouteStatus(event);

      // Assert
      expect(result).toBe('未設定');
    });
  });
});
