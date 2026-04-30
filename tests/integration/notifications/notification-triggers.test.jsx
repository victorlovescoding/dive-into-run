import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
  deleteField: vi.fn(() => ({ __deleteField: true })),
  doc: vi.fn(),
  documentId: vi.fn(() => '__name__'),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getFirestore: vi.fn(),
  increment: vi.fn((value) => ({ __increment: value })),
  limit: vi.fn((value) => ({ type: 'limit', value })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  setDoc: vi.fn(),
  startAfter: vi.fn((...values) => ({ type: 'startAfter', values })),
  updateDoc: vi.fn(),
  where: vi.fn((field, operator, value) => ({ type: 'where', field, operator, value })),
  writeBatch: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  connectAuthEmulator: vi.fn(),
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({ setCustomParameters: vi.fn() })),
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Polyfills
// ---------------------------------------------------------------------------

// jsdom 缺少 matchMedia
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
// Mocks — firebase-client (prevent real Firebase init)
// ---------------------------------------------------------------------------

vi.mock('@/config/client/firebase-client', () => ({
  db: {},
  auth: {},
  provider: {},
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: vi.fn((d) => d) },
  ...firestoreMocks,
}));

vi.mock('firebase/auth', () => ({
  ...authMocks,
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — next
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  usePathname: vi.fn(() => '/events/evt1'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('next/image', () => ({
  default: ({ fill: _fill, priority: _priority, ...rest }) =>
    require('react').createElement('img', rest),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AuthContext } from '@/runtime/providers/AuthProvider';
import ToastProvider from '@/runtime/providers/ToastProvider';
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import PostDetailClient from '@/app/posts/[id]/PostDetailClient';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';

const mockUser = {
  uid: 'host1',
  name: 'Host User',
  email: null,
  photoURL: 'https://photo.url/host.jpg',
  bio: null,
  getIdToken: async () => '',
};

/**
 * 用 Auth + Toast providers 包裹測試元件。
 * @param {import('react').ReactElement} children - 要渲染的元件。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderWithProviders(children) {
  return render(
    <AuthContext.Provider value={{ user: mockUser, setUser: () => {}, loading: false }}>
      <ToastProvider>{children}</ToastProvider>
    </AuthContext.Provider>,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 建立一個最小但完整的 mock 活動物件，hostUid 匹配預設 mock user。
 * @param {object} overrides - 覆蓋預設值的欄位。
 * @returns {object} mock 活動物件。
 */
function buildMockEvent(overrides = {}) {
  return {
    id: 'evt1',
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
    hostUid: 'host1',
    hostName: 'Host User',
    hostPhotoURL: 'https://photo.url/host.jpg',
    description: '一起來跑步吧',
    ...overrides,
  };
}

/** @type {Record<string, object>} */
const postFixtures = {};
/** @type {object[]} */
let notificationPayloads;
/** @type {object[]} */
let transactionUpdates;
let generatedCommentId;

/**
 * 建立 Firestore document ref mock。
 * @param {string} path - 文件路徑。
 * @returns {{ id: string, path: string }} document ref。
 */
function createDocRef(path) {
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

/**
 * 建立 Firestore collection ref mock。
 * @param {string} path - collection 路徑。
 * @returns {{ id: string, path: string }} collection ref。
 */
function createCollectionRef(path) {
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

/**
 * 建立 Firestore document snapshot mock。
 * @param {string} id - 文件 ID。
 * @param {object | null} data - 文件資料。
 * @returns {{ id: string, ref: { id: string, path: string }, exists: () => boolean, data: () => object }} snapshot。
 */
function createSnapshot(id, data) {
  return {
    id,
    ref: createDocRef(id),
    exists: () => data !== null,
    data: () => data ?? {},
  };
}

/**
 * 建立 Firestore query snapshot mock。
 * @param {Array<{ id: string, data: object }>} docs - 文件資料。
 * @returns {{ docs: Array<{ id: string, ref: { id: string, path: string }, exists: () => boolean, data: () => object }> }} snapshot。
 */
function createQuerySnapshot(docs) {
  return {
    docs: docs.map((item) => createSnapshot(item.id, item.data)),
  };
}

/**
 * 安裝 Firestore 邊界 mock，讓真實 repo/use-case 路徑可跑。
 */
function setupFirestoreBoundary() {
  notificationPayloads = [];
  transactionUpdates = [];
  generatedCommentId = 'cmt1';
  Object.keys(postFixtures).forEach((key) => delete postFixtures[key]);

  const mockedCollection = /** @type {import('vitest').Mock} */ (collection);
  const mockedDoc = /** @type {import('vitest').Mock} */ (doc);
  const mockedGetDoc = /** @type {import('vitest').Mock} */ (getDoc);
  const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);
  const mockedRunTransaction = /** @type {import('vitest').Mock} */ (runTransaction);
  const mockedWriteBatch = /** @type {import('vitest').Mock} */ (writeBatch);
  const mockedAddDoc = /** @type {import('vitest').Mock} */ (addDoc);

  mockedCollection.mockImplementation((first, ...segments) => {
    const prefix = typeof first?.path === 'string' ? first.path : '';
    return createCollectionRef([prefix, ...segments].filter(Boolean).join('/'));
  });
  mockedDoc.mockImplementation((first, ...segments) => {
    const prefix = typeof first?.path === 'string' ? first.path : '';
    const pathParts = [prefix, ...segments].filter(Boolean);
    if (pathParts.length === 1 && prefix) {
      pathParts.push(generatedCommentId);
    }
    return createDocRef(pathParts.join('/'));
  });
  firestoreMocks.query.mockImplementation((base, ...constraints) => ({ base, constraints }));
  mockedGetDoc.mockImplementation(async (ref) => {
    if (ref.path === 'events/evt1') return createSnapshot('evt1', buildMockEvent());
    if (ref.path.startsWith('events/') && ref.path.includes('/participants/')) {
      return createSnapshot(ref.id, null);
    }
    if (ref.path.startsWith('posts/') && ref.path.includes('/likes/')) {
      return createSnapshot(ref.id, null);
    }
    if (ref.path.startsWith('posts/') && ref.path.includes('/comments/')) {
      return createSnapshot(ref.id, {
        authorUid: 'host1',
        authorName: 'Host User',
        authorImgURL: 'https://photo.url/host.jpg',
        comment: ref.id === 'cmt1' ? '好文！' : '自己留言',
        createdAt: new Date(),
      });
    }
    if (ref.path.startsWith('posts/')) {
      return createSnapshot(ref.id, postFixtures[ref.id] ?? null);
    }
    return createSnapshot(ref.id, null);
  });
  mockedGetDocs.mockImplementation(async (target) => {
    const path = target?.base?.path ?? target?.path ?? '';
    if (path === 'events/evt1/participants') {
      return createQuerySnapshot([
        { id: 'p1', data: { uid: 'p1', name: 'P1', photoURL: '' } },
        { id: 'p2', data: { uid: 'p2', name: 'P2', photoURL: '' } },
      ]);
    }
    return createQuerySnapshot([]);
  });
  mockedRunTransaction.mockImplementation(async (_db, callback) => {
    const tx = {
      get: vi.fn(async (ref) => mockedGetDoc(ref)),
      set: vi.fn(),
      update: vi.fn((_ref, payload) => {
        transactionUpdates.push(payload);
      }),
      delete: vi.fn(),
    };
    return callback(tx);
  });
  mockedWriteBatch.mockImplementation(() => ({
    set: vi.fn((_ref, payload) => {
      notificationPayloads.push(payload);
    }),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }));
  mockedAddDoc.mockImplementation(async (_ref, payload) => {
    notificationPayloads.push(payload);
    return { id: 'notification1' };
  });
}

// ---------------------------------------------------------------------------
// Event Detail — edit → notifyEventModified
// ---------------------------------------------------------------------------

describe('EventDetailClient notification triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreBoundary();
  });

  it('calls notifyEventModified after successful edit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EventDetailClient id="evt1" />);

    // 等活動載入完成
    await waitFor(() => {
      expect(screen.getByText('週末晨跑')).toBeInTheDocument();
    });

    // 點開三點選單（EventCardMenu 的 button）
    const menuBtn = screen.getByRole('button', { name: '更多操作' });
    await user.click(menuBtn);

    // 點「編輯活動」
    const editBtn = screen.getByRole('menuitem', { name: '編輯活動' });
    await user.click(editBtn);

    // 等編輯表單出現
    await waitFor(() => {
      expect(screen.getByText('編輯活動')).toBeInTheDocument();
    });

    // 修改標題使 dirty=true，讓 submit button 可按
    const titleInput = screen.getByLabelText('活動名稱');
    await user.clear(titleInput);
    await user.type(titleInput, '修改後的晨跑');

    // 送出
    const submitBtn = screen.getByRole('button', { name: '編輯完成' });
    await user.click(submitBtn);

    // 驗證真實 updateEvent path 透過 transaction 更新 Firestore
    await waitFor(() => {
      expect(transactionUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: '修改後的晨跑',
          }),
        ]),
      );
    });

    // 驗證真實 notifyEventModified path 建立通知 payload
    await waitFor(() => {
      expect(notificationPayloads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            recipientUid: 'p1',
            type: 'event_modified',
            entityId: 'evt1',
            entityTitle: '週末晨跑',
            actorUid: 'host1',
          }),
          expect.objectContaining({
            recipientUid: 'p2',
            type: 'event_modified',
            entityId: 'evt1',
            entityTitle: '週末晨跑',
            actorUid: 'host1',
          }),
        ]),
      );
    });
  });

  it('calls notifyEventCancelled then deleteEvent on delete confirm', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EventDetailClient id="evt1" />);

    // 等活動載入完成
    await waitFor(() => {
      expect(screen.getByText('週末晨跑')).toBeInTheDocument();
    });

    // 點開三點選單
    const menuBtn = screen.getByRole('button', { name: '更多操作' });
    await user.click(menuBtn);

    // 點「刪除活動」
    const deleteBtn = screen.getByRole('menuitem', { name: '刪除活動' });
    await user.click(deleteBtn);

    // 等刪除確認對話框出現
    await waitFor(() => {
      expect(screen.getByText('確定要刪除活動？')).toBeInTheDocument();
    });

    // 點「是，確認刪除」
    const confirmBtn = screen.getByRole('button', { name: '是，確認刪除' });
    await user.click(confirmBtn);

    // 驗證真實 notifyEventCancelled path 建立通知 payload
    await waitFor(() => {
      expect(notificationPayloads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            recipientUid: 'p1',
            type: 'event_cancelled',
            entityId: 'evt1',
            entityTitle: '週末晨跑',
            actorUid: 'host1',
          }),
          expect.objectContaining({
            recipientUid: 'p2',
            type: 'event_cancelled',
            entityId: 'evt1',
            entityTitle: '週末晨跑',
            actorUid: 'host1',
          }),
        ]),
      );
    });

    // 驗證真實 deleteEvent path 讀取 event document
    await waitFor(() => {
      expect(getDoc).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'events/evt1',
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Post Detail — add comment → notifyPostNewComment
// ---------------------------------------------------------------------------

describe('PostDetailClient notification triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreBoundary();
  });

  it('calls notifyPostNewComment when commenter is not the post author', async () => {
    // post 的作者是 author99，登入使用者是 host1 → 不同人 → 應通知
    postFixtures.post1 = {
      id: 'post1',
      title: '跑步心得',
      content: '今天跑了 10K',
      authorUid: 'author99',
      authorName: 'Author',
      authorImgURL: '',
      likesCount: 0,
      commentsCount: 0,
    };

    const user = userEvent.setup();
    renderWithProviders(<PostDetailClient postId="post1" />);

    // 等文章載入
    await waitFor(() => {
      expect(screen.getByText('跑步心得')).toBeInTheDocument();
    });

    // 輸入留言
    const commentInput = screen.getByRole('textbox', { name: '留言' });
    await user.type(commentInput, '好文！');

    // 送出
    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    // 驗證真實 addComment path 透過 transaction 新增留言
    await waitFor(() => {
      expect(transactionUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            commentsCount: expect.objectContaining({ __increment: 1 }),
          }),
        ]),
      );
    });

    // 驗證真實 notifyPostNewComment path 建立通知 payload
    await waitFor(() => {
      expect(notificationPayloads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            recipientUid: 'author99',
            type: 'post_new_comment',
            entityId: 'post1',
            entityTitle: '跑步心得',
            commentId: 'cmt1',
            actorUid: 'host1',
          }),
        ]),
      );
    });
  });

  it('does NOT call notifyPostNewComment when commenter is the post author', async () => {
    // post 的作者是 host1，登入使用者也是 host1 → 同一人 → 不通知
    postFixtures.post2 = {
      id: 'post2',
      title: '我的文章',
      content: '自己的文章',
      authorUid: 'host1',
      authorName: 'Host User',
      authorImgURL: 'https://photo.url/host.jpg',
      likesCount: 0,
      commentsCount: 0,
    };

    const user = userEvent.setup();
    renderWithProviders(<PostDetailClient postId="post2" />);

    // 等文章載入
    await waitFor(() => {
      expect(screen.getByText('我的文章')).toBeInTheDocument();
    });

    // 輸入留言
    const commentInput = screen.getByRole('textbox', { name: '留言' });
    await user.type(commentInput, '自己留言');

    // 送出
    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    // 驗證真實 addComment path 仍有新增留言
    await waitFor(() => {
      expect(transactionUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            commentsCount: expect.objectContaining({ __increment: 1 }),
          }),
        ]),
      );
    });

    // 驗證 notifyPostNewComment 的真實 self-author guard 沒建立通知
    expect(notificationPayloads).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'post_new_comment',
          entityId: 'post2',
        }),
      ]),
    );
  });
});
