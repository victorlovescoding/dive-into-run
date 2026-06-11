import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PostDetailScreen from '../../../../src/ui/posts/PostDetailScreen.jsx';

const commentInputProps = [];

vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className }) => (
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ href, className, children }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/CommentInput', () => ({
  default: function MockCommentInput(props) {
    commentInputProps.push(props);
    const [draft, setDraft] = React.useState('');
    const avatarSrc = props.user?.photoURL || '/default-avatar.png';
    const isDisabled = props.isSubmitting || draft.trim() === '' || draft.length > 500;

    const handleSubmit = async () => {
      if (isDisabled) return;
      const didSubmit = await props.onSubmit(draft);
      if (didSubmit) setDraft('');
    };

    return (
      <div data-testid="post-comment-composer">
        <img src={avatarSrc} alt="目前使用者大頭貼" data-testid="post-comment-avatar" />
        <input
          aria-label="留言"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={props.isSubmitting}
        />
        <button type="button" aria-label="送出留言" onClick={handleSubmit} disabled={isDisabled}>
          送出
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/CommentCard', () => ({
  default: ({ comment }) => <article>{comment.content}</article>,
}));

vi.mock('@/components/CommentEditModal', () => ({
  default: () => <div role="dialog" aria-label="編輯留言" />,
}));

vi.mock('@/components/CommentHistoryModal', () => ({
  default: () => <div role="dialog" aria-label="留言編輯紀錄" />,
}));

vi.mock('@/components/ComposeModal', () => ({
  default: () => <div data-testid="compose-modal" />,
}));

vi.mock('@/components/EditHistoryModal', () => ({
  default: () => <div role="dialog" aria-label="文章編輯紀錄" />,
}));

vi.mock('@/components/PostCard', () => ({
  default: ({ post, children }) => (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      {children}
    </article>
  ),
}));

vi.mock('@/components/PostCardSkeleton', () => ({
  default: () => <div role="status">載入更多文章</div>,
}));

vi.mock('@/components/ShareButton', () => ({
  default: ({ title }) => <button type="button">分享 {title}</button>,
}));

const authenticatedUser = {
  uid: 'viewer-1',
  name: '目前使用者',
  photoURL: 'https://cdn.example.test/viewer.jpg',
};

/**
 * Creates the post detail runtime contract with test-focused defaults.
 * @param {Record<string, unknown>} overrides - Runtime values to override.
 * @returns {Record<string, unknown>} Complete runtime object for the screen.
 */
function createRuntime(overrides = {}) {
  return {
    user: authenticatedUser,
    post: {
      id: 'post-1',
      title: '文章標題',
      content: '文章內容',
      authorUid: 'author-1',
      commentsCount: 0,
      likesCount: 0,
      liked: false,
      isAuthor: false,
    },
    loading: false,
    error: null,
    shareUrl: 'https://example.test/posts/post-1',
    comments: [],
    highlightedCommentId: null,
    comment: '',
    editingComment: null,
    historyComment: null,
    historyEntries: [],
    historyError: null,
    articleHistoryPost: null,
    articleHistoryEntries: [],
    articleHistoryError: null,
    isUpdating: false,
    updateError: null,
    title: '',
    content: '',
    originalTitle: '',
    originalContent: '',
    isSubmitting: false,
    isDraftConfirmOpen: false,
    isLoadingNext: false,
    openMenuPostId: '',
    dialogRef: { current: null },
    bottomRef: { current: null },
    setTitle: vi.fn(),
    setContent: vi.fn(),
    handleToggleMenu: vi.fn(),
    handleCloseMenu: vi.fn(),
    handleOpenEdit: vi.fn(),
    handleRequestComposerClose: vi.fn(),
    handleSaveComposerDraft: vi.fn(),
    handleContinueEditingDraft: vi.fn(),
    handleDiscardComposerDraft: vi.fn(),
    handleSubmitPost: vi.fn(),
    handleDeletePost: vi.fn(),
    handleToggleLike: vi.fn(),
    handleToggleFavoritePost: vi.fn(),
    handleEditComment: vi.fn(),
    handleEditSave: vi.fn(),
    handleEditCancel: vi.fn(),
    handleDeleteComment: vi.fn(),
    handleViewHistory: vi.fn(),
    handleCloseHistory: vi.fn(),
    handleViewArticleHistory: vi.fn(),
    handleCloseArticleHistory: vi.fn(),
    handleSubmitComment: vi.fn().mockResolvedValue(true),
    handleCommentChange: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders the post detail screen with runtime overrides.
 * @param {Record<string, unknown>} runtimeOverrides - Runtime values to override.
 * @returns {ReturnType<typeof render>} React Testing Library render result.
 */
function renderScreen(runtimeOverrides = {}) {
  return render(<PostDetailScreen postId="post-1" runtime={createRuntime(runtimeOverrides)} />);
}

afterEach(() => {
  commentInputProps.length = 0;
  vi.clearAllMocks();
});

describe('PostDetailScreen comment composer', () => {
  it('renders the shared composer with current-user avatar, input, and submit for authenticated users', () => {
    renderScreen();

    expect(screen.getByTestId('post-comment-composer')).toBeInTheDocument();
    const avatar = screen.getByTestId('post-comment-avatar');
    expect(avatar).toHaveAttribute('src', authenticatedUser.photoURL);
    expect(screen.queryByRole('link', { name: '目前使用者大頭貼' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '留言' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '送出留言' })).toBeDisabled();
    expect(commentInputProps.at(-1)).toMatchObject({
      user: authenticatedUser,
      isSubmitting: false,
    });
  });

  it('passes the post detail composer layout class for authenticated users', () => {
    renderScreen();

    expect(commentInputProps.at(-1)?.className).toEqual(
      expect.stringContaining('postComposer'),
    );
  });

  it('adds comments bottom reserve only when the authenticated post composer is rendered', () => {
    renderScreen({
      comments: [
        {
          id: 'comment-1',
          authorUid: 'runner-1',
          content: '最後一則不能被遮住',
          createdAt: null,
        },
      ],
    });

    const commentsSection = screen.getByRole('region', { name: '文章留言' });
    expect(commentsSection.className).toEqual(
      expect.stringContaining('commentsWithComposerReserve'),
    );
  });

  it('passes authenticated users without a usable photoURL to the shared fallback-avatar path', () => {
    const userWithoutPhoto = { ...authenticatedUser, photoURL: '' };
    renderScreen({ user: userWithoutPhoto });

    expect(screen.getByTestId('post-comment-avatar')).toHaveAttribute('src', '/default-avatar.png');
    expect(commentInputProps.at(-1)).toMatchObject({
      user: userWithoutPhoto,
      isSubmitting: false,
    });
  });

  it('does not render a composer, avatar, input, submit, login prompt, or login CTA for anonymous users', () => {
    renderScreen({ user: null });

    expect(screen.queryByTestId('post-comment-composer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('post-comment-avatar')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '留言' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '送出留言' })).not.toBeInTheDocument();
    expect(screen.queryByText(/請先登入|登入後|登入留言/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /登入/ })).not.toBeInTheDocument();
    const commentsSection = screen.getByRole('region', { name: '文章留言' });
    expect(commentsSection.className).not.toEqual(
      expect.stringContaining('commentsWithComposerReserve'),
    );
  });

  it('wires shared composer submit content, submitting state, duplicate blocking, and clear-on-success', async () => {
    const user = userEvent.setup();
    const handleSubmitComment = vi.fn().mockResolvedValue(true);
    const { rerender } = renderScreen({ handleSubmitComment });

    await user.type(screen.getByRole('textbox', { name: '留言' }), '有效留言');
    await user.click(screen.getByRole('button', { name: '送出留言' }));

    expect(handleSubmitComment).toHaveBeenLastCalledWith('有效留言');
    expect(screen.getByRole('textbox', { name: '留言' })).toHaveValue('');

    rerender(
      <PostDetailScreen
        postId="post-1"
        runtime={createRuntime({
          handleSubmitComment,
          isSubmitting: true,
        })}
      />,
    );

    const textbox = screen.getByRole('textbox', { name: '留言' });
    const submitButton = screen.getByRole('button', { name: '送出留言' });
    expect(textbox).toBeDisabled();
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(handleSubmitComment).toHaveBeenLastCalledWith('有效留言');
  });
});
