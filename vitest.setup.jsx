import '@testing-library/jest-dom'; // eslint-disable-line import/no-extraneous-dependencies
import { vi } from 'vitest'; // eslint-disable-line import/no-extraneous-dependencies

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver (Missing in JSDOM)
global.IntersectionObserver = class IntersectionObserver {
  get root() {
    return null;
  }
  get rootMargin() {
    return '';
  }
  get thresholds() {
    return [];
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Global Mock for Leaflet (Avoids 'window is not defined' in JSDOM)
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(),
    tileLayer: vi.fn(),
    marker: vi.fn(),
    icon: vi.fn(),
    divIcon: vi.fn(),
    latLng: vi.fn(),
    latLngBounds: vi.fn(),
  },
  map: vi.fn(),
  tileLayer: vi.fn(),
  marker: vi.fn(),
  icon: vi.fn(),
  divIcon: vi.fn(),
  latLng: vi.fn(),
  latLngBounds: vi.fn(),
}));

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    fitBounds: vi.fn(),
    setView: vi.fn(),
  }),
}));

// Mock leaflet-draw
vi.mock('leaflet-draw', () => ({}));

// Global Mock for Firebase client (prevents FirebaseError: invalid-api-key in JSDOM)
vi.mock('@/lib/firebase-client', () => ({
  auth: {},
  db: {},
  storage: {},
  provider: { providerId: 'google.com' },
}));
