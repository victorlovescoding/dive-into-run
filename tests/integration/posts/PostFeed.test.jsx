import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { useMemo } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
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

// ---------------------------------------------------------------------------
// Hoisted shared state (available inside vi.mock factories)
// ---------------------------------------------------------------------------
const { mockShowToast, mockReplace, mockSearchParamsGet, mockAuthContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return {
    mockShowToast: vi.fn(),
    mockReplace: vi.fn(),
    mockSearchParamsGet: vi.fn().mockReturnValue(null),
    mockAuthContext: createContext({ user: null, setUser: () => {}, loading: false }),
  };
});

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

vi.mock('@/runtime/providers/AuthProvider', () => ({
  AuthContext: mockAuthContext,
}));

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  limit: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn((value) => ({ __type: 'increment', value })),
  collectionGroup: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  startAfter: vi.fn(),
  documentId: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ toDate: () => new Date('2026-04-15T08:00:00Z') })),
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props) => <img {...props} />,
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock — Vitest hoists mocks above these)
// ---------------------------------------------------------------------------
import { AuthContext } from '@/runtime/providers/AuthProvider';
import PostPage from '@/app/posts/page';

const firestoreMocks = {
  ['addDoc']: /** @type {import('vitest').Mock} */ (addDoc),
  ['collection']: /** @type {import('vitest').Mock} */ (collection),
  ['collectionGroup']: /** @type {import('vitest').Mock} */ (collectionGroup),
  ['doc']: /** @type {import('vitest').Mock} */ (doc),
  ['documentId']: /** @type {import('vitest').Mock} */ (documentId),
  ['getDoc']: /** @type {import('vitest').Mock} */ (getDoc),
  ['getDocs']: /** @type {import('vitest').Mock} */ (getDocs),
  ['increment']: /** @type {import('vitest').Mock} */ (increment),
  ['limit']: /** @type {import('vitest').Mock} */ (limit),
  ['orderBy']: /** @type {import('vitest').Mock} */ (orderBy),
  ['query']: /** @type {import('vitest').Mock} */ (query),
  ['runTransaction']: /** @type {import('vitest').Mock} */ (runTransaction),
  ['serverTimestamp']: /** @type {import('vitest').Mock} */ (serverTimestamp),
  ['startAfter']: /** @type {import('vitest').Mock} */ (startAfter),
  ['updateDoc']: /** @type {import('vitest').Mock} */ (updateDoc),
  ['where']: /** @type {import('vitest').Mock} */ (where),
  ['writeBatch']: /** @type {import('vitest').Mock} */ (writeBatch),
  ['timestampFromDate']: /** @type {import('vitest').Mock} */ (Timestamp.fromDate),
};

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------
/** @type {((entries: Array<{ isIntersecting: boolean, target: Element }>) => void) | null} */
let intersectionCallback = null;

beforeAll(() => {
  global.IntersectionObserver = /** @type {any} */ (
    class IntersectionObserver {
      /**
       * @param {(entries: Array<{ isIntersecting: boolean, target: Element }>) => void} callback - observer 回呼。
       */
      constructor(callback) {
        intersectionCallback = callback;
        this.observe = vi.fn();
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
      }
    }
  );
});

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
/** @type {Array<object>} */
const mockPosts = [
  {
    id: 'post-1',
    title: '晨跑五公里',
    content: '今天天氣不錯',
    authorUid: 'user-1',
    authorName: '跑者小明',
    authorImgURL: 'https://example.com/avatar1.jpg',
    postAt: { toDate: () => new Date('2026-04-15T06:00:00Z') },
    likesCount: 3,
    commentsCount: 1,
    liked: false,
    isAuthor: false,
  },
  {
    id: 'post-2',
    title: '馬拉松訓練日記',
    content: '距離比賽剩下 30 天',
    authorUid: 'user-2',
    authorName: '跑者小華',
    authorImgURL: '',
    postAt: { toDate: () => new Date('2026-04-14T18:00:00Z') },
    likesCount: 10,
    commentsCount: 5,
    liked: true,
    isAuthor: false,
  },
];

/** @type {object[][]} */
let postPages = [[]];
/** @type {Set<string>} */
let likedPostIds = new Set();

/**
 * 建立 Firestore-like document snapshot。
 * @param {string} id - 文件 ID。
 * @param {object | null} data - 文件資料。
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
 * @param {object[]} docs - Firestore-like document snapshots。
 * @returns {{ docs: object[], size: number }} Firestore-like query snapshot。
 */
function createQuerySnapshot(docs) {
  return { docs, size: docs.length };
}

/**
 * 設定 posts query 回傳頁面。
 * @param {...object[]} pages - 每次 posts query 要回傳的資料頁。
 */
function setPostPages(...pages) {
  postPages = pages.length > 0 ? pages : [[]];
}

/**
 * 設定本檔 Firestore SDK 邊界 stub。
 */
function setupFirestoreMocks() {
  firestoreMocks.collection.mockImplementation((_dbOrRef, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  }));
  firestoreMocks.collectionGroup.mockImplementation((_db, groupId) => ({
    type: 'collectionGroup',
    path: groupId,
  }));
  firestoreMocks.doc.mockImplementation((base, ...segments) => {
    if (base?.type === 'collection' && segments.length === 0) {
      return { id: 'new-post-id', path: `${base.path}/new-post-id` };
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
  firestoreMocks.documentId.mockReturnValue('__name__');
  firestoreMocks.addDoc.mockResolvedValue({ id: 'new-post-id' });
  firestoreMocks.updateDoc.mockResolvedValue(undefined);
  firestoreMocks.runTransaction.mockImplementation(async (_db, callback) =>
    callback({ get: vi.fn(), set: vi.fn(), update: vi.fn(), delete: vi.fn() }),
  );
  firestoreMocks.writeBatch.mockReturnValue({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  });
  firestoreMocks.getDoc.mockResolvedValue(createDocSnapshot('missing', null));
  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    if (ref.path === 'likes') {
      return createQuerySnapshot(
        [...likedPostIds].map((postId) => createDocSnapshot(`${postId}-like`, { postId })),
      );
    }

    const page = postPages.length > 1 ? postPages.shift() : postPages[0];
    return createQuerySnapshot(page.map((post) => createDocSnapshot(String(post.id), post)));
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 用 AuthContext 包裹子元件，提供測試用使用者。
 * @param {object} props - 元件 props。
 * @param {import('react').ReactNode} props.children - 子元件。
 * @param {object | null} [props.user] - 覆寫使用者，預設 null（未登入）。
 * @returns {import('react').ReactElement} 包裹後的元件。
 */
function AuthWrapper({ children, user = null }) {
  const authValue = useMemo(() => ({ user, setUser: vi.fn(), loading: false }), [user]);
  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
}

/**
 * 渲染 PostPage（含 AuthWrapper）並等待初始 API 呼叫完成。
 * @param {object} [options] - 渲染選項。
 * @param {object | null} [options.user] - 使用者物件，預設 null。
 * @returns {Promise<import('@testing-library/user-event').UserEvent>} userEvent 實例。
 */
async function renderPostPage({ user = null } = {}) {
  const ue = userEvent.setup();
  render(
    <AuthWrapper user={user}>
      <PostPage />
    </AuthWrapper>,
  );
  await waitFor(() => {
    expect(firestoreMocks.getDocs).toHaveBeenCalled();
  });
  return ue;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  intersectionCallback = null;
  setPostPages([]);
  likedPostIds = new Set();
  setupFirestoreMocks();
  mockSearchParamsGet.mockReturnValue(null);
});

// ===========================================================================
// 1. Feed layout
// ===========================================================================
describe('Feed layout', () => {
  it('renders the page heading "文章河道"', async () => {
    await renderPostPage();

    expect(screen.getByRole('heading', { name: '文章河道' })).toBeInTheDocument();
  });

  it('wraps the feed in a container with the "feed" CSS class for max-width', async () => {
    // 重構後 page.jsx 會將外層 div 加上 styles.feed class（max-width 680px 置中）
    // 目前 page.jsx 外層 <div> 沒有 className → 此測試應 FAIL
    render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );
    await waitFor(() => {
      expect(firestoreMocks.getDocs).toHaveBeenCalled();
    });

    // feed wrapper 是 layout-only div，沒語意 role；加 data-testid 後直接 query；保留 className 驗證原意圖
    const feedContainer = screen.getByTestId('post-feed');
    expect(feedContainer).toBeInTheDocument();
    expect(feedContainer.className).toMatch(/feed/);
  });
});

// ===========================================================================
// 2. PostCard list rendering
// ===========================================================================
describe('PostCard list rendering', () => {
  beforeEach(() => {
    setPostPages(mockPosts);
  });

  it('renders post titles from PostCard components', async () => {
    await renderPostPage();

    expect(screen.getByText('晨跑五公里')).toBeInTheDocument();
    expect(screen.getByText('馬拉松訓練日記')).toBeInTheDocument();
  });

  it('renders author names on each card', async () => {
    // 重構後 PostCard 會顯示 post.authorName（如「跑者小明」）
    // 目前 page.jsx inline 渲染不顯示 authorName → 此測試應 FAIL
    await renderPostPage();

    expect(screen.getByText('跑者小明')).toBeInTheDocument();
    expect(screen.getByText('跑者小華')).toBeInTheDocument();
  });

  it('renders like count and comment count for each card', async () => {
    await renderPostPage();

    // post-1: likesCount=3, commentsCount=1
    // post-2: likesCount=10, commentsCount=5
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders each post as an article element (PostCard semantic structure)', async () => {
    // 重構後 PostCard 用 <article> 取代 <li>
    // 目前用 <li> → 此測試應 FAIL
    await renderPostPage();

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);
  });
});

// ===========================================================================
// 3. Empty state
// ===========================================================================
describe('empty state', () => {
  it('shows an empty state message when there are no posts', async () => {
    // getLatestPosts 回傳空陣列（beforeEach 已設好）
    await renderPostPage();

    // 重構後列表頁在 posts.length === 0 時顯示空狀態提示
    // 目前 page.jsx 無此邏輯 → 此測試應 FAIL
    expect(screen.getByText(/還沒有文章/)).toBeInTheDocument();
  });
});

// ===========================================================================
// 4. Infinite scroll (IntersectionObserver)
// ===========================================================================
describe('infinite scroll', () => {
  it('creates an IntersectionObserver for loading more posts', async () => {
    setPostPages(mockPosts);
    await renderPostPage();

    // 等待 posts 渲染完成後 IntersectionObserver useEffect 才會執行
    await waitFor(() => {
      expect(screen.getByText('晨跑五公里')).toBeInTheDocument();
    });

    // IntersectionObserver 被實例化後 intersectionCallback 會被設定
    expect(intersectionCallback).not.toBeNull();
  });

  it('calls getMorePosts when the sentinel enters the viewport', async () => {
    setPostPages(mockPosts, []);
    await renderPostPage();

    // 等待 posts 渲染 + observer 建立
    await waitFor(() => {
      expect(screen.getByText('晨跑五公里')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(intersectionCallback).not.toBeNull();
    });

    // 模擬 sentinel 進入可視範圍
    const getDocsCallsBefore = firestoreMocks.getDocs.mock.calls.length;
    intersectionCallback([{ isIntersecting: true, target: document.createElement('div') }]);

    await waitFor(() => {
      expect(firestoreMocks.getDocs.mock.calls.length).toBeGreaterThan(getDocsCallsBefore);
    });
  });
});
