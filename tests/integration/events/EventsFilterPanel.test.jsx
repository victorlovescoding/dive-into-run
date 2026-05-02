import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import {
  createFirestoreDocSnapshot as createDocSnapshot,
  createFirestoreQuerySnapshot as createQuerySnapshot,
} from '../../_helpers/factories';

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
  default: () => () => <div>Map Mock</div>,
}));

vi.mock('next/image', () => ({
  /**
   * Pass-through next/image mock so UserLink avatars render in jsdom.
   * @param {object} props - Image props.
   * @param {string} props.src - Image source.
   * @param {string} props.alt - Accessible alt text.
   * @param {number} [props.width] - Image width.
   * @param {number} [props.height] - Image height.
   * @returns {import('react').ReactElement} Native image.
   */
  default: ({ src, alt, width, height, ...rest }) => (
    <img src={src} alt={alt} width={width} height={height} {...rest} />
  ),
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
  email: 'test@example.com',
  displayName: 'Test User',
  name: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  bio: null,
  getIdToken: async () => '',
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

const latestEvents = [
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

const filteredEvents = [
  {
    ...latestEvents[0],
    id: 'event-filtered',
    title: 'Filtered Taipei Run',
    distanceKm: 8,
  },
];

/**
 * 設定 EventsPage 需要的 Firestore SDK 邊界 stub。
 */
function setupFirestoreMocks() {
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
    if (ref.path !== 'events') {
      return createQuerySnapshot([]);
    }

    const isFilterQuery = ref.parts?.some(
      (part) => part?.type === 'where' && part.parts?.[0] === 'city',
    );
    const events = isFilterQuery ? filteredEvents : latestEvents;
    return createQuerySnapshot(events.map((event) => createDocSnapshot(event.id, event)));
  });
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === 'events/event-1/participants/user-123') {
      return createDocSnapshot('user-123', { uid: 'user-123' });
    }
    return createDocSnapshot(String(ref.id), null);
  });
}

/**
 * 透過 app boundary render EventsPage，不直接 import UI component。
 * @returns {ReturnType<typeof render>} render result。
 */
function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: mockAuthUser, setUser: vi.fn(), loading: false }}>
      <ToastProvider>
        <EventsPage />
      </ToastProvider>
    </AuthContext.Provider>,
  );
}

describe('EventsPage filter panel integration', () => {
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

  it('opens and closes the real filter panel through the EventsPage app boundary', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Morning Run');

    await user.click(screen.getByRole('button', { name: '篩選活動' }));
    expect(screen.getByRole('dialog', { name: '篩選活動詳情' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '關閉篩選' })[1]);

    expect(screen.queryByRole('dialog', { name: '篩選活動詳情' })).not.toBeInTheDocument();
  });

  it.each([
    ['Escape', '{Escape}'],
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('closes the app-boundary filter overlay with %s', async (_keyName, keyboardInput) => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Morning Run');
    await user.click(screen.getByRole('button', { name: '篩選活動' }));
    expect(screen.getByRole('dialog', { name: '篩選活動詳情' })).toBeInTheDocument();

    const [overlayCloseTarget] = screen.getAllByRole('button', { name: '關閉篩選' });
    overlayCloseTarget.focus();
    expect(overlayCloseTarget).toHaveFocus();

    await user.keyboard(keyboardInput);

    expect(screen.queryByRole('dialog', { name: '篩選活動詳情' })).not.toBeInTheDocument();
  });

  it('updates filter controls and sends the search through real runtime use-cases', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Morning Run');
    await user.click(screen.getByRole('button', { name: '篩選活動' }));

    const checkbox = screen.getByRole('checkbox', { name: '只顯示還有名額的活動' });
    await user.click(checkbox);
    await user.type(screen.getByLabelText('活動開始時間（起）'), '2026-05-03T06:30');
    await user.type(screen.getByLabelText('活動開始時間（迄）'), '2026-05-03T08:00');
    await user.type(screen.getByLabelText('最小跑步距離'), '5');
    await user.type(screen.getByLabelText('最大跑步距離'), '12.5');
    await user.selectOptions(screen.getByLabelText('選擇縣市'), '臺北市');
    await user.selectOptions(screen.getByLabelText('選擇區域'), '信義區');

    expect(checkbox).toBeChecked();
    expect(screen.getByLabelText('活動開始時間（起）')).toHaveValue('2026-05-03T06:30');
    expect(screen.getByLabelText('活動開始時間（迄）')).toHaveValue('2026-05-03T08:00');
    expect(screen.getByLabelText('最小跑步距離')).toHaveValue(5);
    expect(screen.getByLabelText('最大跑步距離')).toHaveValue(12.5);

    await user.click(screen.getByRole('button', { name: '搜尋' }));

    await screen.findByText('Filtered Taipei Run');
    expect(screen.queryByRole('dialog', { name: '篩選活動詳情' })).not.toBeInTheDocument();
    expect(firestoreMocks.timestampFromDate).toHaveBeenCalledWith(new Date('2026-05-03T06:30'));
    expect(firestoreMocks.timestampFromDate).toHaveBeenCalledWith(new Date('2026-05-03T08:00'));
    expect(firestoreMocks.where).toHaveBeenCalledWith('city', '==', '臺北市');
    expect(firestoreMocks.where).toHaveBeenCalledWith('district', '==', '信義區');
  });

  it('clears panel state before reloading latest events', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Morning Run');
    await user.click(screen.getByRole('button', { name: '篩選活動' }));
    await user.click(screen.getByRole('checkbox', { name: '只顯示還有名額的活動' }));
    await user.type(screen.getByLabelText('最小跑步距離'), '5');
    await user.selectOptions(screen.getByLabelText('選擇縣市'), '臺北市');
    await user.selectOptions(screen.getByLabelText('選擇區域'), '信義區');

    await user.click(screen.getByRole('button', { name: '清除' }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: '只顯示還有名額的活動' })).not.toBeChecked();
    });
    expect(screen.getByLabelText('最小跑步距離')).toHaveValue(null);
    expect(screen.getByLabelText('選擇縣市')).toHaveValue('');
    expect(screen.getByLabelText('選擇區域')).toBeDisabled();
  });
});
