// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPostsSearchRouterMocks,
  mockPostsSearchNavigation,
  setupPostsSearchUser,
} from '../../../_helpers/posts-search-runtime-mocks.jsx';
import {
  POST_SEARCH_CHINESE_KEYWORD,
  POST_SEARCH_KEYWORD,
} from '../../../_helpers/posts-search-fixtures.js';

const postSearchFormModulePath = '../../../../src/ui/posts/PostSearchForm.jsx';
const inlinePromptText = '請輸入搜尋關鍵字';
const searchTextboxName = '搜尋文章';
const searchButtonName = '搜尋';
const navigation = mockPostsSearchNavigation();

/**
 * Loads the future PostSearchForm module without a static import so lint/type
 * checks stay clean before the production component exists.
 * @returns {Promise<import('react').ComponentType<Record<string, never>>>}
 * PostSearchForm component.
 */
async function loadPostSearchForm() {
  const importedModule = await import(postSearchFormModulePath);
  return importedModule.default;
}

/**
 * Renders the future post search form with shared router mocks.
 * @returns {Promise<{ user: ReturnType<typeof setupPostsSearchUser> }>}
 * Render helpers.
 */
async function renderPostSearchForm() {
  const PostSearchForm = await loadPostSearchForm();
  const user = setupPostsSearchUser();

  render(<PostSearchForm />);

  return { user };
}

beforeEach(() => {
  navigation.reset({ pathname: '/posts' });
});

describe('PostSearchForm submit behavior', () => {
  it('keeps accessible search names without rendering the redundant visible label text', async () => {
    await renderPostSearchForm();

    expect(screen.getByRole('search', { name: searchTextboxName })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: searchTextboxName })).toBeInTheDocument();
    expect(screen.queryByText(searchTextboxName)).not.toBeInTheDocument();
  });

  it('keeps the current page and prompts for a keyword when submitted blank', async () => {
    const { user } = await renderPostSearchForm();

    await user.click(screen.getByRole('button', { name: searchButtonName }));

    expect(getPostsSearchRouterMocks().push).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(inlinePromptText);
  });

  it('navigates to the search route when a keyword is submitted with Enter', async () => {
    const { user } = await renderPostSearchForm();

    await user.type(screen.getByRole('textbox', { name: searchTextboxName }), POST_SEARCH_KEYWORD);
    await user.keyboard('{Enter}');

    expect(getPostsSearchRouterMocks().push).toHaveBeenCalledWith(
      `/posts/search?q=${encodeURIComponent(POST_SEARCH_KEYWORD)}`,
    );
  });

  it('navigates to the search route when a keyword is submitted with the button', async () => {
    const { user } = await renderPostSearchForm();

    await user.type(screen.getByRole('textbox', { name: searchTextboxName }), POST_SEARCH_KEYWORD);
    await user.click(screen.getByRole('button', { name: searchButtonName }));

    expect(getPostsSearchRouterMocks().push).toHaveBeenCalledWith(
      `/posts/search?q=${encodeURIComponent(POST_SEARCH_KEYWORD)}`,
    );
  });

  it('trims leading and trailing whitespace before navigating', async () => {
    const { user } = await renderPostSearchForm();

    await user.type(
      screen.getByRole('textbox', { name: searchTextboxName }),
      `  ${POST_SEARCH_KEYWORD}  `,
    );
    await user.click(screen.getByRole('button', { name: searchButtonName }));

    expect(getPostsSearchRouterMocks().push).toHaveBeenCalledWith(
      `/posts/search?q=${encodeURIComponent(POST_SEARCH_KEYWORD)}`,
    );
  });

  it('URL-encodes non-ASCII and spaced keywords before navigating', async () => {
    const { user } = await renderPostSearchForm();
    const keyword = `${POST_SEARCH_CHINESE_KEYWORD} ${POST_SEARCH_KEYWORD}`;

    await user.type(screen.getByRole('textbox', { name: searchTextboxName }), keyword);
    await user.click(screen.getByRole('button', { name: searchButtonName }));

    expect(getPostsSearchRouterMocks().push).toHaveBeenCalledWith(
      `/posts/search?q=${encodeURIComponent(keyword)}`,
    );
  });
});
