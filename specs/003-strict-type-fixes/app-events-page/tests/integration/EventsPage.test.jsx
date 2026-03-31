/* eslint-disable jsdoc/reject-any-type */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventsPage from '@/app/events/page';
import { AuthContext } from '@/contexts/AuthContext';
import * as firebaseEvents from '@/lib/firebase-events';

/**
 * @typedef {object} MockUser
 * @property {string} uid - The unique identifier for the user.
 * @property {string} displayName - The display name of the user.
 * @property {string} photoURL - The URL of the user's photo.
 */

// Mock Firebase client
vi.mock('@/lib/firebase-client', () => ({
  db: {},
}));

// Mock Firebase Events Service
vi.mock('@/lib/firebase-events', () => ({
  fetchLatestEvents: vi.fn(),
  fetchNextEvents: vi.fn(),
  queryEvents: vi.fn(),
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
  fetchMyJoinedEventsForIds: vi.fn(),
}));

// Mock Next.js dynamic
vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="event-map">Map Mock</div>,
}));

const mockAuthUser = {
  uid: 'user-123',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
};

const mockEvents = [
  {
    id: 'event-1',
    title: 'Morning Run',
    time: { toDate: () => new Date('2026-02-14T08:00:00Z') },
    city: '臺北市',
    district: '信義區',
    distanceKm: 5,
    paceSec: 300,
    maxParticipants: 10,
    participantsCount: 2,
    hostName: 'Host A',
  },
];

describe('EventsPage Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firebaseEvents.fetchLatestEvents).mockResolvedValue({
      events: mockEvents,
      lastDoc: /** @type {*} */ ({}),
    });
    vi.mocked(firebaseEvents.fetchMyJoinedEventsForIds).mockResolvedValue(new Set(['event-1']));
  });

  const renderPage = (user = mockAuthUser) => {
    const userToInject = /** @type {*} */ (user);
    const contextValue = {
      user: userToInject,
      setUser: vi.fn(),
      loading: false,
    };
    return render(
      <AuthContext.Provider value={contextValue}>
        <EventsPage />
      </AuthContext.Provider>,
    );
  };

  it('should render event list on load', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });

    expect(screen.getByText(/臺北市/)).toBeInTheDocument();
    expect(screen.getByText(/信義區/)).toBeInTheDocument();
    expect(screen.getByText(/5\.?0* km/)).toBeInTheDocument();
  });

  it('should show joined status if user is a participant', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /退出/i })).toBeInTheDocument();
    });
  });

  it('should open filter modal when clicking filter button', async () => {
    const user = userEvent.setup();
    renderPage();

    const filterBtn = await screen.findByRole('button', { name: /篩選/i });
    await user.click(filterBtn);

    expect(screen.getByText('篩選活動')).toBeInTheDocument();
    expect(screen.getByLabelText(/縣市/i)).toBeInTheDocument();
  });

  it('should trigger joinEvent when clicking join button', async () => {
    vi.mocked(firebaseEvents.fetchMyJoinedEventsForIds).mockResolvedValue(new Set());
    const user = userEvent.setup();
    renderPage();

    const joinBtn = await screen.findByRole('button', { name: /參加/i });
    await user.click(joinBtn);

    expect(firebaseEvents.joinEvent).toHaveBeenCalled();
  });
});
