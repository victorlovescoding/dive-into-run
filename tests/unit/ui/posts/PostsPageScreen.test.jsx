// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPostSearchPost } from '../../../_helpers/posts-search-fixtures';
import {
  FAVORITE_LOGIN_TEST_COPY,
  createFavoriteLoginDialogState,
} from '../../../_helpers/favorite-login-continuation-helpers';
import {
  mockPostsSearchNavigation,
  resetPostsSearchRuntimeMocks,
  setupPostsSearchUser,
  setPostsSearchParams,
  setPostsSearchPathname,
} from '../../../_helpers/posts-search-runtime-mocks.jsx';

const authenticatedUser = {
  uid: 'viewer-posts-screen',
  name: '文章頁使用者',
  photoURL: 'https://example.test/avatar/posts-screen-viewer.png',
};

const composePromptProps = [];
const postCardProps = [];
const postCardSkeletonProps = [];
const postSearchFormProps = [];
const reportDialogProps = [];

/** @type {import('react').ComponentType<{ runtime: Record<string, unknown> }> | null} */
let PostsPageScreen = null;

mockPostsSearchNavigation();

vi.mock('@/components/ComposeModal', () => ({
  default: () => <div data-testid="compose-modal" />,
}));

vi.mock('@/components/ComposePrompt', () => ({
  default: (props) => {
    composePromptProps.push(props);
    return (
      <button
        type="button"
        data-testid="compose-prompt"
        data-avatar-src={props.userPhotoURL}
        onClick={() => props.onClick()}
      >
        分享你的跑步故事...
      </button>
    );
  },
}));

vi.mock('@/components/EditHistoryModal', () => ({
  default: () => <div role="dialog" aria-label="文章編輯紀錄" />,
}));

vi.mock('@/components/PostCard', () => ({
  default: (props) => {
    postCardProps.push(props);
    return (
      <article data-testid="post-card" data-post-id={props.post.id}>
        <h2>{props.post.title}</h2>
        <p>{props.post.content}</p>
        <button type="button" onClick={() => props.onLike(props.post.id)}>
          like {props.post.id}
        </button>
        <button type="button" onClick={() => props.onToggleFavorite(props.post.id)}>
          favorite {props.post.id}
        </button>
        <button
          type="button"
          onClick={(event) => props.onToggleMenu(props.post.id, event)}
        >
          menu {props.post.id}
        </button>
        <button type="button" onClick={() => props.onCloseMenu()}>
          close menu {props.post.id}
        </button>
        <button type="button" onClick={() => props.onEdit(props.post.id)}>
          edit {props.post.id}
        </button>
        <button type="button" onClick={() => props.onDelete(props.post.id)}>
          delete {props.post.id}
        </button>
        <button type="button" onClick={() => props.onViewArticleHistory(props.post)}>
          history {props.post.id}
        </button>
        {props.onReport && (
          <button type="button" onClick={() => props.onReport(props.post)}>
            report {props.post.id}
          </button>
        )}
      </article>
    );
  },
}));

vi.mock('@/components/PostCardSkeleton', () => ({
  default: (props) => {
    postCardSkeletonProps.push(props);
    return <div role="status">載入 {props.count} 篇文章</div>;
  },
}));

vi.mock('@/components/reports/ReportDialog', () => ({
  default: (props) => {
    reportDialogProps.push(props);
    return (
      <div role="dialog" aria-label={props.targetType === 'postComment' ? '檢舉這則留言' : '檢舉這篇文章'}>
        {props.preview}
      </div>
    );
  },
}));

vi.mock('@/ui/posts/PostSearchForm', () => ({
  default: (props) => {
    postSearchFormProps.push(props);
    return (
      <form role="search" aria-label="搜尋文章" data-testid="post-search-form">
        <input type="search" aria-label="搜尋文章" />
      </form>
    );
  },
}));

beforeAll(async () => {
  PostsPageScreen = /** @type {NonNullable<typeof PostsPageScreen>} */ (
    (await import('@/ui/posts/PostsPageScreen')).default
  );
});

afterEach(() => {
  composePromptProps.length = 0;
  postCardProps.length = 0;
  postCardSkeletonProps.length = 0;
  postSearchFormProps.length = 0;
  reportDialogProps.length = 0;
  resetPostsSearchRuntimeMocks({ pathname: '/posts' });
  vi.clearAllMocks();
});

/**
 * Creates the posts page runtime contract with test-focused defaults.
 * @param {Record<string, unknown>} overrides - Runtime values to override.
 * @returns {Record<string, unknown>} Complete runtime object for the screen.
 */
function createRuntime(overrides = {}) {
  return {
    user: authenticatedUser,
    title: '',
    content: '',
    originalTitle: '',
    originalContent: '',
    isSubmitting: false,
    editingPostId: null,
    isLoading: false,
    loadError: null,
    posts: [],
    openMenuPostId: '',
    isLoadingNext: false,
    isDraftConfirmOpen: false,
    articleHistoryPost: null,
    articleHistoryEntries: [],
    articleHistoryError: null,
    dialogState: createFavoriteLoginDialogState({ isOpen: false }),
    dialogRef: { current: null },
    bottomRef: { current: null },
    setTitle: vi.fn(),
    setContent: vi.fn(),
    handleComposeButton: vi.fn(),
    handlePressLike: vi.fn(),
    handleToggleOwnerMenu: vi.fn(),
    handleCloseOwnerMenu: vi.fn(),
    handleDeletePost: vi.fn(),
    handleSubmitPost: vi.fn(),
    handleToggleFavoritePost: vi.fn(),
    retryLoadPosts: vi.fn(),
    handleViewArticleHistory: vi.fn(),
    handleCloseArticleHistory: vi.fn(),
    confirmContinuation: vi.fn(),
    cancelContinuation: vi.fn(),
    closeContinuation: vi.fn(),
    handleRequestComposerClose: vi.fn(),
    handleSaveComposerDraft: vi.fn(),
    handleContinueEditingDraft: vi.fn(),
    handleDiscardComposerDraft: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders the posts page screen with runtime overrides.
 * @param {Record<string, unknown>} runtimeOverrides - Runtime values to override.
 * @returns {ReturnType<typeof render>} React Testing Library render result.
 */
function renderScreen(runtimeOverrides = {}) {
  if (!PostsPageScreen) {
    throw new Error('PostsPageScreen was not loaded before render.');
  }

  return render(<PostsPageScreen runtime={createRuntime(runtimeOverrides)} />);
}

describe('PostsPageScreen search entry', () => {
  it('renders the post search form before the compose prompt without the feed title', () => {
    renderScreen();

    const feed = screen.getByTestId('post-feed');
    const searchForm = screen.getByRole('search', { name: '搜尋文章' });
    const composePrompt = screen.getByTestId('compose-prompt');

    expect(screen.queryByRole('heading', { level: 1, name: '文章河道' })).not.toBeInTheDocument();
    expect(feed).toContainElement(searchForm);
    expect(searchForm).toAppearBefore(composePrompt);
    expect(within(searchForm).getByRole('searchbox', { name: '搜尋文章' })).toBeInTheDocument();
  });

  it('renders initial load errors as retryable alerts instead of the empty state', async () => {
    const user = setupPostsSearchUser();
    const retryLoadPosts = vi.fn();

    renderScreen({
      loadError: '載入文章失敗，請稍後再試',
      retryLoadPosts,
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('載入文章失敗，請稍後再試');
    expect(screen.queryByText('還沒有文章，成為第一個分享的人吧！')).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: '重試' }));

    expect(retryLoadPosts).toHaveBeenLastCalledWith();
  });

  it('keeps existing posts visible while showing a retryable load error alert', async () => {
    const user = setupPostsSearchUser();
    const retryLoadPosts = vi.fn();
    const post = createPostSearchPost({
      id: 'post-screen-load-error-existing',
      title: '載入錯誤時保留的文章',
      content: '既有文章列表不應被錯誤狀態取代。',
    });

    renderScreen({
      loadError: '載入文章失敗，請稍後再試',
      posts: [post],
      retryLoadPosts,
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('載入文章失敗，請稍後再試');
    expect(screen.getByRole('heading', { level: 2, name: '載入錯誤時保留的文章' })).toBeInTheDocument();
    expect(screen.getByTestId('post-card')).toHaveAttribute(
      'data-post-id',
      'post-screen-load-error-existing',
    );
    expect(screen.queryByText('還沒有文章，成為第一個分享的人吧！')).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: '重試' }));

    expect(retryLoadPosts).toHaveBeenLastCalledWith();
  });

  it('renders the search form without changing main feed post cards', () => {
    const posts = [
      createPostSearchPost({
        id: 'post-screen-content-hit-newer',
        title: '非搜尋排序第一篇',
        content: '原本的 reef 內容 A',
        postAt: { toMillis: () => new Date('2026-06-14T12:00:00.000Z').getTime() },
      }),
      createPostSearchPost({
        id: 'post-screen-title-hit-older',
        title: 'reef 標題文章第二篇',
        content: '原本的文章內容 B',
        postAt: { toMillis: () => new Date('2026-06-14T08:00:00.000Z').getTime() },
      }),
    ];

    setPostsSearchPathname('/posts');
    setPostsSearchParams({ q: 'reef' });
    renderScreen({ posts });

    expect(screen.getByRole('search', { name: '搜尋文章' })).toBeInTheDocument();
    expect(postSearchFormProps).toHaveLength(1);
    expect(postCardProps.map((props) => props.post)).toEqual(posts);
    postCardProps.forEach((props) => {
      expect(props).not.toHaveProperty('searchSnippet');
      expect(props).not.toHaveProperty('searchHighlightRanges');
      expect(props).not.toHaveProperty('searchMatch');
    });
    expect(screen.getAllByTestId('post-card').map((card) => card.dataset.postId)).toEqual([
      'post-screen-content-hit-newer',
      'post-screen-title-hit-older',
    ]);
    expect(screen.getByRole('heading', { level: 2, name: '非搜尋排序第一篇' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'reef 標題文章第二篇' })).toBeInTheDocument();
  });

  it('keeps the authenticated compose prompt behavior while the search form is present', async () => {
    const user = setupPostsSearchUser();
    const handleComposeButton = vi.fn();

    renderScreen({ handleComposeButton });

    const composePrompt = screen.getByTestId('compose-prompt');
    await user.click(composePrompt);

    expect(handleComposeButton).toHaveBeenLastCalledWith();
    expect(composePrompt).toHaveAttribute('data-avatar-src', authenticatedUser.photoURL);
    expect(composePromptProps.at(-1)).toMatchObject({
      userPhotoURL: authenticatedUser.photoURL,
      onClick: handleComposeButton,
    });
    expect(screen.getByRole('search', { name: '搜尋文章' })).toBeInTheDocument();
  });

  it('keeps main feed card interactions wired to the posts runtime', async () => {
    const user = setupPostsSearchUser();
    const post = createPostSearchPost({
      id: 'post-screen-interactions',
      title: '主河道互動文章',
      content: '主河道文章卡片互動維持可用。',
    });
    const handlePressLike = vi.fn();
    const handleToggleFavoritePost = vi.fn();
    const handleToggleOwnerMenu = vi.fn();
    const handleCloseOwnerMenu = vi.fn();
    const handleComposeButton = vi.fn();
    const handleDeletePost = vi.fn();
    const handleViewArticleHistory = vi.fn();

    renderScreen({
      posts: [post],
      handlePressLike,
      handleToggleFavoritePost,
      handleToggleOwnerMenu,
      handleCloseOwnerMenu,
      handleComposeButton,
      handleDeletePost,
      handleViewArticleHistory,
    });

    await user.click(screen.getByRole('button', { name: 'like post-screen-interactions' }));
    await user.click(screen.getByRole('button', { name: 'favorite post-screen-interactions' }));
    await user.click(screen.getByRole('button', { name: 'menu post-screen-interactions' }));
    await user.click(screen.getByRole('button', { name: 'close menu post-screen-interactions' }));
    await user.click(screen.getByRole('button', { name: 'edit post-screen-interactions' }));
    await user.click(screen.getByRole('button', { name: 'delete post-screen-interactions' }));
    await user.click(screen.getByRole('button', { name: 'history post-screen-interactions' }));

    expect(handlePressLike).toHaveBeenLastCalledWith(post.id);
    expect(handleToggleFavoritePost).toHaveBeenLastCalledWith(post.id);
    expect(handleToggleOwnerMenu).toHaveBeenLastCalledWith(post.id, expect.any(Object));
    expect(handleCloseOwnerMenu).toHaveBeenLastCalledWith();
    expect(handleComposeButton).toHaveBeenLastCalledWith(post.id);
    expect(handleDeletePost).toHaveBeenLastCalledWith(post.id);
    expect(handleViewArticleHistory).toHaveBeenLastCalledWith(post);
  });

  it('passes authenticated main feed post report wiring to post cards', async () => {
    const user = setupPostsSearchUser();
    const post = createPostSearchPost({
      id: 'post-screen-report-target',
      title: '主河道檢舉文章',
      content: '主河道文章卡片檢舉維持可用。',
      isAuthor: false,
    });
    const handleOpenReportDialog = vi.fn();

    renderScreen({
      posts: [post],
      handleOpenReportDialog,
    });

    await user.click(screen.getByRole('button', { name: 'report post-screen-report-target' }));

    expect(postCardProps[0].onReport).toEqual(expect.any(Function));
    expect(handleOpenReportDialog).toHaveBeenLastCalledWith({
      targetType: 'post',
      postId: post.id,
      target: post,
    });
  });

  it('does not pass main feed post report wiring for anonymous users', () => {
    const post = createPostSearchPost({
      id: 'post-screen-anonymous-report-hidden',
      isAuthor: false,
    });

    renderScreen({
      user: null,
      posts: [post],
    });

    expect(postCardProps[0].onReport).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'report post-screen-anonymous-report-hidden' })).not.toBeInTheDocument();
  });

  it('renders the post report dialog from the runtime report target', () => {
    renderScreen({
      reportDialogTarget: {
        targetType: 'post',
        postId: 'post-screen-report-dialog',
        target: {
          id: 'post-screen-report-dialog',
          title: '主河道檢舉對話框文章',
        },
      },
      handleCloseReportDialog: vi.fn(),
      handleReportResult: vi.fn(),
    });

    expect(screen.getByRole('dialog', { name: '檢舉這篇文章' })).toBeInTheDocument();
    expect(screen.getByText('主河道檢舉對話框文章')).toBeInTheDocument();
    expect(reportDialogProps.at(-1)).toMatchObject({
      target: { postId: 'post-screen-report-dialog' },
      sourcePath: '/posts',
    });
  });

  it('uses the main feed loading-more sentinel independent from search URL state', () => {
    const bottomRef = vi.fn();
    const post = createPostSearchPost({
      id: 'post-screen-main-sentinel',
      title: '主河道無限捲動文章',
    });

    setPostsSearchPathname('/posts/search');
    setPostsSearchParams({ q: 'reef' });
    renderScreen({
      posts: [post],
      isLoadingNext: true,
      bottomRef,
    });

    expect(screen.getByRole('heading', { level: 2, name: '主河道無限捲動文章' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('載入 1 篇文章');
    expect(postCardSkeletonProps).toEqual([{ count: 1 }]);
    expect(postSearchFormProps).toEqual([{}]);
    expect(bottomRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    expect(screen.queryByText('載入更多搜尋結果')).not.toBeInTheDocument();
  });
});

describe('PostsPageScreen favorite login continuation dialog', () => {
  it('renders runtime dialog state and forwards confirm, cancel, and close handlers', async () => {
    const user = setupPostsSearchUser();
    const confirmContinuation = vi.fn();
    const cancelContinuation = vi.fn();
    const closeContinuation = vi.fn();

    renderScreen({
      dialogState: createFavoriteLoginDialogState({
        contentType: 'post',
        body: FAVORITE_LOGIN_TEST_COPY.postBody,
      }),
      confirmContinuation,
      cancelContinuation,
      closeContinuation,
    });

    const dialog = screen.getByRole('dialog', { name: '登入後即可收藏' });
    expect(dialog).toHaveTextContent('登入後會自動將這篇文章加入收藏。');

    await user.click(screen.getByRole('button', { name: '使用 Google 登入' }));
    await user.click(screen.getByRole('button', { name: '稍後再說' }));
    await user.click(screen.getByRole('button', { name: '關閉收藏登入提示' }));

    expect(confirmContinuation).toHaveBeenLastCalledWith();
    expect(cancelContinuation).toHaveBeenLastCalledWith();
    expect(closeContinuation).toHaveBeenLastCalledWith();
  });
});
