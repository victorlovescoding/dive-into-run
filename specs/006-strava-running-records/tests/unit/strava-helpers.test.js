import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('@mapbox/polyline', () => ({
  decode: vi.fn(),
}));

import { decode } from '@mapbox/polyline';

const mockedDecode = /** @type {import('vitest').Mock} */ (decode);

import { formatDistance, formatPace, formatDuration, decodePolyline } from '@/lib/strava-helpers';

// ---------------------------------------------------------------------------
// formatDistance
// ---------------------------------------------------------------------------
describe('Unit: formatDistance', () => {
  it('should format 0 meters as "0.0 km"', () => {
    // Arrange
    const meters = 0;
    // Act
    const result = formatDistance(meters);
    // Assert
    expect(result).toBe('0.0 km');
  });

  it('should format 800 meters as "0.8 km"', () => {
    // Arrange
    const meters = 800;
    // Act
    const result = formatDistance(meters);
    // Assert
    expect(result).toBe('0.8 km');
  });

  it('should format 5200 meters as "5.2 km"', () => {
    // Arrange
    const meters = 5200;
    // Act
    const result = formatDistance(meters);
    // Assert
    expect(result).toBe('5.2 km');
  });

  it('should format 42195 meters as "42.2 km"', () => {
    // Arrange
    const meters = 42195;
    // Act
    const result = formatDistance(meters);
    // Assert
    expect(result).toBe('42.2 km');
  });
});

// ---------------------------------------------------------------------------
// formatPace
// ---------------------------------------------------------------------------
describe('Unit: formatPace', () => {
  it('should calculate pace for normal case (1650s / 5200m = "5\'17"/km")', () => {
    // Arrange
    const movingTimeSec = 1650;
    const distanceMeters = 5200;
    // Act
    const result = formatPace(movingTimeSec, distanceMeters);
    // Assert — 1650 / 5.2 = 317.307… → 5 min 17 sec
    expect(result).toBe('5\'17"/km');
  });

  it('should format exact minute pace (300s / 1000m = "5\'00"/km")', () => {
    // Arrange
    const movingTimeSec = 300;
    const distanceMeters = 1000;
    // Act
    const result = formatPace(movingTimeSec, distanceMeters);
    // Assert
    expect(result).toBe('5\'00"/km');
  });

  it('should pad seconds with leading zero (301s / 1000m = "5\'01"/km")', () => {
    // Arrange
    const movingTimeSec = 301;
    const distanceMeters = 1000;
    // Act
    const result = formatPace(movingTimeSec, distanceMeters);
    // Assert
    expect(result).toBe('5\'01"/km');
  });

  it('should return fallback when distance is zero', () => {
    // Arrange
    const movingTimeSec = 300;
    const distanceMeters = 0;
    // Act
    const result = formatPace(movingTimeSec, distanceMeters);
    // Assert
    expect(result).toBe('-\'--"/km');
  });

  it('should return "0\'00"/km" when time is zero', () => {
    // Arrange
    const movingTimeSec = 0;
    const distanceMeters = 5000;
    // Act
    const result = formatPace(movingTimeSec, distanceMeters);
    // Assert
    expect(result).toBe('0\'00"/km');
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------
describe('Unit: formatDuration', () => {
  it('should format duration under 1 hour as mm:ss (1710s = "28:30")', () => {
    // Arrange
    const seconds = 1710;
    // Act
    const result = formatDuration(seconds);
    // Assert
    expect(result).toBe('28:30');
  });

  it('should format duration >= 1 hour as h:mm:ss (3750s = "1:02:30")', () => {
    // Arrange
    const seconds = 3750;
    // Act
    const result = formatDuration(seconds);
    // Assert
    expect(result).toBe('1:02:30');
  });

  it('should format 0 seconds as "0:00"', () => {
    // Arrange
    const seconds = 0;
    // Act
    const result = formatDuration(seconds);
    // Assert
    expect(result).toBe('0:00');
  });

  it('should format exact hour (3600s = "1:00:00")', () => {
    // Arrange
    const seconds = 3600;
    // Act
    const result = formatDuration(seconds);
    // Assert
    expect(result).toBe('1:00:00');
  });
});

// ---------------------------------------------------------------------------
// decodePolyline
// ---------------------------------------------------------------------------
describe('Unit: decodePolyline', () => {
  beforeEach(() => {
    mockedDecode.mockClear();
  });

  it('should call @mapbox/polyline.decode and return lat/lng pairs', () => {
    // Arrange
    const encoded = 'encodedString123';
    const expected = [
      [25.033, 121.565],
      [25.034, 121.566],
    ];
    mockedDecode.mockReturnValue(expected);
    // Act
    const result = decodePolyline(encoded);
    // Assert
    expect(mockedDecode).toHaveBeenCalledWith(encoded);
    expect(result).toEqual(expected);
  });

  it('should return empty array when input is null', () => {
    // Arrange / Act
    const result = decodePolyline(null);
    // Assert
    expect(result).toEqual([]);
    expect(mockedDecode).not.toHaveBeenCalled();
  });

  it('should return empty array when input is empty string', () => {
    // Arrange / Act
    const result = decodePolyline('');
    // Assert
    expect(result).toEqual([]);
    expect(mockedDecode).not.toHaveBeenCalled();
  });
});
