/**
 * @file Integration Test — CommentSection onCommentAdded callback
 * @description
 * TDD RED phase — tests that CommentSection invokes an `onCommentAdded`
 * callback with the new comment's ID after a comment is successfully submitted.
 *
 * This callback will be used by the parent page to trigger notification
 * creation for event comment threads.
 *
 * Expected behavior (not yet implemented):
 * 1. CommentSection accepts an `onCommentAdded` callback prop.
 * 2. After `addComment` succeeds, `onCommentAdded(commentId)` is called.
 * 3. The hook `useCommentMutations` accepts an `onSuccess` callback internally.
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. Use `@testing-library/react` for rendering.
 * 3. Use `user-event` for interactions — NEVER low-level event helpers.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 * 6. AAA pattern (Arrange, Act, Assert) is mandatory.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthContext } from '@/contexts/AuthContext';
import CommentSection from '@/components/CommentSection';
import { addComment } from '@/runtime/client/use-cases/event-comment-use-cases';

/* ==========================================================================
   Mocks
   ========================================================================== */

vi.mock('@/runtime/client/use-cases/event-comment-use-cases', () => ({
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  fetchCommentHistory: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('@/runtime/hooks/useComments', () => ({
  default: vi.fn(() => ({
    comments: [],
    setComments: vi.fn(),
    isLoading: false,
    hasMore: false,
    loadError: null,
    retryLoad: vi.fn(),
    loadMoreError: null,
    retryLoadMore: vi.fn(),
    sentinelRef: { current: null },
  })),
}));

vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { AuthContext: createContext({ user: null }) };
});

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('@/components/CommentCard', () => ({ default: () => <div /> }));
vi.mock('@/components/CommentEditModal', () => ({ default: () => null }));
vi.mock('@/components/CommentDeleteConfirm', () => ({ default: () => null }));
vi.mock('@/components/CommentHistoryModal', () => ({ default: () => null }));

/**
 * Mock CommentInput — exposes `onSubmit` via a simple form so integration
 * tests can trigger comment submission with a button click.
 */
vi.mock('@/components/CommentInput', () => ({
  default: ({ onSubmit, isSubmitting }) => (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit('test comment');
      }}
    >
      <button type="submit" disabled={isSubmitting}>
        送出
      </button>
    </form>
  ),
}));

/* Cast mock for .mockResolvedValue */
const mockedAddComment = /** @type {import('vitest').Mock} */ (addComment);

/* ==========================================================================
   Type Definitions
   ========================================================================== */

/**
 * @typedef {object} MockUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 使用者名稱。
 * @property {string} email - 使用者電子信箱。
 * @property {string} photoURL - 使用者大頭貼 URL。
 * @property {string | null} bio - 使用者簡介。
 * @property {() => Promise<string>} getIdToken - 取得 ID token。
 */

/* ==========================================================================
   Test Fixtures
   ========================================================================== */

/** @type {MockUser} */
const MOCK_USER = {
  uid: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  photoURL: 'http://photo.jpg',
  bio: null,
  getIdToken: () => Promise.resolve('mock-token'),
};

const MOCK_EVENT_ID = 'event1';
const MOCK_COMMENT_ID = 'new-comment-123';

/**
 * 建立 addComment 回傳的假留言資料。
 * @returns {object} mock comment data。
 */
function createMockCommentResponse() {
  return {
    id: MOCK_COMMENT_ID,
    authorUid: MOCK_USER.uid,
    authorName: MOCK_USER.name,
    authorPhotoURL: MOCK_USER.photoURL,
    content: 'test comment',
    createdAt: { toDate: () => new Date() },
    updatedAt: null,
    isEdited: false,
  };
}

/* ==========================================================================
   Tests
   ========================================================================== */

describe('CommentSection — onCommentAdded 回呼', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAddComment.mockResolvedValue(createMockCommentResponse());
  });

  it('送出留言後呼叫 onCommentAdded 回呼', async () => {
    // Arrange
    const mockOnCommentAdded = vi.fn();
    const user = userEvent.setup();

    render(
      <AuthContext.Provider value={{ user: MOCK_USER, setUser: vi.fn(), loading: false }}>
        <CommentSection eventId={MOCK_EVENT_ID} onCommentAdded={mockOnCommentAdded} />
      </AuthContext.Provider>,
    );

    // Act
    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    // Assert
    await vi.waitFor(() => {
      expect(mockOnCommentAdded).toHaveBeenCalledTimes(1);
    });
  });

  it('傳入正確的 commentId', async () => {
    // Arrange
    const mockOnCommentAdded = vi.fn();
    const user = userEvent.setup();

    render(
      <AuthContext.Provider value={{ user: MOCK_USER, setUser: vi.fn(), loading: false }}>
        <CommentSection eventId={MOCK_EVENT_ID} onCommentAdded={mockOnCommentAdded} />
      </AuthContext.Provider>,
    );

    // Act
    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    // Assert
    await vi.waitFor(() => {
      expect(mockOnCommentAdded).toHaveBeenCalledWith(MOCK_COMMENT_ID);
    });
  });
});
