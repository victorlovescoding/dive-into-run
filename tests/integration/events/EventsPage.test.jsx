import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
} from 'firebase/firestore';
import EventsPage from '@/app/events/page';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import ToastProvider from '@/runtime/providers/ToastProvider';

/**
 * @typedef {object} MockUser
 * @property {string} uid - The unique identifier for the user.
 * @property {string} displayName - The display name of the user.
 * @property {string} name - The runtime display name of the user.
 * @property {string} photoURL - The URL of the user's photo.
 */

vi.mock('@/config/client/firebase-client', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  startAfter: vi.fn(),
  where: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="event-map">Map Mock</div>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/events',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const firestoreMocks = {
  ['collection']: /** @type {import('vitest').Mock} */ (collection),
  ['doc']: /** @type {import('vitest').Mock} */ (doc),
  ['getDoc']: /** @type {import('vitest').Mock} */ (getDoc),
  ['getDocs']: /** @type {import('vitest').Mock} */ (getDocs),
  ['limit']: /** @type {import('vitest').Mock} */ (limit),
  ['orderBy']: /** @type {import('vitest').Mock} */ (orderBy),
  ['query']: /** @type {import('vitest').Mock} */ (query),
  ['runTransaction']: /** @type {import('vitest').Mock} */ (runTransaction),
  ['serverTimestamp']: /** @type {import('vitest').Mock} */ (serverTimestamp),
  ['startAfter']: /** @type {import('vitest').Mock} */ (startAfter),
  ['timestampFromDate']: /** @type {import('vitest').Mock} */ (Timestamp.fromDate),
  ['where']: /** @type {import('vitest').Mock} */ (where),
};

const mockAuthUser = {
  uid: 'user-123',
  displayName: 'Test User',
  name: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
};

/**
 * 建立符合 Firestore Timestamp shape 的測試時間物件。
 * @param {string} isoString - ISO 日期字串。
 * @returns {import('firebase/firestore').Timestamp} mock timestamp。
 */
function createMockTimestamp(isoString) {
  const date = new Date(isoString);
  const seconds = Math.floor(date.getTime() / 1000);

  return /** @type {import('firebase/firestore').Timestamp} */ (
    /** @type {unknown} */ ({
      seconds,
      nanoseconds: 0,
      toDate: () => date,
      toMillis: () => date.getTime(),
      isEqual: () => false,
      toJSON: () => ({ seconds, nanoseconds: 0, type: 'timestamp' }),
    })
  );
}

const mockEvents = [
  {
    id: 'event-1',
    title: 'Morning Run',
    time: createMockTimestamp('2027-05-14T08:00:00Z'),
    registrationDeadline: createMockTimestamp('2027-05-13T08:00:00Z'),
    city: '臺北市',
    district: '信義區',
    meetPlace: '象山站',
    distanceKm: 5,
    paceSec: 300,
    maxParticipants: 10,
    participantsCount: 2,
    remainingSeats: 8,
    hostUid: 'host-a',
    hostName: 'Host A',
  },
];

/**
 * 建立 Firestore document snapshot stub。
 * @param {string} id - document ID。
 * @param {object | null} data - document data，null 表示不存在。
 * @returns {object} Firestore-like document snapshot。
 */
function createDocSnapshot(id, data) {
  return {
    id,
    ref: { id, path: `mock/${id}` },
    exists: () => data !== null,
    data: () => data,
  };
}

/**
 * 設定 EventsPage 需要的 Firestore SDK 邊界 stub。
 * @param {{ joinedIds?: string[] }} [options] - 使用者已參加活動 ID。
 */
function setupFirestoreMocks({ joinedIds = ['event-1'] } = {}) {
  firestoreMocks.collection.mockImplementation((_dbOrRef, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  }));
  firestoreMocks.doc.mockImplementation((base, ...segments) => {
    if (base?.type === 'collection') {
      return { id: String(segments.at(-1)), path: [base.path, ...segments].join('/') };
    }
    return { id: String(segments.at(-1)), path: segments.join('/') };
  });
  firestoreMocks.query.mockImplementation((...parts) => ({
    type: 'query',
    path: parts[0]?.path,
    parts,
  }));
  firestoreMocks.where.mockImplementation((...parts) => ({ type: 'where', parts }));
  firestoreMocks.orderBy.mockImplementation((...parts) => ({ type: 'orderBy', parts }));
  firestoreMocks.limit.mockImplementation((count) => ({ type: 'limit', count }));
  firestoreMocks.startAfter.mockImplementation((...parts) => ({ type: 'startAfter', parts }));
  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    if (ref.path === 'events') {
      return {
        docs: mockEvents.map((event) => createDocSnapshot(event.id, event)),
        size: mockEvents.length,
      };
    }
    return { docs: [], size: 0 };
  });
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === 'events/event-1/participants/user-123') {
      return createDocSnapshot(
        'user-123',
        joinedIds.includes('event-1') ? { uid: 'user-123' } : null,
      );
    }
    return createDocSnapshot(String(ref.id), null);
  });
  firestoreMocks.runTransaction.mockImplementation(async (_db, callback) => {
    const tx = {
      get: vi.fn(async (ref) => {
        if (ref.path === 'events/event-1') return createDocSnapshot('event-1', mockEvents[0]);
        if (ref.path === 'events/event-1/participants/user-123') {
          return createDocSnapshot('user-123', null);
        }
        return createDocSnapshot(String(ref.id), null);
      }),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    return callback(tx);
  });
}

describe('EventsPage Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreMocks();
    global.IntersectionObserver = class {
      root = null;

      rootMargin = '';

      thresholds = [];

      observe = vi.fn();

      unobserve = vi.fn();

      disconnect = vi.fn();

      takeRecords = vi.fn(() => []);
    };
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
        <ToastProvider>
          <EventsPage />
        </ToastProvider>
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

  it('should run real joinEvent use-case when clicking join button', async () => {
    setupFirestoreMocks({ joinedIds: [] });
    const user = userEvent.setup();
    renderPage();

    const joinBtn = await screen.findByRole('button', { name: /參加/i });
    await user.click(joinBtn);

    await waitFor(() => {
      expect(firestoreMocks.runTransaction).toHaveBeenCalled();
    });
  });
});
