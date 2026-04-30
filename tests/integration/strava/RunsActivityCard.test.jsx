import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// `@/components/RunsRouteMap` 屬下游 UI 子元件灰區（plan §6 第 8 條），保留 mock；
// 真實 Leaflet 地圖在 jsdom 無法渲染。
vi.mock('@/components/RunsRouteMap', () => ({
  default: ({ summaryPolyline }) => <div data-testid="route-map" data-polyline={summaryPolyline} />,
}));

import RunsActivityCard from '@/components/RunsActivityCard';

/**
 * 建立 mock StravaActivity 物件。
 * @param {Partial<import('@/repo/client/firebase-strava-repo').StravaActivity>} [overrides] - 覆寫屬性。
 * @returns {import('@/repo/client/firebase-strava-repo').StravaActivity} mock activity。
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

  it('renders formatted distance, pace, and duration via real strava-helpers', () => {
    // 真實 helpers 對應結果：
    //   formatDistance(5200) -> '5.2 km'
    //   formatPace(1710, 5200) -> 1710 / 5.2 = 328.846 sec/km -> "5'28\"/km"
    //   formatDuration(1710) -> 1710s = 28m30s -> '28:30'
    const activity = createMockActivity();
    render(<RunsActivityCard activity={activity} />);

    expect(screen.getByText('5.2 km')).toBeInTheDocument();
    expect(screen.getByText('5\'28"/km')).toBeInTheDocument();
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
