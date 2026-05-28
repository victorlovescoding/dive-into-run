/* eslint-disable max-lines -- Draft behavior matrix covers all target and submit paths. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getPostComposerDraftKey } from '@/repo/client/post-composer-draft-storage-repo';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import usePostsPageRuntime from './usePostsPageRuntime';

const navigationMock = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: {
    get: vi.fn(() => null),
  },
}));

const postUseCasesMock = vi.hoisted(() => ({
  createPost: vi.fn(),
  deletePost: vi.fn(),
  getLatestPosts: vi.fn(),
  getMorePosts: vi.fn(),
  getPostDetail: vi.fn(),
  hasUserLikedPosts: vi.fn(),
  toggleLikePost: vi.fn(),
  updatePost: vi.fn(),
  validatePostInput: vi.fn(),
}));

const favoriteUseCasesMock = vi.hoisted(() => ({
  addContentFavorite: vi.fn(),
  getFavoritedTargetIds: vi.fn(),
  removeContentFavorite: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: navigationMock.replace,
  }),
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock('@/runtime/client/use-cases/post-use-cases', () => ({
  createPost: postUseCasesMock.createPost,
  deletePost: postUseCasesMock.deletePost,
  getLatestPosts: postUseCasesMock.getLatestPosts,
  getMorePosts: postUseCasesMock.getMorePosts,
  getPostDetail: postUseCasesMock.getPostDetail,
  hasUserLikedPosts: postUseCasesMock.hasUserLikedPosts,
  toggleLikePost: postUseCasesMock.toggleLikePost,
  updatePost: postUseCasesMock.updatePost,
  validatePostInput: postUseCasesMock.validatePostInput,
}));

vi.mock('@/runtime/client/use-cases/content-favorite-use-cases', () => ({
  FAVORITE_CONTENT_TYPES: {
    POST: 'post',
  },
  addContentFavorite: favoriteUseCasesMock.addContentFavorite,
  getFavoritedTargetIds: favoriteUseCasesMock.getFavoritedTargetIds,
  removeContentFavorite: favoriteUseCasesMock.removeContentFavorite,
}));

vi.mock('@/runtime/client/use-cases/auth-use-cases', () => ({
  default: vi.fn(() => () => {}),
}));

const signedInUser = {
  uid: 'user-1',
  name: 'Runner',
  email: 'runner@example.com',
  photoURL: null,
  bio: null,
  getIdToken: vi.fn(),
};

const postA = {
  id: 'post-a',
  title: 'Original A',
  content: 'Body A',
  authorUid: 'user-1',
  likesCount: 0,
  commentsCount: 0,
};

const postB = {
  id: 'post-b',
  title: 'Original B',
  content: 'Body B',
  authorUid: 'user-1',
  likesCount: 0,
  commentsCount: 0,
};

/**
 * 取得測試用 draft key，測試資料固定帶 uid 所以 null 代表 setup 錯誤。
 * @param {{ uid: string, postId?: string | null }} params - Draft target。
 * @returns {string} localStorage key。
 */
function requireDraftKey(params) {
  const key = getPostComposerDraftKey(params);
  if (!key) throw new Error('missing draft key');
  return key;
}

/**
 * 建立測試用 in-memory localStorage double。
 * @returns {Storage} Storage-compatible double。
 */
function createMemoryStorage() {
  const values = new Map();
  return /** @type {Storage} */ ({
    get length() {
      return values.size;
    },
    clear: vi.fn(() => {
      values.clear();
    }),
    getItem: vi.fn((key) => values.get(String(key)) ?? null),
    key: vi.fn((index) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key) => {
      values.delete(String(key));
    }),
    setItem: vi.fn((key, value) => {
      values.set(String(key), String(value));
    }),
  });
}

/**
 * 寫入一筆 localStorage draft。
 * @param {{ uid: string, postId?: string | null, title: string, content: string }} params - Draft data。
 * @returns {string} 寫入的 key。
 */
function storeDraft({ uid, postId = null, title, content }) {
  const key = requireDraftKey({ uid, postId });
  window.localStorage.setItem(
    key,
    JSON.stringify({
      title,
      content,
      updatedAt: new Date().toISOString(),
    }),
  );
  return key;
}

/**
 * 建立 hook 測試 wrapper。
 * @param {object} params - Wrapper params。
 * @param {typeof signedInUser | null} params.user - Auth user。
 * @param {(message: string, type?: 'success' | 'error' | 'info') => void} params.showToast - Toast spy。
 * @returns {import('react').ComponentType<object>} Wrapper。
 */
function createWrapper({ user, showToast }) {
  return function RuntimeWrapper({ children }) {
    return (
      <AuthContext.Provider value={{ user, setUser: vi.fn(), loading: false }}>
        <ToastContext.Provider value={{ toasts: [], showToast, removeToast: vi.fn() }}>
          {children}
        </ToastContext.Provider>
      </AuthContext.Provider>
    );
  };
}

/**
 * Render posts runtime hook and wait for initial feed load.
 * @param {object} [params] - Render options。
 * @param {typeof signedInUser | null} [params.user] - Auth user。
 * @param {Array<object>} [params.posts] - Initial posts。
 * @param {(message: string, type?: 'success' | 'error' | 'info') => void} [params.showToast] - Toast spy。
 * @returns {Promise<import('@testing-library/react').RenderHookResult<ReturnType<typeof usePostsPageRuntime>, unknown>>} Hook result。
 */
async function renderRuntime({
  user = signedInUser,
  posts = [postA, postB],
  showToast = vi.fn(),
} = {}) {
  postUseCasesMock.getLatestPosts.mockResolvedValue(posts);
  postUseCasesMock.hasUserLikedPosts.mockResolvedValue(new Set());
  postUseCasesMock.getMorePosts.mockResolvedValue([]);
  favoriteUseCasesMock.getFavoritedTargetIds.mockResolvedValue(new Set());
  postUseCasesMock.validatePostInput.mockReturnValue(null);

  const view = renderHook(() => usePostsPageRuntime(), {
    wrapper: createWrapper({ user, showToast }),
  });

  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
}

/**
 * Attach a minimal dialog ref double to the view.
 * @param {import('@testing-library/react').RenderHookResult<ReturnType<typeof usePostsPageRuntime>, unknown>} view - Hook result。
 * @returns {{ showModal: ReturnType<typeof vi.fn>, close: ReturnType<typeof vi.fn> }} Dialog double。
 */
function attachDialog(view) {
  const dialog = {
    showModal: vi.fn(),
    close: vi.fn(),
  };
  const { dialogRef } = view.result.current;
  dialogRef.current = dialog;
  return dialog;
}

describe('usePostsPageRuntime composer draft flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = createMemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    });
    window.scrollTo = vi.fn();
    navigationMock.searchParams.get.mockReturnValue(null);
  });

  test('restores only the create draft when opening the create composer', async () => {
    const showToast = vi.fn();
    storeDraft({
      uid: signedInUser.uid,
      title: 'Create draft title',
      content: 'Create draft body',
    });
    storeDraft({
      uid: signedInUser.uid,
      postId: postA.id,
      title: 'Wrong edit title',
      content: 'Wrong edit body',
    });
    const view = await renderRuntime({ showToast });
    const dialog = attachDialog(view);

    act(() => {
      view.result.current.handleComposeButton();
    });

    expect(view.result.current.title).toBe('Create draft title');
    expect(view.result.current.content).toBe('Create draft body');
    expect(view.result.current.originalTitle).toBe('');
    expect(view.result.current.originalContent).toBe('');
    expect(view.result.current.editingPostId).toBeNull();
    expect(showToast).toHaveBeenCalledWith('已恢復草稿');
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
  });

  test('restores only the matching edit draft while preserving original edit content', async () => {
    const showToast = vi.fn();
    storeDraft({
      uid: signedInUser.uid,
      postId: postA.id,
      title: 'Post A draft title',
      content: 'Post A draft body',
    });
    storeDraft({
      uid: signedInUser.uid,
      postId: postB.id,
      title: 'Post B draft title',
      content: 'Post B draft body',
    });
    storeDraft({
      uid: signedInUser.uid,
      title: 'Wrong create title',
      content: 'Wrong create body',
    });
    const view = await renderRuntime({ showToast });
    attachDialog(view);

    act(() => {
      view.result.current.handleComposeButton(postA.id);
    });

    expect(view.result.current.title).toBe('Post A draft title');
    expect(view.result.current.content).toBe('Post A draft body');
    expect(view.result.current.originalTitle).toBe(postA.title);
    expect(view.result.current.originalContent).toBe(postA.content);
    expect(view.result.current.editingPostId).toBe(postA.id);
    expect(showToast).toHaveBeenCalledWith('已恢復草稿');

    act(() => {
      view.result.current.handleRequestComposerClose();
    });

    expect(view.result.current.isDraftConfirmOpen).toBe(true);
  });

  test('opens draft confirmation for dirty create close requests', async () => {
    const view = await renderRuntime();
    const dialog = attachDialog(view);

    act(() => {
      view.result.current.handleComposeButton();
    });

    act(() => {
      view.result.current.setTitle(' Unsaved title ');
    });

    act(() => {
      view.result.current.handleRequestComposerClose();
    });

    expect(view.result.current.isDraftConfirmOpen).toBe(true);
    expect(dialog.close).not.toHaveBeenCalled();
  });

  test('closes clean create composer requests without draft confirmation', async () => {
    const view = await renderRuntime();
    const dialog = attachDialog(view);

    act(() => {
      view.result.current.handleComposeButton();
    });

    act(() => {
      view.result.current.handleRequestComposerClose();
    });

    expect(view.result.current.isDraftConfirmOpen).toBe(false);
    expect(view.result.current.title).toBe('');
    expect(view.result.current.content).toBe('');
    expect(view.result.current.originalTitle).toBe('');
    expect(view.result.current.originalContent).toBe('');
    expect(view.result.current.editingPostId).toBeNull();
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  test('closes unchanged edit composer requests without draft confirmation', async () => {
    const view = await renderRuntime();
    const dialog = attachDialog(view);

    act(() => {
      view.result.current.handleComposeButton(postA.id);
    });

    act(() => {
      view.result.current.handleRequestComposerClose();
    });

    expect(view.result.current.isDraftConfirmOpen).toBe(false);
    expect(view.result.current.title).toBe('');
    expect(view.result.current.content).toBe('');
    expect(view.result.current.originalTitle).toBe('');
    expect(view.result.current.originalContent).toBe('');
    expect(view.result.current.editingPostId).toBeNull();
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  test('saves the current create draft target and closes the composer', async () => {
    const view = await renderRuntime();
    const dialog = attachDialog(view);
    const createKey = requireDraftKey({ uid: signedInUser.uid, postId: null });

    act(() => {
      view.result.current.handleComposeButton();
    });

    act(() => {
      view.result.current.setTitle('Saved title');
      view.result.current.setContent('Saved body');
    });

    act(() => {
      view.result.current.handleRequestComposerClose();
    });

    await act(async () => {
      view.result.current.handleSaveComposerDraft();
    });

    expect(JSON.parse(window.localStorage.getItem(createKey))).toMatchObject({
      title: 'Saved title',
      content: 'Saved body',
    });
    expect(view.result.current.isDraftConfirmOpen).toBe(false);
    expect(view.result.current.title).toBe('');
    expect(view.result.current.content).toBe('');
    expect(view.result.current.editingPostId).toBeNull();
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  test('continues editing without changing draft storage', async () => {
    const view = await renderRuntime();
    const dialog = attachDialog(view);
    const createKey = storeDraft({
      uid: signedInUser.uid,
      title: 'Existing title',
      content: 'Existing body',
    });
    const previousDraft = window.localStorage.getItem(createKey);

    act(() => {
      view.result.current.handleComposeButton();
    });

    act(() => {
      view.result.current.setTitle('Changed title');
    });

    act(() => {
      view.result.current.handleRequestComposerClose();
    });

    act(() => {
      view.result.current.handleContinueEditingDraft();
    });

    expect(view.result.current.isDraftConfirmOpen).toBe(false);
    expect(view.result.current.title).toBe('Changed title');
    expect(window.localStorage.getItem(createKey)).toBe(previousDraft);
    expect(dialog.close).not.toHaveBeenCalled();
  });

  test('discards only the current edit draft target and closes the composer', async () => {
    const view = await renderRuntime();
    const dialog = attachDialog(view);
    const postAKey = storeDraft({
      uid: signedInUser.uid,
      postId: postA.id,
      title: 'Post A draft',
      content: 'Post A body',
    });
    const postBKey = storeDraft({
      uid: signedInUser.uid,
      postId: postB.id,
      title: 'Post B draft',
      content: 'Post B body',
    });
    const postBDraft = window.localStorage.getItem(postBKey);

    act(() => {
      view.result.current.handleComposeButton(postA.id);
    });

    act(() => {
      view.result.current.setTitle('Changed Post A draft');
    });

    act(() => {
      view.result.current.handleRequestComposerClose();
    });

    await act(async () => {
      view.result.current.handleDiscardComposerDraft();
    });

    expect(window.localStorage.getItem(postAKey)).toBeNull();
    expect(window.localStorage.getItem(postBKey)).toBe(postBDraft);
    expect(view.result.current.title).toBe('');
    expect(view.result.current.content).toBe('');
    expect(view.result.current.editingPostId).toBeNull();
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  test('removes only the create draft after a successful create submit', async () => {
    const showToast = vi.fn();
    const view = await renderRuntime({ showToast });
    const dialog = attachDialog(view);
    const createKey = storeDraft({
      uid: signedInUser.uid,
      title: 'Create draft',
      content: 'Create draft body',
    });
    const editKey = storeDraft({
      uid: signedInUser.uid,
      postId: postA.id,
      title: 'Edit draft',
      content: 'Edit draft body',
    });
    const editDraft = window.localStorage.getItem(editKey);
    postUseCasesMock.createPost.mockResolvedValue({ id: 'created-post' });
    postUseCasesMock.getPostDetail.mockResolvedValue({
      id: 'created-post',
      title: 'Created title',
      content: 'Created body',
      authorUid: signedInUser.uid,
    });

    act(() => {
      view.result.current.handleComposeButton();
      view.result.current.setTitle('Created title');
      view.result.current.setContent('Created body');
    });

    await act(async () => {
      await view.result.current.handleSubmitPost({ preventDefault: vi.fn() });
    });

    expect(window.localStorage.getItem(createKey)).toBeNull();
    expect(window.localStorage.getItem(editKey)).toBe(editDraft);
    expect(view.result.current.posts[0]).toMatchObject({
      id: 'created-post',
      title: 'Created title',
      content: 'Created body',
    });
    expect(view.result.current.title).toBe('');
    expect(view.result.current.content).toBe('');
    expect(showToast).toHaveBeenCalledWith('發佈文章成功');
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  test('removes only the matching edit draft after a successful update submit', async () => {
    const showToast = vi.fn();
    const view = await renderRuntime({ showToast });
    const dialog = attachDialog(view);
    const createKey = storeDraft({
      uid: signedInUser.uid,
      title: 'Create draft',
      content: 'Create draft body',
    });
    const editKey = storeDraft({
      uid: signedInUser.uid,
      postId: postA.id,
      title: 'Edit draft',
      content: 'Edit draft body',
    });
    const createDraft = window.localStorage.getItem(createKey);
    postUseCasesMock.updatePost.mockResolvedValue(undefined);

    act(() => {
      view.result.current.handleComposeButton(postA.id);
      view.result.current.setTitle(' Updated A ');
      view.result.current.setContent(' Updated body ');
    });

    await act(async () => {
      await view.result.current.handleSubmitPost({ preventDefault: vi.fn() });
    });

    expect(window.localStorage.getItem(editKey)).toBeNull();
    expect(window.localStorage.getItem(createKey)).toBe(createDraft);
    expect(view.result.current.posts.find((post) => post.id === postA.id)).toMatchObject({
      title: 'Updated A',
      content: 'Updated body',
    });
    expect(showToast).toHaveBeenCalledWith('更新文章成功');
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  test('keeps the create composer open and preserves draft storage after failed create submit', async () => {
    const showToast = vi.fn();
    const view = await renderRuntime({ showToast });
    const dialog = attachDialog(view);
    const createKey = storeDraft({
      uid: signedInUser.uid,
      title: 'Existing create draft',
      content: 'Existing create body',
    });
    const previousDraft = window.localStorage.getItem(createKey);
    postUseCasesMock.createPost.mockRejectedValue(new Error('create failed'));

    act(() => {
      view.result.current.handleComposeButton();
      view.result.current.setTitle('Attempted create title');
      view.result.current.setContent('Attempted create body');
    });

    await act(async () => {
      await view.result.current.handleSubmitPost({ preventDefault: vi.fn() });
    });

    expect(view.result.current.title).toBe('Attempted create title');
    expect(view.result.current.content).toBe('Attempted create body');
    expect(window.localStorage.getItem(createKey)).toBe(previousDraft);
    expect(showToast).toHaveBeenCalledWith('發佈文章失敗，請稍後再試', 'error');
    expect(dialog.close).not.toHaveBeenCalled();
  });

  test('keeps the edit composer open and preserves draft storage after failed update submit', async () => {
    const showToast = vi.fn();
    const view = await renderRuntime({ showToast });
    const dialog = attachDialog(view);
    const editKey = storeDraft({
      uid: signedInUser.uid,
      postId: postA.id,
      title: 'Existing edit draft',
      content: 'Existing edit body',
    });
    const previousDraft = window.localStorage.getItem(editKey);
    postUseCasesMock.updatePost.mockRejectedValue(new Error('update failed'));

    act(() => {
      view.result.current.handleComposeButton(postA.id);
      view.result.current.setTitle('Attempted update title');
      view.result.current.setContent('Attempted update body');
    });

    await act(async () => {
      await view.result.current.handleSubmitPost({ preventDefault: vi.fn() });
    });

    expect(view.result.current.title).toBe('Attempted update title');
    expect(view.result.current.content).toBe('Attempted update body');
    expect(window.localStorage.getItem(editKey)).toBe(previousDraft);
    expect(showToast).toHaveBeenCalledWith('更新文章失敗，請稍後再試', 'error');
    expect(dialog.close).not.toHaveBeenCalled();
  });
});
