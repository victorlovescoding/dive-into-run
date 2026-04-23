import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRoutePayload,
  buildUserPayload,
  getRemainingSeats,
  isDeadlinePassed,
  normalizeRoutePolylines,
} from '@/service/event-service';

describe('event-service business rules', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T08:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getRemainingSeats uses fallback participants count when event data omits it', () => {
    expect(getRemainingSeats(/** @type {any} */ ({ maxParticipants: 10 }), 4)).toBe(6);
    expect(
      getRemainingSeats(/** @type {any} */ ({ maxParticipants: 10, participantsCount: 12 })),
    ).toBe(0);
  });

  it('isDeadlinePassed compares against current time', () => {
    expect(
      isDeadlinePassed(/** @type {any} */ ({ registrationDeadline: '2026-04-23T08:29:59Z' })),
    ).toBe(true);
    expect(
      isDeadlinePassed(/** @type {any} */ ({ registrationDeadline: '2026-04-23T08:30:01Z' })),
    ).toBe(false);
    expect(isDeadlinePassed(/** @type {any} */ ({ registrationDeadline: null }))).toBe(false);
  });

  it('buildUserPayload normalizes user identity', () => {
    expect(buildUserPayload({ uid: 'u1', email: 'amy@example.com', photoURL: null })).toEqual({
      uid: 'u1',
      name: 'amy',
      photoURL: '',
    });
    expect(buildUserPayload(null)).toBeNull();
  });

  it('normalizeRoutePolylines supports new and legacy route payloads', () => {
    expect(
      normalizeRoutePolylines(/** @type {any} */ ({ polylines: ['abc', 'def'] })),
    ).toEqual(['abc', 'def']);
    expect(normalizeRoutePolylines(/** @type {any} */ ({ polyline: 'legacy' }))).toEqual([
      'legacy',
    ]);
    expect(normalizeRoutePolylines(null)).toEqual([]);
  });

  it('buildRoutePayload builds encoded polylines and bbox metadata', () => {
    const result = buildRoutePayload([
      [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
      ],
      [{ lat: 5, lng: 6 }],
    ]);

    expect(result).toMatchObject({
      polylines: expect.any(Array),
      pointsCount: 3,
      bbox: {
        minLat: 1,
        minLng: 2,
        maxLat: 5,
        maxLng: 6,
      },
    });
  });

  it('buildRoutePayload returns null when no valid coordinates exist', () => {
    expect(buildRoutePayload([])).toBeNull();
    expect(buildRoutePayload(null)).toBeNull();
    expect(buildRoutePayload([[{ lat: Number.NaN, lng: 2 }]])).toBeNull();
  });
});
