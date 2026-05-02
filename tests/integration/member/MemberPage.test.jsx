import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemberPage from '@/app/member/page';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';

const firebaseBoundary = vi.hoisted(() => ({
  mockDoc: vi.fn((_db, ...segments) => ({
    type: 'doc',
    path: segments.join('/'),
    id: String(segments.at(-1) ?? ''),
  })),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockSetDoc: vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
  mockStorageRef: vi.fn((_storage, path) => ({ type: 'storageRef', fullPath: path })),
  mockUploadBytes: vi.fn(),
  mockGetDownloadURL: vi.fn(),
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
  collection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  collectionGroup: vi.fn((_db, groupId) => ({ type: 'collectionGroup', groupId })),
  connectFirestoreEmulator: vi.fn(),
  doc: firebaseBoundary.mockDoc,
  getCountFromServer: vi.fn(async () => ({ data: () => ({ count: 0 }) })),
  getDoc: firebaseBoundary.mockGetDoc,
  getDocs: firebaseBoundary.mockGetDocs,
  getFirestore: vi.fn(() => ({})),
  limit: vi.fn((count) => ({ type: 'limit', count })),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  serverTimestamp: firebaseBoundary.mockServerTimestamp,
  setDoc: firebaseBoundary.mockSetDoc,
  startAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  where: vi.fn((field, operator, value) => ({ type: 'where', field, operator, value })),
}));

vi.mock('firebase/storage', () => ({
  connectStorageEmulator: vi.fn(),
  getDownloadURL: firebaseBoundary.mockGetDownloadURL,
  getStorage: vi.fn(() => ({})),
  ref: firebaseBoundary.mockStorageRef,
  uploadBytes: firebaseBoundary.mockUploadBytes,
}));

vi.mock('next/image', () => ({
  /**
   * jsdom-safe replacement for next/image so avatar click behavior can be tested.
   * @param {object} props - Image props.
   * @param {string} props.src - Image source.
   * @param {string} props.alt - Accessible image name.
   * @returns {import('react').ReactElement} Plain img element.
   */
  default: ({ src, alt, ...rest }) => <img src={src} alt={alt} {...rest} />,
}));

vi.mock('next/link', () => ({
  /**
   * jsdom-safe replacement for next/link; keeps real anchor semantics.
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
 * @typedef {NonNullable<import('@/runtime/providers/AuthProvider').AuthContextValue['user']>} TestUser
 */

/**
 * 建立測試用 Auth user。
 * @param {Partial<TestUser>} [overrides] - 欄位覆寫。
 * @returns {TestUser} 使用者 fixture。
 */
function createUser(overrides = {}) {
  return {
    uid: 'user-1',
    name: 'Alice Runner',
    email: 'alice@example.com',
    photoURL: 'https://example.com/avatar.png',
    bio: 'Morning tempo runs.',
    getIdToken: async () => '',
    ...overrides,
  };
}

/**
 * Render member page through the app boundary with real runtime hooks.
 * @param {object} options - Render options.
 * @param {TestUser | null} [options.user] - Auth user.
 * @returns {import('@testing-library/react').RenderResult} Render result.
 */
function renderMemberPage({ user = createUser() } = {}) {
  return render(
    <AuthContext.Provider value={{ user, loading: false, setUser: vi.fn() }}>
      <ToastContext.Provider value={{ toasts: [], showToast: vi.fn(), removeToast: vi.fn() }}>
        <MemberPage />
      </ToastContext.Provider>
    </AuthContext.Provider>,
  );
}

describe('MemberPage', () => {
  let originalCreateImageBitmap;
  let originalGetContext;
  let originalToBlob;
  let avatarInputClickSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCreateImageBitmap = window.createImageBitmap;
    window.createImageBitmap = vi.fn().mockResolvedValue({ width: 128, height: 96 });
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    const canvasContext = /** @type {CanvasRenderingContext2D} */ (
      /** @type {unknown} */ ({ drawImage: vi.fn() })
    );
    HTMLCanvasElement.prototype.getContext = /** @type {typeof HTMLCanvasElement.prototype.getContext} */ (
      /** @type {unknown} */ (vi.fn(() => canvasContext))
    );
    originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function stubToBlob(callback) {
      callback(new Blob(['compressed-avatar'], { type: 'image/png' }));
    };
    firebaseBoundary.mockGetDocs.mockResolvedValue({ docs: [] });
    firebaseBoundary.mockGetDoc.mockResolvedValue({
      id: 'missing',
      exists: () => false,
      data: () => ({}),
    });
    firebaseBoundary.mockSetDoc.mockResolvedValue();
    firebaseBoundary.mockUploadBytes.mockResolvedValue({});
    firebaseBoundary.mockGetDownloadURL.mockResolvedValue('https://cdn.example/avatar.png');
  });

  afterEach(() => {
    avatarInputClickSpy?.mockRestore();
    avatarInputClickSpy = undefined;
    window.createImageBitmap = originalCreateImageBitmap;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  });

  it('renders fallback runner name when auth user is missing', () => {
    renderMemberPage({ user: null });

    expect(screen.getByRole('heading', { level: 2, name: 'hello跑者' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看我的公開檔案' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '個人簡介' })).not.toBeInTheDocument();
  });

  it('renders member details and app-composed child sections for a signed-in user', async () => {
    renderMemberPage();

    expect(
      screen.getByRole('heading', { level: 2, name: 'helloAlice Runner' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alice Runner' })).toHaveAttribute(
      'src',
      'https://example.com/avatar.png',
    );
    expect(screen.getByRole('link', { name: '查看我的公開檔案' })).toHaveAttribute(
      'href',
      '/users/user-1',
    );
    expect(screen.getByRole('heading', { name: '個人簡介' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '我的活動' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await waitFor(() => {
      expect(screen.getByText('尚未參加任何活動')).toBeInTheDocument();
    });
  });

  it('submits the edited display name through the real member runtime boundary', async () => {
    const user = userEvent.setup();
    renderMemberPage();

    await user.clear(screen.getByRole('textbox', { name: '' }));
    await user.type(screen.getByRole('textbox', { name: '' }), 'New Alice');
    await user.click(screen.getByRole('button', { name: '變更名稱' }));

    await waitFor(() => {
      expect(firebaseBoundary.mockSetDoc).toHaveBeenCalledWith(
        { type: 'doc', path: 'users/user-1', id: 'user-1' },
        { name: 'New Alice', nameChangedAt: { __sentinel: 'serverTimestamp' } },
        { merge: true },
      );
    });
  });

  it('opens the avatar picker and uploads the selected file through app-composed runtime', async () => {
    const user = userEvent.setup();
    const avatarFile = new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' });
    avatarInputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    renderMemberPage();

    await user.click(screen.getByRole('img', { name: 'Alice Runner' }));
    const avatarInput = /** @type {HTMLInputElement | undefined} */ (
      /** @type {unknown} */ (avatarInputClickSpy.mock.instances.find(
        (input) => input instanceof HTMLInputElement && input.type === 'file',
      ))
    );
    expect(avatarInput).toBeInstanceOf(HTMLInputElement);
    if (!avatarInput) {
      throw new Error('Expected avatar file input to be clicked');
    }

    await user.upload(avatarInput, avatarFile);

    await waitFor(() => {
      expect(firebaseBoundary.mockUploadBytes).toHaveBeenCalledWith(
        { type: 'storageRef', fullPath: 'users/user-1/avatar.png' },
        expect.any(Blob),
        { contentType: 'image/png' },
      );
    });
    expect(firebaseBoundary.mockStorageRef).toHaveBeenCalledWith(
      {},
      'users/user-1/avatar.png',
    );
    expect(firebaseBoundary.mockGetDownloadURL).toHaveBeenCalledWith({
      type: 'storageRef',
      fullPath: 'users/user-1/avatar.png',
    });
    expect(firebaseBoundary.mockSetDoc).toHaveBeenCalledWith(
      { type: 'doc', path: 'users/user-1', id: 'user-1' },
      {
        photoURL: expect.stringMatching(/^https:\/\/cdn\.example\/avatar\.png\?v=\d+$/),
        photoUpdatedAt: { __sentinel: 'serverTimestamp' },
      },
      { merge: true },
    );
    expect(avatarInput.files).toHaveLength(0);
  });
});
