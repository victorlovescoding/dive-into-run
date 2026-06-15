// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createPostSearchHighlightRange,
  createPostSearchMatch,
  createPostSearchPost,
} from '../../../_helpers/posts-search-fixtures';
import {
  mockPostsSearchNavigation,
  resetPostsSearchRuntimeMocks,
  setupPostsSearchUser,
} from '../../../_helpers/posts-search-runtime-mocks.jsx';

const postCardProps = [];
const composeModalProps = [];
const postSearchFormProps = [];

/** @type {import('react').ComponentType<{ runtime: Record<string, unknown> }> | null} */
let PostsSearchPageScreen = null;

mockPostsSearchNavigation();

vi.mock('@/components/ComposeModal', () => ({
  default: (props) => {
    composeModalProps.push(props);
    return (
      <div data-testid="compose-modal" data-editing={String(props.isEditing)}>
        {props.title}
      </div>
    );
  },
}));

/**
 * Returns search snippet text from the result-card prop variants under test.
 * @param {Record<string, unknown>} props Mocked PostCard props.
 * @returns {string | undefined} Search result snippet.
 */
function getSearchSnippet(props) {
  return props.searchSnippet ?? props.snippet ?? props.searchMatch?.snippet;
}

/**
 * Returns highlight range metadata from the result-card prop variants under test.
 * @param {Record<string, unknown>} props Mocked PostCard props.
 * @returns {Array<{ field: string, start: number, end: number }>} Highlight ranges.
 */
function getSearchHighlightRanges(props) {
  return (
    props.searchHighlightRanges ??
    props.highlightRanges ??
    props.searchMatch?.highlightRanges ??
    []
  );
}

/**
 * Splits text around highlight ranges for a single rendered field.
 * @param {string} text Text to render.
 * @param {Array<{ field: string, start: number, end: number }>} ranges Highlight ranges.
 * @param {'title' | 'snippet'} field Field being rendered.
 * @returns {import('react').ReactNode} Highlighted React text nodes.
 */
function renderHighlightedText(text, ranges, field) {
  const fieldRanges = ranges
    .filter((range) => range.field === field)
    .toSorted((first, second) => first.start - second.start);
  const nodes = [];
  let cursor = 0;

  fieldRanges.forEach((range) => {
    const start = Math.max(cursor, range.start);
    const end = Math.max(start, range.end);

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }
    nodes.push(
      <mark key={`${field}-${start}-${end}`} data-testid={`search-highlight-${field}`}>
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length > 0 ? nodes : text;
}

vi.mock('@/components/PostCard', () => ({
  default: (props) => {
    postCardProps.push(props);

    const snippet = getSearchSnippet(props);
    const highlightRanges = getSearchHighlightRanges(props);

    return (
      <article data-testid="post-card" data-post-id={props.post.id}>
        <h2>{renderHighlightedText(props.post.title, highlightRanges, 'title')}</h2>
        {snippet ? (
          <p data-testid="search-snippet">
            {renderHighlightedText(snippet, highlightRanges, 'snippet')}
          </p>
        ) : (
          <p>{props.post.content}</p>
        )}
      </article>
    );
  },
}));

vi.mock('@/components/PostCardSkeleton', () => ({
  default: ({ count }) => <div role="status">載入 {count} 篇文章</div>,
}));

vi.mock('@/components/ComposePrompt', () => ({
  default: () => (
    <button type="button" data-testid="compose-prompt">
      分享你的跑步故事...
    </button>
  ),
}));

vi.mock('@/ui/posts/PostSearchForm', () => ({
  default: (props) => {
    postSearchFormProps.push(props);
    return (
      <form role="search" aria-label="搜尋文章" data-testid="post-search-form">
        <input type="search" aria-label="搜尋文章" defaultValue={props.initialKeyword} />
      </form>
    );
  },
}));

beforeAll(async () => {
  PostsSearchPageScreen = /** @type {NonNullable<typeof PostsSearchPageScreen>} */ (
    (await import('@/ui/posts/PostsSearchPageScreen')).default
  );
});

afterEach(() => {
  postCardProps.length = 0;
  composeModalProps.length = 0;
  postSearchFormProps.length = 0;
  resetPostsSearchRuntimeMocks();
  vi.clearAllMocks();
});

/**
 * Creates the posts search screen runtime contract with stable defaults.
 * @param {Record<string, unknown>} overrides Runtime values to override.
 * @returns {Record<string, unknown>} Complete runtime object for the screen.
 */
function createRuntime(overrides = {}) {
  return {
    keyword: 'reef',
    searchInput: 'reef',
    setSearchInput: vi.fn(),
    results: [],
    isLoading: false,
    isLoadingNext: false,
    hasMore: false,
    errorMessage: null,
    bottomRef: { current: null },
    status: 'success',
    handleSubmitSearch: vi.fn(),
    handleRetrySearch: vi.fn(),
    title: '',
    content: '',
    originalTitle: '',
    originalContent: '',
    editingPostId: null,
    isSubmitting: false,
    isDraftConfirmOpen: false,
    dialogRef: { current: null },
    setTitle: vi.fn(),
    setContent: vi.fn(),
    handleEditPost: vi.fn(),
    handleSubmitPost: vi.fn(),
    handleRequestComposerClose: vi.fn(),
    handleSaveComposerDraft: vi.fn(),
    handleContinueEditingDraft: vi.fn(),
    handleDiscardComposerDraft: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders the posts search page screen with runtime overrides.
 * @param {Record<string, unknown>} runtimeOverrides Runtime values to override.
 * @returns {ReturnType<typeof render>} React Testing Library render result.
 */
function renderScreen(runtimeOverrides = {}) {
  if (!PostsSearchPageScreen) {
    throw new Error('PostsSearchPageScreen was not loaded before render.');
  }

  return render(<PostsSearchPageScreen runtime={createRuntime(runtimeOverrides)} />);
}

describe('PostsSearchPageScreen search entry', () => {
  it('renders the post search form without the search page title', () => {
    renderScreen();

    expect(screen.getByRole('search', { name: '搜尋文章' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: '搜尋文章' })).not.toBeInTheDocument();
  });
});

describe('PostsSearchPageScreen result highlights', () => {
  it('maps title and snippet highlight ranges into result cards', () => {
    const post = createPostSearchPost({
      id: 'post-search-highlighted-title',
      title: 'Morning reef route',
      content: 'Easy aerobic miles before breakfast.',
    });
    const snippet = 'Easy miles before the reef climb.';
    const match = createPostSearchMatch({
      post,
      snippet,
      highlightRanges: [
        createPostSearchHighlightRange({ field: 'title', start: 8, end: 12 }),
        createPostSearchHighlightRange({ field: 'snippet', start: 22, end: 26 }),
      ],
    });

    renderScreen({ results: [match] });

    expect(screen.getByRole('heading', { level: 2, name: 'Morning reef route' })).toBeInTheDocument();
    expect(screen.getByTestId('search-highlight-title')).toHaveTextContent('reef');
    expect(screen.getByTestId('search-snippet')).toHaveTextContent(snippet);
    expect(screen.getByTestId('search-highlight-snippet')).toHaveTextContent('reef');
    expect(postCardProps).toHaveLength(1);
    expect(postCardProps[0]).toMatchObject({ post });
    expect(getSearchSnippet(postCardProps[0])).toBe(snippet);
    expect(getSearchHighlightRanges(postCardProps[0])).toEqual(match.highlightRanges);
  });

  it('renders the content-hit snippet instead of the fixed article prefix', () => {
    const content =
      'Opening miles stayed deliberately quiet while the group crossed downtown. ' +
      'The turn before the reef climb finally split the pack into small groups. ' +
      'Cooldown notes came later after everyone regrouped.';
    const post = createPostSearchPost({
      id: 'post-search-content-hit',
      title: 'Harbor progression',
      content,
    });
    const keyword = 'reef';
    const snippet = 'The turn before the reef climb finally split the pack into small groups.';
    const snippetHighlightStart = snippet.indexOf(keyword);
    const match = createPostSearchMatch({
      post,
      hitType: 'content',
      firstMatchIndex: content.indexOf(keyword),
      snippet,
      highlightRanges: [
        createPostSearchHighlightRange({
          field: 'snippet',
          start: snippetHighlightStart,
          end: snippetHighlightStart + keyword.length,
        }),
      ],
    });

    renderScreen({ results: [match] });

    expect(screen.getByRole('heading', { level: 2, name: 'Harbor progression' })).toBeInTheDocument();
    expect(screen.getByTestId('search-snippet')).toHaveTextContent(snippet);
    expect(screen.queryByText(content)).not.toBeInTheDocument();
    expect(screen.getByTestId('search-highlight-snippet')).toHaveTextContent('reef');
    expect(getSearchSnippet(postCardProps[0])).toBe(snippet);
  });

  it('renders HTML-like snippet text without creating unsafe markup', () => {
    const unsafePrefix = '<img src=x onerror=alert(1)> before ';
    const unsafeSuffix = ' after <script>alert(2)</script>';
    const unsafeSnippet = `${unsafePrefix}reef${unsafeSuffix}`;
    const post = createPostSearchPost({
      id: 'post-search-unsafe-snippet',
      title: 'Security regression note',
      content: 'Plain article body without HTML payload.',
    });
    const match = createPostSearchMatch({
      post,
      hitType: 'content',
      snippet: unsafeSnippet,
      highlightRanges: [
        createPostSearchHighlightRange({
          field: 'snippet',
          start: unsafePrefix.length,
          end: unsafePrefix.length + 'reef'.length,
        }),
      ],
    });

    renderScreen({ results: [match] });

    expect(screen.getByText(unsafePrefix, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(unsafeSuffix, { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId('search-highlight-snippet')).toHaveTextContent('reef');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(getSearchSnippet(postCardProps[0])).toBe(unsafeSnippet);
  });
});

describe('PostsSearchPageScreen result interactions', () => {
  it('passes search result interaction handlers including author edit wiring', () => {
    const post = createPostSearchPost({
      id: 'post-search-interaction-wiring',
      title: 'Search interaction wiring',
    });
    const match = createPostSearchMatch({ post });
    const handleToggleOwnerMenu = vi.fn();
    const handleCloseOwnerMenu = vi.fn();
    const handleDeletePost = vi.fn();
    const handlePressLike = vi.fn();
    const handleToggleFavoritePost = vi.fn();
    const handleViewArticleHistory = vi.fn();
    const handleEditPost = vi.fn();

    renderScreen({
      results: [match],
      openMenuPostId: post.id,
      handleToggleOwnerMenu,
      handleCloseOwnerMenu,
      handleDeletePost,
      handlePressLike,
      handleToggleFavoritePost,
      handleViewArticleHistory,
      handleEditPost,
    });

    expect(postCardProps).toHaveLength(1);
    expect(postCardProps[0]).toMatchObject({
      post,
      openMenuPostId: post.id,
      onToggleMenu: handleToggleOwnerMenu,
      onCloseMenu: handleCloseOwnerMenu,
      onDelete: handleDeletePost,
      onLike: handlePressLike,
      onToggleFavorite: handleToggleFavoritePost,
      onViewArticleHistory: handleViewArticleHistory,
      onEdit: handleEditPost,
    });
  });

  it('renders the edit modal boundary without adding the compose prompt', () => {
    const handleSubmitPost = vi.fn();
    const handleRequestComposerClose = vi.fn();
    const setTitle = vi.fn();
    const setContent = vi.fn();

    renderScreen({
      title: 'Editing search result title',
      content: 'Editing search result content',
      originalTitle: 'Original search result title',
      originalContent: 'Original search result content',
      editingPostId: 'post-search-edit-modal',
      isSubmitting: true,
      isDraftConfirmOpen: true,
      setTitle,
      setContent,
      handleSubmitPost,
      handleRequestComposerClose,
    });

    expect(screen.getByTestId('compose-modal')).toHaveAttribute('data-editing', 'true');
    expect(composeModalProps).toHaveLength(1);
    expect(composeModalProps[0]).toMatchObject({
      title: 'Editing search result title',
      content: 'Editing search result content',
      originalTitle: 'Original search result title',
      originalContent: 'Original search result content',
      isEditing: true,
      isSubmitting: true,
      isDraftConfirmOpen: true,
      onTitleChange: setTitle,
      onContentChange: setContent,
      onSubmit: handleSubmitPost,
      onRequestClose: handleRequestComposerClose,
    });
    expect(screen.queryByTestId('compose-prompt')).not.toBeInTheDocument();
  });
});

describe('PostsSearchPageScreen result states', () => {
  it('renders an accessible initial loading state without empty-result copy', () => {
    renderScreen({ isLoading: true, status: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent(/搜尋中|載入/);
    expect(screen.queryByText('找不到符合「reef」的文章')).not.toBeInTheDocument();
    expect(screen.queryByTestId('post-card')).not.toBeInTheDocument();
  });

  it('renders empty result copy with a keyword-change hint', () => {
    renderScreen({ results: [], status: 'success', keyword: '海岸' });

    expect(screen.getByText('找不到符合「海岸」的文章')).toBeInTheDocument();
    expect(screen.getByText('試試其他關鍵字')).toBeInTheDocument();
    expect(screen.queryByTestId('post-card')).not.toBeInTheDocument();
  });

  it('renders initial search failures in a visible alert block while retaining the search form keyword', () => {
    renderScreen({
      status: 'error',
      keyword: 'reef',
      searchInput: 'reef',
      errorMessage: '搜尋失敗，請稍後再試',
    });

    expect(screen.getByRole('alert')).toHaveTextContent('搜尋失敗，請稍後再試');
    expect(screen.getByRole('searchbox', { name: '搜尋文章' })).toHaveValue('reef');
  });

  it('wires the retry button to the search runtime retry handler', async () => {
    const user = setupPostsSearchUser();
    const handleRetrySearch = vi.fn();

    renderScreen({
      status: 'error',
      errorMessage: '搜尋失敗，請稍後再試',
      handleRetrySearch,
    });

    await user.click(screen.getByRole('button', { name: /重試|再試一次/ }));

    expect(handleRetrySearch).toHaveBeenLastCalledWith();
  });

  it('keeps rendered results visible while showing the loading-more state', () => {
    const post = createPostSearchPost({
      id: 'post-search-loading-more',
      title: 'Loading more search result',
    });

    renderScreen({
      results: [createPostSearchMatch({ post })],
      isLoadingNext: true,
      hasMore: true,
    });

    expect(screen.getByRole('heading', { level: 2, name: 'Loading more search result' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('載入更多搜尋結果');
  });

  it('renders a terminal no-more state after the final search result page', () => {
    const post = createPostSearchPost({
      id: 'post-search-terminal-result',
      title: 'Terminal search result',
    });

    renderScreen({
      results: [createPostSearchMatch({ post })],
      hasMore: false,
    });

    expect(screen.getByRole('heading', { level: 2, name: 'Terminal search result' })).toBeInTheDocument();
    expect(screen.getByText('已顯示全部搜尋結果')).toBeInTheDocument();
  });

  it('does not render the compose prompt on the search page', () => {
    renderScreen({
      results: [
        createPostSearchMatch({
          post: createPostSearchPost({ id: 'post-search-no-compose-prompt' }),
        }),
      ],
    });

    expect(screen.queryByTestId('compose-prompt')).not.toBeInTheDocument();
    expect(screen.queryByText('分享你的跑步故事...')).not.toBeInTheDocument();
  });
});
