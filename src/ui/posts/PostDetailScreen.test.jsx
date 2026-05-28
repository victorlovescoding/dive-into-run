/* eslint-disable jsdoc/require-jsdoc -- Focused UI prop-wiring test uses local mock components. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ComposeModal from '@/components/ComposeModal';
import PostDetailScreen from './PostDetailScreen';

vi.mock('@/components/ComposeModal', () => ({
  default: vi.fn(
    ({
      isDraftConfirmOpen,
      onRequestClose,
      onSaveDraft,
      onContinueEditing,
      onDiscardDraft,
    }) => (
      <div data-testid="compose-modal" data-confirm-open={String(isDraftConfirmOpen)}>
        <button type="button" onClick={onRequestClose}>
          request close
        </button>
        <button type="button" onClick={onSaveDraft}>
          save draft
        </button>
        <button type="button" onClick={onContinueEditing}>
          continue editing
        </button>
        <button type="button" onClick={onDiscardDraft}>
          discard draft
        </button>
      </div>
    ),
  ),
}));

vi.mock('@/components/PostCard', () => ({
  default: function MockPostCard({ children }) {
    return <article>{children}</article>;
  },
}));

vi.mock('@/components/CommentCard', () => ({
  default: function MockCommentCard() {
    return <div data-testid="comment-card" />;
  },
}));

vi.mock('@/components/PostCardSkeleton', () => ({
  default: function MockPostCardSkeleton() {
    return <div data-testid="post-card-skeleton" />;
  },
}));

vi.mock('@/components/ShareButton', () => ({
  default: function MockShareButton() {
    return <button type="button">share</button>;
  },
}));

vi.mock('next/link', () => ({
  default: function MockLink({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('next/image', () => ({
  default: function MockImage() {
    return <span data-testid="next-image" />;
  },
}));

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

function createRuntime() {
  return {
    user: null,
    post: POST_DETAIL,
    loading: false,
    error: null,
    shareUrl: '/posts/post-1',
    comments: [],
    highlightedCommentId: '',
    comment: '',
    title: 'Title',
    content: 'Content',
    originalTitle: 'Original title',
    originalContent: 'Original content',
    isSubmitting: false,
    isDraftConfirmOpen: true,
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
    handleDeleteComment: vi.fn(),
    handleSubmitComment: vi.fn(),
    handleCommentChange: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PostDetailScreen composer draft props', () => {
  it('passes detail draft confirmation state and handlers into ComposeModal', async () => {
    const user = userEvent.setup();
    const runtime = createRuntime();

    render(<PostDetailScreen postId="post-1" runtime={runtime} />);

    expect(screen.getByTestId('compose-modal')).toHaveAttribute('data-confirm-open', 'true');
    await user.click(screen.getByRole('button', { name: 'request close' }));
    await user.click(screen.getByRole('button', { name: 'save draft' }));
    await user.click(screen.getByRole('button', { name: 'continue editing' }));
    await user.click(screen.getByRole('button', { name: 'discard draft' }));

    expect(runtime.handleRequestComposerClose).toHaveBeenCalledTimes(1);
    expect(runtime.handleSaveComposerDraft).toHaveBeenCalledTimes(1);
    expect(runtime.handleContinueEditingDraft).toHaveBeenCalledTimes(1);
    expect(runtime.handleDiscardComposerDraft).toHaveBeenCalledTimes(1);
    expect(ComposeModal).toHaveBeenCalledWith(
      expect.objectContaining({
        isDraftConfirmOpen: true,
        onRequestClose: runtime.handleRequestComposerClose,
        onSaveDraft: runtime.handleSaveComposerDraft,
        onContinueEditing: runtime.handleContinueEditingDraft,
        onDiscardDraft: runtime.handleDiscardComposerDraft,
      }),
      undefined,
    );
  });
});
