import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// react-leaflet: 覆寫 vitest.setup.jsx 的 mock，加入 Polyline。
// react-leaflet 是外部 UI 邊界 mock（jsdom 無 DOM 量測 / Leaflet 需真實 DOM），允許保留。
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Polyline: ({ positions }) => (
    <div data-testid="polyline" data-positions={JSON.stringify(positions)} />
  ),
  useMap: () => ({ fitBounds: vi.fn() }),
}));

import RunsRouteMapInner from '@/components/RunsRouteMapInner';

// Google Encoded Polyline 標準範例字串，由 @mapbox/polyline 真實 decode 而來。
// decode 結果固定為 [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]。
const ENCODED = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
const DECODED_COORDS = [
  [38.5, -120.2],
  [40.7, -120.95],
  [43.252, -126.453],
];

describe('RunsRouteMap', () => {
  it('renders MapContainer with decoded coordinates as Polyline using real decoder', () => {
    render(<RunsRouteMapInner summaryPolyline={ENCODED} />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();

    const polyline = screen.getByTestId('polyline');
    expect(polyline).toBeInTheDocument();
    expect(JSON.parse(polyline.dataset.positions)).toEqual(DECODED_COORDS);
  });

  it('renders nothing when summaryPolyline is null', () => {
    render(<RunsRouteMapInner summaryPolyline={null} />);

    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('polyline')).not.toBeInTheDocument();
  });

  it('renders nothing when summaryPolyline is empty string', () => {
    render(<RunsRouteMapInner summaryPolyline="" />);

    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('polyline')).not.toBeInTheDocument();
  });
});
