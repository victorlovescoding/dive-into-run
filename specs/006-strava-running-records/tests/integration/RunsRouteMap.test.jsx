import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock strava-helpers
vi.mock('@/lib/strava-helpers', () => ({
  decodePolyline: vi.fn(),
}));

// react-leaflet: 覆寫 vitest.setup.jsx 的 mock，加入 Polyline
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Polyline: ({ positions }) => (
    <div data-testid="polyline" data-positions={JSON.stringify(positions)} />
  ),
  useMap: () => ({ fitBounds: vi.fn() }),
}));

import { decodePolyline } from '@/lib/strava-helpers';
import { RunsRouteMapInner } from '@/components/RunsRouteMap';

const mockedDecode = /** @type {import('vitest').Mock} */ (decodePolyline);

const ENCODED = 'abc123encoded';
const DECODED_COORDS = [
  [25.033, 121.565],
  [25.034, 121.566],
  [25.035, 121.567],
];

describe('RunsRouteMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDecode.mockReturnValue(DECODED_COORDS);
  });

  it('calls decodePolyline with summaryPolyline prop', () => {
    render(<RunsRouteMapInner summaryPolyline={ENCODED} />);

    expect(mockedDecode).toHaveBeenCalledWith(ENCODED);
  });

  it('renders MapContainer with decoded coordinates as Polyline', () => {
    render(<RunsRouteMapInner summaryPolyline={ENCODED} />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();

    const polyline = screen.getByTestId('polyline');
    expect(polyline).toBeInTheDocument();
    expect(JSON.parse(polyline.dataset.positions)).toEqual(DECODED_COORDS);
  });

  it('renders nothing meaningful when summaryPolyline is null', () => {
    mockedDecode.mockReturnValue([]);

    const { container } = render(<RunsRouteMapInner summaryPolyline={null} />);

    expect(container.firstChild).toBeEmptyDOMElement();
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
  });

  it('renders nothing meaningful when summaryPolyline is empty string', () => {
    mockedDecode.mockReturnValue([]);

    const { container } = render(<RunsRouteMapInner summaryPolyline="" />);

    expect(container.firstChild).toBeEmptyDOMElement();
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
  });
});
