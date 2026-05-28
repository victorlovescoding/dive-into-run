/* eslint-disable max-lines, jsdoc/require-jsdoc -- T004 hook tests keep the draft behavior matrix in one owned file. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import { ToastContext } from '@/runtime/providers/ToastProvider';
import usePostDetailRuntime from './usePostDetailRuntime';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  showToast: vi.fn(),
  removeToast: vi.fn(),
  getPostDetail: vi.fn(),
  getLatestComments: vi.fn(),
  hasUserLikedPost: vi.fn(),
  toggleLikePost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  validatePostInput: vi.fn(),
  getFavoritedTargetIds: vi.fn(),
  addContentFavorite: vi.fn(),
  removeContentFavorite: vi.fn(),
  setInitialComments: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock('@/runtime/client/use-cases/auth-use-cases', () => ({
  default: vi.fn(),
}));

vi.mock('@/runtime/client/use-cases/post-use-cases', () => ({
  POST_NOT_FOUND_MESSAGE: 'POST_NOT_FOUND',
  deletePost: mocks.deletePost,
  getLatestComments: mocks.getLatestComments,
  getPostDetail: mocks.getPostDetail,
  hasUserLikedPost: mocks.hasUserLikedPost,
  toggleLikePost: mocks.toggleLikePost,
  updatePost: mocks.updatePost,
  validatePostInput: mocks.validatePostInput,
}));

vi.mock('@/runtime/client/use-cases/content-favorite-use-cases', () => ({
  FAVORITE_CONTENT_TYPES: { POST: 'post' },
  addContentFavorite: mocks.addContentFavorite,
  getFavoritedTargetIds: mocks.getFavoritedTargetIds,
  removeContentFavorite: mocks.removeContentFavorite,
}));

vi.mock('@/runtime/hooks/usePostComments', () => ({
  default: vi.fn(() => ({
    comments: [],
    comment: '',
    highlightedCommentId: '',
    isLoadingNext: false,
    bottomRef: { current: null },
    handleEditComment: vi.fn(),
    handleDeleteComment: vi.fn(),
    handleSubmitComment: vi.fn(),
    handleCommentChange: vi.fn(),
    setInitialComments: mocks.setInitialComments,
  })),
}));

const USER = {
  uid: 'user-1',
  name: 'User One',
  email: 'user@example.com',
  photoURL: null,
  bio: null,
  getIdToken: vi.fn(),
};

const POST_DETAIL = {
  id: 'post-1',
  title: 'Original title',
  content: 'Original content',
  authorUid: 'user-1',
  authorName: 'User One',
  authorImgURL: '',
  commentsCount: 0,
  likesCount: 0,
  liked: false,
  isFavorited: false,
  isAuthor: true,
};

const DRAFT_KEY = 'post-composer:draft:edit:user-1:post-1';
const OTHER_DRAFT_KEY = 'post-composer:draft:edit:user-1:post-2';
const CREATE_DRAFT_KEY = 'post-composer:draft:create:user-1';

function createWrapper(user = USER) {
  return function RuntimeWrapper({ children }) {
    return (
      <AuthContext.Provider value={{ user, setUser: vi.fn(), loading: false }}>
        <ToastContext.Provider
          value={{
            toasts: [],
            showToast: mocks.showToast,
            removeToast: mocks.removeToast,
          }}
        >
          {children}
        </ToastContext.Provider>
      </AuthContext.Provider>
    );
  };
}

async function renderDetailRuntime() {
  const view = renderHook(() => usePostDetailRuntime('post-1'), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(view.result.current.post?.id).toBe('post-1'));
  return view;
}

function attachDialog(result) {
  const dialog = {
    showModal: vi.fn(),
    close: vi.fn(),
  };
  const { dialogRef } = result.current;
  dialogRef.current = dialog;
  return dialog;
}

function setDraft(key, title, content) {
  localStorage.setItem(
    key,
    JSON.stringify({
      title,
      content,
      updatedAt: new Date('2026-05-28T00:00:00.000Z').toISOString(),
    }),
  );
}

function createTestStorage() {
  const store = new Map();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      const normalizedKey = String(key);
      return store.has(normalizedKey) ? store.get(normalizedKey) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  };
}

function submitEvent() {
  return { preventDefault: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'localStorage', {
    value: createTestStorage(),
    configurable: true,
  });

  mocks.getPostDetail.mockResolvedValue({ ...POST_DETAIL });
  mocks.getLatestComments.mockResolvedValue([]);
  mocks.hasUserLikedPost.mockResolvedValue(false);
  mocks.getFavoritedTargetIds.mockResolvedValue(new Set());
  mocks.validatePostInput.mockReturnValue(null);
  mocks.updatePost.mockResolvedValue(undefined);
});

describe('usePostDetailRuntime detail edit drafts', () => {
  it('restores only the matching edit draft and keeps original post fields for dirty comparison', async () => {
    setDraft(CREATE_DRAFT_KEY, 'Create draft title', 'Create draft content');
    setDraft(OTHER_DRAFT_KEY, 'Other post title', 'Other post content');
    setDraft(DRAFT_KEY, 'Draft title', 'Draft content');

    const { result } = await renderDetailRuntime();
    const dialog = attachDialog(result);

    act(() => {
      result.current.handleOpenEdit('post-1');
    });

    expect(result.current.title).toBe('Draft title');
    expect(result.current.content).toBe('Draft content');
    expect(result.current.originalTitle).toBe('Original title');
    expect(result.current.originalContent).toBe('Original content');
    expect(mocks.showToast).toHaveBeenCalledWith('已恢復草稿');
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
  });

  it('opens draft confirmation on dirty close requests and continue editing only closes confirmation', async () => {
    const { result } = await renderDetailRuntime();
    const dialog = attachDialog(result);

    act(() => {
      result.current.handleOpenEdit('post-1');
    });
    act(() => {
      result.current.setTitle('Changed title');
    });
    act(() => {
      result.current.handleRequestComposerClose();
    });

    expect(result.current.isDraftConfirmOpen).toBe(true);
    expect(dialog.close).not.toHaveBeenCalled();

    act(() => {
      result.current.handleContinueEditingDraft();
    });

    expect(result.current.isDraftConfirmOpen).toBe(false);
    expect(result.current.title).toBe('Changed title');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it('closes unchanged edit composer requests without draft confirmation', async () => {
    const { result } = await renderDetailRuntime();
    const dialog = attachDialog(result);

    act(() => {
      result.current.handleOpenEdit('post-1');
    });
    act(() => {
      result.current.handleRequestComposerClose();
    });

    expect(result.current.isDraftConfirmOpen).toBe(false);
    expect(result.current.title).toBe('');
    expect(result.current.content).toBe('');
    expect(result.current.originalTitle).toBe('');
    expect(result.current.originalContent).toBe('');
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  it('saves the current edit draft and closes the composer', async () => {
    const { result } = await renderDetailRuntime();
    const dialog = attachDialog(result);

    act(() => {
      result.current.handleOpenEdit('post-1');
    });
    act(() => {
      result.current.setTitle('Saved draft title');
      result.current.setContent('Saved draft content');
    });
    act(() => {
      result.current.handleRequestComposerClose();
    });
    act(() => {
      result.current.handleSaveComposerDraft();
    });

    expect(JSON.parse(localStorage.getItem(DRAFT_KEY))).toMatchObject({
      title: 'Saved draft title',
      content: 'Saved draft content',
    });
    expect(result.current.isDraftConfirmOpen).toBe(false);
    expect(result.current.title).toBe('');
    expect(result.current.content).toBe('');
    expect(result.current.originalTitle).toBe('');
    expect(result.current.originalContent).toBe('');
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  it('discards only the current edit target draft and closes the composer', async () => {
    setDraft(DRAFT_KEY, 'Current draft title', 'Current draft content');
    setDraft(OTHER_DRAFT_KEY, 'Other draft title', 'Other draft content');

    const { result } = await renderDetailRuntime();
    const dialog = attachDialog(result);

    act(() => {
      result.current.handleOpenEdit('post-1');
    });
    act(() => {
      result.current.handleDiscardComposerDraft();
    });

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(OTHER_DRAFT_KEY))).toMatchObject({
      title: 'Other draft title',
      content: 'Other draft content',
    });
    expect(result.current.isDraftConfirmOpen).toBe(false);
    expect(result.current.title).toBe('');
    expect(result.current.content).toBe('');
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  it('removes only the current edit draft after a successful update', async () => {
    setDraft(DRAFT_KEY, 'Current draft title', 'Current draft content');
    setDraft(OTHER_DRAFT_KEY, 'Other draft title', 'Other draft content');

    const { result } = await renderDetailRuntime();
    const dialog = attachDialog(result);

    act(() => {
      result.current.handleOpenEdit('post-1');
    });
    act(() => {
      result.current.setTitle('Updated title');
      result.current.setContent('Updated content');
    });
    await act(async () => {
      await result.current.handleSubmitPost(submitEvent());
    });

    expect(mocks.updatePost).toHaveBeenCalledWith('post-1', {
      title: 'Updated title',
      content: 'Updated content',
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(OTHER_DRAFT_KEY))).toMatchObject({
      title: 'Other draft title',
      content: 'Other draft content',
    });
    expect(result.current.post).toMatchObject({
      title: 'Updated title',
      content: 'Updated content',
    });
    expect(result.current.title).toBe('');
    expect(result.current.content).toBe('');
    expect(mocks.showToast).toHaveBeenCalledWith('更新文章成功');
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });

  it('keeps the composer open and preserves draft storage after a failed update', async () => {
    setDraft(DRAFT_KEY, 'Current draft title', 'Current draft content');
    mocks.updatePost.mockRejectedValueOnce(new Error('update failed'));

    const { result } = await renderDetailRuntime();
    const dialog = attachDialog(result);

    act(() => {
      result.current.handleOpenEdit('post-1');
    });
    act(() => {
      result.current.setTitle('Unsaved title');
      result.current.setContent('Unsaved content');
    });
    await act(async () => {
      await result.current.handleSubmitPost(submitEvent());
    });

    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY))).toMatchObject({
      title: 'Current draft title',
      content: 'Current draft content',
    });
    expect(result.current.title).toBe('Unsaved title');
    expect(result.current.content).toBe('Unsaved content');
    expect(mocks.showToast).toHaveBeenCalledWith('更新文章失敗，請稍後再試', 'error');
    expect(dialog.close).not.toHaveBeenCalled();
  });
});
