/**
 * @file Integration Test for CommentSection Component
 * @description
 * TDD RED phase — tests for the comment section that does NOT exist yet.
 * CommentSection is the container component that manages all comment-related
 * state and renders CommentCard, CommentInput, CommentEditModal,
 * CommentDeleteConfirm, and CommentHistoryModal as children.
 *
 * Covers: US1 (browse), US2 (post), US3 (edit), US4 (delete), Accessibility.
 * FR refs: FR-002 ~ FR-026.
 *
 * Component path (expected): src/components/CommentSection
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. Use `@testing-library/react` for components.
 * 3. Use `user-event` for interactions — NEVER `fireEvent`.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 * 6. AAA Pattern (Arrange, Act, Assert) is mandatory.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { AuthContext } from '@/contexts/AuthContext';
import CommentSection from '@/components/CommentSection';
import {
  fetchComments,
  fetchMoreComments,
  getCommentById,
  addComment,
  updateComment,
  deleteComment,
  fetchCommentHistory,
} from '@/lib/firebase-comments';

vi.mock('@/lib/firebase-comments', () => ({
  fetchComments: vi.fn(),
  fetchMoreComments: vi.fn(),
  getCommentById: vi.fn(),
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  fetchCommentHistory: vi.fn(),
}));

vi.mock('@/lib/firebase-client', () => ({ db: {} }));

/* ==========================================================================
   Type Definitions
   ========================================================================== */

/**
 * @typedef {object} MockComment
 * @property {string} id - 留言 ID。
 * @property {string} authorUid - 作者 UID。
 * @property {string} authorName - 作者名稱。
 * @property {string} authorPhotoURL - 作者大頭貼。
 * @property {string} content - 留言內容。
 * @property {{ toDate: () => Date }} createdAt - 建立時間。
 * @property {{ toDate: () => Date } | null} updatedAt - 編輯時間。
 * @property {boolean} isEdited - 是否已編輯。
 */

/**
 * @typedef {object} MockUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 使用者名稱。
 * @property {string} email - 使用者信箱。
 * @property {string} photoURL - 使用者大頭貼 URL。
 */

/* ==========================================================================
   Helper Functions
   ========================================================================== */

/**
 * 建立預設的 mock comment 資料。
 * @param {Partial<MockComment>} [overrides] - 要覆蓋的欄位。
 * @returns {MockComment} 完整的 mock comment。
 */
function createMockComment(overrides = {}) {
  return {
    id: 'comment-1',
    authorUid: 'user-1',
    authorName: 'Alice',
    authorPhotoURL: 'https://example.com/alice.jpg',
    content: '這是一則測試留言',
    createdAt: { toDate: () => new Date(2026, 3, 2, 14, 30) },
    updatedAt: null,
    isEdited: false,
    ...overrides,
  };
}

/**
 * 建立預設的 mock user 資料。
 * @param {Partial<MockUser>} [overrides] - 要覆蓋的欄位。
 * @returns {MockUser} Mock user。
 */
function createMockUser(overrides = {}) {
  return {
    uid: 'user-1',
    name: 'Alice',
    email: 'alice@test.com',
    photoURL: 'https://example.com/alice.jpg',
    ...overrides,
  };
}

/**
 * 以 AuthContext.Provider 包裝 UI 並 render。
 * @param {import('react').ReactElement} ui - 要 render 的元素。
 * @param {{ user?: object | null, loading?: boolean }} [options] - Auth 選項。
 * @returns {import('@testing-library/react').RenderResult} Render 結果。
 */
function renderWithAuth(ui, { user = null, loading = false } = {}) {
  return render(
    <AuthContext.Provider value={{ user, setUser: vi.fn(), loading }}>{ui}</AuthContext.Provider>,
  );
}

/**
 * 建立多筆 mock comment 資料，依建立時間遞減排列（最新在前）。
 * @param {number} count - 要建立的數量。
 * @param {Partial<MockComment>} [baseOverrides] - 共用的覆蓋欄位。
 * @returns {MockComment[]} Mock comment 陣列。
 */
function createMockComments(count, baseOverrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    createMockComment({
      id: `comment-${i + 1}`,
      authorUid: `user-${(i % 3) + 1}`,
      authorName: ['Alice', 'Bob', 'Carol'][i % 3],
      authorPhotoURL: `https://example.com/${['alice', 'bob', 'carol'][i % 3]}.jpg`,
      content: `留言內容 #${i + 1}`,
      createdAt: {
        toDate: () => new Date(2026, 3, 2, 14, 30 - i),
      },
      ...baseOverrides,
    }),
  );
}

/* ==========================================================================
   IntersectionObserver Override for Infinite Scroll
   ========================================================================== */

/** @type {((entries: Array<{ isIntersecting: boolean }>) => void) | null} */
let intersectionCallback = null;

/* ==========================================================================
   Test Suites
   ========================================================================== */

describe('Integration: CommentSection', () => {
  beforeEach(() => {
    intersectionCallback = null;

    /**
     * IntersectionObserver mock — 使用 function constructor 避免 class-methods-use-this。
     * @param {(entries: Array<{ isIntersecting: boolean }>) => void} callback - Observer callback。
     */
    function MockIntersectionObserver(callback) {
      intersectionCallback = callback;
    }
    MockIntersectionObserver.prototype.observe = vi.fn();
    MockIntersectionObserver.prototype.unobserve = vi.fn();
    MockIntersectionObserver.prototype.disconnect = vi.fn();

    global.IntersectionObserver = /** @type {typeof IntersectionObserver} */ (
      /** @type {unknown} */ (MockIntersectionObserver)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /* ========================================================================
     US1 瀏覽留言
     ======================================================================== */

  describe('US1 瀏覽留言', () => {
    it('should display comment list with newest first when comments exist', async () => {
      // Arrange
      const comments = createMockComments(3);
      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: {},
      });

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      // Assert
      const region = await screen.findByRole('region', { name: /留言區/ });
      expect(region).toBeInTheDocument();

      const items = await screen.findAllByRole('listitem');
      expect(items).toHaveLength(3);

      expect(screen.getByText('留言內容 #1')).toBeInTheDocument();
      expect(screen.getByText('留言內容 #2')).toBeInTheDocument();
      expect(screen.getByText('留言內容 #3')).toBeInTheDocument();

      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('should show empty state when no comments exist', async () => {
      // Arrange
      fetchComments.mockResolvedValueOnce({
        comments: [],
        lastDoc: null,
      });

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/目前還沒有留言|還沒有人留言/)).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching comments', () => {
      // Arrange
      fetchComments.mockReturnValueOnce(new Promise(() => {}));

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      // Assert
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should load more comments when sentinel intersects', async () => {
      // Arrange
      const firstBatch = createMockComments(15);
      const secondBatch = createMockComments(5).map((c, i) => ({
        ...c,
        id: `comment-more-${i + 1}`,
        content: `更多留言 #${i + 1}`,
      }));

      /** @type {object} */
      const mockLastDoc = { id: 'cursor-doc' };

      fetchComments.mockResolvedValueOnce({
        comments: firstBatch,
        lastDoc: mockLastDoc,
      });
      fetchMoreComments.mockResolvedValueOnce({
        comments: secondBatch,
        lastDoc: null,
      });

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await screen.findAllByRole('listitem');

      // Simulate scroll to sentinel
      if (intersectionCallback) {
        intersectionCallback([{ isIntersecting: true }]);
      }

      // Assert
      await waitFor(() => {
        expect(fetchMoreComments).toHaveBeenCalledWith('e1', mockLastDoc, expect.any(Number));
      });

      const allItems = await screen.findAllByRole('listitem');
      expect(allItems).toHaveLength(20);
    });

    it('should show end hint when no more comments to load', async () => {
      // Arrange
      const comments = createMockComments(5);
      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/已顯示所有留言/)).toBeInTheDocument();
      });
    });

    it('should hide comment input when user is not logged in', async () => {
      // Arrange
      fetchComments.mockResolvedValueOnce({
        comments: createMockComments(2),
        lastDoc: null,
      });

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: null });

      // Assert
      await screen.findAllByRole('listitem');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should show comment input when user is logged in', async () => {
      // Arrange
      fetchComments.mockResolvedValueOnce({
        comments: createMockComments(2),
        lastDoc: null,
      });

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      // Assert
      await screen.findAllByRole('listitem');
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  /* ========================================================================
     US2 發表留言
     ======================================================================== */

  describe('US2 發表留言', () => {
    it('should submit comment and show it at top with input cleared', async () => {
      // Arrange
      const user = userEvent.setup();
      const existingComments = createMockComments(2);
      fetchComments.mockResolvedValueOnce({
        comments: existingComments,
        lastDoc: null,
      });

      addComment.mockResolvedValueOnce({ id: 'new-1' });
      getCommentById.mockResolvedValueOnce(
        createMockComment({
          id: 'new-1',
          authorUid: 'user-1',
          authorName: 'Alice',
          content: '新留言',
          createdAt: { toDate: () => new Date(2026, 3, 2, 15, 0) },
        }),
      );

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await screen.findAllByRole('listitem');

      // Act
      const textbox = screen.getByRole('textbox');
      await user.type(textbox, '新留言');

      const submitButton = screen.getByRole('button', { name: /送出/ });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(addComment).toHaveBeenCalledWith(
          'e1',
          expect.objectContaining({ uid: 'user-1' }),
          '新留言',
        );
      });

      await waitFor(() => {
        expect(screen.getByText('新留言')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveValue('');
      });
    });

    it('should disable submit button when input is empty or whitespace', async () => {
      // Arrange
      const user = userEvent.setup();
      fetchComments.mockResolvedValueOnce({
        comments: [],
        lastDoc: null,
      });

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /送出/ });

      // Assert — initially disabled
      expect(submitButton).toBeDisabled();

      // Act — type whitespace
      const textbox = screen.getByRole('textbox');
      await user.type(textbox, '   ');

      // Assert — still disabled
      expect(submitButton).toBeDisabled();

      // Act — type valid text
      await user.clear(textbox);
      await user.type(textbox, '有效的留言');

      // Assert — enabled
      expect(submitButton).toBeEnabled();
    });

    it('should show character count warning near 500 and disable at 501', async () => {
      // Arrange
      const user = userEvent.setup();
      fetchComments.mockResolvedValueOnce({
        comments: [],
        lastDoc: null,
      });

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textbox = screen.getByRole('textbox');

      // Act — type 450 chars (no warning)
      const text450 = 'a'.repeat(450);
      await user.type(textbox, text450);

      // Assert — no character count visible
      expect(screen.queryByText(/450/)).not.toBeInTheDocument();

      // Act — clear and type 499 chars
      await user.clear(textbox);
      const text499 = 'a'.repeat(499);
      await user.type(textbox, text499);

      // Assert — character count visible
      await waitFor(() => {
        expect(screen.getByText(/499/)).toBeInTheDocument();
      });

      // Act — type one more to reach 500
      await user.type(textbox, 'a');

      // Assert — 500 shown
      await waitFor(() => {
        expect(screen.getByText(/500/)).toBeInTheDocument();
      });

      // Verify submit still works at exactly 500
      const submitButton = screen.getByRole('button', { name: /送出/ });
      expect(submitButton).toBeEnabled();
    });

    it('should show error notification and preserve input on submit failure', async () => {
      // Arrange
      const user = userEvent.setup();
      fetchComments.mockResolvedValueOnce({
        comments: [],
        lastDoc: null,
      });

      addComment.mockRejectedValueOnce(new Error('Network error'));

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      // Act
      const textbox = screen.getByRole('textbox');
      await user.type(textbox, '會失敗的留言');

      const submitButton = screen.getByRole('button', { name: /送出/ });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/送出失敗，請再試一次/)).toBeInTheDocument();
      });

      expect(screen.getByRole('textbox')).toHaveValue('會失敗的留言');
    });

    it('should show loading state on submit button while submitting', async () => {
      // Arrange
      const user = userEvent.setup();
      fetchComments.mockResolvedValueOnce({
        comments: [],
        lastDoc: null,
      });

      addComment.mockReturnValueOnce(new Promise(() => {}));

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      // Act
      const textbox = screen.getByRole('textbox');
      await user.type(textbox, '送出中的留言');

      const submitButton = screen.getByRole('button', { name: /送出/ });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /送出/ })).toBeDisabled();
      });
    });

    it('should submit on Ctrl+Enter keyboard shortcut', async () => {
      // Arrange
      const user = userEvent.setup();
      fetchComments.mockResolvedValueOnce({
        comments: [],
        lastDoc: null,
      });

      addComment.mockResolvedValueOnce({ id: 'new-keyboard' });
      getCommentById.mockResolvedValueOnce(
        createMockComment({
          id: 'new-keyboard',
          content: '快捷鍵留言',
          createdAt: { toDate: () => new Date(2026, 3, 2, 15, 0) },
        }),
      );

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      // Act
      const textbox = screen.getByRole('textbox');
      await user.type(textbox, '快捷鍵留言');
      await user.keyboard('{Control>}{Enter}{/Control}');

      // Assert
      await waitFor(() => {
        expect(addComment).toHaveBeenCalled();
      });
    });
  });

  /* ========================================================================
     US3 編輯留言
     ======================================================================== */

  describe('US3 編輯留言', () => {
    it('should show three-dot menu only on author own comments', async () => {
      // Arrange
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          authorName: 'Alice',
          content: '我的留言',
        }),
        createMockComment({
          id: 'comment-other',
          authorUid: 'user-2',
          authorName: 'Bob',
          content: 'Bob 的留言',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Assert — only 1 three-dot button visible
      const menuButtons = screen.getAllByRole('button', { name: /更多操作/ });
      expect(menuButtons).toHaveLength(1);
    });

    it('should show edit and delete options in three-dot menu', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '我的留言',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Act
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);

      // Assert
      expect(screen.getByRole('menuitem', { name: /編輯留言/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /刪除留言/ })).toBeInTheDocument();
    });

    it('should open edit modal with prefilled content', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '原始留言內容',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Act — open menu then click edit
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);

      const editItem = screen.getByRole('menuitem', { name: /編輯留言/ });
      await user.click(editItem);

      // Assert
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();

      const textarea = within(dialog).getByRole('textbox');
      expect(textarea).toHaveValue('原始留言內容');
    });

    it('should disable finish button when content is same as original', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '原始留言內容',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Open edit modal
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: /編輯留言/ }));

      const dialog = await screen.findByRole('dialog');

      // Assert — finish button disabled when content unchanged
      const finishButton = within(dialog).getByRole('button', {
        name: /完成編輯/,
      });
      expect(finishButton).toBeDisabled();

      // Act — add trailing whitespace (trim should match original)
      const textarea = within(dialog).getByRole('textbox');
      await user.type(textarea, '  ');

      // Assert — still disabled
      expect(finishButton).toBeDisabled();
    });

    it('should enable finish button when content differs', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '原始留言內容',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Open edit modal
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: /編輯留言/ }));

      const dialog = await screen.findByRole('dialog');

      // Act — clear and type new content
      const textarea = within(dialog).getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, '修改過的留言內容');

      // Assert
      const finishButton = within(dialog).getByRole('button', {
        name: /完成編輯/,
      });
      expect(finishButton).toBeEnabled();
    });

    it('should call updateComment and close modal on finish', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '原始留言內容',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      updateComment.mockResolvedValueOnce(undefined);

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Open edit modal
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: /編輯留言/ }));

      const dialog = await screen.findByRole('dialog');

      // Act — modify and submit
      const textarea = within(dialog).getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, '編輯後的留言');

      const finishButton = within(dialog).getByRole('button', {
        name: /完成編輯/,
      });
      await user.click(finishButton);

      // Assert
      await waitFor(() => {
        expect(updateComment).toHaveBeenCalledWith(
          'e1',
          'comment-own',
          '編輯後的留言',
          '原始留言內容',
        );
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      expect(screen.getByText('編輯後的留言')).toBeInTheDocument();
      expect(screen.getByText(/已編輯/)).toBeInTheDocument();
    });

    it('should close edit modal without changes on cancel', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '不會被修改的留言',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Open edit modal
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: /編輯留言/ }));

      const dialog = await screen.findByRole('dialog');

      // Act — modify text then cancel
      const textarea = within(dialog).getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, '已修改但不會儲存');

      const cancelButton = within(dialog).getByRole('button', {
        name: /取消編輯/,
      });
      await user.click(cancelButton);

      // Assert
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      expect(screen.getByText('不會被修改的留言')).toBeInTheDocument();
      expect(updateComment).not.toHaveBeenCalled();
    });

    it('should show edited badge on edited comments', async () => {
      // Arrange
      const comments = [
        createMockComment({
          id: 'comment-edited',
          authorUid: 'user-1',
          content: '已編輯過的留言',
          isEdited: true,
          updatedAt: { toDate: () => new Date(2026, 3, 2, 15, 0) },
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/已編輯/)).toBeInTheDocument();
      });
    });

    it('should open history modal with all versions on edited badge click', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-edited',
          authorUid: 'user-1',
          content: '最新版本的留言',
          isEdited: true,
          updatedAt: { toDate: () => new Date(2026, 3, 2, 15, 0) },
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      fetchCommentHistory.mockResolvedValueOnce([
        {
          content: '原始版本的留言',
          editedAt: { toDate: () => new Date(2026, 3, 2, 14, 30) },
        },
        {
          content: '第二版的留言',
          editedAt: { toDate: () => new Date(2026, 3, 2, 14, 45) },
        },
      ]);

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await screen.findAllByRole('listitem');

      // Act — click the edited badge
      const editedBadge = screen.getByText(/已編輯/);
      await user.click(editedBadge);

      // Assert
      const historyDialog = await screen.findByRole('dialog');
      expect(historyDialog).toBeInTheDocument();

      expect(fetchCommentHistory).toHaveBeenCalledWith('e1', 'comment-edited');

      await waitFor(() => {
        expect(screen.getByText('原始版本的留言')).toBeInTheDocument();
        expect(screen.getByText('第二版的留言')).toBeInTheDocument();
      });
    });
  });

  /* ========================================================================
     US4 刪除留言
     ======================================================================== */

  describe('US4 刪除留言', () => {
    it('should open delete confirm dialog', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '我的留言',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Act — open menu then click delete
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);

      const deleteItem = screen.getByRole('menuitem', { name: /刪除留言/ });
      await user.click(deleteItem);

      // Assert
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/確定刪除留言/)).toBeInTheDocument();
    });

    it('should delete comment and remove from list on confirm', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-to-delete',
          authorUid: 'user-1',
          content: '即將被刪除的留言',
        }),
        createMockComment({
          id: 'comment-keep',
          authorUid: 'user-2',
          content: '保留的留言',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      deleteComment.mockResolvedValueOnce(undefined);

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Open menu then click delete
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: /刪除留言/ }));

      const dialog = await screen.findByRole('dialog');

      // Act — confirm delete
      const confirmButton = within(dialog).getByRole('button', {
        name: /確定刪除/,
      });
      await user.click(confirmButton);

      // Assert
      await waitFor(() => {
        expect(deleteComment).toHaveBeenCalledWith('e1', 'comment-to-delete');
      });

      await waitFor(() => {
        expect(screen.queryByText('即將被刪除的留言')).not.toBeInTheDocument();
      });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('保留的留言')).toBeInTheDocument();
    });

    it('should show loading state while deleting', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '我的留言',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      deleteComment.mockReturnValueOnce(new Promise(() => {}));

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Open menu then click delete
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: /刪除留言/ }));

      const dialog = await screen.findByRole('dialog');

      // Act — confirm delete
      const confirmButton = within(dialog).getByRole('button', {
        name: /確定刪除/,
      });
      await user.click(confirmButton);

      // Assert — button should be disabled while deleting
      await waitFor(() => {
        expect(
          within(dialog).getByRole('button', {
            name: /確定刪除|刪除中/,
          }),
        ).toBeDisabled();
      });
    });

    it('should show error on delete failure', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '我的留言',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      deleteComment.mockRejectedValueOnce(new Error('Delete failed'));

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Open menu then click delete
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: /刪除留言/ }));

      const dialog = await screen.findByRole('dialog');

      // Act — confirm delete
      const confirmButton = within(dialog).getByRole('button', {
        name: /確定刪除/,
      });
      await user.click(confirmButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/刪除失敗，請再試一次/)).toBeInTheDocument();
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should close dialog without deleting on cancel', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '我的留言',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Open menu then click delete
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: /刪除留言/ }));

      const dialog = await screen.findByRole('dialog');

      // Act — cancel
      const cancelButton = within(dialog).getByRole('button', {
        name: /取消刪除/,
      });
      await user.click(cancelButton);

      // Assert
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      expect(screen.getByText('我的留言')).toBeInTheDocument();
      expect(deleteComment).not.toHaveBeenCalled();
    });
  });

  /* ========================================================================
     Accessibility
     ======================================================================== */

  describe('Accessibility', () => {
    it('should have region role with aria-label on comment section', async () => {
      // Arrange
      fetchComments.mockResolvedValueOnce({
        comments: createMockComments(1),
        lastDoc: null,
      });

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      // Assert
      const region = await screen.findByRole('region', { name: /留言區/ });
      expect(region).toBeInTheDocument();
    });

    it('should render comment list as semantic ul/li', async () => {
      // Arrange
      fetchComments.mockResolvedValueOnce({
        comments: createMockComments(3),
        lastDoc: null,
      });

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      // Assert
      const list = await screen.findByRole('list');
      expect(list).toBeInTheDocument();

      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(3);
    });

    it('should have aria-modal on modal dialogs', async () => {
      // Arrange
      const user = userEvent.setup();
      const comments = [
        createMockComment({
          id: 'comment-own',
          authorUid: 'user-1',
          content: '我的留言',
        }),
      ];

      fetchComments.mockResolvedValueOnce({
        comments,
        lastDoc: null,
      });

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Act — open edit modal
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: /編輯留言/ }));

      // Assert
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should use time element with dateTime attribute', async () => {
      // Arrange
      fetchComments.mockResolvedValueOnce({
        comments: createMockComments(1),
        lastDoc: null,
      });

      // Act
      const { container } = renderWithAuth(<CommentSection eventId="e1" />, {
        user: createMockUser(),
      });

      await screen.findAllByRole('listitem');

      // Assert
      const timeElement = container.querySelector('time[dateTime]');
      expect(timeElement).toBeInTheDocument();
    });
  });
});
