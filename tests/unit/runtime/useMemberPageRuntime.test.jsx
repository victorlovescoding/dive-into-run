import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const TOAST_PROVIDER_MODULE = vi.hoisted(() => '@/runtime/providers/ToastProvider');

const { authState, memberPageBoundaryMocks, mockShowToast, mockUseContext } =
  vi.hoisted(() => ({
    authState: {
      current: { user: null, loading: false, setUser() {} },
    },
    memberPageBoundaryMocks: {
    mockDoc: vi.fn((_db, ...segments) => ({
      type: 'doc',
      path: segments.join('/'),
      id: String(segments.at(-1) ?? ''),
    })),
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockOnSnapshot: vi.fn(),
    mockServerTimestamp: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
    mockStorageRef: vi.fn((_storage, path) => ({ type: 'storageRef', fullPath: path })),
    mockUploadBytes: vi.fn(),
      mockGetDownloadURL: vi.fn(),
    },
    mockShowToast: vi.fn(),
    mockUseContext: vi.fn(),
  }));

vi.mock('react', async (importOriginal) => {
  const actual = /** @type {typeof import('react')} */ (await importOriginal());
  mockUseContext.mockImplementation(() => authState.current);
  return {
    ...actual,
    useContext: mockUseContext,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: memberPageBoundaryMocks.mockDoc,
  getDoc: memberPageBoundaryMocks.mockGetDoc,
  setDoc: memberPageBoundaryMocks.mockSetDoc,
  onSnapshot: memberPageBoundaryMocks.mockOnSnapshot,
  serverTimestamp: memberPageBoundaryMocks.mockServerTimestamp,
}));

vi.mock('firebase/storage', () => ({
  ref: memberPageBoundaryMocks.mockStorageRef,
  uploadBytes: memberPageBoundaryMocks.mockUploadBytes,
  getDownloadURL: memberPageBoundaryMocks.mockGetDownloadURL,
}));

vi.mock('@/config/client/firebase-client', () => ({ db: 'mock-db', storage: 'mock-storage' }));
vi.mock(TOAST_PROVIDER_MODULE, () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

/**
 * @typedef {object} TestUser
 * @property {string} uid - 使用者 UID。
 * @property {string | null} name - 顯示名稱。
 * @property {string | null} email - 電子郵件。
 * @property {string | null} photoURL - 大頭貼網址。
 * @property {string | null} bio - 自我介紹。
 * @property {() => Promise<string>} getIdToken - 取得 Firebase ID token。
 */

/**
 * @typedef {object} RenderOptions
 * @property {TestUser | null} [user] - AuthContext user。
 * @property {boolean} [loading] - AuthContext loading。
 */

/** @type {typeof window.createImageBitmap | undefined} */
let originalCreateImageBitmap;
let originalGetContext;
let originalToBlob;

/**
 * 動態載入 hook，避免在 mock 註冊前提早取用模組。
 * @returns {Promise<typeof import('@/runtime/hooks/useMemberPageRuntime').default>} hook。
 */
async function loadHook() {
  return (await import('@/runtime/hooks/useMemberPageRuntime')).default;
}

/**
 * 建立測試用 Auth user。
 * @param {Partial<TestUser>} [overrides] - 欄位覆寫。
 * @returns {TestUser} 使用者 fixture。
 */
function createUser(overrides = {}) {
  return {
    uid: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    photoURL: 'https://example.com/original.png',
    bio: null,
    getIdToken: vi.fn(async () => 'token-1'),
    ...overrides,
  };
}

/**
 * 建立測試用檔案。
 * @returns {File} PNG avatar 檔案。
 */
function createAvatarFile() {
  return new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' });
}

/**
 * 建立 file input change event。
 * @param {File} file - 使用者選取的檔案。
 * @returns {{ target: { files: File[], value: string } }} 事件物件。
 */
function createFileChangeEvent(file) {
  return { target: { files: [file], value: 'chosen-file' } };
}

/**
 * 建立 form submit event。
 * @returns {{ preventDefault: import('vitest').Mock }} submit event。
 */
function createSubmitEvent() {
  return { preventDefault: vi.fn() };
}

/**
 * 渲染 hook，並透過 mocked auth / toast 依賴提供狀態。
 * @param {RenderOptions} [options] - AuthContext 覆寫。
 * @returns {Promise<object>} render 結果與 showToast mock。
 */
async function renderMemberPageRuntime(options = {}) {
  authState.current = {
    user: options.user === undefined ? createUser() : options.user,
    loading: options.loading ?? false,
    setUser() {},
  };
  const useMemberPageRuntime = await loadHook();

  return {
    ...renderHook(() => useMemberPageRuntime()),
    showToast: mockShowToast,
  };
}

describe('useMemberPageRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockReset();
    originalCreateImageBitmap = window.createImageBitmap;
    /** @type {any} */ (window).createImageBitmap = vi.fn().mockResolvedValue({ width: 200, height: 300 });
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    /** @type {any} */ (HTMLCanvasElement.prototype).getContext = vi.fn(() => ({ drawImage: vi.fn() }));
    originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function stubToBlob(callback) {
      callback(new Blob(['compressed-avatar'], { type: 'image/png' }));
    };
    memberPageBoundaryMocks.mockUploadBytes.mockResolvedValue({});
    memberPageBoundaryMocks.mockGetDownloadURL.mockResolvedValue('https://cdn.example/avatar.png');
  });

  afterEach(() => {
    /** @type {any} */ (window).createImageBitmap = originalCreateImageBitmap;
    /** @type {any} */ (HTMLCanvasElement.prototype).getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  });

  it('prefills current name and updates Firestore with trimmed name on submit', async () => {
    const { result, showToast } = await renderMemberPageRuntime();

    await waitFor(() => expect(result.current.name).toBe('Alice'));

    act(() => {
      result.current.onNameChange({ target: { value: '  New Alice  ' } });
    });

    const submitEvent = createSubmitEvent();
    await act(async () => {
      await result.current.onSubmitNewName(submitEvent);
    });

    expect(submitEvent.preventDefault).toHaveBeenCalledOnce();
    expect(memberPageBoundaryMocks.mockSetDoc).toHaveBeenLastCalledWith(
      { type: 'doc', path: 'users/user-1', id: 'user-1' },
      { name: 'New Alice', nameChangedAt: { __sentinel: 'serverTimestamp' } },
      { merge: true },
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it('uploads avatar through storage and persists the new photo URL', async () => {
    const { result, showToast } = await renderMemberPageRuntime();
    const clickMock = vi.fn();
    result.current.inputFileRef.current = { click: clickMock };

    act(() => {
      result.current.triggerFilePicker();
    });
    expect(clickMock).toHaveBeenCalledOnce();

    const changeEvent = createFileChangeEvent(createAvatarFile());
    await act(async () => {
      await result.current.onAvatarFileChange(changeEvent);
    });

    expect(memberPageBoundaryMocks.mockStorageRef).toHaveBeenCalledWith(
      'mock-storage',
      'users/user-1/avatar.png',
    );
    expect(memberPageBoundaryMocks.mockUploadBytes).toHaveBeenCalledWith(
      { type: 'storageRef', fullPath: 'users/user-1/avatar.png' },
      expect.any(Blob),
      { contentType: 'image/png' },
    );
    expect(memberPageBoundaryMocks.mockGetDownloadURL).toHaveBeenCalledWith({
      type: 'storageRef',
      fullPath: 'users/user-1/avatar.png',
    });
    expect(memberPageBoundaryMocks.mockSetDoc).toHaveBeenLastCalledWith(
      { type: 'doc', path: 'users/user-1', id: 'user-1' },
      expect.objectContaining({
        photoURL: expect.stringMatching(/^https:\/\/cdn\.example\/avatar\.png\?v=\d+$/),
        photoUpdatedAt: { __sentinel: 'serverTimestamp' },
      }),
      { merge: true },
    );
    expect(changeEvent.target.value).toBe('');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('shows toast and clears file input when avatar upload fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    memberPageBoundaryMocks.mockUploadBytes.mockRejectedValueOnce(new Error('upload failed'));
    const { result, showToast } = await renderMemberPageRuntime();
    const changeEvent = createFileChangeEvent(createAvatarFile());

    await act(async () => {
      await result.current.onAvatarFileChange(changeEvent);
    });

    expect(memberPageBoundaryMocks.mockSetDoc).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenLastCalledWith('上傳大頭貼失敗，請稍後再試', 'error');
    expect(changeEvent.target.value).toBe('');
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('skips file picker, avatar upload, and name submit when auth is missing', async () => {
    const { result, showToast } = await renderMemberPageRuntime({ user: null });
    const clickMock = vi.fn();
    result.current.inputFileRef.current = { click: clickMock };

    act(() => {
      result.current.onNameChange({ target: { value: 'Ghost' } });
      result.current.triggerFilePicker();
    });

    const submitEvent = createSubmitEvent();
    const changeEvent = createFileChangeEvent(createAvatarFile());
    await act(async () => {
      await result.current.onAvatarFileChange(changeEvent);
      await result.current.onSubmitNewName(submitEvent);
    });

    expect(clickMock).not.toHaveBeenCalled();
    expect(submitEvent.preventDefault).toHaveBeenCalledOnce();
    expect(memberPageBoundaryMocks.mockUploadBytes).not.toHaveBeenCalled();
    expect(memberPageBoundaryMocks.mockSetDoc).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
