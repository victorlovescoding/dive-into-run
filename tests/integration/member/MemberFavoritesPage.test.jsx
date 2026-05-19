import Toast from '@/components/Toast';
import MemberPage from '@/app/member/page';
import MemberFavoritesPage from '@/app/member/favorites/page';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import ToastProvider, { ToastContext, useToast } from '@/runtime/providers/ToastProvider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const firebaseBoundary = vi.hoisted(() => ({
  collection: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  collectionGroup: vi.fn((_db, groupId) => ({ groupId })),
  deleteDoc: vi.fn(),
  doc: vi.fn((_db, ...segments) => ({
    id: String(segments.at(-1) ?? ''),
    path: segments.join('/'),
  })),
  getCountFromServer: vi.fn(async () => ({ data: () => ({ count: 0 }) })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((count) => ({ count })),
  orderBy: vi.fn((field, direction) => ({ field, direction })),
  query: vi.fn((source, ...constraints) => ({ path: source.path, constraints })),
  serverTimestamp: vi.fn(() => 'server-time'),
  setDoc: vi.fn(),
  startAfter: vi.fn((cursor) => ({ cursor })),
  where: vi.fn((field, operator, value) => ({ field, operator, value })),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
}));

vi.mock('firebase/auth', () => ({
  connectAuthEmulator: vi.fn(),
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
    this.setCustomParameters = vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: firebaseBoundary.collection,
  collectionGroup: firebaseBoundary.collectionGroup,
  connectFirestoreEmulator: vi.fn(),
  deleteDoc: firebaseBoundary.deleteDoc,
  doc: firebaseBoundary.doc,
  getCountFromServer: firebaseBoundary.getCountFromServer,
  getDoc: firebaseBoundary.getDoc,
  getDocs: firebaseBoundary.getDocs,
  getFirestore: vi.fn(() => ({})),
  limit: firebaseBoundary.limit,
  orderBy: firebaseBoundary.orderBy,
  query: firebaseBoundary.query,
  serverTimestamp: firebaseBoundary.serverTimestamp,
  setDoc: firebaseBoundary.setDoc,
  startAfter: firebaseBoundary.startAfter,
  where: firebaseBoundary.where,
}));

vi.mock('firebase/storage', () => ({
  connectStorageEmulator: vi.fn(),
  getDownloadURL: vi.fn(),
  getStorage: vi.fn(() => ({})),
  ref: vi.fn((_storage, path) => ({ fullPath: path })),
  uploadBytes: vi.fn(),
}));

vi.mock('next/image', () => ({
  /**
   * jsdom-safe replacement for next/image.
   * @param {object} props - Image props.
   * @param {string} props.src - Image source.
   * @param {string} props.alt - Accessible image name.
   * @returns {import('react').ReactElement} Plain image.
   */
  default: ({ src, alt, ...rest }) => <img src={src} alt={alt} {...rest} />,
}));

vi.mock('next/link', () => ({
  /**
   * jsdom-safe replacement for next/link with anchor semantics.
   * @param {object} props - Link props.
   * @param {string} props.href - Destination URL.
   * @param {import('react').ReactNode} props.children - Link children.
   * @returns {import('react').ReactElement} Anchor element.
   */
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * @typedef {object} FavoriteFixture
 * @property {string} id - Favorite document ID.
 * @property {string} targetId - Target content ID.
 * @property {unknown} createdAt - Favorite timestamp.
 */

const favoriteStore = {
  favoritePosts: /** @type {FavoriteFixture[]} */ ([]),
  favoriteEvents: /** @type {FavoriteFixture[]} */ ([]),
};

const targetStore = {
  posts: /** @type {Map<string, object | null>} */ (new Map()),
  events: /** @type {Map<string, object | null>} */ (new Map()),
};

/**
 * Creates a Firestore-like snapshot double.
 * @param {string} id - Snapshot ID.
 * @param {object | null} data - Snapshot data; null marks a missing target.
 * @returns {{ id: string, exists: () => boolean, data: () => object }} Snapshot double.
 */
function createSnapshot(id, data) {
  return {
    id,
    exists: () => data !== null,
    data: () => data ?? {},
  };
}

/**
 * Picks the favorite fixture bucket for a Firestore collection path.
 * @param {string | undefined} collectionName - Favorite collection name.
 * @returns {FavoriteFixture[]} Favorite fixtures.
 */
function getFavoritesByCollection(collectionName) {
  return collectionName === 'favoriteEvents'
    ? favoriteStore.favoriteEvents
    : favoriteStore.favoritePosts;
}

/**
 * Replaces the favorite fixture bucket for a Firestore collection path.
 * @param {string | undefined} collectionName - Favorite collection name.
 * @param {FavoriteFixture[]} favorites - New favorite fixtures.
 * @returns {void}
 */
function setFavoritesByCollection(collectionName, favorites) {
  if (collectionName === 'favoriteEvents') {
    favoriteStore.favoriteEvents = favorites;
    return;
  }
  favoriteStore.favoritePosts = favorites;
}

/**
 * Picks the target fixture bucket for a Firestore collection path.
 * @param {string | undefined} collectionName - Target collection name.
 * @returns {Map<string, object | null>} Target fixtures.
 */
function getTargetsByCollection(collectionName) {
  return collectionName === 'events' ? targetStore.events : targetStore.posts;
}

/**
 * Creates a signed-in test user.
 * @returns {NonNullable<import('@/runtime/providers/AuthProvider').AuthContextValue['user']>} User fixture.
 */
function createUser() {
  return {
    uid: 'user-1',
    name: 'Alice Runner',
    email: 'alice@example.com',
    photoURL: 'https://example.com/avatar.png',
    bio: 'Morning tempo runs.',
    getIdToken: async () => '',
  };
}

/**
 * Renders the app member page route with a signed-in auth context.
 * @returns {import('@testing-library/react').RenderResult} Render result.
 */
function renderMemberPage() {
  return render(
    <AuthContext.Provider value={{ user: createUser(), loading: false, setUser: vi.fn() }}>
      <ToastContext.Provider value={{ toasts: [], showToast: vi.fn(), removeToast: vi.fn() }}>
        <MemberPage />
      </ToastContext.Provider>
    </AuthContext.Provider>,
  );
}

/**
 * Renders current toast provider items into the test DOM.
 * @returns {import('react').ReactElement} Toast outlet.
 */
function ToastOutlet() {
  const { toasts, removeToast } = useToast();
  return (
    <>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </>
  );
}

/**
 * Renders the member favorites route with real runtime and toast provider boundaries.
 * @returns {import('@testing-library/react').RenderResult} Render result.
 */
function renderFavoritesPage() {
  return render(
    <AuthContext.Provider value={{ user: createUser(), loading: false, setUser: vi.fn() }}>
      <ToastProvider>
        <MemberFavoritesPage />
        <ToastOutlet />
      </ToastProvider>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  favoriteStore.favoritePosts = [
    { id: 'post-new', targetId: 'post-new', createdAt: { seconds: 30 } },
    { id: 'post-missing', targetId: 'post-missing', createdAt: { seconds: 20 } },
    { id: 'post-old', targetId: 'post-old', createdAt: { seconds: 10 } },
  ];
  favoriteStore.favoriteEvents = [
    { id: 'event-new', targetId: 'event-new', createdAt: { seconds: 40 } },
  ];
  targetStore.posts = new Map([
    ['post-new', { title: 'Latest Post Title', excerpt: 'fresh post body' }],
    ['post-missing', null],
    ['post-old', { title: 'Older Post Title', excerpt: 'old post body' }],
  ]);
  targetStore.events = new Map([
    ['event-new', { title: 'Latest Event Title', city: '臺北市', location: '大安森林公園' }],
  ]);

  firebaseBoundary.getDocs.mockImplementation(async (queryRef) => {
    const collectionName = String(queryRef.path).split('/').at(-1);
    return {
      docs: [...getFavoritesByCollection(collectionName)].map((favorite) =>
        createSnapshot(favorite.id, {
          targetId: favorite.targetId,
          createdAt: favorite.createdAt,
        }),
      ),
    };
  });

  firebaseBoundary.getDoc.mockImplementation(async (docRef) => {
    const [collectionName, targetId] = String(docRef.path).split('/').slice(-2);
    return createSnapshot(targetId, getTargetsByCollection(collectionName).get(targetId) ?? null);
  });

  firebaseBoundary.deleteDoc.mockImplementation(async (docRef) => {
    const [collectionName, targetId] = String(docRef.path).split('/').slice(-2);
    setFavoritesByCollection(
      collectionName,
      getFavoritesByCollection(collectionName).filter(
        (favorite) => favorite.targetId !== targetId,
      ),
    );
  });

  firebaseBoundary.setDoc.mockImplementation(async (docRef, payload) => {
    const [collectionName, targetId] = String(docRef.path).split('/').slice(-2);
    setFavoritesByCollection(collectionName, [
      { id: targetId, targetId: payload.targetId, createdAt: { seconds: 99 } },
      ...getFavoritesByCollection(collectionName),
    ]);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Member favorites route', () => {
  it('shows the signed-in member favorites entry from the member route', () => {
    renderMemberPage();

    expect(screen.getByRole('link', { name: '我的收藏' })).toHaveAttribute(
      'href',
      '/member/favorites',
    );
  });

  it('renders post and event favorite tabs with linked cards in newest favorite order', async () => {
    const user = userEvent.setup();
    renderFavoritesPage();

    expect(await screen.findByRole('tab', { name: '收藏文章' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: '收藏活動' })).toBeInTheDocument();

    const latestPost = await screen.findByRole('link', { name: /Latest Post Title/ });
    const olderPost = screen.getByRole('link', { name: /Older Post Title/ });
    expect(latestPost).toHaveAttribute('href', '/posts/post-new');
    expect(olderPost).toHaveAttribute('href', '/posts/post-old');
    expect(latestPost.compareDocumentPosition(olderPost)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(screen.getByRole('tab', { name: '收藏活動' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '收藏活動' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(await screen.findByRole('link', { name: /Latest Event Title/ })).toHaveAttribute(
      'href',
      '/events/event-new',
    );
  });

  it('renders missing targets without detail links and restores an optimistic remove through undo', async () => {
    const user = userEvent.setup();
    renderFavoritesPage();

    const missingCard = await screen.findByRole('article', { name: /post-missing/ });
    expect(within(missingCard).getByText('內容已不存在')).toBeInTheDocument();
    expect(within(missingCard).queryByRole('link')).not.toBeInTheDocument();

    await user.click(within(missingCard).getByRole('button', { name: /移除收藏 post-missing/ }));

    await waitFor(() => {
      expect(screen.queryByRole('article', { name: /post-missing/ })).not.toBeInTheDocument();
    });

    await user.click(await screen.findByRole('button', { name: '復原' }));

    expect(await screen.findByRole('article', { name: /post-missing/ })).toHaveTextContent(
      '內容已不存在',
    );
  });
});
