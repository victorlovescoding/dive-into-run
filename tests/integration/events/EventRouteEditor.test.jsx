import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import EventRouteEditor from '@/components/EventRouteEditor';

const drawnRoute = [
  [
    { lat: 25.033, lng: 121.565 },
    { lat: 25.034, lng: 121.566 },
  ],
];

vi.mock('next/dynamic', () => ({
  /**
   * Replaces the dynamically imported EventMap with a jsdom-safe boundary stub.
   * @returns {(props: {
   *   mode: string,
   *   encodedPolylines?: string[],
   *   initialEncodedPolylines?: string[],
   *   onRouteDrawn?: (coords: typeof drawnRoute) => void,
   * }) => import('react').ReactElement} Mocked dynamic component.
   */
  default: () => function EventMapBoundary({
    mode,
    encodedPolylines = [],
    initialEncodedPolylines = [],
    onRouteDrawn,
  }) {
    return (
      <section aria-label={`EventMap ${mode}`}>
        <div>encoded:{encodedPolylines.join(',') || 'none'}</div>
        <div>initial:{initialEncodedPolylines.join(',') || 'none'}</div>
        {mode === 'draw' && (
          <button
            type="button"
            onClick={() => {
              onRouteDrawn?.(drawnRoute);
            }}
          >
            完成繪製測試路線
          </button>
        )}
      </section>
    );
  },
}));

const route = {
  polylines: ['encoded-main'],
  pointsCount: 4,
  bbox: {
    minLat: 25.03,
    minLng: 121.56,
    maxLat: 25.04,
    maxLng: 121.57,
  },
};

/**
 * 建立 EventRouteEditor 的預設 props。
 * @param {Partial<import('@/components/EventRouteEditor').EventRouteEditorProps>} [overrides]
 *   覆蓋屬性。
 * @returns {import('@/components/EventRouteEditor').EventRouteEditorProps} props。
 */
function createProps(overrides = {}) {
  return {
    routeMode: 'view',
    route,
    routeCleared: false,
    editedRouteCoordinates: null,
    onModeChange: vi.fn(),
    onRouteClearedChange: vi.fn(),
    onRouteDrawn: vi.fn(),
    onEditedRouteChange: vi.fn(),
    ...overrides,
  };
}

describe('EventRouteEditor', () => {
  it('renders view mode with route metadata and map boundary', () => {
    render(<EventRouteEditor {...createProps()} />);

    expect(screen.getByText(/已設定路線/)).toHaveTextContent('4 點');
    expect(screen.getByRole('region', { name: 'EventMap view' })).toBeInTheDocument();
    expect(screen.getByText('encoded:encoded-main')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新繪製路線' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除路線' })).toBeInTheDocument();
  });

  it('switches from view mode to drawing a replacement route', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<EventRouteEditor {...props} />);

    await user.click(screen.getByRole('button', { name: '重新繪製路線' }));

    expect(props.onModeChange).toHaveBeenCalledWith('draw');
    expect(props.onEditedRouteChange).toHaveBeenCalledWith(null);
  });

  it('clears an existing route from view mode', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<EventRouteEditor {...props} />);

    await user.click(screen.getByRole('button', { name: '清除路線' }));

    expect(props.onRouteClearedChange).toHaveBeenCalledWith(true);
    expect(props.onEditedRouteChange).toHaveBeenCalledWith(null);
    expect(props.onModeChange).toHaveBeenCalledWith('none');
  });

  it('restores a cleared route from none mode', async () => {
    const user = userEvent.setup();
    const props = createProps({
      routeMode: 'none',
      routeCleared: true,
    });
    render(<EventRouteEditor {...props} />);

    expect(screen.getByText('路線已清除')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '復原清除' }));

    expect(props.onRouteClearedChange).toHaveBeenCalledWith(false);
    expect(props.onModeChange).toHaveBeenCalledWith('view');
  });

  it('starts a new route from none mode when no route exists', async () => {
    const user = userEvent.setup();
    const props = createProps({
      routeMode: 'none',
      route: null,
    });
    render(<EventRouteEditor {...props} />);

    expect(screen.getByText('此活動未設定路線')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '新增路線' }));

    expect(props.onModeChange).toHaveBeenCalledWith('draw');
    expect(props.onEditedRouteChange).toHaveBeenCalledWith(null);
  });

  it('renders draw mode for editing an existing route and cancels back to view', async () => {
    const user = userEvent.setup();
    const props = createProps({
      routeMode: 'draw',
    });
    render(<EventRouteEditor {...props} />);

    expect(screen.getByText('編輯既有路線（4 點）')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'EventMap draw' })).toBeInTheDocument();
    expect(screen.getByText('initial:encoded-main')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消繪製' }));

    expect(props.onEditedRouteChange).toHaveBeenCalledWith(null);
    expect(props.onModeChange).toHaveBeenCalledWith('view');
  });

  it('cancels draw mode back to none when the route was cleared', async () => {
    const user = userEvent.setup();
    const props = createProps({
      routeMode: 'draw',
      routeCleared: true,
    });
    render(<EventRouteEditor {...props} />);

    expect(screen.getByText('請在地圖上繪製路線')).toBeInTheDocument();
    expect(screen.getByText('initial:none')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消繪製' }));

    expect(props.onModeChange).toHaveBeenCalledWith('none');
  });

  it('shows edited route point count and forwards drawn coordinates', async () => {
    const user = userEvent.setup();
    const editedRouteCoordinates = [
      [
        { lat: 25.03, lng: 121.56 },
        { lat: 25.04, lng: 121.57 },
      ],
      [{ lat: 25.05, lng: 121.58 }],
    ];
    const props = createProps({
      routeMode: 'draw',
      editedRouteCoordinates,
    });
    render(<EventRouteEditor {...props} />);

    expect(screen.getByText(/路線已更新/)).toHaveTextContent('3 點');

    await user.click(screen.getByRole('button', { name: '完成繪製測試路線' }));

    expect(props.onRouteDrawn).toHaveBeenCalledWith(drawnRoute);
  });
});
