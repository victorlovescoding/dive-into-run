/* eslint-disable jsdoc/require-jsdoc -- Focused UI prop-wiring test uses local mock components. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommentHistoryModal from '@/components/CommentHistoryModal';
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
        <button type="button" onClick={onRequestClose}>request close</button>
        <button type="button" onClick={onSaveDraft}>save draft</button>
        <button type="button" onClick={onContinueEditing}>continue editing</button>
        <button type="button" onClick={onDiscardDraft}>discard draft</button>
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
  default: function MockCommentCard({ comment, onEdit, onViewHistory }) {
    return (
      <div data-testid="comment-card">
        <p>{comment.content}</p>
        {comment.isEdited && (
          <button type="button" aria-label="查看編輯記錄" onClick={() => onViewHistory(comment)}>
            已編輯
          </button>
        )}
        <button type="button" onClick={() => onEdit(comment)}>edit comment</button>
      </div>
    );
  },
}));

vi.mock('@/components/CommentHistoryModal', () => ({
  default: vi.fn(({ comment, history, historyError, onClose }) => (
    <div role="dialog" aria-label="編輯記錄" data-testid="comment-history-modal">
      <p>current: {comment.content}</p>
      {history.map((entry) => <p key={entry.id}>history: {entry.content}</p>)}
      {historyError && <p role="alert">{historyError}</p>}
      <button type="button" onClick={onClose}>close history</button>
    </div>
  )),
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

const UPDATED_AT = {
  toDate: () => new Date('2026-06-03T01:00:00.000Z'),
};

function createPostComment(overrides = {}) {
  return {
    id: 'comment-1',
    authorUid: 'user-1',
    authorName: 'User One',
    authorImgURL: '',
    comment: 'Original post comment',
    createdAt: null,
    isAuthor: true,
    ...overrides,
  };
}

function createRuntime(overrides = {}) {
  return {
    user: {
      uid: 'user-1',
      name: 'User One',
      photoURL: '',
    },
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
    historyComment: null,
    historyEntries: [],
    historyError: null,
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
    handleViewHistory: vi.fn(),
    handleCloseHistory: vi.fn(),
    handleDeleteComment: vi.fn(),
    handleSubmitComment: vi.fn(),
    handleCommentChange: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
    this.open = true;
  });
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

describe('PostDetailScreen comment edit modal', () => {
  it('opens the shared edit modal from the owner comment action without changing the bottom input', async () => {
    const user = userEvent.setup();
    const runtime = createRuntime({
      comment: 'bottom draft',
      comments: [createPostComment()],
    });

    render(<PostDetailScreen postId="post-1" runtime={runtime} />);

    await user.click(screen.getByRole('button', { name: 'edit comment' }));

    expect(screen.getByRole('textbox', { name: '留言' })).toHaveValue('bottom draft');
    expect(screen.getByRole('textbox', { name: '' })).toHaveValue('Original post comment');
    expect(runtime.handleEditComment).toHaveBeenLastCalledWith('comment-1');
  });

  it('saves post comment edits through the runtime update path and closes on success', async () => {
    const user = userEvent.setup();
    const runtime = createRuntime({
      handleEditComment: vi.fn().mockResolvedValue(undefined),
      comments: [createPostComment()],
    });

    render(<PostDetailScreen postId="post-1" runtime={runtime} />);

    await user.click(screen.getByRole('button', { name: 'edit comment' }));
    const modalTextbox = screen.getByDisplayValue('Original post comment');
    await user.clear(modalTextbox);
    await user.type(modalTextbox, 'Updated post comment');
    await user.click(screen.getByRole('button', { name: '完成編輯' }));

    await waitFor(() =>
      expect(runtime.handleEditComment).toHaveBeenLastCalledWith(
        'comment-1',
        'Updated post comment',
      ),
    );
    expect(screen.queryByDisplayValue('Updated post comment')).not.toBeInTheDocument();
  });

  it('cancel closes the shared edit modal without changing bottom input or comment list', async () => {
    const user = userEvent.setup();
    const runtime = createRuntime({
      comment: 'bottom draft',
      comments: [createPostComment()],
    });

    render(<PostDetailScreen postId="post-1" runtime={runtime} />);

    await user.click(screen.getByRole('button', { name: 'edit comment' }));
    await user.clear(screen.getByDisplayValue('Original post comment'));
    await user.type(screen.getByRole('textbox', { name: '' }), 'Unsaved post comment');
    await user.click(screen.getByRole('button', { name: '取消編輯' }));

    expect(screen.getByRole('textbox', { name: '留言' })).toHaveValue('bottom draft');
    expect(screen.getByText('Original post comment')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Unsaved post comment')).not.toBeInTheDocument();
    expect(runtime.handleEditComment).toHaveBeenLastCalledWith('comment-1');
  });
});

describe('PostDetailScreen comment history wiring', () => {
  it('shows the edited affordance and calls runtime history with a normalized comment', async () => {
    const user = userEvent.setup();
    const rawComment = createPostComment({
      comment: 'Edited post comment',
      updatedAt: UPDATED_AT,
      isEdited: true,
    });
    const runtime = createRuntime({ comments: [rawComment], handleViewHistory: vi.fn() });

    render(<PostDetailScreen postId="post-1" runtime={runtime} />);

    expect(screen.getByText('已編輯')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看編輯記錄' }));

    expect(runtime.handleViewHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'comment-1',
        content: 'Edited post comment',
        updatedAt: UPDATED_AT,
        isEdited: true,
      }),
    );
    expect(runtime.handleViewHistory.mock.calls[0][0]).not.toBe(rawComment);
    expect(rawComment).not.toHaveProperty('content');
  });

  it('renders the shared history modal with normalized current and history content', async () => {
    const user = userEvent.setup();
    const rawHistoryComment = createPostComment({
      comment: 'Current post comment',
      updatedAt: UPDATED_AT,
      isEdited: true,
    });
    const runtime = createRuntime({
      historyComment: rawHistoryComment,
      historyEntries: [{ id: 'history-1', content: 'Previous post comment', editedAt: UPDATED_AT }],
      handleCloseHistory: vi.fn(),
    });

    render(<PostDetailScreen postId="post-1" runtime={runtime} />);

    expect(screen.getByRole('dialog', { name: '編輯記錄' })).toBeInTheDocument();
    expect(screen.getByText('current: Current post comment')).toBeInTheDocument();
    expect(screen.getByText('history: Previous post comment')).toBeInTheDocument();
    expect(CommentHistoryModal).toHaveBeenCalledWith(
      expect.objectContaining({
        comment: expect.objectContaining({
          id: 'comment-1',
          content: 'Current post comment',
          updatedAt: UPDATED_AT,
          isEdited: true,
        }),
        history: runtime.historyEntries,
        historyError: null,
        onClose: runtime.handleCloseHistory,
      }),
      undefined,
    );
    expect(rawHistoryComment).not.toHaveProperty('content');

    await user.click(screen.getByRole('button', { name: 'close history' }));

    expect(runtime.handleCloseHistory).toHaveBeenCalledTimes(1);
  });
});
