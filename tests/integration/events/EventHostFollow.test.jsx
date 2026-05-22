import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {
  addDoc,
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
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import EventsPage from '@/app/events/page';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import {
  createFirestoreDocSnapshot as createDocSnapshot,
  createFirestoreQuerySnapshot as createQuerySnapshot,
} from '../../_helpers/factories';
import { renderWithAuthToast } from '../../_helpers/provider-test-helpers';

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  deleteField: vi.fn(() => ({ __type: 'deleteField' })),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  setDoc: vi.fn(),
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
   * @param {string} props.alt - Image alt text.
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
  usePathname: () => '/events',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const firestoreMocks = {
  ['addDoc']: /** @type {import('vitest').Mock} */ (addDoc),
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
  ['setDoc']: /** @type {import('vitest').Mock} */ (setDoc),
  ['startAfter']: /** @type {import('vitest').Mock} */ (startAfter),
  ['timestampFromDate']: /** @type {import('vitest').Mock} */ (Timestamp.fromDate),
  ['timestampNow']: /** @type {import('vitest').Mock} */ (Timestamp.now),
  ['updateDoc']: /** @type {import('vitest').Mock} */ (updateDoc),
  ['where']: /** @type {import('vitest').Mock} */ (where),
  ['writeBatch']: /** @type {import('vitest').Mock} */ (writeBatch),
};

const viewerUser = {
  uid: 'viewer-1',
  name: 'Viewer Runner',
  email: 'viewer@example.com',
  photoURL: 'https://example.com/viewer.jpg',
  bio: null,
  getIdToken: vi.fn().mockResolvedValue('token'),
};

const hostEvent = {
  id: 'event-1',
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

const defaultComments = [
  {
    id: 'comment-1',
    authorUid: 'commenter-1',
    authorName: '留言跑者',
    authorPhotoURL: '',
    content: '這場看起來很棒',
    createdAt: { toDate: () => new Date('2030-04-18T10:00:00Z') },
    updatedAt: null,
    isEdited: false,
  },
];

/**
 * 設定 EventsPage / EventDetailClient 需要的 Firestore SDK 邊界 stub。
 * @param {object} [options] - stub 設定。
 * @param {typeof hostEvent} [options.event] - 活動 fixture。
 * @param {object | null} [options.viewer] - 目前登入者。
 * @param {boolean} [options.initiallyFollowing] - 初始是否追蹤主揪。
 * @param {object[]} [options.participants] - 參加名單。
 * @param {object[]} [options.comments] - 留言列表。
 */
function setupFirestoreMocks({
  event = hostEvent,
  viewer = viewerUser,
  initiallyFollowing = false,
  participants = defaultParticipants,
  comments = defaultComments,
} = {}) {
  let isFollowing = initiallyFollowing;
  const viewerUid = viewer?.uid || 'anonymous';

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
  firestoreMocks.query.mockImplementation((ref, ...constraints) => ({
    type: 'query',
    path: ref?.path,
    constraints,
  }));
  firestoreMocks.where.mockImplementation((...parts) => ({ type: 'where', parts }));
  firestoreMocks.orderBy.mockImplementation((...parts) => ({ type: 'orderBy', parts }));
  firestoreMocks.limit.mockImplementation((count) => ({ type: 'limit', count }));
  firestoreMocks.startAfter.mockImplementation((...parts) => ({ type: 'startAfter', parts }));
  firestoreMocks.addDoc.mockResolvedValue({ id: 'notification-1' });
  firestoreMocks.setDoc.mockResolvedValue(undefined);
  firestoreMocks.updateDoc.mockResolvedValue(undefined);
  firestoreMocks.writeBatch.mockReturnValue({
    set: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  });
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    const path = String(ref?.path ?? '');
    if (path === `events/${event.id}`) {
      return createDocSnapshot(event.id, event);
    }
    if (path === `events/${event.id}/participants/${viewerUid}`) {
      return createDocSnapshot(viewerUid, null);
    }
    if (path === `users/${viewerUid}/favoriteEvents/${event.id}`) {
      return createDocSnapshot(event.id, null);
    }
    if (path === `users/${viewerUid}/following/${event.hostUid}`) {
      return createDocSnapshot(
        event.hostUid,
        isFollowing ? { targetUid: event.hostUid, createdAt: 'followed-at' } : null,
      );
    }
    return createDocSnapshot(String(ref?.id ?? 'missing'), null);
  });
  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    const path = String(ref?.path ?? '');
    if (path === 'events') {
      return createQuerySnapshot([createDocSnapshot(event.id, event)]);
    }
    if (path === `events/${event.id}/participants`) {
      return createQuerySnapshot(
        participants.map((participant) =>
          createDocSnapshot(String(participant.uid || participant.id), participant),
        ),
      );
    }
    if (path === `events/${event.id}/comments`) {
      return createQuerySnapshot(
        comments.map((comment) => createDocSnapshot(String(comment.id), comment)),
      );
    }
    return createQuerySnapshot([]);
  });
  firestoreMocks.runTransaction.mockImplementation(async (_db, callback) => {
    const transaction = {
      get: vi.fn(async (ref) => {
        const path = String(ref?.path ?? '');
        if (path === `users/${viewerUid}/following/${event.hostUid}`) {
          return { exists: () => isFollowing, data: () => ({ targetUid: event.hostUid }) };
        }
        return { exists: () => true, data: () => ({ followersCount: isFollowing ? 1 : 0 }) };
      }),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const result = await callback(transaction);
    isFollowing = result.following;
    return result;
  });
}

/**
 * Render EventsPage with real app contexts.
 * @param {object | null} viewer - Auth user。
 * @returns {ReturnType<typeof renderWithAuthToast>} render 結果。
 */
function renderEventsPage(viewer = viewerUser) {
  return renderWithAuthToast(<EventsPage />, {
    authContext: AuthContext,
    toastContext: ToastContext,
    auth: { user: viewer, setUser: vi.fn(), loading: false },
  });
}

/**
 * Render EventDetailClient with real app contexts.
 * @param {object | null} viewer - Auth user。
 * @returns {ReturnType<typeof renderWithAuthToast>} render 結果。
 */
function renderEventDetail(viewer = viewerUser) {
  return renderWithAuthToast(<EventDetailClient id="event-1" />, {
    authContext: AuthContext,
    toastContext: ToastContext,
    auth: { user: viewer, setUser: vi.fn(), loading: false },
  });
}

describe('Event host follow entrypoints', () => {
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

  it('lets signed-in non-self users follow and unfollow an event list host', async () => {
    const browser = userEvent.setup();
    renderEventsPage();

    await screen.findByText('週末晨跑');
    const followButton = await screen.findByRole('button', { name: '追蹤' });

    await browser.click(followButton);

    expect(await screen.findByRole('button', { name: '追蹤中' })).toBeInTheDocument();

    await browser.click(screen.getByRole('button', { name: '追蹤中' }));

    expect(await screen.findByRole('button', { name: '追蹤' })).toBeInTheDocument();
  });

  it('hides event list host follow controls for signed-out and self-hosted views', async () => {
    setupFirestoreMocks({ viewer: null });
    const { unmount } = renderEventsPage(null);

    await screen.findByText('週末晨跑');
    expect(screen.queryByRole('button', { name: '追蹤' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '追蹤中' })).not.toBeInTheDocument();

    unmount();

    setupFirestoreMocks({
      event: { ...hostEvent, hostUid: viewerUser.uid, hostName: viewerUser.name },
    });
    renderEventsPage();

    await screen.findByText('週末晨跑');
    expect(screen.queryByRole('button', { name: '追蹤' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '追蹤中' })).not.toBeInTheDocument();
  });

  it('lets signed-in non-self users follow and unfollow an event detail host', async () => {
    const browser = userEvent.setup();
    renderEventDetail();

    await screen.findByText('週末晨跑');
    const followButton = await screen.findByRole('button', { name: '追蹤' });

    await browser.click(followButton);

    expect(await screen.findByRole('button', { name: '追蹤中' })).toBeInTheDocument();

    await browser.click(screen.getByRole('button', { name: '追蹤中' }));

    expect(await screen.findByRole('button', { name: '追蹤' })).toBeInTheDocument();
  });

  it('hides event detail host follow controls for signed-out and self-hosted views', async () => {
    setupFirestoreMocks({ viewer: null });
    const { unmount } = renderEventDetail(null);

    await screen.findByText('週末晨跑');
    expect(screen.queryByRole('button', { name: '追蹤' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '追蹤中' })).not.toBeInTheDocument();

    unmount();

    setupFirestoreMocks({
      event: { ...hostEvent, hostUid: viewerUser.uid, hostName: viewerUser.name },
    });
    renderEventDetail();

    await screen.findByText('週末晨跑');
    expect(screen.queryByRole('button', { name: '追蹤' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '追蹤中' })).not.toBeInTheDocument();
  });

  it('keeps participants as profile links only without inline follow controls', async () => {
    const browser = userEvent.setup();
    renderEventDetail();

    await screen.findByText('週末晨跑');
    await browser.click(screen.getByRole('button', { name: '看看誰有參加' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('link', { name: '主揪跑者' })).toHaveAttribute(
      'href',
      '/users/host-1',
    );
    expect(within(dialog).getByRole('link', { name: '一般跑者' })).toHaveAttribute(
      'href',
      '/users/participant-2',
    );
    expect(within(dialog).queryByRole('button', { name: /追蹤/ })).not.toBeInTheDocument();
  });

  it('keeps event comments free of follow controls while preserving author profile links', async () => {
    renderEventDetail();

    await screen.findByText('週末晨跑');
    const commentSection = await screen.findByRole('region', { name: '留言區' });

    await within(commentSection).findByText('這場看起來很棒');

    expect(within(commentSection).getByRole('link', { name: '留言跑者' })).toHaveAttribute(
      'href',
      '/users/commenter-1',
    );
    expect(
      within(commentSection).queryByRole('button', { name: /追蹤/ }),
    ).not.toBeInTheDocument();
  });
});
