import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import { AuthContext } from '@/runtime/providers/AuthProvider';

const { mockShowToast } = vi.hoisted(() => ({
  mockShowToast: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  where: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
}));

vi.mock('@/runtime/providers/AuthProvider', async () => {
  const { createContext } = await import('react');
  return {
    AuthContext: createContext({ user: null, setUser: () => {}, loading: false }),
  };
});

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
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

vi.mock('@/components/ShareButton', () => ({
  default: () => <button type="button">Share</button>,
}));

vi.mock('@/components/UserLink', () => ({
  default: (/** @type {{ name?: string }} */ { name }) => <span>{name || ''}</span>,
}));

vi.mock('@/components/CommentSection', () => ({
  default: (/** @type {{ onCommentAdded?: (commentId: string) => void }} */ { onCommentAdded }) => (
    <button type="button" onClick={() => onCommentAdded?.('comment-123')}>
      trigger comment callback
    </button>
  ),
}));

const firestoreMocks = {
  ['collection']: /** @type {import('vitest').Mock} */ (collection),
  ['doc']: /** @type {import('vitest').Mock} */ (doc),
  ['getDoc']: /** @type {import('vitest').Mock} */ (getDoc),
  ['getDocs']: /** @type {import('vitest').Mock} */ (getDocs),
  ['limit']: /** @type {import('vitest').Mock} */ (limit),
  ['orderBy']: /** @type {import('vitest').Mock} */ (orderBy),
  ['query']: /** @type {import('vitest').Mock} */ (query),
  ['serverTimestamp']: /** @type {import('vitest').Mock} */ (serverTimestamp),
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
  time: '2099-12-27T07:00',
  registrationDeadline: '2099-12-26T23:59',
  city: '台北市',
  district: '大安區',
  meetPlace: '大安森林公園',
  distanceKm: 5,
  paceSec: 360,
  maxParticipants: 20,
  participantsCount: 2,
  remainingSeats: 18,
  hostUid: 'host-99',
  hostName: 'Host User',
  hostPhotoURL: 'https://photo.url/host.jpg',
  description: '一起來跑步吧',
};

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
 * 設定活動詳情留言通知需要的 Firestore SDK 邊界 stub。
 * @returns {{ batch: { set: import('vitest').Mock, commit: import('vitest').Mock } }} SDK spies。
 */
function setupFirestoreMocks() {
  const batch = {
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  firestoreMocks.collection.mockImplementation((_dbOrRef, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  }));
  firestoreMocks.doc.mockImplementation((base, ...segments) => {
    if (base?.type === 'collection' && segments.length === 0) {
      return { id: 'notification-generated', path: `${base.path}/notification-generated` };
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
  firestoreMocks.writeBatch.mockReturnValue(batch);
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === 'events/evt1') return createDocSnapshot('evt1', mockEvent);
    if (ref.path === 'events/evt1/participants/runner-1') {
      return createDocSnapshot('runner-1', null);
    }
    return createDocSnapshot(String(ref.id), null);
  });
  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    if (ref.path === 'events/evt1/participants') {
      return {
        docs: [
          createDocSnapshot('participant-1', { uid: 'participant-1' }),
          createDocSnapshot('runner-1', { uid: 'runner-1' }),
        ],
        size: 2,
      };
    }
    if (ref.path === 'events/evt1/comments') {
      return {
        docs: [
          createDocSnapshot('comment-old-1', { authorUid: 'commenter-1' }),
          createDocSnapshot('comment-old-2', { authorUid: 'runner-1' }),
        ],
        size: 2,
      };
    }
    return { docs: [], size: 0 };
  });

  return { batch };
}

describe('EventDetailClient comment notification runtime wiring', () => {
  /** @type {{ batch: { set: import('vitest').Mock, commit: import('vitest').Mock } }} */
  let sdkSpies;

  beforeEach(() => {
    vi.clearAllMocks();
    sdkSpies = setupFirestoreMocks();
  });

  it('routes CommentSection callback through real notification use-case and writes SDK payloads', async () => {
    const user = userEvent.setup();

    render(
      <AuthContext.Provider value={{ user: mockUser, setUser: vi.fn(), loading: false }}>
        <EventDetailClient id="evt1" />
      </AuthContext.Provider>,
    );

    await screen.findByText('週末晨跑');

    await user.click(screen.getByRole('button', { name: 'trigger comment callback' }));

    await waitFor(() => {
      expect(sdkSpies.batch.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'notifications/notification-generated' }),
        expect.objectContaining({
          recipientUid: 'host-99',
          type: 'event_host_comment',
          entityType: 'event',
          entityId: 'evt1',
          entityTitle: '週末晨跑',
          commentId: 'comment-123',
          actorUid: 'runner-1',
          actorName: 'Runner One',
          actorPhotoURL: 'https://photo.url/runner.jpg',
          createdAt: { __type: 'serverTimestamp' },
          read: false,
        }),
      );
    });
    expect(sdkSpies.batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notifications/notification-generated' }),
      expect.objectContaining({
        recipientUid: 'participant-1',
        type: 'event_participant_comment',
        entityId: 'evt1',
        commentId: 'comment-123',
      }),
    );
    expect(sdkSpies.batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notifications/notification-generated' }),
      expect.objectContaining({
        recipientUid: 'commenter-1',
        type: 'event_comment_reply',
        entityId: 'evt1',
        commentId: 'comment-123',
      }),
    );
    expect(sdkSpies.batch.commit).toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalledWith(expect.stringContaining('失敗'), 'error');
  });
});
