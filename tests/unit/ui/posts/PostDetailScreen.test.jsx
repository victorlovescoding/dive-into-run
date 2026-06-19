// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PostDetailScreen from '../../../../src/ui/posts/PostDetailScreen.jsx';

const commentInputProps = [];
const reportDialogProps = [];
const originalGlobalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  globalThis.navigator,
  'clipboard',
);
const originalWindowClipboardDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');

/**
 * Replace clipboard writeText without replacing the navigator object userEvent reads.
 * @param {ReturnType<typeof vi.fn>} writeText - Clipboard mock.
 * @returns {void}
 */
function setClipboardWriteText(writeText) {
  const navigatorWithClipboard = Object.create(globalThis.navigator);
  Object.defineProperty(navigatorWithClipboard, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  vi.stubGlobal('navigator', navigatorWithClipboard);
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}

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
  default: ({ comment, onReport }) => (
    <article id={comment.id} data-testid="comment-card">
      {comment.content}
      {onReport && (
        <button type="button" onClick={() => onReport(comment)}>
          report comment {comment.id}
        </button>
      )}
    </article>
  ),
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
  default: ({ post, children, onReport }) => (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      {onReport && (
        <button type="button" onClick={() => onReport(post)}>
          report post {post.id}
        </button>
      )}
      {children}
    </article>
  ),
}));

vi.mock('@/components/PostCardSkeleton', () => ({
  default: () => <div role="status">載入更多文章</div>,
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
  reportDialogProps.length = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();

  if (originalGlobalClipboardDescriptor) {
    Object.defineProperty(globalThis.navigator, 'clipboard', originalGlobalClipboardDescriptor);
  } else {
    Reflect.deleteProperty(globalThis.navigator, 'clipboard');
  }

  if (originalWindowClipboardDescriptor) {
    Object.defineProperty(window.navigator, 'clipboard', originalWindowClipboardDescriptor);
  } else {
    Reflect.deleteProperty(window.navigator, 'clipboard');
  }
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

  it('renders the pinned notification comment before normal post comments', () => {
    renderScreen({
      highlightedCommentId: 'comment-old',
      pinnedComment: {
        id: 'comment-old',
        authorUid: 'runner-old',
        authorName: '舊留言者',
        authorPhotoURL: 'https://example.test/old.png',
        content: '通知中的文章舊留言',
        createdAt: null,
      },
      visibleComments: [
        {
          id: 'comment-newer',
          authorUid: 'runner-new',
          content: '一般文章留言',
          createdAt: null,
        },
      ],
    });

    expect(screen.getByText('通知中的留言')).toBeInTheDocument();
    const cards = screen.getAllByTestId('comment-card');
    expect(cards.map((card) => card.textContent)).toEqual([
      '通知中的文章舊留言',
      '一般文章留言',
    ]);
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

describe('PostDetailScreen share actions', () => {
  it('copies the post detail shareUrl from the shared copy-link button', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboardWriteText(writeText);

    renderScreen({ shareUrl: 'https://example.test/posts/post-1?from=detail' });

    await user.click(screen.getByRole('button', { name: '複製連結' }));

    expect(writeText).toHaveBeenCalledWith('https://example.test/posts/post-1?from=detail');
    expect(screen.getByRole('button', { name: '已複製連結' })).toBeInTheDocument();
  });
});

describe('PostDetailScreen report wiring', () => {
  it('passes authenticated detail post report wiring to the post card', async () => {
    const user = userEvent.setup();
    const handleOpenReportDialog = vi.fn();

    renderScreen({ handleOpenReportDialog });

    await user.click(screen.getByRole('button', { name: 'report post post-1' }));

    expect(handleOpenReportDialog).toHaveBeenLastCalledWith({
      targetType: 'post',
      postId: 'post-1',
      target: expect.objectContaining({ id: 'post-1' }),
    });
  });

  it('passes normal post comment report wiring to visible comment cards', async () => {
    const user = userEvent.setup();
    const handleOpenReportDialog = vi.fn();
    const comment = {
      id: 'normal-comment-report-target',
      authorUid: 'runner-1',
      content: '一般文章留言',
      createdAt: null,
      isAuthor: false,
    };

    renderScreen({
      comments: [comment],
      visibleComments: [comment],
      handleOpenReportDialog,
    });

    await user.click(screen.getByRole('button', { name: 'report comment normal-comment-report-target' }));

    expect(handleOpenReportDialog).toHaveBeenLastCalledWith({
      targetType: 'postComment',
      postId: 'post-1',
      commentId: 'normal-comment-report-target',
      isNotificationTarget: false,
      target: expect.objectContaining({ id: 'normal-comment-report-target' }),
    });
  });

  it('passes notification target comment report wiring without adding extra target comments', async () => {
    const user = userEvent.setup();
    const handleOpenReportDialog = vi.fn();

    renderScreen({
      highlightedCommentId: 'target-comment-report',
      pinnedComment: {
        id: 'target-comment-report',
        authorUid: 'runner-target',
        content: '通知中的文章留言',
        createdAt: null,
        isAuthor: false,
      },
      visibleComments: [
        {
          id: 'normal-comment',
          authorUid: 'runner-normal',
          content: '一般文章留言',
          createdAt: null,
          isAuthor: false,
        },
      ],
      handleOpenReportDialog,
    });

    expect(screen.getAllByTestId('comment-card')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'report comment target-comment-report' }));

    expect(handleOpenReportDialog).toHaveBeenLastCalledWith({
      targetType: 'postComment',
      postId: 'post-1',
      commentId: 'target-comment-report',
      isNotificationTarget: true,
      target: expect.objectContaining({ id: 'target-comment-report' }),
    });
  });

  it('does not pass post or comment report wiring for anonymous users', () => {
    renderScreen({
      user: null,
      comments: [
        {
          id: 'anonymous-comment-report-hidden',
          authorUid: 'runner-1',
          content: '匿名不可檢舉',
          createdAt: null,
          isAuthor: false,
        },
      ],
    });

    expect(screen.queryByRole('button', { name: /report post/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /report comment/ })).not.toBeInTheDocument();
  });

  it('renders the detail post report dialog from the runtime report target', () => {
    renderScreen({
      reportDialogTarget: {
        targetType: 'post',
        postId: 'post-1',
        target: {
          id: 'post-1',
          title: '詳情頁檢舉文章',
        },
      },
      handleCloseReportDialog: vi.fn(),
      handleReportResult: vi.fn(),
    });

    expect(screen.getByRole('dialog', { name: '檢舉這篇文章' })).toBeInTheDocument();
    expect(screen.getByText('詳情頁檢舉文章')).toBeInTheDocument();
    expect(reportDialogProps.at(-1)).toMatchObject({
      target: { postId: 'post-1' },
      sourcePath: '/posts/post-1',
    });
  });

  it('renders the detail comment report dialog from the runtime report target', () => {
    renderScreen({
      reportDialogTarget: {
        targetType: 'postComment',
        postId: 'post-1',
        commentId: 'comment-report-dialog',
        target: {
          id: 'comment-report-dialog',
          content: '詳情頁檢舉留言',
        },
      },
      handleCloseReportDialog: vi.fn(),
      handleReportResult: vi.fn(),
    });

    expect(screen.getByRole('dialog', { name: '檢舉這則留言' })).toBeInTheDocument();
    expect(screen.getByText('詳情頁檢舉留言')).toBeInTheDocument();
    expect(reportDialogProps.at(-1)).toMatchObject({
      target: { postId: 'post-1', commentId: 'comment-report-dialog' },
      sourcePath: '/posts/post-1',
    });
  });

  it('uses the notification target comment URL as source path only for pinned comments', () => {
    renderScreen({
      reportDialogTarget: {
        targetType: 'postComment',
        postId: 'post-1',
        commentId: 'target-comment-report',
        isNotificationTarget: true,
        target: {
          id: 'target-comment-report',
          content: '通知目標檢舉留言',
        },
      },
      handleCloseReportDialog: vi.fn(),
      handleReportResult: vi.fn(),
    });

    expect(reportDialogProps.at(-1)).toMatchObject({
      target: { postId: 'post-1', commentId: 'target-comment-report' },
      sourcePath: '/posts/post-1?commentId=target-comment-report',
    });
  });
});
