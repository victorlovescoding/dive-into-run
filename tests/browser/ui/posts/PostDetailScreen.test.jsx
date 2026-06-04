import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PostDetailScreen from '@/ui/posts/PostDetailScreen';

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
  postAt: new Date(),
  likesCount: 2,
  commentsCount: 1,
  liked: false,
  isFavorited: false,
  isAuthor: false,
  isEdited: true,
};

const editedComment = {
  id: 'comment-1',
  authorUid: 'commenter-1',
  authorName: 'Commenter',
  content: 'Current comment',
  createdAt: null,
  updatedAt: null,
  isEdited: true,
};

/**
 * Build the minimum PostDetailScreen runtime for article/comment history UI tests.
 * @param {Partial<object>} overrides - Runtime overrides.
 * @returns {object} Screen runtime.
 */
function createRuntime(overrides = {}) {
  return {
    user: null,
    post: editedPost,
    loading: false,
    error: null,
    shareUrl: 'http://localhost/posts/post-1',
    comments: [editedComment],
    highlightedCommentId: null,
    comment: '',
    editingComment: null,
    historyComment: null,
    historyEntries: [],
    historyError: null,
    title: '',
    content: '',
    originalTitle: '',
    originalContent: '',
    isSubmitting: false,
    isDraftConfirmOpen: false,
    isLoadingNext: false,
    openMenuPostId: '',
    articleHistoryPost: null,
    articleHistoryEntries: [],
    articleHistoryError: null,
    dialogRef: createRef(),
    bottomRef: createRef(),
    setTitle: vi.fn(),
    setContent: vi.fn(),
    handleToggleMenu: vi.fn(),
    handleCloseMenu: vi.fn(),
    handleOpenEdit: vi.fn(),
    handleRequestComposerClose: vi.fn(),
    handleSaveComposerDraft: vi.fn(),
    handleContinueEditingDraft: vi.fn(),
    handleDiscardComposerDraft: vi.fn(),
    handleSubmitPost: vi.fn((event) => event.preventDefault()),
    handleDeletePost: vi.fn(),
    handleToggleLike: vi.fn(),
    handleToggleFavoritePost: vi.fn(),
    handleEditComment: vi.fn(),
    handleEditSave: vi.fn(),
    handleEditCancel: vi.fn(),
    handleDeleteComment: vi.fn(),
    handleViewHistory: vi.fn(),
    handleCloseHistory: vi.fn(),
    handleSubmitComment: vi.fn((event) => event.preventDefault()),
    handleCommentChange: vi.fn(),
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

describe('PostDetailScreen article and comment history wiring', () => {
  test('passes edited article affordance clicks to the runtime handler', async () => {
    const user = userEvent.setup();
    const runtime = createRuntime();

    render(<PostDetailScreen postId="post-1" runtime={runtime} />);
    const articleHistoryButton = screen.getByRole('button', { name: '查看文章編輯記錄' });
    const metadata = screen.getByTestId('post-metadata');
    const actionRow = screen.getByTestId('post-action-row');

    expect(within(metadata).getByText('剛剛')).toBeInTheDocument();
    expect(within(metadata).getByRole('button', { name: '查看文章編輯記錄' })).toBe(
      articleHistoryButton,
    );
    expect(within(actionRow).queryByRole('button', { name: '查看文章編輯記錄' })).toBeNull();

    await user.click(articleHistoryButton);

    expect(screen.getAllByText('已編輯')).toHaveLength(2);
    expect(runtime.handleViewArticleHistory).toHaveBeenCalledWith(editedPost);
  });

  test('renders article history modal with current and previous title/content', () => {
    render(
      <PostDetailScreen
        postId="post-1"
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

  test('keeps existing comment history modal behavior wired', async () => {
    const user = userEvent.setup();
    const runtime = createRuntime();

    render(<PostDetailScreen postId="post-1" runtime={runtime} />);
    await user.click(screen.getByRole('button', { name: '查看編輯記錄' }));

    expect(runtime.handleViewHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'comment-1',
        content: 'Current comment',
        isEdited: true,
      }),
    );
  });

  test('renders existing comment history modal and close handler', async () => {
    const user = userEvent.setup();
    const runtime = createRuntime({
      historyComment: editedComment,
      historyEntries: [
        {
          id: 'comment-history-1',
          content: 'Previous comment',
        },
      ],
    });

    render(<PostDetailScreen postId="post-1" runtime={runtime} />);
    const dialog = screen.getByRole('dialog', { name: '編輯記錄' });

    expect(within(dialog).getByText('Current comment')).toBeInTheDocument();
    expect(within(dialog).getByText('Previous comment')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '關閉' }));

    expect(runtime.handleCloseHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: within(dialog).getByRole('button', { name: '關閉' }),
        type: 'click',
      }),
    );
  });
});
