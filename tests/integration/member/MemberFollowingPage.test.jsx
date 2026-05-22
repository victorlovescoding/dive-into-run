import Toast from '@/components/Toast';
import MemberFollowingPage from '@/app/member/following/page';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import ToastProvider, { useToast } from '@/runtime/providers/ToastProvider';
import { doc, getDocs, runTransaction } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const firestoreBoundary = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn((_db, ...segments) => ({
    id: String(segments.at(-1) ?? ''),
    path: segments.join('/'),
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  limit: vi.fn((count) => ({ count })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field, direction) => ({ field, direction })),
  query: vi.fn((source, ...constraints) => ({ path: source.path, constraints })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-time'),
  startAfter: vi.fn((cursor) => ({ cursor })),
  updateDoc: vi.fn(),
  where: vi.fn((field, operator, value) => ({ field, operator, value })),
  writeBatch: vi.fn(() => ({
    commit: vi.fn(),
    set: vi.fn(),
  })),
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
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestoreBoundary);

vi.mock('firebase/storage', () => ({
  connectStorageEmulator: vi.fn(),
  getStorage: vi.fn(() => ({})),
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

const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);
const mockedRunTransaction = /** @type {import('vitest').Mock} */ (runTransaction);

/**
 * @typedef {object} FollowRow
 * @property {string} uid - Followed runner UID.
 * @property {string} name - Followed runner display name.
 * @property {string} photoURL - Followed runner avatar.
 * @property {unknown} createdAt - Follow creation timestamp.
 */

/**
 * Creates a Firestore-like follow document snapshot.
 * @param {FollowRow} row - Follow row fixture.
 * @returns {{ id: string, data: () => object }} Snapshot double.
 */
function createFollowSnapshot(row) {
  return {
    id: row.uid,
    data: () => ({
      targetUid: row.uid,
      targetName: row.name,
      targetPhotoURL: row.photoURL,
      createdAt: row.createdAt,
    }),
  };
}

/**
 * Creates a Firestore transaction double for an existing follow relationship.
 * @returns {{ get: () => Promise<{ exists: () => boolean, data: () => { followersCount: number } }>, set: import('vitest').Mock, update: import('vitest').Mock, delete: import('vitest').Mock }} Transaction double.
 */
function createUnfollowTransaction() {
  return {
    get: async () => ({
      exists: () => true,
      data: () => ({ followersCount: 1 }),
    }),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * Creates a signed-in test user.
 * @returns {{ uid: string, name: string, email: string, photoURL: string, bio: string, getIdToken: () => Promise<string> }} User fixture.
 */
function createUser() {
  return {
    uid: 'viewer-uid',
    name: 'Viewer Runner',
    email: 'viewer@example.test',
    photoURL: 'https://example.test/viewer.png',
    bio: '',
    getIdToken: async () => '',
  };
}

/**
 * Defers a mutation promise for optimistic UI assertions.
 * @returns {{ promise: Promise<void>, resolve: () => void, reject: (error: Error) => void }} Deferred control.
 */
function createDeferred() {
  /** @type {(value?: void | PromiseLike<void>) => void} */
  let resolve = () => {};
  /** @type {(reason?: Error) => void} */
  let reject = () => {};
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
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
 * Renders the member following route with runtime and toast provider boundaries.
 * @param {{ user?: ReturnType<typeof createUser> | null }} [options] - Render options.
 * @returns {import('@testing-library/react').RenderResult} Render result.
 */
function renderFollowingPage({ user = createUser() } = {}) {
  return render(
    <AuthContext.Provider value={{ user, loading: false, setUser: vi.fn() }}>
      <ToastProvider>
        <MemberFollowingPage />
        <ToastOutlet />
      </ToastProvider>
    </AuthContext.Provider>,
  );
}

const followingRows = /** @type {FollowRow[]} */ ([
  {
    uid: 'runner-a',
    name: 'Runner A',
    photoURL: 'https://example.test/a.png',
    createdAt: { seconds: 20 },
  },
  {
    uid: 'runner-b',
    name: 'Runner B',
    photoURL: '',
    createdAt: { seconds: 10 },
  },
]);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetDocs.mockResolvedValue({
    docs: followingRows.map(createFollowSnapshot),
    size: followingRows.length,
  });
  mockedRunTransaction.mockImplementation(async (_db, callback) =>
    callback(createUnfollowTransaction()),
  );
});

describe('Member following route', () => {
  it('lists followed runners with avatar and profile links for the signed-in member', async () => {
    renderFollowingPage();

    expect(await screen.findByRole('heading', { name: '我的追蹤跑友' })).toBeInTheDocument();
    expect(screen.getByText('2 位追蹤中')).toBeInTheDocument();

    const runnerALink = await screen.findByRole('link', { name: 'Runner A' });
    expect(runnerALink).toHaveAttribute('href', '/users/runner-a');
    expect(within(runnerALink).getByRole('img', { name: 'Runner A' })).toHaveAttribute(
      'src',
      'https://example.test/a.png',
    );

    expect(screen.getByRole('link', { name: 'Runner B' })).toHaveAttribute(
      'href',
      '/users/runner-b',
    );
    expect(screen.getByRole('button', { name: '取消追蹤 Runner A' })).toBeInTheDocument();
  });

  it('blocks signed-out access to the member following management surface', async () => {
    renderFollowingPage({ user: null });

    expect(await screen.findByRole('alert')).toHaveTextContent('請先登入以管理追蹤跑友');
    expect(screen.queryByRole('heading', { name: '我的追蹤跑友' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Runner A' })).not.toBeInTheDocument();
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('restores a row and shows an error toast when row-level unfollow fails', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    mockedRunTransaction.mockReturnValueOnce(deferred.promise);
    renderFollowingPage();

    const runnerARow = await screen.findByRole('article', { name: 'Runner A 追蹤跑友' });
    await user.click(within(runnerARow).getByRole('button', { name: '取消追蹤 Runner A' }));

    await waitFor(() => {
      expect(screen.queryByRole('article', { name: 'Runner A 追蹤跑友' })).not.toBeInTheDocument();
    });
    expect(runTransaction).toHaveBeenLastCalledWith(expect.anything(), expect.any(Function));

    await act(async () => {
      deferred.reject(new Error('unfollow failed'));
      await deferred.promise.catch(() => {});
    });

    expect(await screen.findByRole('article', { name: 'Runner A 追蹤跑友' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '取消追蹤失敗，請稍後再試',
    );
  });

  it('uses the shared unfollow transaction path for row-level unfollow', async () => {
    const user = userEvent.setup();
    renderFollowingPage();

    const runnerARow = await screen.findByRole('article', { name: 'Runner A 追蹤跑友' });
    await user.click(within(runnerARow).getByRole('button', { name: '取消追蹤 Runner A' }));

    await waitFor(() => {
      expect(screen.queryByRole('article', { name: 'Runner A 追蹤跑友' })).not.toBeInTheDocument();
    });
    expect(doc).toHaveBeenCalledWith({}, 'users', 'viewer-uid', 'following', 'runner-a');
  });
});
