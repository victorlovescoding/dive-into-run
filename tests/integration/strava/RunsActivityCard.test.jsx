import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RunsActivityCard from '@/components/RunsActivityCard';
import { createStravaFirestoreActivity } from '../../_helpers/strava-fixtures';

// `@/components/RunsRouteMap` 屬下游 UI 子元件灰區（plan §6 第 8 條），保留 mock；
// 真實 Leaflet 地圖在 jsdom 無法渲染。
vi.mock('@/components/RunsRouteMap', () => ({
  default: ({ summaryPolyline }) => (
    <figure aria-label="路線地圖" data-polyline={summaryPolyline} />
  ),
}));

describe('RunsActivityCard', () => {
  it('renders activity name and date', () => {
    const activity = createStravaFirestoreActivity();
    render(<RunsActivityCard activity={activity} />);

    expect(screen.getByText('晨跑')).toBeInTheDocument();
    expect(screen.getByText('2026-04-01')).toBeInTheDocument();
  });

  it('renders formatted distance, pace, and duration via real strava-helpers', () => {
    // 真實 helpers 對應結果：
    //   formatDistance(5200) -> '5.2 km'
    //   formatPace(1710, 5200) -> 1710 / 5.2 = 328.846 sec/km -> "5'28\"/km"
    //   formatDuration(1710) -> 1710s = 28m30s -> '28:30'
    const activity = createStravaFirestoreActivity();
    render(<RunsActivityCard activity={activity} />);

    expect(screen.getByText('5.2 km')).toBeInTheDocument();
    expect(screen.getByText('5\'28"/km')).toBeInTheDocument();
    expect(screen.getByText('28:30')).toBeInTheDocument();
  });

  it('renders RunsRouteMap when summaryPolyline exists', () => {
    const activity = createStravaFirestoreActivity({ summaryPolyline: 'abc123' });
    render(<RunsActivityCard activity={activity} />);

    const map = screen.getByRole('figure', { name: '路線地圖' });
    expect(map).toBeInTheDocument();
    expect(map).toHaveAttribute('data-polyline', 'abc123');
  });

  it('does not render RunsRouteMap when summaryPolyline is null', () => {
    const activity = createStravaFirestoreActivity({ summaryPolyline: null });
    render(<RunsActivityCard activity={activity} />);

    expect(screen.queryByRole('figure', { name: '路線地圖' })).not.toBeInTheDocument();
  });
});
