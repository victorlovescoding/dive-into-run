import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PostsPageScreen from '@/ui/posts/PostsPageScreen';

vi.mock('next/link', () => ({
  default({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('next/image', () => ({
  default({ alt = '', ...props }) {
    return <img alt={alt} {...props} />;
  },
}));

const editedPost = {
  id: 'post-1',
  title: 'Current title',
  content: 'Current content',
  authorUid: 'author-1',
  authorName: 'Runner',
  likesCount: 2,
  commentsCount: 1,
  liked: false,
  isFavorited: false,
  isAuthor: false,
  isEdited: true,
};

/**
 * Build the minimum PostsPageScreen runtime for article history UI tests.
 * @param {Partial<object>} overrides - Runtime overrides.
 * @returns {object} Screen runtime.
 */
function createRuntime(overrides = {}) {
  return {
    user: null,
    title: '',
    content: '',
    originalTitle: '',
    originalContent: '',
    isSubmitting: false,
    editingPostId: null,
    isLoading: false,
    posts: [editedPost],
    openMenuPostId: '',
    isLoadingNext: false,
    isDraftConfirmOpen: false,
    articleHistoryPost: null,
    articleHistoryEntries: [],
    articleHistoryError: null,
    dialogRef: createRef(),
    bottomRef: createRef(),
    setTitle: vi.fn(),
    setContent: vi.fn(),
    handleComposeButton: vi.fn(),
    handlePressLike: vi.fn(),
    handleToggleOwnerMenu: vi.fn(),
    handleCloseOwnerMenu: vi.fn(),
    handleDeletePost: vi.fn(),
    handleSubmitPost: vi.fn((event) => event.preventDefault()),
    handleToggleFavoritePost: vi.fn(),
    handleRequestComposerClose: vi.fn(),
    handleSaveComposerDraft: vi.fn(),
    handleContinueEditingDraft: vi.fn(),
    handleDiscardComposerDraft: vi.fn(),
    handleViewArticleHistory: vi.fn(),
    handleCloseArticleHistory: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
    this.open = true;
  });
});

describe('PostsPageScreen article history wiring', () => {
  test('passes edited article affordance clicks to the runtime handler', async () => {
    const user = userEvent.setup();
    const runtime = createRuntime();

    render(<PostsPageScreen runtime={runtime} />);
    await user.click(screen.getByRole('button', { name: '查看文章編輯記錄' }));

    expect(screen.getByText('已編輯')).toBeInTheDocument();
    expect(runtime.handleViewArticleHistory).toHaveBeenCalledWith(editedPost);
  });

  test('renders article history modal with current and previous title/content', () => {
    render(
      <PostsPageScreen
        runtime={createRuntime({
          articleHistoryPost: editedPost,
          articleHistoryEntries: [
            {
              id: 'history-1',
              title: 'Previous title',
              content: 'Previous content',
            },
          ],
        })}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '編輯記錄' });

    expect(within(dialog).getByText('Current title')).toBeInTheDocument();
    expect(within(dialog).getByText('Current content')).toBeInTheDocument();
    expect(within(dialog).getByText('Previous title')).toBeInTheDocument();
    expect(within(dialog).getByText('Previous content')).toBeInTheDocument();
  });

  test('keeps article history load errors visible in the modal', () => {
    render(
      <PostsPageScreen
        runtime={createRuntime({
          articleHistoryPost: editedPost,
          articleHistoryError: '載入編輯記錄失敗',
        })}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('載入編輯記錄失敗');
    expect(screen.getByRole('dialog', { name: '編輯記錄' })).toBeInTheDocument();
  });
});
