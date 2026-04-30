import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
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

// ---------------------------------------------------------------------------
// Polyfills
// ---------------------------------------------------------------------------

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((q) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// Mocks -- firebase-client (prevent real Firebase init)
// ---------------------------------------------------------------------------

vi.mock('@/config/client/firebase-client', () => ({
  auth: {},
  db: {},
  provider: {},
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date, toMillis: () => date.getTime() })),
    now: vi.fn(() => ({
      toDate: () => new Date('2026-04-15T08:00:00Z'),
      toMillis: () => new Date('2026-04-15T08:00:00Z').getTime(),
    })),
  },
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  writeBatch: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn((value) => ({ __type: 'increment', value })),
  collectionGroup: vi.fn(),
  documentId: vi.fn(() => '__name__'),
  deleteField: vi.fn(() => ({ __type: 'deleteField' })),
  connectFirestoreEmulator: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({ setCustomParameters: vi.fn() })),
  connectAuthEmulator: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks -- next / browser boundary
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('next/image', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ fill: _fill, priority: _priority, ...rest }) => createElement('img', rest),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import NotificationProvider from '@/runtime/providers/NotificationProvider';
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import PostDetailClient from '@/app/posts/[id]/PostDetailClient';

// ---------------------------------------------------------------------------
// Cast mocks
// ---------------------------------------------------------------------------

const mockedAddDoc = /** @type {import('vitest').Mock} */ (addDoc);
const mockedCollection = /** @type {import('vitest').Mock} */ (collection);
const mockedCollectionGroup = /** @type {import('vitest').Mock} */ (collectionGroup);
const mockedDeleteField = /** @type {import('vitest').Mock} */ (deleteField);
const mockedDoc = /** @type {import('vitest').Mock} */ (doc);
const mockedDocumentId = /** @type {import('vitest').Mock} */ (documentId);
const mockedGetDoc = /** @type {import('vitest').Mock} */ (getDoc);
const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);
const mockedIncrement = /** @type {import('vitest').Mock} */ (increment);
const mockedLimit = /** @type {import('vitest').Mock} */ (limit);
const mockedOnSnapshot = /** @type {import('vitest').Mock} */ (onSnapshot);
const mockedOrderBy = /** @type {import('vitest').Mock} */ (orderBy);
const mockedQuery = /** @type {import('vitest').Mock} */ (query);
const mockedRunTransaction = /** @type {import('vitest').Mock} */ (runTransaction);
const mockedServerTimestamp = /** @type {import('vitest').Mock} */ (serverTimestamp);
const mockedStartAfter = /** @type {import('vitest').Mock} */ (startAfter);
const mockedTimestampFromDate = /** @type {import('vitest').Mock} */ (Timestamp.fromDate);
const mockedUpdateDoc = /** @type {import('vitest').Mock} */ (updateDoc);
const mockedWhere = /** @type {import('vitest').Mock} */ (where);
const mockedWriteBatch = /** @type {import('vitest').Mock} */ (writeBatch);

const firestoreMocks = {
  addDoc: mockedAddDoc,
  collection: mockedCollection,
  collectionGroup: mockedCollectionGroup,
  deleteField: mockedDeleteField,
  doc: mockedDoc,
  documentId: mockedDocumentId,
  getDoc: mockedGetDoc,
  getDocs: mockedGetDocs,
  increment: mockedIncrement,
  limit: mockedLimit,
  onSnapshot: mockedOnSnapshot,
  orderBy: mockedOrderBy,
  query: mockedQuery,
  runTransaction: mockedRunTransaction,
  serverTimestamp: mockedServerTimestamp,
  startAfter: mockedStartAfter,
  timestampFromDate: mockedTimestampFromDate,
  updateDoc: mockedUpdateDoc,
  where: mockedWhere,
  writeBatch: mockedWriteBatch,
};

// ---------------------------------------------------------------------------
// Shared data
// ---------------------------------------------------------------------------

const mockUser = {
  uid: 'host1',
  name: 'Host User',
  email: null,
  photoURL: 'https://photo.url/host.jpg',
  bio: null,
  getIdToken: async () => '',
};

const mockShowToast = vi.fn();

const mockEvent = {
  title: '週末晨跑',
  time: { toDate: () => new Date('2099-12-27T07:00:00Z') },
  registrationDeadline: { toDate: () => new Date('2099-12-26T15:59:00Z') },
  city: '台北市',
  district: '大安區',
  meetPlace: '大安森林公園',
  distanceKm: 5,
  paceSec: 360,
  maxParticipants: 20,
  participantsCount: 2,
  remainingSeats: 18,
  hostUid: 'host1',
  hostName: 'Host User',
  hostPhotoURL: 'https://photo.url/host.jpg',
  description: '一起來跑步吧',
};

const mockPost = {
  title: '跑步心得',
  content: '今天跑了 10K',
  authorUid: 'author99',
  authorName: 'Author',
  authorImgURL: '',
  likesCount: 0,
  commentsCount: 0,
};

// ---------------------------------------------------------------------------
// Firestore fixtures
// ---------------------------------------------------------------------------

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
 * 建立 Firestore query snapshot stub。
 * @param {object[]} docs - query document data。
 * @returns {object} Firestore-like query snapshot。
 */
function createQuerySnapshot(docs) {
  const snapshots = docs.map((item) => createDocSnapshot(item.id, item.data));
  return {
    docs: snapshots,
    size: snapshots.length,
    docChanges: () => snapshots.map((snapshot) => ({ type: 'added', doc: snapshot })),
  };
}

/**
 * 設定 Firestore SDK 邊界 stub，讓 repo/service/runtime 真實執行。
 * @returns {{ batch: object, tx: object, unsubscribe: import('vitest').Mock }} SDK spies。
 */
function setupFirestoreMocks() {
  let notificationId = 0;
  const unsubscribe = vi.fn();
  const batch = {
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  const tx = {
    get: vi.fn(async (ref) => {
      if (ref.path === 'events/evt1') return createDocSnapshot('evt1', mockEvent);
      if (ref.path === 'posts/post1') return createDocSnapshot('post1', mockPost);
      return createDocSnapshot(String(ref.id ?? 'missing'), null);
    }),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  firestoreMocks.collection.mockImplementation((base, ...segments) => {
    const pathPrefix = base?.type === 'collection' ? base.path : '';
    return {
      type: 'collection',
      path: [pathPrefix, ...segments].filter(Boolean).join('/'),
    };
  });
  firestoreMocks.collectionGroup.mockImplementation((_db, groupId) => ({
    type: 'collectionGroup',
    path: groupId,
  }));
  firestoreMocks.doc.mockImplementation((base, ...segments) => {
    if (base?.type === 'collection' && segments.length === 0) {
      const id = base.path.endsWith('comments') ? 'cmt1' : `notification-${++notificationId}`;
      return { id, path: `${base.path}/${id}` };
    }
    if (base?.type === 'collection') {
      return { id: String(segments.at(-1)), path: [base.path, ...segments].join('/') };
    }
    return { id: String(segments.at(-1)), path: segments.join('/') };
  });
  firestoreMocks.query.mockImplementation((source, ...constraints) => ({
    type: 'query',
    path: source?.path,
    constraints,
  }));
  firestoreMocks.where.mockImplementation((field, operator, value) => ({
    type: 'where',
    field,
    operator,
    value,
  }));
  firestoreMocks.orderBy.mockImplementation((field, direction) => ({
    type: 'orderBy',
    field,
    direction,
  }));
  firestoreMocks.limit.mockImplementation((count) => ({ type: 'limit', count }));
  firestoreMocks.startAfter.mockImplementation((...parts) => ({ type: 'startAfter', parts }));
  firestoreMocks.documentId.mockReturnValue('__name__');
  firestoreMocks.updateDoc.mockResolvedValue(undefined);
  firestoreMocks.runTransaction.mockImplementation(async (_db, callback) => callback(tx));
  firestoreMocks.writeBatch.mockReturnValue(batch);
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === 'events/evt1') return createDocSnapshot('evt1', mockEvent);
    if (ref.path === 'events/evt1/participants/host1') return createDocSnapshot('host1', null);
    if (ref.path === 'posts/post1') return createDocSnapshot('post1', mockPost);
    if (ref.path === 'posts/post1/likes/host1') return createDocSnapshot('host1', null);
    if (ref.path === 'posts/post1/comments/cmt1') {
      return createDocSnapshot('cmt1', {
        authorUid: 'host1',
        authorName: 'Host User',
        authorImgURL: 'https://photo.url/host.jpg',
        comment: '好文！',
        createdAt: new Date(),
      });
    }
    return createDocSnapshot(String(ref.id ?? 'missing'), null);
  });
  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    if (ref.path === 'events/evt1/participants') {
      return createQuerySnapshot([{ id: 'p1', data: { uid: 'p1', name: 'P1', photoURL: '' } }]);
    }
    if (ref.path === 'posts/post1/comments') {
      return createQuerySnapshot([]);
    }
    return createQuerySnapshot([]);
  });
  firestoreMocks.addDoc.mockResolvedValue({ id: 'notification-direct' });
  firestoreMocks.onSnapshot.mockImplementation((_q, onNext, _onError) => {
    onNext(createQuerySnapshot([]));
    return unsubscribe;
  });

  return { batch, tx, unsubscribe };
}

/**
 * 依註冊順序觸發 onSnapshot error callback。
 * @param {number} callIndex - onSnapshot 呼叫序號。
 * @param {Error} error - 要送進 error callback 的錯誤。
 */
function triggerSnapshotError(callIndex, error) {
  const onError = firestoreMocks.onSnapshot.mock.calls[callIndex][2];
  act(() => {
    onError(error);
  });
}

/**
 * 渲染 AuthContext + ToastContext。
 * @param {import('react').ReactNode} children - 測試目標。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderWithProviders(children) {
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: () => {}, loading: false }}>
      <ToastContext.Provider value={{ toasts: [], showToast: mockShowToast, removeToast: vi.fn() }}>
        {children}
      </ToastContext.Provider>
    </AuthContext.Provider>,
  );
}

// ---------------------------------------------------------------------------
// Test 1: NotificationContext onError -> showToast via ToastContext
// ---------------------------------------------------------------------------

describe('NotificationContext onError -> ToastContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreMocks();
  });

  it('watchUnreadNotifications onError -> 透過 ToastContext 顯示錯誤 toast', () => {
    const { unmount } = renderWithProviders(
      <NotificationProvider>
        <div>test child</div>
      </NotificationProvider>,
    );

    triggerSnapshotError(0, new Error('Firestore permission denied'));

    expect(mockShowToast).toHaveBeenCalledWith('通知載入失敗', 'error');
    unmount();
    expect(firestoreMocks.onSnapshot.mock.results[0].value).toHaveBeenCalled();
  });

  it('watchNotifications onError -> 透過 ToastContext 顯示錯誤 toast', () => {
    const { unmount } = renderWithProviders(
      <NotificationProvider>
        <div>test child</div>
      </NotificationProvider>,
    );

    triggerSnapshotError(1, new Error('Firestore quota exceeded'));

    expect(mockShowToast).toHaveBeenCalledWith('通知載入失敗', 'error');
    unmount();
    expect(firestoreMocks.onSnapshot.mock.results[1].value).toHaveBeenCalled();
  });

  it('initial watchNotifications snapshot 不觸發 onNew toast queue', () => {
    renderWithProviders(
      <NotificationProvider>
        <div>test child</div>
      </NotificationProvider>,
    );

    expect(screen.queryByText('你有新通知')).not.toBeInTheDocument();
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 2: EventDetailClient -- notifyEventModified failure -> error toast
// ---------------------------------------------------------------------------

describe('EventDetailClient notification error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreMocks();
    firestoreMocks.writeBatch.mockReturnValue({
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockRejectedValue(new Error('Network error')),
    });
  });

  it('notifyEventModified 失敗時顯示錯誤 toast 而非 crash', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EventDetailClient id="evt1" />);

    await screen.findByText('週末晨跑');

    const menuBtn = screen.getByRole('button', { name: '更多操作' });
    await user.click(menuBtn);

    const editBtn = screen.getByRole('menuitem', { name: '編輯活動' });
    await user.click(editBtn);

    await screen.findByText('編輯活動');

    const titleInput = screen.getByLabelText('活動名稱');
    await user.clear(titleInput);
    await user.type(titleInput, '修改後的晨跑');

    const submitBtn = screen.getByRole('button', { name: '編輯完成' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(firestoreMocks.runTransaction).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('通知發送失敗', 'error');
    });
  });
});

// ---------------------------------------------------------------------------
// Test 3: PostDetailClient -- notifyPostNewComment failure -> error toast
// ---------------------------------------------------------------------------

describe('PostDetailClient notification error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreMocks();
    firestoreMocks.addDoc.mockRejectedValue(new Error('Firestore write failed'));
  });

  it('notifyPostNewComment 失敗時顯示錯誤 toast 而非 crash', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PostDetailClient postId="post1" />);

    await screen.findByText('跑步心得');

    const commentInput = screen.getByRole('textbox', { name: '留言' });
    await user.type(commentInput, '好文！');

    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(firestoreMocks.runTransaction).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'notifications' }),
        expect.objectContaining({
          recipientUid: 'author99',
          type: 'post_new_comment',
          entityType: 'post',
          entityId: 'post1',
          entityTitle: '跑步心得',
          commentId: 'cmt1',
          actorUid: 'host1',
        }),
      );
    });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('通知發送失敗', 'error');
    });
  });
});
