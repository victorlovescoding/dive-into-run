// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PostCard from '@/components/PostCard';
import {
  POST_SEARCH_KEYWORD,
  createPostSearchHighlightRange,
  createPostSearchMatch,
  createPostSearchPost,
} from '../../_helpers/posts-search-fixtures';

const SearchResultPostCard =
  /** @type {import('react').ComponentType<Record<string, unknown>>} */ (PostCard);

/**
 * Builds a PostCard fixture with stable feed defaults.
 * @param {Record<string, unknown>} [overrides] Post fields to override.
 * @returns {Record<string, unknown>} Enriched post fixture.
 */
function makePost(overrides = {}) {
  return {
    ...createPostSearchPost({
      id: 'post-card-search-result',
      title: `Morning ${POST_SEARCH_KEYWORD} route`,
      content: `Easy miles before the ${POST_SEARCH_KEYWORD} climb and breakfast.`,
      likesCount: 7,
      commentsCount: 3,
    }),
    liked: false,
    isFavorited: false,
    isAuthor: false,
    ...overrides,
  };
}

/**
 * Renders PostCard through a loose prop type for component-level compatibility tests.
 * @param {Record<string, unknown>} [props] Props to pass to PostCard.
 * @returns {ReturnType<typeof render>} Render result.
 */
function renderPostCard(props = {}) {
  return render(<SearchResultPostCard post={makePost()} {...props} />);
}

/**
 * Maps a search result match to the current PostCard public props.
 * @param {ReturnType<typeof createPostSearchMatch>} match Search result match.
 * @param {Record<string, unknown>} [props] Extra PostCard props.
 * @returns {Record<string, unknown>} PostCard props.
 */
function getSearchResultPostCardProps(match, props = {}) {
  return {
    post: match.post,
    searchSnippet: match.snippet,
    searchHighlightRanges: match.highlightRanges,
    ...props,
  };
}

/**
 * Renders a search result card using PostCard's existing public prop contract.
 * @param {ReturnType<typeof createPostSearchMatch>} match Search result match.
 * @param {Record<string, unknown>} [props] Extra PostCard props.
 * @returns {ReturnType<typeof render>} Render result.
 */
function renderSearchResultPostCard(match, props = {}) {
  return renderPostCard(getSearchResultPostCardProps(match, props));
}

/**
 * Locates an element by tag name and full rendered textContent.
 * @param {string} tagName Expected tag name.
 * @param {string} text Expected rendered text.
 * @returns {HTMLElement} Matching element.
 */
function getElementByTextContent(tagName, text) {
  return screen.getByText(
    (_, element) => element?.tagName === tagName && element.textContent === text,
  );
}

describe('PostCard search result rendering', () => {
  it('renders optional highlighted title and search snippet for search result cards', () => {
    const title = `Morning ${POST_SEARCH_KEYWORD} route`;
    const snippet = `Easy miles before the ${POST_SEARCH_KEYWORD} climb.`;
    renderPostCard({
      post: makePost({
        title,
        content: 'Full feed content should not replace a supplied search snippet.',
      }),
      searchSnippet: snippet,
      searchHighlightRanges: [
        createPostSearchHighlightRange({
          field: 'title',
          start: title.indexOf(POST_SEARCH_KEYWORD),
          end: title.indexOf(POST_SEARCH_KEYWORD) + POST_SEARCH_KEYWORD.length,
        }),
        createPostSearchHighlightRange({
          field: 'snippet',
          start: snippet.indexOf(POST_SEARCH_KEYWORD),
          end: snippet.indexOf(POST_SEARCH_KEYWORD) + POST_SEARCH_KEYWORD.length,
        }),
      ],
    });

    const titleHeading = screen.getByRole('heading', { level: 2 });
    const titleHighlight = within(titleHeading).getByText(POST_SEARCH_KEYWORD);
    expect(titleHighlight.tagName).toBe('MARK');
    expect(titleHeading).toHaveTextContent(title);

    const snippetParagraph = getElementByTextContent('P', snippet);
    const snippetHighlight = within(snippetParagraph).getByText(POST_SEARCH_KEYWORD);
    expect(snippetHighlight.tagName).toBe('MARK');
    expect(snippetParagraph).toHaveTextContent(snippet);
    expect(screen.queryByText('Full feed content should not replace a supplied search snippet.')).not.toBeInTheDocument();
  });

  it('keeps default feed cards on title and content when search props are omitted', () => {
    const post = makePost({
      title: `Morning ${POST_SEARCH_KEYWORD} route`,
      content: `Easy miles before the ${POST_SEARCH_KEYWORD} climb and breakfast.`,
    });

    renderPostCard({ post });

    const titleHeading = screen.getByRole('heading', { level: 2, name: post.title });
    const contentParagraph = screen.getByText(post.content);

    expect(within(titleHeading).queryByText(POST_SEARCH_KEYWORD)).not.toBeInTheDocument();
    expect(within(contentParagraph).queryByText(POST_SEARCH_KEYWORD)).not.toBeInTheDocument();
    expect(screen.queryByText(/search/i)).not.toBeInTheDocument();
  });
});

describe('PostCard search result interactions', () => {
  it('uses the matched search result post for title and comment count navigation', () => {
    const post = makePost({
      id: 'post-card-search-navigation',
      title: 'Search result navigation target',
      commentsCount: 9,
    });
    const match = createPostSearchMatch({ post });

    renderSearchResultPostCard(match);

    const titleLink = screen.getByRole('link', { name: post.title });
    expect(titleLink).toHaveAttribute('href', `/posts/${post.id}`);

    const commentsLink = screen.getByRole('link', { name: String(post.commentsCount) });
    expect(commentsLink).toHaveAttribute('href', `/posts/${post.id}`);
  });

  it('uses the matched search result post for like and favorite callbacks', async () => {
    const user = userEvent.setup();
    const post = makePost({
      id: 'post-card-search-actions',
      likesCount: 12,
      liked: true,
      isFavorited: true,
    });
    const match = createPostSearchMatch({ post });
    const onLike = vi.fn();
    const onToggleFavorite = vi.fn();

    renderSearchResultPostCard(match, {
      onLike,
      onToggleFavorite,
    });

    const likeButton = screen.getByRole('button', { name: '按讚' });
    expect(likeButton).toHaveAttribute('aria-pressed', 'true');
    expect(likeButton).toHaveTextContent('12');

    await user.click(likeButton);
    await user.click(screen.getByRole('button', { name: '取消收藏文章' }));

    expect(onLike).toHaveBeenCalledWith(post.id);
    expect(onToggleFavorite).toHaveBeenCalledWith(post.id);
  });

  it('uses the matched search result post for owner menu and delete callbacks', async () => {
    const user = userEvent.setup();
    const post = makePost({
      id: 'post-card-search-owner-menu',
      isAuthor: true,
    });
    const match = createPostSearchMatch({ post });
    const onToggleMenu = vi.fn();
    const onCloseMenu = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const props = getSearchResultPostCardProps(match, {
      openMenuPostId: '',
      onToggleMenu,
      onCloseMenu,
      onEdit,
      onDelete,
    });

    const { rerender } = renderPostCard(props);

    await user.click(screen.getByRole('button', { name: '更多選項' }));
    expect(onToggleMenu).toHaveBeenCalledWith(post.id, expect.any(Object));

    rerender(<SearchResultPostCard {...props} openMenuPostId={post.id} />);

    await user.click(screen.getByRole('menuitem', { name: '刪除' }));

    expect(onCloseMenu).toHaveBeenCalledWith();
    expect(onDelete).toHaveBeenCalledWith(post.id);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('supports delete-only owner menus for search result cards', async () => {
    const user = userEvent.setup();
    const post = makePost({
      id: 'post-card-search-delete-only-owner-menu',
      isAuthor: true,
    });
    const match = createPostSearchMatch({ post });
    const onToggleMenu = vi.fn();
    const onCloseMenu = vi.fn();
    const onDelete = vi.fn();
    const props = getSearchResultPostCardProps(match, {
      openMenuPostId: '',
      onToggleMenu,
      onCloseMenu,
      onDelete,
    });

    const { rerender } = renderPostCard(props);

    await user.click(screen.getByRole('button', { name: '更多選項' }));
    expect(onToggleMenu).toHaveBeenCalledWith(post.id, expect.any(Object));

    rerender(<SearchResultPostCard {...props} openMenuPostId={post.id} />);

    expect(screen.queryByRole('menuitem', { name: '編輯' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: '刪除' }));

    expect(onCloseMenu).toHaveBeenCalledWith();
    expect(onDelete).toHaveBeenCalledWith(post.id);
  });

  it('uses the matched search result post for article history callbacks', async () => {
    const user = userEvent.setup();
    const post = makePost({
      id: 'post-card-search-history',
      isEdited: true,
    });
    const match = createPostSearchMatch({ post });
    const onViewArticleHistory = vi.fn();

    renderSearchResultPostCard(match, {
      onViewArticleHistory,
    });

    await user.click(screen.getByRole('button', { name: '查看文章編輯記錄' }));

    expect(onViewArticleHistory).toHaveBeenCalledWith(post);
  });
});
