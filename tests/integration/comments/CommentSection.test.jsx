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
 * 3. Use `user-event` for interactions — NEVER low-level event helpers.
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
  addDoc,
  collection,
  getDocs,
  runTransaction,
  startAfter,
  writeBatch,
} from 'firebase/firestore';

const firestoreMock = vi.hoisted(() => {
  class MockTimestamp {
    /**
     * @param {Date} date - Timestamp date value.
     */
    constructor(date) {
      this.date = date;
    }

    /**
     * @returns {Date} Date value.
     */
    toDate() {
      return this.date;
    }

    /**
     * @returns {MockTimestamp} Current timestamp.
     */
    static now() {
      return new MockTimestamp(new Date(2026, 3, 2, 15, 0));
    }

    /**
     * @param {Date} date - Date value.
     * @returns {MockTimestamp} Timestamp value.
     */
    static fromDate(date) {
      return new MockTimestamp(date);
    }
  }

  return {
    Timestamp: MockTimestamp,
    serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
    collection: vi.fn((_, ...segments) => ({
      kind: 'collection',
      path: segments.join('/'),
    })),
    doc: vi.fn((base, ...segments) => {
      const path =
        base?.kind === 'collection'
          ? [base.path, ...segments].filter(Boolean).join('/')
          : segments.join('/');
      const id = segments.at(-1) || 'generated-history-id';
      return { kind: 'doc', id, path };
    }),
    query: vi.fn((ref, ...constraints) => ({ kind: 'query', ref, constraints })),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    addDoc: vi.fn(),
    orderBy: vi.fn((field, direction) => ({ kind: 'orderBy', field, direction })),
    limit: vi.fn((count) => ({ kind: 'limit', count })),
    startAfter: vi.fn((snapshot) => ({ kind: 'startAfter', snapshot })),
    runTransaction: vi.fn(),
    writeBatch: vi.fn(),
  };
});

vi.mock('firebase/firestore', () => firestoreMock);

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

/* Cast mocked imports — vi.mock() 替換為 vi.fn()，JSDoc 需要 Mock 型別才認 .mockXxx() */
const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);
const mockedAddDoc = /** @type {import('vitest').Mock} */ (addDoc);
const mockedRunTransaction = /** @type {import('vitest').Mock} */ (runTransaction);
const mockedWriteBatch = /** @type {import('vitest').Mock} */ (writeBatch);
const mockedStartAfter = /** @type {import('vitest').Mock} */ (startAfter);

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

/**
 * 建立 Firestore document snapshot mock。
 * @param {MockComment | object} data - 文件資料。
 * @returns {{ id: string, data: () => object, exists: () => boolean, ref: object }} Snapshot mock。
 */
function createSnapshot(data) {
  const id = 'id' in data && typeof data.id === 'string' ? data.id : 'history-entry';
  return {
    id,
    data: () => data,
    exists: () => true,
    ref: { id },
  };
}

/**
 * Queue 一次 Firestore getDocs 回傳。
 * @param {Array<MockComment | object>} docs - 要回傳的文件資料。
 */
function mockGetDocsOnce(docs) {
  mockedGetDocs.mockResolvedValueOnce({
    docs: docs.map((item) => createSnapshot(item)),
  });
}

/**
 * Queue 一次永不 resolve 的 Firestore getDocs，用於 loading state。
 */
function mockGetDocsPendingOnce() {
  mockedGetDocs.mockReturnValueOnce(new Promise(() => {}));
}

/**
 * 建立 addDoc 的回傳 doc ref。
 * @param {string} id - 新文件 ID。
 */
function mockAddDocSuccessOnce(id) {
  mockedAddDoc.mockResolvedValueOnce({ id });
}

/**
 * 建立 runTransaction 成功 mock。
 */
function mockTransactionSuccessOnce() {
  mockedRunTransaction.mockImplementationOnce(async (_, callback) => {
    const tx = {
      get: vi.fn(async () => ({ exists: () => true })),
      set: vi.fn(),
      update: vi.fn(),
    };

    await callback(tx);
  });
}

/**
 * 建立 writeBatch mock。
 * @param {Promise<void> | Error} [commitResult] - commit 回傳值或錯誤。
 */
function mockWriteBatchOnce(commitResult = Promise.resolve()) {
  const batch = {
    delete: vi.fn(),
    commit: vi.fn(() =>
      commitResult instanceof Error ? Promise.reject(commitResult) : commitResult,
    ),
  };

  mockedWriteBatch.mockReturnValueOnce(batch);
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

    // jsdom 不支援 HTMLDialogElement.showModal/close，需 polyfill
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.setAttribute('open', '');
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close() {
        this.removeAttribute('open');
      };
    }

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
      mockGetDocsOnce(comments);

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
      mockGetDocsOnce([]);

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/目前還沒有留言|還沒有人留言/)).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching comments', () => {
      // Arrange
      mockGetDocsPendingOnce();

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

      mockGetDocsOnce(firstBatch);
      mockGetDocsOnce(secondBatch);

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await screen.findAllByRole('listitem');

      // Simulate scroll to sentinel
      if (intersectionCallback) {
        intersectionCallback([{ isIntersecting: true }]);
      }

      // Assert
      await waitFor(() => {
        expect(mockedStartAfter).toHaveBeenCalledWith(expect.objectContaining({ id: 'comment-15' }));
      });

      const allItems = await screen.findAllByRole('listitem');
      expect(allItems).toHaveLength(20);
    });

    it('should show end hint when no more comments to load', async () => {
      // Arrange
      const comments = createMockComments(5);
      mockGetDocsOnce(comments);
      mockGetDocsOnce([]);

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await screen.findAllByRole('listitem');
      if (intersectionCallback) {
        intersectionCallback([{ isIntersecting: true }]);
      }

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/已顯示所有留言/)).toBeInTheDocument();
      });
    });

    it('should hide comment input when user is not logged in', async () => {
      // Arrange
      mockGetDocsOnce(createMockComments(2));

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: null });

      // Assert
      await screen.findAllByRole('listitem');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should show comment input when user is logged in', async () => {
      // Arrange
      mockGetDocsOnce(createMockComments(2));

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
      mockGetDocsOnce(existingComments);
      mockAddDocSuccessOnce('new-1');

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await screen.findAllByRole('listitem');

      // Act
      const textbox = screen.getByRole('textbox');
      await user.type(textbox, '新留言');

      const submitButton = screen.getByRole('button', { name: /送出/ });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(mockedAddDoc).toHaveBeenCalledWith(
          expect.objectContaining({ path: 'events/e1/comments' }),
          expect.objectContaining({
            authorUid: 'user-1',
            content: '新留言',
          }),
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
      mockGetDocsOnce([]);

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
      mockGetDocsOnce([]);

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textbox = screen.getByRole('textbox');

      // Act — paste 450 chars (no warning)
      const text450 = 'a'.repeat(450);
      await user.click(textbox);
      await user.paste(text450);

      // Assert — no character count visible
      expect(screen.queryByText(/450/)).not.toBeInTheDocument();

      // Act — clear and paste 499 chars
      await user.clear(textbox);
      expect(textbox).toHaveValue('');
      const text499 = 'a'.repeat(499);
      await user.paste(text499);

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

      // Act — type one more to reach 501
      await user.type(textbox, 'a');

      // Assert — 501 shown and submit disabled
      await waitFor(() => {
        expect(screen.getByText(/501/)).toBeInTheDocument();
      });
      expect(submitButton).toBeDisabled();
    });

    it('should show error notification and preserve input on submit failure', async () => {
      // Arrange
      const user = userEvent.setup();
      mockGetDocsOnce([]);

      mockedAddDoc.mockRejectedValueOnce(new Error('Network error'));

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      // Act
      const textbox = screen.getByRole('textbox');
      expect(textbox).toHaveValue('');
      await user.click(textbox);
      await user.paste('會失敗的留言');

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
      mockGetDocsOnce([]);

      mockedAddDoc.mockReturnValueOnce(new Promise(() => {}));

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
      mockGetDocsOnce([]);
      mockAddDocSuccessOnce('new-keyboard');

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
        expect(mockedAddDoc).toHaveBeenCalled();
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

      mockGetDocsOnce(comments);

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

      mockGetDocsOnce(comments);

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

      mockGetDocsOnce(comments);

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

      mockGetDocsOnce(comments);

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

      mockGetDocsOnce(comments);

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

      mockGetDocsOnce(comments);
      mockTransactionSuccessOnce();

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
        expect(mockedRunTransaction).toHaveBeenCalled();
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

      mockGetDocsOnce(comments);

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
      expect(mockedRunTransaction).not.toHaveBeenCalled();
    });

    it('should show edited badge on edited comments', async () => {
      // Arrange
      const comments = [
        createMockComment({
          id: 'comment-edited',
          authorUid: 'user-1',
          content: '修改過的留言內容',
          isEdited: true,
          updatedAt: { toDate: () => new Date(2026, 3, 2, 15, 0) },
        }),
      ];

      mockGetDocsOnce(comments);

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

      mockGetDocsOnce(comments);
      mockGetDocsOnce([
        {
          id: 'history-1',
          content: '原始版本的留言',
          editedAt: { toDate: () => new Date(2026, 3, 2, 14, 30) },
        },
        {
          id: 'history-2',
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

      expect(collection).toHaveBeenCalledWith(
        expect.anything(),
        'events',
        'e1',
        'comments',
        'comment-edited',
        'history',
      );

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

      mockGetDocsOnce(comments);

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

      mockGetDocsOnce(comments);
      mockGetDocsOnce([]);
      mockWriteBatchOnce();

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
        expect(mockedWriteBatch).toHaveBeenCalled();
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

      mockGetDocsOnce(comments);
      mockGetDocsOnce([]);
      mockWriteBatchOnce(new Promise(() => {}));

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

      mockGetDocsOnce(comments);
      mockGetDocsOnce([]);
      mockWriteBatchOnce(new Error('Delete failed'));

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

      mockGetDocsOnce(comments);

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
      expect(mockedWriteBatch).not.toHaveBeenCalled();
    });
  });

  /* ========================================================================
     Accessibility
     ======================================================================== */

  describe('Accessibility', () => {
    it('should have region role with aria-label on comment section', async () => {
      // Arrange
      mockGetDocsOnce(createMockComments(1));

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser() });

      // Assert
      const region = await screen.findByRole('region', { name: /留言區/ });
      expect(region).toBeInTheDocument();
    });

    it('should render comment list as semantic ul/li', async () => {
      // Arrange
      mockGetDocsOnce(createMockComments(3));

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

      mockGetDocsOnce(comments);

      renderWithAuth(<CommentSection eventId="e1" />, { user: createMockUser({ uid: 'user-1' }) });

      await screen.findAllByRole('listitem');

      // Act — open edit modal
      const menuButton = screen.getByRole('button', { name: /更多操作/ });
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: /編輯留言/ }));

      // Assert — <dialog> opened via showModal() is natively modal
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('should use time element with dateTime attribute', async () => {
      // Arrange
      mockGetDocsOnce(createMockComments(1));

      // Act
      renderWithAuth(<CommentSection eventId="e1" />, {
        user: createMockUser(),
      });

      await screen.findAllByRole('listitem');

      // Assert — <time> 顯示的是 formatCommentTime 格式化結果
      const timeElement = screen.getByText('4/2 14:30');
      expect(timeElement.tagName).toBe('TIME');
      expect(timeElement).toHaveAttribute('dateTime');
    });
  });
});
