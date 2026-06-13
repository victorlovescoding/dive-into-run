// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createContext, useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const AuthContext = createContext({ user: null, setUser: () => {}, loading: false });

const commentsHookMock = vi.fn();
const commentMutationsHookMock = vi.fn();
const commentInputMock = vi.fn();
const commentScrollTargetMock = vi.fn();
const eventGetCommentByIdMock = vi.fn();
let currentSearchParams = new URLSearchParams();
let CommentSection;

/**
 * Proxies the mocked comments hook for CommentSection.
 * @param {...unknown} args Hook arguments.
 * @returns {unknown} Mocked hook return value.
 */
function useMockComments(...args) {
  return commentsHookMock(...args);
}

/**
 * Proxies the mocked comment mutations hook for CommentSection.
 * @param {...unknown} args Hook arguments.
 * @returns {unknown} Mocked hook return value.
 */
function useMockCommentMutations(...args) {
  return commentMutationsHookMock(...args);
}

/**
 * Lightweight CommentInput mock that preserves composer submit behavior.
 * @param {object} props Component props.
 * @returns {import('react').JSX.Element} Mocked composer element.
 */
function MockCommentInput(props) {
  commentInputMock(props);
  const currentUser = props.currentUser ?? props.user ?? null;
  const [draft, setDraft] = useState('');
  const [localPending, setLocalPending] = useState(false);
  const trimmedDraft = draft.trim();
  const isDisabled =
    props.isSubmitting || localPending || trimmedDraft === '' || draft.length > 500;
  const avatarSrc = currentUser?.photoURL || '/default-avatar.png';

  /**
   * Submits the local draft through the supplied mutation callback.
   * @returns {Promise<void>} Resolves after the submit attempt settles.
   */
  async function submitDraft() {
    if (isDisabled) return;
    setLocalPending(true);
    try {
      const didSubmit = await props.onSubmit(draft);
      if (didSubmit) setDraft('');
    } finally {
      setLocalPending(false);
    }
  }

  return (
    <form aria-label="留言輸入區" onSubmit={(event) => event.preventDefault()}>
      {currentUser && (
        <img
          alt={`${currentUser.name ?? '目前使用者'}的大頭貼`}
          src={avatarSrc}
          data-testid="composer-avatar"
        />
      )}
      <input
        aria-label="留言"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={props.isSubmitting}
      />
      <button type="button" aria-label="送出留言" disabled={isDisabled} onClick={submitDraft}>
        送出
      </button>
    </form>
  );
}

beforeAll(async () => {
  vi.doMock('next/navigation', () => ({
    useSearchParams: () => currentSearchParams,
  }));

  vi.doMock('@/contexts/AuthContext', () => ({
    AuthContext,
  }));

  vi.doMock('@/runtime/hooks/useComments', () => ({
    default: useMockComments,
  }));

  vi.doMock('@/runtime/hooks/useCommentMutations', () => ({
    default: useMockCommentMutations,
  }));

  vi.doMock('@/runtime/hooks/useCommentScrollTarget', () => ({
    default: commentScrollTargetMock,
  }));

  vi.doMock('@/runtime/client/use-cases/event-comment-use-cases', () => ({
    getCommentById: eventGetCommentByIdMock,
  }));

  vi.doMock('@/components/CommentCard', () => ({
    default: ({ comment }) => (
      <article id={comment.id} data-testid="comment-card">
        {comment.content}
      </article>
    ),
  }));

  vi.doMock('@/components/CommentEditModal', () => ({
    default: () => <div data-testid="comment-edit-modal" />,
  }));

  vi.doMock('@/components/CommentDeleteConfirm', () => ({
    default: () => <div data-testid="comment-delete-confirm" />,
  }));

  vi.doMock('@/components/CommentHistoryModal', () => ({
    default: () => <div data-testid="comment-history-modal" />,
  }));

  vi.doMock('@/components/CommentInput', () => ({
    default: MockCommentInput,
  }));

  ({ default: CommentSection } = await import('../../../src/components/CommentSection.jsx'));
});

/**
 * Builds an authenticated user fixture.
 * @param {object} [overrides] Fixture fields to override.
 * @returns {object} Authenticated user fixture.
 */
function makeUser(overrides = {}) {
  return {
    uid: 'user-1',
    name: '跑者一號',
    email: 'runner@example.com',
    photoURL: 'https://example.com/avatar.png',
    ...overrides,
  };
}

/**
 * Renders the event comment section with the requested auth user.
 * @param {object|null} user Authenticated user, or null for anonymous state.
 * @returns {import('@testing-library/react').RenderResult} Render result.
 */
function renderWithAuth(user) {
  return render(
    <AuthContext.Provider value={{ user, setUser: vi.fn(), loading: false }}>
      <CommentSection eventId="event-1" />
    </AuthContext.Provider>,
  );
}

/**
 * Creates a manually resolved boolean promise for pending submit tests.
 * @returns {{promise: Promise<boolean>, resolve: (value: boolean) => void}} Deferred promise handle.
 */
function createDeferred() {
  /** @type {(value: boolean) => void} */
  let resolve = () => {};
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

/**
 * Builds the mocked comment query hook return value.
 * @param {object} [overrides] Hook result fields to override.
 * @returns {object} Mocked comments hook result.
 */
function makeComments(overrides = {}) {
  return {
    comments: [],
    setComments: vi.fn(),
    isLoading: false,
    hasMore: false,
    loadError: null,
    retryLoad: vi.fn(),
    loadMoreError: null,
    retryLoadMore: vi.fn(),
    sentinelRef: { current: null },
    ...overrides,
  };
}

/**
 * Builds the mocked comment mutation hook return value.
 * @param {object} [overrides] Hook result fields to override.
 * @returns {object} Mocked mutations hook result.
 */
function makeMutations(overrides = {}) {
  return {
    isSubmitting: false,
    submitError: null,
    highlightId: null,
    handleSubmit: vi.fn().mockResolvedValue(true),
    editingComment: null,
    isUpdating: false,
    updateError: null,
    handleEditOpen: vi.fn(),
    handleEditSave: vi.fn(),
    handleEditCancel: vi.fn(),
    deletingComment: null,
    isDeleting: false,
    deleteError: null,
    handleDeleteOpen: vi.fn(),
    handleDeleteConfirm: vi.fn(),
    handleDeleteCancel: vi.fn(),
    historyComment: null,
    historyEntries: [],
    historyError: null,
    handleViewHistory: vi.fn(),
    handleHistoryClose: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSearchParams = new URLSearchParams();
  eventGetCommentByIdMock.mockResolvedValue(null);
  commentsHookMock.mockReturnValue(makeComments());
  commentMutationsHookMock.mockReturnValue(makeMutations());
});

describe('CommentSection event composer identity', () => {
  it('passes authenticated user identity to the shared event composer', () => {
    const user = makeUser();

    renderWithAuth(user);

    expect(commentInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onSubmit: expect.any(Function),
        isSubmitting: false,
      }),
    );
    const composerProps = commentInputMock.mock.calls.at(-1)?.[0];
    expect(composerProps.currentUser ?? composerProps.user).toEqual(user);
    expect(screen.getByTestId('composer-avatar')).toHaveAttribute('src', user.photoURL);
  });

  it('passes the event composer layout class for authenticated users', () => {
    renderWithAuth(makeUser());

    const composerProps = commentInputMock.mock.calls.at(-1)?.[0];
    expect(composerProps.className).toEqual(expect.stringContaining('eventComposer'));
  });

  it('adds section bottom reserve when the authenticated event composer is rendered', () => {
    commentsHookMock.mockReturnValue(
      makeComments({
        comments: [
          {
            id: 'comment-1',
            authorUid: 'runner-1',
            content: '最後一則不能被遮住',
            createdAt: null,
          },
        ],
      }),
    );

    renderWithAuth(makeUser());

    const section = screen.getByRole('region', { name: '留言區' });
    expect(section.className).toEqual(expect.stringContaining('withComposerReserve'));
    expect(screen.getByText('已顯示所有留言')).toBeInTheDocument();
    expect(screen.getByRole('list').className).not.toEqual(
      expect.stringContaining('listWithReserve'),
    );
  });

  it('protects the authenticated empty state with the section reserve', () => {
    renderWithAuth(makeUser());

    const section = screen.getByRole('region', { name: '留言區' });
    expect(section.className).toEqual(expect.stringContaining('withComposerReserve'));
    expect(screen.getByText('還沒有人留言')).toBeInTheDocument();
  });

  it('uses the fallback avatar for an authenticated event composer user without a usable avatar', () => {
    const { unmount } = renderWithAuth(makeUser({ photoURL: '' }));

    expect(screen.getByTestId('composer-avatar')).toHaveAttribute('src', '/default-avatar.png');

    unmount();
    renderWithAuth(makeUser({ photoURL: null }));

    expect(screen.getByTestId('composer-avatar')).toHaveAttribute('src', '/default-avatar.png');
  });

  it('hides the event composer and does not add login UI for anonymous users', () => {
    renderWithAuth(null);

    const section = screen.getByRole('region', { name: '留言區' });
    expect(section.className).not.toEqual(expect.stringContaining('withComposerReserve'));
    expect(screen.getByText('還沒有人留言')).toBeInTheDocument();
    expect(commentInputMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('form', { name: '留言輸入區' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('composer-avatar')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '留言' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '送出留言' })).not.toBeInTheDocument();
    expect(screen.queryByText(/登入|login/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /登入|login/i })).not.toBeInTheDocument();
  });
});

describe('CommentSection event composer submit wiring', () => {
  it('blocks empty, whitespace-only, and over-limit event comment submissions', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(true);
    commentMutationsHookMock.mockReturnValue(makeMutations({ handleSubmit }));
    renderWithAuth(makeUser());

    const textbox = screen.getByRole('textbox', { name: '留言' });
    const submit = screen.getByRole('button', { name: '送出留言' });

    expect(submit).toBeDisabled();
    await user.click(submit);
    await user.type(textbox, '   ');
    expect(submit).toBeDisabled();
    await user.click(submit);
    await user.clear(textbox);
    await user.type(textbox, 'a'.repeat(501));
    expect(submit).toBeDisabled();
    await user.click(submit);

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('passes valid event comment content to the mutation hook and clears the draft on success', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(true);
    commentMutationsHookMock.mockReturnValue(makeMutations({ handleSubmit }));
    renderWithAuth(makeUser());

    const textbox = screen.getByRole('textbox', { name: '留言' });
    await user.type(textbox, '一起跑吧');
    await user.click(screen.getByRole('button', { name: '送出留言' }));

    expect(handleSubmit).toHaveBeenCalledWith('一起跑吧');
    expect(textbox).toHaveValue('');
  });

  it('preserves the event comment draft when the mutation reports failure', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(false);
    commentMutationsHookMock.mockReturnValue(makeMutations({ handleSubmit }));
    renderWithAuth(makeUser());

    const textbox = screen.getByRole('textbox', { name: '留言' });
    await user.type(textbox, '先保留這段');
    await user.click(screen.getByRole('button', { name: '送出留言' }));

    expect(handleSubmit).toHaveBeenCalledWith('先保留這段');
    expect(textbox).toHaveValue('先保留這段');
  });

  it('passes event mutation pending state to disable the shared composer controls', () => {
    commentMutationsHookMock.mockReturnValue(makeMutations({ isSubmitting: true }));
    renderWithAuth(makeUser());

    const composerProps = commentInputMock.mock.calls.at(-1)?.[0];
    expect(composerProps.isSubmitting).toBe(true);
    expect(screen.getByRole('textbox', { name: '留言' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '送出留言' })).toBeDisabled();
  });

  it('passes pending state to the event composer and blocks duplicate submit attempts while pending', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    const handleSubmit = vi.fn().mockReturnValue(deferred.promise);
    commentMutationsHookMock.mockReturnValue(makeMutations({ handleSubmit }));
    renderWithAuth(makeUser());

    const textbox = screen.getByRole('textbox', { name: '留言' });
    const submit = screen.getByRole('button', { name: '送出留言' });
    await user.type(textbox, '不要重複送出');
    await user.click(submit);

    expect(submit).toBeDisabled();
    await user.click(submit);
    await waitFor(() => expect(handleSubmit).toHaveBeenLastCalledWith('不要重複送出'));
    expect(handleSubmit.mock.calls).toEqual([['不要重複送出']]);

    deferred.resolve(true);
    await waitFor(() => expect(textbox).toHaveValue(''));
  });

  it('uses the URL comment id as the initial event scroll target', () => {
    currentSearchParams = new URLSearchParams('commentId=event-comment-from-url');

    renderWithAuth(makeUser());

    expect(commentScrollTargetMock).toHaveBeenCalledWith('event-comment-from-url');
  });

  it('renders the event URL target as a pinned notification comment before normal comments', async () => {
    currentSearchParams = new URLSearchParams('commentId=event-comment-old');
    eventGetCommentByIdMock.mockResolvedValue({
      id: 'event-comment-old',
      authorUid: 'runner-old',
      authorName: '舊留言者',
      authorPhotoURL: 'https://example.test/old.png',
      content: '通知中的活動舊留言',
      createdAt: null,
    });
    commentsHookMock.mockReturnValue(
      makeComments({
        comments: [
          {
            id: 'event-comment-newer',
            authorUid: 'runner-new',
            content: '一般活動留言',
            createdAt: null,
          },
        ],
      }),
    );

    renderWithAuth(makeUser());

    expect(await screen.findByText('通知中的活動舊留言')).toBeInTheDocument();
    expect(screen.getByText('通知中的留言')).toBeInTheDocument();
    const cards = screen.getAllByTestId('comment-card');
    expect(cards.map((card) => card.textContent)).toEqual([
      '通知中的活動舊留言',
      '一般活動留言',
    ]);
    expect(eventGetCommentByIdMock).toHaveBeenCalledWith('event-1', 'event-comment-old');
  });

  it('scrolls to the locally submitted event comment id after a successful submit', async () => {
    const user = userEvent.setup();
    currentSearchParams = new URLSearchParams('commentId=event-comment-from-url');
    const handleSubmit = vi.fn(async () => {
      const onSuccess = commentMutationsHookMock.mock.calls.at(-1)?.[3];
      onSuccess?.('event-comment-new');
      return true;
    });
    commentMutationsHookMock.mockReturnValue(makeMutations({ handleSubmit }));
    renderWithAuth(makeUser());

    await user.type(screen.getByRole('textbox', { name: '留言' }), '一起跑吧');
    await user.click(screen.getByRole('button', { name: '送出留言' }));

    await waitFor(() =>
      expect(commentScrollTargetMock).toHaveBeenLastCalledWith('event-comment-new'),
    );
  });

  it('lets a locally submitted event comment override the URL target pin', async () => {
    const user = userEvent.setup();
    currentSearchParams = new URLSearchParams('commentId=event-comment-from-url');
    eventGetCommentByIdMock.mockResolvedValue({
      id: 'event-comment-from-url',
      authorUid: 'runner-old',
      authorName: '通知留言者',
      authorPhotoURL: 'https://example.test/old.png',
      content: '通知中的舊活動留言',
      createdAt: null,
    });
    const handleSubmit = vi.fn(async () => {
      const onSuccess = commentMutationsHookMock.mock.calls.at(-1)?.[3];
      onSuccess?.('event-comment-new');
      return true;
    });
    commentMutationsHookMock.mockReturnValue(makeMutations({ handleSubmit }));
    renderWithAuth(makeUser());

    expect(await screen.findByText('通知中的舊活動留言')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: '留言' }), '一起跑吧');
    await user.click(screen.getByRole('button', { name: '送出留言' }));

    await waitFor(() =>
      expect(commentScrollTargetMock).toHaveBeenLastCalledWith('event-comment-new'),
    );
    expect(screen.queryByText('通知中的舊活動留言')).not.toBeInTheDocument();
  });

  it('updates the fetched pinned event comment through the mutation callback wiring', async () => {
    currentSearchParams = new URLSearchParams('commentId=event-comment-from-url');
    eventGetCommentByIdMock.mockResolvedValue({
      id: 'event-comment-from-url',
      authorUid: 'user-1',
      authorName: '通知留言者',
      authorPhotoURL: 'https://example.test/old.png',
      content: '編輯前舊活動留言',
      createdAt: null,
    });

    renderWithAuth(makeUser());
    expect(await screen.findByText('編輯前舊活動留言')).toBeInTheDocument();

    const mutationOptions = commentMutationsHookMock.mock.calls.at(-1)?.[4];
    await waitFor(() => expect(mutationOptions?.onCommentUpdated).toEqual(expect.any(Function)));
    act(() => {
      mutationOptions.onCommentUpdated({
        id: 'event-comment-from-url',
        authorUid: 'user-1',
        authorName: '通知留言者',
        authorPhotoURL: 'https://example.test/old.png',
        content: '編輯後舊活動留言',
        createdAt: null,
        isEdited: true,
      });
    });

    expect(screen.getByText('編輯後舊活動留言')).toBeInTheDocument();
    expect(screen.queryByText('編輯前舊活動留言')).not.toBeInTheDocument();
  });

  it('removes the fetched pinned event comment through the mutation callback wiring', async () => {
    currentSearchParams = new URLSearchParams('commentId=event-comment-from-url');
    eventGetCommentByIdMock.mockResolvedValue({
      id: 'event-comment-from-url',
      authorUid: 'user-1',
      authorName: '通知留言者',
      authorPhotoURL: 'https://example.test/old.png',
      content: '要刪除的舊活動留言',
      createdAt: null,
    });

    renderWithAuth(makeUser());
    expect(await screen.findByText('要刪除的舊活動留言')).toBeInTheDocument();

    const mutationOptions = commentMutationsHookMock.mock.calls.at(-1)?.[4];
    await waitFor(() => expect(mutationOptions?.onCommentDeleted).toEqual(expect.any(Function)));
    act(() => {
      mutationOptions.onCommentDeleted('event-comment-from-url');
    });

    expect(screen.queryByText('要刪除的舊活動留言')).not.toBeInTheDocument();
    expect(screen.getByText('還沒有人留言')).toBeInTheDocument();
  });

  it('keeps the URL event scroll target when submit fails', async () => {
    const user = userEvent.setup();
    currentSearchParams = new URLSearchParams('commentId=event-comment-from-url');
    const handleSubmit = vi.fn().mockResolvedValue(false);
    commentMutationsHookMock.mockReturnValue(makeMutations({ handleSubmit }));
    renderWithAuth(makeUser());

    await user.type(screen.getByRole('textbox', { name: '留言' }), '先保留這段');
    await user.click(screen.getByRole('button', { name: '送出留言' }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledWith('先保留這段'));
    expect(commentScrollTargetMock).toHaveBeenLastCalledWith('event-comment-from-url');
    expect(commentScrollTargetMock).not.toHaveBeenCalledWith('event-comment-new');
  });
});
