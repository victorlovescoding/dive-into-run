import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {
  collection,
  deleteField,
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
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import {
  createFirestoreDocSnapshot as createDocSnapshot,
  createFirestoreQuerySnapshot as createQuerySnapshot,
} from '../../_helpers/factories';
import { renderWithAuthToast } from '../../_helpers/provider-test-helpers';

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  deleteField: vi.fn(() => ({ __type: 'deleteField' })),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  startAfter: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ __type: 'timestampNow' })),
  },
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
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

vi.mock('next/link', () => ({
  default: (
    /** @type {{ children: import('react').ReactNode, href: string }} */ {
      children,
      href,
      ...props
    },
  ) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/events/event-1',
}));

vi.mock('@/components/CommentSection', () => ({
  default: () => <div data-testid="comment-section-stub" />,
}));

vi.mock('@/components/ShareButton', () => ({
  default: () => <button type="button">Share</button>,
}));

vi.mock('@/components/EventEditForm', () => ({
  default: () => <div data-testid="event-edit-form-stub" />,
}));

const firestoreMocks = {
  ['collection']: /** @type {import('vitest').Mock} */ (collection),
  ['deleteField']: /** @type {import('vitest').Mock} */ (deleteField),
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
  ['timestampNow']: /** @type {import('vitest').Mock} */ (Timestamp.now),
  ['updateDoc']: /** @type {import('vitest').Mock} */ (updateDoc),
  ['where']: /** @type {import('vitest').Mock} */ (where),
  ['writeBatch']: /** @type {import('vitest').Mock} */ (writeBatch),
};

const mockUser = {
  uid: 'runner-1',
  name: 'Runner One',
  email: 'runner@example.com',
  photoURL: 'https://photo.url/runner.jpg',
  bio: null,
  getIdToken: async () => '',
};

const mockEvent = {
  title: '週末晨跑',
  time: { toDate: () => new Date('2030-04-20T06:00:00Z') },
  registrationDeadline: { toDate: () => new Date('2030-04-19T23:59:00Z') },
  city: '臺北市',
  district: '信義區',
  meetPlace: '象山站',
  distanceKm: 10,
  paceSec: 360,
  maxParticipants: 20,
  participantsCount: 2,
  remainingSeats: 18,
  hostUid: 'host-1',
  hostName: '主揪跑者',
  hostPhotoURL: 'https://example.com/host.jpg',
  description: '一起來跑步吧',
};

const defaultParticipants = [
  {
    uid: 'host-1',
    name: '主揪跑者',
    photoURL: 'https://example.com/host.jpg',
    eventId: 'event-1',
  },
  {
    id: 'participant-2',
    name: '一般跑者',
    photoURL: '',
    eventId: 'event-1',
  },
];

/**
 * 設定 EventDetailClient 需要的 Firestore SDK 邊界 stub。
 * @param {{ participants?: object[], participantsError?: Error | null }} [options] - 參加者讀取情境。
 */
function setupFirestoreMocks({ participants = defaultParticipants, participantsError = null } = {}) {
  firestoreMocks.collection.mockImplementation((_dbOrRef, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  }));
  firestoreMocks.doc.mockImplementation((base, ...segments) => {
    if (base?.type === 'collection' && segments.length === 0) {
      return { id: 'generated-doc', path: `${base.path}/generated-doc` };
    }
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
  firestoreMocks.writeBatch.mockReturnValue({
    set: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  });
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === 'events/event-1') {
      return createDocSnapshot('event-1', mockEvent);
    }
    if (ref.path === 'events/event-1/participants/runner-1') {
      return createDocSnapshot('runner-1', null);
    }
    return createDocSnapshot(String(ref.id), null);
  });
  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    if (ref.path === 'events/event-1/participants') {
      if (participantsError) {
        throw participantsError;
      }
      return createQuerySnapshot(
        participants.map((participant) =>
          createDocSnapshot(String(participant.uid || participant.id), participant),
        ),
      );
    }
    if (ref.path === 'events/event-1/comments') return createQuerySnapshot([]);
    return createQuerySnapshot([]);
  });
}

/**
 * 使用真實 AuthContext / ToastContext Provider harness render 活動詳情頁。
 * @returns {ReturnType<typeof renderWithAuthToast>} render 結果與 context spies。
 */
function renderEventDetailClient() {
  return renderWithAuthToast(<EventDetailClient id="event-1" />, {
    authContext: AuthContext,
    toastContext: ToastContext,
    auth: {
      user: mockUser,
      setUser: vi.fn(),
      loading: false,
    },
  });
}

describe('EventDetailClient participants modal integration', () => {
  /** @type {ReturnType<typeof vi.spyOn>} */
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('keeps ParticipantsModal closed until the app-boundary action opens it', async () => {
    renderEventDetailClient();

    await screen.findByText('週末晨跑');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens participant links, host status, and close behavior through EventDetailClient', async () => {
    const user = userEvent.setup();
    renderEventDetailClient();

    await screen.findByText('週末晨跑');
    await user.click(screen.getByRole('button', { name: '看看誰有參加' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: '主揪跑者' })).toHaveAttribute(
      'href',
      '/users/host-1',
    );
    expect(within(dialog).getByRole('link', { name: '一般跑者' })).toHaveAttribute(
      'href',
      '/users/participant-2',
    );
    expect(screen.getByText('主揪')).toBeInTheDocument();
    expect(screen.getByText('已參加')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '關閉' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the empty participant state through the app boundary', async () => {
    setupFirestoreMocks({ participants: [] });
    const user = userEvent.setup();
    renderEventDetailClient();

    await screen.findByText('週末晨跑');
    await user.click(screen.getByRole('button', { name: '看看誰有參加' }));

    expect(await screen.findByText('目前還沒有人報名')).toBeInTheDocument();
  });

  it('renders retryable participant load errors through the app boundary', async () => {
    setupFirestoreMocks({ participantsError: new Error('participants unavailable') });
    const user = userEvent.setup();
    renderEventDetailClient();

    await screen.findByText('週末晨跑');
    await user.click(screen.getByRole('button', { name: '看看誰有參加' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('讀取參加名單失敗，請稍後再試');

    setupFirestoreMocks({ participants: defaultParticipants });
    await user.click(screen.getByRole('button', { name: '重試' }));

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByRole('link', { name: '主揪跑者' })).toBeInTheDocument();
    });
  });
});
