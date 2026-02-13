import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RunTogetherPage from '../../src/app/events/page';
import { AuthContext } from '../../src/contexts/AuthContext';

// 1. Mock Next.js Navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/events',
}));

// 2. Mock Firebase Client (Prevent real initialization)
vi.mock('../../src/lib/firebase-client', () => ({
  auth: {},
  db: {},
}));

// 3. Mock Firebase Logic Layer
vi.mock('../../src/lib/firebase-events', () => ({
  fetchLatestEvents: vi.fn(),
  fetchNextEvents: vi.fn(),
  queryEvents: vi.fn(),
  createEvent: vi.fn(),
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
  fetchMyJoinedEventsForIds: vi.fn(() => Promise.resolve(new Set())),
}));

// 4. Mock Leaflet Components (handled globally in setup, but specific component mock here is safer)
vi.mock('../../src/components/EventMap', () => ({
  default: () => <div data-testid="event-map" />,
}));

import { fetchLatestEvents } from '../../src/lib/firebase-events';

/**
 * @typedef {import('vitest').Mock} Mock
 */

describe('RunTogetherPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', async () => {
    /** @type {Mock} */
    (fetchLatestEvents).mockResolvedValue({ events: [], lastDoc: null });

    render(
      <AuthContext.Provider value={{ user: null, loading: false, setUser: vi.fn() }}>
        <RunTogetherPage />
      </AuthContext.Provider>
    );

    expect(screen.getByText('這是揪團跑步頁面')).toBeInTheDocument();
  });

  it('renders event list from fetchLatestEvents', async () => {
    const mockEvents = [
      { id: '1', title: 'Morning Run', city: 'Taipei', district: 'Xinyi', time: '2023-10-10 06:00' },
      { id: '2', title: 'Night Run', city: 'Taipei', district: 'Da-an', time: '2023-10-10 20:00' },
    ];
    /** @type {Mock} */
    (fetchLatestEvents).mockResolvedValue({ events: mockEvents, lastDoc: {} });

    render(
      <AuthContext.Provider value={{ user: null, loading: false, setUser: vi.fn() }}>
        <RunTogetherPage />
      </AuthContext.Provider>
    );

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
      expect(screen.getByText('Night Run')).toBeInTheDocument();
    });
  });

  it('shows "Create Run" button only when logged in', async () => {
    /** @type {Mock} */
    (fetchLatestEvents).mockResolvedValue({ events: [], lastDoc: null });

    // Case 1: Logged Out
    const { unmount } = render(
      <AuthContext.Provider value={{ user: null, loading: false, setUser: vi.fn() }}>
        <RunTogetherPage />
      </AuthContext.Provider>
    );
    expect(screen.queryByText('＋ 新增跑步揪團')).not.toBeInTheDocument();
    unmount();

    // Case 2: Logged In
    render(
      <AuthContext.Provider value={{ user: { uid: '123' }, loading: false, setUser: vi.fn() }}>
        <RunTogetherPage />
      </AuthContext.Provider>
    );
    expect(screen.getByText('＋ 新增跑步揪團')).toBeInTheDocument();
  });
});
