import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: mockAuthContext,
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/lib/firebase-client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(),
  limit: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  increment: vi.fn(),
  collectionGroup: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  startAfter: vi.fn(),
  documentId: vi.fn(),
}));

vi.mock('@/lib/firebase-posts', () => ({
  getLatestPosts: vi.fn(),
  hasUserLikedPosts: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  getPostDetail: vi.fn(),
  toggleLikePost: vi.fn(),
  deletePost: vi.fn(),
  getMorePosts: vi.fn(),
  validatePostInput: vi.fn(),
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
import { AuthContext } from '@/contexts/AuthContext';
import PostPage from '@/app/posts/page';
import { getLatestPosts, hasUserLikedPosts, getMorePosts } from '@/lib/firebase-posts';

/** @type {import('vitest').Mock} */
const mockedGetLatestPosts = /** @type {import('vitest').Mock} */ (getLatestPosts);
/** @type {import('vitest').Mock} */
const mockedHasUserLikedPosts = /** @type {import('vitest').Mock} */ (hasUserLikedPosts);
/** @type {import('vitest').Mock} */
const mockedGetMorePosts = /** @type {import('vitest').Mock} */ (getMorePosts);

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
const TEST_USER = {
  uid: 'test-uid',
  photoURL: 'https://example.com/me.jpg',
  name: 'Test User',
  email: 'test@test.com',
  bio: null,
  getIdToken: vi.fn().mockResolvedValue('token'),
};

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
  return (
    <AuthContext.Provider value={{ user, setUser: vi.fn(), loading: false }}>
      {children}
    </AuthContext.Provider>
  );
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
    expect(mockedGetLatestPosts).toHaveBeenCalled();
  });
  return ue;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  intersectionCallback = null;
  mockedGetLatestPosts.mockResolvedValue([]);
  mockedHasUserLikedPosts.mockResolvedValue(new Set());
  mockedGetMorePosts.mockResolvedValue([]);
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
    const { container } = render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );
    await waitFor(() => {
      expect(mockedGetLatestPosts).toHaveBeenCalled();
    });

    const feedContainer = container.querySelector('[class*="feed"]');
    expect(feedContainer).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. PostCard list rendering
// ===========================================================================
describe('PostCard list rendering', () => {
  beforeEach(() => {
    mockedGetLatestPosts.mockResolvedValue(mockPosts);
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
    mockedGetLatestPosts.mockResolvedValue(mockPosts);
    await renderPostPage();

    // 等待 posts 渲染完成後 IntersectionObserver useEffect 才會執行
    await waitFor(() => {
      expect(screen.getByText('晨跑五公里')).toBeInTheDocument();
    });

    // IntersectionObserver 被實例化後 intersectionCallback 會被設定
    expect(intersectionCallback).not.toBeNull();
  });

  it('calls getMorePosts when the sentinel enters the viewport', async () => {
    mockedGetLatestPosts.mockResolvedValue(mockPosts);
    await renderPostPage();

    // 等待 posts 渲染 + observer 建立
    await waitFor(() => {
      expect(screen.getByText('晨跑五公里')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(intersectionCallback).not.toBeNull();
    });

    // 模擬 sentinel 進入可視範圍
    intersectionCallback([{ isIntersecting: true, target: document.createElement('div') }]);

    await waitFor(() => {
      expect(mockedGetMorePosts).toHaveBeenCalled();
    });
  });
});
