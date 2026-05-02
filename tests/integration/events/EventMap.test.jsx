import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @typedef {object} MockLatLng
 * @property {number} lat - Latitude.
 * @property {number} lng - Longitude.
 */

/**
 * @typedef {object} MockBounds
 * @property {string} kind - Bounds source label.
 * @property {MockLatLng[]} [points] - Line points used to create bounds.
 * @property {MockLatLng} [sw] - South-west bbox corner.
 * @property {MockLatLng} [ne] - North-east bbox corner.
 * @property {MockBounds[]} extended - Bounds merged into this bounds object.
 * @property {(bounds: MockBounds) => MockBounds} extend - Merge another bounds object.
 */

const leafletHarness = vi.hoisted(() => {
  /**
   * 建立可觀察的 Leaflet bounds test double。
   * @param {Partial<MockBounds>} options - Bounds attributes.
   * @returns {MockBounds} Bounds test double.
   */
  function createBounds(options = {}) {
    return {
      kind: 'bounds',
      extended: [],
      extend(bounds) {
        this.extended.push(bounds);
        return this;
      },
      ...options,
    };
  }

  /**
   * 建立 EventMap 使用的 map API test double。
   * @returns {object} Map API test double.
   */
  function createMap() {
    return {
      addControl: vi.fn(),
      addLayer: vi.fn(),
      fitBounds: vi.fn(),
      handlers: new Map(),
      off: vi.fn(function handleMapOff(eventName, handler) {
        if (handler && this.handlers.get(eventName) === handler) {
          this.handlers.delete(eventName);
        }
      }),
      on: vi.fn(function handleMapOn(eventName, handler) {
        this.handlers.set(eventName, handler);
      }),
      removeControl: vi.fn(),
      removeLayer: vi.fn(),
    };
  }

  return {
    controls: [],
    createBounds,
    createMap,
    currentMap: createMap(),
    featureGroups: [],
    polylines: [],
  };
});

const polylineHarness = vi.hoisted(() => ({
  decode: vi.fn(),
}));

// react-leaflet is a browser/map rendering boundary; jsdom cannot create a real Leaflet map.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, style }) => (
    <div role="region" aria-label="活動地圖" style={style}>
      {children}
    </div>
  ),
  TileLayer: () => null,
  useMap: () => leafletHarness.currentMap,
}));

// Leaflet is mocked at the package boundary so EventMap logic still executes in jsdom.
vi.mock('leaflet', () => {
  /**
   * Leaflet default icon constructor stub.
   */
  function DefaultIcon() {}
  DefaultIcon.prototype._getIconUrl = vi.fn();
  DefaultIcon.mergeOptions = vi.fn();

  class MockPolyline {
    /**
     * @param {MockLatLng[]} latlngs - Polyline coordinates.
     * @param {object} options - Leaflet style options.
     */
    constructor(latlngs, options) {
      this.latlngs = latlngs;
      this.options = options;
      this.bounds = leafletHarness.createBounds({
        kind: 'lineBounds',
        points: latlngs,
      });
      leafletHarness.polylines.push(this);
    }

    /**
     * @param {object} map - Leaflet map API.
     * @returns {MockPolyline} This polyline.
     */
    addTo(map) {
      map.addLayer(this);
      return this;
    }

    /**
     * @returns {MockBounds} Polyline bounds.
     */
    getBounds() {
      return this.bounds;
    }

    /**
     * @returns {MockLatLng[]} Polyline coordinates.
     */
    getLatLngs() {
      return this.latlngs;
    }
  }

  class MockFeatureGroup {
    constructor() {
      this.layers = [];
      leafletHarness.featureGroups.push(this);
    }

    /**
     * @param {MockPolyline} layer - Layer to store.
     * @returns {void}
     */
    addLayer(layer) {
      this.layers.push(layer);
    }

    /**
     * @returns {void}
     */
    clearLayers() {
      this.layers = [];
    }

    /**
     * @param {(layer: MockPolyline) => void} callback - Layer visitor.
     * @returns {void}
     */
    eachLayer(callback) {
      this.layers.forEach(callback);
    }
  }

  class MockDrawControl {
    /**
     * @param {object} options - Draw control options.
     */
    constructor(options) {
      this.options = options;
      leafletHarness.controls.push(this);
    }
  }

  const L = {
    Control: { Draw: MockDrawControl },
    Draw: {
      Event: {
        CREATED: 'draw:created',
        DELETED: 'draw:deleted',
        EDITED: 'draw:edited',
      },
    },
    FeatureGroup: MockFeatureGroup,
    Icon: { Default: DefaultIcon },
    Polyline: MockPolyline,
    latLng: (lat, lng) => ({ lat, lng }),
    latLngBounds: (sw, ne) =>
      leafletHarness.createBounds({
        kind: 'bbox',
        ne,
        sw,
      }),
    polyline: (latlngs, options) => new MockPolyline(latlngs, options),
  };

  return {
    ...L,
    default: L,
  };
});

// leaflet-draw mutates Leaflet in the browser; EventMap only needs the package boundary loaded.
vi.mock('leaflet-draw', () => ({}));

// leaflet-geosearch is an external UI control; the test verifies EventMap adds/removes the control.
vi.mock('leaflet-geosearch', () => ({
  GeoSearchControl: class GeoSearchControl {
    /**
     * @param {object} options - Search control options.
     */
    constructor(options) {
      this.options = options;
    }
  },
  OpenStreetMapProvider: class OpenStreetMapProvider {},
}));

// @mapbox/polyline is mocked as the external encoded-route boundary.
vi.mock('@mapbox/polyline', () => ({
  default: {
    decode: polylineHarness.decode,
  },
}));

import EventMap from '@/components/EventMap';

/**
 * @param {string} encoded - Encoded polyline test key.
 * @returns {number[][]} Decoded coordinate pairs.
 */
function decodeRoute(encoded) {
  const fixtures = {
    'draw-initial': [
      [10, 20],
      [30, 40],
    ],
    'view-a': [
      [1, 2],
      [3, 4],
    ],
    'view-b': [
      [5, 6],
      [7, 8],
    ],
  };

  if (encoded === 'broken') {
    throw new Error('malformed polyline');
  }

  return fixtures[encoded] || [];
}

describe('Integration: EventMap', () => {
  beforeEach(() => {
    leafletHarness.controls = [];
    leafletHarness.currentMap = leafletHarness.createMap();
    leafletHarness.featureGroups = [];
    leafletHarness.polylines = [];
    polylineHarness.decode.mockImplementation(decodeRoute);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders view mode routes, fits the provided bbox, and removes route layers on cleanup', () => {
    const bbox = {
      maxLat: 9,
      maxLng: 10,
      minLat: 1,
      minLng: 2,
    };

    const { unmount } = render(
      <EventMap
        mode="view"
        encodedPolylines={['view-a', 'view-b']}
        bbox={bbox}
        height={360}
      />,
    );

    expect(screen.getByRole('region', { name: '活動地圖' })).toHaveStyle({ height: '360px' });

    const routeLayers = leafletHarness.currentMap.addLayer.mock.calls.map(([layer]) => layer);
    expect(routeLayers.map((layer) => layer.getLatLngs())).toEqual([
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ]);

    const [fitBounds, fitOptions] = leafletHarness.currentMap.fitBounds.mock.calls[0];
    expect(fitBounds).toMatchObject({
      kind: 'bbox',
      ne: { lat: 9, lng: 10 },
      sw: { lat: 1, lng: 2 },
    });
    expect(fitOptions).toEqual({ padding: [18, 18] });

    unmount();

    const removedLayers = leafletHarness.currentMap.removeLayer.mock.calls.map(([layer]) => layer);
    expect(removedLayers).toEqual(routeLayers);
  });

  it('falls back to route bounds when bbox is not provided', () => {
    render(<EventMap mode="view" encodedPolylines={['view-a', 'view-b']} />);

    const [fitBounds] = leafletHarness.currentMap.fitBounds.mock.calls[0];
    const routeBounds = leafletHarness.currentMap.addLayer.mock.calls.map(
      ([layer]) => layer.getBounds(),
    );

    expect(fitBounds).toBe(routeBounds[0]);
    expect(fitBounds.extended).toEqual([routeBounds[0], routeBounds[1]]);
  });

  it('skips empty and malformed view-mode polylines without touching the map', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(<EventMap mode="view" encodedPolylines={[]} />);

    expect(leafletHarness.currentMap.addLayer).not.toHaveBeenCalled();
    expect(leafletHarness.currentMap.fitBounds).not.toHaveBeenCalled();

    rerender(<EventMap mode="view" encodedPolylines={['broken']} />);

    expect(consoleError).toHaveBeenCalledWith('decode polylines failed:', expect.any(Error));
    expect(leafletHarness.currentMap.addLayer).not.toHaveBeenCalled();
    expect(leafletHarness.currentMap.fitBounds).not.toHaveBeenCalled();
  });

  it('loads draw-mode routes and reports created, edited, and deleted route payloads', () => {
    /** @type {import('vitest').Mock} */
    const onRouteDrawn = vi.fn();

    const { unmount } = render(
      <EventMap
        mode="draw"
        initialEncodedPolylines={['draw-initial']}
        onRouteDrawn={onRouteDrawn}
      />,
    );

    const editableLayers = leafletHarness.featureGroups[0];
    expect(editableLayers.layers.map((layer) => layer.getLatLngs())).toEqual([
      [
        { lat: 10, lng: 20 },
        { lat: 30, lng: 40 },
      ],
    ]);

    const [initialFitBounds, initialFitOptions] = leafletHarness.currentMap.fitBounds.mock.calls[0];
    expect(initialFitBounds).toMatchObject({ kind: 'lineBounds' });
    expect(initialFitOptions).toEqual({ padding: [18, 18] });

    const CreatedPolyline = leafletHarness.polylines.at(-1).constructor;
    const createdLayer = new CreatedPolyline(
      [
        { lat: 50, lng: 60 },
        { lat: 70, lng: 80 },
      ],
      { color: '#0f0' },
    );

    leafletHarness.currentMap.handlers.get('draw:created')({ layer: createdLayer });

    expect(onRouteDrawn).toHaveBeenCalledWith([
      [
        { lat: 10, lng: 20 },
        { lat: 30, lng: 40 },
      ],
      [
        { lat: 50, lng: 60 },
        { lat: 70, lng: 80 },
      ],
    ]);

    leafletHarness.currentMap.handlers.get('draw:edited')();
    expect(onRouteDrawn.mock.calls.at(-1)[0]).toEqual([
      [
        { lat: 10, lng: 20 },
        { lat: 30, lng: 40 },
      ],
      [
        { lat: 50, lng: 60 },
        { lat: 70, lng: 80 },
      ],
    ]);

    editableLayers.clearLayers();
    leafletHarness.currentMap.handlers.get('draw:deleted')();
    expect(onRouteDrawn.mock.calls.at(-1)[0]).toBeNull();

    unmount();

    expect(leafletHarness.currentMap.removeControl.mock.calls.map(([control]) => control)).toEqual(
      expect.arrayContaining(leafletHarness.currentMap.addControl.mock.calls.map(([control]) => control)),
    );
    expect(leafletHarness.currentMap.removeLayer).toHaveBeenCalledWith(editableLayers);
    expect([...leafletHarness.currentMap.handlers.keys()]).toEqual([]);
  });
});
