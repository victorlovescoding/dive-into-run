import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/strava-helpers', () => ({
  formatDistance: vi.fn((m) => `${(m / 1000).toFixed(1)} km`),
  formatPace: vi.fn(() => '5\'30"/km'),
  formatDuration: vi.fn(() => '28:30'),
}));

vi.mock('@/components/RunsRouteMap', () => ({
  default: ({ summaryPolyline }) => <div data-testid="route-map" data-polyline={summaryPolyline} />,
}));

import RunsActivityCard from '@/components/RunsActivityCard';
import { formatDistance, formatPace, formatDuration } from '@/lib/strava-helpers';

/**
 * 建立 mock StravaActivity 物件。
 * @param {Partial<import('@/lib/firebase-strava').StravaActivity>} [overrides] - 覆寫屬性。
 * @returns {import('@/lib/firebase-strava').StravaActivity} mock activity。
 */
function createMockActivity(overrides = {}) {
  return {
    id: 'act-1',
    uid: 'user-1',
    stravaId: 12345,
    name: '晨跑',
    type: 'Run',
    distanceMeters: 5200,
    movingTimeSec: 1710,
    startDate: /** @type {import('firebase/firestore').Timestamp} */ ({
      toDate: () => new Date('2026-04-01T06:00:00'),
    }),
    startDateLocal: '2026-04-01T06:00:00',
    summaryPolyline: 'encodedstring',
    averageSpeed: 3.04,
    syncedAt: /** @type {import('firebase/firestore').Timestamp} */ ({
      toDate: () => new Date('2026-04-01T12:00:00'),
    }),
    ...overrides,
  };
}

describe('RunsActivityCard', () => {
  it('renders activity name and date', () => {
    const activity = createMockActivity();
    render(<RunsActivityCard activity={activity} />);

    expect(screen.getByText('晨跑')).toBeInTheDocument();
    expect(screen.getByText('2026-04-01')).toBeInTheDocument();
  });

  it('renders formatted distance, pace, and duration', () => {
    const activity = createMockActivity();
    render(<RunsActivityCard activity={activity} />);

    expect(formatDistance).toHaveBeenCalledWith(5200);
    expect(formatPace).toHaveBeenCalledWith(1710, 5200);
    expect(formatDuration).toHaveBeenCalledWith(1710);

    expect(screen.getByText('5.2 km')).toBeInTheDocument();
    expect(screen.getByText('5\'30"/km')).toBeInTheDocument();
    expect(screen.getByText('28:30')).toBeInTheDocument();
  });

  it('renders RunsRouteMap when summaryPolyline exists', () => {
    const activity = createMockActivity({ summaryPolyline: 'abc123' });
    render(<RunsActivityCard activity={activity} />);

    const map = screen.getByTestId('route-map');
    expect(map).toBeInTheDocument();
    expect(map).toHaveAttribute('data-polyline', 'abc123');
  });

  it('does not render RunsRouteMap when summaryPolyline is null', () => {
    const activity = createMockActivity({ summaryPolyline: null });
    render(<RunsActivityCard activity={activity} />);

    expect(screen.queryByTestId('route-map')).not.toBeInTheDocument();
  });
});
